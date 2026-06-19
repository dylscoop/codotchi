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
/** How many real-world seconds elapse between each game tick. */
export declare const TICK_INTERVAL_SECONDS: number;
/** Duration of the egg stage in ticks. */
export declare const EGG_DURATION_TICKS: number;
/** Duration of the baby stage in ticks. */
export declare const BABY_DURATION_TICKS: number;
/** Duration of the child stage in ticks. */
export declare const CHILD_DURATION_TICKS: number;
/** Duration of the teen stage in ticks. */
export declare const TEEN_DURATION_TICKS: number;
/** Duration of the adult stage in ticks (used as a seed for tests). */
export declare const ADULT_DURATION_TICKS: number;
/** Maximum snacks allowed per wake cycle before further snacks are refused. */
export declare const SNACK_MAX_PER_CYCLE: number;
/** Maximum snacks allowed on the stage floor simultaneously before further snacks are refused. */
export declare const MAX_FLOOR_SNACKS: number;
/** Weight above which the sprite is drawn 1.25× wider. */
export declare const WEIGHT_SLIGHTLY_FAT_THRESHOLD: number;
/** Weight above which the sprite is drawn 1.5× wider. */
export declare const WEIGHT_OVERWEIGHT_THRESHOLD: number;
/** Minimum seconds between code-activity happiness boosts. */
export declare const CODE_ACTIVITY_THROTTLE_SECONDS: number;
/** Minimum seconds between commit happiness boosts (prevents rapid --amend abuse). */
export declare const COMMIT_ACTIVITY_THROTTLE_SECONDS: number;
/**
 * Seconds of no IDE activity (no keystrokes, cursor movement, or window focus)
 * before the pet is considered "idle" and decay is reduced to IDLE_DECAY_FRACTION.
 */
export declare const IDLE_THRESHOLD_SECONDS: number;
/**
 * Seconds of sustained idle before entering "deep idle": stats are floored at
 * IDLE_STAT_FLOOR and aging stops completely.
 */
export declare const IDLE_DEEP_THRESHOLD_SECONDS: number;
/**
 * Minimum stat value (hunger, happiness) enforced while in deep idle.
 * Expressed as a 0-100 value (20 = 20%).
 */
export declare const IDLE_STAT_FLOOR: number;
/** Active (non-idle) ticks the player has to respond before a call expires (20 × 3 s = 1 min). */
export declare const ATTENTION_CALL_RESPONSE_TICKS: number;
/** Hunger stat at or below which a hunger attention call fires. */
export declare const ATTENTION_HUNGER_THRESHOLD: number;
/** Happiness stat at or below which an unhappiness attention call fires. */
export declare const ATTENTION_UNHAPPINESS_THRESHOLD: number;
/** Energy stat at or below which a low_energy attention call fires. */
export declare const ATTENTION_ENERGY_THRESHOLD: number;
/** Health stat at or below which a critical_health attention call fires. */
export declare const ATTENTION_HEALTH_THRESHOLD: number;
/** Cooldown ticks (50 = 5 min) applied to a call type after it is answered. */
export declare const ATTENTION_ANSWER_COOLDOWN_TICKS: number;
/** Cooldown ticks (20 = 2 min) applied to a call type after it expires unanswered. */
export declare const ATTENTION_EXPIRY_COOLDOWN_TICKS: number;
/** Stat penalty applied to the relevant stat when an attention call expires. */
export declare const ATTENTION_EXPIRY_STAT_PENALTY: number;
/** Happiness boost applied when a gift attention call is answered via praise(). */
export declare const GIFT_PRAISE_HAPPINESS_BOOST: number;
/**
 * Number of care mistakes in a single stage that are tolerated before the
 * evolution tier begins to be penalised.  0–CARE_MISTAKE_BEST_MAX = "best"
 * tier is still achievable (subject to careScore); above this the tier is
 * capped downward.
 */
export declare const CARE_MISTAKE_BEST_MAX: number;
/**
 * Above this many per-stage care mistakes the maximum achievable evolution
 * tier is "low" (regardless of careScore).
 */
