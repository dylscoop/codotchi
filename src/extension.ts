/**
 * extension.ts
 *
 * Extension activation entry point.
 *
 * On activation:
 *   1. Creates the PythonBridge and starts the game engine subprocess.
 *   2. Sends the `init` command with any saved state + elapsed seconds.
 *   3. Registers the SidebarProvider, StatusBarManager, EventsManager,
 *      and the `gotchi.newGame` / `gotchi.openPanel` commands.
 *   4. Starts the periodic tick timer (every 5 s).
 *
 * On deactivation: saves state and disposes all resources.
 */

import * as vscode from "vscode";
import { PythonBridge, PetState } from "./pythonBridge";
import { SidebarProvider } from "./sidebarProvider";
import { StatusBarManager } from "./statusBar";
import { EventsManager } from "./events";
import {
  saveState,
  loadState,
  elapsedSecondsSinceLastSave,
  clearState,
} from "./persistence";

const TICK_INTERVAL_MS = 5_000;

let bridge: PythonBridge | undefined;
let sidebar: SidebarProvider | undefined;
let statusBar: StatusBarManager | undefined;
let eventsManager: EventsManager | undefined;
let tickTimer: ReturnType<typeof setInterval> | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // --- Bridge ---
  bridge = new PythonBridge(context);
  await bridge.start();

  statusBar = new StatusBarManager();

  // --- State update fan-out ---
  function handleStateUpdate(state: PetState): void {
    sidebar?.postState(state);
    statusBar?.update(state);
    saveState(context, state);
  }

  // --- Sidebar provider ---
  sidebar = new SidebarProvider(bridge, context, statusBar, handleStateUpdate);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.VIEW_ID,
      sidebar
    )
  );

  // --- Events ---
  eventsManager = new EventsManager(bridge, context, handleStateUpdate);
  eventsManager.register();

  // --- Init command ---
  const savedState = loadState(context);
  const elapsed = elapsedSecondsSinceLastSave(context);

  const initResponse = await bridge.send({
    action: "init",
    state: savedState as Record<string, unknown> | null,
    elapsed_seconds: elapsed,
  });

  if ("hunger" in initResponse) {
    const state = initResponse as PetState;
    handleStateUpdate(state);
  }

  // --- Periodic tick ---
  tickTimer = setInterval(async () => {
    if (!bridge) {
      return;
    }
    try {
      const tickResponse = await bridge.send({ action: "tick" });
      if ("hunger" in tickResponse) {
        handleStateUpdate(tickResponse as PetState);
      }
    } catch {
      // Ignore tick errors (e.g. bridge restarting).
    }
  }, TICK_INTERVAL_MS);

  // --- Commands ---
  context.subscriptions.push(
    vscode.commands.registerCommand("gotchi.openPanel", () => {
      vscode.commands.executeCommand(
        "workbench.view.extension.gotchi-sidebar"
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("gotchi.newGame", async () => {
      clearState(context);
      // The webview new-game form handles the actual new_game command.
      vscode.commands.executeCommand(
        "workbench.view.extension.gotchi-sidebar"
      );
    })
  );

  // Register disposables
  context.subscriptions.push(statusBar, eventsManager);
}

export function deactivate(): void {
  if (tickTimer !== undefined) {
    clearInterval(tickTimer);
    tickTimer = undefined;
  }
  bridge?.dispose();
  bridge = undefined;
}
