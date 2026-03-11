/**
 * persistence.ts
 *
 * Saves and restores the full PetState via VS Code's globalState API.
 * Also records the timestamp of the last save so the Python engine can
 * calculate how many seconds elapsed while the extension was closed.
 */

import * as vscode from "vscode";
import { PetState } from "./pythonBridge";

const STATE_KEY = "gotchi.petState";
const TIMESTAMP_KEY = "gotchi.lastSaveTimestamp";

/** Persist the pet state and record the current wall-clock timestamp (ms). */
export function saveState(
  context: vscode.ExtensionContext,
  state: PetState
): void {
  void context.globalState.update(STATE_KEY, state);
  void context.globalState.update(TIMESTAMP_KEY, Date.now());
}

/**
 * Load the most recently saved pet state.
 *
 * Returns `null` if no state has been saved yet (first launch).
 */
export function loadState(
  context: vscode.ExtensionContext
): PetState | null {
  const state = context.globalState.get<PetState>(STATE_KEY);
  return state ?? null;
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