export declare const CARE_MISTAKE_MID_MAX: number;
/**
 * Number of excess per-stage care mistakes (above CARE_MISTAKE_BEST_MAX)
 * required before any evolution delay is applied.  Mistakes ≤ BEST_MAX = no
 * delay; each mistake above this threshold adds CARE_MISTAKE_DAYS_PER_EXCESS
 * game-days to the evolution threshold for that stage.
 */
export declare const CARE_MISTAKE_DELAY_THRESHOLD: number;
/**
 * Game-days added to the current stage's evolution threshold for each care
 * mistake above CARE_MISTAKE_DELAY_THRESHOLD (1 game-day = TICKS_PER_GAME_DAY_AWAKE ticks).
 */
export declare const CARE_MISTAKE_DAYS_PER_EXCESS: number;
/**
 * Maximum total game-days of evolution delay regardless of how many care mistakes
 * have accumulated (caps at 9 game-days ≈ 1.5× the baby stage duration).
 */
export declare const CARE_MISTAKE_DELAY_MAX_DAYS: number;
/**
 * Game-days between automatic forgiveness ticks — every this many game-days,
 * careMistakes is decremented by 1 (floored at 0).
 */
export declare const CARE_MISTAKE_FORGIVENESS_DAYS: number;
/**
 * Amount by which careMistakes is decremented each time an attention call is
 * successfully answered (0.5 = two answered calls forgive one mistake).
 */
export declare const CARE_MISTAKE_ANSWER_CREDIT: number;
/**
 * Lifetime care mistakes required to unlock the "secret_worst" evolution path
 * (equivalent to Oyajitchi / Bill in the original Tamagotchi).
 */
export declare const CARE_MISTAKE_SECRET_WORST_THRESHOLD: number;
/**
 * Per-stage care mistakes must be exactly 0 AND careScore ≥ this value to
 * unlock the "secret_best" evolution path (equivalent to Mametchi).
 */
export declare const CARE_MISTAKE_SECRET_BEST_CARE_SCORE: number;
/**
 * Lifetime care mistakes saturate the old-age risk factor at this value.
 * At lifetimeCareMistakes === CARE_MISTAKE_OLD_AGE_SATURATE, the mistakes
 * factor contributes its maximum (1.0) to the riskScore.
 */
export declare const CARE_MISTAKE_OLD_AGE_SATURATE: number;
export declare const POOP_CALL_BASE_CHANCE: number;
export declare const POOP_CALL_MAX_CHANCE: number;
export declare const MISBEHAVIOUR_BASE_CHANCE: number;
export declare const MISBEHAVIOUR_MAX_CHANCE: number;
export declare const GIFT_BASE_CHANCE: number;
export declare const GIFT_MAX_CHANCE: number;
/** Age in game days at which a senior pet may die of old age (365 game days = 1 in-game year). */
export declare const SENIOR_NATURAL_DEATH_AGE_DAYS: number;
/** Base per-day probability of a senior dying of old age when all stats are optimal. */
export declare const OLD_AGE_DEATH_BASE_CHANCE_PER_DAY: number;
/**
 * Risk multiplier applied to the base chance when all three longevity factors
 * (happiness, weight, discipline) are at their worst.
 * Final chance = BASE × (1 + MULTIPLIER × riskScore), where riskScore ∈ [0, 1].
 * Range: 0.1 % / day (perfect) → 1.0 % / day (neglected) at the onset age (day 365).
 */
export declare const OLD_AGE_DEATH_RISK_MULTIPLIER: number;
/** Peak age in game days at which old-age death chance is capped (5 in-game years). */
export declare const OLD_AGE_DEATH_PEAK_AGE_DAYS: number;
/** Best-care (riskScore = 0) per-day death probability at peak age. */
export declare const OLD_AGE_DEATH_PEAK_BEST_CARE_CHANCE: number;
/** Worst-care (riskScore = 1) per-day death probability at peak age. */
export declare const OLD_AGE_DEATH_PEAK_WORST_CARE_CHANCE: number;
/**
 * Multiplier applied to the old-age death chance to get the per-day sickness
 * chance for senior pets.  Seniors are 3× more likely to fall ill than to die.
 */
export declare const OLD_AGE_SICK_CHANCE_MULTIPLIER: number;
/**
 * Ticks elapsed while awake before the day timer advances by 1.0 (1 game day = 5 real minutes awake).
 * 5 min × 60 s ÷ 6 s/tick = 50 ticks.
 */
