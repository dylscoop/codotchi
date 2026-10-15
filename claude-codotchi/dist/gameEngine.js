// GENERATED from packages/core/src/gameEngine.ts by scripts/sync-core.mjs — do not edit here.
// Edit packages/core/src/gameEngine.ts, then run: node scripts/sync-core.mjs
/**
 * gameEngine.ts
 *
 * Pure-TypeScript game engine for codotchi.
 *
 * Replaces the retired Python subprocess architecture.  All game logic lives
 * here as pure functions; side effects (persistence, VS Code API calls) belong
 * in extension.ts / sidebarProvider.ts / events.ts.
 *
 * Design:
 *   - No global mutable state — callers hold the PetState value.
 *   - Every exported function returns a NEW PetState object (immutable updates).
 *   - All constants are co-located at the top of this file (ported from
 *     python/config.py and python/models.py).
 */
// ---------------------------------------------------------------------------
// Constants (ported from python/config.py)
// ---------------------------------------------------------------------------
/** How many real-world seconds elapse between each game tick. */
export const TICK_INTERVAL_SECONDS = 3;
/**
 * Stat decay (hunger, happiness, energy) fires once every DECAY_TICK_INTERVAL
 * ticks — one stat point lost every 18 real-world seconds at 3 s/tick
 * (2× slower than v1.19.x).  Aging uses a separate AGING_TICK_INTERVAL so
 * the two rates can be tuned independently.
 */
const DECAY_TICK_INTERVAL = 6;
/**
 * Aging gate — dayTimer advances once every AGING_TICK_INTERVAL ticks
 * (every 9 real-world seconds at 3 s/tick), decoupled from stat decay.
 * Idle stretches this by IDLE_DECAY_TICK_DIVISOR; deep idle stops it entirely.
 */
const AGING_TICK_INTERVAL = 3;
const TICKS_PER_MINUTE = 60 / TICK_INTERVAL_SECONDS;
const TICKS_PER_HOUR = 60 * TICKS_PER_MINUTE;
/** Duration of the egg stage in ticks. */
export const EGG_DURATION_TICKS = 2 * TICKS_PER_MINUTE;
/** Duration of the baby stage in ticks. */
export const BABY_DURATION_TICKS = 28 * TICKS_PER_MINUTE;
/** Duration of the child stage in ticks. */
export const CHILD_DURATION_TICKS = 90 * TICKS_PER_MINUTE;
/** Duration of the teen stage in ticks. */
export const TEEN_DURATION_TICKS = 6 * TICKS_PER_HOUR;
/** Duration of the adult stage in ticks (used as a seed for tests). */
export const ADULT_DURATION_TICKS = 16 * TICKS_PER_HOUR;
const STAT_MIN = 0;
const STAT_MAX = 100;
const WEIGHT_MIN = 1;
const WEIGHT_MAX = 99;
const HUNGER_DECAY_PER_TICK = 1;
const HAPPINESS_DECAY_PER_TICK = 1;
const ENERGY_REGEN_PER_TICK_SLEEPING = 3;
const HUNGER_CRITICAL_THRESHOLD = 10;
const HAPPINESS_CRITICAL_THRESHOLD = 10;
const HEALTH_DEATH_THRESHOLD = 0;
/** Consecutive ticks at hunger === 0 before health starts dropping. */
const HUNGER_ZERO_TICKS_BEFORE_RISK = 3;
/** Health lost per tick when starving, happiness-critical, or sick. */
const CRITICAL_HEALTH_DAMAGE_PER_TICK = 5;
const MAX_CONSECUTIVE_SNACKS_BEFORE_SICK = 3;
const MAX_UNCLEANED_POOPS_BEFORE_SICK = 5;
/**
 * Consecutive active (awake, non-idle) ticks the pet must spend at or above
 * MAX_UNCLEANED_POOPS_BEFORE_SICK before it becomes sick (≈ 1 real minute),
 * so cleaning up in time prevents the sickness.
 */
const POOP_SICK_GRACE_TICKS = 20;
/** Maximum snacks allowed per wake cycle before further snacks are refused. */
export const SNACK_MAX_PER_CYCLE = 3;
/** Maximum snacks allowed on the stage floor simultaneously before further snacks are refused. */
export const MAX_FLOOR_SNACKS = 3;
/** Maximum number of events kept in recentEventLog. */
const RECENT_EVENT_LOG_MAX = 20;
/** Ticks between droppings (≈ 20 real minutes). */
const POOP_TICKS_INTERVAL = 20 * TICKS_PER_MINUTE;
const FEED_MEAL_HUNGER_BOOST = 15;
const FEED_MEAL_WEIGHT_GAIN = 2;
const FEED_MEAL_MAX_PER_CYCLE = 3;
const FEED_SNACK_HAPPINESS_BOOST = 5;
const FEED_SNACK_HUNGER_BOOST = 5;
const FEED_SNACK_WEIGHT_GAIN = 5;
const PLAY_HAPPINESS_BOOST = 15;
const PLAY_ENERGY_COST = 25;
const PLAY_WEIGHT_LOSS = 3;
const PAT_HAPPINESS_BOOST = 10;
const PAT_ENERGY_COST = 20;
/** Weight lost when the pet is patted (BUGFIX-034). */
const PAT_WEIGHT_LOSS = 3;
/** Additional weight lost for left_right and higher_lower mini-games (BUGFIX-034).
 *  These games are more vigorous than coin_flip; total loss = PLAY_WEIGHT_LOSS + PLAY_WEIGHT_LOSS_BONUS = 6. */
const PLAY_WEIGHT_LOSS_BONUS = 3;
const POOP_WEIGHT_LOSS = 5;
/** Ticks between passive weight decay pulses (1 weight per interval = 1 per minute). */
const WEIGHT_DECAY_TICK_INTERVAL = TICKS_PER_MINUTE; // 20 ticks = 1 min
/** Weight above which happiness decays 1.5× faster. */
const WEIGHT_HAPPINESS_HIGH_THRESHOLD = 66;
/** Weight below which happiness decays 1.5× faster. */
const WEIGHT_HAPPINESS_LOW_THRESHOLD = 17;
/** Happiness decay multiplier when weight is at an extreme. */
const WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER = 1.5;
/** Weight above which the sprite is drawn 1.25× wider. */
export const WEIGHT_SLIGHTLY_FAT_THRESHOLD = 50;
/** Weight above which the sprite is drawn 1.5× wider. */
export const WEIGHT_OVERWEIGHT_THRESHOLD = 80;
/** Passive energy drain per tick while awake — throttled by idle just like hunger/happiness. */
const ENERGY_DECAY_PER_TICK = 1;
/** Health lost per tick when the pet's energy is fully depleted while awake. Slower than other critical conditions. */
const EXHAUSTION_HEALTH_DAMAGE_PER_TICK = 2;
/** Per-tick probability that sickness clears naturally while the pet is sleeping. */
const SLEEP_SICK_RECOVERY_CHANCE = 0.03;
/** While sleeping, hunger and happiness decay once every this many ticks (very slow drain). */
const SLEEP_DECAY_TICK_INTERVAL = 5;
/** Medicine doses needed to cure sickness. Feed, Snack and Play are refused until then. */
export const MEDICINE_DOSES_TO_CURE = 3;
/** Ticks between passive health regen pulses while awake (1 hp per interval). */
const HEALTH_REGEN_AWAKE_TICK_INTERVAL = 5;
const DISCIPLINE_BOOST_PER_ACTION = 10;
const CODE_ACTIVITY_HAPPINESS_BOOST = 8;
const CODE_ACTIVITY_DISCIPLINE_BOOST = 2;
/** Minimum seconds between code-activity happiness boosts. */
export const CODE_ACTIVITY_THROTTLE_SECONDS = 10;
const COMMIT_HAPPINESS_BOOST = 15;
const COMMIT_DISCIPLINE_BOOST = 2;
/** Minimum seconds between commit happiness boosts (prevents rapid --amend abuse). */
export const COMMIT_ACTIVITY_THROTTLE_SECONDS = 300;
/**
 * Seconds of no IDE activity (no keystrokes, cursor movement, or window focus)
 * before the pet is considered "idle" and decay is reduced to IDLE_DECAY_FRACTION.
 */
export const IDLE_THRESHOLD_SECONDS = 60; // 1 minute
/**
 * Seconds of sustained idle before entering "deep idle": stats are floored at
 * IDLE_STAT_FLOOR and aging stops completely.
 */
export const IDLE_DEEP_THRESHOLD_SECONDS = 600; // 10 minutes
/**
 * Minimum stat value (hunger, happiness) enforced while in deep idle.
 * Expressed as a 0-100 value (20 = 20%).
 */
export const IDLE_STAT_FLOOR = 20;
/**
 * Event names that report health loss. When the idle safety floor fully
 * absorbs a tick's computed damage (net health unchanged), these are
 * stripped from the tick's events so logging/notifications don't claim the
 * pet is losing health when it isn't (follow-up to BUGFIX-149).
 */
const HEALTH_DAMAGE_EVENTS = new Set([
    "starvation_damage",
    "unhappiness_damage",
    "exhaustion_damage",
    "sickness_damage",
]);
/**
 * When the user is idle, hunger and happiness decay at this fraction of the
 * normal rate (applied by skipping decay on most ticks — 1 in every
 * IDLE_DECAY_TICK_DIVISOR ticks actually decays).
 */
const IDLE_DECAY_TICK_DIVISOR = 20; // 10% of normal rate (every 20 ticks × 3s = every 60s)
const MINIGAME_WIN_HAPPINESS_BOOST = 15; // legacy "guess" fallback
const MINIGAME_LOSE_HAPPINESS_BOOST = 5; // legacy "guess" fallback
const MINIGAME_MEMORY_WIN_HAPPINESS_BOOST = 20;
// Left/Right: play baseline +15; delta win +5–+15, lose −5 → totals: win 20–30, lose 10
const MINIGAME_LR_WIN_MIN = 5;
const MINIGAME_LR_WIN_MAX = 15;
const MINIGAME_LR_LOSE_DELTA = -5;
// Higher/Lower: play baseline +15; delta win +10–+20, lose −5 → totals: win 25–35, lose 10
const MINIGAME_HL_WIN_MIN = 10;
const MINIGAME_HL_WIN_MAX = 20;
const MINIGAME_HL_LOSE_DELTA = -5;
// Coin Flip: play baseline +15; delta win 0, lose −10 → totals: win 15, lose 5
const MINIGAME_COIN_FLIP_WIN = 0;
const MINIGAME_COIN_FLIP_LOSE = -10;
// Blackjack (Stu's Coin Flip): play baseline +15; delta win +10, push 0, lose −10 → totals: 25 / 15 / 5
const MINIGAME_BLACKJACK_WIN = 10;
const MINIGAME_BLACKJACK_PUSH = 0;
const MINIGAME_BLACKJACK_LOSE = -10;
// Boss Battle: play baseline +15; delta win +10, lose −5 → totals: win 25, lose 10
const MINIGAME_BOSS_BATTLE_WIN = 10;
const MINIGAME_BOSS_BATTLE_LOSE = -5;
const CARE_SCORE_HUNGER_WEIGHT = 0.30;
const CARE_SCORE_HAPPINESS_WEIGHT = 0.25;
const CARE_SCORE_DISCIPLINE_WEIGHT = 0.20;
const CARE_SCORE_CLEANLINESS_WEIGHT = 0.15;
const CARE_SCORE_HEALTH_WEIGHT = 0.10;
const CARE_SCORE_BEST_TIER_THRESHOLD = 0.80;
const CARE_SCORE_MID_TIER_THRESHOLD = 0.55;
/** Maximum fraction of any stat that can be lost while the extension is off. */
const OFFLINE_DECAY_MAX_FRACTION = 0.60;
// ---------------------------------------------------------------------------
// Attention Call constants
// ---------------------------------------------------------------------------
/** Active (non-idle) ticks the player has to respond before a call expires (20 × 3 s = 1 min). */
export const ATTENTION_CALL_RESPONSE_TICKS = 20;
/** Hunger stat at or below which a hunger attention call fires. */
export const ATTENTION_HUNGER_THRESHOLD = 25;
/** Happiness stat at or below which an unhappiness attention call fires. */
export const ATTENTION_UNHAPPINESS_THRESHOLD = 40;
/** Energy stat at or below which a low_energy attention call fires. */
export const ATTENTION_ENERGY_THRESHOLD = 20;
/** Health stat at or below which a critical_health attention call fires. */
export const ATTENTION_HEALTH_THRESHOLD = 50;
/**
 * Cooldown ticks (100 × 3 s = 5 min) applied to a call type after it is answered.
 * Cooldowns only count down on active (non-idle) ticks. Must match Constants.kt (BUG-S06).
 */
export const ATTENTION_ANSWER_COOLDOWN_TICKS = 100;
/** Cooldown ticks (100 × 3 s = 5 min) applied to a call type after it expires unanswered. */
export const ATTENTION_EXPIRY_COOLDOWN_TICKS = 100;
/** Stat penalty applied to the relevant stat when an attention call expires. */
export const ATTENTION_EXPIRY_STAT_PENALTY = 10;
/** Happiness boost applied when a gift attention call is answered via praise(). */
export const GIFT_PRAISE_HAPPINESS_BOOST = 15;
/**
 * Active (non-idle, awake) ticks between "take a break" calls: 600 × 3 s = 30 min.
 * The timer only restarts when the break is actually taken (call answered via
 * praise()). Idle time pauses it; an ignored call re-fires after its expiry cooldown.
 */
export const BREAK_CALL_INTERVAL_TICKS = 600;
/** Happiness boost when a break call is answered via praise() — same as a gift. */
export const BREAK_PRAISE_HAPPINESS_BOOST = GIFT_PRAISE_HAPPINESS_BOOST;
/**
 * Length of the nap the pet takes when a break call is answered: 100 × 3 s = 5 min.
 * While napping every stat except energy is frozen (energy regenerates), the pet
 * keeps aging, and it can't be woken early — it wakes on its own when the timer runs out.
 */
export const BREAK_NAP_TICKS = 100;
// ---------------------------------------------------------------------------
// Care Mistakes constants
// ---------------------------------------------------------------------------
/**
 * Number of care mistakes in a single stage that are tolerated before the
 * evolution tier begins to be penalised.  0–CARE_MISTAKE_BEST_MAX = "best"
 * tier is still achievable (subject to careScore); above this the tier is
 * capped downward.
 */
export const CARE_MISTAKE_BEST_MAX = 3;
/**
 * Above this many per-stage care mistakes the maximum achievable evolution
 * tier is "low" (regardless of careScore).
 */
export const CARE_MISTAKE_MID_MAX = 6;
/**
 * Number of excess per-stage care mistakes (above CARE_MISTAKE_BEST_MAX)
 * required before any evolution delay is applied.  Mistakes ≤ BEST_MAX = no
 * delay; each mistake above this threshold adds CARE_MISTAKE_DAYS_PER_EXCESS
 * game-days to the evolution threshold for that stage.
 */
export const CARE_MISTAKE_DELAY_THRESHOLD = CARE_MISTAKE_BEST_MAX;
/**
 * Game-days added to the current stage's evolution threshold for each care
 * mistake above CARE_MISTAKE_DELAY_THRESHOLD (1 game-day = TICKS_PER_GAME_DAY_AWAKE ticks).
 */
export const CARE_MISTAKE_DAYS_PER_EXCESS = 1;
/**
 * Maximum total game-days of evolution delay regardless of how many care mistakes
 * have accumulated (caps at 9 game-days ≈ 1.5× the baby stage duration).
 */
export const CARE_MISTAKE_DELAY_MAX_DAYS = 9.0;
/**
 * Game-days between automatic forgiveness ticks — every this many game-days,
 * careMistakes is decremented by 1 (floored at 0).
 */
export const CARE_MISTAKE_FORGIVENESS_DAYS = 2.0;
/**
 * Amount by which careMistakes is decremented each time an attention call is
 * successfully answered (0.5 = two answered calls forgive one mistake).
 */
export const CARE_MISTAKE_ANSWER_CREDIT = 0.5;
/**
 * Lifetime care mistakes required to unlock the "secret_worst" evolution path
 * (equivalent to Oyajitchi / Bill in the original Tamagotchi).
 */
export const CARE_MISTAKE_SECRET_WORST_THRESHOLD = 10;
/**
 * Per-stage care mistakes must be exactly 0 AND careScore ≥ this value to
 * unlock the "secret_best" evolution path (equivalent to Mametchi).
 */
export const CARE_MISTAKE_SECRET_BEST_CARE_SCORE = 0.95;
/**
 * Lifetime care mistakes saturate the old-age risk factor at this value.
 * At lifetimeCareMistakes === CARE_MISTAKE_OLD_AGE_SATURATE, the mistakes
 * factor contributes its maximum (1.0) to the riskScore.
 */
