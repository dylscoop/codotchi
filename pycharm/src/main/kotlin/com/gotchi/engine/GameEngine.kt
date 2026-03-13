package com.gotchi.engine

import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong
import kotlin.random.Random

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

private fun clamp(value: Int, minimum: Int, maximum: Int): Int =
    max(minimum, min(maximum, value))

private fun clampStat(value: Int): Int = clamp(value, STAT_MIN, STAT_MAX)
private fun clampWeight(value: Int): Int = clamp(value, WEIGHT_MIN, WEIGHT_MAX)

/**
 * Sample the next poop interval (in ticks) for a given pet type.
 *
 * Mirrors [sampleNextPoopInterval] in gameEngine.ts exactly:
 *   base   = POOP_TICKS_INTERVAL × poopIntervalMultiplier
 *   jitter = base × poopIntervalVolatility
 *   result = uniform(base − jitter, base + jitter), clamped to [1, POOP_TICKS_INTERVAL]
 */
fun sampleNextPoopInterval(petType: String): Int {
    val mods = PET_TYPE_MODIFIERS[petType] ?: PET_TYPE_MODIFIERS["codeling"]!!
    val base   = POOP_TICKS_INTERVAL * mods.poopIntervalMultiplier
    val jitter = base * mods.poopIntervalVolatility
    val raw    = base - jitter + Random.nextDouble() * 2.0 * jitter
    return max(1, min(POOP_TICKS_INTERVAL, raw.roundToLong().toInt()))
}

// ---------------------------------------------------------------------------
// Derived-field helpers
// ---------------------------------------------------------------------------

fun moodFromStats(hunger: Int, happiness: Int, health: Int, sleeping: Boolean): String {
    if (sleeping) return "sleeping"
    if (health < 30) return "sick"
    if (hunger < HUNGER_CRITICAL_THRESHOLD) return "sad"
    if (happiness < HAPPINESS_CRITICAL_THRESHOLD) return "sad"
    if (happiness >= 70 && hunger >= 50) return "happy"
    return "neutral"
}

fun tierFromCareScore(careScore: Double): String = when {
    careScore >= CARE_SCORE_BEST_TIER_THRESHOLD -> "best"
    careScore >= CARE_SCORE_MID_TIER_THRESHOLD  -> "mid"
    else                                         -> "low"
}

fun characterForStage(petType: String, stage: String, careScore: Double): String {
    val tier = tierFromCareScore(careScore)
    return EVOLUTION_CHARACTERS[petType]?.get(stage)?.get(tier) ?: ""
}

fun computeCareScore(state: PetState): Double {
    if (state.careScoreTicks == 0L) return 0.5
    val avgHunger    = state.careScoreHungerSum.toDouble() / state.careScoreTicks
    val avgHappiness = state.careScoreHappinessSum.toDouble() / state.careScoreTicks
    val avgHealth    = state.careScoreHealthSum.toDouble() / state.careScoreTicks
    val cleanlinessNorm = clampStat(100 - state.poops * 20).toDouble() / STAT_MAX

    return CARE_SCORE_HUNGER_WEIGHT     * (avgHunger    / STAT_MAX) +
           CARE_SCORE_HAPPINESS_WEIGHT  * (avgHappiness / STAT_MAX) +
           CARE_SCORE_DISCIPLINE_WEIGHT * (state.discipline.toDouble() / STAT_MAX) +
           CARE_SCORE_CLEANLINESS_WEIGHT * cleanlinessNorm +
           CARE_SCORE_HEALTH_WEIGHT     * (avgHealth    / STAT_MAX)
}