export declare const TICKS_PER_GAME_DAY_AWAKE: number;
/**
 * Ticks elapsed while sleeping before the day timer advances by 1.0 (≈ 4 min asleep = 1 day,
 * ~25% faster than awake).
 */
export declare const TICKS_PER_GAME_DAY_SLEEPING: number;
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
     * Activated by setting codotchi.developerPasscode to "1234".
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
export declare const DEFAULT_GAME_CONFIG: GameConfig;
/** All valid pet type identifiers. */
export declare const VALID_PET_TYPES: readonly string[];
/** Life-stage names in order. */
export declare const STAGE_ORDER: readonly string[];
/**
 * All valid attention call type identifiers.
 * A call of each type can be active at most once at any given time.
 */
export type AttentionCallType = "hunger" | "unhappiness" | "poop" | "sick" | "low_energy" | "misbehaviour" | "gift" | "critical_health";
/**
 * Full serialisable snapshot of the pet's state.
 *
 * All integer stats are in the range [0, 100] unless documented otherwise.
 * This interface is used for both the in-memory representation and
 * persistence via VS Code's globalState API.
 */
export interface PetState {
    readonly name: string;
    readonly petType: string;
    readonly spriteType: string;
    readonly color?: string;
    readonly hunger: number;
    readonly happiness: number;
    readonly discipline: number;
    readonly energy: number;
    readonly health: number;
    /** Valid range: [1, 99]. */
    readonly weight: number;
    readonly ageDays: number;
    readonly stage: string;
    readonly character: string;
    readonly alive: boolean;
    readonly sick: boolean;
    readonly sleeping: boolean;
    readonly mood: string;
    readonly sprite: string;
    readonly careScore: number;
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
    readonly careScoreHungerSum: number;
    readonly careScoreHappinessSum: number;
    readonly careScoreHealthSum: number;
    readonly careScoreTicks: number;
    readonly events: readonly string[];
    readonly recentEventLog: readonly string[];
    /** Whether the IDE was idle on the previous tick (used to detect idle transition). */
    readonly wasIdle: boolean;
    /** Whether the IDE was in deep idle (≥10 min) on the previous tick. */
    readonly wasDeepIdle: boolean;
    /** Unix ms timestamp when this pet was first created (spawnedAt). */
    readonly spawnedAt: number;
    /** Snacks given in the current wake cycle (resets on wake/createPet). */
    readonly snacksGivenThisCycle: number;
    /** Snacks currently placed on the floor but not yet consumed. Resets to 0 when the webview reloads. */
    readonly snacksOnFloor: number;
    /** When true all tick-based changes (decay, aging, code activity) are frozen until resumed. */
    readonly paused: boolean;
    /** The currently active attention call type, or null if none is active. */
    readonly activeAttentionCall: AttentionCallType | null;
    /** Number of active (non-idle) ticks elapsed since the current attention call fired. */
    readonly attentionCallActiveTicks: number;
    /** Per-type cooldown counters (ticks remaining). Decremented each tick. */
    readonly attentionCallCooldowns: Partial<Record<AttentionCallType, number>>;
    /**
     * Per-stage count of care mistakes (attention calls that expired unanswered).
     * Resets to 0 on every stage transition.  Used to gate/delay evolution and
     * select the evolution tier for the current stage.
     */
    readonly careMistakes: number;
    /**
     * Cumulative care mistakes across the pet's entire life — never resets.
     * Used for old-age death chance and secret character unlocks.
     */
    readonly lifetimeCareMistakes: number;
    /** Ticks the current poop(s) have remained uncleaned; resets to 0 when poops === 0. */
    readonly ticksWithUncleanedPoop: number;
    /** Ticks since the last misbehaviour attention call fired; used for log-chance formula. */
    readonly ticksSinceLastMisbehaviour: number;
    /** Ticks since the last gift attention call fired; used for log-chance formula. */
    readonly ticksSinceLastGift: number;
}
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
    readonly color?: string;
    /** Unix ms when the pet was created. */
    readonly spawnedAt: number;
    /** Unix ms when the pet died (used to compute real elapsed time). */
    readonly diedAt: number;
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
export declare function sampleNextPoopInterval(petType: string): number;
/**
 * Derive a mood label from current stats.
 *
 * @param hunger - Current hunger stat.
 * @param happiness - Current happiness stat.
 * @param health - Current health stat.
 * @param sleeping - Whether the pet is sleeping.
 * @returns One of: "sleeping" | "sick" | "sad" | "neutral" | "happy".
 */
