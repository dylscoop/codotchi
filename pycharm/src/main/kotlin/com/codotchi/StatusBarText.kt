package com.codotchi

import com.codotchi.engine.PetState

/**
 * StatusBarText.kt — pure formatting for [CodotchiStatusWidget] (no IDE types, so
 * it can be unit-tested). Mirrors vscode/src/statusBarText.ts: while an attention
 * call is active the text gets a "⚠ " prefix and the tooltip says what the pet wants.
 */

private val STAGE_EMOJI = mapOf(
    "egg"    to "🥚",
    "baby"   to "🐣",
    "child"  to "🐥",
    "teen"   to "🐦",
    "adult"  to "🦜",
    "senior" to "🦅",
)

/** What the pet wants, per attention call, phrased to follow "<name> ". */
private val CALL_WANTS = mapOf(
    "hunger"          to "is hungry!",
    "unhappiness"     to "is feeling sad!",
    "poop"            to "made a mess and wants you to clean it up!",
    "sick"            to "is sick and needs medicine!",
    "low_energy"      to "is exhausted and needs sleep!",
    "misbehaviour"    to "is misbehaving!",
    "gift"            to "brought you a gift — praise them!",
    "critical_health" to "'s health is critical!",
    "play"            to "wants to play a game!",
    "pat"             to "wants a pat!",
    "craving_meal"    to "is craving a meal!",
    "craving_snack"   to "is craving a snack!",
    "break"           to "says it's time for a break — praise them!",
)

/** Tooltip line for the active attention call, or "" when there is none. */
fun attentionCallLine(state: PetState): String {
    val call = state.activeAttentionCall ?: return ""
    val key = if (call == "craving" && state.cravingFood != null) "craving_${state.cravingFood}" else call
    // Custom characters (Tim, Stu) ask for a run / stickers and name their snack
    val patCall = getCustomCharacterBySpriteType(state.spriteType)?.patCall
    val cravingItem = cravingItemFor(state)
    val wants = when {
        call == "pat" && patCall != null -> patCall.status
        cravingItem != null             -> "is craving $cravingItem!"
        else                            -> CALL_WANTS[key] ?: "wants your attention!"
    }
    return "⚠ ${state.name}${if (wants.startsWith("'")) "" else " "}$wants"
}

/** Status bar text and tooltip for a pet. Text is empty when [enabled] is false. */
fun formatStatusWidget(state: PetState, enabled: Boolean): Pair<String, String> {
    if (!enabled) return "" to ""
    if (!state.alive) return "✝ ${state.name}" to "${state.name} has passed away. Start a new game."
    val emoji = STAGE_EMOJI[state.stage] ?: "🥚"
    val callLine = attentionCallLine(state)
    val text = "${if (callLine.isNotEmpty()) "⚠ " else ""}$emoji ${state.name}"
    val tooltip = listOf(
        callLine,
        "${state.name} | ${state.stage} | mood: ${state.mood} | health: ${state.health} | weight: ${state.weight}",
        if (state.sick) "⚠ Sick!" else "",
    ).filter { it.isNotEmpty() }.joinToString(" | ")
    return text to tooltip
}
