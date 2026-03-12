/**
 * persistence.ts
 *
 * Saves and restores the full PetState via VS Code's globalState API.
 * Also records the timestamp of the last save so the game engine can
 * calculate how many seconds elapsed while the extension was closed.
 */

import * as vscode from "vscode";
import { PetState, HighScore, deserialiseState, serialiseState } from "./gameEngine";

const STATE_KEY = "gotchi.petState";
const TIMESTAMP_KEY = "gotchi.lastSaveTimestamp";
const HIGH_SCORE_KEY = "gotchi.highScore";

/**
 * Persist the pet state and record the current wall-clock timestamp (ms).
 *
 * @param context - The VS Code extension context.
 * @param state - The pet state to persist.
 */
export function saveState(context: vscode.ExtensionContext, state: PetState): void {
  void context.globalState.update(STATE_KEY, serialiseState(state));
  void context.globalState.update(TIMESTAMP_KEY, Date.now());
}

/**
 * Load the most recently saved pet state.
 *
 * Returns `null` if no state has been saved yet (first launch).
 *
 * @param context - The VS Code extension context.
 * @returns The deserialised PetState, or null on first launch.
 */
export function loadState(context: vscode.ExtensionContext): PetState | null {
  const raw = context.globalState.get<Record<string, unknown>>(STATE_KEY);
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
