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
export const TICK_INTERVAL_SECONDS: number = 5;

const TICKS_PER_MINUTE: number = 60 / TICK_INTERVAL_SECONDS;
const TICKS_PER_HOUR: number = 60 * TICKS_PER_MINUTE;

/** Duration of the egg stage in ticks. */
export const EGG_DURATION_TICKS: number = 2 * TICKS_PER_MINUTE;
/** Duration of the baby stage in ticks. */
export const BABY_DURATION_TICKS: number = 10 * TICKS_PER_MINUTE;
/** Duration of the child stage in ticks. */
export const CHILD_DURATION_TICKS: number = 1 * TICKS_PER_HOUR;
/** Duration of the teen stage in ticks. */
export const TEEN_DURATION_TICKS: number = 3 * TICKS_PER_HOUR;

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
/** Ticks between droppings (≈ 20 real minutes). */
const POOP_TICKS_INTERVAL: number = 20 * TICKS_PER_MINUTE;

const FEED_MEAL_HUNGER_BOOST: number = 20;
const FEED_MEAL_WEIGHT_GAIN: number = 1;
const FEED_MEAL_MAX_PER_CYCLE: number = 4;

const FEED_SNACK_HAPPINESS_BOOST: number = 10;
const FEED_SNACK_HUNGER_BOOST: number = 5;
const FEED_SNACK_WEIGHT_GAIN: number = 2;

const PLAY_HAPPINESS_BOOST: number = 15;
const PLAY_ENERGY_COST: number = 25;
const PLAY_WEIGHT_LOSS: number = 1;

/** Passive energy drain per tick while awake. */
const ENERGY_DECAY_PER_TICK: number = 1;

const MEDICINE_DOSES_TO_CURE: number = 3;

/** Ticks between passive health regen pulses while awake (1 hp per interval). */
const HEALTH_REGEN_AWAKE_TICK_INTERVAL: number = 5;

const DISCIPLINE_BOOST_PER_ACTION: number = 10;

const CODE_ACTIVITY_HAPPINESS_BOOST: number = 5;
const CODE_ACTIVITY_DISCIPLINE_BOOST: number = 2;
/** Minimum seconds between code-activity happiness boosts. */
export const CODE_ACTIVITY_THROTTLE_SECONDS: number = 30;

const MINIGAME_WIN_HAPPINESS_BOOST: number = 15;
const MINIGAME_LOSE_HAPPINESS_BOOST: number = 5;
const MINIGAME_MEMORY_WIN_HAPPINESS_BOOST: number = 20;

const CARE_SCORE_HUNGER_WEIGHT: number = 0.30;
const CARE_SCORE_HAPPINESS_WEIGHT: number = 0.25;
const CARE_SCORE_DISCIPLINE_WEIGHT: number = 0.20;
const CARE_SCORE_CLEANLINESS_WEIGHT: number = 0.15;
const CARE_SCORE_HEALTH_WEIGHT: number = 0.10;

const CARE_SCORE_BEST_TIER_THRESHOLD: number = 0.80;
const CARE_SCORE_MID_TIER_THRESHOLD: number = 0.55;

/** Maximum fraction of any stat that can be lost while the extension is off. */
const OFFLINE_DECAY_MAX_FRACTION: number = 0.60;

/** Age in real-world days at which a senior pet may die of old age. */
export const SENIOR_NATURAL_DEATH_AGE_DAYS: number = 20;