private fun withDerivedFields(s: PetState): PetState {
    val careScore = computeCareScore(s)
    val mood      = moodFromStats(s.hunger, s.happiness, s.health, s.sleeping)
    val sprite    = "${s.stage}_${mood}"
    // Append current events to the rolling log (capped at RECENT_EVENT_LOG_MAX)
    val newLog = if (s.events.isNotEmpty())
        (s.recentEventLog + s.events).takeLast(RECENT_EVENT_LOG_MAX)
    else
        s.recentEventLog
    return s.copy(
        careScore      = (careScore * 10000).roundToLong() / 10000.0,
        mood           = mood,
        sprite         = sprite,
        recentEventLog = newLog,
    )
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

fun createPet(name: String, petType: String, color: String): PetState {
    val modifiers = PET_TYPE_MODIFIERS[petType] ?: PET_TYPE_MODIFIERS["codeling"]!!
    return withDerivedFields(
        PetState(
            name               = name,
            petType            = petType,
            color              = color,
            hunger             = 50,
            happiness          = 50,
            discipline         = 50,
            energy             = 100,
            health             = modifiers.baseHealth,
            weight             = 5,
            ageDays            = 0,
            stage              = "egg",
            character          = "",
            alive              = true,
            sick               = false,
            sleeping           = false,
            mood               = "",
            sprite             = "",
            careScore          = 0.0,
            ticksAlive         = 0,
            poops              = 0,
            ticksSinceLastPoop = 0,
            nextPoopIntervalTicks = sampleNextPoopInterval(petType),
            consecutiveSnacks  = 0,
            hungerZeroTicks    = 0,
            medicineDosesGiven = 0,
            dayTimer           = 0.0,
            careScoreHungerSum    = 0L,
            careScoreHappinessSum = 0L,
            careScoreHealthSum    = 0L,
            careScoreTicks        = 0L,
            events             = emptyList(),
            recentEventLog     = emptyList(),
            wasIdle            = false,
            wasDeepIdle        = false,
            spawnedAt          = System.currentTimeMillis(),
            snacksGivenThisCycle = 0,
        )
    )
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

fun tick(state: PetState, isIdle: Boolean = false, isDeepIdle: Boolean = false): PetState {
    if (!state.alive) return state

    val modifiers = PET_TYPE_MODIFIERS[state.petType] ?: PET_TYPE_MODIFIERS["codeling"]!!
    val events    = mutableListOf<String>()

    var hunger             = state.hunger
    var happiness          = state.happiness
    var energy             = state.energy
    var health             = state.health
    var poops              = state.poops
    var ticksSinceLastPoop = state.ticksSinceLastPoop
    var nextPoopIntervalTicks = state.nextPoopIntervalTicks
    var hungerZeroTicks    = state.hungerZeroTicks
    var sick               = state.sick
    var alive              = state.alive
    var sleeping           = state.sleeping
    var ageDays            = state.ageDays
    val ticksAlive         = state.ticksAlive + 1

    // Capture sleeping state at tick entry so day-timer uses it even if auto-wake fires mid-tick
    val sleepingAtTickStart = sleeping

    // Stat decay
    // When idle, hunger/happiness/aging advance at only 1/IDLE_DECAY_TICK_DIVISOR of the normal rate.
    val decayThisTick = !isIdle || (ticksAlive % IDLE_DECAY_TICK_DIVISOR == 0)
    if (!state.wasIdle && isIdle) {
        events.add("went_idle")
    }
    if (!state.wasDeepIdle && isDeepIdle) {
        events.add("went_deep_idle")
    }

    if (!sleeping) {
        if (decayThisTick) {
            val hungerDecay    = ceil(HUNGER_DECAY_PER_TICK    * modifiers.hungerDecayMultiplier).toInt()
            val happinessDecay = ceil(HAPPINESS_DECAY_PER_TICK * modifiers.happinessDecayMultiplier).toInt()
            hunger    = clampStat(hunger    - hungerDecay)
            happiness = clampStat(happiness - happinessDecay)
        }
        // Deep idle: floor stats at IDLE_STAT_FLOOR so they never drop below 20%
        if (isDeepIdle) {
            hunger    = maxOf(hunger,    IDLE_STAT_FLOOR)
            happiness = maxOf(happiness, IDLE_STAT_FLOOR)
        }
        energy    = clampStat(energy    - ENERGY_DECAY_PER_TICK)
    } else {
        val energyRegen = ceil(ENERGY_REGEN_PER_TICK_SLEEPING * modifiers.energyRegenMultiplier).toInt()
        energy = clampStat(energy + energyRegen)

        // Auto-wake when energy is fully restored (BUGFIX-003 equivalent)
        if (energy >= STAT_MAX) {
            sleeping = false
            events.add("auto_woke_up")
        }
    }

    // Advance day timer — use sleepingAtTickStart to avoid mid-tick flip affecting the rate.
    // When idle, aging is slowed (same divisor as hunger/happiness decay).
    // When deep idle, aging stops entirely.
    val ageIncrement = if (!isDeepIdle && decayThisTick)
        (if (sleepingAtTickStart) 1.0 / TICKS_PER_GAME_DAY_SLEEPING
         else 1.0 / TICKS_PER_GAME_DAY_AWAKE) * modifiers.agingMultiplier
    else 0.0
    val dayTimer = state.dayTimer + ageIncrement
    ageDays = dayTimer.toInt()

    // Poop accumulation — interval is per-type and resampled with high volatility
    if (!sleeping) {
        ticksSinceLastPoop += 1
        if (ticksSinceLastPoop >= nextPoopIntervalTicks) {
            poops += 1
            ticksSinceLastPoop = 0
            nextPoopIntervalTicks = sampleNextPoopInterval(state.petType)
            events.add("pooped")
        }
    }

    // Sickness from dirty environment
    if (poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK && !sick) {
        sick = true
        events.add("became_sick")
    }

    // Starvation counter
    if (hunger == STAT_MIN) hungerZeroTicks += 1 else hungerZeroTicks = 0

    // Starvation damage — also triggers sickness so medicine can cure it (BUGFIX-007)
    if (hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK) {
        health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK)
        events.add("starvation_damage")
        if (!sick) {
            sick = true
            events.add("became_sick")
        }
    }

    // Happiness-critical health drain
    if (happiness == STAT_MIN && !sleeping) {
        health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK)
        events.add("unhappiness_damage")
    }

    // Sickness health drain
    if (sick) {
        health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK)
        events.add("sickness_damage")
    }

    // Passive health regen — full rate while sleeping, much slower awake
    if (!sick && health < STAT_MAX) {
        if (sleeping) {
            health = clampStat(health + 1)
        } else if (ticksAlive % HEALTH_REGEN_AWAKE_TICK_INTERVAL == 0) {
            health = clampStat(health + 1)
        }
    }

    // Death check
    if (health <= HEALTH_DEATH_THRESHOLD) {
        alive = false
        events.add("died")
        return withDerivedFields(
            state.copy(
                hunger = hunger, happiness = happiness, energy = energy,
                health = health, poops = poops,
                ticksSinceLastPoop = ticksSinceLastPoop,
                nextPoopIntervalTicks = nextPoopIntervalTicks,
                hungerZeroTicks = hungerZeroTicks, sick = sick,
                alive = alive, ticksAlive = ticksAlive,
                sleeping = sleeping, ageDays = ageDays, dayTimer = dayTimer,
                events = events,
            )
        )
    }

    // Care-score accumulation
    val careScoreHungerSum    = state.careScoreHungerSum    + hunger
    val careScoreHappinessSum = state.careScoreHappinessSum + happiness
    val careScoreHealthSum    = state.careScoreHealthSum    + health
    val careScoreTicks        = state.careScoreTicks        + 1

    val afterDecay = state.copy(
        hunger = hunger, happiness = happiness, energy = energy,
        health = health, poops = poops,
        ticksSinceLastPoop = ticksSinceLastPoop,
        nextPoopIntervalTicks = nextPoopIntervalTicks,
        hungerZeroTicks = hungerZeroTicks, sick = sick,
        alive = alive, ticksAlive = ticksAlive,
        sleeping = sleeping, ageDays = ageDays, dayTimer = dayTimer,
        careScoreHungerSum = careScoreHungerSum,
        careScoreHappinessSum = careScoreHappinessSum,
        careScoreHealthSum = careScoreHealthSum,
        careScoreTicks = careScoreTicks,
        events = events,
        // Reset snack counter on auto-wake (mirrors the reset in wake())
        snacksGivenThisCycle = if (events.contains("auto_woke_up")) 0 else state.snacksGivenThisCycle,
        wasIdle = isIdle,
        wasDeepIdle = isDeepIdle,
    )

    return checkStageProgression(afterDecay)
}