export const CARE_MISTAKE_OLD_AGE_SATURATE = 20;
// Logarithmic random-chance tuning constants for probabilistic calls.
export const POOP_CALL_BASE_CHANCE = 0.03;
export const POOP_CALL_MAX_CHANCE = 0.12;
export const MISBEHAVIOUR_BASE_CHANCE = 0.005;
export const MISBEHAVIOUR_MAX_CHANCE = 0.08;
export const GIFT_BASE_CHANCE = 0.002;
export const GIFT_MAX_CHANCE = 0.05;
// Whim calls — fire at any stat level, unlike the need-based calls.
export const PLAY_CALL_BASE_CHANCE = 0.003;
export const PLAY_CALL_MAX_CHANCE = 0.04;
export const PAT_CALL_BASE_CHANCE = 0.004;
export const PAT_CALL_MAX_CHANCE = 0.05;
export const CRAVING_CALL_BASE_CHANCE = 0.003;
export const CRAVING_CALL_MAX_CHANCE = 0.04;
/** A craving never asks for a meal when hunger is already at or above this. */
const CRAVING_MEAL_MAX_HUNGER = 90;
/** Age in game days at which a senior pet may die of old age (365 game days = 1 in-game year). */
export const SENIOR_NATURAL_DEATH_AGE_DAYS = 365;
/** Base per-day probability of a senior dying of old age when all stats are optimal. */
export const OLD_AGE_DEATH_BASE_CHANCE_PER_DAY = 0.001;
/**
 * Risk multiplier applied to the base chance when all three longevity factors
 * (happiness, weight, discipline) are at their worst.
 * Final chance = BASE × (1 + MULTIPLIER × riskScore), where riskScore ∈ [0, 1].
 * Range: 0.1 % / day (perfect) → 1.0 % / day (neglected) at the onset age (day 365).
 */
export const OLD_AGE_DEATH_RISK_MULTIPLIER = 9;
/** Peak age in game days at which old-age death chance is capped (5 in-game years). */
export const OLD_AGE_DEATH_PEAK_AGE_DAYS = 1825;
/** Best-care (riskScore = 0) per-day death probability at peak age. */
export const OLD_AGE_DEATH_PEAK_BEST_CARE_CHANCE = 0.05;
/** Worst-care (riskScore = 1) per-day death probability at peak age. */
export const OLD_AGE_DEATH_PEAK_WORST_CARE_CHANCE = 0.10;
/**
 * Multiplier applied to the old-age death chance to get the per-day sickness
 * chance for senior pets.  Seniors are 3× more likely to fall ill than to die.
 */
export const OLD_AGE_SICK_CHANCE_MULTIPLIER = 3;
/**
 * Ticks elapsed while awake before the day timer advances by 1.0 (1 game day = 5 real minutes awake).
 * 5 min × 60 s ÷ 6 s/tick = 50 ticks.
 */
export const TICKS_PER_GAME_DAY_AWAKE = 5 * TICKS_PER_MINUTE;
/**
 * Ticks elapsed while sleeping before the day timer advances by 1.0 (≈ 4 min asleep = 1 day,
 * ~25% faster than awake).
 */
export const TICKS_PER_GAME_DAY_SLEEPING = Math.round(5 * TICKS_PER_MINUTE * 0.8);
/** Sensible defaults used when no explicit config is provided. */
export const DEFAULT_GAME_CONFIG = {
    attentionCallsEnabled: true,
    attentionCallExpiryTicks: 200, // "standard" = 10 min
    attentionCallRateDivisor: 3.0, // "fast"
    devMode: false,
    devModeAgingMultiplier: 10,
    devModeHealthFloor: 1,
    immortal: false,
};
/**
 * Config used by the claude-codotchi Claude Code plugin. Looked up by
 * scripts/action.mjs, statusline.mjs, and the hooks via `LOCAL_PET_GAME_CONFIG
 * ?? DEFAULT_GAME_CONFIG` — the pet living in Claude's own chat is immortal.
 */
export const LOCAL_PET_GAME_CONFIG = {
    ...DEFAULT_GAME_CONFIG,
    immortal: true,
};
const PET_TYPE_MODIFIERS = {
    /**
     * Codeling — balanced default.
     * Poops every ~15 min on average (0.75× baseline), moderate volatility.
     */
    codeling: {
        hungerDecayMultiplier: 1.0,
        happinessDecayMultiplier: 1.0,
        baseHealth: 100,
        energyRegenMultiplier: 1.0,
        poopIntervalMultiplier: 0.75,
        poopIntervalVolatility: 0.5,
        agingMultiplier: 1.0,
    },
    /**
     * Bytebug — eats fast, digests fast.
     * Poops every ~8 min on average (0.4× baseline), very high volatility —
     * could pop one in 2 min or not for 16 min.
     */
    bytebug: {
        hungerDecayMultiplier: 1.5,
        happinessDecayMultiplier: 1.0,
        baseHealth: 100,
        energyRegenMultiplier: 1.2,
        poopIntervalMultiplier: 0.4,
        poopIntervalVolatility: 0.8,
        agingMultiplier: 1.5,
    },
    /**
     * Pixelpup — active and social, irregular bathroom habits.
     * Poops every ~12 min on average (0.6× baseline), high volatility.
     */
    pixelpup: {
        hungerDecayMultiplier: 1.0,
        happinessDecayMultiplier: 1.5,
        baseHealth: 100,
        energyRegenMultiplier: 1.0,
        poopIntervalMultiplier: 0.6,
        poopIntervalVolatility: 0.7,
        agingMultiplier: 1.25,
    },
    /**
     * Shellscript — slow metabolism, very regular.
     * Poops every ~20 min on average (1.0× baseline), low volatility — almost
     * clockwork.
     */
    shellscript: {
        hungerDecayMultiplier: 0.8,
        happinessDecayMultiplier: 1.0,
        baseHealth: 120,
        energyRegenMultiplier: 1.0,
        poopIntervalMultiplier: 1.0,
        poopIntervalVolatility: 0.2,
        agingMultiplier: 0.75,
    },
};
/** All valid pet type identifiers. */
export const VALID_PET_TYPES = Object.keys(PET_TYPE_MODIFIERS);
/** Life-stage names in order. */
export const STAGE_ORDER = [
    "egg",
    "baby",
    "child",
    "teen",
    "adult",
    "senior",
];
/** Evolution character name lookup: petType → stage → tier → characterName. */
const EVOLUTION_CHARACTERS = {
    codeling: {
        baby: { best: "codeling_baby_a", mid: "codeling_baby_b", low: "codeling_baby_c", secret_best: "codeling_baby_a", secret_worst: "codeling_baby_c" },
        child: { best: "codeling_child_a", mid: "codeling_child_b", low: "codeling_child_c", secret_best: "codeling_child_a", secret_worst: "codeling_child_c" },
        teen: { best: "codeling_teen_a", mid: "codeling_teen_b", low: "codeling_teen_c", secret_best: "codeling_teen_a", secret_worst: "codeling_teen_c" },
        adult: { best: "codeling_adult_a", mid: "codeling_adult_b", low: "codeling_adult_c", secret_best: "codeling_adult_a", secret_worst: "codeling_adult_c" },
        senior: { best: "codeling_senior_a", mid: "codeling_senior_b", low: "codeling_senior_c", secret_best: "codeling_senior_a", secret_worst: "codeling_senior_c" },
    },
    bytebug: {
        baby: { best: "bytebug_baby_a", mid: "bytebug_baby_b", low: "bytebug_baby_c", secret_best: "bytebug_baby_a", secret_worst: "bytebug_baby_c" },
        child: { best: "bytebug_child_a", mid: "bytebug_child_b", low: "bytebug_child_c", secret_best: "bytebug_child_a", secret_worst: "bytebug_child_c" },
        teen: { best: "bytebug_teen_a", mid: "bytebug_teen_b", low: "bytebug_teen_c", secret_best: "bytebug_teen_a", secret_worst: "bytebug_teen_c" },
        adult: { best: "bytebug_adult_a", mid: "bytebug_adult_b", low: "bytebug_adult_c", secret_best: "bytebug_adult_a", secret_worst: "bytebug_adult_c" },
        senior: { best: "bytebug_senior_a", mid: "bytebug_senior_b", low: "bytebug_senior_c", secret_best: "bytebug_senior_a", secret_worst: "bytebug_senior_c" },
    },
    pixelpup: {
        baby: { best: "pixelpup_baby_a", mid: "pixelpup_baby_b", low: "pixelpup_baby_c", secret_best: "pixelpup_baby_a", secret_worst: "pixelpup_baby_c" },
        child: { best: "pixelpup_child_a", mid: "pixelpup_child_b", low: "pixelpup_child_c", secret_best: "pixelpup_child_a", secret_worst: "pixelpup_child_c" },
        teen: { best: "pixelpup_teen_a", mid: "pixelpup_teen_b", low: "pixelpup_teen_c", secret_best: "pixelpup_teen_a", secret_worst: "pixelpup_teen_c" },
        adult: { best: "pixelpup_adult_a", mid: "pixelpup_adult_b", low: "pixelpup_adult_c", secret_best: "pixelpup_adult_a", secret_worst: "pixelpup_adult_c" },
        senior: { best: "pixelpup_senior_a", mid: "pixelpup_senior_b", low: "pixelpup_senior_c", secret_best: "pixelpup_senior_a", secret_worst: "pixelpup_senior_c" },
    },
    shellscript: {
        baby: { best: "shellscript_baby_a", mid: "shellscript_baby_b", low: "shellscript_baby_c", secret_best: "shellscript_baby_a", secret_worst: "shellscript_baby_c" },
        child: { best: "shellscript_child_a", mid: "shellscript_child_b", low: "shellscript_child_c", secret_best: "shellscript_child_a", secret_worst: "shellscript_child_c" },
        teen: { best: "shellscript_teen_a", mid: "shellscript_teen_b", low: "shellscript_teen_c", secret_best: "shellscript_teen_a", secret_worst: "shellscript_teen_c" },
        adult: { best: "shellscript_adult_a", mid: "shellscript_adult_b", low: "shellscript_adult_c", secret_best: "shellscript_adult_a", secret_worst: "shellscript_adult_c" },
        senior: {
            best: "shellscript_senior_a",
            mid: "shellscript_senior_b",
            low: "shellscript_senior_c",
            secret_best: "shellscript_senior_a",
            secret_worst: "shellscript_senior_c",
        },
    },
};
/** Every AttentionCallType, for code that needs to list them at runtime. */
export const ATTENTION_CALL_TYPES = [
    "hunger", "unhappiness", "poop", "sick", "low_energy", "misbehaviour",
    "gift", "critical_health", "play", "pat", "craving", "break",
];
// ---------------------------------------------------------------------------
// Helper — pure stat math
// ---------------------------------------------------------------------------
/**
 * Clamp a value to the closed interval [minimum, maximum].
 *
 * @param value - The value to clamp.
 * @param minimum - The lower bound (inclusive).
 * @param maximum - The upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}
/**
 * Clamp a standard 0–100 stat.
 *
 * @param value - The stat value to clamp.
 * @returns Value clamped to [STAT_MIN, STAT_MAX].
 */
function clampStat(value) {
    return clamp(value, STAT_MIN, STAT_MAX);
}
/**
 * Clamp weight to its valid range [WEIGHT_MIN, WEIGHT_MAX].
 *
 * @param value - The weight value to clamp.
 * @returns Value clamped to [WEIGHT_MIN, WEIGHT_MAX].
 */
function clampWeight(value) {
    return clamp(value, WEIGHT_MIN, WEIGHT_MAX);
}
/**
 * Logarithmic probability helper for probabilistic attention calls.
 *
 * Returns min(max, base × ln(ticksSinceLast + e)).
 * The probability grows slowly as more ticks pass without the call firing.
 *
 * @param ticksSinceLast - Ticks since the last instance of this event.
 * @param base - Scaling factor (slope of the log curve).
 * @param max - Maximum probability (hard cap).
 * @returns Probability in the range [0, max].
 */
function logChance(ticksSinceLast, base, max) {
    return Math.min(max, base * Math.log(ticksSinceLast + Math.E));
}
/**
 * Decide what a craving call asks for, or null if the pet shouldn't crave now.
 *
 * Asks for a meal instead of a snack once another snack would be risky or
 * impossible (2+ snacks in a row — the next one would count towards
 * MAX_CONSECUTIVE_SNACKS_BEFORE_SICK — or the snack caps are used up), so a
 * craving never asks for something that makes the pet sick. Otherwise it's a
 * 50/50 pick.
 *
 * @param state - Pet state entering the tick (snack counters).
 * @param hunger - Hunger after this tick's decay.
 * @param sick - Sickness after this tick's updates.
 * @returns The craved food, or null when no craving should fire.
 */
function pickCravingFood(state, hunger, sick) {
    if (sick || hunger >= STAT_MAX)
        return null;
    const snackBlocked = state.consecutiveSnacks >= 2 ||
        state.snacksGivenThisCycle >= SNACK_MAX_PER_CYCLE ||
        state.snacksOnFloor >= MAX_FLOOR_SNACKS;
    const mealPointless = hunger >= CRAVING_MEAL_MAX_HUNGER;
    if (snackBlocked)
        return mealPointless ? null : "meal";
    if (mealPointless)
        return "snack";
    return Math.random() < 0.5 ? "snack" : "meal";
}
/**
 * Sample the next poop interval (in ticks) for a given pet type.
 *
 * The interval is drawn from a uniform distribution centred on the type's
 * average interval, with a ± spread determined by `poopIntervalVolatility`:
 *
 *   base = POOP_TICKS_INTERVAL × poopIntervalMultiplier
 *   jitter = base × poopIntervalVolatility
 *   result = uniform(base − jitter, base + jitter), clamped to [1, POOP_TICKS_INTERVAL]
 *
 * A volatility of 0 gives perfectly regular intervals; a volatility of 0.9
 * means the next dropping could arrive almost immediately or be delayed by
 * nearly twice the average.
 *
 * @param petType - The pet type identifier.
 * @returns An integer number of ticks until the next dropping.
 */
export function sampleNextPoopInterval(petType) {
    const mods = PET_TYPE_MODIFIERS[petType] ?? PET_TYPE_MODIFIERS.codeling;
    const base = POOP_TICKS_INTERVAL * mods.poopIntervalMultiplier;
    const jitter = base * mods.poopIntervalVolatility;
    // uniform in [base - jitter, base + jitter]
    const raw = base - jitter + Math.random() * 2 * jitter;
    return Math.max(1, Math.min(POOP_TICKS_INTERVAL, Math.round(raw)));
}
// ---------------------------------------------------------------------------
// Derived-field helpers
// ---------------------------------------------------------------------------
/**
 * Derive a mood label from current stats.
 *
 * @param hunger - Current hunger stat.
 * @param happiness - Current happiness stat.
 * @param health - Current health stat.
 * @param sleeping - Whether the pet is sleeping.
 * @returns One of: "sleeping" | "sick" | "sad" | "neutral" | "happy".
 */
export function moodFromStats(hunger, happiness, health, sleeping) {
    if (sleeping) {
        return "sleeping";
    }
    if (health < 30) {
        return "sick";
    }
    if (hunger < HUNGER_CRITICAL_THRESHOLD) {
        return "sad";
    }
    if (happiness < HAPPINESS_CRITICAL_THRESHOLD) {
        return "sad";
    }
    if (happiness >= 70 && hunger >= 50) {
        return "happy";
    }
    return "neutral";
}
/**
 * Return the evolution tier string for the given care score (no mistake override).
 *
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns One of: "best" | "mid" | "low".
 */
export function tierFromCareScore(careScore) {
    if (careScore >= CARE_SCORE_BEST_TIER_THRESHOLD) {
        return "best";
    }
    if (careScore >= CARE_SCORE_MID_TIER_THRESHOLD) {
        return "mid";
    }
    return "low";
}
/**
 * Return the full evolution tier, applying the care-mistakes override on top of
 * the care-score tier.  This is the authoritative function for all evolution
 * character selection.
 *
 * Priority (highest to lowest):
 *   1. secret_worst — lifetimeCareMistakes ≥ CARE_MISTAKE_SECRET_WORST_THRESHOLD
 *   2. secret_best  — careMistakes === 0 AND careScore ≥ CARE_MISTAKE_SECRET_BEST_CARE_SCORE
 *   3. low          — careMistakes > CARE_MISTAKE_MID_MAX  (cap: cannot be best or mid)
 *   4. mid          — careMistakes > CARE_MISTAKE_BEST_MAX AND score tier would be "best"
 *   5. score tier   — otherwise falls through to careScore-derived tier
 *
 * @param careScore           - Per-stage accumulated care score (0.0–1.0).
 * @param careMistakes        - Per-stage mistakes counter (resets on evolution).
 * @param lifetimeCareMistakes - Total lifetime mistakes (never resets).
 * @returns One of: "secret_best" | "secret_worst" | "best" | "mid" | "low".
 */
