/**
 * giftItem.ts — which gift a custom character's gift call brings.
 *
 * Characters with `gifts` (the kangaroos: a beer or some Tim Tams) pick one at
 * random per gift call. The pick is memoised here, so the toast, the webview log
 * and the reply when you praise it all name the same gift. It is kept for the
 * update that answers the call, so the praise bubble can still reply to it. A
 * reload mid-call re-rolls. Mirrors cravingItem.ts.
 */

import { PetState } from "./gameEngine";
import { CustomCharacterGift, getCustomCharacterBySpriteType } from "./customCharacters";

let current: CustomCharacterGift | null = null;

/** The gift for the active (or just-answered) gift call, or null when there is none. */
export function giftFor(
  state: Pick<PetState, "spriteType" | "activeAttentionCall" | "events">,
  rand: () => number = Math.random,
): CustomCharacterGift | null {
  const gifts = getCustomCharacterBySpriteType(state.spriteType)?.gifts;
  if (!gifts || gifts.length === 0) {
    current = null;
    return null;
  }
  if (state.activeAttentionCall === "gift") {
    if (current === null || !gifts.includes(current)) {
      current = gifts[Math.floor(rand() * gifts.length)];
    }
    return current;
  }
  if (current !== null && gifts.includes(current) && state.events.includes("attention_call_answered_gift")) {
    return current;
  }
  current = null;
  return null;
}