// ---------------------------------------------------------------------------
// Stage progression
// ---------------------------------------------------------------------------

private fun checkStageProgression(state: PetState): PetState {
    val dayThreshold = EVOLUTION_DAY_THRESHOLDS[state.stage] ?: return withDerivedFields(state)
    if (state.dayTimer < dayThreshold) return withDerivedFields(state)
    val nextStage = NEXT_STAGE_MAP[state.stage] ?: return withDerivedFields(state)
    return evolveTo(state, nextStage)
}

private fun evolveTo(state: PetState, nextStage: String): PetState {
    val careScore = computeCareScore(state)
    val character = if (nextStage != "egg") characterForStage(state.petType, nextStage, careScore)
                    else state.character

    return withDerivedFields(
        state.copy(
            stage              = nextStage,
            character          = character,
            ticksAlive         = 0,
            careScoreHungerSum    = 0L,
            careScoreHappinessSum = 0L,
            careScoreHealthSum    = 0L,
            careScoreTicks        = 0L,
            events             = state.events + "evolved_to_$nextStage",
        )
    )
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

fun feedMeal(state: PetState, mealsGivenThisCycle: Int): PetState {
    if (mealsGivenThisCycle >= FEED_MEAL_MAX_PER_CYCLE)
        return withDerivedFields(state.copy(events = listOf("meal_refused")))
    return withDerivedFields(
        state.copy(
            hunger            = clampStat(state.hunger + FEED_MEAL_HUNGER_BOOST),
            weight            = clampWeight(state.weight + FEED_MEAL_WEIGHT_GAIN),
            consecutiveSnacks = 0,
            events            = listOf("fed_meal"),
        )
    )
}

fun feedSnack(state: PetState): PetState {
    if (state.snacksGivenThisCycle >= SNACK_MAX_PER_CYCLE)
        return withDerivedFields(state.copy(events = listOf("snack_refused")))

    val consecutiveSnacks    = state.consecutiveSnacks + 1
    val snacksGivenThisCycle = state.snacksGivenThisCycle + 1
    val events = mutableListOf<String>()
    var sick = state.sick
    if (consecutiveSnacks >= MAX_CONSECUTIVE_SNACKS_BEFORE_SICK && !sick) {
        sick = true
        events.add("became_sick")
    }
    events.add("fed_snack")
    return withDerivedFields(
        state.copy(
            happiness            = clampStat(state.happiness + FEED_SNACK_HAPPINESS_BOOST),
            hunger               = clampStat(state.hunger    + FEED_SNACK_HUNGER_BOOST),
            weight               = clampWeight(state.weight + FEED_SNACK_WEIGHT_GAIN),
            consecutiveSnacks    = consecutiveSnacks,
            snacksGivenThisCycle = snacksGivenThisCycle,
            sick                 = sick,
            events               = events,
        )
    )
}

fun play(state: PetState): PetState {
    if (state.energy < PLAY_ENERGY_COST)
        return withDerivedFields(state.copy(events = listOf("play_refused_no_energy")))
    return withDerivedFields(
        state.copy(
            happiness         = clampStat(state.happiness + PLAY_HAPPINESS_BOOST),
            energy            = clampStat(state.energy    - PLAY_ENERGY_COST),
            weight            = clampWeight(state.weight  - PLAY_WEIGHT_LOSS),
            consecutiveSnacks = 0,
            events            = listOf("played"),
        )
    )
}

fun happinessDeltaForMinigame(game: String, result: String): Int = when {
    game == "memory" && result == "win" -> MINIGAME_MEMORY_WIN_HAPPINESS_BOOST
    result == "win"                     -> MINIGAME_WIN_HAPPINESS_BOOST
    else                                -> MINIGAME_LOSE_HAPPINESS_BOOST
}

fun applyMinigameResult(state: PetState, game: String, result: String): PetState {
    val delta = happinessDeltaForMinigame(game, result)
    return withDerivedFields(
        state.copy(
            happiness = clampStat(state.happiness + delta),
            events    = listOf("minigame_${game}_${result}"),
        )
    )
}

fun sleep(state: PetState): PetState {
    if (state.sleeping) return withDerivedFields(state.copy(events = listOf("already_sleeping")))
    return withDerivedFields(state.copy(sleeping = true, events = listOf("fell_asleep")))
}

fun wake(state: PetState): PetState {
    if (!state.sleeping) return withDerivedFields(state.copy(events = listOf("already_awake")))
    return withDerivedFields(
        state.copy(
            sleeping             = false,
            events               = listOf("woke_up"),
        )
    )
}

fun clean(state: PetState): PetState {
    if (state.poops == 0) return withDerivedFields(state.copy(events = listOf("already_clean")))
    return withDerivedFields(
        state.copy(poops = 0, ticksSinceLastPoop = 0, events = listOf("cleaned"))
    )
}

fun giveMedicine(state: PetState): PetState {
    if (!state.sick) return withDerivedFields(state.copy(events = listOf("medicine_not_needed")))
    val doses  = state.medicineDosesGiven + 1
    val events = mutableListOf("medicine_given")
    return if (doses >= MEDICINE_DOSES_TO_CURE) {
        events.add("cured")
        withDerivedFields(
            state.copy(sick = false, medicineDosesGiven = 0, events = events)
        )
    } else {
        withDerivedFields(state.copy(medicineDosesGiven = doses, events = events))
    }
}

fun scold(state: PetState): PetState =
    withDerivedFields(
        state.copy(discipline = clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION), events = listOf("scolded"))
    )