export function tierFromState(careScore, careMistakes, lifetimeCareMistakes) {
    // Secret worst: lifetime neglect overwhelming enough to unlock the "bad" secret path
    if (lifetimeCareMistakes >= CARE_MISTAKE_SECRET_WORST_THRESHOLD) {
        return "secret_worst";
    }
    // Secret best: flawless stage AND excellent care score
    if (careMistakes === 0 && careScore >= CARE_MISTAKE_SECRET_BEST_CARE_SCORE) {
        return "secret_best";
    }
    // Standard tier with downward cap from per-stage mistakes
    const scoreTier = tierFromCareScore(careScore);
    if (careMistakes > CARE_MISTAKE_MID_MAX) {
        return "low";
    }
    if (careMistakes > CARE_MISTAKE_BEST_MAX && scoreTier === "best") {
        return "mid";
    }
    return scoreTier;
}
/**
 * Resolve the character name for a pet type at a given stage using the full
 * tier resolution (care score + care mistakes + lifetime mistakes).
 *
 * @param petType              - The pet type identifier.
 * @param stage                - The life stage name.
 * @param careScore            - The accumulated care quality score (0.0–1.0).
 * @param careMistakes         - Per-stage mistakes counter.
 * @param lifetimeCareMistakes - Lifetime mistakes counter.
 * @returns The character name string.
 */
export function characterForStage(petType, stage, careScore, careMistakes = 0, lifetimeCareMistakes = 0) {
    const tier = tierFromState(careScore, careMistakes, lifetimeCareMistakes);
    return EVOLUTION_CHARACTERS[petType][stage][tier];
}
/**
 * Compute the weighted care quality score for a state.
 *
 * Returns 0.5 (neutral) if no ticks have been accumulated yet.
 *
 * @param state - The pet state to evaluate.
 * @returns Care score in the range 0.0–1.0.
 */
export function computeCareScore(state) {
    if (state.careScoreTicks === 0) {
        return 0.5;
    }
    const averageHunger = state.careScoreHungerSum / state.careScoreTicks;
    const averageHappiness = state.careScoreHappinessSum / state.careScoreTicks;
    const averageHealth = state.careScoreHealthSum / state.careScoreTicks;
    const cleanlinessNormalised = clampStat(100 - state.poops * 20) / STAT_MAX;
    return (CARE_SCORE_HUNGER_WEIGHT * (averageHunger / STAT_MAX) +
        CARE_SCORE_HAPPINESS_WEIGHT * (averageHappiness / STAT_MAX) +
        CARE_SCORE_DISCIPLINE_WEIGHT * (state.discipline / STAT_MAX) +
        CARE_SCORE_CLEANLINESS_WEIGHT * cleanlinessNormalised +
        CARE_SCORE_HEALTH_WEIGHT * (averageHealth / STAT_MAX));
}
/**
 * Return a human-readable care tier label for a given care score.
 *
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns One of: "Excellent" | "Good" | "Poor".
 */
export function careTierLabel(careScore) {
    const tier = tierFromCareScore(careScore);
    const labels = { best: "Excellent", mid: "Good", low: "Poor" };
    return labels[tier];
}
// ---------------------------------------------------------------------------
// Sprite type — randomly assigned at hatch
// ---------------------------------------------------------------------------
/**
 * Animals in the random rotation pool at pet creation.
 * All entries have equal probability (1 / ROTATION_ANIMALS.length each).
 * Note: some rotation animals (dog, snake, sheep) are also zodiac animals —
 * they remain accessible via zodiac character codes too.
 */
export const ROTATION_ANIMALS = [
    "cat", "dog", "snake", "sheep", "classic",
    "kangaroo", "dragon",
];
/**
 * Sample a random sprite type at pet creation.
 * Each entry in ROTATION_ANIMALS has equal probability.
 */
export function randomSpriteType() {
    return ROTATION_ANIMALS[Math.floor(Math.random() * ROTATION_ANIMALS.length)];
}
// ---------------------------------------------------------------------------
// Factory — create a new pet
// ---------------------------------------------------------------------------
/**
 * Create a brand-new pet state at stage "egg" with default stats.
 *
 * @param name - The player-chosen name for the pet.
 * @param petType - One of the valid pet type identifiers.
 * @param unlockedCharacter - spriteType of a custom character to force (e.g. "tim"), or null for random.
 *   When provided, the forced name must be resolved by the caller or registry before passing `name`.
 * @param trainer - The previous pet's trainer progress, so XP and achievements carry over; null starts fresh.
 * @returns A freshly initialised PetState.
 */
export function createPet(name, petType, unlockedCharacter = null, trainer = null) {
    const modifiers = PET_TYPE_MODIFIERS[petType] ?? PET_TYPE_MODIFIERS.codeling;
    const baseHealth = modifiers.baseHealth;
    const resolvedName = name;
    const resolvedSprite = unlockedCharacter ?? randomSpriteType();
    const partial = {
        name: resolvedName,
        petType,
        spriteType: resolvedSprite,
        hunger: 50,
        happiness: 50,
        discipline: 50,
        energy: 100,
        health: baseHealth,
        weight: 40,
        ageDays: 0,
        stage: "egg",
        character: "",
        alive: true,
        sick: false,
        sleeping: false,
        ticksAlive: 0,
        poops: 0,
        ticksSinceLastPoop: 0,
        nextPoopIntervalTicks: sampleNextPoopInterval(petType),
        consecutiveSnacks: 0,
        hungerZeroTicks: 0,
        medicineDosesGiven: 0,
        careScoreHungerSum: 0,
        careScoreHappinessSum: 0,
        careScoreHealthSum: 0,
        careScoreTicks: 0,
        events: [],
        recentEventLog: [],
        wasIdle: false,
        wasDeepIdle: false,
        spawnedAt: Date.now(),
        diedAt: 0,
        snacksGivenThisCycle: 0,
        snacksOnFloor: 0,
        paused: false,
        dayTimer: 0,
        activeAttentionCall: null,
        attentionCallActiveTicks: 0,
        attentionCallCooldowns: {},
        careMistakes: 0,
        lifetimeCareMistakes: 0,
        ticksWithUncleanedPoop: 0,
        poopOverLimitTicks: 0,
        ticksSinceLastMisbehaviour: 0,
        ticksSinceLastGift: 0,
        ticksSinceLastPlayCall: 0,
        ticksSinceLastPatCall: 0,
        ticksSinceLastCraving: 0,
        ticksSinceLastBreakCall: 0,
        breakNapTicksRemaining: 0,
        cravingFood: null,
        devModeEverUsed: false,
        leaderboardIneligible: "",
        schemaVersion: SCHEMA_VERSION,
        petXp: 0,
        petLevel: 1,
        trainer: trainer ?? createTrainer(),
        dailies: createDailies(),
    };
    return withDerivedFields(partial);
}
// ---------------------------------------------------------------------------
// Internal — attach derived fields (mood, sprite, careScore)
// ---------------------------------------------------------------------------
/**
 * Attach derived display fields to a partial state object.
 *
 * @param partial - State without mood, sprite, or careScore.
 * @returns Complete PetState with all derived fields populated.
 */
function withDerivedFields(partial) {
    const careScore = computeCareScore(partial);
    const mood = moodFromStats(partial.hunger, partial.happiness, partial.health, partial.sleeping);
    const sprite = `${partial.stage}_${mood}`;
    // Append current events to the rolling log (capped at RECENT_EVENT_LOG_MAX)
    // Silent events (display-suppressed) are excluded from the persistent log.
    const SILENT_EVENTS = new Set(["game_paused", "game_resumed", "snack_placed"]);
    const loggableEvents = partial.events.filter(e => !SILENT_EVENTS.has(e));
    const newLog = loggableEvents.length > 0
        ? [...partial.recentEventLog, ...loggableEvents].slice(-RECENT_EVENT_LOG_MAX)
        : partial.recentEventLog;
    return { ...partial, careScore: Math.round(careScore * 10000) / 10000, mood, sprite, recentEventLog: newLog };
}
// ---------------------------------------------------------------------------
// Weight tier helpers
// ---------------------------------------------------------------------------
/**
 * Return the weight tier for a given weight value.
 *  0 = too skinny (<17), 1 = normal (17–50), 2 = slightly fat (51–80), 3 = overweight (>80)
 */
function weightTierOf(w) {
    if (w > WEIGHT_OVERWEIGHT_THRESHOLD) {
        return 3;
    }
    if (w > WEIGHT_SLIGHTLY_FAT_THRESHOLD) {
        return 2;
    }
    if (w < WEIGHT_HAPPINESS_LOW_THRESHOLD) {
        return 0;
    }
    return 1;
}
/**
 * Compare the weight tiers before and after a change and push crossing events
 * onto the provided events array.
 */
function checkWeightTierEvents(prev, next, events) {
    const pt = weightTierOf(prev);
    const nt = weightTierOf(next);
    if (pt === nt) {
        return;
    }
    if (nt === 3) {
        events.push("weight_became_overweight");
    }
    else if (nt === 2 && pt < 2) {
        events.push("weight_became_slightly_fat");
    }
    else if (nt === 0) {
        events.push("weight_became_too_skinny");
    }
    else if (pt === 3) {
        events.push("weight_no_longer_overweight");
    }
    else if (pt === 0) {
        events.push("weight_no_longer_too_skinny");
    }
}
// ---------------------------------------------------------------------------
// Tick — advance game state by one step
// ---------------------------------------------------------------------------
/**
 * Advance the pet's game state by one tick (TICK_INTERVAL_SECONDS real seconds).
 *
 * Applies:
 *  - Stat decay (hunger, happiness while awake; energy regen while sleeping)
 *  - Poop accumulation
 *  - Sickness from a dirty environment
 *  - Starvation health damage
 *  - Happiness-critical health drain
 *  - Sickness health drain
 *  - Death check
 *  - Care-score accumulation
 *  - Stage progression
 *
 * @param state - The current pet state.
 * @returns A new PetState after one tick.
 */
