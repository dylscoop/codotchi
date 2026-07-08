/**
 * state.ts — persistence for the Claude Desktop codotchi pet.
 *
 * The Desktop pet shares the same state file as the VS Code / PyCharm IDE
 * extensions — it picks the most-recently-modified IDE state file so changes
 * from the IDE are reflected in Desktop chats and vice-versa.
 *
 * Files read/written:
 *   {ideBase}/codotchi/vscode/[<hash12>/]state.json  — shared VS Code pet state
 *   {ideBase}/codotchi/pycharm/state.json             — shared PyCharm pet state
 *   {ideBase}/codotchi/claude-desktop/session.json    — Desktop-only session counters
 *
 * Because a Claude Desktop MCP server only runs while one of its tools is being
 * called, real time passes "offline" between calls. On every load we apply
 * `applyOfflineDecay` for the elapsed gap so the pet reflects the time away —
 * the same rule the VS Code extension uses when the IDE was closed.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  type PetState,
  createPet,
  serialiseState,
  deserialiseState,
  applyOfflineDecay,
  VALID_PET_TYPES,
} from "./gameEngine.js";

export const SOURCE = "claude-desktop" as const;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/** Base config directory shared with the other codotchi integrations. */
function ideBase(): string {
  return process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");
}

/**
 * Find the most-recently-modified IDE state file across VS Code (flat and
 * per-workspace hash subdirectories) and PyCharm. Falls back to the VS Code
 * flat path so a fresh pet is written there on first run.
 */
export function resolveIDEStatePath(): string {
  const base = ideBase();
  const vscodeDir = path.join(base, "codotchi", "vscode");
  const fallback = path.join(vscodeDir, "state.json");
  const candidates: { path: string; mtime: number }[] = [];

  // VS Code flat (shared/global) path
  try {
    candidates.push({ path: fallback, mtime: fs.statSync(fallback).mtimeMs });
  } catch { /* not found */ }

  // VS Code per-workspace hash subdirectories
  try {
    for (const entry of fs.readdirSync(vscodeDir, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[0-9a-f]{12}$/.test(entry.name)) {
        const p = path.join(vscodeDir, entry.name, "state.json");
        try {
          candidates.push({ path: p, mtime: fs.statSync(p).mtimeMs });
        } catch { /* not found */ }
      }
    }
  } catch { /* vscodeDir not found */ }

  // PyCharm flat path
  const pycharmPath = path.join(base, "codotchi", "pycharm", "state.json");
  try {
    candidates.push({ path: pycharmPath, mtime: fs.statSync(pycharmPath).mtimeMs });
  } catch { /* not found */ }

  if (candidates.length === 0) return fallback;
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0].path;
}

/** Directory for Desktop-only session data (not shared with IDEs). */
function sessionDir(): string {
  return path.join(ideBase(), "codotchi", "claude-desktop");
}

function sessionPath(): string {
  return path.join(sessionDir(), "session.json");
}

function ensureSessionDir(): void {
  const dir = sessionDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Config (from Claude Desktop user_config, passed as env vars)
// ---------------------------------------------------------------------------

export interface DesktopConfig {
  petName: string;
  petType: string;
  devMode: boolean;
}

export function readConfig(): DesktopConfig {
  const rawType = (process.env["CODOTCHI_PET_TYPE"] ?? "codeling").trim();
  const petType = VALID_PET_TYPES.includes(rawType) ? rawType : "codeling";
  const name = (process.env["CODOTCHI_PET_NAME"] ?? "").trim();
  const rawDev = (process.env["CODOTCHI_DEV_MODE"] ?? "").trim().toLowerCase();
  return {
    petName: name.length > 0 ? name : "Codotchi",
    petType,
    devMode: rawDev === "true" || rawDev === "1",
  };
}

// ---------------------------------------------------------------------------
// Pet state  (shared IDE format: { state, savedAt })
// ---------------------------------------------------------------------------

interface IDEStateFile {
  state: Record<string, unknown>;
  savedAt: number;
}

export interface LoadedPet {
  state: PetState;
  mealsGivenThisCycle: number;
}

/**
 * Load the pet from the most-recently-modified IDE state file, applying
 * offline decay for the elapsed time since it was last saved. Creates a fresh
 * pet (written to the VS Code flat path) on first run or if no IDE state exists.
 */
export function loadPet(cfg: DesktopConfig): LoadedPet {
  const statePath = resolveIDEStatePath();
  let stored: IDEStateFile | null = null;
  try {
    stored = JSON.parse(fs.readFileSync(statePath, "utf8")) as IDEStateFile;
  } catch {
    stored = null;
  }

  if (!stored || !stored.state) {
    const fresh = createPet(cfg.petName, cfg.petType);
    return { state: fresh, mealsGivenThisCycle: 0 };
  }

  let state = deserialiseState(stored.state);
  const savedAt = typeof stored.savedAt === "number" ? stored.savedAt : Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - savedAt) / 1000);
  if (elapsedSeconds > 0) {
    state = applyOfflineDecay(state, elapsedSeconds);
  }
  return { state, mealsGivenThisCycle: 0 };
}

/** Persist the pet back to the same IDE state file it was loaded from. */
export function savePet(state: PetState, _mealsGivenThisCycle: number): void {
  const statePath = resolveIDEStatePath();
  const dir = path.dirname(statePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file: IDEStateFile = {
    state: serialiseState(state),
    savedAt: Date.now(),
  };
  fs.writeFileSync(statePath, JSON.stringify(file), "utf8");
}

// ---------------------------------------------------------------------------
// Session activity proxy (Desktop-only, drives the speech-bubble stats)
// ---------------------------------------------------------------------------

export interface SessionData {
  day: string;
  interactionsToday: number;
  treatsToday: number;
  lastActivityRewardMs: number;
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function loadSession(): SessionData {
  let data: Partial<SessionData> | null = null;
  try {
    data = JSON.parse(fs.readFileSync(sessionPath(), "utf8")) as Partial<SessionData>;
  } catch {
    data = null;
  }
  const day = today();
  if (!data || data.day !== day) {
    return { day, interactionsToday: 0, treatsToday: 0, lastActivityRewardMs: 0 };
  }
  return {
    day,
    interactionsToday: data.interactionsToday ?? 0,
    treatsToday: data.treatsToday ?? 0,
    lastActivityRewardMs: data.lastActivityRewardMs ?? 0,
  };
}

export function saveSession(session: SessionData): void {
  ensureSessionDir();
  fs.writeFileSync(sessionPath(), JSON.stringify(session, null, 2), "utf8");
}
