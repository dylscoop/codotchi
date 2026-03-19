/**
 * gameEngine.ts
 *
 * Pure-TypeScript game engine for vscode_gotchi.
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
export const TICK_INTERVAL_SECONDS: number = 6;

const TICKS_PER_MINUTE: number = 60 / TICK_INTERVAL_SECONDS;
const TICKS_PER_HOUR: number = 60 * TICKS_PER_MINUTE;

/** Duration of the egg stage in ticks. */
export const EGG_DURATION_TICKS: number = 2 * TICKS_PER_MINUTE;
/** Duration of the baby stage in ticks. */
export const BABY_DURATION_TICKS: number = 28 * TICKS_PER_MINUTE;
/** Duration of the child stage in ticks. */
export const CHILD_DURATION_TICKS: number = 90 * TICKS_PER_MINUTE;
/** Duration of the teen stage in ticks. */
export const TEEN_DURATION_TICKS: number = 6 * TICKS_PER_HOUR;
/** Duration of the adult stage in ticks (used as a seed for tests). */
export const ADULT_DURATION_TICKS: number = 16 * TICKS_PER_HOUR;

const STAT_MIN: number = 0;
const STAT_MAX: number = 100;
const WEIGHT_MIN: number = 1;
const WEIGHT_MAX: number = 99;

const HUNGER_DECAY_PER_TICK: number = 1;
const HAPPINESS_DECAY_PER_TICK: number = 1;
const ENERGY_REGEN_PER_TICK_SLEEPING: number = 3;

const HUNGER_CRITICAL_THRESHOLD: number = 10;
const HAPPINESS_CRITICAL_THRESHOLD: number = 10;
const HEALTH_DEATH_THRESHOLD: number = 0;
/** Consecutive ticks at hunger === 0 before health starts dropping. */
const HUNGER_ZERO_TICKS_BEFORE_RISK: number = 3;
/** Health lost per tick when starving, happiness-critical, or sick. */
const CRITICAL_HEALTH_DAMAGE_PER_TICK: number = 5;

const MAX_CONSECUTIVE_SNACKS_BEFORE_SICK: number = 3;
const MAX_UNCLEANED_POOPS_BEFORE_SICK: number = 3;

/** Maximum snacks allowed per wake cycle before further snacks are refused. */
export const SNACK_MAX_PER_CYCLE: number = 3;

/** Maximum number of events kept in recentEventLog. */
const RECENT_EVENT_LOG_MAX: number = 20;
/** Ticks between droppings (≈ 20 real minutes). */
const POOP_TICKS_INTERVAL: number = 20 * TICKS_PER_MINUTE;

const FEED_MEAL_HUNGER_BOOST: number = 20;
const FEED_MEAL_WEIGHT_GAIN: number = 2;
const FEED_MEAL_MAX_PER_CYCLE: number = 3;

const FEED_SNACK_HAPPINESS_BOOST: number = 5;
const FEED_SNACK_HUNGER_BOOST: number = 5;
const FEED_SNACK_WEIGHT_GAIN: number = 5;

const PLAY_HAPPINESS_BOOST: number = 15;
const PLAY_ENERGY_COST: number = 25;
const PLAY_WEIGHT_LOSS: number = 3;

const PAT_HAPPINESS_BOOST: number = 10;
const PAT_ENERGY_COST: number = 20;
/** Weight lost when the pet is patted (BUGFIX-034). */
const PAT_WEIGHT_LOSS: number = 3;
/** Additional weight lost for left_right and higher_lower mini-games (BUGFIX-034).
 *  These games are more vigorous than coin_flip; total loss = PLAY_WEIGHT_LOSS + PLAY_WEIGHT_LOSS_BONUS = 6. */
const PLAY_WEIGHT_LOSS_BONUS: number = 3;
const POOP_WEIGHT_LOSS: number = 5;

/** Ticks between passive weight decay pulses (1 weight per interval = 1 per minute). */
const WEIGHT_DECAY_TICK_INTERVAL: number = TICKS_PER_MINUTE; // 10 ticks = 1 min

/** Weight above which happiness decays 1.5× faster. */
const WEIGHT_HAPPINESS_HIGH_THRESHOLD: number = 66;
/** Weight below which happiness decays 1.5× faster. */
const WEIGHT_HAPPINESS_LOW_THRESHOLD: number = 17;
/** Happiness decay multiplier when weight is at an extreme. */
const WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER: number = 1.5;

/** Weight above which the sprite is drawn 1.25× wider. */
export const WEIGHT_SLIGHTLY_FAT_THRESHOLD: number = 50;
/** Weight above which the sprite is drawn 1.5× wider. */
export const WEIGHT_OVERWEIGHT_THRESHOLD: number = 80;

/** Passive energy drain per tick while awake — throttled by idle just like hunger/happiness. */
const ENERGY_DECAY_PER_TICK: number = 1;

/** Health lost per tick when the pet's energy is fully depleted while awake. Slower than other critical conditions. */
const EXHAUSTION_HEALTH_DAMAGE_PER_TICK: number = 2;

/** While sleeping, hunger and happiness decay once every this many ticks (very slow drain). */
const SLEEP_DECAY_TICK_INTERVAL: number = 5;

const MEDICINE_DOSES_TO_CURE: number = 3;

/** Ticks between passive health regen pulses while awake (1 hp per interval). */
const HEALTH_REGEN_AWAKE_TICK_INTERVAL: number = 5;

const DISCIPLINE_BOOST_PER_ACTION: number = 10;

const CODE_ACTIVITY_HAPPINESS_BOOST: number = 5;
const CODE_ACTIVITY_DISCIPLINE_BOOST: number = 2;
/** Minimum seconds between code-activity happiness boosts. */
export const CODE_ACTIVITY_THROTTLE_SECONDS: number = 30;

/**
 * Seconds of no IDE activity (no keystrokes, cursor movement, or window focus)
 * before the pet is considered "idle" and decay is reduced to IDLE_DECAY_FRACTION.
 */
export const IDLE_THRESHOLD_SECONDS: number = 60; // 1 minute

/**
 * Seconds of sustained idle before entering "deep idle": stats are floored at
 * IDLE_STAT_FLOOR and aging stops completely.
 */
export const IDLE_DEEP_THRESHOLD_SECONDS: number = 600; // 10 minutes

/**
 * Minimum stat value (hunger, happiness) enforced while in deep idle.
 * Expressed as a 0-100 value (20 = 20%).
 */
export const IDLE_STAT_FLOOR: number = 20;

/**
 * When the user is idle, hunger and happiness decay at this fraction of the
 * normal rate (applied by skipping decay on most ticks — 1 in every
 * IDLE_DECAY_TICK_DIVISOR ticks actually decays).
 */
const IDLE_DECAY_TICK_DIVISOR: number = 10; // 10% of normal rate

const MINIGAME_WIN_HAPPINESS_BOOST: number = 15;   // legacy "guess" fallback
const MINIGAME_LOSE_HAPPINESS_BOOST: number = 5;   // legacy "guess" fallback
const MINIGAME_MEMORY_WIN_HAPPINESS_BOOST: number = 20;
// Left/Right: play baseline +15; delta win +5–+15, lose −5 → totals: win 20–30, lose 10
const MINIGAME_LR_WIN_MIN: number = 5;
const MINIGAME_LR_WIN_MAX: number = 15;
const MINIGAME_LR_LOSE_DELTA: number = -5;
// Higher/Lower: play baseline +15; delta win +10–+20, lose −5 → totals: win 25–35, lose 10
const MINIGAME_HL_WIN_MIN: number = 10;
const MINIGAME_HL_WIN_MAX: number = 20;
const MINIGAME_HL_LOSE_DELTA: number = -5;
// Coin Flip: play baseline +15; delta win 0, lose −10 → totals: win 15, lose 5
const MINIGAME_COIN_FLIP_WIN: number = 0;
const MINIGAME_COIN_FLIP_LOSE: number = -10;