export function tick(state, isIdle = false, isDeepIdle = false, config = DEFAULT_GAME_CONFIG) {
    const next = tickCore(state, isIdle, isDeepIdle, config);
    return next.events.some((e) => e.startsWith("evolved_to_")) ? awardXp(next, "evolve") : next;
}
function tickCore(state, isIdle, isDeepIdle, config) {
    if (!state.alive) {
        return state;
    }
    if (state.paused) {
        return state.events.length > 0 ? { ...state, events: [] } : state;
    }
    // Any tick in dev mode (faster aging, health floor) bars this pet from the leaderboard for life.
    if (config.devMode && !state.devModeEverUsed) {
        state = { ...state, devModeEverUsed: true };
    }
    const modifiers = PET_TYPE_MODIFIERS[state.petType] ?? PET_TYPE_MODIFIERS.codeling;
    if (state.breakNapTicksRemaining > 0) {
        return tickBreakNap(state, isIdle, isDeepIdle, config, modifiers);
    }
    const events = [];
    let hunger = state.hunger;
    let happiness = state.happiness;
    let energy = state.energy;
    let health = state.health;
    let weight = state.weight;
    let poops = state.poops;
    let ticksSinceLastPoop = state.ticksSinceLastPoop;
    let nextPoopIntervalTicks = state.nextPoopIntervalTicks;
    let hungerZeroTicks = state.hungerZeroTicks;
    let sick = state.sick;
    let tookDamageThisTick = false;
    let alive = state.alive;
    let sleeping = state.sleeping;
    let ageDays = state.ageDays;
    const ticksAlive = state.ticksAlive + 1;
    // Attention call mutable state
    let activeAttentionCall = state.activeAttentionCall;
    let attentionCallActiveTicks = state.attentionCallActiveTicks;
    let attentionCallCooldowns = { ...state.attentionCallCooldowns };
    let careMistakes = state.careMistakes;
    let lifetimeCareMistakes = state.lifetimeCareMistakes;
    let ticksWithUncleanedPoop = state.ticksWithUncleanedPoop;
    let poopOverLimitTicks = state.poopOverLimitTicks;
    let ticksSinceLastMisbehaviour = state.ticksSinceLastMisbehaviour;
    let ticksSinceLastGift = state.ticksSinceLastGift;
    let ticksSinceLastPlayCall = state.ticksSinceLastPlayCall;
    let ticksSinceLastPatCall = state.ticksSinceLastPatCall;
    let ticksSinceLastCraving = state.ticksSinceLastCraving;
    let ticksSinceLastBreakCall = state.ticksSinceLastBreakCall;
    let cravingFood = state.cravingFood;
    // Capture sleeping state at tick entry so day-timer uses it even if auto-wake fires mid-tick
    const sleepingAtTickStart = sleeping;
    // Stat decay — each stat fires on its own tick interval derived from its multiplier.
    // Base interval: DECAY_TICK_INTERVAL ticks (every 9 real-world seconds at 3s/tick).
    // A higher multiplier shortens the interval (faster decay); lower multiplier lengthens it.
    // Idle: each stat's effective interval is scaled up by IDLE_DECAY_TICK_DIVISOR (same proportional slowdown).
    // Aging uses the shared decayThisTick gate (unaffected by per-type multipliers).
    const weightHappinessMult = (state.weight > WEIGHT_HAPPINESS_HIGH_THRESHOLD || state.weight < WEIGHT_HAPPINESS_LOW_THRESHOLD)
        ? WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER : 1.0;
    const hungerInterval = Math.round(DECAY_TICK_INTERVAL / modifiers.hungerDecayMultiplier);
    const happinessInterval = Math.round(DECAY_TICK_INTERVAL / (modifiers.happinessDecayMultiplier * weightHappinessMult));
    const energyInterval = DECAY_TICK_INTERVAL; // energy has no per-type multiplier
    const hungerDecayTick = !isIdle
        ? (ticksAlive % hungerInterval === 0)
        : (ticksAlive % (hungerInterval * IDLE_DECAY_TICK_DIVISOR) === 0);
    const happinessDecayTick = !isIdle
        ? (ticksAlive % happinessInterval === 0)
        : (ticksAlive % (happinessInterval * IDLE_DECAY_TICK_DIVISOR) === 0);
    const energyDecayTick = !isIdle
        ? (ticksAlive % energyInterval === 0)
        : (ticksAlive % (energyInterval * IDLE_DECAY_TICK_DIVISOR) === 0);
    // Shared gate for aging (unaffected by per-type multipliers).
    // Uses AGING_TICK_INTERVAL (3 ticks = 9 s) which is independent of the
    // stat-decay interval so the two rates can be tuned separately.
    const decayThisTick = (ticksAlive % AGING_TICK_INTERVAL === 0) &&
        (!isIdle || (ticksAlive % IDLE_DECAY_TICK_DIVISOR === 0));
    if (!state.wasIdle && isIdle) {
        events.push("went_idle");
    }
    if (!state.wasDeepIdle && isDeepIdle) {
        events.push("went_deep_idle");
    }
    if (config.attentionCallsEnabled) {
        // ── Step 0: Maintain log counters (active ticks only) ────────────────────
        // Idle time doesn't raise the chance of a call, so the pet can't build up a
        // burst of calls while the user is away.
        const activeTick = !isIdle && !isDeepIdle;
        if (poops === 0) {
            ticksWithUncleanedPoop = 0;
        }
        else if (activeTick) {
            ticksWithUncleanedPoop += 1;
        }
        if (activeTick) {
            ticksSinceLastMisbehaviour += 1;
            ticksSinceLastGift += 1;
            ticksSinceLastPlayCall += 1;
            ticksSinceLastPatCall += 1;
            ticksSinceLastCraving += 1;
            if (!sleeping) {
                ticksSinceLastBreakCall += 1;
            }
        }
    } // end Step 0
    if (!sleeping) {
        if (hungerDecayTick)
            hunger = clampStat(hunger - 1);
        if (happinessDecayTick)
            happiness = clampStat(happiness - 1);
        // Energy uses a fixed interval (no per-type multiplier) — throttled by idle (BUGFIX-014)
        if (energyDecayTick)
            energy = clampStat(energy - ENERGY_DECAY_PER_TICK);
    }
    else {
        const energyRegen = ENERGY_REGEN_PER_TICK_SLEEPING * modifiers.energyRegenMultiplier;
        energy = clampStat(energy + energyRegen);
        // BUGFIX-003: auto-wake when energy is fully restored
        if (energy >= STAT_MAX) {
            sleeping = false;
            events.push("auto_woke_up");
        }
        // Very slow hunger/happiness drain while asleep (1 pt every SLEEP_DECAY_TICK_INTERVAL ticks)
        if (sleeping && ticksAlive % SLEEP_DECAY_TICK_INTERVAL === 0) {
            hunger = clampStat(hunger - 1);
            happiness = clampStat(happiness - 1);
        }
        // Random chance to recover from sickness while sleeping
        if (sleeping && sick && Math.random() < SLEEP_SICK_RECOVERY_CHANCE) {
            sick = false;
            events.push("recovered_while_sleeping");
        }
    }
    // Advance day timer — use sleepingAtTickStart to avoid mid-tick flip affecting the rate.
    // When idle, aging is slowed (same divisor as hunger/happiness decay).
    // When deep idle, aging stops entirely.
    // When devMode is active, aging is additionally multiplied by devModeAgingMultiplier.
    const devAgingMult = config.devMode ? config.devModeAgingMultiplier : 1.0;
    const ageIncrement = (!isDeepIdle && decayThisTick)
        ? (sleepingAtTickStart ? 1 / TICKS_PER_GAME_DAY_SLEEPING : 1 / TICKS_PER_GAME_DAY_AWAKE)
            * modifiers.agingMultiplier * devAgingMult
        : 0;
    const dayTimer = state.dayTimer + ageIncrement;
    ageDays = Math.floor(dayTimer);
    // Time-based care-mistake forgiveness — decrement by 1 every CARE_MISTAKE_FORGIVENESS_DAYS game-days.
    if (Math.floor(dayTimer / CARE_MISTAKE_FORGIVENESS_DAYS) >
        Math.floor(state.dayTimer / CARE_MISTAKE_FORGIVENESS_DAYS)) {
        careMistakes = Math.max(0, careMistakes - 1);
    }
    // Poop accumulation — interval is per-type and resampled with high volatility.
    // Suppressed during any idle state (regular idle, deep idle) so the pet never
    // poops when the user is away from the IDE.
    if (!sleeping && !isIdle) {
        ticksSinceLastPoop += 1;
        if (ticksSinceLastPoop >= nextPoopIntervalTicks) {
            poops += 1;
            ticksSinceLastPoop = 0;
            // Resample the next interval so timing is unpredictable
            nextPoopIntervalTicks = sampleNextPoopInterval(state.petType);
            events.push("pooped");
            // Pooping burns weight
            const prevWeightPoop = weight;
            weight = clampWeight(weight - POOP_WEIGHT_LOSS);
            checkWeightTierEvents(prevWeightPoop, weight, events);
        }
    }
    // Passive weight decay — throttled during idle just like hunger/happiness (BUGFIX-033)
    const weightDecayInterval = isIdle
        ? WEIGHT_DECAY_TICK_INTERVAL * IDLE_DECAY_TICK_DIVISOR
        : WEIGHT_DECAY_TICK_INTERVAL;
    if (ticksAlive % weightDecayInterval === 0) {
        const prevWeight = weight;
        weight = clampWeight(weight - 1);
        checkWeightTierEvents(prevWeight, weight, events);
    }
    // Sickness from dirty environment — the pet must sit at or above the poop
    // limit for POOP_SICK_GRACE_TICKS consecutive active ticks first, so cleaning
    // up in time prevents it. The counter is frozen (not reset) while idle or
    // asleep, so the pet cannot be made sick by poop while the user is away.
    if (!isIdle && !isDeepIdle && !sleeping) {
        poopOverLimitTicks = poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK ? poopOverLimitTicks + 1 : 0;
    }
    if (poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK && poopOverLimitTicks >= POOP_SICK_GRACE_TICKS &&
        !sick && !isIdle && !isDeepIdle) {
        sick = true;
        events.push("became_sick");
    }
    // Starvation counter
    if (hunger === STAT_MIN) {
        hungerZeroTicks += 1;
    }
    else {
        hungerZeroTicks = 0;
    }
    // True while any health-damage source below is live (starving, miserable,
    // exhausted or sick). The damage itself is skipped while idle, but the idle
    // stat floor further down still keys off this, so a pet in trouble stops
    // sliding further while the user is away (BUGFIX-177).
    const inDamageState = hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK ||
        (happiness === STAT_MIN && !sleeping) ||
        (energy === STAT_MIN && !sleeping) ||
        sick;
    // Health damage only applies while the user is active (BUG-S02). While idle
    // or deep idle, hunger and happiness still decay slowly so there is something
    // to care for on return, but the pet never loses health. Existing sickness
    // stays (no auto-cure) but does no damage — matching applyOfflineDecay.
    if (!isIdle && !isDeepIdle) {
        // Starvation damage — no longer triggers sickness. Sickness is now only
        // caused by a dirty environment (poop) or overfeeding (snacks), so a pet
        // left hungry takes health damage but must not become "sick" from it.
        if (hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK) {
            health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
            events.push("starvation_damage");
            tookDamageThisTick = true;
        }
        // Happiness-critical health drain — does not cause sickness (see above).
        if (happiness === STAT_MIN && !sleeping) {
            health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
            events.push("unhappiness_damage");
            tookDamageThisTick = true;
        }
        // Energy-exhaustion health drain (slower than hunger/happiness critical)
        if (energy === STAT_MIN && !sleeping) {
            health = clampStat(health - EXHAUSTION_HEALTH_DAMAGE_PER_TICK);
            events.push("exhaustion_damage");
            tookDamageThisTick = true;
        }
        // Sickness health drain.
        if (sick) {
            health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
            events.push("sickness_damage");
            tookDamageThisTick = true;
        }
    }
    // BUGFIX-004: passive health regen — full rate while sleeping, much slower awake
    if (!sick && health < STAT_MAX) {
        if (sleeping) {
            health = clampStat(health + 1);
        }
        else if (ticksAlive % HEALTH_REGEN_AWAKE_TICK_INTERVAL === 0) {
            health = clampStat(health + 1);
        }
    }
    // ── Step 1: Advance active call timer (non-idle ticks only) ────────────────
    if (config.attentionCallsEnabled) {
        if (activeAttentionCall !== null && !isIdle) {
            attentionCallActiveTicks += 1;
            // poop / misbehaviour / gift and the whim calls (play / pat / craving) use the
            // configurable expiry window; all other call types use the fixed 1-minute (20-tick) window.
            const expiryTicks = (activeAttentionCall === "poop" ||
                activeAttentionCall === "misbehaviour" ||
                activeAttentionCall === "gift" ||
                activeAttentionCall === "play" ||
                activeAttentionCall === "pat" ||
                activeAttentionCall === "craving" ||
                activeAttentionCall === "break")
                ? config.attentionCallExpiryTicks
                : ATTENTION_CALL_RESPONSE_TICKS;
            if (attentionCallActiveTicks >= expiryTicks) {
                // Call expired — apply stat penalty
                const expiredType = activeAttentionCall;
                events.push(`attention_call_expired_${expiredType}`);
                switch (expiredType) {
                    case "critical_health":
                        health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY);
                        happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY);
                        break;
                    case "sick":
                        health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY);
                        break;
                    // An ignored poop call is a care mistake (counted below); it only makes
                    // the pet sick if the poop pile is already over the sickness limit.
                    case "poop":
                        if (!sick && poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK) {
                            sick = true;
                            events.push("became_sick");
                        }
                        break;
                    case "hunger":
                        hunger = clampStat(hunger - ATTENTION_EXPIRY_STAT_PENALTY);
                        break;
                    case "unhappiness":
                        happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY);
                        break;
                    case "misbehaviour":
                        health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY);
                        careMistakes += 1;
                        lifetimeCareMistakes += 1;
                        break;
                    case "low_energy":
                        happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY);
                        break;
                    case "gift":
                        happiness = clampStat(happiness - 5);
                        careMistakes += 1;
                        lifetimeCareMistakes += 1;
                        break;
                    case "play":
                    case "pat":
                        health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY);
                        break;
                    case "craving":
                        health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY);
                        cravingFood = null;
                        break;
                    case "break": break; // just a reminder — no penalty for skipping it
                }
                // General care mistake increment (except misbehaviour and gift which have their own
                // above, and break, which is never a care mistake)
                if (expiredType !== "misbehaviour" && expiredType !== "gift" && expiredType !== "break") {
                    careMistakes += 1;
                    lifetimeCareMistakes += 1;
                }
                attentionCallCooldowns[expiredType] = ATTENTION_EXPIRY_COOLDOWN_TICKS;
                activeAttentionCall = null;
                attentionCallActiveTicks = 0;
            }
        }
        // ── Step 2: Decrement all cooldowns (non-idle ticks only) ──────────────────
        // Idle time doesn't count towards a cooldown, so a pet can't save up calls
        // while the user is away and fire them all the moment they return.
        if (!isIdle && !isDeepIdle) {
            for (const type of Object.keys(attentionCallCooldowns)) {
                const remaining = (attentionCallCooldowns[type] ?? 0) - 1;
                attentionCallCooldowns[type] = Math.max(0, remaining);
            }
        }
        // ── Step 3: Fire new call if none active ────────────────────────────────────
        // Compute mood for gift condition (uses post-decay stats)
        const currentMood = moodFromStats(hunger, happiness, health, sleeping);
        if (activeAttentionCall === null) {
            const cooldownClear = (t) => !(attentionCallCooldowns[t] ?? 0);
            const rd = config.attentionCallRateDivisor;
            let cravingPick = null;
            // Poop call fires even while sleeping (poops accumulate regardless), but
            // not while the user is idle — it could never expire and nobody is there
            // to answer it. All other calls are suppressed while the pet is asleep.
            if (poops >= 1 && !isIdle && !isDeepIdle && cooldownClear("poop") &&
                Math.random() < logChance(ticksWithUncleanedPoop, POOP_CALL_BASE_CHANCE / rd, POOP_CALL_MAX_CHANCE / rd)) {
                activeAttentionCall = "poop";
                attentionCallActiveTicks = 0;
                events.push("attention_call_poop");
            }
            else if (!sleeping && health <= ATTENTION_HEALTH_THRESHOLD && cooldownClear("critical_health")) {
                activeAttentionCall = "critical_health";
                attentionCallActiveTicks = 0;
                events.push("attention_call_critical_health");
            }
            else if (!sleeping && sick && cooldownClear("sick")) {
                activeAttentionCall = "sick";
                attentionCallActiveTicks = 0;
                events.push("attention_call_sick");
            }
            else if (!sleeping && hunger <= ATTENTION_HUNGER_THRESHOLD && cooldownClear("hunger")) {
                activeAttentionCall = "hunger";
                attentionCallActiveTicks = 0;
                events.push("attention_call_hunger");
            }
            else if (!sleeping && happiness <= ATTENTION_UNHAPPINESS_THRESHOLD && cooldownClear("unhappiness")) {
                activeAttentionCall = "unhappiness";
                attentionCallActiveTicks = 0;
                events.push("attention_call_unhappiness");
            }
            else if (!sleeping && !isIdle && !isDeepIdle && cooldownClear("misbehaviour") &&
                Math.random() < logChance(ticksSinceLastMisbehaviour, MISBEHAVIOUR_BASE_CHANCE / rd, MISBEHAVIOUR_MAX_CHANCE / rd)) {
                activeAttentionCall = "misbehaviour";
                attentionCallActiveTicks = 0;
                ticksSinceLastMisbehaviour = 0;
                events.push("attention_call_misbehaviour");
            }
            else if (!sleeping && energy <= ATTENTION_ENERGY_THRESHOLD && cooldownClear("low_energy")) {
                activeAttentionCall = "low_energy";
                attentionCallActiveTicks = 0;
                events.push("attention_call_low_energy");
                // Break reminder — every 30 active minutes, after the real needs but before the whims
            }
            else if (!sleeping && !isIdle && !isDeepIdle && cooldownClear("break") &&
                ticksSinceLastBreakCall >= BREAK_CALL_INTERVAL_TICKS) {
                activeAttentionCall = "break";
                attentionCallActiveTicks = 0;
                events.push("attention_call_break");
                // Whim calls — random, at any stat level, after every need-based call so a
                // real need always wins. Not while idle: nobody is there to answer them.
            }
            else if (!sleeping && !isIdle && !isDeepIdle && cooldownClear("craving") &&
                Math.random() < logChance(ticksSinceLastCraving, CRAVING_CALL_BASE_CHANCE / rd, CRAVING_CALL_MAX_CHANCE / rd) &&
                (cravingPick = pickCravingFood(state, hunger, sick)) !== null) {
                activeAttentionCall = "craving";
                attentionCallActiveTicks = 0;
                ticksSinceLastCraving = 0;
                cravingFood = cravingPick;
                events.push(`attention_call_craving_${cravingPick}`);
            }
            else if (!sleeping && !isIdle && !isDeepIdle && cooldownClear("play") &&
                energy >= PLAY_ENERGY_COST && !sick &&
                Math.random() < logChance(ticksSinceLastPlayCall, PLAY_CALL_BASE_CHANCE / rd, PLAY_CALL_MAX_CHANCE / rd)) {
                activeAttentionCall = "play";
                attentionCallActiveTicks = 0;
                ticksSinceLastPlayCall = 0;
                events.push("attention_call_play");
            }
            else if (!sleeping && !isIdle && !isDeepIdle && cooldownClear("pat") &&
                energy >= PAT_ENERGY_COST &&
                Math.random() < logChance(ticksSinceLastPatCall, PAT_CALL_BASE_CHANCE / rd, PAT_CALL_MAX_CHANCE / rd)) {
                activeAttentionCall = "pat";
                attentionCallActiveTicks = 0;
                ticksSinceLastPatCall = 0;
                events.push("attention_call_pat");
            }
            else if (!sleeping && !isIdle && !isDeepIdle && cooldownClear("gift") &&
                health > ATTENTION_HEALTH_THRESHOLD &&
                !sick &&
                (currentMood === "happy" || currentMood === "neutral") &&
                Math.random() < logChance(ticksSinceLastGift, GIFT_BASE_CHANCE / rd, GIFT_MAX_CHANCE / rd)) {
                activeAttentionCall = "gift";
                attentionCallActiveTicks = 0;
                ticksSinceLastGift = 0;
                events.push("attention_call_gift");
            }
        }
    } // end if (config.attentionCallsEnabled)
    // Idle safety floor — applied last, after every stat-decay and damage block
    // above, so a same-tick damage source can never slip through.
    //  • Health never falls below its value entering this tick while idle
    //    (BUG-S02) — the damage blocks above are already gated, this is the net.
    //  • When sick or in any other damage state (starving, miserable, exhausted),
    //    hunger/happiness/energy stop decaying at IDLE_STAT_FLOOR. The damage
    //    blocks are skipped while idle, so this keys off inDamageState rather
    //    than damage actually taken. The floor is capped at each stat's value
    //    entering this tick, so a stat already below IDLE_STAT_FLOOR is never
    //    raised back up.
    if (isIdle || isDeepIdle) {
        health = Math.max(health, state.health);
        if (inDamageState || tookDamageThisTick) {
            hunger = Math.max(hunger, Math.min(state.hunger, IDLE_STAT_FLOOR));
            happiness = Math.max(happiness, Math.min(state.happiness, IDLE_STAT_FLOOR));
            energy = Math.max(energy, Math.min(state.energy, IDLE_STAT_FLOOR));
        }
        // Drop any damage events pushed earlier this tick so idle logging /
        // notifications don't claim the pet is losing health when it isn't.
        for (let i = events.length - 1; i >= 0; i--) {
            if (HEALTH_DAMAGE_EVENTS.has(events[i]))
                events.splice(i, 1);
        }
    }
    // Dev mode: configurable health floor — prevents death from stat decay or old age
    // when devModeHealthFloor > 0 (default 1). Set floor to 0 to allow death in dev mode.
    if (config.devMode && health <= config.devModeHealthFloor) {
        health = config.devModeHealthFloor;
    }
    // Immortal pets never drop below 1 health, so the bar never reads "0" while alive.
    if (config.immortal && health < 1) {
        health = 1;
    }
    // Death check
    if (!config.immortal && health <= HEALTH_DEATH_THRESHOLD) {
        alive = false;
        events.push("died");
        return withDerivedFields({
            ...state,
            hunger, happiness, energy, health, poops, ticksSinceLastPoop,
            nextPoopIntervalTicks,
            hungerZeroTicks, sick, alive: alive, diedAt: Date.now(), ticksAlive, events,
            sleeping, ageDays, dayTimer, weight,
            activeAttentionCall, attentionCallActiveTicks, attentionCallCooldowns,
            careMistakes, lifetimeCareMistakes, ticksWithUncleanedPoop, poopOverLimitTicks, ticksSinceLastMisbehaviour, ticksSinceLastGift,
            ticksSinceLastPlayCall, ticksSinceLastPatCall, ticksSinceLastCraving, ticksSinceLastBreakCall, cravingFood,
        });
    }
    // Care-score accumulation
    const careScoreHungerSum = state.careScoreHungerSum + hunger;
    const careScoreHappinessSum = state.careScoreHappinessSum + happiness;
    const careScoreHealthSum = state.careScoreHealthSum + health;
    const careScoreTicks = state.careScoreTicks + 1;
    const afterDecay = {
        ...state,
        hunger, happiness, energy, health, weight, poops, ticksSinceLastPoop,
        nextPoopIntervalTicks,
        hungerZeroTicks, sick, alive, ticksAlive, sleeping, ageDays, dayTimer,
        careScoreHungerSum, careScoreHappinessSum, careScoreHealthSum, careScoreTicks,
        events,
        // Reset snack counter on auto-wake (mirrors the reset in wake())
        snacksGivenThisCycle: events.includes("auto_woke_up") ? 0 : state.snacksGivenThisCycle,
        wasIdle: isIdle,
        wasDeepIdle: isDeepIdle,
        activeAttentionCall,
        attentionCallActiveTicks,
        attentionCallCooldowns,
        careMistakes,
        lifetimeCareMistakes,
        ticksWithUncleanedPoop,
        poopOverLimitTicks,
        ticksSinceLastMisbehaviour,
        ticksSinceLastGift,
        ticksSinceLastPlayCall,
        ticksSinceLastPatCall,
        ticksSinceLastCraving,
        ticksSinceLastBreakCall,
        cravingFood,
    };
    // Stage progression + old-age death/sickness rolls (once per day boundary for seniors).
    // Evolution only fires on active (non-idle) ticks so the user is present to witness it;
    // dayTimer keeps accumulating while idle (see aging above), so once the threshold is
    // reached while idle the promotion is simply deferred — not lost — to the next active tick.
    const afterStage = isIdle ? withDerivedFields(afterDecay) : checkStageProgression(afterDecay);
    // ageDays is Math.floor(new dayTimer), computed above; state.ageDays is pre-tick value.
    // Skipped while idle so a senior can never die of old age while the user is away.
    if (ageDays > state.ageDays && !config.immortal && !isIdle && !isDeepIdle) {
        const afterDeath = rollOldAgeDeath(afterStage, Math.random());
        return afterDeath.alive ? rollOldAgeSickness(afterDeath, Math.random()) : afterDeath;
    }
    return afterStage;
}
/**
 * One tick of a break nap: every stat, counter and attention-call timer is frozen
 * except energy, which regenerates at the sleeping rate (no auto-wake at full energy).
 * The pet keeps aging at the sleeping rate — even while the user is idle, since they
 * are away on their break. Wakes the pet when the timer runs out.
 */
