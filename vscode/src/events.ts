/**
 * events.ts
 *
 * Listens for VS Code workspace events (file saves, git commits) and applies
 * code-activity rewards directly via the game engine.
 *
 * ## Commit detection
 * Watches `.git/COMMIT_EDITMSG` via a FileSystemWatcher on every workspace
 * folder.  This file is written by git on every commit regardless of whether
 * the commit originated from the VS Code UI, the integrated terminal, an
 * external terminal, or an AI agent — making it the most reliable cross-source
 * commit signal available without shelling out to git.
 *
 * ## File-save detection
 * Two complementary mechanisms are used:
 *   1. `onDidSaveTextDocument` — fires for IDE-initiated saves (Ctrl+S,
 *      auto-save, extension calls).  Zero noise; precise semantics.
 *   2. FileSystemWatcher on a source-file glob — fires for saves made from the
 *      integrated terminal (vim/nano), external editors, or AI agents writing
 *      files directly to the filesystem.  Restricted to known source-file
 *      extensions to avoid noise from build artifacts, lock files, and logs.
 *
 * Both save paths call the same `handleFileSave()` which enforces the 30-second
 * throttle, so duplicate fires (e.g. a Ctrl+S triggering both) are harmless.
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

/**
 * Source-file extensions watched by the filesystem watcher.  Restricted to
 * known programming language file types to minimise noise from build artifacts,
 * lock files, generated files, and log files.
 */
const SOURCE_FILE_GLOB =
  "**/*.{ts,tsx,js,jsx,mjs,cjs,py,kt,kts,java,go,rs,rb,cs,cpp,cc,cxx,c,h,hpp," +
  "swift,vue,svelte,html,css,scss,sass,less,json,yaml,yml,toml,sh,bash,zsh,fish," +
  "lua,php,r,dart,ex,exs,erl,hrl,clj,cljs,elm,hs,ml,mli,fs,fsx,fsi,nim,zig,v,tf}";

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
    // ── File-save detection (path 1): IDE-initiated saves ────────────────────
    const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
      this.handleFileSave();
    });
    this.disposables.push(saveListener);

    // ── File-save detection (path 2): terminal / external / AI agent saves ───
    this.registerSourceFileWatcher();

    // ── Commit detection: watch .git/COMMIT_EDITMSG ───────────────────────────
    this.registerCommitWatcher();
  }

  /**
   * Watch source files in every workspace folder for filesystem-level changes.
   * Catches saves made from vim/nano in the integrated terminal, external
   * editors, and AI agents writing files directly — none of which trigger
   * onDidSaveTextDocument.
   *
   * One watcher is created per workspace folder so the RelativePattern is
   * anchored to the correct root.  All watchers share the same handleFileSave()
   * throttle so duplicate fires are harmless.
   */
  private registerSourceFileWatcher(): void {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const pattern = new vscode.RelativePattern(folder, SOURCE_FILE_GLOB);
      const watcher = vscode.workspace.createFileSystemWatcher(
        pattern,
        /* ignoreCreateEvents */ true,
        /* ignoreChangeEvents */ false,
        /* ignoreDeleteEvents */ true
      );
      watcher.onDidChange(() => this.handleFileSave(), this, this.disposables);
      this.disposables.push(watcher);
    }

    // Also handle workspace folders added after activation.
    const folderListener = vscode.workspace.onDidChangeWorkspaceFolders(
      (e) => {
        for (const folder of e.added) {
          const pattern = new vscode.RelativePattern(folder, SOURCE_FILE_GLOB);
          const watcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            true,
            false,
            true
          );
          watcher.onDidChange(
            () => this.handleFileSave(),
            this,
            this.disposables
          );
          this.disposables.push(watcher);
        }
      }
    );
    this.disposables.push(folderListener);
  }

  /**
   * Watch `.git/COMMIT_EDITMSG` in every workspace folder for changes.
   * git writes this file on every commit regardless of the originating source
   * (VS Code UI, integrated terminal, external terminal, AI agent, --amend).
   * This is more reliable than the vscode.git extension API which only fires
   * for commits made through VS Code's own git integration.
   */
  private registerCommitWatcher(): void {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const folder of folders) {
      const pattern = new vscode.RelativePattern(folder, ".git/COMMIT_EDITMSG");
      const watcher = vscode.workspace.createFileSystemWatcher(
        pattern,
        /* ignoreCreateEvents */ false,
        /* ignoreChangeEvents */ false,
        /* ignoreDeleteEvents */ true
      );
      watcher.onDidChange(() => this.handleCommit(), this, this.disposables);
      watcher.onDidCreate(() => this.handleCommit(), this, this.disposables);
      this.disposables.push(watcher);
    }

    // Also handle workspace folders added after activation.
    const folderListener = vscode.workspace.onDidChangeWorkspaceFolders(
      (e) => {
        for (const folder of e.added) {
          const pattern = new vscode.RelativePattern(
            folder,
            ".git/COMMIT_EDITMSG"
          );
          const watcher = vscode.workspace.createFileSystemWatcher(
            pattern,
            false,
            false,
            true
          );
          watcher.onDidChange(
            () => this.handleCommit(),
            this,
            this.disposables
          );
          watcher.onDidCreate(
            () => this.handleCommit(),
            this,
            this.disposables
          );
          this.disposables.push(watcher);
        }
      }
    );
    this.disposables.push(folderListener);
  }

  /**
   * Apply a throttled code-activity reward when any source file is saved.
   *
   * Called from both onDidSaveTextDocument and the source-file FileSystemWatcher.
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
   * Called from the COMMIT_EDITMSG FileSystemWatcher (onDidChange / onDidCreate).
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
