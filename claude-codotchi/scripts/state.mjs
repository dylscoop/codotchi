/**
 * state.mjs — Claude Code state persistence for claude-codotchi.
 *
 * Uses CLAUDE_PLUGIN_DATA env var (set by Claude Code to a stable per-plugin
 * data directory that survives plugin updates). Falls back to ~/.codotchi/claude/
 * when running outside Claude Code (e.g. direct node invocation for testing).
 *
 * Files written:
 *   codotchi-state.json   — pet state (PetState + metadata)
 *   codotchi-daily.json   — legacy daily accumulator (no longer written; usage is re-scanned from transcripts)
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

/** Read the local wrapper file directly, or null if not found / corrupt. */
function readLocalStateFile() {
  const p = statePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Load the pet state to use. Prefers whichever of VS Code/PyCharm's shared
 * state is most recently active (see resolveCanonicalPetPath below) so the
 * Claude Code terminal shows the same pet as those IDEs instead of its own
 * separate one. Metadata fields with no equivalent in the shared IDE file
 * format (terminalEnabled, createdDate, totalMessages, lastCodeActivityAt,
 * lastPetSpeechAt) always come from the local wrapper file regardless of
 * where the pet identity itself comes from.
 *
 * Falls back to the local file (or null, if none exists yet — callers then
 * create a fresh pet) when neither IDE has any usable state. That local
 * pet is never written anywhere VS Code/PyCharm would discover it.
 */
export function loadStateFile() {
  const local = readLocalStateFile();
  const anchor = resolveCanonicalPetPath();
  if (!anchor) return local;

  return {
    state: anchor.state,
    savedAt: anchor.savedAt,
    terminalEnabled: local?.terminalEnabled ?? true,
    createdDate: local?.createdDate ?? new Date().toISOString().slice(0, 10),
    totalMessages: local?.totalMessages ?? 0,
    lastCodeActivityAt: local?.lastCodeActivityAt,
    lastPetSpeechAt: local?.lastPetSpeechAt,
    _anchor: { ide: anchor.ide, filePath: anchor.filePath },
  };
}

/**
 * Save the file object (must include { state, savedAt, terminalEnabled, createdDate, totalMessages }).
 *
 * Always writes the full object to the local wrapper file first — an
 * unconditional private mirror/backup. No resolver ever scans this file, so
 * this is what keeps a pet with no active IDE anchor from becoming
 * accidentally discoverable.
 *
 * Then, if this object came from (or resolves to) an IDE anchor, also writes
 * the shared `{state, savedAt}` shape back to that same anchor file, so
 * edits made via Claude Code (feed, pat, etc.) are reflected in VS Code /
 * PyCharm too. Skipped for a dead pet, mirroring the guard both
 * vscode/src/persistence.ts and CodotchiPersistence.kt already apply before
 * publishing to their shared file.
 *
 * Reuses the anchor recorded on `obj._anchor` (set by loadStateFile) rather
 * than re-resolving from scratch — a consumer that does slow I/O between
 * load and save (e.g. hook-post-tool.mjs's periodic-speech branch) could
 * otherwise have the anchor drift mid-invocation and write into the wrong
 * IDE's file.
 *
 * Note: if VS Code/PyCharm is open and focused, its own tick loop ignores
 * external changes to its state file while ticking, so this write-back can
 * be silently overwritten within a few seconds. That's an accepted, existing
 * characteristic of this merge model (claude-desktop-codotchi and
 * opencode-codotchi's write-backs have the same exposure), not a bug.
 */
export function saveStateFile(obj) {
  const dir = dataDir();
  ensureDir(dir);
  fs.writeFileSync(statePath(), JSON.stringify(obj, null, 2), "utf8");

  if (!obj.state || obj.state.alive === false) return;

  let anchor = obj._anchor;
  if (!anchor) {
    const resolved = resolveCanonicalPetPath();
    anchor = resolved ? { ide: resolved.ide, filePath: resolved.filePath } : null;
  }
  if (!anchor) return;

  try {
    let currentState = null;
    try {
      currentState = JSON.parse(fs.readFileSync(anchor.filePath, "utf8")).state;
    } catch { /* missing/corrupt — treat as changed, write fresh below */ }
    if (currentState && JSON.stringify(currentState) === JSON.stringify(obj.state)) return;

    ensureDir(path.dirname(anchor.filePath));
    fs.writeFileSync(
      anchor.filePath,
      JSON.stringify({ state: obj.state, savedAt: Date.now() }, null, 2),
      "utf8"
    );
  } catch {
    // Best-effort write-back — swallow errors, matching persistence.ts / CodotchiPersistence.kt.
  }
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

// Pricing per million tokens (USD) by model prefix. Ordered most-specific
// first — checked with startsWith(), so longer/pricier sub-prefixes (e.g.
// claude-opus-4-8) must precede their shorter generic parent (claude-opus-4).
// Covers both real model-ID orderings: Claude 3.x puts the generation digit
// before the family name (claude-3-opus-...), while 4.x+ puts the family
// name first (claude-opus-4-...) — a single ordering can't match both.
const MODEL_PRICING = [
  ["claude-opus-4-8",    { input: 5,    output: 25,   cacheRead: 0.50,  cacheWrite: 6.25  }],
  ["claude-opus-4-1",    { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-3-5-sonnet",  { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-3-5-haiku",   { input: 0.80, output: 4,    cacheRead: 0.08,  cacheWrite: 1.00  }],
  ["claude-3-opus",      { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-3-sonnet",    { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-3-haiku",     { input: 0.25, output: 1.25, cacheRead: 0.03,  cacheWrite: 0.30  }],
  ["claude-opus-4",      { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-sonnet-5",    { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-sonnet-4",    { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-haiku-4-5",   { input: 1,    output: 5,    cacheRead: 0.10,  cacheWrite: 1.25  }],
  ["claude-fable-5",     { input: 10,   output: 50,   cacheRead: 1.00,  cacheWrite: 12.50 }],
];
const DEFAULT_PRICING = { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 };

function pricingForModel(model = "") {
  for (const [prefix, p] of MODEL_PRICING) {
    if (model.startsWith(prefix)) return p;
  }
  return DEFAULT_PRICING;
}

/** Epoch ms of local midnight at the start of the day containing `nowMs`. */
export function localDayStartMs(nowMs = Date.now()) {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local calendar date ("YYYY-MM-DD") for `nowMs` — the key "today" is measured by. */
export function localDateKey(nowMs = Date.now()) {
  const d = new Date(nowMs);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Transcript files under one project dir: top-level *.jsonl plus <session>/subagents/*.jsonl. */
function listTranscripts(projPath) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(projPath, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(projPath, e.name);
    if (e.isFile() && e.name.endsWith(".jsonl")) {
      out.push(p);
    } else if (e.isDirectory()) {
      const subDir = path.join(p, "subagents");
      try {
        for (const f of fs.readdirSync(subDir)) {
          if (f.endsWith(".jsonl")) out.push(path.join(subDir, f));
        }
      } catch { /* no subagents dir */ }
    }
  }
  return out;
}

/**
 * Scan Claude Code transcripts and sum today's usage (local calendar day).
 *
 * - "Today" starts at local midnight, compared against each message's parsed
 *   timestamp — so a session running across midnight is split at the user's
 *   midnight, not UTC's.
 * - Claude Code writes one JSONL line per content block, each repeating the
 *   message's usage (earlier lines may carry partial output_tokens). Lines are
 *   deduplicated by message.id + requestId; the last line seen wins.
 * - Subagent (Task) transcripts under <session>/subagents/ are included.
 *
 * Returns { costUsd, tokens, hourlyCostUsd, messageCount }.
 */
export function scanClaudeUsage({
  projsDir = path.join(os.homedir(), ".claude", "projects"),
  nowMs = Date.now(),
} = {}) {
  const dayStartMs = localDayStartMs(nowMs);
  const oneHourAgoMs = nowMs - 3_600_000;
  const byId = new Map();   // "msgId:requestId" -> entry (last line wins)
  const anonymous = [];     // lines without a message id — counted as-is
  let projects;
  try { projects = fs.readdirSync(projsDir); } catch { projects = []; }
  for (const proj of projects) {
    for (const fp of listTranscripts(path.join(projsDir, proj))) {
      try {
        if (fs.statSync(fp).mtimeMs < dayStartMs) continue;
      } catch { continue; }
      let lines;
      try { lines = fs.readFileSync(fp, "utf8").trim().split("\n"); } catch { continue; }
      for (const line of lines) {
        try {
          const d = JSON.parse(line);
          if (d.type !== "assistant" || !d.message?.usage) continue;
          let tsMs = null;
          if (d.timestamp) {
            tsMs = Date.parse(d.timestamp);
            if (Number.isNaN(tsMs) || tsMs < dayStartMs) continue;
          }
          const entry = { usage: d.message.usage, model: d.message.model ?? "", tsMs };
          if (d.message.id) byId.set(`${d.message.id}:${d.requestId ?? ""}`, entry);
          else anonymous.push(entry);
        } catch { /* skip malformed lines */ }
      }
    }
  }
  let costUsd = 0, tokens = 0, hourlyCostUsd = 0, messageCount = 0;
  for (const { usage: u, model, tsMs } of [...byId.values(), ...anonymous]) {
    const p = pricingForModel(model);
    const inp = u.input_tokens ?? 0;
    const out = u.output_tokens ?? 0;
    const cr  = u.cache_read_input_tokens ?? 0;
    const cc  = u.cache_creation_input_tokens ?? 0;
    const entryCost = (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000;
    costUsd += entryCost;
    tokens  += inp + out + cr + cc;
    messageCount += 1;
    if (tsMs !== null && tsMs >= oneHourAgoMs) hourlyCostUsd += entryCost;
  }
  return { costUsd, tokens, hourlyCostUsd, messageCount };
}

/**
 * Today's Claude Code cost and tokens, summed across all sessions (local day).
 * Returns { costUsd, tokens, hourlyCostUsd, messageCount }. messageCount is the
 * number of unique completed assistant turns today (including sub-agent/Task
 * turns) — used to compute a tokens-per-message average for display instead of
 * the raw cumulative token total.
 */
export function accumulateDailyUsage(sessionId) {
  // Back-compat: callers may pass a session ID or stdinJson object — ignored.
  // Always read directly from today's JSONL files — bypasses the checkpoint/delta
  // accumulator in codotchi-daily.json which produced inflated values when
  // sessions spanned midnight or when the daily JSON had stale state.
  return scanClaudeUsage();
}

/** @deprecated Use accumulateDailyUsage instead. */
export function accumulateDailyCost(stdinJson) {
  return accumulateDailyUsage(stdinJson).costUsd;
}

// ---------------------------------------------------------------------------
// Usage scan cache
//
// scanAllDailyUsage() walks every ~/.claude/projects/**/*.jsonl file modified
// today, which is too expensive to redo on every statusline refresh once
// refreshInterval is 1 second. Callers that refresh that often should cache
// the result here and only rescan every ~10s.
// ---------------------------------------------------------------------------

export function usageCachePath() {
  return path.join(dataDir(), "codotchi-usage-cache.json");
}

/** Returns the cached { at, costUsd, tokens, hourlyCostUsd, messageCount }, or null. */
export function loadUsageCache() {
  const p = usageCachePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function saveUsageCache(data) {
  const dir = dataDir();
  ensureDir(dir);
  fs.writeFileSync(usageCachePath(), JSON.stringify(data, null, 2), "utf8");
}

export function rankCachePath() {
  return path.join(dataDir(), "codotchi-rank-cache.json");
}

/** Returns the cached { at, rank, total }, or null. */
export function loadRankCache() {
  const p = rankCachePath();
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function saveRankCache(data) {
  const dir = dataDir();
  ensureDir(dir);
  fs.writeFileSync(rankCachePath(), JSON.stringify(data, null, 2), "utf8");
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
  // "full" = multi-line ASCII pet (default); "emoji" = compact moving-emoji line.
  statuslineMode: "full",
  // null = auto-match the pet's spriteType/stage/mood; set via /codotchi emoji <emoji>.
  statuslineEmoji: null,
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

// ---------------------------------------------------------------------------
// IDE state file helpers (VS Code / PyCharm)
// ---------------------------------------------------------------------------

/** Platform-specific base directory for all codotchi IDE state files. */
export function getIDEBase() {
  return process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");
}

/**
 * Scans `getIDEBase()/codotchi/<ide>/` for state.json files in the global
 * (flat) location and in any 12-char lowercase-hex subdirectory (per-
 * workspace/per-project hashes written by the VS Code extension and the
 * PyCharm plugin — see persistence.ts / CodotchiPersistence.kt). Returns all
 * found candidates, sorted newest-first by mtime.
 */
function collectIDECandidates(ide) {
  const base = path.join(getIDEBase(), "codotchi", ide);
  const global = path.join(base, "state.json");
  const candidates = [];
  try {
    if (fs.existsSync(global)) {
      candidates.push({ filePath: global, ide, mtime: fs.statSync(global).mtimeMs });
    }
    if (fs.existsSync(base)) {
      for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
        if (entry.isDirectory() && /^[0-9a-f]{12}$/.test(entry.name)) {
          const candidate = path.join(base, entry.name, "state.json");
          if (fs.existsSync(candidate)) {
            candidates.push({ filePath: candidate, ide, mtime: fs.statSync(candidate).mtimeMs });
          }
        }
      }
    }
  } catch { /* ignore — return whatever was collected before the error */ }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates;
}

/**
 * Returns the VS Code state file path to use: the most-recently-modified of
 * the flat (global) file or any per-workspace hash subdirectory file. Falls
 * back to the flat path (even if it doesn't exist yet) so callers have
 * somewhere to write a fresh pet.
 */
export function resolveVSCodeStatePath() {
  const global = path.join(getIDEBase(), "codotchi", "vscode", "state.json");
  const candidates = collectIDECandidates("vscode");
  return candidates.length > 0 ? candidates[0].filePath : global;
}

/**
 * Returns the PyCharm state file path to use, mirroring
 * resolveVSCodeStatePath(): the most-recently-modified of the flat (global)
 * file or any per-project hash subdirectory file. PyCharm writes the same
 * 12-char-hex scheme as VS Code (see CodotchiPersistence.kt) — previously
 * only the flat path was checked here, missing per-project pets.
 */
export function resolvePyCharmStatePath() {
  const global = path.join(getIDEBase(), "codotchi", "pycharm", "state.json");
  const candidates = collectIDECandidates("pycharm");
  return candidates.length > 0 ? candidates[0].filePath : global;
}

/**
 * Load a VS Code or PyCharm state file.
 * Returns the parsed file object (with `state` and `savedAt`) or null.
 */
export function loadIDEStateFile(ide) {
  let filePath;
  if (ide === "vscode") {
    filePath = resolveVSCodeStatePath();
  } else if (ide === "pycharm") {
    filePath = resolvePyCharmStatePath();
  } else {
    return null;
  }
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Finds the canonical pet identity for claude-codotchi to merge with: the
 * most-recently-modified state file across both VS Code and PyCharm (flat +
 * per-workspace/per-project hash subdirectories), skipping over any
 * candidate with missing or corrupt/partial JSON in favour of the
 * next-newest one.
 *
 * Returns `{ filePath, ide, state, savedAt }` for the first valid candidate,
 * or `null` if neither IDE has any usable state at all — callers should fall
 * back to claude-codotchi's own private local pet in that case.
 */
export function resolveCanonicalPetPath() {
  const candidates = [
    ...collectIDECandidates("vscode"),
    ...collectIDECandidates("pycharm"),
  ].sort((a, b) => b.mtime - a.mtime);

  for (const { filePath, ide } of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (parsed && parsed.state) {
        return { filePath, ide, state: parsed.state, savedAt: parsed.savedAt };
      }
    } catch { /* corrupt/partial — try the next-newest candidate */ }
  }
  return null;
}