function tickBreakNap(state, isIdle, isDeepIdle, config, modifiers) {
    const events = [];
    const ticksAlive = state.ticksAlive + 1;
    const devAgingMult = config.devMode ? config.devModeAgingMultiplier : 1.0;
    const ageIncrement = ticksAlive % AGING_TICK_INTERVAL === 0
        ? (1 / TICKS_PER_GAME_DAY_SLEEPING) * modifiers.agingMultiplier * devAgingMult
        : 0;
    const dayTimer = state.dayTimer + ageIncrement;
    const careMistakes = Math.floor(dayTimer / CARE_MISTAKE_FORGIVENESS_DAYS) >
        Math.floor(state.dayTimer / CARE_MISTAKE_FORGIVENESS_DAYS)
        ? Math.max(0, state.careMistakes - 1) : state.careMistakes;
    const energy = clampStat(state.energy + ENERGY_REGEN_PER_TICK_SLEEPING * modifiers.energyRegenMultiplier);
    const breakNapTicksRemaining = Math.max(0, state.breakNapTicksRemaining - 1);
    const napOver = breakNapTicksRemaining === 0;
    if (napOver) {
        events.push("break_nap_over");
    }
    return withDerivedFields({
        ...state,
        ticksAlive, dayTimer, ageDays: Math.floor(dayTimer), careMistakes,
        energy, breakNapTicksRemaining,
        ...(napOver ? { sleeping: false, snacksGivenThisCycle: 0 } : {}),
        wasIdle: isIdle,
        wasDeepIdle: isDeepIdle,
        events,
    });
}
// ---------------------------------------------------------------------------
// Stage progression (internal)
// ---------------------------------------------------------------------------
/** Map from stage name to the cumulative dayTimer threshold to evolve out of it.
 * Scaled so that real-world evolution timing (in active ticks) is preserved:
 * 1 game day = 50 ticks (5 min awake). */
const EVOLUTION_DAY_THRESHOLDS = {
    egg: 0.267, // ≈ tick 13 for codeling 1× (~2 min awake)
    baby: 5.988, // ≈ tick 300 cumulative for codeling 1× (~30 min)
    child: 23.988, // ≈ tick 1200 cumulative for codeling 1× (~2 hr)
    teen: 95.988, // ≈ tick 4800 cumulative for codeling 1× (~8 hr)
    adult: 287.988, // ≈ tick 14400 cumulative for codeling 1× (~24 hr)
};
/** Map from stage name to the next stage. */
const NEXT_STAGE_MAP = {
    egg: "baby",
    baby: "child",
    child: "teen",
    teen: "adult",
    adult: "senior",
};
/**
 * Promote the pet to the next life stage if its cumulative dayTimer has
 * reached the threshold for the current stage.
 *
 * The effective threshold is extended by CARE_MISTAKE_DAYS_PER_EXCESS game-days
 * for each per-stage care mistake above CARE_MISTAKE_DELAY_THRESHOLD.
 *
 * @param partial - State without derived fields.
 * @returns Complete PetState, evolved if the dayTimer threshold was reached.
 */
function checkStageProgression(partial) {
    const baseThreshold = EVOLUTION_DAY_THRESHOLDS[partial.stage];
    if (baseThreshold === undefined) {
        return withDerivedFields(partial);
    }
    // Apply delay for excess care mistakes, capped at CARE_MISTAKE_DELAY_MAX_DAYS
    const excessMistakes = Math.max(0, partial.careMistakes - CARE_MISTAKE_DELAY_THRESHOLD);
    const rawDelay = excessMistakes * CARE_MISTAKE_DAYS_PER_EXCESS;
    const effectiveThreshold = baseThreshold + Math.min(rawDelay, CARE_MISTAKE_DELAY_MAX_DAYS);
    if (partial.dayTimer < effectiveThreshold) {
        return withDerivedFields(partial);
    }
    const nextStage = NEXT_STAGE_MAP[partial.stage];
    if (nextStage === undefined) {
        return withDerivedFields(partial);
    }
    return evolveTo(partial, nextStage);
}
/**
 * Transition a pet to nextStage, assign a character, and reset per-stage accumulators.
 *
 * careScore and careMistakes are snapshotted NOW to select the character for the
 * new stage.  careScoreHungerSum/…Sum/Ticks and careMistakes are then wiped to zero
 * so the new stage's quality is tracked independently.  lifetimeCareMistakes is
 * preserved and carries forward for the pet's entire life.
 *
 * @param partial - State without derived fields.
 * @param nextStage - The stage to transition into.
 * @returns Complete PetState at the new stage.
 */
function evolveTo(partial, nextStage) {
    // Snapshot care metrics to pick the character tier
    const careScore = computeCareScore(partial);
    const character = nextStage !== "egg"
        ? characterForStage(partial.petType, nextStage, careScore, partial.careMistakes, partial.lifetimeCareMistakes)
        : partial.character;
    const evolved = {
        ...partial,
        stage: nextStage,
        character,
        ticksAlive: 0,
        // Reset per-stage accumulators
        careScoreHungerSum: 0,
        careScoreHappinessSum: 0,
        careScoreHealthSum: 0,
        careScoreTicks: 0,
        careMistakes: 0, // reset for new stage
        // lifetimeCareMistakes intentionally preserved (already in ...partial)
        events: [...partial.events, `evolved_to_${nextStage}`],
    };
    return withDerivedFields(evolved);
}
// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
/**
 * Internal helper: if the given attention call type is currently active, answer
 * it (clear it, push answered event, set answer cooldown) and return the
 * updated partial fields.  Returns null if that call is not active.
 */
function answerAttentionCall(state, callType) {
    if (state.activeAttentionCall !== callType) {
        return null;
    }
    return {
        activeAttentionCall: null,
        attentionCallActiveTicks: 0,
        attentionCallCooldowns: {
            ...state.attentionCallCooldowns,
            [callType]: ATTENTION_ANSWER_COOLDOWN_TICKS,
        },
    };
}
/**
 * Answer an active craving call, but only with the food it asked for — the
 * wrong food still feeds the pet but leaves the call open.
 *
 * @param state - The current pet state.
 * @param food - The food being given.
 * @returns The fields to spread into the new state, or null if not answered.
 */
function answerCraving(state, food) {
    if (state.cravingFood !== food) {
        return null;
    }
    const answered = answerAttentionCall(state, "craving");
    return answered ? { ...answered, cravingFood: null } : null;
}
/**
 * Give the pet a meal.
 *
 * If the cycle cap (opts.maxPerCycle ?? FEED_MEAL_MAX_PER_CYCLE) is exceeded
 * the action is a no-op and a "meal_refused" event is emitted.
 *
 * @param state - The current pet state.
 * @param mealsGivenThisCycle - Meals already given in the current wake cycle.
 * @param opts - Optional per-character overrides.
 * @param opts.maxPerCycle - Feed cap for this character (overrides FEED_MEAL_MAX_PER_CYCLE).
 * @param opts.hungerMult  - Multiplier on the hunger boost for this character (default 1.0).
 * @param opts.weightGain  - Weight gained per meal (overrides FEED_MEAL_WEIGHT_GAIN).
 * @returns A new PetState after the action.
 */
export function feedMeal(state, mealsGivenThisCycle, opts) {
    const cap = opts?.maxPerCycle ?? FEED_MEAL_MAX_PER_CYCLE;
    const hungerBoost = Math.round(FEED_MEAL_HUNGER_BOOST * (opts?.hungerMult ?? 1));
    if (state.sick) {
        return withDerivedFields({ ...state, events: ["meal_refused_sick"] });
    }
    if (mealsGivenThisCycle >= cap) {
        return withDerivedFields({ ...state, events: ["meal_refused"] });
    }
    const newWeight = clampWeight(state.weight + (opts?.weightGain ?? FEED_MEAL_WEIGHT_GAIN));
    const events = ["fed_meal"];
    checkWeightTierEvents(state.weight, newWeight, events);
    // Answers hunger, a meal craving, or critical_health — whichever is active.
    const answered = answerAttentionCall(state, "hunger") ??
        answerCraving(state, "meal") ??
        answerAttentionCall(state, "critical_health");
    if (answered) {
        events.push(`attention_call_answered_${state.activeAttentionCall}`);
    }
    return awardXp(withDerivedFields({
        ...state,
        ...(answered ?? {}),
        hunger: clampStat(state.hunger + hungerBoost),
        weight: newWeight,
        consecutiveSnacks: 0,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events,
    }), "care", Date.now(), answered !== null);
}
/**
 * Register a snack being given to the pet (button-press phase).
 *
 * Validates the per-cycle cap, increments the snack counters, and answers any
 * active hunger/critical_health attention call.  Does NOT yet apply stat
 * effects — those are deferred until the pet physically reaches the snack on
 * the stage (see {@link consumeSnack}).
 *
 * Emits `snack_placed` (triggers the floor-item animation in the webview) or
 * `snack_refused` if the cap has been reached.
 *
 * @param state - The current pet state.
 * @param opts - Optional per-character overrides.
 * @param opts.maxPerCycle - Snack cap for this character (overrides SNACK_MAX_PER_CYCLE).
 * @returns A new PetState after the action.
 */
export function startSnack(state, opts) {
    if (state.sick) {
        return withDerivedFields({ ...state, events: ["snack_refused_sick"] });
    }
    if (state.snacksOnFloor >= MAX_FLOOR_SNACKS) {
        return withDerivedFields({ ...state, events: ["snack_refused"] });
    }
    const cap = opts?.maxPerCycle ?? SNACK_MAX_PER_CYCLE;
    if (state.snacksGivenThisCycle >= cap) {
        return withDerivedFields({ ...state, events: ["snack_refused"] });
    }
    const snacksGivenThisCycle = state.snacksGivenThisCycle + 1;
    const events = ["snack_placed"];
    const answered = answerAttentionCall(state, "hunger") ??
        answerCraving(state, "snack") ??
        answerAttentionCall(state, "critical_health");
    if (answered) {
        events.push(`attention_call_answered_${state.activeAttentionCall}`);
    }
    const next = withDerivedFields({
        ...state,
        ...(answered ?? {}),
        snacksGivenThisCycle,
        snacksOnFloor: state.snacksOnFloor + 1,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events,
    });
    return answered ? awardXp(next, "call") : next;
}
/**
 * Apply the stat effects of a snack once the pet reaches it on the stage.
 *
 * Called when the webview detects the pet touching the snack floor item.
 * Increments `consecutiveSnacks` and — if the new count reaches the maximum
 * — triggers sickness. Ignored (no stat effects, no events, so no toast) if `snacksOnFloor` is
 * already 0 — guards against a stale/duplicate `snack_consumed` report (e.g.
 * a second open editor window sharing the same pet independently simulating
 * the same floor item) applying the effect more than once.
 *
 * @param state - The current pet state.
 * @param opts - Optional per-character overrides.
 * @param opts.hungerMult - Multiplier on the hunger boost (default 1.0).
 * @param opts.weightGain - Weight gained per snack consumed (overrides FEED_SNACK_WEIGHT_GAIN).
 * @returns A new PetState after the action.
 */
export function consumeSnack(state, opts) {
    if (state.snacksOnFloor <= 0) {
        return withDerivedFields({ ...state, events: [] });
    }
    const hungerBoost = Math.round(FEED_SNACK_HUNGER_BOOST * (opts?.hungerMult ?? 1));
    const sickAt = opts?.sickThreshold ?? MAX_CONSECUTIVE_SNACKS_BEFORE_SICK;
    const events = [];
    let sick = state.sick;
    const consecutiveSnacks = state.consecutiveSnacks + 1;
    if (consecutiveSnacks >= sickAt && !sick) {
        sick = true;
        events.push("became_sick");
    }
    events.push("fed_snack");
    const newWeight = clampWeight(state.weight + (opts?.weightGain ?? FEED_SNACK_WEIGHT_GAIN));
    checkWeightTierEvents(state.weight, newWeight, events);
    return awardXp(withDerivedFields({
        ...state,
        hunger: clampStat(state.hunger + hungerBoost),
        happiness: clampStat(state.happiness + FEED_SNACK_HAPPINESS_BOOST),
        weight: newWeight,
        consecutiveSnacks,
        snacksOnFloor: Math.max(0, state.snacksOnFloor - 1),
        sick,
        events,
    }), "snack");
}
/**
 * Zero out the in-flight floor snack counter.
 *
 * Call whenever the webview is reloaded (panel open, config change) so that
 * the engine's count stays in sync with the webview's empty `snackItems[]`.
 */
export function resetFloorSnacks(state) {
    return withDerivedFields({ ...state, snacksOnFloor: 0, events: [] });
}
/**
 * Initiate a play session (stat deltas only; mini-game result is handled by
 * applyMinigameResult separately).
 *
 * Energy must be above zero; if the pet has no energy the action is refused.
 *
 * @param state - The current pet state.
 * @param opts - Optional per-character overrides.
 * @param opts.weightLoss - Weight lost per play session (overrides PLAY_WEIGHT_LOSS).
 * @returns A new PetState after the action.
 */
export function play(state, opts) {
    if (state.sick) {
        return withDerivedFields({ ...state, events: ["play_refused_sick"] });
    }
    if (state.energy < PLAY_ENERGY_COST) {
        return withDerivedFields({ ...state, events: ["play_refused_no_energy"] });
    }
    const newWeight = clampWeight(state.weight - (opts?.weightLoss ?? PLAY_WEIGHT_LOSS));
    const events = ["played"];
    checkWeightTierEvents(state.weight, newWeight, events);
    const answered = answerAttentionCall(state, "play") ?? answerAttentionCall(state, "unhappiness");
    if (answered) {
        events.push(`attention_call_answered_${state.activeAttentionCall}`);
    }
    return awardXp(withDerivedFields({
        ...state,
        ...(answered ?? {}),
        happiness: clampStat(state.happiness + PLAY_HAPPINESS_BOOST),
        energy: clampStat(state.energy - PLAY_ENERGY_COST),
        weight: newWeight,
        consecutiveSnacks: 0,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events,
    }), "care", Date.now(), answered !== null);
}
/**
 * Pat the pet — a gentle interaction that gives a modest happiness boost at a
 * lower energy cost than play. No minigame; just a direct stat change.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function pat(state) {
    if (state.energy < PAT_ENERGY_COST) {
        return withDerivedFields({ ...state, events: ["pat_refused_no_energy"] });
    }
    const newWeight = clampWeight(state.weight - PAT_WEIGHT_LOSS);
    const answered = answerAttentionCall(state, "pat") ?? answerAttentionCall(state, "unhappiness");
    const events = ["patted"];
    checkWeightTierEvents(state.weight, newWeight, events);
    if (answered) {
        events.push(`attention_call_answered_${state.activeAttentionCall}`);
    }
    return awardXp(withDerivedFields({
        ...state,
        ...(answered ?? {}),
        happiness: clampStat(state.happiness + PAT_HAPPINESS_BOOST),
        energy: clampStat(state.energy - PAT_ENERGY_COST),
        weight: newWeight,
        consecutiveSnacks: 0,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events,
    }), "care", Date.now(), answered !== null);
}
/**
 * Apply the stat cost of viewing the token cost overlay: same energy/happiness
 * change as a pat, but no weight, events, or attention-call side effects — the
 * cost bubble is shown separately, so this must not emit a "patted" event that
 * would race it with a reaction bubble (BUGFIX-140).
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function applyTokenCostView(state) {
    return withDerivedFields({
        ...state,
        happiness: clampStat(state.happiness + PAT_HAPPINESS_BOOST),
        energy: clampStat(state.energy - PAT_ENERGY_COST),
        events: [],
    });
}
/**
 * Return the happiness delta for a mini-game outcome.
 *
 * @param game - "guess" (legacy coin-flip), "memory" (Pattern Memory),
 *               "left_right" (Left / Right), "higher_lower" (Higher or Lower),
 *               "coin_flip" (Coin Flip), "blackjack" (Stu's one-round Blackjack) or
 *               "boss_battle" (turn-based Boss Battle).
 * @param result - "win" or "lose" ("push" too for blackjack).
 * @returns A positive integer to add to the pet's happiness stat (0 for coin_flip loss).
 */