const CARE_SCORE_HUNGER_WEIGHT: number = 0.30;
const CARE_SCORE_HAPPINESS_WEIGHT: number = 0.25;
const CARE_SCORE_DISCIPLINE_WEIGHT: number = 0.20;
const CARE_SCORE_CLEANLINESS_WEIGHT: number = 0.15;
const CARE_SCORE_HEALTH_WEIGHT: number = 0.10;

const CARE_SCORE_BEST_TIER_THRESHOLD: number = 0.80;
const CARE_SCORE_MID_TIER_THRESHOLD: number = 0.55;

/** Maximum fraction of any stat that can be lost while the extension is off. */
const OFFLINE_DECAY_MAX_FRACTION: number = 0.60;

// ---------------------------------------------------------------------------
// Attention Call constants
// ---------------------------------------------------------------------------

/** Active (non-idle) ticks the player has to respond before a call expires (20 × 6 s = 2 min). */
export const ATTENTION_CALL_RESPONSE_TICKS: number = 20;

/** Hunger stat at or below which a hunger attention call fires. */
export const ATTENTION_HUNGER_THRESHOLD: number = 25;
/** Happiness stat at or below which an unhappiness attention call fires. */
export const ATTENTION_UNHAPPINESS_THRESHOLD: number = 40;
/** Energy stat at or below which a low_energy attention call fires. */
export const ATTENTION_ENERGY_THRESHOLD: number = 20;
/** Health stat at or below which a critical_health attention call fires. */
export const ATTENTION_HEALTH_THRESHOLD: number = 50;

/** Cooldown ticks (50 = 5 min) applied to a call type after it is answered. */
export const ATTENTION_ANSWER_COOLDOWN_TICKS: number = 50;
/** Cooldown ticks (20 = 2 min) applied to a call type after it expires unanswered. */
export const ATTENTION_EXPIRY_COOLDOWN_TICKS: number = 20;
/** Stat penalty applied to the relevant stat when an attention call expires. */
export const ATTENTION_EXPIRY_STAT_PENALTY: number = 10;

/** Happiness boost applied when a gift attention call is answered via praise(). */
export const GIFT_PRAISE_HAPPINESS_BOOST: number = 15;

/** neglectCount decrements by 1 every this many ticks (300 × 6 s = 30 min). */
export const NEGLECT_DECAY_TICK_INTERVAL: number = 300;

// Logarithmic random-chance tuning constants for probabilistic calls.
export const POOP_CALL_BASE_CHANCE: number = 0.03;
export const POOP_CALL_MAX_CHANCE: number = 0.12;
export const MISBEHAVIOUR_BASE_CHANCE: number = 0.005;
export const MISBEHAVIOUR_MAX_CHANCE: number = 0.08;
export const GIFT_BASE_CHANCE: number = 0.002;
export const GIFT_MAX_CHANCE: number = 0.05;

/** Age in game days at which a senior pet may die of old age (365 game days = 1 in-game year). */
export const SENIOR_NATURAL_DEATH_AGE_DAYS: number = 365;

/**
 * Ticks elapsed while awake before the day timer advances by 1.0 (1 game day = 5 real minutes awake).
 * 5 min × 60 s ÷ 6 s/tick = 50 ticks.
 */
export const TICKS_PER_GAME_DAY_AWAKE: number = 5 * TICKS_PER_MINUTE;

/**
 * Ticks elapsed while sleeping before the day timer advances by 1.0 (≈ 4 min asleep = 1 day,
 * ~25% faster than awake).
 */
export const TICKS_PER_GAME_DAY_SLEEPING: number = Math.round(5 * TICKS_PER_MINUTE * 0.8);

// ---------------------------------------------------------------------------
// Types (ported from python/models.py)
// ---------------------------------------------------------------------------

/**
 * Runtime configuration passed into tick() on every game step.
 * Populated from VS Code settings so players can tune timing behaviour.
 */
export interface GameConfig {
  /** Whether the attention-call mechanic is active at all. */
  attentionCallsEnabled: boolean;
  /**
   * Response-window in ticks for poop, misbehaviour, and gift calls.
   * needy=20 (2 min), standard=50 (5 min), chilled=100 (10 min).
   */
  attentionCallExpiryTicks: number;
  /**
   * Divisor applied to the base and max logChance probabilities for all
   * probabilistic call spawns (poop, misbehaviour, gift).
   * fast=1.0, medium=1.5, slow=2.0.
   */
  attentionCallRateDivisor: number;
  /**
   * When true, developer mode is active:
   *   - Health is floored at 1 (the pet cannot die from stat decay or old age).
   *   - Aging is multiplied by devModeAgingMultiplier.
   *   - Deaths never update the high score.
   * Activated by setting gotchi.developerPasscode to "1234".
   */
  devMode: boolean;
  /**
   * Aging speed multiplier applied on top of the per-type agingMultiplier
   * when devMode is true. Default is 10 (10× faster than normal).
   */
  devModeAgingMultiplier: number;
  /**
   * Minimum health enforced when devMode is true.
   * Default 1 means the pet cannot die from stat decay or old age.
   * Set to 0 to allow the pet to die normally even in dev mode.
   */
  devModeHealthFloor: number;
}

/** Sensible defaults used when no explicit config is provided. */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  attentionCallsEnabled:    true,
  attentionCallExpiryTicks: 50,   // "standard" = 5 min
  attentionCallRateDivisor: 1.0,  // "fast"
  devMode:                  false,
  devModeAgingMultiplier:   10,
  devModeHealthFloor:       1,
};

/** Per-type stat multipliers applied on top of base config constants. */
interface PetTypeModifiers {
  readonly hungerDecayMultiplier: number;
  readonly happinessDecayMultiplier: number;
  readonly baseHealth: number;
  readonly energyRegenMultiplier: number;
  /**
   * Average poop interval as a fraction of POOP_TICKS_INTERVAL (20 min).
   * 1.0 = every 20 min on average; 0.5 = every 10 min on average.
   * Must be in the range (0, 1].
   */
  readonly poopIntervalMultiplier: number;
  /**
   * Fractional jitter applied to the poop interval each time the pet poops.
   * The next interval is sampled as:
   *   base ± jitter × base   (uniform distribution, clamped to [1, base × 2])
   * 0.0 = perfectly regular; 0.9 = highly unpredictable.
   */
  readonly poopIntervalVolatility: number;
  /**
   * Multiplier applied to the dayTimer increment each tick (and in offline
   * decay).  Values > 1.0 make the pet age faster in real time; values < 1.0
   * make it age slower.  1.0 is the Codeling baseline.
   */
  readonly agingMultiplier: number;
}

