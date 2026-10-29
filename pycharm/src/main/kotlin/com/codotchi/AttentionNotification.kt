package com.codotchi

/**
 * Pure helpers deciding when an attention-call notification should close
 * itself: once the call it announced is answered or expires, the engine clears
 * `activeAttentionCall` (or a different call replaces it).
 * Mirrors vscode/src/attentionNotification.ts.
 */

/** The call type an `attention_call_*` event announces, or null for any other event. */
fun attentionCallTypeForEvent(event: String): String? {
    if (!event.startsWith("attention_call_") || event.startsWith("attention_call_expired_")) return null
    val suffix = event.removePrefix("attention_call_")
    return if (suffix.startsWith("craving_")) "craving" else suffix
}

/** True when the notification shown for [shownType] is stale and should close. */
fun shouldDismissAttention(shownType: String?, activeType: String?): Boolean =
    shownType != null && shownType != activeType
