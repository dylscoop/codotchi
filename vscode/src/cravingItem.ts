/**
 * cravingItem.ts — which item a custom character's snack craving asks for.
 *
 * Characters with `snackCravings` (Tim: a tea; Stu: a pint or some salmon) name
 * a specific snack instead of "a snack". The pick is random per craving and
 * memoised here, so the toast, the status bar and the webview (which spawns the
 * matching floor item) all name the same thing. A reload mid-craving re-rolls.
 */

import { PetState } from "./gameEngine";
import { getCustomCharacterBySpriteType } from "./customCharacters";

let current: string | null = null;

/** The craved item for the active snack craving, or null when there is none. */
export function cravingItemFor(
  state: Pick<PetState, "spriteType" | "activeAttentionCall" | "cravingFood">,
  rand: () => number = Math.random,
): string | null {
  const items = getCustomCharacterBySpriteType(state.spriteType)?.snackCravings;
  if (state.activeAttentionCall !== "craving" || state.cravingFood !== "snack" || !items || items.length === 0) {
    current = null;
    return null;
  }
  if (current === null || !items.includes(current)) {
    current = items[Math.floor(rand() * items.length)];
  }
  return current;
}