const PET_TYPE_MODIFIERS: Record<string, PetTypeModifiers> = {
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
export const VALID_PET_TYPES: readonly string[] = Object.keys(PET_TYPE_MODIFIERS);

/** Life-stage names in order. */
export const STAGE_ORDER: readonly string[] = [
  "egg",
  "baby",
  "child",
  "teen",
  "adult",
  "senior",
];

/** Evolution character name lookup: petType → stage → tier → characterName. */
const EVOLUTION_CHARACTERS: Record<string, Record<string, Record<string, string>>> = {
  codeling: {
    baby: { best: "codeling_baby_a", mid: "codeling_baby_b", low: "codeling_baby_c" },
    child: { best: "codeling_child_a", mid: "codeling_child_b", low: "codeling_child_c" },
    teen: { best: "codeling_teen_a", mid: "codeling_teen_b", low: "codeling_teen_c" },
    adult: { best: "codeling_adult_a", mid: "codeling_adult_b", low: "codeling_adult_c" },
    senior: { best: "codeling_senior_a", mid: "codeling_senior_b", low: "codeling_senior_c" },
  },
  bytebug: {
    baby: { best: "bytebug_baby_a", mid: "bytebug_baby_b", low: "bytebug_baby_c" },
    child: { best: "bytebug_child_a", mid: "bytebug_child_b", low: "bytebug_child_c" },
    teen: { best: "bytebug_teen_a", mid: "bytebug_teen_b", low: "bytebug_teen_c" },
    adult: { best: "bytebug_adult_a", mid: "bytebug_adult_b", low: "bytebug_adult_c" },
    senior: { best: "bytebug_senior_a", mid: "bytebug_senior_b", low: "bytebug_senior_c" },
  },
  pixelpup: {
    baby: { best: "pixelpup_baby_a", mid: "pixelpup_baby_b", low: "pixelpup_baby_c" },
    child: { best: "pixelpup_child_a", mid: "pixelpup_child_b", low: "pixelpup_child_c" },
    teen: { best: "pixelpup_teen_a", mid: "pixelpup_teen_b", low: "pixelpup_teen_c" },
    adult: { best: "pixelpup_adult_a", mid: "pixelpup_adult_b", low: "pixelpup_adult_c" },
    senior: { best: "pixelpup_senior_a", mid: "pixelpup_senior_b", low: "pixelpup_senior_c" },
  },
  shellscript: {
    baby: { best: "shellscript_baby_a", mid: "shellscript_baby_b", low: "shellscript_baby_c" },
    child: { best: "shellscript_child_a", mid: "shellscript_child_b", low: "shellscript_child_c" },
    teen: { best: "shellscript_teen_a", mid: "shellscript_teen_b", low: "shellscript_teen_c" },
    adult: { best: "shellscript_adult_a", mid: "shellscript_adult_b", low: "shellscript_adult_c" },
    senior: {
      best: "shellscript_senior_a",
      mid: "shellscript_senior_b",
      low: "shellscript_senior_c",
    },
  },
};

// ---------------------------------------------------------------------------
// PetState interface — the single source of truth for in-memory pet state
// ---------------------------------------------------------------------------

/**
 * All valid attention call type identifiers.
 * A call of each type can be active at most once at any given time.
 */
export type AttentionCallType =
  | "hunger"
  | "unhappiness"
  | "poop"
  | "sick"
  | "low_energy"
  | "misbehaviour"
  | "gift"
  | "critical_health";

/**
 * Full serialisable snapshot of the pet's state.
 *
 * All integer stats are in the range [0, 100] unless documented otherwise.
 * This interface is used for both the in-memory representation and
 * persistence via VS Code's globalState API.
 */
export interface PetState {
  // Identity
  readonly name: string;
  readonly petType: string;
  readonly color: string;

  // Core stats
  readonly hunger: number;
  readonly happiness: number;
  readonly discipline: number;
  readonly energy: number;
  readonly health: number;
  /** Valid range: [1, 99]. */
  readonly weight: number;
  readonly ageDays: number;

  // Life-cycle
  readonly stage: string;
  readonly character: string;
  readonly alive: boolean;
  readonly sick: boolean;
  readonly sleeping: boolean;

  // Derived display fields
  readonly mood: string;
  readonly sprite: string;
  readonly careScore: number;

  // Bookkeeping
  readonly ticksAlive: number;
  readonly poops: number;
  readonly ticksSinceLastPoop: number;
  /**
   * How many ticks must elapse after the last dropping before the next one.
   *
   * Sampled fresh each time the pet poops using the type's
   * `poopIntervalMultiplier` and `poopIntervalVolatility`.  Stored so the
   * value is stable between ticks (no re-roll every tick) and survives
   * serialisation.
   */
  readonly nextPoopIntervalTicks: number;
  readonly consecutiveSnacks: number;
  readonly hungerZeroTicks: number;
  readonly medicineDosesGiven: number;

  /**
   * Monotonically-increasing fractional day counter.
   * `ageDays` is derived as `Math.floor(dayTimer)` each tick.
   * Advances by `1 / TICKS_PER_GAME_DAY_SLEEPING` per tick while sleeping,
   * or `1 / TICKS_PER_GAME_DAY_AWAKE` per tick while awake.
   */
  readonly dayTimer: number;

  // Care-quality accumulators
  readonly careScoreHungerSum: number;
  readonly careScoreHappinessSum: number;
  readonly careScoreHealthSum: number;
  readonly careScoreTicks: number;

  // Events emitted during the last action (cleared on each new action)
  readonly events: readonly string[];

  // Persistent rolling log of the last 20 events (survives across actions)
  readonly recentEventLog: readonly string[];

  /** Whether the IDE was idle on the previous tick (used to detect idle transition). */
  readonly wasIdle: boolean;

  /** Whether the IDE was in deep idle (≥10 min) on the previous tick. */
  readonly wasDeepIdle: boolean;

  /** Unix ms timestamp when this pet was first created (spawnedAt). */
  readonly spawnedAt: number;

  /** Snacks given in the current wake cycle (resets on wake/createPet). */
  readonly snacksGivenThisCycle: number;

  // ── Attention Call fields ────────────────────────────────────────────────

  /** The currently active attention call type, or null if none is active. */
  readonly activeAttentionCall: AttentionCallType | null;

  /** Number of active (non-idle) ticks elapsed since the current attention call fired. */
  readonly attentionCallActiveTicks: number;

  /** Per-type cooldown counters (ticks remaining). Decremented each tick. */
  readonly attentionCallCooldowns: Partial<Record<AttentionCallType, number>>;

  /** Cumulative count of attention calls that expired unanswered (decays slowly over time). */
  readonly neglectCount: number;

  /** Ticks the current poop(s) have remained uncleaned; resets to 0 when poops === 0. */
  readonly ticksWithUncleanedPoop: number;

  /** Ticks since the last misbehaviour attention call fired; used for log-chance formula. */
  readonly ticksSinceLastMisbehaviour: number;

  /** Ticks since the last gift attention call fired; used for log-chance formula. */
  readonly ticksSinceLastGift: number;
}

// ---------------------------------------------------------------------------
// HighScore — persisted record of the best run
// ---------------------------------------------------------------------------

/**
 * Summary of the best run ever recorded for this installation.
 * Compared by ageDays; ties broken by real-world elapsed time (longer wins).
 */
export interface HighScore {
  /** In-game days lived (primary sort key). */
  readonly ageDays: number;
  readonly name: string;
  readonly stage: string;
  readonly petType: string;
  readonly color: string;
  /** Unix ms when the pet was created. */
  readonly spawnedAt: number;
  /** Unix ms when the pet died (used to compute real elapsed time). */
  readonly diedAt: number;
}

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
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Clamp a standard 0–100 stat.
 *
 * @param value - The stat value to clamp.
 * @returns Value clamped to [STAT_MIN, STAT_MAX].
 */
function clampStat(value: number): number {
  return clamp(value, STAT_MIN, STAT_MAX);
}

/**
 * Clamp weight to its valid range [WEIGHT_MIN, WEIGHT_MAX].
 *
 * @param value - The weight value to clamp.
 * @returns Value clamped to [WEIGHT_MIN, WEIGHT_MAX].
 */
function clampWeight(value: number): number {
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
function logChance(ticksSinceLast: number, base: number, max: number): number {
  return Math.min(max, base * Math.log(ticksSinceLast + Math.E));
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
export function sampleNextPoopInterval(petType: string): number {
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
export function moodFromStats(
  hunger: number,
  happiness: number,
  health: number,
  sleeping: boolean
): string {
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
 * Return the evolution tier string for the given care score.
 *
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns One of: "best" | "mid" | "low".
 */
export function tierFromCareScore(careScore: number): string {
  if (careScore >= CARE_SCORE_BEST_TIER_THRESHOLD) {
    return "best";
  }
  if (careScore >= CARE_SCORE_MID_TIER_THRESHOLD) {
    return "mid";
  }
  return "low";
}

/**
 * Resolve the character name for a pet type at a given stage and care score.
 *
 * @param petType - The pet type identifier.
 * @param stage - The life stage name.
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns The character name string.
 */
export function characterForStage(
  petType: string,
  stage: string,
  careScore: number
): string {
  const tier = tierFromCareScore(careScore);
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
export function computeCareScore(state: PetState): number {
  if (state.careScoreTicks === 0) {
    return 0.5;
  }
  const averageHunger = state.careScoreHungerSum / state.careScoreTicks;
  const averageHappiness = state.careScoreHappinessSum / state.careScoreTicks;
  const averageHealth = state.careScoreHealthSum / state.careScoreTicks;
  const cleanlinessNormalised = clampStat(100 - state.poops * 20) / STAT_MAX;

  return (
    CARE_SCORE_HUNGER_WEIGHT * (averageHunger / STAT_MAX) +
    CARE_SCORE_HAPPINESS_WEIGHT * (averageHappiness / STAT_MAX) +
    CARE_SCORE_DISCIPLINE_WEIGHT * (state.discipline / STAT_MAX) +
    CARE_SCORE_CLEANLINESS_WEIGHT * cleanlinessNormalised +
    CARE_SCORE_HEALTH_WEIGHT * (averageHealth / STAT_MAX)
  );
}

/**
 * Return a human-readable care tier label for a given care score.
 *
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns One of: "Excellent" | "Good" | "Poor".
 */
export function careTierLabel(careScore: number): string {
  const tier = tierFromCareScore(careScore);
  const labels: Record<string, string> = { best: "Excellent", mid: "Good", low: "Poor" };
  return labels[tier];
}

// ---------------------------------------------------------------------------
// Factory — create a new pet
// ---------------------------------------------------------------------------

/**
 * Create a brand-new pet state at stage "egg" with default stats.
 *
 * @param name - The player-chosen name for the pet.
 * @param petType - One of the valid pet type identifiers.
 * @param color - The colour palette name (e.g. "neon", "pastel").
 * @returns A freshly initialised PetState.
 */
export function createPet(name: string, petType: string, color: string): PetState {
  const modifiers = PET_TYPE_MODIFIERS[petType] ?? PET_TYPE_MODIFIERS.codeling;
  const baseHealth = modifiers.baseHealth;

  const partial: Omit<PetState, "mood" | "sprite" | "careScore"> = {
    name,
    petType,
    color,
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
    snacksGivenThisCycle: 0,
    dayTimer: 0,
    activeAttentionCall: null,
    attentionCallActiveTicks: 0,
    attentionCallCooldowns: {},
    neglectCount: 0,
    ticksWithUncleanedPoop: 0,
    ticksSinceLastMisbehaviour: 0,
    ticksSinceLastGift: 0,
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
function withDerivedFields(
  partial: Omit<PetState, "mood" | "sprite" | "careScore">
): PetState {
  const careScore = computeCareScore(partial as PetState);
  const mood = moodFromStats(partial.hunger, partial.happiness, partial.health, partial.sleeping);
  const sprite = `${partial.stage}_${mood}`;
  // Append current events to the rolling log (capped at RECENT_EVENT_LOG_MAX)
  const newLog = (partial.events as string[]).length > 0
    ? [...(partial.recentEventLog as string[]), ...(partial.events as string[])].slice(-RECENT_EVENT_LOG_MAX)
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
function weightTierOf(w: number): number {
  if (w > WEIGHT_OVERWEIGHT_THRESHOLD)   { return 3; }
  if (w > WEIGHT_SLIGHTLY_FAT_THRESHOLD) { return 2; }
  if (w < WEIGHT_HAPPINESS_LOW_THRESHOLD) { return 0; }
  return 1;
}

/**
 * Compare the weight tiers before and after a change and push crossing events
 * onto the provided events array.
 */
function checkWeightTierEvents(prev: number, next: number, events: string[]): void {
  const pt = weightTierOf(prev);
  const nt = weightTierOf(next);
  if (pt === nt) { return; }
  if (nt === 3)              { events.push("weight_became_overweight"); }
  else if (nt === 2 && pt < 2) { events.push("weight_became_slightly_fat"); }
  else if (nt === 0)         { events.push("weight_became_too_skinny"); }
  else if (pt === 3)         { events.push("weight_no_longer_overweight"); }
  else if (pt === 0)         { events.push("weight_no_longer_too_skinny"); }
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
export function tick(state: PetState, isIdle: boolean = false, isDeepIdle: boolean = false, config: GameConfig = DEFAULT_GAME_CONFIG): PetState {
  if (!state.alive) {
    return state;
  }

  const modifiers = PET_TYPE_MODIFIERS[state.petType] ?? PET_TYPE_MODIFIERS.codeling;
  const events: string[] = [];
  let hunger: number = state.hunger;
  let happiness: number = state.happiness;
  let energy: number = state.energy;
  let health: number = state.health;
  let weight: number = state.weight;
  let poops: number = state.poops;
  let ticksSinceLastPoop: number = state.ticksSinceLastPoop;
  let nextPoopIntervalTicks: number = state.nextPoopIntervalTicks;
  let hungerZeroTicks: number = state.hungerZeroTicks;
  let sick: boolean = state.sick;
  let alive: boolean = state.alive;
  let sleeping: boolean = state.sleeping;
  let ageDays: number = state.ageDays;
  const ticksAlive = state.ticksAlive + 1;

  // Attention call mutable state
  let activeAttentionCall: AttentionCallType | null = state.activeAttentionCall;
  let attentionCallActiveTicks: number = state.attentionCallActiveTicks;
  let attentionCallCooldowns: Partial<Record<AttentionCallType, number>> = { ...state.attentionCallCooldowns };
  let neglectCount: number = state.neglectCount;
  let ticksWithUncleanedPoop: number = state.ticksWithUncleanedPoop;
  let ticksSinceLastMisbehaviour: number = state.ticksSinceLastMisbehaviour;
  let ticksSinceLastGift: number = state.ticksSinceLastGift;

  // Capture sleeping state at tick entry so day-timer uses it even if auto-wake fires mid-tick
  const sleepingAtTickStart = sleeping;

  // Stat decay
  // When idle, hunger/happiness/aging advance at only 1/IDLE_DECAY_TICK_DIVISOR of the normal rate.
  const decayThisTick = !isIdle || (ticksAlive % IDLE_DECAY_TICK_DIVISOR === 0);
  if (!state.wasIdle && isIdle) {
    events.push("went_idle");
  }
  if (!state.wasDeepIdle && isDeepIdle) {
    events.push("went_deep_idle");
  }

  if (config.attentionCallsEnabled) {
  // ── Step 0: Maintain log counters (every tick, even idle) ────────────────
  if (poops > 0) {
    ticksWithUncleanedPoop += 1;
  } else {
    ticksWithUncleanedPoop = 0;
  }
  ticksSinceLastMisbehaviour += 1;
  ticksSinceLastGift += 1;
  // Neglect decay: recover 1 neglect point every 300 ticks
  if (ticksAlive % NEGLECT_DECAY_TICK_INTERVAL === 0 && neglectCount > 0) {
    neglectCount = Math.max(0, neglectCount - 1);
  }
  } // end Step 0

  if (!sleeping) {
    if (decayThisTick) {
      const hungerDecay = Math.ceil(HUNGER_DECAY_PER_TICK * modifiers.hungerDecayMultiplier);
      const weightHappinessMult = (state.weight > WEIGHT_HAPPINESS_HIGH_THRESHOLD || state.weight < WEIGHT_HAPPINESS_LOW_THRESHOLD)
        ? WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER : 1.0;
      const happinessDecay = Math.ceil(
        HAPPINESS_DECAY_PER_TICK * modifiers.happinessDecayMultiplier * weightHappinessMult
      );
      hunger = clampStat(hunger - hungerDecay);
      happiness = clampStat(happiness - happinessDecay);
      // Energy is throttled by idle just like hunger/happiness (BUGFIX-014)
      energy = clampStat(energy - ENERGY_DECAY_PER_TICK);
    }
    // Deep idle: floor stats at IDLE_STAT_FLOOR so they never drop below 20%
    if (isDeepIdle) {
      hunger = Math.max(hunger, IDLE_STAT_FLOOR);
      happiness = Math.max(happiness, IDLE_STAT_FLOOR);
    }
  } else {
    const energyRegen = Math.ceil(
      ENERGY_REGEN_PER_TICK_SLEEPING * modifiers.energyRegenMultiplier
    );
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

  // Sickness from dirty environment — only fires when the IDE is active so the
  // pet cannot be made sick by accumulated poop during idle or while closed.
  if (poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK && !sick && !isIdle) {
    sick = true;
    events.push("became_sick");
  }

  // Starvation counter
  if (hunger === STAT_MIN) {
    hungerZeroTicks += 1;
  } else {
    hungerZeroTicks = 0;
  }

  // Starvation damage — also triggers sickness so medicine can cure it
  if (hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK) {
    health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
    events.push("starvation_damage");
    if (!sick) {
      sick = true;
      events.push("became_sick");
    }
  }

  // Happiness-critical health drain
  if (happiness === STAT_MIN && !sleeping) {
    health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
    events.push("unhappiness_damage");
  }

  // Energy-exhaustion health drain (slower than hunger/happiness critical)
  if (energy === STAT_MIN && !sleeping) {
    health = clampStat(health - EXHAUSTION_HEALTH_DAMAGE_PER_TICK);
    events.push("exhaustion_damage");
  }

  // Sickness health drain
  if (sick) {
    health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
    events.push("sickness_damage");
  }

  // BUGFIX-004: passive health regen — full rate while sleeping, much slower awake
  if (!sick && health < STAT_MAX) {
    if (sleeping) {
      health = clampStat(health + 1);
    } else if (ticksAlive % HEALTH_REGEN_AWAKE_TICK_INTERVAL === 0) {
      health = clampStat(health + 1);
    }
  }

  // ── Step 1: Advance active call timer (non-idle ticks only) ────────────────
  if (config.attentionCallsEnabled) {
  if (activeAttentionCall !== null && !isIdle) {
    attentionCallActiveTicks += 1;
    // poop / misbehaviour / gift use the configurable expiry window;
    // all other call types use the fixed 2-minute (20-tick) window.
    const expiryTicks = (activeAttentionCall === "poop" ||
                         activeAttentionCall === "misbehaviour" ||
                         activeAttentionCall === "gift")
      ? config.attentionCallExpiryTicks
      : ATTENTION_CALL_RESPONSE_TICKS;
    if (attentionCallActiveTicks >= expiryTicks) {
      // Call expired — apply stat penalty
      const expiredType = activeAttentionCall;
      events.push(`attention_call_expired_${expiredType}`);
      switch (expiredType) {
        case "critical_health": health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY); happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY); break;
        case "sick":            health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY); break;
        case "poop":            if (!sick) { sick = true; events.push("became_sick"); } break;
        case "hunger":          hunger = clampStat(hunger - ATTENTION_EXPIRY_STAT_PENALTY); break;
        case "unhappiness":     happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY); break;
        case "misbehaviour":    health = clampStat(health - ATTENTION_EXPIRY_STAT_PENALTY); neglectCount += 1; break;
        case "low_energy":      happiness = clampStat(happiness - ATTENTION_EXPIRY_STAT_PENALTY); break;
        case "gift":            happiness = clampStat(happiness - 5); neglectCount += 1; break;
      }
      // General neglect increment (except misbehaviour and gift which have their own above)
      if (expiredType !== "misbehaviour" && expiredType !== "gift") {
        neglectCount += 1;
      }
      attentionCallCooldowns[expiredType] = ATTENTION_EXPIRY_COOLDOWN_TICKS;
      activeAttentionCall = null;
      attentionCallActiveTicks = 0;
    }
  }

  // ── Step 2: Decrement all cooldowns ────────────────────────────────────────
  for (const type of Object.keys(attentionCallCooldowns) as AttentionCallType[]) {
    const remaining = (attentionCallCooldowns[type] ?? 0) - 1;
    attentionCallCooldowns[type] = Math.max(0, remaining);
  }

  // ── Step 3: Fire new call if none active ────────────────────────────────────
  // Compute mood for gift condition (uses post-decay stats)
  const currentMood = moodFromStats(hunger, happiness, health, sleeping);

  if (activeAttentionCall === null) {
    const cooldownClear = (t: AttentionCallType): boolean => !(attentionCallCooldowns[t] ?? 0);
    const rd = config.attentionCallRateDivisor;
    // Poop call fires even while sleeping (poops accumulate regardless).
    // All other calls are suppressed while the pet is asleep.
    if (poops >= 1 && cooldownClear("poop") &&
               Math.random() < logChance(ticksWithUncleanedPoop, POOP_CALL_BASE_CHANCE / rd, POOP_CALL_MAX_CHANCE / rd)) {
      activeAttentionCall = "poop";
      attentionCallActiveTicks = 0;
      events.push("attention_call_poop");
    } else if (!sleeping && health <= ATTENTION_HEALTH_THRESHOLD && cooldownClear("critical_health")) {
      activeAttentionCall = "critical_health";
      attentionCallActiveTicks = 0;
      events.push("attention_call_critical_health");
    } else if (!sleeping && sick && cooldownClear("sick")) {
      activeAttentionCall = "sick";
      attentionCallActiveTicks = 0;
      events.push("attention_call_sick");
    } else if (!sleeping && hunger <= ATTENTION_HUNGER_THRESHOLD && cooldownClear("hunger")) {
      activeAttentionCall = "hunger";
      attentionCallActiveTicks = 0;
      events.push("attention_call_hunger");
    } else if (!sleeping && happiness <= ATTENTION_UNHAPPINESS_THRESHOLD && cooldownClear("unhappiness")) {
      activeAttentionCall = "unhappiness";
      attentionCallActiveTicks = 0;
      events.push("attention_call_unhappiness");
    } else if (!sleeping && cooldownClear("misbehaviour") &&
               Math.random() < logChance(ticksSinceLastMisbehaviour, MISBEHAVIOUR_BASE_CHANCE / rd, MISBEHAVIOUR_MAX_CHANCE / rd)) {
      activeAttentionCall = "misbehaviour";
      attentionCallActiveTicks = 0;
      ticksSinceLastMisbehaviour = 0;
      events.push("attention_call_misbehaviour");
    } else if (!sleeping && energy <= ATTENTION_ENERGY_THRESHOLD && cooldownClear("low_energy")) {
      activeAttentionCall = "low_energy";
      attentionCallActiveTicks = 0;
      events.push("attention_call_low_energy");
    } else if (!sleeping && cooldownClear("gift") &&
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

  // Dev mode: configurable health floor — prevents death from stat decay or old age
  // when devModeHealthFloor > 0 (default 1). Set floor to 0 to allow death in dev mode.
  if (config.devMode && health <= config.devModeHealthFloor) {
    health = config.devModeHealthFloor;
  }

  // Death check
  if (health <= HEALTH_DEATH_THRESHOLD) {
    alive = false;
    events.push("died");
    return withDerivedFields({
      ...state,
      hunger, happiness, energy, health, poops, ticksSinceLastPoop,
      nextPoopIntervalTicks,
      hungerZeroTicks, sick, alive: alive as boolean, ticksAlive, events,
      sleeping, ageDays, dayTimer, weight,
      activeAttentionCall, attentionCallActiveTicks, attentionCallCooldowns,
      neglectCount, ticksWithUncleanedPoop, ticksSinceLastMisbehaviour, ticksSinceLastGift,
    });
  }

  // Care-score accumulation
  const careScoreHungerSum = state.careScoreHungerSum + hunger;
  const careScoreHappinessSum = state.careScoreHappinessSum + happiness;
  const careScoreHealthSum = state.careScoreHealthSum + health;
  const careScoreTicks = state.careScoreTicks + 1;

  const afterDecay: Omit<PetState, "mood" | "sprite" | "careScore"> = {
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
    neglectCount,
    ticksWithUncleanedPoop,
    ticksSinceLastMisbehaviour,
    ticksSinceLastGift,
  };

  // Stage progression
  return checkStageProgression(afterDecay);
}

// ---------------------------------------------------------------------------
// Stage progression (internal)
// ---------------------------------------------------------------------------

/** Map from stage name to the cumulative dayTimer threshold to evolve out of it.
 * Scaled so that real-world evolution timing (in active ticks) is preserved:
 * 1 game day = 50 ticks (5 min awake). */
const EVOLUTION_DAY_THRESHOLDS: Record<string, number> = {
  egg:   0.396,    // ≈ tick 20 for codeling 1× (~2 min awake)
  baby:  5.988,    // ≈ tick 300 cumulative for codeling 1× (~30 min)
  child: 23.988,   // ≈ tick 1200 cumulative for codeling 1× (~2 hr)
  teen:  95.988,   // ≈ tick 4800 cumulative for codeling 1× (~8 hr)
  adult: 287.988,  // ≈ tick 14400 cumulative for codeling 1× (~24 hr)
};

/** Map from stage name to the next stage. */
const NEXT_STAGE_MAP: Record<string, string> = {
  egg:   "baby",
  baby:  "child",
  child: "teen",
  teen:  "adult",
  adult: "senior",
};

/**
 * Promote the pet to the next life stage if its cumulative dayTimer has
 * reached the threshold for the current stage.
 *
 * @param partial - State without derived fields.
 * @returns Complete PetState, evolved if the dayTimer threshold was reached.
 */
function checkStageProgression(
  partial: Omit<PetState, "mood" | "sprite" | "careScore">
): PetState {
  const dayThreshold = EVOLUTION_DAY_THRESHOLDS[partial.stage];
  if (dayThreshold === undefined) {
    return withDerivedFields(partial);
  }
  if (partial.dayTimer < dayThreshold) {
    return withDerivedFields(partial);
  }

  const nextStage = NEXT_STAGE_MAP[partial.stage];
  if (nextStage === undefined) {
    return withDerivedFields(partial);
  }
  return evolveTo(partial, nextStage);
}

/**
 * Transition a pet to nextStage, assign a character, and reset accumulators.
 *
 * @param partial - State without derived fields.
 * @param nextStage - The stage to transition into.
 * @returns Complete PetState at the new stage.
 */
function evolveTo(
  partial: Omit<PetState, "mood" | "sprite" | "careScore">,
  nextStage: string
): PetState {
  // We need careScore to pick the character; compute it from partial.
  const careScore = computeCareScore(partial as PetState);
  const character =
    nextStage !== "egg"
      ? characterForStage(partial.petType, nextStage, careScore)
      : partial.character;

  const evolved: Omit<PetState, "mood" | "sprite" | "careScore"> = {
    ...partial,
    stage: nextStage,
    character,
    ticksAlive: 0,
    careScoreHungerSum: 0,
    careScoreHappinessSum: 0,
    careScoreHealthSum: 0,
    careScoreTicks: 0,
    events: [...(partial.events as string[]), `evolved_to_${nextStage}`],
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
function answerAttentionCall(
  state: PetState,
  callType: AttentionCallType
): Pick<PetState, "activeAttentionCall" | "attentionCallActiveTicks" | "attentionCallCooldowns"> | null {
  if (state.activeAttentionCall !== callType) { return null; }
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
 * Give the pet a meal.
 *
 * If the cycle cap (FEED_MEAL_MAX_PER_CYCLE) is exceeded the action is a
 * no-op and a "meal_refused" event is emitted.
 *
 * @param state - The current pet state.
 * @param mealsGivenThisCycle - Meals already given in the current wake cycle.
 * @returns A new PetState after the action.
 */
export function feedMeal(state: PetState, mealsGivenThisCycle: number): PetState {
  if (mealsGivenThisCycle >= FEED_MEAL_MAX_PER_CYCLE) {
    return withDerivedFields({ ...state, events: ["meal_refused"] });
  }
  const newWeight = clampWeight(state.weight + FEED_MEAL_WEIGHT_GAIN);
  const events: string[] = ["fed_meal"];
  checkWeightTierEvents(state.weight, newWeight, events);
  const answered = answerAttentionCall(state, "hunger");
  if (answered) { events.push("attention_call_answered_hunger"); }
  // Also answer critical_health if that's the active call
  const answeredCritical = !answered ? answerAttentionCall(state, "critical_health") : null;
  if (answeredCritical) { events.push("attention_call_answered_critical_health"); }
  return withDerivedFields({
    ...state,
    ...(answered ?? answeredCritical ?? {}),
    hunger: clampStat(state.hunger + FEED_MEAL_HUNGER_BOOST),
    weight: newWeight,
    consecutiveSnacks: 0,
    events,
  });
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
 * @returns A new PetState after the action.
 */
export function startSnack(state: PetState): PetState {
  if (state.snacksGivenThisCycle >= SNACK_MAX_PER_CYCLE) {
    return withDerivedFields({ ...state, events: ["snack_refused"] });
  }

  const snacksGivenThisCycle = state.snacksGivenThisCycle + 1;
  const events: string[] = ["snack_placed"];

  const answered = answerAttentionCall(state, "hunger") ?? answerAttentionCall(state, "critical_health");
  if (answered) {
    const label = state.activeAttentionCall === "hunger" ? "hunger" : "critical_health";
    events.push(`attention_call_answered_${label}`);
  }

  return withDerivedFields({
    ...state,
    ...(answered ?? {}),
    snacksGivenThisCycle,
    events,
  });
}

/**
 * Apply the stat effects of a snack once the pet reaches it on the stage.
 *
 * Called when the webview detects the pet touching the snack floor item.
 * Increments `consecutiveSnacks` and — if the new count reaches the maximum
 * — triggers sickness.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function consumeSnack(state: PetState): PetState {
  const events: string[] = [];
  let sick = state.sick;

  const consecutiveSnacks = state.consecutiveSnacks + 1;
  if (consecutiveSnacks >= MAX_CONSECUTIVE_SNACKS_BEFORE_SICK && !sick) {
    sick = true;
    events.push("became_sick");
  }
  events.push("fed_snack");

  const newWeight = clampWeight(state.weight + FEED_SNACK_WEIGHT_GAIN);
  checkWeightTierEvents(state.weight, newWeight, events);

  return withDerivedFields({
    ...state,
    hunger: clampStat(state.hunger + FEED_SNACK_HUNGER_BOOST),
    happiness: clampStat(state.happiness + FEED_SNACK_HAPPINESS_BOOST),
    weight: newWeight,
    consecutiveSnacks,
    sick,
    events,
  });
}

/**
 * Initiate a play session (stat deltas only; mini-game result is handled by
 * applyMinigameResult separately).
 *
 * Energy must be above zero; if the pet has no energy the action is refused.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function play(state: PetState): PetState {
  if (state.energy < PLAY_ENERGY_COST) {
    return withDerivedFields({ ...state, events: ["play_refused_no_energy"] });
  }
  const newWeight = clampWeight(state.weight - PLAY_WEIGHT_LOSS);
  const events: string[] = ["played"];
  checkWeightTierEvents(state.weight, newWeight, events);
  const answered = answerAttentionCall(state, "unhappiness");
  if (answered) { events.push("attention_call_answered_unhappiness"); }
  return withDerivedFields({
    ...state,
    ...(answered ?? {}),
    happiness: clampStat(state.happiness + PLAY_HAPPINESS_BOOST),
    energy: clampStat(state.energy - PLAY_ENERGY_COST),
    weight: newWeight,
    consecutiveSnacks: 0,
    events,
  });
}

/**
 * Pat the pet — a gentle interaction that gives a modest happiness boost at a
 * lower energy cost than play. No minigame; just a direct stat change.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function pat(state: PetState): PetState {
  if (state.energy < PAT_ENERGY_COST) {
    return withDerivedFields({ ...state, events: ["pat_refused_no_energy"] });
  }
  const newWeight = clampWeight(state.weight - PAT_WEIGHT_LOSS);
  const answered = answerAttentionCall(state, "unhappiness");
  const events: string[] = ["patted"];
  checkWeightTierEvents(state.weight, newWeight, events);
  if (answered) { events.push("attention_call_answered_unhappiness"); }
  return withDerivedFields({
    ...state,
    ...(answered ?? {}),
    happiness: clampStat(state.happiness + PAT_HAPPINESS_BOOST),
    energy:    clampStat(state.energy    - PAT_ENERGY_COST),
    weight:    newWeight,
    events,
  });
}

/**
 * Return the happiness delta for a mini-game outcome.
 *
 * @param game - "guess" (legacy coin-flip), "memory" (Pattern Memory),
 *               "left_right" (Left / Right), "higher_lower" (Higher or Lower),
 *               or "coin_flip" (Coin Flip).
 * @param result - "win" or "lose".
 * @returns A positive integer to add to the pet's happiness stat (0 for coin_flip loss).
 */
export function happinessDeltaForMinigame(game: string, result: string): number {
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
 *   - coin_flip: no extra weight loss (total −3 from play() only)
 *
 * @param state - The current pet state.
 * @param game - "left_right", "higher_lower", "guess", or "memory".
 * @param result - "win" or "lose".
 * @returns A new PetState after the happiness delta is applied.
 */
export function applyMinigameResult(
  state: PetState,
  game: string,
  result: string
): PetState {
  const delta = happinessDeltaForMinigame(game, result);
  const isVigorousGame = game === "left_right" || game === "higher_lower";
  const newWeight = isVigorousGame
    ? clampWeight(state.weight - PLAY_WEIGHT_LOSS_BONUS)
    : state.weight;
  const events: string[] = [`minigame_${game}_${result}`];
  if (isVigorousGame) {
    checkWeightTierEvents(state.weight, newWeight, events);
  }
  return withDerivedFields({
    ...state,
    happiness: clampStat(state.happiness + delta),
    weight: newWeight,
    events,
  });
}

/**
 * Put the pet to sleep.
 *
 * If the pet is already sleeping the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function sleep(state: PetState): PetState {
  if (state.sleeping) {
    return withDerivedFields({ ...state, events: ["already_sleeping"] });
  }
  const answered = answerAttentionCall(state, "low_energy");
  const events: string[] = ["fell_asleep"];
  if (answered) { events.push("attention_call_answered_low_energy"); }
  return withDerivedFields({ ...state, ...(answered ?? {}), sleeping: true, events });
}

/**
 * Wake the pet up.
 *
 * Increments ageDays. If the pet is not sleeping the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function wake(state: PetState): PetState {
  if (!state.sleeping) {
    return withDerivedFields({ ...state, events: ["already_awake"] });
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
export function clean(state: PetState): PetState {
  if (state.poops === 0) {
    return withDerivedFields({ ...state, events: ["already_clean"] });
  }
  const answered = answerAttentionCall(state, "poop");
  const events: string[] = ["cleaned"];
  if (answered) { events.push("attention_call_answered_poop"); }
  return withDerivedFields({
    ...state,
    ...(answered ?? {}),
    poops: 0,
    ticksSinceLastPoop: 0,
    ticksWithUncleanedPoop: 0,
    events,
  });
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
export function giveMedicine(state: PetState): PetState {
  if (!state.sick) {
    return withDerivedFields({ ...state, events: ["medicine_not_needed"] });
  }

  const medicineDosesGiven = state.medicineDosesGiven + 1;
  const events: string[] = ["medicine_given"];
  let sick: boolean = state.sick;
  const answered = answerAttentionCall(state, "sick");
  if (answered) { events.push("attention_call_answered_sick"); }

  if (medicineDosesGiven >= MEDICINE_DOSES_TO_CURE) {
    sick = false;
    events.push("cured");
    return withDerivedFields({
      ...state,
      ...(answered ?? {}),
      sick: sick as boolean,
      medicineDosesGiven: 0,
      events,
    });
  }

  return withDerivedFields({ ...state, ...(answered ?? {}), medicineDosesGiven, events });
}

/**
 * Scold the pet to raise discipline.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function scold(state: PetState): PetState {
  const answered = answerAttentionCall(state, "misbehaviour");
  const events: string[] = ["scolded"];
  if (answered) { events.push("attention_call_answered_misbehaviour"); }
  return withDerivedFields({
    ...state,
    ...(answered ?? {}),
    discipline: clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
    events,
  });
}

/**
 * Praise the pet to raise discipline.
 * If a "gift" attention call is active, it is answered and a happiness bonus
 * (GIFT_PRAISE_HAPPINESS_BOOST) is applied on top of the discipline boost.
 * If an "unhappiness" attention call is active, it is answered instead.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function praise(state: PetState): PetState {
  const answeredGift        = answerAttentionCall(state, "gift");
  const answeredUnhappiness = !answeredGift ? answerAttentionCall(state, "unhappiness") : null;
  const answered = answeredGift ?? answeredUnhappiness;
  const events: string[] = ["praised"];
  if (answeredGift)        { events.push("attention_call_answered_gift"); }
  if (answeredUnhappiness) { events.push("attention_call_answered_unhappiness"); }
  const happinessBonus = answeredGift ? GIFT_PRAISE_HAPPINESS_BOOST : 0;
  return withDerivedFields({
    ...state,
    ...(answered ?? {}),
    discipline: clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
    happiness:  clampStat(state.happiness + happinessBonus),
    events,
  });
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
export function applyCodeActivity(state: PetState): PetState {
  return withDerivedFields({
    ...state,
    happiness: clampStat(state.happiness + CODE_ACTIVITY_HAPPINESS_BOOST),
    discipline: clampStat(state.discipline + CODE_ACTIVITY_DISCIPLINE_BOOST),
    events: ["code_activity_rewarded"],
  });
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
export function promoteToSenior(state: PetState): PetState {
  if (state.stage !== "adult") {
    throw new Error(
      `promoteToSenior called on a pet in stage '${state.stage}'; expected 'adult'.`
    );
  }
  const character = characterForStage(state.petType, "senior", state.careScore);
  return withDerivedFields({
    ...state,
    stage: "senior",
    character,
    ticksAlive: 0,
    careScoreHungerSum: 0,
    careScoreHappinessSum: 0,
    careScoreHealthSum: 0,
    careScoreTicks: 0,
    events: ["evolved_to_senior"],
  });
}

/**
 * Apply natural end-of-life if a senior pet has reached old age and health
 * has dropped to the death threshold.
 *
 * @param state - The current pet state.
 * @returns A new PetState, potentially with alive === false.
 */
export function checkOldAgeDeath(state: PetState): PetState {
  if (state.stage !== "senior") {
    return state;
  }
  if (state.ageDays < SENIOR_NATURAL_DEATH_AGE_DAYS) {
    return state;
  }
  if (state.health <= HEALTH_DEATH_THRESHOLD) {
    return withDerivedFields({
      ...state,
      alive: false,
      events: ["died_of_old_age"],
    });
  }
  return state;
}

// ---------------------------------------------------------------------------
// Offline decay
// ---------------------------------------------------------------------------

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
export function applyOfflineDecay(state: PetState, elapsedSeconds: number): PetState {
  if (elapsedSeconds <= 0 || !state.alive) {
    return state;
  }

  const modifiers = PET_TYPE_MODIFIERS[state.petType] ?? PET_TYPE_MODIFIERS.codeling;
  const elapsedTicks = elapsedSeconds / TICK_INTERVAL_SECONDS;

  const hungerDecayTotal = Math.ceil(
    elapsedTicks * HUNGER_DECAY_PER_TICK * modifiers.hungerDecayMultiplier
  );
  const happinessDecayTotal = Math.ceil(
    elapsedTicks * HAPPINESS_DECAY_PER_TICK * modifiers.happinessDecayMultiplier
  );

  const maxHungerLoss = Math.floor(state.hunger * OFFLINE_DECAY_MAX_FRACTION);
  const maxHappinessLoss = Math.floor(state.happiness * OFFLINE_DECAY_MAX_FRACTION);

  // Poop does NOT accumulate while the IDE is closed — the same rule that
  // suppresses pooping during idle/deep idle applies to offline time too.

  const decayedHunger    = clampStat(state.hunger    - Math.min(hungerDecayTotal,    maxHungerLoss));
  const decayedHappiness = clampStat(state.happiness - Math.min(happinessDecayTotal, maxHappinessLoss));

  return withDerivedFields({
    ...state,
    // Being offline is equivalent to deep idle: apply the same IDLE_STAT_FLOOR
    // so offline decay can never push stats below the deep-idle floor of 20.
    hunger:    Math.max(decayedHunger,    IDLE_STAT_FLOOR),
    happiness: Math.max(decayedHappiness, IDLE_STAT_FLOOR),
    // Reset the starvation streak counter: offline time breaks the continuity
    // of consecutive zero-hunger ticks.  Without this reset the pet could die
    // on the very first tick after VS Code reopens.
    hungerZeroTicks: 0,
    // Treat offline time as awake for stat decay; aging does NOT advance while the IDE is closed.
    dayTimer: state.dayTimer,
    ageDays: state.ageDays,
    events: [],
  });
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
export function serialiseState(state: PetState): Record<string, unknown> {
  return {
    name: state.name,
    petType: state.petType,
    color: state.color,
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
    snacksGivenThisCycle: state.snacksGivenThisCycle,
    dayTimer: state.dayTimer,
    // Attention call fields
    activeAttentionCall: state.activeAttentionCall,
    attentionCallActiveTicks: state.attentionCallActiveTicks,
    attentionCallCooldowns: state.attentionCallCooldowns,
    neglectCount: state.neglectCount,
    ticksWithUncleanedPoop: state.ticksWithUncleanedPoop,
    ticksSinceLastMisbehaviour: state.ticksSinceLastMisbehaviour,
    ticksSinceLastGift: state.ticksSinceLastGift,
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
export function deserialiseState(data: Record<string, unknown>): PetState {
  const getString = (key: string, fallback: string): string =>
    typeof data[key] === "string" ? (data[key] as string) : fallback;
  const getNumber = (key: string, fallback: number): number =>
    typeof data[key] === "number" ? (data[key] as number) : fallback;
  const getBool = (key: string, fallback: boolean): boolean =>
    typeof data[key] === "boolean" ? (data[key] as boolean) : fallback;
  const getStringArray = (key: string): readonly string[] =>
    Array.isArray(data[key]) ? (data[key] as string[]) : [];

  // Back-compat helper for attentionCallCooldowns (stored as plain object)
  const getCooldowns = (): Partial<Record<AttentionCallType, number>> => {
    const raw = data["attentionCallCooldowns"];
    if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Partial<Record<AttentionCallType, number>>;
    }
    return {};
  };

  const partial: Omit<PetState, "mood" | "sprite" | "careScore"> = {
    name: getString("name", "Gotchi"),
    petType: getString("petType", "codeling"),
    color: getString("color", "neon"),
    hunger: getNumber("hunger", 50),
    happiness: getNumber("happiness", 50),
    discipline: getNumber("discipline", 50),
    energy: getNumber("energy", 100),
    health: getNumber("health", 100),
    weight: getNumber("weight", 5),
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
    nextPoopIntervalTicks: getNumber(
      "nextPoopIntervalTicks",
      sampleNextPoopInterval(getString("petType", "codeling"))
    ),
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
    snacksGivenThisCycle: getNumber("snacksGivenThisCycle", 0),
    // Back-compat: old saves use ageDays as an integer; seed dayTimer from it.
    dayTimer: getNumber("dayTimer", getNumber("ageDays", 0)),
    // Attention call fields — back-compat: all default to inactive/zero.
    activeAttentionCall: (data["activeAttentionCall"] as AttentionCallType | null) ?? null,
    attentionCallActiveTicks: getNumber("attentionCallActiveTicks", 0),
    attentionCallCooldowns: getCooldowns(),
    neglectCount: getNumber("neglectCount", 0),
    ticksWithUncleanedPoop: getNumber("ticksWithUncleanedPoop", 0),
    ticksSinceLastMisbehaviour: getNumber("ticksSinceLastMisbehaviour", 0),
    ticksSinceLastGift: getNumber("ticksSinceLastGift", 0),
  };

  return withDerivedFields(partial);
}
