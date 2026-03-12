package com.gotchi.engine

// ---------------------------------------------------------------------------
// Constants — ported 1:1 from vscode/src/gameEngine.ts
// ---------------------------------------------------------------------------

const val TICK_INTERVAL_SECONDS: Int = 5

private const val TICKS_PER_MINUTE: Int = 60 / TICK_INTERVAL_SECONDS
private const val TICKS_PER_HOUR: Int = 60 * TICKS_PER_MINUTE

const val EGG_DURATION_TICKS: Int = 2 * TICKS_PER_MINUTE
const val BABY_DURATION_TICKS: Int = 10 * TICKS_PER_MINUTE
const val CHILD_DURATION_TICKS: Int = 1 * TICKS_PER_HOUR
const val TEEN_DURATION_TICKS: Int = 3 * TICKS_PER_HOUR

const val STAT_MIN: Int = 0
const val STAT_MAX: Int = 100
const val WEIGHT_MIN: Int = 1
const val WEIGHT_MAX: Int = 99

const val HUNGER_DECAY_PER_TICK: Int = 1
const val HAPPINESS_DECAY_PER_TICK: Int = 1
const val ENERGY_REGEN_PER_TICK_SLEEPING: Int = 3

const val HUNGER_CRITICAL_THRESHOLD: Int = 10
const val HAPPINESS_CRITICAL_THRESHOLD: Int = 10
const val HEALTH_DEATH_THRESHOLD: Int = 0
const val HUNGER_ZERO_TICKS_BEFORE_RISK: Int = 3
const val CRITICAL_HEALTH_DAMAGE_PER_TICK: Int = 5

const val MAX_CONSECUTIVE_SNACKS_BEFORE_SICK: Int = 3
const val MAX_UNCLEANED_POOPS_BEFORE_SICK: Int = 3
/** Maximum snacks allowed per wake cycle before further snacks are refused. */
const val SNACK_MAX_PER_CYCLE: Int = 2
/** Maximum number of events kept in recentEventLog. */
const val RECENT_EVENT_LOG_MAX: Int = 20
const val POOP_TICKS_INTERVAL: Int = 20 * TICKS_PER_MINUTE

const val FEED_MEAL_HUNGER_BOOST: Int = 20
const val FEED_MEAL_WEIGHT_GAIN: Int = 1
const val FEED_MEAL_MAX_PER_CYCLE: Int = 4

const val FEED_SNACK_HAPPINESS_BOOST: Int = 10
const val FEED_SNACK_HUNGER_BOOST: Int = 5
const val FEED_SNACK_WEIGHT_GAIN: Int = 2

const val PLAY_HAPPINESS_BOOST: Int = 15
const val PLAY_ENERGY_COST: Int = 25
const val PLAY_WEIGHT_LOSS: Int = 1

/** Passive energy drain per tick while awake. */
const val ENERGY_DECAY_PER_TICK: Int = 1

const val MEDICINE_DOSES_TO_CURE: Int = 3

/** Ticks between passive health regen pulses while awake (1 hp per interval). */
const val HEALTH_REGEN_AWAKE_TICK_INTERVAL: Int = 5

const val DISCIPLINE_BOOST_PER_ACTION: Int = 10

const val CODE_ACTIVITY_HAPPINESS_BOOST: Int = 5
const val CODE_ACTIVITY_DISCIPLINE_BOOST: Int = 2
const val CODE_ACTIVITY_THROTTLE_SECONDS: Int = 30

const val MINIGAME_WIN_HAPPINESS_BOOST: Int = 15
const val MINIGAME_LOSE_HAPPINESS_BOOST: Int = 5
const val MINIGAME_MEMORY_WIN_HAPPINESS_BOOST: Int = 20

const val CARE_SCORE_HUNGER_WEIGHT: Double = 0.30
const val CARE_SCORE_HAPPINESS_WEIGHT: Double = 0.25
const val CARE_SCORE_DISCIPLINE_WEIGHT: Double = 0.20
const val CARE_SCORE_CLEANLINESS_WEIGHT: Double = 0.15
const val CARE_SCORE_HEALTH_WEIGHT: Double = 0.10

const val CARE_SCORE_BEST_TIER_THRESHOLD: Double = 0.80
const val CARE_SCORE_MID_TIER_THRESHOLD: Double = 0.55

const val OFFLINE_DECAY_MAX_FRACTION: Double = 0.60

const val SENIOR_NATURAL_DEATH_AGE_DAYS: Int = 20

/** Ticks elapsed while awake before the day timer advances by 1.0 (1 game day = 1 real hour awake). */
const val TICKS_PER_GAME_DAY_AWAKE: Int = TICKS_PER_HOUR

/**
 * Ticks elapsed while sleeping before the day timer advances by 1.0
 * (~48 min asleep = 1 day, ~25% faster than awake).
 */
val TICKS_PER_GAME_DAY_SLEEPING: Int = Math.round(TICKS_PER_HOUR * 0.8f)

// ---------------------------------------------------------------------------
// Per-type modifiers
// ---------------------------------------------------------------------------

