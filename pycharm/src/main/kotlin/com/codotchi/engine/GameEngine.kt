package com.codotchi.engine

import kotlin.math.E
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.ln
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

// ---------------------------------------------------------------------------
// Sprite helpers
// ---------------------------------------------------------------------------

private val ZODIAC_ANIMALS = listOf(
    "rat", "ox", "tiger", "rabbit", "dragon", "snake",
    "horse", "sheep", "monkey", "rooster", "dog", "pig"
)

/**
 * Animals in the random rotation pool at pet creation.
 * All entries have equal probability (1 / ROTATION_ANIMALS.size each).
 * Note: some rotation animals (dog, snake, sheep, rooster, tiger) are also
 * zodiac animals — they remain accessible via zodiac character codes too.
 * More animals will be added to this set in the future.
 * Mirrors ROTATION_ANIMALS in vscode/src/gameEngine.ts.
 */
val ROTATION_ANIMALS = listOf(
    "cat", "dog", "snake", "sheep", "classic",
    "kangaroo", "dragon"
)

/**
 * Sample a random sprite type at pet creation.
 * Each entry in ROTATION_ANIMALS has equal probability.
 * Mirrors randomSpriteType() in vscode/src/gameEngine.ts.
 */
private fun randomSpriteType(): String {
    return ROTATION_ANIMALS[Random.nextInt(ROTATION_ANIMALS.size)]
}

/**
 * Logarithmic probability helper for probabilistic attention calls.
 *
 * Returns min(max, base × ln(ticksSinceLast + e)).
 * The probability grows slowly as more ticks pass without the call firing.
 */
private fun logChance(ticksSinceLast: Int, base: Double, max: Double): Double =
    min(max, base * ln(ticksSinceLast.toDouble() + E))

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
// Weight tier helpers
// ---------------------------------------------------------------------------

/**
 * Return the weight tier for a given weight value.
 *  0 = too skinny (<17), 1 = normal (17–50), 2 = slightly fat (51–80), 3 = overweight (>80)
 */
private fun weightTierOf(w: Int): Int = when {
    w > WEIGHT_OVERWEIGHT_THRESHOLD   -> 3
    w > WEIGHT_SLIGHTLY_FAT_THRESHOLD -> 2
    w < WEIGHT_HAPPINESS_LOW_THRESHOLD -> 0
    else                               -> 1
}

/**
 * Compare weight tiers before and after a change and append crossing events.
 */
