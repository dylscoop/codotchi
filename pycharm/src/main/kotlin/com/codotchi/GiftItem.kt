package com.codotchi

import com.codotchi.engine.PetState

/**
 * GiftItem.kt — which gift a custom character's gift call brings.
 * Mirrors vscode/src/giftItem.ts.
 *
 * Characters with `gifts` (the kangaroo: a beer or some Tim Tams) pick one at
 * random per gift call. The pick is memoised here, so the notification, the
 * webview log and the reply when you praise it all name the same gift. It is
 * kept for the update that answers the call, so the praise bubble can still
 * reply to it. A restart mid-call re-rolls.
 */

private var currentGift: CustomCharacterGift? = null

/** The gift for the active (or just-answered) gift call, or null when there is none. */
@Synchronized
fun giftFor(state: PetState, rand: () -> Double = Math::random): CustomCharacterGift? {
    val gifts = getCustomCharacterBySpriteType(state.spriteType)?.gifts.orEmpty()
    if (gifts.isEmpty()) {
        currentGift = null
        return null
    }
    val current = currentGift
    if (state.activeAttentionCall == "gift") {
        if (current != null && current in gifts) return current
        return gifts[(rand() * gifts.size).toInt().coerceIn(0, gifts.size - 1)].also { currentGift = it }
    }
    if (current != null && current in gifts && "attention_call_answered_gift" in state.events) return current
    currentGift = null
    return null
}

/** The gift as JSON for the webview's stateUpdate message ("null" when there is none). */
fun giftJson(gift: CustomCharacterGift?): String =
    if (gift == null) "null"
    else """{"kind":${jsonStringOrNull(gift.kind)},"message":${jsonStringOrNull(gift.message)},"praiseBubble":${jsonStringOrNull(gift.praiseBubble)}}"""