fun praise(state: PetState): PetState =
    withDerivedFields(
        state.copy(discipline = clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION), events = listOf("praised"))
    )

fun applyCodeActivity(state: PetState): PetState =
    withDerivedFields(
        state.copy(
            happiness  = clampStat(state.happiness  + CODE_ACTIVITY_HAPPINESS_BOOST),
            discipline = clampStat(state.discipline + CODE_ACTIVITY_DISCIPLINE_BOOST),
            events     = listOf("code_activity_rewarded"),
        )
    )

// ---------------------------------------------------------------------------
// Senior promotion
// ---------------------------------------------------------------------------

fun promoteToSenior(state: PetState): PetState {
    require(state.stage == "adult") { "promoteToSenior called on stage '${state.stage}'; expected 'adult'." }
    val character = characterForStage(state.petType, "senior", state.careScore)
    return withDerivedFields(
        state.copy(
            stage                 = "senior",
            character             = character,
            ticksAlive            = 0,
            careScoreHungerSum    = 0L,
            careScoreHappinessSum = 0L,
            careScoreHealthSum    = 0L,
            careScoreTicks        = 0L,
            events                = listOf("evolved_to_senior"),
        )
    )
}

fun checkOldAgeDeath(state: PetState): PetState {
    if (state.stage != "senior") return state
    if (state.ageDays < SENIOR_NATURAL_DEATH_AGE_DAYS) return state
    if (state.health <= HEALTH_DEATH_THRESHOLD)
        return withDerivedFields(state.copy(alive = false, events = listOf("died_of_old_age")))
    return state
}

