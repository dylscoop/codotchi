/**
 * events.ts
 *
 * Listens for VS Code workspace events (file saves, git commits) and applies
 * code-activity rewards directly via the game engine.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS / COMMIT_ACTIVITY_THROTTLE_SECONDS)
 * is enforced here so the pet does not receive a happiness/discipline boost on
 * every single keystroke-save or rapid --amend.
 */

import * as vscode from "vscode";
import {
  PetState,
  applyCodeActivity,
  applyCommitActivity,
  CODE_ACTIVITY_THROTTLE_SECONDS,
  COMMIT_ACTIVITY_THROTTLE_SECONDS,
} from "./gameEngine";
import { saveState } from "./persistence";

/** Callback invoked with the updated pet state after a code-activity reward. */
export type StateUpdateCallback = (state: PetState) => void;

export class EventsManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  /** Timestamp (ms) of the last time a code-activity reward was applied. */
  private lastCodeActivityTimestamp: number = 0;
  /** Timestamp (ms) of the last time a commit reward was applied. */
  private lastCommitActivityTimestamp: number = 0;

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

    // Register git commit listener via the built-in vscode.git extension API.
    this.registerGitCommitListener();
  }

  /**
   * Attempt to subscribe to git commit events via the built-in vscode.git
   * extension API.  Gracefully no-ops if the git extension is unavailable or
   * the API shape is unexpected.
   */
  private registerGitCommitListener(): void {
    try {
      const gitExtension = vscode.extensions.getExtension("vscode.git");
      if (!gitExtension) {
        return;
      }
      // The extension may not be activated yet — getExtension() returns the
      // raw extension object; we must use the exports once it is active.
      const activate = (): void => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const api = (gitExtension.exports as any)?.getAPI?.(1);
          if (!api) {
            return;
          }
          // Subscribe to commits on every repository that is open now.
          const subscribeToRepo = (repo: any): void => {
            const d = repo.onDidCommit?.(() => {
              this.handleCommit();
            });
            if (d) {
              this.disposables.push(d);
            }
          };
          for (const repo of api.repositories ?? []) {
            subscribeToRepo(repo);
          }
          // Also subscribe to repos that open later.
          const openDisposable = api.onDidOpenRepository?.((repo: any) => {
            subscribeToRepo(repo);
          });
          if (openDisposable) {
            this.disposables.push(openDisposable);
          }
        } catch {
          // Swallow — git extension API shape may change between VS Code versions.
        }
      };

      if (gitExtension.isActive) {
        activate();
      } else {
        gitExtension.activate().then(activate, () => {
          // Swallow activation failure — commit rewards simply won't fire.
        });
      }
    } catch {
      // Swallow — commit rewards are a nice-to-have; the extension must not
      // crash if the git extension is unavailable.
    }
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

  /**
   * Apply a throttled commit reward when a git commit is detected.
   *
   * Skipped silently if no pet exists yet, the pet is not alive, or the
   * 5-minute throttle window has not elapsed since the last commit reward.
   */
  private handleCommit(): void {
    const state = this.getState();
    if (state === null || !state.alive) {
      return;
    }

    const nowMs = Date.now();
    const elapsedSeconds = (nowMs - this.lastCommitActivityTimestamp) / 1_000;
    if (elapsedSeconds < COMMIT_ACTIVITY_THROTTLE_SECONDS) {
      return;
    }

    this.lastCommitActivityTimestamp = nowMs;
    const nextState = applyCommitActivity(state);
    saveState(this.context, nextState);
    this.onStateUpdate(nextState);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

