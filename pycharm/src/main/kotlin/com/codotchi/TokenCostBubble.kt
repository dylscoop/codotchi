package com.codotchi

/**
 * Webview message for the "Today's Token Cost" report. kind "usage" makes the
 * pet hold a phone / tablet / laptop for as long as the bubble shows.
 */
internal fun tokenCostBubblePayload(text: String): String {
    val escaped = text.replace("\\", "\\\\").replace("\"", "\\\"")
    return """{"type":"showBubble","text":"$escaped","kind":"usage"}"""
}