// ---------------------------------------------------------------------------
// Offline decay
// ---------------------------------------------------------------------------

fun applyOfflineDecay(state: PetState, elapsedSeconds: Int): PetState {
    if (elapsedSeconds <= 0 || !state.alive) return state
    val modifiers = PET_TYPE_MODIFIERS[state.petType] ?: PET_TYPE_MODIFIERS["codeling"]!!
    val elapsedTicks = elapsedSeconds.toDouble() / TICK_INTERVAL_SECONDS

    val hungerDecayTotal    = ceil(elapsedTicks * HUNGER_DECAY_PER_TICK    * modifiers.hungerDecayMultiplier).toInt()
    val happinessDecayTotal = ceil(elapsedTicks * HAPPINESS_DECAY_PER_TICK * modifiers.happinessDecayMultiplier).toInt()

    val maxHungerLoss    = (state.hunger    * OFFLINE_DECAY_MAX_FRACTION).toInt()
    val maxHappinessLoss = (state.happiness * OFFLINE_DECAY_MAX_FRACTION).toInt()

    return withDerivedFields(
        state.copy(
            hunger    = clampStat(state.hunger    - min(hungerDecayTotal,    maxHungerLoss)),
            happiness = clampStat(state.happiness - min(happinessDecayTotal, maxHappinessLoss)),
            // Aging does NOT advance while the IDE is closed.
            dayTimer  = state.dayTimer,
            ageDays   = state.ageDays,
            events    = emptyList(),
        )
    )
}
