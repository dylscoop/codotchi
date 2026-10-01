package com.codotchi

import com.codotchi.engine.PetState

/**
 * Decides when to send a desktop (OS) notification because hunger, happiness,
 * energy or health fell below [CRITICAL_STAT_THRESHOLD]. Mirrors VS Code's
 * `criticalStatNotifier.ts` `evaluateCriticalStats`.
 *
 * A notification fires when any stat newly drops below the threshold, or when a
 * stat has stayed critical for [CRITICAL_STAT_NOTIFY_REPEAT_MS] since its last
 * notification. The message lists every critical stat, and all of their timers
 * restart together so one notification covers them. A stat that recovers is
 * dropped from the tracker; a dead pet clears it.
 */
object CriticalStatNotifier {

    /** A stat strictly below this value is critical. */
    const val CRITICAL_STAT_THRESHOLD = 20

    /** While a stat stays critical, re-notify this often. */
    const val CRITICAL_STAT_NOTIFY_REPEAT_MS = 15 * 60_000L

    val CRITICAL_STATS = listOf("hunger", "happiness", "energy", "health")

    data class Result(val message: String?, val tracker: Map<String, Long>)

    fun evaluate(state: PetState, tracker: Map<String, Long>, nowMs: Long): Result {
        if (!state.alive) return Result(null, emptyMap())
        val values = mapOf(
            "hunger" to state.hunger,
            "happiness" to state.happiness,
            "energy" to state.energy,
            "health" to state.health,
        )
        val critical = CRITICAL_STATS.filter { values.getValue(it) < CRITICAL_STAT_THRESHOLD }
        val due = critical.any { stat ->
            val last = tracker[stat]
            last == null || nowMs - last >= CRITICAL_STAT_NOTIFY_REPEAT_MS
        }
        val next = critical.associateWith { if (due) nowMs else tracker.getValue(it) }
        if (!due) return Result(null, next)
        val parts = critical.joinToString(", ") { "$it ${values.getValue(it)}" }
        return Result("${state.name} needs you — critical $parts", next)
    }
}
