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

    // Update high score when pet dies (suppressed in dev mode — scores don't count)
    const devPasscode = vscode.workspace.getConfiguration("gotchi").get<string>("developerPasscode", "");
    const devModeActive = devPasscode === "1234";
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

    sidebar?.postState(state, currentHighScore);
    statusBar?.update(state);
    saveState(context, state);
  }

  // Activity callback — shared with SidebarProvider so sidebar button clicks
  // also reset the idle timer (BUGFIX-015).
  const markActivity = (): void => { lastActivityMs = Date.now(); };

  // Sidebar provider
  sidebar = new SidebarProvider(context, statusBar, handleStateUpdate, () => currentState, () => currentHighScore, markActivity);
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
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => markActivity()),
    vscode.workspace.onDidChangeTextDocument(() => markActivity()),
    vscode.window.onDidChangeWindowState((e) => { if (e.focused) { markActivity(); } }),
    vscode.window.onDidChangeActiveTextEditor(() => markActivity()),
  );

  // Periodic tick
  tickTimer = setInterval(() => {
    if (currentState === null) {
      return;
    }
    const cfg = vscode.workspace.getConfiguration("gotchi");
    const idleThresholdMs = cfg.get<number>("idleThresholdSeconds", 60) * 1_000;
    const idleDeepThresholdMs = cfg.get<number>("idleDeepThresholdSeconds", 600) * 1_000;
    const idleMs = Date.now() - lastActivityMs;
    const idle = idleMs > idleThresholdMs;
    const deepIdle = idleMs > idleDeepThresholdMs;

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
      devMode:                  cfg.get<string>("developerPasscode", "") === "1234",
      devModeAgingMultiplier:   Math.max(1, cfg.get<number>("devModeAgingMultiplier", 10)),
    };
    const next = tick(currentState, idle, deepIdle, gameConfig);
    handleStateUpdate(next);
  }, TICK_INTERVAL_MS);

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