private fun checkWeightTierEvents(prev: Int, next: Int, events: MutableList<String>) {
    val pt = weightTierOf(prev)
    val nt = weightTierOf(next)
    if (pt == nt) return
    when {
        nt == 3       -> events.add("weight_became_overweight")
        nt == 2 && pt < 2 -> events.add("weight_became_slightly_fat")
        nt == 0       -> events.add("weight_became_too_skinny")
        pt == 3       -> events.add("weight_no_longer_overweight")
        pt == 0       -> events.add("weight_no_longer_too_skinny")
    }
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

/**
 * Determine the evolution tier from care score + mistake counters.
 *
 * Priority order:
 *   1. secret_worst — lifetimeCareMistakes >= CARE_MISTAKE_SECRET_WORST_THRESHOLD
 *   2. secret_best  — careMistakes == 0 AND careScore >= CARE_MISTAKE_SECRET_BEST_CARE_SCORE
 *   3. low          — careMistakes > CARE_MISTAKE_MID_MAX
 *   4. mid          — careMistakes > CARE_MISTAKE_BEST_MAX AND score tier would be "best"
 *   5. otherwise    — standard score-based tier
 */
fun tierFromState(careScore: Double, careMistakes: Double, lifetimeCareMistakes: Int): String {
    if (lifetimeCareMistakes >= CARE_MISTAKE_SECRET_WORST_THRESHOLD) return "secret_worst"
    if (careMistakes == 0.0 && careScore >= CARE_MISTAKE_SECRET_BEST_CARE_SCORE) return "secret_best"
    val scoreTier = tierFromCareScore(careScore)
    if (careMistakes > CARE_MISTAKE_MID_MAX) return "low"
    if (careMistakes > CARE_MISTAKE_BEST_MAX && scoreTier == "best") return "mid"
    return scoreTier
}

fun characterForStage(
    petType: String,
    stage: String,
    careScore: Double,
    careMistakes: Double = 0.0,
    lifetimeCareMistakes: Int = 0,
): String {
    val tier = tierFromState(careScore, careMistakes, lifetimeCareMistakes)
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
    // Silent events (display-suppressed) are excluded from the persistent log.
    val silentEvents = setOf("game_paused", "game_resumed", "snack_placed")
    val loggableEvents = s.events.filter { it !in silentEvents }
    val newLog = if (loggableEvents.isNotEmpty())
        (s.recentEventLog + loggableEvents).takeLast(RECENT_EVENT_LOG_MAX)
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
// Attention call helper
// ---------------------------------------------------------------------------

/**
 * Data class returned when an attention call is answered — the three fields
 * that change when the call is cleared.
 */
private data class AnsweredCall(
    val activeAttentionCall: String?,
    val attentionCallActiveTicks: Int,
    val attentionCallCooldowns: Map<String, Int>,
)

/**
 * If the given call type is currently active, return the cleared fields plus
 * the answer cooldown. Returns null if that call is not active.
 */
private fun answerAttentionCall(state: PetState, callType: String): AnsweredCall? {
    if (state.activeAttentionCall != callType) return null
    val newCooldowns = state.attentionCallCooldowns.toMutableMap()
    newCooldowns[callType] = ATTENTION_ANSWER_COOLDOWN_TICKS
    return AnsweredCall(
        activeAttentionCall       = null,
        attentionCallActiveTicks  = 0,
        attentionCallCooldowns    = newCooldowns,
    )
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

fun createPet(name: String, petType: String, color: String, unlockedCharacter: String? = null): PetState {
    val modifiers = PET_TYPE_MODIFIERS[petType] ?: PET_TYPE_MODIFIERS["codeling"]!!
    val resolvedSprite = unlockedCharacter ?: randomSpriteType()
    return withDerivedFields(
        PetState(
            name               = name,
            petType            = petType,
            color              = color,
            spriteType         = resolvedSprite,
            hunger             = 50,
            happiness          = 50,
            discipline         = 50,
            energy             = 100,
            health             = modifiers.baseHealth,
            weight             = 40,
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
            snacksOnFloor        = 0,
            paused               = false,
            activeAttentionCall       = null,
            attentionCallActiveTicks  = 0,
            attentionCallCooldowns    = emptyMap(),
            careMistakes              = 0.0,
            lifetimeCareMistakes      = 0,
            ticksWithUncleanedPoop    = 0,
            ticksSinceLastMisbehaviour = 0,
            ticksSinceLastGift        = 0,
        )
    )
}

// ---------------------------------------------------------------------------
// Tick
// ---------------------------------------------------------------------------

fun tick(state: PetState, isIdle: Boolean = false, isDeepIdle: Boolean = false, config: GameConfig = DEFAULT_GAME_CONFIG): PetState {
    if (!state.alive) return state
    if (state.paused) return if (state.events.isNotEmpty()) state.copy(events = emptyList()) else state

    val modifiers = PET_TYPE_MODIFIERS[state.petType] ?: PET_TYPE_MODIFIERS["codeling"]!!
    val events    = mutableListOf<String>()

    var hunger             = state.hunger
    var happiness          = state.happiness
    var energy             = state.energy
    var health             = state.health
    var weight             = state.weight
    var poops              = state.poops
    var ticksSinceLastPoop = state.ticksSinceLastPoop
    var nextPoopIntervalTicks = state.nextPoopIntervalTicks
    var hungerZeroTicks    = state.hungerZeroTicks
    var sick               = state.sick
    var tookDamageThisTick = false
    var alive              = state.alive
    var sleeping           = state.sleeping
    var ageDays            = state.ageDays
    val ticksAlive         = state.ticksAlive + 1

    // Attention call mutable state
    var activeAttentionCall: String?       = state.activeAttentionCall
    var attentionCallActiveTicks: Int      = state.attentionCallActiveTicks
    val attentionCallCooldowns = state.attentionCallCooldowns.toMutableMap()
    var careMistakes: Double               = state.careMistakes
    var lifetimeCareMistakes: Int          = state.lifetimeCareMistakes
    var ticksWithUncleanedPoop: Int        = state.ticksWithUncleanedPoop
    var ticksSinceLastMisbehaviour: Int    = state.ticksSinceLastMisbehaviour
    var ticksSinceLastGift: Int            = state.ticksSinceLastGift

    // Capture sleeping state at tick entry so day-timer uses it even if auto-wake fires mid-tick
    val sleepingAtTickStart = sleeping

    // Stat decay — interval-based, mirroring VS Code's DECAY_TICK_INTERVAL approach.
    // Each stat decays 1 point every N ticks; N is scaled by the per-type multiplier
    // (higher multiplier → shorter interval → faster decay).  During idle the interval
    // is stretched by IDLE_DECAY_TICK_DIVISOR so decay is ~20× slower.
    // Aging uses a separate AGING_TICK_INTERVAL gate so the two rates are independent.
    val weightHappinessMult = if (state.weight > WEIGHT_HAPPINESS_HIGH_THRESHOLD || state.weight < WEIGHT_HAPPINESS_LOW_THRESHOLD)
        WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER else 1.0
    val hungerInterval    = maxOf(1, Math.round(DECAY_TICK_INTERVAL / modifiers.hungerDecayMultiplier).toInt())
    val happinessInterval = maxOf(1, Math.round((DECAY_TICK_INTERVAL / (modifiers.happinessDecayMultiplier * weightHappinessMult)).toFloat()).toInt())
    val energyInterval    = DECAY_TICK_INTERVAL

    val hungerDecayTick    = if (!isIdle) (ticksAlive % hungerInterval    == 0)
                             else         (ticksAlive % (hungerInterval    * IDLE_DECAY_TICK_DIVISOR) == 0)
    val happinessDecayTick = if (!isIdle) (ticksAlive % happinessInterval == 0)
                             else         (ticksAlive % (happinessInterval * IDLE_DECAY_TICK_DIVISOR) == 0)
    val energyDecayTick    = if (!isIdle) (ticksAlive % energyInterval    == 0)
                             else         (ticksAlive % (energyInterval    * IDLE_DECAY_TICK_DIVISOR) == 0)

    // Shared gate for aging (unaffected by per-type multipliers).
    // Uses AGING_TICK_INTERVAL (3 ticks = 9 s) which is independent of the
    // stat-decay interval so the two rates can be tuned separately.
    val decayThisTick = (ticksAlive % AGING_TICK_INTERVAL == 0) &&
        (!isIdle || (ticksAlive % IDLE_DECAY_TICK_DIVISOR == 0))

    if (!state.wasIdle && isIdle) {
        events.add("went_idle")
    }
    if (!state.wasDeepIdle && isDeepIdle) {
        events.add("went_deep_idle")
    }

    // ── Step 0–3: Attention-call mechanic (skipped when disabled) ────────────
    if (config.attentionCallsEnabled) {

    // ── Step 0: Maintain log counters (every tick, even idle) ────────────────
    if (poops > 0) {
        ticksWithUncleanedPoop += 1
    } else {
        ticksWithUncleanedPoop = 0
    }
    ticksSinceLastMisbehaviour += 1
    ticksSinceLastGift += 1

    } // end Step 0

    if (!sleeping) {
        if (hungerDecayTick)    hunger    = clampStat(hunger    - 1)
        if (happinessDecayTick) happiness = clampStat(happiness - 1)
        if (energyDecayTick)    energy    = clampStat(energy    - ENERGY_DECAY_PER_TICK)
    } else {
        val energyRegen = ceil(ENERGY_REGEN_PER_TICK_SLEEPING * modifiers.energyRegenMultiplier).toInt()
        energy = clampStat(energy + energyRegen)

        if (energy >= STAT_MAX) {
            sleeping = false
            events.add("auto_woke_up")
        }
        if (sleeping && ticksAlive % SLEEP_DECAY_TICK_INTERVAL == 0) {
            hunger    = clampStat(hunger    - 1)
            happiness = clampStat(happiness - 1)
        }
        // Random chance to recover from sickness while sleeping
        if (sleeping && sick && Math.random() < SLEEP_SICK_RECOVERY_CHANCE) {
            sick = false
            events.add("recovered_while_sleeping")
        }
    }

    // Advance day timer
    // When devMode is active, aging is additionally multiplied by devModeAgingMultiplier.
    val devAgingMult = if (config.devMode) config.devModeAgingMultiplier else 1.0
    val ageIncrement = if (!isDeepIdle && decayThisTick)
        (if (sleepingAtTickStart) 1.0 / TICKS_PER_GAME_DAY_SLEEPING
         else 1.0 / TICKS_PER_GAME_DAY_AWAKE) * modifiers.agingMultiplier * devAgingMult
    else 0.0
    val dayTimer = state.dayTimer + ageIncrement
    ageDays = dayTimer.toInt()

    // Time-based care-mistake forgiveness — decrement by 1 every CARE_MISTAKE_FORGIVENESS_DAYS game-days.
    if (floor(dayTimer / CARE_MISTAKE_FORGIVENESS_DAYS) >
            floor(state.dayTimer / CARE_MISTAKE_FORGIVENESS_DAYS)) {
        careMistakes = max(0.0, careMistakes - 1.0)
    }

    // Poop accumulation — suppressed during any idle state so the pet never
    // poops when the user is away from the IDE.
    if (!sleeping && !isIdle) {
        ticksSinceLastPoop += 1
        if (ticksSinceLastPoop >= nextPoopIntervalTicks) {
            poops += 1
            ticksSinceLastPoop = 0
            nextPoopIntervalTicks = sampleNextPoopInterval(state.petType)
            events.add("pooped")
            val prevWeightPoop = weight
            weight = clampWeight(weight - POOP_WEIGHT_LOSS)
            checkWeightTierEvents(prevWeightPoop, weight, events)
        }
    }

    // Passive weight decay — throttled during idle just like hunger/happiness (BUGFIX-033)
    val weightDecayInterval = if (isIdle) WEIGHT_DECAY_TICK_INTERVAL * IDLE_DECAY_TICK_DIVISOR
                              else WEIGHT_DECAY_TICK_INTERVAL
    if (ticksAlive % weightDecayInterval == 0) {
        val prevWeight = weight
        weight = clampWeight(weight - 1)
        checkWeightTierEvents(prevWeight, weight, events)
    }

    // Sickness from dirty environment — only fires when the IDE is active.
    if (poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK && !sick && !isIdle) {
        sick = true
        events.add("became_sick")
    }

    // Starvation counter
    if (hunger == STAT_MIN) hungerZeroTicks += 1 else hungerZeroTicks = 0

    // Starvation damage — no longer triggers sickness. Sickness is now only
    // caused by a dirty environment (poop) or overfeeding (snacks), so a pet
    // left hungry takes health damage but must not become "sick" from it.
    if (hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK) {
        health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK)
        events.add("starvation_damage")
        tookDamageThisTick = true
    }

    // Happiness-critical health drain — does not cause sickness (see above).
    if (happiness == STAT_MIN && !sleeping) {
        health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK)
        events.add("unhappiness_damage")
        tookDamageThisTick = true
    }

    // Energy-exhaustion health drain
    if (energy == STAT_MIN && !sleeping) {
        health = clampStat(health - EXHAUSTION_HEALTH_DAMAGE_PER_TICK)
        events.add("exhaustion_damage")
        tookDamageThisTick = true
    }

    // Sickness health drain — suppressed during deep idle; slowed during regular idle
    if (sick && !isDeepIdle) {
        val sickDmg = if (isIdle) IDLE_SICK_DAMAGE_PER_TICK else CRITICAL_HEALTH_DAMAGE_PER_TICK
        health = clampStat(health - sickDmg)
        events.add("sickness_damage")
        tookDamageThisTick = true
    }

    // Passive health regen
    if (!sick && health < STAT_MAX) {
        if (sleeping) {
            health = clampStat(health + 1)
        } else if (ticksAlive % HEALTH_REGEN_AWAKE_TICK_INTERVAL == 0) {
            health = clampStat(health + 1)
        }
    }

    // ── Step 1: Advance active call timer (non-idle ticks only) ────────────────
    if (config.attentionCallsEnabled) {
    if (activeAttentionCall != null && !isIdle) {
        attentionCallActiveTicks += 1
        // poop / misbehaviour / gift use the configurable expiry window;
        // all other call types use the fixed 2-minute (20-tick) window.
        val expiryTicks = if (activeAttentionCall == "poop" ||
                              activeAttentionCall == "misbehaviour" ||
                              activeAttentionCall == "gift")
            config.attentionCallExpiryTicks
        else
            ATTENTION_CALL_RESPONSE_TICKS
        if (attentionCallActiveTicks >= expiryTicks) {
            val expiredType = activeAttentionCall!!
            events.add("attention_call_expired_$expiredType")
            when (expiredType) {
                "critical_health" -> { health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY); happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY) }
                "sick"            -> health    = clampStat(health    - ATTENTION_EXPIRY_STAT_PENALTY)
                "poop"            -> if (!sick) { sick = true; events.add("became_sick") }
                "hunger"          -> hunger    = clampStat(hunger    - ATTENTION_EXPIRY_STAT_PENALTY)
                "unhappiness"     -> happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY)
                "misbehaviour"    -> { health  = clampStat(health    - ATTENTION_EXPIRY_STAT_PENALTY); careMistakes += 1; lifetimeCareMistakes += 1 }
                "low_energy"      -> happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY)
                "gift"            -> { happiness = clampStat(happiness - 5); careMistakes += 1; lifetimeCareMistakes += 1 }
            }
            // General care mistake increment (except misbehaviour and gift which have their own above)
            if (expiredType != "misbehaviour" && expiredType != "gift") {
                careMistakes += 1
                lifetimeCareMistakes += 1
            }
            attentionCallCooldowns[expiredType] = ATTENTION_EXPIRY_COOLDOWN_TICKS
            activeAttentionCall = null
            attentionCallActiveTicks = 0
        }
    }

    // ── Step 2: Decrement all cooldowns ────────────────────────────────────────
    for (type in attentionCallCooldowns.keys.toList()) {
        val remaining = (attentionCallCooldowns[type] ?: 0) - 1
        attentionCallCooldowns[type] = max(0, remaining)
    }

    // ── Step 3: Fire new call if none active ────────────────────────────────────
    val currentMood = moodFromStats(hunger, happiness, health, sleeping)

    if (activeAttentionCall == null) {
        fun cooldownClear(t: String) = (attentionCallCooldowns[t] ?: 0) == 0
        val rd = config.attentionCallRateDivisor

        // Poop call fires even while sleeping
        if (poops >= 1 && cooldownClear("poop") &&
            Random.nextDouble() < logChance(ticksWithUncleanedPoop, POOP_CALL_BASE_CHANCE / rd, POOP_CALL_MAX_CHANCE / rd)) {
            activeAttentionCall = "poop"
            attentionCallActiveTicks = 0
            events.add("attention_call_poop")
        } else if (!sleeping && health <= ATTENTION_HEALTH_THRESHOLD && cooldownClear("critical_health")) {
            activeAttentionCall = "critical_health"
            attentionCallActiveTicks = 0
            events.add("attention_call_critical_health")
        } else if (!sleeping && sick && cooldownClear("sick")) {
            activeAttentionCall = "sick"
            attentionCallActiveTicks = 0
            events.add("attention_call_sick")
        } else if (!sleeping && hunger <= ATTENTION_HUNGER_THRESHOLD && cooldownClear("hunger")) {
            activeAttentionCall = "hunger"
            attentionCallActiveTicks = 0
            events.add("attention_call_hunger")
        } else if (!sleeping && happiness <= ATTENTION_UNHAPPINESS_THRESHOLD && cooldownClear("unhappiness")) {
            activeAttentionCall = "unhappiness"
            attentionCallActiveTicks = 0
            events.add("attention_call_unhappiness")
        } else if (!sleeping && cooldownClear("misbehaviour") &&
            Random.nextDouble() < logChance(ticksSinceLastMisbehaviour, MISBEHAVIOUR_BASE_CHANCE / rd, MISBEHAVIOUR_MAX_CHANCE / rd)) {
            activeAttentionCall = "misbehaviour"
            attentionCallActiveTicks = 0
            ticksSinceLastMisbehaviour = 0
            events.add("attention_call_misbehaviour")
        } else if (!sleeping && energy <= ATTENTION_ENERGY_THRESHOLD && cooldownClear("low_energy")) {
            activeAttentionCall = "low_energy"
            attentionCallActiveTicks = 0
            events.add("attention_call_low_energy")
        } else if (!sleeping && cooldownClear("gift") &&
            health > ATTENTION_HEALTH_THRESHOLD &&
            !sick &&
            (currentMood == "happy" || currentMood == "neutral") &&
            Random.nextDouble() < logChance(ticksSinceLastGift, GIFT_BASE_CHANCE / rd, GIFT_MAX_CHANCE / rd)) {
            activeAttentionCall = "gift"
            attentionCallActiveTicks = 0
            ticksSinceLastGift = 0
            events.add("attention_call_gift")
        }
    }

    } // end if (config.attentionCallsEnabled)

    // Idle safety floor — while idle (regular or deep) and the pet is sick or took
    // damage this tick, prevent hunger/happiness/health/energy from decaying below
    // IDLE_STAT_FLOOR this tick. Applied last, after every stat-decay and damage
    // block above, so a same-tick damage source can never push a stat back below
    // the floor. The floor is capped at each stat's value entering this tick, so a
    // stat already below IDLE_STAT_FLOOR (e.g. from earlier exhaustion) is never
    // raised back up — it only stops *this tick's* decay from crossing the floor.
    if ((isIdle || isDeepIdle) && (sick || tookDamageThisTick)) {
        hunger    = maxOf(hunger,    minOf(state.hunger,    IDLE_STAT_FLOOR))
        happiness = maxOf(happiness, minOf(state.happiness, IDLE_STAT_FLOOR))
        health    = maxOf(health,    minOf(state.health,    IDLE_STAT_FLOOR))
        energy    = maxOf(energy,    minOf(state.energy,    IDLE_STAT_FLOOR))

        // If the floor above fully absorbed this tick's health loss (net health
        // unchanged), drop the damage events pushed earlier this tick so idle
        // logging/notifications don't claim the pet is losing health when it isn't.
        if (health == state.health) {
            events.removeAll { it in HEALTH_DAMAGE_EVENTS }
        }
    }

    // Dev mode: configurable health floor — prevents death from stat decay or old age
    // when devModeHealthFloor > 0 (default 1). Set floor to 0 to allow death in dev mode.
    if (config.devMode && health <= config.devModeHealthFloor) {
        health = config.devModeHealthFloor
    }

    // Death check
    if (health <= HEALTH_DEATH_THRESHOLD) {
        alive = false
        events.add("died")
        return withDerivedFields(
            state.copy(
                hunger = hunger, happiness = happiness, energy = energy,
                health = health, weight = weight, poops = poops,
                ticksSinceLastPoop = ticksSinceLastPoop,
                nextPoopIntervalTicks = nextPoopIntervalTicks,
                hungerZeroTicks = hungerZeroTicks, sick = sick,
                alive = alive, ticksAlive = ticksAlive,
                sleeping = sleeping, ageDays = ageDays, dayTimer = dayTimer,
                events = events,
                activeAttentionCall      = activeAttentionCall,
                attentionCallActiveTicks = attentionCallActiveTicks,
                attentionCallCooldowns   = attentionCallCooldowns,
                careMistakes             = careMistakes,
                lifetimeCareMistakes     = lifetimeCareMistakes,
                ticksWithUncleanedPoop   = ticksWithUncleanedPoop,
                ticksSinceLastMisbehaviour = ticksSinceLastMisbehaviour,
                ticksSinceLastGift       = ticksSinceLastGift,
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
        health = health, weight = weight, poops = poops,
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
        snacksGivenThisCycle = if (events.contains("auto_woke_up")) 0 else state.snacksGivenThisCycle,
        wasIdle = isIdle,
        wasDeepIdle = isDeepIdle,
        activeAttentionCall      = activeAttentionCall,
        attentionCallActiveTicks = attentionCallActiveTicks,
        attentionCallCooldowns   = attentionCallCooldowns,
        careMistakes             = careMistakes,
        lifetimeCareMistakes     = lifetimeCareMistakes,
        ticksWithUncleanedPoop   = ticksWithUncleanedPoop,
        ticksSinceLastMisbehaviour = ticksSinceLastMisbehaviour,
        ticksSinceLastGift       = ticksSinceLastGift,
    )

    // Stage progression + old-age death/sickness rolls (once per day boundary for seniors).
    // Evolution only fires on active (non-idle) ticks so the user is present to witness it;
    // dayTimer keeps accumulating while idle (see aging above), so once the threshold is
    // reached while idle the promotion is simply deferred — not lost — to the next active tick.
    val afterStage = if (isIdle) withDerivedFields(afterDecay) else checkStageProgression(afterDecay)
    return if (afterDecay.ageDays > state.ageDays) {
        val afterDeath = rollOldAgeDeath(afterStage)
        if (afterDeath.alive) rollOldAgeSickness(afterDeath) else afterDeath
    } else afterStage
}

// ---------------------------------------------------------------------------
// Stage progression
// ---------------------------------------------------------------------------

private fun checkStageProgression(state: PetState): PetState {
    val baseThreshold = EVOLUTION_DAY_THRESHOLDS[state.stage] ?: return withDerivedFields(state)
    val excessMistakes = max(0.0, state.careMistakes - CARE_MISTAKE_DELAY_THRESHOLD)
    val rawDelay = excessMistakes * CARE_MISTAKE_DAYS_PER_EXCESS
    val effectiveThreshold = baseThreshold + min(rawDelay, CARE_MISTAKE_DELAY_MAX_DAYS)
    if (state.dayTimer < effectiveThreshold) return withDerivedFields(state)
    val nextStage = NEXT_STAGE_MAP[state.stage] ?: return withDerivedFields(state)
    return evolveTo(state, nextStage)
}

private fun evolveTo(state: PetState, nextStage: String): PetState {
    val careScore = computeCareScore(state)
    val character = if (nextStage != "egg")
        characterForStage(state.petType, nextStage, careScore, state.careMistakes, state.lifetimeCareMistakes)
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
            careMistakes          = 0.0,
            // lifetimeCareMistakes intentionally preserved
            events             = state.events + "evolved_to_$nextStage",
        )
    )
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

