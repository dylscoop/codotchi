/**
 * extension.ts
 *
 * Extension activation entry point.
 *
 * On activation:
 *   1. Loads persisted PetState (or prompts for a new game via the sidebar).
 *   2. Applies offline decay for the time elapsed since last save.
 *   3. Registers the SidebarProvider, StatusBarManager, EventsManager,
 *      and the `gotchi.newGame` / `gotchi.openPanel` commands.
 *   4. Starts the periodic tick timer (every TICK_INTERVAL_SECONDS seconds).
 *
 * On deactivation: saves state and disposes all resources.
 */

import * as vscode from "vscode";
import * as fs from "fs";
import {
  PetState,
  HighScore,
  GameConfig,
  applyOfflineDecay,
  tick,
  TICK_INTERVAL_SECONDS,
} from "./gameEngine";
import { SidebarProvider } from "./sidebarProvider";
import { StatusBarManager } from "./statusBar";
import { EventsManager } from "./events";
import {
  saveState,
  loadState,
  elapsedSecondsSinceLastSave,
  clearState,
  loadHighScore,
  saveHighScore,
  clearHighScore,
  getSharedStatePath,
} from "./persistence";

const TICK_INTERVAL_MS: number = TICK_INTERVAL_SECONDS * 1_000;

let currentState: PetState | null = null;
let currentHighScore: HighScore | null = null;
let sidebar: SidebarProvider | undefined;
let statusBar: StatusBarManager | undefined;
let eventsManager: EventsManager | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;

/** Timestamp of the last detected IDE activity (keystroke, cursor, focus). */
let lastActivityMs: number = Date.now();

/**
 * Timestamp of the last tick in which the pet was in deep idle.
 * Used to enforce a re-entry grace period: after the user returns from
 * deep idle (e.g. after locking the screen), the pet stays protected for
 * DEEP_IDLE_REENTRY_GRACE_MS before full active decay resumes.
 */
let lastDeepIdleTickMs: number = 0;

/** Grace period (ms) after exiting deep idle before full active decay resumes. */
const DEEP_IDLE_REENTRY_GRACE_MS = 60_000;

/**
 * Activate the extension.
 *
 * @param context - The VS Code extension context.
 */