export declare function moodFromStats(hunger: number, happiness: number, health: number, sleeping: boolean): string;
/**
 * Return the evolution tier string for the given care score (no mistake override).
 *
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns One of: "best" | "mid" | "low".
 */
export declare function tierFromCareScore(careScore: number): string;
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
export declare function tierFromState(careScore: number, careMistakes: number, lifetimeCareMistakes: number): string;
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
export declare function characterForStage(petType: string, stage: string, careScore: number, careMistakes?: number, lifetimeCareMistakes?: number): string;
/**
 * Compute the weighted care quality score for a state.
 *
 * Returns 0.5 (neutral) if no ticks have been accumulated yet.
 *
 * @param state - The pet state to evaluate.
 * @returns Care score in the range 0.0–1.0.
 */
export declare function computeCareScore(state: PetState): number;
/**
 * Return a human-readable care tier label for a given care score.
 *
 * @param careScore - The accumulated care quality score (0.0–1.0).
 * @returns One of: "Excellent" | "Good" | "Poor".
 */
export declare function careTierLabel(careScore: number): string;
/**
 * All 12 Chinese zodiac animals. Accessible via character code only —
 * not part of the random rotation pool.
 */
declare const ZODIAC_ANIMALS: readonly ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "sheep", "monkey", "rooster", "dog", "pig"];
/**
 * Animals in the random rotation pool at pet creation.
 * All entries have equal probability (1 / ROTATION_ANIMALS.length each).
 * Note: some rotation animals (dog, snake, sheep, rooster, tiger) are also
 * zodiac animals — they remain accessible via zodiac character codes too.
 * More animals will be added to this set in the future.
 */
declare const ROTATION_ANIMALS: readonly ["cat", "dog", "snake", "sheep", "classic", "rooster", "tiger", "kangaroo"];
/**
 * All valid sprite type keys.
 */
export type SpriteType = typeof ZODIAC_ANIMALS[number] | typeof ROTATION_ANIMALS[number] | "tim" | "testsprite" | "roo" | "stu";
/**
 * Sample a random sprite type at pet creation.
 * Each entry in ROTATION_ANIMALS has equal probability.
 */
export declare function randomSpriteType(): string;
/**
 * Create a brand-new pet state at stage "egg" with default stats.
 *
 * @param name - The player-chosen name for the pet.
 * @param petType - One of the valid pet type identifiers.
 * @param unlockedCharacter - spriteType of a custom character to force (e.g. "tim"), or null for random.
 *   When provided, the forced name must be resolved by the caller or registry before passing `name`.
 * @returns A freshly initialised PetState.
 */
export declare function createPet(name: string, petType: string, unlockedCharacter?: string | null): PetState;
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
export declare function tick(state: PetState, isIdle?: boolean, isDeepIdle?: boolean, config?: GameConfig): PetState;
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
export declare function feedMeal(state: PetState, mealsGivenThisCycle: number, opts?: {
    maxPerCycle?: number;
    hungerMult?: number;
    weightGain?: number;
}): PetState;
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
export declare function startSnack(state: PetState, opts?: {
    maxPerCycle?: number;
}): PetState;
/**
 * Apply the stat effects of a snack once the pet reaches it on the stage.
 *
 * Called when the webview detects the pet touching the snack floor item.
 * Increments `consecutiveSnacks` and — if the new count reaches the maximum
 * — triggers sickness.
 *
 * @param state - The current pet state.
 * @param opts - Optional per-character overrides.
 * @param opts.hungerMult - Multiplier on the hunger boost (default 1.0).
 * @param opts.weightGain - Weight gained per snack consumed (overrides FEED_SNACK_WEIGHT_GAIN).
 * @returns A new PetState after the action.
 */
export declare function consumeSnack(state: PetState, opts?: {
    hungerMult?: number;
    sickThreshold?: number;
    weightGain?: number;
}): PetState;
/**
 * Zero out the in-flight floor snack counter.
 *
 * Call whenever the webview is reloaded (panel open, config change) so that
 * the engine's count stays in sync with the webview's empty `snackItems[]`.
 */