data class PetTypeModifiers(
    val hungerDecayMultiplier: Double,
    val happinessDecayMultiplier: Double,
    val baseHealth: Int,
    val energyRegenMultiplier: Double,
    /**
     * Average poop interval as a fraction of POOP_TICKS_INTERVAL (20 min).
     * 1.0 = every 20 min on average; 0.5 = every 10 min on average.
     */
    val poopIntervalMultiplier: Double,
    /**
     * Fractional jitter applied to the poop interval each time the pet poops.
     * 0.0 = perfectly regular; 0.9 = highly unpredictable.
     */
    val poopIntervalVolatility: Double,
)

val PET_TYPE_MODIFIERS: Map<String, PetTypeModifiers> = mapOf(
    // Codeling — balanced default, ~15 min avg, ±50% volatility
    "codeling"    to PetTypeModifiers(1.0, 1.0, 100, 1.0, 0.75, 0.5),
    // Bytebug — fast hunger + very unpredictable poop, ~8 min avg, ±80%
    "bytebug"     to PetTypeModifiers(1.5, 1.0, 100, 1.2, 0.4, 0.8),
    // Pixelpup — active social type, ~12 min avg, ±70%
    "pixelpup"    to PetTypeModifiers(1.0, 1.5, 100, 1.0, 0.6, 0.7),
    // Shellscript — slow and regular, ~20 min avg, ±20% (near-clockwork)
    "shellscript" to PetTypeModifiers(0.8, 1.0, 120, 1.0, 1.0, 0.2),
)

val VALID_PET_TYPES: List<String> = PET_TYPE_MODIFIERS.keys.toList()

val STAGE_ORDER: List<String> = listOf("egg", "baby", "child", "teen", "adult", "senior")

// Evolution character name lookup: petType → stage → tier → characterName
val EVOLUTION_CHARACTERS: Map<String, Map<String, Map<String, String>>> = mapOf(
    "codeling" to mapOf(
        "baby"   to mapOf("best" to "codeling_baby_a",   "mid" to "codeling_baby_b",   "low" to "codeling_baby_c"),
        "child"  to mapOf("best" to "codeling_child_a",  "mid" to "codeling_child_b",  "low" to "codeling_child_c"),
        "teen"   to mapOf("best" to "codeling_teen_a",   "mid" to "codeling_teen_b",   "low" to "codeling_teen_c"),
        "adult"  to mapOf("best" to "codeling_adult_a",  "mid" to "codeling_adult_b",  "low" to "codeling_adult_c"),
        "senior" to mapOf("best" to "codeling_senior_a", "mid" to "codeling_senior_b", "low" to "codeling_senior_c"),
    ),
    "bytebug" to mapOf(
        "baby"   to mapOf("best" to "bytebug_baby_a",   "mid" to "bytebug_baby_b",   "low" to "bytebug_baby_c"),
        "child"  to mapOf("best" to "bytebug_child_a",  "mid" to "bytebug_child_b",  "low" to "bytebug_child_c"),
        "teen"   to mapOf("best" to "bytebug_teen_a",   "mid" to "bytebug_teen_b",   "low" to "bytebug_teen_c"),
        "adult"  to mapOf("best" to "bytebug_adult_a",  "mid" to "bytebug_adult_b",  "low" to "bytebug_adult_c"),
        "senior" to mapOf("best" to "bytebug_senior_a", "mid" to "bytebug_senior_b", "low" to "bytebug_senior_c"),
    ),
    "pixelpup" to mapOf(
        "baby"   to mapOf("best" to "pixelpup_baby_a",   "mid" to "pixelpup_baby_b",   "low" to "pixelpup_baby_c"),
        "child"  to mapOf("best" to "pixelpup_child_a",  "mid" to "pixelpup_child_b",  "low" to "pixelpup_child_c"),
        "teen"   to mapOf("best" to "pixelpup_teen_a",   "mid" to "pixelpup_teen_b",   "low" to "pixelpup_teen_c"),
        "adult"  to mapOf("best" to "pixelpup_adult_a",  "mid" to "pixelpup_adult_b",  "low" to "pixelpup_adult_c"),
        "senior" to mapOf("best" to "pixelpup_senior_a", "mid" to "pixelpup_senior_b", "low" to "pixelpup_senior_c"),
    ),
    "shellscript" to mapOf(
        "baby"   to mapOf("best" to "shellscript_baby_a",   "mid" to "shellscript_baby_b",   "low" to "shellscript_baby_c"),
        "child"  to mapOf("best" to "shellscript_child_a",  "mid" to "shellscript_child_b",  "low" to "shellscript_child_c"),
        "teen"   to mapOf("best" to "shellscript_teen_a",   "mid" to "shellscript_teen_b",   "low" to "shellscript_teen_c"),
        "adult"  to mapOf("best" to "shellscript_adult_a",  "mid" to "shellscript_adult_b",  "low" to "shellscript_adult_c"),
        "senior" to mapOf("best" to "shellscript_senior_a", "mid" to "shellscript_senior_b", "low" to "shellscript_senior_c"),
    ),
)

val STAGE_DURATION_MAP: Map<String, Int> = mapOf(
    "egg"   to EGG_DURATION_TICKS,
    "baby"  to BABY_DURATION_TICKS,
    "child" to CHILD_DURATION_TICKS,
    "teen"  to TEEN_DURATION_TICKS,
)

val NEXT_STAGE_MAP: Map<String, String> = mapOf(
    "egg"   to "baby",
    "baby"  to "child",
    "child" to "teen",
    "teen"  to "adult",
)
