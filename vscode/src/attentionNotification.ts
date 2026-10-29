/**
 * attentionNotification.ts
 *
 * Pure helpers deciding when an attention-call notification should close
 * itself: once the call it announced is answered or expires, the engine clears
 * `activeAttentionCall` (or a different call replaces it). Kept free of
 * `vscode` so it can be unit-tested; mirrored in PyCharm's AttentionNotification.kt.
 */

import type { AttentionCallType } from "./gameEngine";

/** The call type an `attention_call_*` event announces, or null for any other event. */
export function attentionCallTypeForEvent(event: string): AttentionCallType | null {
  if (!event.startsWith("attention_call_") || event.startsWith("attention_call_expired_")) { return null; }
  const suffix = event.slice("attention_call_".length);
  if (suffix.startsWith("craving_")) { return "craving"; }
  return suffix as AttentionCallType;
}

/** True when the notification shown for `shownType` is stale and should close. */
export function shouldDismissAttention(
  shownType: AttentionCallType | null,
  activeType: AttentionCallType | null,
): boolean {
  return shownType !== null && shownType !== activeType;
}