export declare function resetFloorSnacks(state: PetState): PetState;
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
export declare function play(state: PetState, opts?: {
    weightLoss?: number;
}): PetState;
/**
 * Pat the pet — a gentle interaction that gives a modest happiness boost at a
 * lower energy cost than play. No minigame; just a direct stat change.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function pat(state: PetState): PetState;
/**
 * Return the happiness delta for a mini-game outcome.
 *
 * @param game - "guess" (legacy coin-flip), "memory" (Pattern Memory),
 *               "left_right" (Left / Right), "higher_lower" (Higher or Lower),
 *               or "coin_flip" (Coin Flip).
 * @param result - "win" or "lose".
 * @returns A positive integer to add to the pet's happiness stat (0 for coin_flip loss).
 */
export declare function happinessDeltaForMinigame(game: string, result: string): number;
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
export declare function applyMinigameResult(state: PetState, game: string, result: string): PetState;
/**
 * Put the pet to sleep.
 *
 * If the pet is already sleeping the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function sleep(state: PetState): PetState;
/**
 * Wake the pet up.
 *
 * Increments ageDays. If the pet is not sleeping the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function wake(state: PetState): PetState;
/**
 * Remove all droppings.
 *
 * If poops === 0 the call is a no-op.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function clean(state: PetState): PetState;
/**
 * Administer one dose of medicine.
 *
 * After MEDICINE_DOSES_TO_CURE consecutive doses the pet is cured.
 * Giving medicine to a healthy pet has no effect.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function giveMedicine(state: PetState): PetState;
/**
 * Scold the pet to raise discipline.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function scold(state: PetState): PetState;
/**
 * Praise the pet to raise discipline.
 * If a "gift" attention call is active, it is answered and a happiness bonus
 * (GIFT_PRAISE_HAPPINESS_BOOST) is applied on top of the discipline boost.
 * If an "unhappiness" attention call is active, it is answered instead.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function praise(state: PetState): PetState;
/**
 * Apply the code-activity happiness and discipline boost.
 *
 * Throttling (CODE_ACTIVITY_THROTTLE_SECONDS) must be enforced by the caller
 * (events.ts); this function unconditionally applies the deltas.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the boost is applied.
 */
export declare function applyCodeActivity(state: PetState): PetState;
/**
 * Apply the commit happiness and discipline boost.
 *
 * Throttling (COMMIT_ACTIVITY_THROTTLE_SECONDS) must be enforced by the caller
 * (events.ts); this function unconditionally applies the deltas.
 *
 * @param state - The current pet state.
 * @returns A new PetState after the boost is applied.
 */
export declare function applyCommitActivity(state: PetState): PetState;
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
export declare function promoteToSenior(state: PetState): PetState;
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
export declare function rollOldAgeDeath(state: PetState, random: number): PetState;
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
export declare function rollOldAgeSickness(state: PetState, random: number): PetState;
/**
 * Freeze all tick-based progression. While paused:
 * - `tick()` returns state unchanged
 * - `applyOfflineDecay()` returns state unchanged
 * - `applyCodeActivity()` returns state unchanged
 */
export declare function pause(state: PetState): PetState;
/**
 * Resume normal tick-based progression after a pause.
 */
export declare function resume(state: PetState): PetState;
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
export declare function applyOfflineDecay(state: PetState, elapsedSeconds: number): PetState;
/**
 * Serialise a PetState to a plain JSON-compatible object.
 *
 * The returned object is safe to pass to VS Code's globalState.update().
 *
 * @param state - The pet state to serialise.
 * @returns A plain Record suitable for JSON serialisation.
 */
export declare function serialiseState(state: PetState): Record<string, unknown>;
/**
 * Deserialise a plain object (loaded from globalState) back to a PetState.
 *
 * Unknown keys are silently ignored so older snapshots remain loadable after
 * the schema gains new fields.
 *
 * @param data - The plain object previously returned by serialiseState().
 * @returns A fully typed PetState.
 */
export declare function deserialiseState(data: Record<string, unknown>): PetState;
export {};
//# sourceMappingURL=gameEngine.d.ts.map