fun feedMeal(state: PetState, mealsGivenThisCycle: Int, feedMealMaxPerCycle: Int? = null, feedHungerMult: Double? = null, feedMealWeightGain: Int? = null): PetState {
    val cap = feedMealMaxPerCycle ?: FEED_MEAL_MAX_PER_CYCLE
    val hungerBoost = (FEED_MEAL_HUNGER_BOOST * (feedHungerMult ?: 1.0)).toInt()
    if (mealsGivenThisCycle >= cap)
        return withDerivedFields(state.copy(events = listOf("meal_refused")))
    val newWeight = clampWeight(state.weight + (feedMealWeightGain ?: FEED_MEAL_WEIGHT_GAIN))
    val events = mutableListOf("fed_meal")
    checkWeightTierEvents(state.weight, newWeight, events)

    val answered = answerAttentionCall(state, "hunger")
    if (answered != null) events.add("attention_call_answered_hunger")
    val answeredCritical = if (answered == null) answerAttentionCall(state, "critical_health") else null
    if (answeredCritical != null) events.add("attention_call_answered_critical_health")

    val pick = answered ?: answeredCritical
    return withDerivedFields(
        state.copy(
            hunger            = clampStat(state.hunger + hungerBoost),
            weight            = newWeight,
            consecutiveSnacks = 0,
            careMistakes      = max(0.0, state.careMistakes - if (pick != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events            = events,
            activeAttentionCall      = if (pick != null) pick.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = pick?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = pick?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

/**
 * Register a snack being given to the pet (button-press phase).
 *
 * Validates the per-cycle cap, increments snack counters, and answers any
 * active hunger/critical_health attention call.  Does NOT yet apply stat
 * effects — those are deferred until the pet physically reaches the snack on
 * the stage (see [consumeSnack]).
 *
 * Emits `snack_placed` (triggers the floor-item animation in the webview) or
 * `snack_refused` if the cap has been reached.
 */
fun startSnack(state: PetState, feedSnackMaxPerCycle: Int? = null): PetState {
    if (state.snacksOnFloor >= MAX_FLOOR_SNACKS)
        return withDerivedFields(state.copy(events = listOf("snack_refused")))
    val cap = feedSnackMaxPerCycle ?: SNACK_MAX_PER_CYCLE
    if (state.snacksGivenThisCycle >= cap)
        return withDerivedFields(state.copy(events = listOf("snack_refused")))

    val snacksGivenThisCycle = state.snacksGivenThisCycle + 1
    val events = mutableListOf("snack_placed")

    val answered = answerAttentionCall(state, "hunger") ?: answerAttentionCall(state, "critical_health")
    if (answered != null) {
        val label = if (state.activeAttentionCall == "hunger") "hunger" else "critical_health"
        events.add("attention_call_answered_$label")
    }

    return withDerivedFields(
        state.copy(
            snacksGivenThisCycle = snacksGivenThisCycle,
            snacksOnFloor        = state.snacksOnFloor + 1,
            careMistakes         = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events               = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

/**
 * Apply the stat effects of a snack once the pet reaches it on the stage.
 *
 * Called when the webview detects the pet touching the snack floor item.
 * Increments [PetState.consecutiveSnacks] and — if the new count reaches
 * the maximum — triggers sickness. Refused (no stat effects) if
 * [PetState.snacksOnFloor] is already 0 — guards against a stale/duplicate
 * `snack_consumed` report (e.g. a second open project window sharing the
 * same pet independently simulating the same floor item) applying the
 * effect more than once.
 */
fun consumeSnack(state: PetState, feedHungerMult: Double? = null, snackSickThreshold: Int? = null, feedSnackWeightGain: Int? = null): PetState {
    if (state.snacksOnFloor <= 0) {
        return withDerivedFields(state.copy(events = listOf("snack_refused")))
    }
    val hungerBoost = (FEED_SNACK_HUNGER_BOOST * (feedHungerMult ?: 1.0)).toInt()
    val sickAt = snackSickThreshold ?: MAX_CONSECUTIVE_SNACKS_BEFORE_SICK
    val events = mutableListOf<String>()
    var sick = state.sick
    val consecutiveSnacks = state.consecutiveSnacks + 1
    if (consecutiveSnacks >= sickAt && !sick) {
        sick = true
        events.add("became_sick")
    }
    events.add("fed_snack")
    val newWeight = clampWeight(state.weight + (feedSnackWeightGain ?: FEED_SNACK_WEIGHT_GAIN))
    checkWeightTierEvents(state.weight, newWeight, events)

    return withDerivedFields(
        state.copy(
            happiness         = clampStat(state.happiness + FEED_SNACK_HAPPINESS_BOOST),
            hunger            = clampStat(state.hunger    + hungerBoost),
            weight            = newWeight,
            consecutiveSnacks = consecutiveSnacks,
            snacksOnFloor     = max(0, state.snacksOnFloor - 1),
            sick              = sick,
            events            = events,
        )
    )
}

fun play(state: PetState, playWeightLoss: Int? = null): PetState {
    if (state.energy < PLAY_ENERGY_COST)
        return withDerivedFields(state.copy(events = listOf("play_refused_no_energy")))
    val newWeight = clampWeight(state.weight - (playWeightLoss ?: PLAY_WEIGHT_LOSS))
    val events = mutableListOf("played")
    checkWeightTierEvents(state.weight, newWeight, events)

    val answered = answerAttentionCall(state, "unhappiness")
    if (answered != null) events.add("attention_call_answered_unhappiness")

    return withDerivedFields(
        state.copy(
            happiness         = clampStat(state.happiness + PLAY_HAPPINESS_BOOST),
            energy            = clampStat(state.energy    - PLAY_ENERGY_COST),
            weight            = newWeight,
            consecutiveSnacks = 0,
            careMistakes      = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events            = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

/**
 * Pat the pet — a gentle interaction that gives a modest happiness boost at a
 * lower energy cost than play. No minigame; just a direct stat change.
 */
fun pat(state: PetState): PetState {
    if (state.energy < PAT_ENERGY_COST)
        return withDerivedFields(state.copy(events = listOf("pat_refused_no_energy")))

    val newWeight = clampWeight(state.weight - PAT_WEIGHT_LOSS)
    val answered = answerAttentionCall(state, "unhappiness")
    val events = mutableListOf("patted")
    checkWeightTierEvents(state.weight, newWeight, events)
    if (answered != null) events.add("attention_call_answered_unhappiness")

    return withDerivedFields(
        state.copy(
            happiness                = clampStat(state.happiness + PAT_HAPPINESS_BOOST),
            energy                   = clampStat(state.energy    - PAT_ENERGY_COST),
            weight                   = newWeight,
            consecutiveSnacks        = 0,
            careMistakes             = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events                   = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

/**
 * Apply the stat cost of viewing the token cost overlay: same energy/happiness
 * change as a pat, but no weight, events, or attention-call side effects — the
 * cost bubble is shown separately, so this must not emit a "patted" event that
 * would race it with a reaction bubble (BUGFIX-140).
 */
fun applyTokenCostView(state: PetState): PetState {
    return withDerivedFields(
        state.copy(
            happiness = clampStat(state.happiness + PAT_HAPPINESS_BOOST),
            energy    = clampStat(state.energy    - PAT_ENERGY_COST),
            events    = emptyList(),
        )
    )
}

/**
 * Return the happiness delta for a mini-game outcome.
 *
 * @param game   "left_right", "higher_lower", "coin_flip", "guess", or "memory"
 * @param result "win" or "lose"
 * @return An integer delta applied on top of the play baseline (+15); net totals: LR win 20–30, LR lose 10, HL win 25–35, HL lose 10, coin_flip win 15, coin_flip lose 5.
 */
fun happinessDeltaForMinigame(game: String, result: String): Int {
    if (game == "left_right") {
        if (result == "win") return Random.nextInt(MINIGAME_LR_WIN_MIN, MINIGAME_LR_WIN_MAX + 1) // +5–+15
        return MINIGAME_LR_LOSE_DELTA // −5
    }
    if (game == "higher_lower") {
        if (result == "win") return Random.nextInt(MINIGAME_HL_WIN_MIN, MINIGAME_HL_WIN_MAX + 1) // +10–+20
        return MINIGAME_HL_LOSE_DELTA // −5
    }
    if (game == "coin_flip") return if (result == "win") MINIGAME_COIN_FLIP_WIN else MINIGAME_COIN_FLIP_LOSE // 0 win, −10 lose
    if (game == "memory" && result == "win") return MINIGAME_MEMORY_WIN_HAPPINESS_BOOST
    if (result == "win") return MINIGAME_WIN_HAPPINESS_BOOST
    return MINIGAME_LOSE_HAPPINESS_BOOST
}

fun applyMinigameResult(state: PetState, game: String, result: String): PetState {
    val delta = happinessDeltaForMinigame(game, result)
    // BUGFIX-034: left_right and higher_lower lose an extra 3 weight on top of the
    // 3 already lost in play(). coin_flip keeps total weight loss at 3 (no bonus here).
    val weightBonus = if (game == "left_right" || game == "higher_lower") PLAY_WEIGHT_LOSS_BONUS else 0
    val newWeight = clampWeight(state.weight - weightBonus)
    val events = mutableListOf("minigame_${game}_${result}")
    if (weightBonus > 0) checkWeightTierEvents(state.weight, newWeight, events)
    return withDerivedFields(
        state.copy(
            happiness = clampStat(state.happiness + delta),
            weight    = newWeight,
            events    = events,
        )
    )
}

fun sleep(state: PetState): PetState {
    if (state.sleeping) return withDerivedFields(state.copy(events = listOf("already_sleeping")))
    val answered = answerAttentionCall(state, "low_energy")
    val events = mutableListOf("fell_asleep")
    if (answered != null) events.add("attention_call_answered_low_energy")
    return withDerivedFields(
        state.copy(
            sleeping = true,
            consecutiveSnacks = 0,
            careMistakes = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events   = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
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
    val answered = answerAttentionCall(state, "poop")
    val events = mutableListOf("cleaned")
    if (answered != null) events.add("attention_call_answered_poop")
    return withDerivedFields(
        state.copy(
            poops                = 0,
            ticksSinceLastPoop   = 0,
            ticksWithUncleanedPoop = 0,
            careMistakes         = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events               = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

fun giveMedicine(state: PetState): PetState {
    if (!state.sick) return withDerivedFields(state.copy(events = listOf("medicine_not_needed")))
    val doses  = state.medicineDosesGiven + 1
    val events = mutableListOf("medicine_given")
    val answered = answerAttentionCall(state, "sick")
    if (answered != null) events.add("attention_call_answered_sick")

    return if (doses >= MEDICINE_DOSES_TO_CURE) {
        events.add("cured")
        withDerivedFields(
            state.copy(
                sick = false, medicineDosesGiven = 0, consecutiveSnacks = 0,
                careMistakes = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
                events = events,
                activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
                attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
                attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
            )
        )
    } else {
        withDerivedFields(
            state.copy(
                medicineDosesGiven = doses,
                careMistakes = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
                events = events,
                activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
                attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
                attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
            )
        )
    }
}

fun scold(state: PetState): PetState {
    val answered = answerAttentionCall(state, "misbehaviour")
    val events = mutableListOf("scolded")
    if (answered != null) events.add("attention_call_answered_misbehaviour")
    return withDerivedFields(
        state.copy(
            discipline = clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
            careMistakes = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events     = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

fun praise(state: PetState): PetState {
    val answeredGift        = answerAttentionCall(state, "gift")
    val answeredUnhappiness = if (answeredGift == null) answerAttentionCall(state, "unhappiness") else null
    val answered            = answeredGift ?: answeredUnhappiness
    val events = mutableListOf("praised")
    if (answeredGift        != null) events.add("attention_call_answered_gift")
    if (answeredUnhappiness != null) events.add("attention_call_answered_unhappiness")
    val happinessBonus = if (answeredGift != null) GIFT_PRAISE_HAPPINESS_BOOST else 0
    return withDerivedFields(
        state.copy(
            discipline  = clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
            happiness   = clampStat(state.happiness  + happinessBonus),
            careMistakes = max(0.0, state.careMistakes - if (answered != null) CARE_MISTAKE_ANSWER_CREDIT else 0.0),
            events      = events,
            activeAttentionCall      = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall,
            attentionCallActiveTicks = answered?.attentionCallActiveTicks ?: state.attentionCallActiveTicks,
            attentionCallCooldowns   = answered?.attentionCallCooldowns   ?: state.attentionCallCooldowns,
        )
    )
}

fun applyCodeActivity(state: PetState): PetState {
    if (state.paused) return state
    return withDerivedFields(
        state.copy(
            happiness  = clampStat(state.happiness  + CODE_ACTIVITY_HAPPINESS_BOOST),
            discipline = clampStat(state.discipline + CODE_ACTIVITY_DISCIPLINE_BOOST),
            events     = listOf("code_activity_rewarded"),
        )
    )
}

/** Freeze all tick-based progression (decay, aging, code activity). */
fun pause(state: PetState): PetState =
    withDerivedFields(state.copy(paused = true, events = listOf("game_paused")))

/** Resume normal tick-based progression after a pause. */
fun resume(state: PetState): PetState =
    withDerivedFields(state.copy(paused = false, events = listOf("game_resumed")))

fun applyCommitActivity(state: PetState): PetState {
    if (state.paused) return state
    return withDerivedFields(
        state.copy(
            happiness  = clampStat(state.happiness  + COMMIT_HAPPINESS_BOOST),
            discipline = clampStat(state.discipline + COMMIT_DISCIPLINE_BOOST),
            events     = listOf("commit_activity_rewarded"),
        )
    )
}

// ---------------------------------------------------------------------------
// Senior promotion
// ---------------------------------------------------------------------------

fun promoteToSenior(state: PetState): PetState {
    require(state.stage == "adult") { "promoteToSenior called on stage '${state.stage}'; expected 'adult'." }
    val character = characterForStage(state.petType, "senior", state.careScore, state.careMistakes, state.lifetimeCareMistakes)
    return withDerivedFields(
        state.copy(
            stage                 = "senior",
            character             = character,
            ticksAlive            = 0,
            careScoreHungerSum    = 0L,
            careScoreHappinessSum = 0L,
            careScoreHealthSum    = 0L,
            careScoreTicks        = 0L,
            careMistakes          = 0.0,
            // lifetimeCareMistakes intentionally preserved
            events                = listOf("evolved_to_senior"),
        )
    )
}

/**
 * Compute the per-day probability of old-age death for a senior pet.
 *
 * riskScore = average of happinessFactor, weightFactor, disciplineFactor  in [0, 1]
 *
 * The chance ramps from onset values at day 365 (ageFactor = 0) to peak at day 1825
 * (ageFactor = 1), then stays at peak:
 *
 *   ageFactor = clamp((ageDays - 365) / (1825 - 365), 0, 1)
 *   minChance = lerp(0.001, 0.05,  ageFactor)
 *   maxChance = lerp(0.010, 0.10,  ageFactor)
 *   chance    = lerp(minChance, maxChance, riskScore)
 */
fun computeOldAgeDeathChance(state: PetState): Double {
    val avgHappiness = if (state.careScoreTicks > 0)
        state.careScoreHappinessSum.toDouble() / state.careScoreTicks
    else state.happiness.toDouble()
    val happinessFactor = (100.0 - avgHappiness) / 100.0

    val weightFactor = when {
        state.weight < WEIGHT_HAPPINESS_LOW_THRESHOLD ->
            (WEIGHT_HAPPINESS_LOW_THRESHOLD - state.weight).toDouble() /
            (WEIGHT_HAPPINESS_LOW_THRESHOLD - WEIGHT_MIN).toDouble()
        state.weight > WEIGHT_HAPPINESS_HIGH_THRESHOLD ->
            (state.weight - WEIGHT_HAPPINESS_HIGH_THRESHOLD).toDouble() /
            (WEIGHT_MAX - WEIGHT_HAPPINESS_HIGH_THRESHOLD).toDouble()
        else -> 0.0
    }

    val disciplineFactor = (100.0 - state.discipline) / 100.0

    // Lifetime care mistakes factor — saturates at CARE_MISTAKE_OLD_AGE_SATURATE
    val mistakesFactor = min(1.0, state.lifetimeCareMistakes.toDouble() / CARE_MISTAKE_OLD_AGE_SATURATE)

    val riskScore = (happinessFactor + weightFactor + disciplineFactor + mistakesFactor) / 4.0

    val ageFactor = minOf(1.0, maxOf(0.0,
        (state.ageDays - SENIOR_NATURAL_DEATH_AGE_DAYS).toDouble() /
        (OLD_AGE_DEATH_PEAK_AGE_DAYS - SENIOR_NATURAL_DEATH_AGE_DAYS).toDouble()
    ))

    val baseWorstCare = OLD_AGE_DEATH_BASE_CHANCE_PER_DAY * (1.0 + OLD_AGE_DEATH_RISK_MULTIPLIER)
    val minChance = OLD_AGE_DEATH_BASE_CHANCE_PER_DAY +
        ageFactor * (OLD_AGE_DEATH_PEAK_BEST_CARE_CHANCE - OLD_AGE_DEATH_BASE_CHANCE_PER_DAY)
    val maxChance = baseWorstCare +
        ageFactor * (OLD_AGE_DEATH_PEAK_WORST_CARE_CHANCE - baseWorstCare)

    return minChance + riskScore * (maxChance - minChance)
}

/**
 * Roll for natural old-age death once per game-day boundary for a senior pet.
 * Returns state with alive=false and event "died_of_old_age" if the roll hits.
 */
fun rollOldAgeDeath(state: PetState): PetState {
    if (state.stage != "senior") return state
    if (state.ageDays < SENIOR_NATURAL_DEATH_AGE_DAYS) return state
    val chance = computeOldAgeDeathChance(state)
    if (Math.random() >= chance) return state
    return withDerivedFields(state.copy(alive = false, events = listOf("died_of_old_age")))
}

/**
 * Roll for a random age-related illness once per game-day boundary for a senior pet.
 * Returns state with sick=true and event "became_sick_old_age" if the roll hits.
 * No-op if the pet is already sick.
 */
fun rollOldAgeSickness(state: PetState): PetState {
    if (state.stage != "senior") return state
    if (state.ageDays < SENIOR_NATURAL_DEATH_AGE_DAYS) return state
    if (state.sick) return state
    val chance = OLD_AGE_SICK_CHANCE_MULTIPLIER * computeOldAgeDeathChance(state)
    if (Math.random() >= chance) return state
    return withDerivedFields(state.copy(sick = true, events = state.events + "became_sick_old_age"))
}

// ---------------------------------------------------------------------------
// Offline decay
// ---------------------------------------------------------------------------

fun applyOfflineDecay(state: PetState, elapsedSeconds: Int): PetState {
    if (elapsedSeconds <= 0 || !state.alive || state.paused) return state
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
            dayTimer  = state.dayTimer,
            ageDays   = state.ageDays,
            events    = emptyList(),
        )
    )
}
