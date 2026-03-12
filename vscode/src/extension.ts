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
} from "./persistence";

const TICK_INTERVAL_MS: number = TICK_INTERVAL_SECONDS * 1_000;

let currentState: PetState | null = null;
let sidebar: SidebarProvider | undefined;
let statusBar: StatusBarManager | undefined;
let eventsManager: EventsManager | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;

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
    sidebar?.postState(state);
    statusBar?.update(state);
    saveState(context, state);
  }

  // Sidebar provider
  sidebar = new SidebarProvider(context, statusBar, handleStateUpdate, () => currentState);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.VIEW_ID, sidebar)
  );

  // Events manager (file saves → code activity reward)
  eventsManager = new EventsManager(context, handleStateUpdate, () => currentState);
  eventsManager.register();

  // Load persisted state and apply offline decay
  const savedData = loadState(context);
  if (savedData !== null) {
    const elapsed = elapsedSecondsSinceLastSave(context);
    const decayed = applyOfflineDecay(savedData, elapsed);
    handleStateUpdate(decayed);
  }

  // Periodic tick
  tickTimer = setInterval(() => {
    if (currentState === null) {
      return;
    }
    const next = tick(currentState);
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
