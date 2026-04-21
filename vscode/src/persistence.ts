/**
 * persistence.ts
 *
 * Saves and restores the full PetState via VS Code's globalState API.
 * Also records the timestamp of the last save so the game engine can
 * calculate how many seconds elapsed while the extension was closed.
 *
 * Per-IDE state file: every save also writes to a JSON file on disk at
 *   Windows : %APPDATA%\gotchi\vscode\state.json
 *   macOS   : ~/.config/gotchi/vscode/state.json
 *   Linux   : ~/.config/gotchi/vscode/state.json
 *
 * VS Code's file is independent of PyCharm's file. OpenCode reads both
 * files separately and can display both pets simultaneously.
 * There is no cross-IDE promotion — VS Code only ever reads its own file.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { PetState, HighScore, deserialiseState, serialiseState } from "./gameEngine";

const STATE_KEY = "gotchi.petState";
const TIMESTAMP_KEY = "gotchi.lastSaveTimestamp";
const HIGH_SCORE_KEY = "gotchi.highScore.v2"; // v2: ageDays now driven by dayTimer (agingMultiplier)

// ---------------------------------------------------------------------------
// Shared cross-IDE file helpers
// ---------------------------------------------------------------------------

/** Absolute path to the VS Code-specific state file. */
export function getSharedStatePath(): string {
  const base =
    process.platform === "win32"
      ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
      : path.join(os.homedir(), ".config");
  return path.join(base, "gotchi", "vscode", "state.json");
}

interface SharedStateFile {
  /** Serialised PetState as a plain JSON object. */
  state: Record<string, unknown>;
  /** Unix epoch milliseconds when this file was written. */
  savedAt: number;
}

/**
 * Write the current pet state to the VS Code-specific state file.
 * Failures are silently swallowed — the file is best-effort only.
 */
function saveSharedState(state: PetState): void {
  if (!state.alive) { return; }
  try {
    const filePath = getSharedStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: SharedStateFile = {
      state: serialiseState(state) as Record<string, unknown>,
      savedAt: Date.now(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
  } catch {
    // Best-effort — never crash the extension if the shared file is unavailable.
  }
}

interface LoadedSharedState {
  state: PetState;
  savedAt: number;
}

/**
 * Read the VS Code-specific state file.
 * Returns `null` if the file does not exist or cannot be parsed.
 */
function loadSharedState(): LoadedSharedState | null {
  try {
    const filePath = getSharedStatePath();
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as SharedStateFile;
    if (!raw.state || typeof raw.savedAt !== "number") {
      return null;
    }
    return { state: deserialiseState(raw.state), savedAt: raw.savedAt };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Persist the pet state and record the current wall-clock timestamp (ms).
 * Also writes to the VS Code-specific state file so OpenCode can read it.
 *
 * @param context - The VS Code extension context.
 * @param state - The pet state to persist.
 */
export function saveState(context: vscode.ExtensionContext, state: PetState): void {
  void context.globalState.update(STATE_KEY, serialiseState(state));
  void context.globalState.update(TIMESTAMP_KEY, Date.now());
  saveSharedState(state);
}

/**
 * Load the most recently saved pet state from globalState.
 * Also reads the VS Code-specific state file to keep globalState in sync
 * with the on-disk copy (e.g. if the extension was reloaded).
 *
 * Returns `null` if no state has been saved yet (first launch).
 *
 * @param context - The VS Code extension context.
 * @returns The deserialised PetState, or null on first launch.
 */
export function loadState(context: vscode.ExtensionContext): PetState | null {
  const raw = context.globalState.get<Record<string, unknown>>(STATE_KEY);
  const localTimestamp = context.globalState.get<number>(TIMESTAMP_KEY) ?? 0;

  // If the on-disk file is newer than our in-memory globalState (e.g. after
  // an extension host restart), promote it so elapsedSecondsSinceLastSave
  // uses the correct reference timestamp.
  const shared = loadSharedState();
  if (shared !== null && shared.savedAt > localTimestamp && shared.state.alive) {
    void context.globalState.update(STATE_KEY, serialiseState(shared.state));
    void context.globalState.update(TIMESTAMP_KEY, shared.savedAt);
    return shared.state;
  }

  if (raw === undefined || raw === null) {
    return null;
  }
  return deserialiseState(raw);
}

/**
 * Return the number of seconds elapsed since the last save.
 *
 * Returns 0 if there is no saved timestamp (first launch).
 */
export function elapsedSecondsSinceLastSave(
  context: vscode.ExtensionContext
): number {
  const timestamp = context.globalState.get<number>(TIMESTAMP_KEY);
  if (timestamp === undefined) {
    return 0;
  }
  return (Date.now() - timestamp) / 1_000;
}

/** Erase all persisted data (used when the player starts a new game). */
export function clearState(context: vscode.ExtensionContext): void {
  void context.globalState.update(STATE_KEY, undefined);
  void context.globalState.update(TIMESTAMP_KEY, undefined);
}

/**
 * Load the persisted high score record.
 *
 * Returns `null` if no high score has been set yet.
 */
export function loadHighScore(context: vscode.ExtensionContext): HighScore | null {
  const raw = context.globalState.get<HighScore>(HIGH_SCORE_KEY);
  return raw ?? null;
}

/**
 * Persist a new high score record.
 */
export function saveHighScore(context: vscode.ExtensionContext, score: HighScore): void {
  void context.globalState.update(HIGH_SCORE_KEY, score);
}

/**
 * Erase the persisted high score (used when the player resets their best run).
 */
export function clearHighScore(context: vscode.ExtensionContext): void {
  void context.globalState.update(HIGH_SCORE_KEY, undefined);
}