export function happinessDeltaForMinigame(game, result) {
    if (game === "left_right") {
        if (result === "win") {
            return Math.floor(Math.random() * (MINIGAME_LR_WIN_MAX - MINIGAME_LR_WIN_MIN + 1)) + MINIGAME_LR_WIN_MIN; // +5–+15
        }
        return MINIGAME_LR_LOSE_DELTA; // −5
    }
    if (game === "higher_lower") {
        if (result === "win") {
            return Math.floor(Math.random() * (MINIGAME_HL_WIN_MAX - MINIGAME_HL_WIN_MIN + 1)) + MINIGAME_HL_WIN_MIN; // +10–+20
        }
        return MINIGAME_HL_LOSE_DELTA; // −5
    }
    if (game === "coin_flip") {
        return result === "win" ? MINIGAME_COIN_FLIP_WIN : MINIGAME_COIN_FLIP_LOSE; // 0 win, −10 lose
    }
    if (game === "blackjack") {
        if (result === "win") {
            return MINIGAME_BLACKJACK_WIN;
        } // +10
        if (result === "push") {
            return MINIGAME_BLACKJACK_PUSH;
        } // 0
        return MINIGAME_BLACKJACK_LOSE; // −10
    }
    if (game === "boss_battle") {
        return result === "win" ? MINIGAME_BOSS_BATTLE_WIN : MINIGAME_BOSS_BATTLE_LOSE; // +10 win, −5 lose
    }
    if (game === "memory" && result === "win") {
        return MINIGAME_MEMORY_WIN_HAPPINESS_BOOST;
    }
    if (result === "win") {
        return MINIGAME_WIN_HAPPINESS_BOOST;
    }
    return MINIGAME_LOSE_HAPPINESS_BOOST;
}
/**
 * Apply a mini-game result happiness delta to the pet state.
 *
 * Also applies an additional weight loss for vigorous mini-games (BUGFIX-034):
 *   - left_right and higher_lower: −3 extra weight (total −6 with play() baseline)
 *   - coin_flip and blackjack: no extra weight loss (total −3 from play() only)
 *
 * @param state - The current pet state.
 * @param game - "left_right", "higher_lower", "coin_flip", "blackjack", "boss_battle", "guess", or "memory".
 * @param result - "win" or "lose" ("push" too for blackjack).
 * @returns A new PetState after the happiness delta is applied. A win awards
 *          "minigame" XP, or "boss_battle" XP for the Boss Battle.
 */
export function applyMinigameResult(state, game, result) {
    const delta = happinessDeltaForMinigame(game, result);
    const isVigorousGame = game === "left_right" || game === "higher_lower";
    const newWeight = isVigorousGame
        ? clampWeight(state.weight - PLAY_WEIGHT_LOSS_BONUS)
        : state.weight;
    // Hosts call this straight after play(): carry over any attention call that
    // play() answered, otherwise its answered event (and toast / log line) is lost.
    const events = [
        ...state.events.filter((e) => e.startsWith("attention_call_answered_")),
        `minigame_${game}_${result}`,
    ];
    if (isVigorousGame) {
        checkWeightTierEvents(state.weight, newWeight, events);
    }
    const next = withDerivedFields({
        ...state,
        happiness: clampStat(state.happiness + delta),
        weight: newWeight,
        events,
    });
    if (result !== "win") {
        return next;
    }
    return awardXp(next, game === "boss_battle" ? "boss_battle" : "minigame");
}
/**
 * Put the pet to sleep.
 *
 * If the pet is already sleeping the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function sleep(state) {
    if (state.sleeping) {
        return withDerivedFields({ ...state, events: ["already_sleeping"] });
    }
    const answered = answerAttentionCall(state, "low_energy");
    const events = ["fell_asleep"];
    if (answered) {
        events.push("attention_call_answered_low_energy");
    }
    const next = withDerivedFields({ ...state, ...(answered ?? {}), sleeping: true,
        consecutiveSnacks: 0,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events });
    return answered ? awardXp(next, "call") : next;
}
/**
 * Wake the pet up.
 *
 * Increments ageDays. If the pet is not sleeping the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function wake(state) {
    if (!state.sleeping) {
        return withDerivedFields({ ...state, events: ["already_awake"] });
    }
    // A break nap can't be cut short — the pet wakes on its own after BREAK_NAP_TICKS.
    if (state.breakNapTicksRemaining > 0) {
        return withDerivedFields({ ...state, events: ["break_nap_no_wake"] });
    }
    return withDerivedFields({
        ...state,
        sleeping: false,
        events: ["woke_up"],
    });
}
/**
 * Remove all droppings.
 *
 * If poops === 0 the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function clean(state) {
    if (state.poops === 0) {
        return withDerivedFields({ ...state, events: ["already_clean"] });
    }
    const answered = answerAttentionCall(state, "poop");
    const events = ["cleaned"];
    if (answered) {
        events.push("attention_call_answered_poop");
    }
    return awardXp(withDerivedFields({
        ...state,
        ...(answered ?? {}),
        poops: 0,
        ticksSinceLastPoop: 0,
        ticksWithUncleanedPoop: 0,
        poopOverLimitTicks: 0,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events,
    }), "clean", Date.now(), answered !== null);
}
/**
 * Administer one dose of medicine.
 *
 * After MEDICINE_DOSES_TO_CURE consecutive doses the pet is cured.
 * Giving medicine to a healthy pet has no effect.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function giveMedicine(state) {
    if (!state.sick) {
        return withDerivedFields({ ...state, events: ["medicine_not_needed"] });
    }
    const medicineDosesGiven = state.medicineDosesGiven + 1;
    const events = ["medicine_given"];
    let sick = state.sick;
    const answered = answerAttentionCall(state, "sick");
    if (answered) {
        events.push("attention_call_answered_sick");
    }
    if (medicineDosesGiven >= MEDICINE_DOSES_TO_CURE) {
        sick = false;
        events.push("cured");
        return awardXp(withDerivedFields({
            ...state,
            ...(answered ?? {}),
            sick: sick,
            medicineDosesGiven: 0,
            consecutiveSnacks: 0,
            careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
            events,
        }), "cure", Date.now(), answered !== null);
    }
    return awardXp(withDerivedFields({ ...state, ...(answered ?? {}), medicineDosesGiven,
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events }), "care", Date.now(), answered !== null);
}
/**
 * Scold the pet to raise discipline.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function scold(state) {
    const answered = answerAttentionCall(state, "misbehaviour");
    const events = ["scolded"];
    if (answered) {
        events.push("attention_call_answered_misbehaviour");
    }
    const next = withDerivedFields({
        ...state,
        ...(answered ?? {}),
        discipline: clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        events,
    });
    // Scold / praise only count as care when they answer a call.
    return answered ? awardXp(next, "care", Date.now(), true) : next;
}
/**
 * Praise the pet to raise discipline.
 * If a "gift" attention call is active, it is answered and a happiness bonus
 * (GIFT_PRAISE_HAPPINESS_BOOST) is applied on top of the discipline boost.
 * If a "break" call is active, it is answered with the same happiness bonus
 * (BREAK_PRAISE_HAPPINESS_BOOST) and the pet takes a BREAK_NAP_TICKS (5-minute)
 * nap while you rest: stats are frozen except energy, aging continues, and it
 * can't be woken early — it wakes on its own.
 * If an "unhappiness" attention call is active, it is answered instead.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function praise(state) {
    const answeredGift = answerAttentionCall(state, "gift");
    const answeredBreak = !answeredGift ? answerAttentionCall(state, "break") : null;
    const answeredUnhappiness = !answeredGift && !answeredBreak ? answerAttentionCall(state, "unhappiness") : null;
    const answered = answeredGift ?? answeredBreak ?? answeredUnhappiness;
    const events = ["praised"];
    if (answeredGift) {
        events.push("attention_call_answered_gift");
    }
    if (answeredBreak) {
        events.push("attention_call_answered_break");
    }
    if (answeredUnhappiness) {
        events.push("attention_call_answered_unhappiness");
    }
    const happinessBonus = answeredGift ? GIFT_PRAISE_HAPPINESS_BOOST
        : answeredBreak ? BREAK_PRAISE_HAPPINESS_BOOST : 0;
    // Answering a break call sends the pet for a timed nap while you take your break
    const goesToSleep = answeredBreak !== null && !state.sleeping;
    if (goesToSleep) {
        events.push("fell_asleep");
    }
    if (answeredBreak) {
        events.push("break_nap_started");
    }
    const next = withDerivedFields({
        ...state,
        ...(answered ?? {}),
        discipline: clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
        happiness: clampStat(state.happiness + happinessBonus),
        careMistakes: Math.max(0, state.careMistakes - (answered ? CARE_MISTAKE_ANSWER_CREDIT : 0)),
        ...(goesToSleep ? { sleeping: true, consecutiveSnacks: 0 } : {}),
        ...(answeredBreak ? { sleeping: true, breakNapTicksRemaining: BREAK_NAP_TICKS, ticksSinceLastBreakCall: 0 } : {}),
        events,
    });
    return answered ? awardXp(next, "care", Date.now(), true) : next;
}
/**
 * Apply the code-activity happiness and discipline boost.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS) must be enforced by the caller
 * (events.ts); this function unconditionally applies the deltas.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the boost is applied.
 */
export function applyCodeActivity(state) {
    if (state.paused) {
        return state;
    }
    return awardXp(withDerivedFields({
        ...state,
        happiness: clampStat(state.happiness + CODE_ACTIVITY_HAPPINESS_BOOST),
        discipline: clampStat(state.discipline + CODE_ACTIVITY_DISCIPLINE_BOOST),
        events: ["code_activity_rewarded"],
    }), "code");
}
/**
 * Apply the commit happiness and discipline boost.
 *
 * Throttling (COMMIT_ACTIVITY_THROTTLE_SECONDS) must be enforced by the caller
 * (events.ts); this function unconditionally applies the deltas.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the boost is applied.
 */
export function applyCommitActivity(state) {
    if (state.paused) {
        return state;
    }
    return awardXp(withDerivedFields({
        ...state,
        happiness: clampStat(state.happiness + COMMIT_HAPPINESS_BOOST),
        discipline: clampStat(state.discipline + COMMIT_DISCIPLINE_BOOST),
        events: ["commit_activity_rewarded"],
    }), "commit");
}
// ---------------------------------------------------------------------------
// Senior promotion (ported from python/evolution.py)
// ---------------------------------------------------------------------------
/**
 * Transition an adult pet to the senior stage.
 *
 * The character is re-evaluated using the current care score.
 * Care accumulators are reset for the final life window.
 *
 * @param state - An adult pet (stage === "adult").
 * @returns A new PetState at the senior stage.
 * @throws Error if the pet is not in the "adult" stage.
 */
export function promoteToSenior(state) {
    if (state.stage !== "adult") {
        throw new Error(`promoteToSenior called on a pet in stage '${state.stage}'; expected 'adult'.`);
    }
    const character = characterForStage(state.petType, "senior", state.careScore, state.careMistakes, state.lifetimeCareMistakes);
    return awardXp(withDerivedFields({
        ...state,
        stage: "senior",
        character,
        ticksAlive: 0,
        careScoreHungerSum: 0,
        careScoreHappinessSum: 0,
        careScoreHealthSum: 0,
        careScoreTicks: 0,
        careMistakes: 0,
        events: ["evolved_to_senior"],
    }), "evolve");
}
/**
 * Compute the per-day probability of old-age death for a senior pet.
 *
 * Four longevity factors, each in [0, 1] where 0 = safest, 1 = riskiest:
 *   - happinessFactor        : based on per-stage average happiness (careScore accumulator)
 *   - weightFactor           : 0 inside the healthy zone [17, 66]; scales to 1 at extremes
 *   - disciplineFactor       : based on current discipline stat
 *   - mistakesFactor         : based on lifetimeCareMistakes, saturates at CARE_MISTAKE_OLD_AGE_SATURATE
 *
 * riskScore = average of the four factors ∈ [0, 1]
 *
 * The chance ramps linearly from the onset values at day 365 (ageFactor = 0)
 * up to the peak values at day 1825 (5 in-game years, ageFactor = 1), then
 * stays at the peak:
 *
 *   ageFactor = clamp((ageDays − 365) / (1825 − 365), 0, 1)
 *   minChance = lerp(0.001, 0.05,  ageFactor)   ← best care  (riskScore = 0)
 *   maxChance = lerp(0.010, 0.10,  ageFactor)   ← worst care (riskScore = 1)
 *   chance    = lerp(minChance, maxChance, riskScore)
 */
function computeOldAgeDeathChance(state) {
    const avgHappiness = state.careScoreTicks > 0
        ? state.careScoreHappinessSum / state.careScoreTicks
        : state.happiness;
    const happinessFactor = (100 - avgHappiness) / 100;
    let weightFactor;
    if (state.weight < WEIGHT_HAPPINESS_LOW_THRESHOLD) {
        weightFactor = (WEIGHT_HAPPINESS_LOW_THRESHOLD - state.weight) /
            (WEIGHT_HAPPINESS_LOW_THRESHOLD - WEIGHT_MIN); // 0 at 17, 1 at 1
    }
    else if (state.weight > WEIGHT_HAPPINESS_HIGH_THRESHOLD) {
        weightFactor = (state.weight - WEIGHT_HAPPINESS_HIGH_THRESHOLD) /
            (WEIGHT_MAX - WEIGHT_HAPPINESS_HIGH_THRESHOLD); // 0 at 66, 1 at 99
    }
    else {
        weightFactor = 0;
    }
    const disciplineFactor = (100 - state.discipline) / 100;
    // Lifetime care mistakes factor — saturates at CARE_MISTAKE_OLD_AGE_SATURATE
    const mistakesFactor = Math.min(1.0, state.lifetimeCareMistakes / CARE_MISTAKE_OLD_AGE_SATURATE);
    const riskScore = (happinessFactor + weightFactor + disciplineFactor + mistakesFactor) / 4;
    // Age factor: 0 at onset (day 365), ramps to 1 at peak (day 1825), capped there.
    const ageFactor = Math.min(1, Math.max(0, (state.ageDays - SENIOR_NATURAL_DEATH_AGE_DAYS) /
        (OLD_AGE_DEATH_PEAK_AGE_DAYS - SENIOR_NATURAL_DEATH_AGE_DAYS)));
    const baseWorstCare = OLD_AGE_DEATH_BASE_CHANCE_PER_DAY * (1 + OLD_AGE_DEATH_RISK_MULTIPLIER);
    const minChance = OLD_AGE_DEATH_BASE_CHANCE_PER_DAY +
        ageFactor * (OLD_AGE_DEATH_PEAK_BEST_CARE_CHANCE - OLD_AGE_DEATH_BASE_CHANCE_PER_DAY);
    const maxChance = baseWorstCare +
        ageFactor * (OLD_AGE_DEATH_PEAK_WORST_CARE_CHANCE - baseWorstCare);
    return minChance + riskScore * (maxChance - minChance);
}
/**
 * Roll for natural old-age death once per game-day boundary for a senior pet.
 *
 * Guards (all must pass before the roll fires):
 *   1. Pet is a senior.
 *   2. ageDays >= SENIOR_NATURAL_DEATH_AGE_DAYS (365).
 *   3. random < computeOldAgeDeathChance(state).
 *
 * The `random` parameter is injected so the function is deterministically testable.
 * Call sites should pass Math.random().
 *
 * @param state  - The current pet state.
 * @param random - A uniform random number in [0, 1).
 * @returns A new PetState with alive === false and event "died_of_old_age" if the
 *          roll hits; otherwise the original state reference unchanged.
 */
export function rollOldAgeDeath(state, random) {
    if (state.stage !== "senior") {
        return state;
    }
    if (state.ageDays < SENIOR_NATURAL_DEATH_AGE_DAYS) {
        return state;
    }
    const chance = computeOldAgeDeathChance(state);
    if (random >= chance) {
        return state;
    }
    return withDerivedFields({
        ...state,
        alive: false,
        diedAt: Date.now(),
        events: ["died_of_old_age"],
    });
}
/**
 * Roll for a random age-related illness once per game-day boundary for a senior pet.
 *
 * Guards (all must pass before the roll fires):
 *   1. Pet is a senior.
 *   2. ageDays >= SENIOR_NATURAL_DEATH_AGE_DAYS (365).
 *   3. Pet is not already sick.
 *   4. random < OLD_AGE_SICK_CHANCE_MULTIPLIER × computeOldAgeDeathChance(state).
 *
 * The `random` parameter is injected so the function is deterministically testable.
 * Call sites should pass Math.random().
 *
 * @param state  - The current pet state.
 * @param random - A uniform random number in [0, 1).
 * @returns A new PetState with sick === true and event "became_sick_old_age" if the
 *          roll hits; otherwise the original state reference unchanged.
 */
