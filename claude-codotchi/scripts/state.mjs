/**
 * state.mjs — Claude Code state persistence for claude-codotchi.
 *
 * Uses CLAUDE_PLUGIN_DATA env var (set by Claude Code to a stable per-plugin
 * data directory that survives plugin updates). Falls back to ~/.codotchi/claude/
 * when running outside Claude Code (e.g. direct node invocation for testing).
 *
 * Files written:
 *   codotchi-state.json   — pet state (PetState + metadata)
 *   codotchi-daily.json   — daily cost/token accumulator (UTC-date keyed)
 *   codotchi-config.json  — user config (cost thresholds, terminalEnabled)
 */

import fs from "fs";
import path from "path";
import os from "os";

function dataDir() {
  return (
    process.env.CLAUDE_PLUGIN_DATA ||
    path.join(os.homedir(), ".codotchi", "claude")
  );
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Pet state
// ---------------------------------------------------------------------------

export function statePath() {
  return path.join(dataDir(), "codotchi-state.json");
}

/** Load and return the saved file object, or null if not found / corrupt. */
export function loadStateFile() {
  const p = statePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/** Save the file object (must include { state, savedAt, terminalEnabled, createdDate, totalMessages }). */
export function saveStateFile(obj) {
  const dir = dataDir();
  ensureDir(dir);
  fs.writeFileSync(statePath(), JSON.stringify(obj, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Daily cost/token tracking
// ---------------------------------------------------------------------------

export function dailyPath() {
  return path.join(dataDir(), "codotchi-daily.json");
}

/** Returns { [utcDate]: { costUsd, sessions: { [sessionId]: lastCostUsd } } } */
export function loadDaily() {
  const p = dailyPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

export function saveDaily(data) {
  const dir = dataDir();
  ensureDir(dir);
  fs.writeFileSync(dailyPath(), JSON.stringify(data, null, 2), "utf8");
}

// Pricing per million tokens (USD) by model prefix.
const MODEL_PRICING = {
  "claude-opus-4":    { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 },
  "claude-sonnet-4":  { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-haiku-4":   { input: 0.80, output: 4,    cacheRead: 0.08,  cacheWrite: 1.00  },
  "claude-opus-3":    { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 },
  "claude-sonnet-3":  { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-haiku-3":   { input: 0.25, output: 1.25, cacheRead: 0.03,  cacheWrite: 0.30  },
  "default":          { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
};

function pricingForModel(model = "") {
  for (const [prefix, p] of Object.entries(MODEL_PRICING)) {
    if (prefix !== "default" && model.startsWith(prefix)) return p;
  }
  return MODEL_PRICING["default"];
}

/**
 * Read current session's cumulative token usage from its JSONL transcript.
 * Returns { costUsd, tokens } for the session so far.
 */
export function readSessionUsage(sessionId) {
  if (!sessionId) return { costUsd: 0, tokens: 0 };
  const projsDir = path.join(os.homedir(), ".claude", "projects");
  let jsonlPath = null;
  try {
    for (const proj of fs.readdirSync(projsDir)) {
      const candidate = path.join(projsDir, proj, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) { jsonlPath = candidate; break; }
    }
  } catch { return { costUsd: 0, tokens: 0 }; }
  if (!jsonlPath) return { costUsd: 0, tokens: 0 };

  let costUsd = 0, tokens = 0;
  try {
    const lines = fs.readFileSync(jsonlPath, "utf8").trim().split("\n");
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        if (d.type !== "assistant" || !d.message?.usage) continue;
        const u = d.message.usage;
        const p = pricingForModel(d.message.model ?? "");
        const inp = u.input_tokens ?? 0;
        const out = u.output_tokens ?? 0;
        const cr  = u.cache_read_input_tokens ?? 0;
        const cc  = u.cache_creation_input_tokens ?? 0;
        costUsd += (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000;
        tokens  += inp + out + cr + cc;
      } catch { /* skip malformed lines */ }
    }
  } catch { return { costUsd: 0, tokens: 0 }; }
  return { costUsd, tokens };
}

/**
 * Scan all ~/.claude/projects/ JSONL files modified today and sum up usage.
 * Used as a fallback when no session ID is available (e.g. statusline plugin subprocess).
 */
function scanAllDailyUsage() {
  const projsDir = path.join(os.homedir(), ".claude", "projects");
  const today = new Date().toISOString().slice(0, 10);
  let costUsd = 0, tokens = 0;
  try {
    for (const proj of fs.readdirSync(projsDir)) {
      const projPath = path.join(projsDir, proj);
      let files;
      try { files = fs.readdirSync(projPath); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith(".jsonl")) continue;
        const fp = path.join(projPath, f);
        try {
          if (fs.statSync(fp).mtime.toISOString().slice(0, 10) < today) continue;
        } catch { continue; }
        try {
          const lines = fs.readFileSync(fp, "utf8").trim().split("\n");
          for (const line of lines) {
            try {
              const d = JSON.parse(line);
              if (d.type !== "assistant" || !d.message?.usage) continue;
              if (d.timestamp && !d.timestamp.startsWith(today)) continue;
              const u = d.message.usage;
              const p = pricingForModel(d.message.model ?? "");
              const inp = u.input_tokens ?? 0;
              const out = u.output_tokens ?? 0;
              const cr  = u.cache_read_input_tokens ?? 0;
              const cc  = u.cache_creation_input_tokens ?? 0;
              costUsd += (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000;
              tokens  += inp + out + cr + cc;
            } catch { /* skip malformed lines */ }
          }
        } catch {}
      }
    }
  } catch {}
  return { costUsd, tokens };
}

/**
 * Accumulate today's cost and tokens from the current session's JSONL transcript.
 * sessionId defaults to CLAUDE_CODE_SESSION_ID env var.
 * Returns { costUsd, tokens } — both accumulated across all sessions today.
 */
export function accumulateDailyUsage(sessionId) {
  // Back-compat: callers may pass a stdinJson object — ignore it.
  if (sessionId && typeof sessionId === "object") sessionId = undefined;
  sessionId = sessionId ?? process.env.CLAUDE_CODE_SESSION_ID;

  // No session ID — fall back to scanning all project JSONLs for today.
  if (!sessionId) {
    return scanAllDailyUsage();
  }

  const { costUsd: currentCost, tokens: currentTokens } = readSessionUsage(sessionId);

  const today = new Date().toISOString().slice(0, 10);
  const daily = loadDaily();

  if (!daily[today]) daily[today] = { costUsd: 0, tokens: 0, sessions: {} };
  const todayEntry = daily[today];
  if (todayEntry.tokens == null) todayEntry.tokens = 0;

  const prevEntry = todayEntry.sessions[sessionId];
  const prevCost   = typeof prevEntry === "object" ? (prevEntry.lastCostUsd  ?? 0) : (prevEntry ?? 0);
  const prevTokens = typeof prevEntry === "object" ? (prevEntry.lastTokens   ?? 0) : 0;

  const costDelta   = Math.max(0, currentCost   - prevCost);
  const tokenDelta  = Math.max(0, currentTokens - prevTokens);

  todayEntry.sessions[sessionId] = { lastCostUsd: currentCost, lastTokens: currentTokens };
  todayEntry.costUsd = (todayEntry.costUsd || 0) + costDelta;
  todayEntry.tokens  = (todayEntry.tokens  || 0) + tokenDelta;

  saveDaily(daily);

  // If per-session tracking has no data yet (new session or JSONL not found),
  // fall back to scanning all project JSONLs so we always show something.
  if (todayEntry.costUsd === 0 && todayEntry.tokens === 0) {
    return scanAllDailyUsage();
  }

  return { costUsd: todayEntry.costUsd, tokens: todayEntry.tokens };
}

/** @deprecated Use accumulateDailyUsage instead. */
export function accumulateDailyCost(stdinJson) {
  return accumulateDailyUsage(stdinJson).costUsd;
}

// ---------------------------------------------------------------------------
// Config (cost thresholds, display toggle)
// ---------------------------------------------------------------------------

export function configPath() {
  return path.join(dataDir(), "codotchi-config.json");
}

const DEFAULT_CONFIG = {
  terminalEnabled: true,
  warnThresholdUsd: 30,
  shoutThresholdUsd: 50,
  petSpeechIntervalMs: 300000,
};

export function loadConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) return { ...DEFAULT_CONFIG };
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(p, "utf8")) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(cfg) {
  const dir = dataDir();
  ensureDir(dir);
  fs.writeFileSync(configPath(), JSON.stringify(cfg, null, 2), "utf8");
}
