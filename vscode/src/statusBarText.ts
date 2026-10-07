/**
 * statusBarText.ts
 *
 * Pure formatting for the VS Code status bar item (no vscode import, so it can
 * be unit-tested). The item shows the pet's mood emoji, name and stage; while an
 * attention call is active the text gets a "⚠ " prefix and the tooltip says what
 * the pet wants.
 */

import { PetState } from "./gameEngine";
import { getCustomCharacterBySpriteType } from "./customCharacters";
import { cravingItemFor } from "./cravingItem";

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

/** What the pet wants, per attention call, phrased to follow "<name> ". */
const CALL_WANTS: Record<string, string> = {
  hunger:          "is hungry!",
  unhappiness:     "is feeling sad!",
  poop:            "made a mess and wants you to clean it up!",
  sick:            "is sick and needs medicine!",
  low_energy:      "is exhausted and needs sleep!",
  misbehaviour:    "is misbehaving!",
  gift:            "brought you a gift — praise them!",
  critical_health: "'s health is critical!",
  play:            "wants to play a game!",
  pat:             "wants a pat!",
  craving_meal:    "is craving a meal!",
  craving_snack:   "is craving a snack!",
  break:           "says it's time for a break!",
};

/** Tooltip line for the active attention call, or "" when there is none. */
export function attentionCallLine(state: PetState): string {
  const call = state.activeAttentionCall;
  if (!call) { return ""; }
  const key = call === "craving" && state.cravingFood ? `craving_${state.cravingFood}` : call;
  // Custom characters (Tim, Stu) ask for a run / stickers and name their snack
  const patCall = getCustomCharacterBySpriteType(state.spriteType)?.patCall;
  const cravingItem = cravingItemFor(state);
  const wants = (call === "pat" && patCall) ? patCall.status
    : cravingItem ? `is craving ${cravingItem}!`
    : CALL_WANTS[key] ?? "wants your attention!";
  return `⚠ ${state.name}${wants.startsWith("'") ? "" : " "}${wants}`;
}

/** Status bar text and tooltip for a pet. */
export function formatStatusBar(state: PetState): { text: string; tooltip: string } {
  if (!state.alive) {
    return {
      text: `$(heart-filled) ${state.name} ✝`,
      tooltip: `${state.name} has passed away. Start a new game.`,
    };
  }

  const emoji = MOOD_EMOJI[state.mood] ?? FALLBACK_EMOJI;
  const stageLabel = state.stage.charAt(0).toUpperCase() + state.stage.slice(1);
  const spriteLabel = state.spriteType && state.spriteType !== "classic"
    ? state.spriteType.charAt(0).toUpperCase() + state.spriteType.slice(1)
    : "";
  const callLine = attentionCallLine(state);
  const text = `${callLine ? "⚠ " : ""}${emoji} ${state.name} (${stageLabel})`;
  const tooltip = [
    callLine,
    `Hunger: ${Math.round(state.hunger)}`,
    `Happiness: ${Math.round(state.happiness)}`,
    `Health: ${state.health}`,
    `Energy: ${state.energy}`,
    `Weight: ${state.weight}`,
    `Stage: ${stageLabel}`,
    spriteLabel ? `Sprite: ${spriteLabel}` : "",
    state.sick ? "⚠ Sick!" : "",
  ]
    .filter(Boolean)
    .join(" | ");
  return { text, tooltip };
}
