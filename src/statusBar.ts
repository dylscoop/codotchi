/**
 * statusBar.ts
 *
 * Manages the VS Code status bar item that shows the pet's current mood
 * emoji and name.  Updates on every tick and every player action.
 */

import * as vscode from "vscode";
import { PetState } from "./pythonBridge";

/** Emoji map from mood → Unicode character. */
const MOOD_EMOJI: Record<string, string> = {
  happy: "😄",
  neutral: "😐",
  sad: "😢",
  sick: "🤢",
  sleeping: "😴",
};

/** Fallback emoji when mood is unknown. */
const FALLBACK_EMOJI = "🐾";

export class StatusBarManager implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = "gotchi.openPanel";
    this.item.tooltip = "Click to open your pet";
  }

  /** Update the status bar text from a full PetState snapshot. */
  update(state: PetState): void {
    if (!state.alive) {
      this.item.text = `$(heart-filled) ${state.name} ✝`;
      this.item.tooltip = `${state.name} has passed away. Start a new game.`;
      this.item.show();
      return;
    }

    const emoji = MOOD_EMOJI[state.mood] ?? FALLBACK_EMOJI;
    const stageLabel = state.stage.charAt(0).toUpperCase() + state.stage.slice(1);
    this.item.text = `${emoji} ${state.name} (${stageLabel})`;
    this.item.tooltip = [
      `Hunger: ${state.hunger}`,
      `Happiness: ${state.happiness}`,
      `Health: ${state.health}`,
      `Energy: ${state.energy}`,
      `Stage: ${stageLabel}`,
      state.sick ? "⚠ Sick!" : "",
    ]
      .filter(Boolean)
      .join(" | ");
    this.item.show();
  }

  /** Hide and remove the status bar item. */
  dispose(): void {
    this.item.dispose();
  }
}