export function activate(context: vscode.ExtensionContext): void {
  statusBar = new StatusBarManager();

  /**
   * Fan out a state update to the sidebar, status bar, and persistence layer.
   *
   * @param state - The new pet state to broadcast.
   */
  function handleStateUpdate(state: PetState): void {
    currentState = state;

    // Fire IDE notifications for attention call events (only when mechanic is enabled)
    const attentionCallsEnabled = vscode.workspace
      .getConfiguration("gotchi")
      .get<boolean>("enableAttentionCalls", true);
    if (attentionCallsEnabled) {
      const notificationMessages: Record<string, string> = {
        "attention_call_hunger":         `${state.name} is hungry!`,
        "attention_call_unhappiness":    `${state.name} is feeling sad!`,
        "attention_call_poop":           `${state.name} made a mess and wants you to clean it up!`,
        "attention_call_sick":           `${state.name} is sick!`,
        "attention_call_low_energy":     `${state.name} is exhausted!`,
        "attention_call_misbehaviour":   `${state.name} is misbehaving!`,
        "attention_call_gift":           `${state.name} brought you a gift!`,
        "attention_call_critical_health":`${state.name}'s health is critical!`,
      };
      for (const event of state.events) {
        const msg = notificationMessages[event];
        if (msg) {
          void vscode.window.showWarningMessage(msg, "Open Gotchi").then((selection) => {
            if (selection === "Open Gotchi") {
              void vscode.commands.executeCommand("gotchiView.focus");
            }
          });
        }
      }
    }

    // Fire old-age natural-causes death notification
    if (state.events.includes("died_of_old_age")) {
      void vscode.window.showWarningMessage(
        `${state.name} has passed away of unforeseen natural causes due to old age.`
      );
    }

    // Update high score when pet dies (suppressed in dev mode — scores don't count)
    const cfg2 = vscode.workspace.getConfiguration("gotchi");
    const devModeActive =
      cfg2.get<boolean>("devModeEnabled", false) &&
      cfg2.get<string>("developerPasscode", "") === "1234";
    if (!state.alive && !devModeActive) {
      const elapsed = state.spawnedAt > 0 ? Date.now() - state.spawnedAt : 0;
      const prevElapsed = currentHighScore
        ? currentHighScore.diedAt - currentHighScore.spawnedAt
        : -1;
      const isNewRecord =
        currentHighScore === null ||
        state.ageDays > currentHighScore.ageDays ||
        (state.ageDays === currentHighScore.ageDays && elapsed > prevElapsed);

      if (isNewRecord) {
        currentHighScore = {
          ageDays:   state.ageDays,
          name:      state.name,
          stage:     state.stage,
          petType:   state.petType,
          color:     state.color,
          spawnedAt: state.spawnedAt,
          diedAt:    Date.now(),
        };
        saveHighScore(context, currentHighScore);
      }
    }

    sidebar?.postState(state, currentHighScore, devModeActive);
    statusBar?.update(state);
    saveState(context, state);
  }

  // Activity callback — shared with SidebarProvider so sidebar button clicks
  // also reset the idle timer (BUGFIX-015).
  const markActivity = (): void => { lastActivityMs = Date.now(); };

  // Reset high score callback — called when the player confirms the reset
  const onResetHighScore = (): void => {
    currentHighScore = null;
    clearHighScore(context);
    // Push a state update so the webview clears the high score display immediately
    const cfg3 = vscode.workspace.getConfiguration("gotchi");
    const devModeNow =
      cfg3.get<boolean>("devModeEnabled", false) &&
      cfg3.get<string>("developerPasscode", "") === "1234";
    if (currentState !== null) {
      sidebar?.postState(currentState, null, devModeNow);
    } else {
      sidebar?.postNoGame(null);
    }
  };

  // Sidebar provider
  sidebar = new SidebarProvider(context, statusBar, handleStateUpdate, () => currentState, () => currentHighScore, markActivity, onResetHighScore);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.VIEW_ID, sidebar)
  );

  // Events manager (file saves → code activity reward)
  eventsManager = new EventsManager(context, handleStateUpdate, () => currentState);
  eventsManager.register();

  // Load persisted high score
  currentHighScore = loadHighScore(context);

  // Load persisted state and apply offline decay
  const savedData = loadState(context);
  if (savedData !== null) {
    const elapsed = elapsedSecondsSinceLastSave(context);
    const decayed = applyOfflineDecay(savedData, elapsed);
    handleStateUpdate(decayed);
  }

  // Activity listeners — update lastActivityMs on any keyboard/cursor/focus event
  // so the idle detector knows the user is present.
  // Each trigger is individually configurable; aiMode suppresses the three events
  // that AI coding agents also fire (document changes, cursor movement, tab switches).
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => {
      const c = vscode.workspace.getConfiguration("gotchi");
      if (!c.get<boolean>("aiMode", false) && c.get<boolean>("idleResetOnCursorMovement", true)) {
        markActivity();
      }
    }),
    vscode.workspace.onDidChangeTextDocument(() => {
      const c = vscode.workspace.getConfiguration("gotchi");
      if (!c.get<boolean>("aiMode", false) && c.get<boolean>("idleResetOnDocumentChange", true)) {
        markActivity();
      }
    }),
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        const c = vscode.workspace.getConfiguration("gotchi");
        if (c.get<boolean>("idleResetOnWindowFocus", true)) {
          markActivity();
        }
        // Only reload from persistence if the ticker was stopped on focus-loss
        // (non-AI mode). In AI mode the in-memory state is already current.
        if (!c.get<boolean>("aiMode", false)) {
          reloadAndRefreshUI();
        }
        startTicker(); // no-op if already running (AI mode)
      } else {
        if (currentState !== null) {
          // Save immediately on focus loss so that offline decay calculations
          // use an accurate timestamp when VS Code is reopened.
          saveState(context, currentState);
        }
        // In AI mode, keep ticking while unfocused so the pet advances
        // while an AI agent codes in the background. The focus-gate exists
        // only to prevent multi-window state divergence, which aiMode avoids
        // by design (the AI doesn't open extra windows).
        const c = vscode.workspace.getConfiguration("gotchi");
        if (!c.get<boolean>("aiMode", false)) {
          stopTicker();
        }
      }
    }),
    vscode.window.onDidChangeActiveTextEditor(() => {
      const c = vscode.workspace.getConfiguration("gotchi");
      if (!c.get<boolean>("aiMode", false) && c.get<boolean>("idleResetOnTabSwitch", true)) {
        markActivity();
      }
    }),
  );

  // --- Multi-window ticker helpers ---

  /** Run one game tick. Extracted so startTicker can reference it by name. */
  function runOneTick(): void {
    if (currentState === null) { return; }
    const cfg = vscode.workspace.getConfiguration("gotchi");
    const idleThresholdMs = cfg.get<number>("idleThresholdSeconds", 60) * 1_000;
    const idleDeepThresholdMs = cfg.get<number>("idleDeepThresholdSeconds", 600) * 1_000;
    const idleMs = Date.now() - lastActivityMs;
    const idle = idleMs > idleThresholdMs;
    const rawDeepIdle = idleMs > idleDeepThresholdMs;

    // Refresh the deep-idle timestamp on every tick where the pet is deep idle.
    // When the user returns, the grace period counts from the last such tick,
    // keeping the pet protected for DEEP_IDLE_REENTRY_GRACE_MS (60 s) before
    // full active decay resumes.  This prevents the gotchi from dying moments
    // after the user unlocks their screen.
    if (rawDeepIdle) {
      lastDeepIdleTickMs = Date.now();
    }
    const inGracePeriod =
      lastDeepIdleTickMs > 0 &&
      Date.now() - lastDeepIdleTickMs < DEEP_IDLE_REENTRY_GRACE_MS;
    const deepIdle = rawDeepIdle || inGracePeriod;

    // Map the attentionCallExpiry setting to a tick count.
    const expiryMap: Record<string, number> = { needy: 20, standard: 50, chilled: 100 };
    const expiryKey = cfg.get<string>("attentionCallExpiry", "standard");
    const attentionCallExpiryTicks = expiryMap[expiryKey] ?? 50;

    // Map the attentionCallRate setting to a rate divisor.
    const rateMap: Record<string, number> = { fast: 1.0, medium: 1.5, slow: 2.0 };
    const rateKey = cfg.get<string>("attentionCallRate", "fast");
    const attentionCallRateDivisor = rateMap[rateKey] ?? 1.0;

    const gameConfig: GameConfig = {
      attentionCallsEnabled:    cfg.get<boolean>("enableAttentionCalls", true),
      attentionCallExpiryTicks,
      attentionCallRateDivisor,
      devMode:                  cfg.get<boolean>("devModeEnabled", false) && cfg.get<string>("developerPasscode", "") === "1234",
      devModeAgingMultiplier:   Math.max(1, cfg.get<number>("devModeAgingMultiplier", 10)),
      devModeHealthFloor:       Math.max(0, Math.min(100, cfg.get<number>("devModeHealthFloor", 1))),
    };
    const next = tick(currentState, idle, deepIdle, gameConfig);
    handleStateUpdate(next);
  }

  /** Start the periodic tick timer. No-op if already running. */
  function startTicker(): void {
    if (tickTimer !== undefined) { return; }
    tickTimer = setInterval(runOneTick, TICK_INTERVAL_MS);
  }

  /** Stop the periodic tick timer. */
  function stopTicker(): void {
    if (tickTimer !== undefined) {
      clearInterval(tickTimer);
      tickTimer = undefined;
    }
  }

  /**
   * Reload pet state from globalState, apply offline decay, and refresh the UI.
   * Called when this window gains focus so it picks up any state written by the
   * previously-focused (ticking) window.  Does NOT fire attention-call
   * notifications — those were already shown in the other window.
   */
  function reloadAndRefreshUI(): void {
    const fresh = loadState(context);
    if (fresh === null) { return; }
    const elapsed = elapsedSecondsSinceLastSave(context);
    const decayed = applyOfflineDecay(fresh, elapsed);
    // Clear stale events — they were already displayed in the other window.
    const state: PetState = { ...decayed, events: [] };
    currentState = state;
    // Reset the meal cycle counter — we cannot know how many meals were given
    // by the other window, so reset to 0 (conservative; allows full quota here).
    sidebar?.resetMealCycle();
    const cfg = vscode.workspace.getConfiguration("gotchi");
    const devModeActive =
      cfg.get<boolean>("devModeEnabled", false) &&
      cfg.get<string>("developerPasscode", "") === "1234";
    sidebar?.postState(state, currentHighScore, devModeActive);
    statusBar?.update(state);
    saveState(context, state);
  }

  // Periodic tick — only the focused window ticks (unless AI mode is on).
  // In AI mode the ticker runs unconditionally so the pet advances while an
  // AI agent codes in the background with VS Code unfocused.
  // On focus gain, reloadAndRefreshUI() picks up state from the prior ticker
  // and startTicker() resumes the interval.  On focus loss, stopTicker() halts it.
  {
    const initCfg = vscode.workspace.getConfiguration("gotchi");
    if (vscode.window.state.focused || initCfg.get<boolean>("aiMode", false)) {
      startTicker();
    }
  }

  // Cross-window / cross-IDE live sync: watch state.json for changes written by
  // another VS Code window or another IDE (PyCharm, OpenCode).  When this window
  // is not the active ticker it won't pick up those changes until focus returns —
  // the watcher closes that gap by calling reloadAndRefreshUI() immediately.
  // A 150 ms debounce absorbs rapid successive file-system events (some editors
  // emit two events per atomic write).
  {
    const sharedStatePath = getSharedStatePath();
    let syncDebounce: ReturnType<typeof setTimeout> | undefined;

    const onSharedStateChanged = (): void => {
      // Only reload if this window is not the active ticker.  If we ARE ticking,
      // we're the writer — no need to re-read our own write.
      if (tickTimer !== undefined) { return; }
      if (syncDebounce !== undefined) { clearTimeout(syncDebounce); }
      syncDebounce = setTimeout(() => {
        syncDebounce = undefined;
        reloadAndRefreshUI();
      }, 150);
    };

    // fs.watch is available in the Node.js runtime used by VS Code extensions
    // and is more lightweight than a workspace FileSystemWatcher (which only
    // covers workspace folders).  We only start watching once the file exists;
    // if it doesn't exist yet we poll briefly on the tick until it does.
    let fsWatcher: fs.FSWatcher | undefined;

    const startWatcher = (): void => {
      if (fsWatcher !== undefined) { return; }
      try {
        fsWatcher = fs.watch(sharedStatePath, { persistent: false }, onSharedStateChanged);
        fsWatcher.on("error", () => {
          fsWatcher?.close();
          fsWatcher = undefined;
        });
      } catch {
        // File may not exist yet (first launch before any save).  Will be
        // retried on the next tick via the watchBootstrap interval.
      }
    };

    // Try immediately; if the file doesn't exist yet, retry every 10 s.
    startWatcher();
    const watchBootstrap = setInterval(() => {
      if (fsWatcher !== undefined) {
        clearInterval(watchBootstrap);
      } else {
        startWatcher();
        if (fsWatcher !== undefined) {
          clearInterval(watchBootstrap);
        }
      }
    }, 10_000);

    context.subscriptions.push({
      dispose(): void {
        clearInterval(watchBootstrap);
        if (syncDebounce !== undefined) { clearTimeout(syncDebounce); }
        fsWatcher?.close();
        fsWatcher = undefined;
      },
    });
  }

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("gotchi.openPanel", () => {
      void vscode.commands.executeCommand("gotchiView.focus");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gotchi.newGame", () => {
      clearState(context);
      currentState = null;
      // The webview new-game form handles the actual createPet call via the
      // "new_game" message routed through SidebarProvider.
      void vscode.commands.executeCommand("gotchiView.focus");
    })
  );

  // Register disposables
  context.subscriptions.push(statusBar, eventsManager);
}

/** Deactivate the extension — stop the tick timer and release resources. */
export function deactivate(): void {
  if (tickTimer !== undefined) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
}