// ---------------------------------------------------------------------------
// Types (ported from python/models.py)
// ---------------------------------------------------------------------------

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

  // Care-quality accumulators
  readonly careScoreHungerSum: number;
  readonly careScoreHappinessSum: number;
  readonly careScoreHealthSum: number;
  readonly careScoreTicks: number;

  // Events emitted during the last action (cleared on each new action)
  readonly events: readonly string[];
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
    weight: 5,
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
  return { ...partial, careScore: Math.round(careScore * 10000) / 10000, mood, sprite };
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
export function tick(state: PetState): PetState {
  if (!state.alive) {
    return state;
  }

  const modifiers = PET_TYPE_MODIFIERS[state.petType] ?? PET_TYPE_MODIFIERS.codeling;
  const events: string[] = [];
  let hunger: number = state.hunger;
  let happiness: number = state.happiness;
  let energy: number = state.energy;
  let health: number = state.health;
  let poops: number = state.poops;
  let ticksSinceLastPoop: number = state.ticksSinceLastPoop;
  let nextPoopIntervalTicks: number = state.nextPoopIntervalTicks;
  let hungerZeroTicks: number = state.hungerZeroTicks;
  let sick: boolean = state.sick;
  let alive: boolean = state.alive;
  let sleeping: boolean = state.sleeping;
  let ageDays: number = state.ageDays;
  const ticksAlive = state.ticksAlive + 1;

  // Stat decay
  if (!sleeping) {
    const hungerDecay = Math.ceil(HUNGER_DECAY_PER_TICK * modifiers.hungerDecayMultiplier);
    const happinessDecay = Math.ceil(
      HAPPINESS_DECAY_PER_TICK * modifiers.happinessDecayMultiplier
    );
    hunger = clampStat(hunger - hungerDecay);
    happiness = clampStat(happiness - happinessDecay);
    energy = clampStat(energy - ENERGY_DECAY_PER_TICK);
  } else {
    const energyRegen = Math.ceil(
      ENERGY_REGEN_PER_TICK_SLEEPING * modifiers.energyRegenMultiplier
    );
    energy = clampStat(energy + energyRegen);

    // BUGFIX-003: auto-wake when energy is fully restored
    if (energy >= STAT_MAX) {
      sleeping = false;
      ageDays += 1;
      events.push("auto_woke_up");
    }
  }

  // Poop accumulation — interval is per-type and resampled with high volatility
  if (!sleeping) {
    ticksSinceLastPoop += 1;
    if (ticksSinceLastPoop >= nextPoopIntervalTicks) {
      poops += 1;
      ticksSinceLastPoop = 0;
      // Resample the next interval so timing is unpredictable
      nextPoopIntervalTicks = sampleNextPoopInterval(state.petType);
      events.push("pooped");
    }
  }

  // Sickness from dirty environment
  if (poops >= MAX_UNCLEANED_POOPS_BEFORE_SICK && !sick) {
    sick = true;
    events.push("became_sick");
  }

  // Starvation counter
  if (hunger === STAT_MIN) {
    hungerZeroTicks += 1;
  } else {
    hungerZeroTicks = 0;
  }

  // Starvation damage
  if (hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK) {
    health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
    events.push("starvation_damage");
  }

  // Happiness-critical health drain
  if (happiness === STAT_MIN && !sleeping) {
    health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
    events.push("unhappiness_damage");
  }

  // Sickness health drain
  if (sick) {
    health = clampStat(health - CRITICAL_HEALTH_DAMAGE_PER_TICK);
  }

  // BUGFIX-004: passive health regen — full rate while sleeping, much slower awake
  if (!sick && health < STAT_MAX) {
    if (sleeping) {
      health = clampStat(health + 1);
    } else if (ticksAlive % HEALTH_REGEN_AWAKE_TICK_INTERVAL === 0) {
      health = clampStat(health + 1);
    }
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
      sleeping, ageDays,
    });
  }

  // Care-score accumulation
  const careScoreHungerSum = state.careScoreHungerSum + hunger;
  const careScoreHappinessSum = state.careScoreHappinessSum + happiness;
  const careScoreHealthSum = state.careScoreHealthSum + health;
  const careScoreTicks = state.careScoreTicks + 1;

  const afterDecay: Omit<PetState, "mood" | "sprite" | "careScore"> = {
    ...state,
    hunger, happiness, energy, health, poops, ticksSinceLastPoop,
    nextPoopIntervalTicks,
    hungerZeroTicks, sick, alive, ticksAlive, sleeping, ageDays,
    careScoreHungerSum, careScoreHappinessSum, careScoreHealthSum, careScoreTicks,
    events,
  };

  // Stage progression
  return checkStageProgression(afterDecay);
}

// ---------------------------------------------------------------------------
// Stage progression (internal)
// ---------------------------------------------------------------------------

/** Map from stage name to its tick duration. */
const STAGE_DURATION_MAP: Record<string, number> = {
  egg: EGG_DURATION_TICKS,
  baby: BABY_DURATION_TICKS,
  child: CHILD_DURATION_TICKS,
  teen: TEEN_DURATION_TICKS,
};

/** Map from stage name to the next stage. */
const NEXT_STAGE_MAP: Record<string, string> = {
  egg: "baby",
  baby: "child",
  child: "teen",
  teen: "adult",
};

/**
 * Promote the pet to the next life stage if its duration has elapsed.
 *
 * @param partial - State without derived fields.
 * @returns Complete PetState, evolved if duration threshold was reached.
 */
function checkStageProgression(
  partial: Omit<PetState, "mood" | "sprite" | "careScore">
): PetState {
  const duration = STAGE_DURATION_MAP[partial.stage];
  if (duration === undefined) {
    return withDerivedFields(partial);
  }
  if (partial.ticksAlive < duration) {
    return withDerivedFields(partial);
  }

  const nextStage = NEXT_STAGE_MAP[partial.stage];
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
  return withDerivedFields({
    ...state,
    hunger: clampStat(state.hunger + FEED_MEAL_HUNGER_BOOST),
    weight: clampWeight(state.weight + FEED_MEAL_WEIGHT_GAIN),
    consecutiveSnacks: 0,
    events: ["fed_meal"],
  });
}

