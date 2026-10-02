/**
 * statusBar.ts
 *
 * Manages the VS Code status bar item that shows the pet's current mood
 * emoji and name, with a ⚠ while an attention call is active.  Updates on
 * every tick and every player action.  Hidden when codotchi.statusBarEnabled
 * is false.
 */

import * as vscode from "vscode";
import { PetState } from "./gameEngine";
import { formatStatusBar } from "./statusBarText";

export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private lastState: PetState | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "codotchi.openPanel";
    this.item.tooltip = "Click to open your pet";
  }

  /** Update the status bar text from a full PetState snapshot. */
  update(state: PetState): void {
    this.lastState = state;
    const enabled = vscode.workspace
      .getConfiguration("codotchi")
      .get<boolean>("statusBarEnabled", true);
    if (!enabled) {
      this.item.hide();
      return;
    }
    const { text, tooltip } = formatStatusBar(state);
    this.item.text = text;
    this.item.tooltip = tooltip;
    this.item.show();
  }

  /** Re-render the last state (e.g. after codotchi.statusBarEnabled changes). */
  refresh(): void {
    if (this.lastState) { this.update(this.lastState); }
  }

  /** Hide and remove the status bar item. */
  dispose(): void {
    this.item.dispose();
  }
}
