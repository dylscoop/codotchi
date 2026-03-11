/**
 * events.ts
 *
 * Listens for VS Code workspace events (file saves) and applies code-activity
 * rewards directly via the game engine.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS) is enforced here so the pet
 * does not receive a happiness/discipline boost on every single keystroke-save.
 */

import * as vscode from "vscode";
import {
  PetState,
  applyCodeActivity,
  CODE_ACTIVITY_THROTTLE_SECONDS,
} from "./gameEngine";
import { saveState } from "./persistence";

/** Callback invoked with the updated pet state after a code-activity reward. */
export type StateUpdateCallback = (state: PetState) => void;

export class EventsManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  /** Timestamp (ms) of the last time a code-activity reward was applied. */
  private lastCodeActivityTimestamp: number = 0;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onStateUpdate: StateUpdateCallback,
    private readonly getState: () => PetState | null
  ) {}

  /** Register all workspace event listeners. */
  register(): void {
    const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
      this.handleFileSave();
    });
    this.disposables.push(saveListener);
  }

  /**
   * Apply a throttled code-activity reward when any file is saved.
   *
   * Skipped silently if no pet exists yet or the throttle window has not
   * elapsed since the last reward.
   */
  private handleFileSave(): void {
    const state = this.getState();
    if (state === null || !state.alive) {
      return;
    }

    const nowMs = Date.now();
    const elapsedSeconds = (nowMs - this.lastCodeActivityTimestamp) / 1_000;
    if (elapsedSeconds < CODE_ACTIVITY_THROTTLE_SECONDS) {
      return;
    }

    this.lastCodeActivityTimestamp = nowMs;
    const nextState = applyCodeActivity(state);
    saveState(this.context, nextState);
    this.onStateUpdate(nextState);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