export function rollOldAgeSickness(state, random) {
    if (state.stage !== "senior") {
        return state;
    }
    if (state.ageDays < SENIOR_NATURAL_DEATH_AGE_DAYS) {
        return state;
    }
    if (state.sick) {
        return state;
    }
    const chance = OLD_AGE_SICK_CHANCE_MULTIPLIER * computeOldAgeDeathChance(state);
    if (random >= chance) {
        return state;
    }
    return withDerivedFields({
        ...state,
        sick: true,
        events: [...state.events, "became_sick_old_age"],
    });
}
// ---------------------------------------------------------------------------
// Offline decay
// ---------------------------------------------------------------------------
/**
 * Freeze all tick-based progression. While paused:
 * - `tick()` returns state unchanged
 * - `applyOfflineDecay()` returns state unchanged
 * - `applyCodeActivity()` returns state unchanged
 */
export function pause(state) {
    return withDerivedFields({ ...state, paused: true, events: ["game_paused"] });
}
/**
 * Resume normal tick-based progression after a pause.
 */
export function resume(state) {
    return withDerivedFields({ ...state, paused: false, events: ["game_resumed"] });
}
/**
 * Decay stats for time elapsed while the extension was closed.
 *
 * The maximum total decay is capped at OFFLINE_DECAY_MAX_FRACTION of each
 * stat's current value to prevent a pet from dying while the developer sleeps.
 *
 * @param state - The current pet state.
 * @param elapsedSeconds - Seconds elapsed since the extension was last active.
 * @returns A new PetState after offline decay is applied.
 */
export function applyOfflineDecay(state, elapsedSeconds) {
    if (elapsedSeconds <= 0 || !state.alive || state.paused) {
        return state;
    }
    const modifiers = PET_TYPE_MODIFIERS[state.petType] ?? PET_TYPE_MODIFIERS.codeling;
    // A break nap in progress keeps stats frozen for its remaining time; only
    // the time after the nap ends counts towards decay, and the pet wakes if
    // the nap ran out while the IDE was closed.
    const napTicksUsed = Math.min(state.breakNapTicksRemaining, Math.floor(elapsedSeconds / TICK_INTERVAL_SECONDS));
    const breakNapTicksRemaining = state.breakNapTicksRemaining - napTicksUsed;
    const napEnded = state.breakNapTicksRemaining > 0 && breakNapTicksRemaining === 0;
    const elapsedTicks = Math.max(0, elapsedSeconds / TICK_INTERVAL_SECONDS - napTicksUsed);
    const hungerDecayTotal = elapsedTicks * HUNGER_DECAY_PER_TICK * modifiers.hungerDecayMultiplier;
    const happinessDecayTotal = elapsedTicks * HAPPINESS_DECAY_PER_TICK * modifiers.happinessDecayMultiplier;
    const maxHungerLoss = Math.floor(state.hunger * OFFLINE_DECAY_MAX_FRACTION);
    const maxHappinessLoss = Math.floor(state.happiness * OFFLINE_DECAY_MAX_FRACTION);
    // Poop does NOT accumulate while the IDE is closed — the same rule that
    // suppresses pooping during idle/deep idle applies to offline time too.
    const decayedHunger = clampStat(state.hunger - Math.min(hungerDecayTotal, maxHungerLoss));
    const decayedHappiness = clampStat(state.happiness - Math.min(happinessDecayTotal, maxHappinessLoss));
    return withDerivedFields({
        ...state,
        // Being offline is equivalent to deep idle: apply the same IDLE_STAT_FLOOR
        // so offline decay can never push stats below the deep-idle floor of 20 —
        // but never raise a stat that was already below the floor before going offline.
        hunger: Math.max(decayedHunger, Math.min(state.hunger, IDLE_STAT_FLOOR)),
        happiness: Math.max(decayedHappiness, Math.min(state.happiness, IDLE_STAT_FLOOR)),
        // Reset the starvation streak counter: offline time breaks the continuity
        // of consecutive zero-hunger ticks.  Without this reset the pet could die
        // on the very first tick after VS Code reopens.
        hungerZeroTicks: 0,
        // Treat offline time as awake for stat decay; aging does NOT advance while the IDE is closed.
        dayTimer: state.dayTimer,
        ageDays: state.ageDays,
        breakNapTicksRemaining,
        ...(napEnded ? { sleeping: false } : {}),
        events: [],
    });
}
// ---------------------------------------------------------------------------
// Progression — XP, levels and achievements
// ---------------------------------------------------------------------------
/** Current save-format version. Bump when a migration step is added to deserialiseState(). */
export const SCHEMA_VERSION = 1;
/**
 * XP per source. Care actions (care / snack / clean / cure) pay nothing on
 * their own: they only earn the "call" XP when they answer an attention call.
 */
export const XP_AMOUNTS = {
    code: 2,
    commit: 15,
    call: 10,
    care: 0,
    snack: 0,
    clean: 0,
    cure: 0,
    minigame: 10,
    evolve: 30,
    debug: 10,
    boss_kill: 50,
    boss_battle: 40,
};
/** Bonus XP for unlocking an achievement. */
export const XP_ACHIEVEMENT_BONUS = 50;
/** Hourly XP caps per source (local clock hour). Sources not listed have no hourly cap. */
export const XP_HOURLY_CAPS = {
    code: 10,
    commit: 30,
    minigame: 20,
    boss_battle: 40,
};
/** Daily XP caps per source (local day). Sources not listed are uncapped. */
export const XP_DAILY_CAPS = {
    code: 40,
    commit: 90,
    call: 100,
    minigame: 50,
    boss_battle: 80,
};
/** Commits made from midnight up to this hour (local time) count as late-night commits. */
export const NIGHT_OWL_END_HOUR = 5;
const XP_COUNTERS = {
    code: ["codeActivity"],
    commit: ["commits"],
    call: ["callsAnswered"],
    care: ["care"],
    snack: ["care", "snacks"],
    clean: ["care", "cleans"],
    cure: ["care", "cures"],
    minigame: ["minigameWins"],
    evolve: ["evolutions"],
    debug: ["debugSessions"],
    boss_kill: ["bossKills"],
    boss_battle: ["bossBattleWins", "minigameWins"],
};
/** Every achievement, in display order. */
export const ACHIEVEMENTS = [
    { id: "hello_world", name: "Hello World", description: "Write some code with your pet watching", emoji: "👋", counter: "codeActivity", threshold: 1, path: "coder" },
    { id: "save_100", name: "Busy Fingers", description: "Get 100 code-activity rewards", emoji: "⌨️", counter: "codeActivity", threshold: 100, path: "coder" },
    { id: "save_1000", name: "Ctrl+S Master", description: "Get 1,000 code-activity rewards", emoji: "💾", counter: "codeActivity", threshold: 1000, path: "coder" },
    { id: "first_commit", name: "First Commit", description: "Make a commit", emoji: "📌", counter: "commits", threshold: 1, path: "coder" },
    { id: "committed", name: "Committed", description: "Make 100 commits", emoji: "📚", counter: "commits", threshold: 100, path: "coder" },
    { id: "night_owl", name: "Night Owl", description: "Commit between midnight and 5 am", emoji: "🦉", counter: "nightCommits", threshold: 1, path: "coder" },
    { id: "detective", name: "Detective", description: "Finish 10 debug sessions", emoji: "🔍", counter: "debugSessions", threshold: 10, path: "coder", comingSoon: true },
    { id: "first_blood", name: "First Blood", description: "Defeat a Bug Boss", emoji: "⚔️", counter: "bossKills", threshold: 1, path: "coder", comingSoon: true },
    { id: "exterminator", name: "Exterminator", description: "Defeat 10 Bug Bosses", emoji: "🐛", counter: "bossKills", threshold: 10, path: "coder", comingSoon: true },
    { id: "on_call", name: "On Call", description: "Answer 100 calls from your pet", emoji: "🤲", counter: "callsAnswered", threshold: 100, path: "keeper" },
    { id: "snack_fiend", name: "Snack Fiend", description: "Hand out 50 snacks", emoji: "🍪", counter: "snacks", threshold: 50, path: "keeper" },
    { id: "clean_freak", name: "Clean Freak", description: "Clean up 50 times", emoji: "🧹", counter: "cleans", threshold: 50, path: "keeper" },
    { id: "nurse", name: "Nurse", description: "Cure your pet 10 times", emoji: "💊", counter: "cures", threshold: 10, path: "keeper" },
    { id: "gamer", name: "Gamer", description: "Win 10 mini-games", emoji: "🎮", counter: "minigameWins", threshold: 10, path: "keeper" },
    { id: "growing_up", name: "Growing Up", description: "See your pets evolve 3 times", emoji: "🌱", counter: "evolutions", threshold: 3, path: "keeper" },
    { id: "survivor", name: "Survivor", description: "Raise a pet to senior", emoji: "🧓", counter: "seniors", threshold: 1, path: "keeper" },
    { id: "champion", name: "Champion", description: "Win a Boss Battle", emoji: "🥊", counter: "bossBattleWins", threshold: 1, path: "keeper" },
    { id: "level_5", name: "Rising Star", description: "Reach trainer level 5", emoji: "⭐", counter: "level", threshold: 5, path: "trainer" },
    { id: "level_10", name: "Veteran", description: "Reach trainer level 10", emoji: "🌟", counter: "level", threshold: 10, path: "trainer" },
    { id: "level_25", name: "Legend", description: "Reach trainer level 25", emoji: "🏆", counter: "level", threshold: 25, path: "trainer" },
];
/** A fresh trainer with no XP. */
export function createTrainer() {
    return { xp: 0, level: 1, achievements: [], counters: {}, xpDay: "", xpToday: {}, xpHour: "", xpThisHour: {} };
}
/** XP needed to go from `level` to `level + 1`. */
export function xpToNextLevel(level) {
    return Math.round(50 * Math.pow(Math.max(1, level), 1.5));
}
/** Level reached with `xp` total XP, plus the progress into that level. */
export function levelProgress(xp) {
    let level = 1;
    let remaining = Math.max(0, Math.floor(xp));
    while (remaining >= xpToNextLevel(level)) {
        remaining -= xpToNextLevel(level);
        level++;
    }
    return { level, intoLevel: remaining, needed: xpToNextLevel(level) };
}
/** Local calendar date as YYYY-MM-DD. */
export function localDayKey(now) {
    const d = new Date(now);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
}
/** Local clock hour as YYYY-MM-DDTHH. */
export function localHourKey(now) {
    return `${localDayKey(now)}T${String(new Date(now).getHours()).padStart(2, "0")}`;
}
/** Progress towards an achievement: current value (capped at the threshold) and the threshold. */
export function achievementProgress(a, trainer) {
    const raw = a.counter === "level" ? trainer.level : trainer.counters[a.counter] ?? 0;
    return { value: Math.min(raw, a.threshold), threshold: a.threshold };
}
function bump(counters, key) {
    counters[key] = (counters[key] ?? 0) + 1;
}
/**
 * Award XP to both the trainer and the current pet, update the achievement
 * counters, and unlock any achievements now reached.
 *
 * Capped sources stop paying XP once this hour's or today's cap is full, but
 * their counters still go up. With `answeredCall`, the action also answered
 * an attention call and earns the "call" XP on top. Also advances the pet's
 * daily challenges. Emits `trainer_level_up`, `pet_level_up`,
 * `achievement_unlocked_<id>`, `daily_challenge_done_<id>` and
 * `daily_challenges_all_done` events (appended to `events` and the event log).
 *
 * @param state - Pet state after the action that earned the XP.
 * @param source - What earned it.
 * @param now - Wall-clock ms, for the caps and time-of-day achievements.
 * @param answeredCall - The action answered an attention call.
 * @returns The state with progression applied.
 */
export function awardXp(state, source, now = Date.now(), answeredCall = false) {
    const t = state.trainer;
    const day = localDayKey(now);
    const hour = localHourKey(now);
    const xpToday = t.xpDay === day ? { ...t.xpToday } : {};
    const xpThisHour = t.xpHour === hour ? { ...t.xpThisHour } : {};
    const counters = { ...t.counters };
    if (source === "commit" && new Date(now).getHours() < NIGHT_OWL_END_HOUR) {
        bump(counters, "nightCommits");
    }
    if (source === "evolve" && state.stage === "senior") {
        bump(counters, "seniors");
    }
    let amount = 0;
    const sources = answeredCall && source !== "call" ? [source, "call"] : [source];
    for (const src of sources) {
        for (const key of XP_COUNTERS[src]) {
            bump(counters, key);
        }
        let earned = XP_AMOUNTS[src];
        const hourCap = XP_HOURLY_CAPS[src];
        const dayCap = XP_DAILY_CAPS[src];
        if (hourCap !== undefined) {
            earned = Math.min(earned, Math.max(0, hourCap - (xpThisHour[src] ?? 0)));
        }
        if (dayCap !== undefined) {
            earned = Math.min(earned, Math.max(0, dayCap - (xpToday[src] ?? 0)));
        }
        if (hourCap !== undefined) {
            xpThisHour[src] = (xpThisHour[src] ?? 0) + earned;
        }
        if (dayCap !== undefined) {
            xpToday[src] = (xpToday[src] ?? 0) + earned;
        }
        amount += earned;
    }
    const daily = advanceDailies(state.dailies, state, t.counters, counters, day);
    amount += daily.xp;
    const events = [...daily.events];
    let xp = t.xp + amount;
    let level = levelProgress(xp).level;
    const achievements = [...t.achievements];
    // Unlock bonuses can raise the level, which can unlock a level achievement.
    for (;;) {
        const fresh = ACHIEVEMENTS.filter((a) => !a.comingSoon &&
            !achievements.includes(a.id) &&
            (a.counter === "level" ? level : counters[a.counter] ?? 0) >= a.threshold);
        if (fresh.length === 0) {
            break;
        }
        for (const a of fresh) {
            achievements.push(a.id);
            events.push(`achievement_unlocked_${a.id}`);
            xp += XP_ACHIEVEMENT_BONUS;
        }
        level = levelProgress(xp).level;
    }
    if (level > t.level) {
        events.unshift("trainer_level_up");
    }
    const petXp = state.petXp + amount;
    const petLevel = levelProgress(petXp).level;
    if (petLevel > state.petLevel) {
        events.unshift("pet_level_up");
    }
    return {
        ...state,
        petXp,
        petLevel,
        trainer: { xp, level, achievements, counters, xpDay: day, xpToday, xpHour: hour, xpThisHour },
        dailies: daily.dailies,
        events: [...state.events, ...events],
        recentEventLog: events.length > 0
            ? [...state.recentEventLog, ...events].slice(-RECENT_EVENT_LOG_MAX)
            : state.recentEventLog,
    };
}
/** Look up an achievement by id. */
export function achievementById(id) {
    return ACHIEVEMENTS.find((a) => a.id === id);
}
/**
 * Notification text for a progression event (achievement unlock or trainer
 * level-up), or null for any other event. Pet level-ups only show in the pet's
 * speech bubble, so they return null too.
 */
