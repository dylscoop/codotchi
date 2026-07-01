/**
 * state.ts — persistence for the Claude Desktop codotchi pet.
 *
 * The Desktop pet is INDEPENDENT of the VS Code / PyCharm / OpenCode pets: it
 * has its own state file under a dedicated `claude-desktop` subdirectory so it
 * never conflicts with the IDE integrations.
 *
 * Files written (in the same directory):
 *   state.json     — { state: SerialisedPetState, savedAt, mealsGivenThisCycle }
 *   session.json   — { day, interactionsToday, treatsToday, lastActivityRewardMs }
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

/** Base directory shared with the other codotchi integrations. */
function ideBase(): string {
  return process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");
}

/** Dedicated directory for the Claude Desktop pet. */
export function stateDir(): string {
  return path.join(ideBase(), "codotchi", "claude-desktop");
}

function statePath(): string {
  return path.join(stateDir(), "state.json");
}

function sessionPath(): string {
  return path.join(stateDir(), "session.json");
}

function ensureDir(): void {
  const dir = stateDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Config (from Claude Desktop user_config, passed as env vars)
// ---------------------------------------------------------------------------

export interface DesktopConfig {
  petName: string;
  petType: string;
  reducedMotion: boolean;
}

export function readConfig(): DesktopConfig {
  const rawType = (process.env["CODOTCHI_PET_TYPE"] ?? "codeling").trim();
  const petType = VALID_PET_TYPES.includes(rawType) ? rawType : "codeling";
  const name = (process.env["CODOTCHI_PET_NAME"] ?? "").trim();
  return {
    petName: name.length > 0 ? name : "Codotchi",
    petType,
    reducedMotion: /^(1|true|yes)$/i.test(process.env["CODOTCHI_REDUCED_MOTION"] ?? ""),
  };
}

// ---------------------------------------------------------------------------
// Pet state
// ---------------------------------------------------------------------------

interface StoredFile {
  state: Record<string, unknown>;
  savedAt: number;
  mealsGivenThisCycle: number;
}

export interface LoadedPet {
  state: PetState;
  mealsGivenThisCycle: number;
}

/**
 * Load the pet, applying offline decay for the elapsed time since it was last
 * saved. Creates a fresh pet on first run (or if the file is missing/corrupt).
 */
export function loadPet(cfg: DesktopConfig): LoadedPet {
  let stored: StoredFile | null = null;
  try {
    const raw = fs.readFileSync(statePath(), "utf8");
    stored = JSON.parse(raw) as StoredFile;
  } catch {
    stored = null;
  }

  if (!stored || typeof stored !== "object" || !stored.state) {
    const fresh = createPet(cfg.petName, cfg.petType);
    return { state: fresh, mealsGivenThisCycle: 0 };
  }

  let state = deserialiseState(stored.state);
  const savedAt = typeof stored.savedAt === "number" ? stored.savedAt : Date.now();
  const elapsedSeconds = Math.max(0, (Date.now() - savedAt) / 1000);
  if (elapsedSeconds > 0) {
    state = applyOfflineDecay(state, elapsedSeconds);
  }

  return {
    state,
    mealsGivenThisCycle:
      typeof stored.mealsGivenThisCycle === "number" ? stored.mealsGivenThisCycle : 0,
  };
}

/** Persist the pet. Resets the meal cycle when the pet has just woken up. */
export function savePet(state: PetState, mealsGivenThisCycle: number): void {
  ensureDir();
  const wokeUp =
    state.events.includes("woke_up") || state.events.includes("auto_woke_up");
  const meals = wokeUp ? 0 : mealsGivenThisCycle;
  const file: StoredFile = {
    state: serialiseState(state),
    savedAt: Date.now(),
    mealsGivenThisCycle: meals,
  };
  fs.writeFileSync(statePath(), JSON.stringify(file, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Session activity proxy (drives the speech-bubble stats)
// ---------------------------------------------------------------------------

export interface SessionData {
  day: string;
  interactionsToday: number;
  treatsToday: number;
  lastActivityRewardMs: number;
}

function today(): string {
  // Local calendar day, YYYY-MM-DD.
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
    // New calendar day (or first run) — reset the daily counters.
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
  ensureDir();
  fs.writeFileSync(sessionPath(), JSON.stringify(session, null, 2), "utf8");
}
