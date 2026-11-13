package com.codotchi.engine

// Companion — an animal that lives with the pet (Stugotchi's cat).
// Mirrors the Companion section of packages/core/src/gameEngine.ts.

/** Characters that come with a companion: pet spriteType -> companion spriteType. */
val COMPANION_BY_SPRITE: Map<String, String> = mapOf("stu" to "cat")
/** Ticks between each 1-point drop in the companion's hunger / happiness (gentler than the pet). */
const val COMPANION_DECAY_TICK_INTERVAL: Int = 10
/** Below this, a stat counts as low for the linked-mood rules. */
const val COMPANION_LOW_STAT: Int = 25
/** Ticks between each extra 1-point happiness drop caused by the other animal being sad. */
const val COMPANION_LINK_TICK_INTERVAL: Int = 20
const val COMPANION_MEAL_HUNGER: Int = 20
const val COMPANION_SNACK_HUNGER: Int = 10
const val COMPANION_SNACK_HAPPINESS: Int = 5
const val COMPANION_PLAY_HAPPINESS: Int = 15
/** petCompanion(): happiness for the companion and for the pet. */
const val COMPANION_PET_HAPPINESS: Int = 15
const val COMPANION_PET_OWNER_HAPPINESS: Int = 5
const val COMPANION_PET_COOLDOWN_TICKS: Int = 20
/** Happiness the companion gets when a friend arrives. */
const val COMPANION_VISIT_HAPPINESS: Int = 10
/** Visitor spriteTypes each companion hisses at (others get a curious look). */
val COMPANION_HISSES_AT: Map<String, List<String>> = mapOf("cat" to listOf("dog"))

private fun clampCompanionStat(v: Int): Int = v.coerceIn(STAT_MIN, STAT_MAX)

/** A fresh companion for a pet of this spriteType, or null when it has none. */
fun newCompanionFor(spriteType: String): CompanionPet? =
    COMPANION_BY_SPRITE[spriteType]?.let { CompanionPet(it, hunger = 50, happiness = 50, petCooldownTicks = 0) }

/** Parse a saved companion; saves without one get a fresh companion if the character has one. */
fun companionFromRaw(raw: Any?, petSpriteType: String): CompanionPet? {
    val fresh = newCompanionFor(petSpriteType) ?: return null
    val r = raw as? Map<*, *> ?: return fresh
    fun num(v: Any?, fallback: Double): Double =
        if (v is Number && v.toDouble().isFinite()) v.toDouble() else fallback
    return fresh.copy(
        hunger = clampCompanionStat(num(r["hunger"], 50.0).toInt()),
        happiness = clampCompanionStat(num(r["happiness"], 50.0).toInt()),
        petCooldownTicks = maxOf(0, num(r["petCooldownTicks"], 0.0).toInt()),
    )
}

/** The companion after a care action; null stays null. */
internal fun careForCompanion(c: CompanionPet?, hunger: Int, happiness: Int): CompanionPet? =
    c?.copy(hunger = clampCompanionStat(c.hunger + hunger), happiness = clampCompanionStat(c.happiness + happiness))

/**
 * The companion's part of a tick: its stats decay, and the two animals' moods
 * are linked. When a friend arrives it cheers up and emits companion_hiss or
 * companion_curious. Always on: ignores socialEnabled.
 */
internal fun tickCompanion(state: PetState, isIdle: Boolean, isDeepIdle: Boolean): PetState {
    val c = state.companion ?: return state
    if (!state.alive || state.paused || state.stage == "egg") return state
    val t = state.ticksAlive
    val awake = !state.sleeping && !isDeepIdle
    val interval = COMPANION_DECAY_TICK_INTERVAL * (if (isIdle) IDLE_DECAY_TICK_DIVISOR else 1)
    var hunger = c.hunger
    var happiness = c.happiness
    var ownerHappiness = state.happiness
    val events = mutableListOf<String>()
    if (awake && t % interval == 0) {
        hunger = clampCompanionStat(hunger - 1)
        happiness = clampCompanionStat(happiness - if (hunger < COMPANION_LOW_STAT) 2 else 1)
    }
    if (awake && t % COMPANION_LINK_TICK_INTERVAL == 0) {
        if (c.happiness < COMPANION_LOW_STAT) ownerHappiness = clampCompanionStat(ownerHappiness - 1)
        if (state.happiness < COMPANION_LOW_STAT) happiness = clampCompanionStat(happiness - 1)
    }
    val friend = state.friend
    if ("friend_visit_started" in state.events && friend != null) {
        happiness = clampCompanionStat(happiness + COMPANION_VISIT_HAPPINESS)
        events.add(if (friend.spriteType in COMPANION_HISSES_AT[c.spriteType].orEmpty()) "companion_hiss" else "companion_curious")
    }
    val petCooldownTicks = maxOf(0, c.petCooldownTicks - if (isIdle || isDeepIdle) 0 else 1)
    if (hunger == c.hunger && happiness == c.happiness && petCooldownTicks == c.petCooldownTicks &&
        ownerHappiness == state.happiness && events.isEmpty()) return state
    val merged = state.copy(
        companion = c.copy(hunger = hunger, happiness = happiness, petCooldownTicks = petCooldownTicks),
        happiness = ownerHappiness,
    )
    val mood = moodFromStats(merged.hunger, merged.happiness, merged.health, merged.sleeping)
    return merged.copy(
        mood = mood,
        sprite = "${merged.stage}_$mood",
        events = state.events + events,
        recentEventLog = if (events.isNotEmpty()) (state.recentEventLog + events).takeLast(RECENT_EVENT_LOG_MAX)
                         else state.recentEventLog,
    )
}

/**
 * The player pets the companion: both animals get happier. Refused
 * (companion_pet_refused) while on cooldown, asleep, or with no companion.
 */
fun petCompanion(state: PetState): PetState {
    val c = state.companion
    if (c == null || !state.alive || state.stage == "egg") return withDerivedFields(state.copy(events = emptyList()))
    if (state.sleeping || c.petCooldownTicks > 0) return withDerivedFields(state.copy(events = listOf("companion_pet_refused")))
    return withDerivedFields(state.copy(
        happiness = clampCompanionStat(state.happiness + COMPANION_PET_OWNER_HAPPINESS),
        companion = c.copy(happiness = clampCompanionStat(c.happiness + COMPANION_PET_HAPPINESS),
                           petCooldownTicks = COMPANION_PET_COOLDOWN_TICKS),
        events = listOf("companion_petted"),
    ))
}