export function progressionMessage(event, state) {
    if (event === "trainer_level_up") {
        return `Level up! You're now trainer level ${state.trainer.level}.`;
    }
    if (event.startsWith("achievement_unlocked_")) {
        const a = achievementById(event.slice("achievement_unlocked_".length));
        return a ? `Achievement unlocked: ${a.emoji} ${a.name} — ${a.description}` : null;
    }
    if (event.startsWith("daily_challenge_done_")) {
        const c = dailyChallengeById(event.slice("daily_challenge_done_".length));
        return c ? `Daily challenge done: ${c.text} (+${DAILY_CHALLENGE_XP} XP)` : null;
    }
    if (event === "daily_challenges_all_done") {
        const d = state.dailies;
        const streak = d.streakDay === d.day && d.streak > 0 ? ` Streak: ${d.streak} day${d.streak === 1 ? "" : "s"}.` : "";
        return `All of today's challenges done! +${DAILY_ALL_DONE_BONUS} bonus XP.${streak}`;
    }
    return null;
}
/** Keep only buckets for capped sources that are within their cap. */
function validBuckets(buckets, caps) {
    const out = {};
    for (const [k, v] of Object.entries(buckets)) {
        const cap = caps[k];
        if (cap !== undefined && v <= cap) {
            out[k] = v;
        }
    }
    return out;
}
/** Parse a TrainerProgress from saved JSON, filling in defaults for anything missing. */
export function deserialiseTrainer(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return createTrainer();
    }
    const r = raw;
    const numRecord = (v) => {
        const out = {};
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
            for (const [k, n] of Object.entries(v)) {
                if (typeof n === "number" && Number.isFinite(n)) {
                    out[k] = n;
                }
            }
        }
        return out;
    };
    const xp = typeof r.xp === "number" && Number.isFinite(r.xp) ? Math.max(0, r.xp) : 0;
    return {
        xp,
        level: levelProgress(xp).level,
        // Unknown ids (e.g. the retired "caretaker") are dropped.
        achievements: Array.isArray(r.achievements)
            ? r.achievements.filter((a) => typeof a === "string" && ACHIEVEMENTS.some((x) => x.id === a))
            : [],
        counters: numRecord(r.counters),
        xpDay: typeof r.xpDay === "string" ? r.xpDay : "",
        // Buckets for uncapped sources, or over today's cap, come from the old rules: start them afresh.
        xpToday: validBuckets(numRecord(r.xpToday), XP_DAILY_CAPS),
        xpHour: typeof r.xpHour === "string" ? r.xpHour : "",
        xpThisHour: validBuckets(numRecord(r.xpThisHour), XP_HOURLY_CAPS),
    };
}
/** XP for each completed daily challenge. Uncapped, but each pays once a day. */
export const DAILY_CHALLENGE_XP = 25;
/** Extra XP for completing all three of the day's challenges. */
export const DAILY_ALL_DONE_BONUS = 25;
/** Every daily challenge, grouped by pool. */
export const DAILY_CHALLENGES = [
    { id: "code_10", path: "coder", text: "Get 10 code-activity rewards", reqs: [["codeActivity", 10]] },
    { id: "code_25", path: "coder", text: "Get 25 code-activity rewards", reqs: [["codeActivity", 25]] },
    { id: "commit_1", path: "coder", text: "Make a commit", reqs: [["commits", 1]] },
    { id: "commit_3", path: "coder", text: "Make 3 commits", reqs: [["commits", 3]] },
    { id: "commit_5", path: "coder", text: "Make 5 commits", reqs: [["commits", 5]] },
    { id: "calls_3", path: "keeper", text: "Answer 3 calls from your pet", reqs: [["callsAnswered", 3]] },
    { id: "calls_6", path: "keeper", text: "Answer 6 calls from your pet", reqs: [["callsAnswered", 6]] },
    { id: "snacks_3", path: "keeper", text: "Hand out 3 snacks", reqs: [["snacks", 3]] },
    { id: "clean_2", path: "keeper", text: "Clean up twice", reqs: [["cleans", 2]] },
    { id: "care_10", path: "keeper", text: "Look after your pet 10 times", reqs: [["care", 10]] },
    { id: "win_1", path: "wild", text: "Win a mini-game", reqs: [["minigameWins", 1]] },
    { id: "win_3", path: "wild", text: "Win 3 mini-games", reqs: [["minigameWins", 3]] },
    { id: "commit_and_call", path: "wild", text: "Make a commit and answer a call", reqs: [["commits", 1], ["callsAnswered", 1]] },
    { id: "code_and_win", path: "wild", text: "Get 5 code-activity rewards and win a mini-game", reqs: [["codeActivity", 5], ["minigameWins", 1]] },
    { id: "snack_and_commit", path: "wild", text: "Hand out a snack and make a commit", reqs: [["snacks", 1], ["commits", 1]] },
];
const DAILY_PATHS = ["coder", "keeper", "wild"];
/** Empty daily-challenge state for a new pet. */
export function createDailies() {
    return { day: "", picks: [], baseline: {}, done: [], streak: 0, streakDay: "" };
}
/** Look up a daily challenge by id. */
export function dailyChallengeById(id) {
    return DAILY_CHALLENGES.find((c) => c.id === id);
}
/** 32-bit FNV-1a over UTF-16 code units. Kotlin mirrors this exactly. */
function seedHash(s) {
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
/** The day's three challenge ids (coder, keeper, wild), seeded from the date and the pet. */
export function pickDailyChallenges(day, pet) {
    const seed = `${day}|${pet.name}|${pet.spawnedAt}`;
    return DAILY_PATHS.map((path) => {
        const pool = DAILY_CHALLENGES.filter((c) => c.path === path);
        return pool[seedHash(`${seed}|${path}`) % pool.length].id;
    });
}
function parseDay(day) {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d, 12);
}
/** Saturday or Sunday. */
export function isWeekendDay(day) {
    const w = parseDay(day).getDay();
    return w === 0 || w === 6;
}
/** The most recent weekday before `day`. */
export function previousWeekday(day) {
    const d = parseDay(day);
    do {
        d.setDate(d.getDate() - 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
    return localDayKey(d.getTime());
}
/**
 * The streak as of `now`: weekdays in a row with all three challenges done.
 * Weekends neither break nor extend it.
 */
export function currentStreak(dailies, now = Date.now()) {
    const today = localDayKey(now);
    if (dailies.streak <= 0 || dailies.streakDay === "") {
        return 0;
    }
    return dailies.streakDay === today || dailies.streakDay === previousWeekday(today) ? dailies.streak : 0;
}
/** Start a new day's picks if `day` has moved on, measuring progress from the trainer's current counters. */
function rollDailies(dailies, pet, counters, day) {
    if (dailies.day === day) {
        return dailies;
    }
    return { ...dailies, day, picks: pickDailyChallenges(day, pet), baseline: { ...counters }, done: [] };
}
/** Progress on each requirement of `c`, capped at its target. */
export function dailyChallengeProgress(c, baseline, counters) {
    return c.reqs.map(([counter, target]) => ({
        counter,
        value: Math.min(target, Math.max(0, (counters[counter] ?? 0) - (baseline[counter] ?? 0))),
        target,
    }));
}
/** Today's challenges with progress, and the streak as of `now`. Works before the day's first roll too. */
export function dailiesView(state, now = Date.now()) {
    const d = rollDailies(state.dailies, state, state.trainer.counters, localDayKey(now));
    const challenges = d.picks.flatMap((id) => {
        const c = dailyChallengeById(id);
        if (!c) {
            return [];
        }
        const p = dailyChallengeProgress(c, d.baseline, state.trainer.counters);
        return [{
                id, path: c.path, text: c.text,
                value: p.reduce((s, r) => s + r.value, 0),
                target: p.reduce((s, r) => s + r.target, 0),
                done: d.done.includes(id),
            }];
    });
    return { challenges, streak: currentStreak(d, now), allDone: challenges.length > 0 && challenges.every((c) => c.done) };
}
/**
 * Roll the day if needed, then mark any challenges now complete.
 * Returns the new dailies, the XP they earned and their events.
 */
function advanceDailies(dailies, pet, before, after, day) {
    const d = rollDailies(dailies, pet, before, day);
    const done = [...d.done];
    const events = [];
    let xp = 0;
    for (const id of d.picks) {
        const c = dailyChallengeById(id);
        if (!c || done.includes(id)) {
            continue;
        }
        if (dailyChallengeProgress(c, d.baseline, after).every((r) => r.value >= r.target)) {
            done.push(id);
            events.push(`daily_challenge_done_${id}`);
            xp += DAILY_CHALLENGE_XP;
        }
    }
    let { streak, streakDay } = d;
    if (events.length > 0 && d.picks.length > 0 && done.length === d.picks.length) {
        events.push("daily_challenges_all_done");
        xp += DAILY_ALL_DONE_BONUS;
        if (!isWeekendDay(day) && streakDay !== day) {
            streak = (streakDay === previousWeekday(day) ? streak : 0) + 1;
            streakDay = day;
        }
    }
    return { dailies: { ...d, done, streak, streakDay }, xp, events };
}
/** Parse DailyChallenges from saved JSON, filling in defaults for anything missing. */
export function deserialiseDailies(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return createDailies();
    }
    const r = raw;
    const strings = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
    const baseline = {};
    if (r.baseline !== null && typeof r.baseline === "object" && !Array.isArray(r.baseline)) {
        for (const [k, n] of Object.entries(r.baseline)) {
            if (typeof n === "number" && Number.isFinite(n)) {
                baseline[k] = n;
            }
        }
    }
    return {
        day: typeof r.day === "string" ? r.day : "",
        picks: strings(r.picks),
        baseline,
        done: strings(r.done),
        streak: typeof r.streak === "number" && Number.isFinite(r.streak) ? Math.max(0, Math.floor(r.streak)) : 0,
        streakDay: typeof r.streakDay === "string" ? r.streakDay : "",
    };
}
// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------
/**
 * Serialise a PetState to a plain JSON-compatible object.
 *
 * The returned object is safe to pass to VS Code's globalState.update().
 *
 * @param state - The pet state to serialise.
 * @returns A plain Record suitable for JSON serialisation.
 */
export function serialiseState(state) {
    return {
        name: state.name,
        petType: state.petType,
        spriteType: state.spriteType,
        hunger: state.hunger,
        happiness: state.happiness,
        discipline: state.discipline,
        energy: state.energy,
        health: state.health,
        weight: state.weight,
        ageDays: state.ageDays,
        stage: state.stage,
        character: state.character,
        alive: state.alive,
        sick: state.sick,
        sleeping: state.sleeping,
        ticksAlive: state.ticksAlive,
        poops: state.poops,
        ticksSinceLastPoop: state.ticksSinceLastPoop,
        nextPoopIntervalTicks: state.nextPoopIntervalTicks,
        consecutiveSnacks: state.consecutiveSnacks,
        hungerZeroTicks: state.hungerZeroTicks,
        medicineDosesGiven: state.medicineDosesGiven,
        careScoreHungerSum: state.careScoreHungerSum,
        careScoreHappinessSum: state.careScoreHappinessSum,
        careScoreHealthSum: state.careScoreHealthSum,
        careScoreTicks: state.careScoreTicks,
        // Derived fields (convenience for the webview)
        mood: state.mood,
        sprite: state.sprite,
        careScore: state.careScore,
        events: state.events,
        recentEventLog: state.recentEventLog,
        wasIdle: state.wasIdle,
        wasDeepIdle: state.wasDeepIdle,
        spawnedAt: state.spawnedAt,
        diedAt: state.diedAt,
        snacksGivenThisCycle: state.snacksGivenThisCycle,
        snacksOnFloor: state.snacksOnFloor,
        paused: state.paused,
        // Attention call fields
        activeAttentionCall: state.activeAttentionCall,
        attentionCallActiveTicks: state.attentionCallActiveTicks,
        attentionCallCooldowns: state.attentionCallCooldowns,
        careMistakes: state.careMistakes,
        lifetimeCareMistakes: state.lifetimeCareMistakes,
        ticksWithUncleanedPoop: state.ticksWithUncleanedPoop,
        poopOverLimitTicks: state.poopOverLimitTicks,
        ticksSinceLastMisbehaviour: state.ticksSinceLastMisbehaviour,
        ticksSinceLastGift: state.ticksSinceLastGift,
        ticksSinceLastPlayCall: state.ticksSinceLastPlayCall,
        ticksSinceLastPatCall: state.ticksSinceLastPatCall,
        ticksSinceLastCraving: state.ticksSinceLastCraving,
        ticksSinceLastBreakCall: state.ticksSinceLastBreakCall,
        breakNapTicksRemaining: state.breakNapTicksRemaining,
        cravingFood: state.cravingFood,
        devModeEverUsed: state.devModeEverUsed,
        leaderboardIneligible: state.leaderboardIneligible,
        schemaVersion: state.schemaVersion,
        petXp: state.petXp,
        petLevel: state.petLevel,
        trainer: state.trainer,
        dailies: state.dailies,
    };
}
/**
 * Deserialise a plain object (loaded from globalState) back to a PetState.
 *
 * Unknown keys are silently ignored so older snapshots remain loadable after
 * the schema gains new fields.
 *
 * @param data - The plain object previously returned by serialiseState().
 * @returns A fully typed PetState.
 */
export function deserialiseState(data) {
    const getString = (key, fallback) => typeof data[key] === "string" ? data[key] : fallback;
    const getNumber = (key, fallback) => typeof data[key] === "number" ? data[key] : fallback;
    const getBool = (key, fallback) => typeof data[key] === "boolean" ? data[key] : fallback;
    const getStringArray = (key) => Array.isArray(data[key]) ? data[key] : [];
    // Back-compat helper for attentionCallCooldowns (stored as plain object)
    const getCooldowns = () => {
        const raw = data["attentionCallCooldowns"];
        if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
            return raw;
        }
        return {};
    };
    const partial = {
        name: getString("name", "Codotchi"),
        petType: getString("petType", "codeling"),
        // Back-compat: old saves won't have spriteType; default to "classic" (original humanoid).
        // Legacy "goat" saves are silently migrated to "sheep".
        spriteType: (() => {
            const s = getString("spriteType", "classic");
            return s === "goat" ? "sheep" : s;
        })(),
        hunger: getNumber("hunger", 50),
        happiness: getNumber("happiness", 50),
        discipline: getNumber("discipline", 50),
        energy: getNumber("energy", 100),
        health: getNumber("health", 100),
        weight: getNumber("weight", 40),
        ageDays: getNumber("ageDays", 0),
        stage: getString("stage", "egg"),
        character: getString("character", ""),
        alive: getBool("alive", true),
        sick: getBool("sick", false),
        sleeping: getBool("sleeping", false),
        ticksAlive: getNumber("ticksAlive", 0),
        poops: getNumber("poops", 0),
        ticksSinceLastPoop: getNumber("ticksSinceLastPoop", 0),
        // Back-compat: old saves won't have this field; resample a fresh interval.
        nextPoopIntervalTicks: getNumber("nextPoopIntervalTicks", sampleNextPoopInterval(getString("petType", "codeling"))),
        consecutiveSnacks: getNumber("consecutiveSnacks", 0),
        hungerZeroTicks: getNumber("hungerZeroTicks", 0),
        medicineDosesGiven: getNumber("medicineDosesGiven", 0),
        careScoreHungerSum: getNumber("careScoreHungerSum", 0),
        careScoreHappinessSum: getNumber("careScoreHappinessSum", 0),
        careScoreHealthSum: getNumber("careScoreHealthSum", 0),
        careScoreTicks: getNumber("careScoreTicks", 0),
        events: [],
        // Back-compat: old saves won't have these fields.
        recentEventLog: getStringArray("recentEventLog"),
        wasIdle: false, // back-compat: old saves default to not idle
        wasDeepIdle: false, // back-compat: old saves default to not deep idle
        spawnedAt: getNumber("spawnedAt", Date.now()),
        // Back-compat: a pet saved dead before diedAt existed gets "now". Its real
        // death time is lost, but from here on it stays fixed.
        diedAt: getNumber("diedAt", getBool("alive", true) ? 0 : Date.now()),
        snacksGivenThisCycle: getNumber("snacksGivenThisCycle", 0),
        snacksOnFloor: getNumber("snacksOnFloor", 0),
        paused: getBool("paused", false),
        dayTimer: getNumber("dayTimer", getNumber("ageDays", 0)),
        // Attention call fields — back-compat: all default to inactive/zero.
        activeAttentionCall: data["activeAttentionCall"] ?? null,
        attentionCallActiveTicks: getNumber("attentionCallActiveTicks", 0),
        attentionCallCooldowns: getCooldowns(),
        // Back-compat: old saves used "neglectCount"; migrate to careMistakes.
        careMistakes: getNumber("careMistakes", getNumber("neglectCount", 0)),
        lifetimeCareMistakes: getNumber("lifetimeCareMistakes", getNumber("neglectCount", 0)),
        ticksWithUncleanedPoop: getNumber("ticksWithUncleanedPoop", 0),
        poopOverLimitTicks: getNumber("poopOverLimitTicks", 0),
        ticksSinceLastMisbehaviour: getNumber("ticksSinceLastMisbehaviour", 0),
        ticksSinceLastGift: getNumber("ticksSinceLastGift", 0),
        ticksSinceLastPlayCall: getNumber("ticksSinceLastPlayCall", 0),
        ticksSinceLastPatCall: getNumber("ticksSinceLastPatCall", 0),
        ticksSinceLastCraving: getNumber("ticksSinceLastCraving", 0),
        ticksSinceLastBreakCall: getNumber("ticksSinceLastBreakCall", 0),
        breakNapTicksRemaining: getNumber("breakNapTicksRemaining", 0),
        cravingFood: data["cravingFood"] === "meal" || data["cravingFood"] === "snack" ? data["cravingFood"] : null,
        devModeEverUsed: getBool("devModeEverUsed", false),
        leaderboardIneligible: data["leaderboardIneligible"] === "tampered" || data["leaderboardIneligible"] === "unverified"
            ? data["leaderboardIneligible"] : "",
        // Version 0 (no schemaVersion) → 1: progression fields start empty.
        schemaVersion: SCHEMA_VERSION,
        petXp: Math.max(0, getNumber("petXp", 0)),
        petLevel: levelProgress(getNumber("petXp", 0)).level,
        trainer: deserialiseTrainer(data["trainer"]),
        dailies: deserialiseDailies(data["dailies"]),
    };
    return withDerivedFields(partial);
}
//# sourceMappingURL=gameEngine.js.map