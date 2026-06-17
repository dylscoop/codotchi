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

/**
 * Accumulate today's cost from a statusline stdin JSON object.
 * Returns today's total USD cost.
 */
export function accumulateDailyCost(stdinJson) {
  const sessionId = stdinJson.session_id;
  const currentCost = stdinJson.cost?.total_cost_usd ?? 0;
  if (!sessionId) return 0;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const daily = loadDaily();

  if (!daily[today]) daily[today] = { costUsd: 0, sessions: {} };
  const todayEntry = daily[today];

  const prev = todayEntry.sessions[sessionId] ?? 0;
  const delta = Math.max(0, currentCost - prev);
  todayEntry.sessions[sessionId] = currentCost;
  todayEntry.costUsd = (todayEntry.costUsd || 0) + delta;

  saveDaily(daily);
  return todayEntry.costUsd;
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