/**
 * Give the pet a snack.
 *
 * Three consecutive snacks trigger sickness.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function feedSnack(state: PetState): PetState {
  const consecutiveSnacks = state.consecutiveSnacks + 1;
  const events: string[] = [];
  let sick = state.sick;

  if (consecutiveSnacks >= MAX_CONSECUTIVE_SNACKS_BEFORE_SICK && !sick) {
    sick = true;
    events.push("became_sick");
  }
  events.push("fed_snack");

  return withDerivedFields({
    ...state,
    hunger: clampStat(state.hunger + FEED_SNACK_HUNGER_BOOST),
    happiness: clampStat(state.happiness + FEED_SNACK_HAPPINESS_BOOST),
    weight: clampWeight(state.weight + FEED_SNACK_WEIGHT_GAIN),
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
  if (state.energy <= 0) {
    return withDerivedFields({ ...state, events: ["play_refused_no_energy"] });
  }
  return withDerivedFields({
    ...state,
    happiness: clampStat(state.happiness + PLAY_HAPPINESS_BOOST),
    energy: clampStat(state.energy - PLAY_ENERGY_COST),
    weight: clampWeight(state.weight - PLAY_WEIGHT_LOSS),
    consecutiveSnacks: 0,
    events: ["played"],
  });
}

/**
 * Return the happiness delta for a mini-game outcome.
 *
 * @param game - "guess" (Left/Right Guess) or "memory" (Pattern Memory).
 * @param result - "win" or "lose".
 * @returns A positive integer to add to the pet's happiness stat.
 */
export function happinessDeltaForMinigame(game: string, result: string): number {
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
 * @param state - The current pet state.
 * @param game - "guess" or "memory".
 * @param result - "win" or "lose".
 * @returns A new PetState after the happiness delta is applied.
 */
export function applyMinigameResult(
  state: PetState,
  game: string,
  result: string
): PetState {
  const delta = happinessDeltaForMinigame(game, result);
  return withDerivedFields({
    ...state,
    happiness: clampStat(state.happiness + delta),
    events: [`minigame_${game}_${result}`],
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
  return withDerivedFields({ ...state, sleeping: true, events: ["fell_asleep"] });
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
    ageDays: state.ageDays + 1,
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
  return withDerivedFields({
    ...state,
    poops: 0,
    ticksSinceLastPoop: 0,
    events: ["cleaned"],
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

  if (medicineDosesGiven >= MEDICINE_DOSES_TO_CURE) {
    sick = false;
    events.push("cured");
    return withDerivedFields({
      ...state,
      sick: sick as boolean,
      medicineDosesGiven: 0,
      events,
    });
  }

  return withDerivedFields({ ...state, medicineDosesGiven, events });
}

/**
 * Scold the pet to raise discipline.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function scold(state: PetState): PetState {
  return withDerivedFields({
    ...state,
    discipline: clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
    events: ["scolded"],
  });
}

/**
 * Praise the pet to raise discipline.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export function praise(state: PetState): PetState {
  return withDerivedFields({
    ...state,
    discipline: clampStat(state.discipline + DISCIPLINE_BOOST_PER_ACTION),
    events: ["praised"],
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

  // Advance poop accumulation for offline ticks (mirrors live tick logic,
  // but without a sleeping guard — hunger/happiness decay above also ignores
  // sleeping for simplicity).
  let poops = state.poops;
  let ticksSinceLastPoop = state.ticksSinceLastPoop;
  let nextPoopIntervalTicks = state.nextPoopIntervalTicks;
  let remainingTicks = Math.floor(elapsedTicks);
  while (remainingTicks > 0) {
    const ticksUntilNextPoop = nextPoopIntervalTicks - ticksSinceLastPoop;
    if (remainingTicks >= ticksUntilNextPoop) {
      remainingTicks -= ticksUntilNextPoop;
      poops += 1;
      ticksSinceLastPoop = 0;
      nextPoopIntervalTicks = sampleNextPoopInterval(state.petType);
    } else {
      ticksSinceLastPoop += remainingTicks;
      remainingTicks = 0;
    }
  }

  return withDerivedFields({
    ...state,
    hunger: clampStat(state.hunger - Math.min(hungerDecayTotal, maxHungerLoss)),
    happiness: clampStat(state.happiness - Math.min(happinessDecayTotal, maxHappinessLoss)),
    poops,
    ticksSinceLastPoop,
    nextPoopIntervalTicks,
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
  };

  return withDerivedFields(partial);
}
