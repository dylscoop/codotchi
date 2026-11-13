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
/** Medicine doses needed to cure sickness. Feed, Snack and Play are refused until then. */
export declare const MEDICINE_DOSES_TO_CURE: number;
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
/**
 * Cooldown ticks (100 × 3 s = 5 min) applied to a call type after it is answered.
 * Cooldowns only count down on active (non-idle) ticks. Must match Constants.kt (BUG-S06).
 */
export declare const ATTENTION_ANSWER_COOLDOWN_TICKS: number;
/** Cooldown ticks (100 × 3 s = 5 min) applied to a call type after it expires unanswered. */
export declare const ATTENTION_EXPIRY_COOLDOWN_TICKS: number;
/** Stat penalty applied to the relevant stat when an attention call expires. */
export declare const ATTENTION_EXPIRY_STAT_PENALTY: number;
/** Happiness boost applied when a gift attention call is answered via praise(). */
export declare const GIFT_PRAISE_HAPPINESS_BOOST: number;
/**
 * Active (non-idle, awake) ticks between "take a break" calls: 600 × 3 s = 30 min.
 * The timer only restarts when the break is actually taken (call answered via
 * praise()). Idle time pauses it; an ignored call re-fires after its expiry cooldown.
 */
export declare const BREAK_CALL_INTERVAL_TICKS: number;
/** Happiness boost when a break call is answered via praise() — same as a gift. */
export declare const BREAK_PRAISE_HAPPINESS_BOOST: number;
/**
 * Length of the nap the pet takes when a break call is answered: 100 × 3 s = 5 min.
 * While napping every stat except energy is frozen (energy regenerates), the pet
 * keeps aging, and it can't be woken early — it wakes on its own when the timer runs out.
 */
export declare const BREAK_NAP_TICKS: number;
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
export declare const PLAY_CALL_BASE_CHANCE: number;
export declare const PLAY_CALL_MAX_CHANCE: number;
export declare const PAT_CALL_BASE_CHANCE: number;
export declare const PAT_CALL_MAX_CHANCE: number;
export declare const CRAVING_CALL_BASE_CHANCE: number;
export declare const CRAVING_CALL_MAX_CHANCE: number;
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
     * needy=80 (4 min), standard=200 (10 min), chilled=400 (20 min).
     */
    attentionCallExpiryTicks: number;
    /**
     * Divisor applied to the base and max logChance probabilities for all
     * probabilistic call spawns (poop, misbehaviour, gift).
     * fast=3.0, medium=4.5, slow=6.0 (doubled in v2.24.3 to halve call frequency).
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
    /**
     * When true, the pet can never die — the stat-decay death check and the
     * senior old-age death roll are both skipped, independent of devMode
     * (which also speeds up aging and is meant for testing, not permanent play).
     * Optional so existing config literals don't need it; absent means false.
     */
    immortal?: boolean;
    /**
     * Deathless mode (user setting): health is floored at 1 so the pet can't die
     * from neglect or sickness, but it still gets sick and can still die of old age.
     * Any tick with it on marks the pet "deathless" — off the leaderboard and high
     * score, and floored at 1 health, for life even if the setting is later
     * turned off. Optional; absent means false.
     */
    deathless?: boolean;
    /**
     * Social features (v2.36.0): CPU friends visit, the matchmaker arrives for
     * unmarried seniors. A dev-mode preview until release: only `true` turns it
     * on (absent means off). When off, no visits or proposals start and an
     * ongoing visit ends.
     */
    socialEnabled?: boolean;
}
/** Sensible defaults used when no explicit config is provided. */
export declare const DEFAULT_GAME_CONFIG: GameConfig;
/**
 * Config used by the claude-codotchi Claude Code plugin. Looked up by
 * scripts/action.mjs, statusline.mjs, and the hooks via `LOCAL_PET_GAME_CONFIG
 * ?? DEFAULT_GAME_CONFIG` — the pet living in Claude's own chat is immortal.
 */
export declare const LOCAL_PET_GAME_CONFIG: GameConfig;
/** All valid pet type identifiers. */
export declare const VALID_PET_TYPES: readonly string[];
/** Life-stage names in order. */
export declare const STAGE_ORDER: readonly string[];
/**
 * All valid attention call type identifiers.
 * A call of each type can be active at most once at any given time.
 */
export type AttentionCallType = "hunger" | "unhappiness" | "poop" | "sick" | "low_energy" | "misbehaviour" | "gift" | "critical_health" | "play" | "pat" | "craving" | "break";
/** Every AttentionCallType, for code that needs to list them at runtime. */
export declare const ATTENTION_CALL_TYPES: readonly AttentionCallType[];
/** What a craving attention call asks for. */
export type CravingFood = "meal" | "snack";
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
    /**
     * Unix ms timestamp of the tick on which the pet died; 0 while alive.
     * Persisted so a leaderboard submission made after an IDE restart still
     * reports the real death time, not the time the IDE was reopened.
     */
    readonly diedAt: number;
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
    /** Consecutive active ticks spent at or above MAX_UNCLEANED_POOPS_BEFORE_SICK; frozen while idle or asleep, reset by clean(). */
    readonly poopOverLimitTicks: number;
    /** Ticks since the last misbehaviour attention call fired; used for log-chance formula. */
    readonly ticksSinceLastMisbehaviour: number;
    /** Ticks since the last gift attention call fired; used for log-chance formula. */
    readonly ticksSinceLastGift: number;
    /** Ticks since the last play attention call fired; used for log-chance formula. */
    readonly ticksSinceLastPlayCall: number;
    /** Ticks since the last pat attention call fired; used for log-chance formula. */
    readonly ticksSinceLastPatCall: number;
    /** Ticks since the last craving attention call fired; used for log-chance formula. */
    readonly ticksSinceLastCraving: number;
    /** Active, awake ticks since the last "take a break" call (BREAK_CALL_INTERVAL_TICKS). */
    readonly ticksSinceLastBreakCall: number;
    /** Ticks left in the break nap (BREAK_NAP_TICKS); 0 when not on a break nap. */
    readonly breakNapTicksRemaining: number;
    /** What the active craving call asks for; null when no craving call is active. */
    readonly cravingFood: CravingFood | null;
    /** True once any tick has run with dev mode on — the pet can never go on the leaderboard. */
    readonly devModeEverUsed: boolean;
    /**
     * Local calendar date (YYYY-MM-DD) of the last daily age bump; null in saves
     * from before the feature. See applyDailyAgeBump().
     */
    readonly lastAgeBumpDate: string | null;
    /**
     * Why this pet can't go on the leaderboard, apart from dev mode: "tampered" (the saved
     * state failed its integrity seal) or "unverified" (loaded from a save written before
     * seals existed). "" when eligible.
     */
    readonly leaderboardIneligible: LeaderboardIneligibleReason;
    /** Save-format version (SCHEMA_VERSION). Old saves without it load as version 0 and are migrated. */
    readonly schemaVersion: number;
    /** XP earned by this pet; resets with each new egg. */
    readonly petXp: number;
    /** This pet's level (derived from petXp, stored for display). */
    readonly petLevel: number;
    /** The player's lifetime progression; carried over to the next pet by createPet(). */
    readonly trainer: TrainerProgress;
    /** This pet's daily challenges and streak; a new pet starts afresh. */
    readonly dailies: DailyChallenges;
    /** Boss Battles unlocked at level milestones and not yet beaten (boss ids, oldest first). */
    readonly pendingBosses: readonly string[];
    /** Family line: 1 for a fresh egg, parent's generation + 1 for an heir. */
    readonly generation: number;
    /** The friend visiting now, or the one that visited last; null until the first visit. */
    readonly friend: FriendPet | null;
    /** The pet's other friends (MAX_FRIENDS in all, counting `friend`), most recent first. */
    readonly otherFriends: readonly FriendPet[];
    /** The friend is on the canvas right now; null otherwise. */
    readonly visit: FriendVisit | null;
    /** Active ticks since the last visit started (VISIT_MIN_GAP_TICKS). */
    readonly ticksSinceLastVisit: number;
    /** Who this pet married; null while single. */
    readonly partner: PetIdentity | null;
    /** The egg left by a marriage; hatches as the next pet once this one dies. */
    readonly heirEgg: HeirEgg | null;
    /** dayTimer when the pet became a senior; null before then. Drives the matchmaker. */
    readonly seniorSinceDay: number | null;
    /** A marriage offer waiting for acceptProposal() / declineProposal(); null when none. */
    readonly proposal: Proposal | null;
    /** Active ticks before another proposal can be made after a decline. */
    readonly proposalCooldownTicks: number;
    /** Item ids the pet carries (ITEM_CATALOG), oldest first; at most MAX_ITEMS. */
    readonly items: readonly string[];
    /** Decoration item ids placed on the floor, oldest first; at most MAX_DECOR. */
    readonly decor: readonly string[];
}
/** Who another (CPU) pet is: enough to draw it. */
export interface PetIdentity {
    readonly name: string;
    readonly spriteType: string;
    readonly petType: string;
}
/** The CPU friend that visits; friendship 0–100 (see FRIENDSHIP_LEVELS). */
export interface FriendPet extends PetIdentity {
    readonly friendship: number;
    readonly visits: number;
    /** dayTimer when this friend last visited; drives drifting away (FRIEND_DRIFT_DAYS). */
    readonly lastVisitDay?: number;
}
/** An ongoing visit. Play and gift can each be done once per visit. */
export interface FriendVisit {
    readonly ticksLeft: number;
    readonly played: boolean;
    readonly gifted: boolean;
    /** Item id the friend brought this visit, if any (drawn being dropped on arrival). */
    readonly broughtItem?: string;
    /** Ticks left of the visit-timer pause while a minigame with the friend runs (startFriendGame). */
    readonly gameTicks?: number;
}
/** The egg a married pet leaves for the next generation. */
export interface HeirEgg {
    readonly spriteType: string;
    readonly petType: string;
}
/** A marriage offer: from the friend (at Partner level) or a matchmaker's CPU match. */
export interface Proposal extends PetIdentity {
    readonly from: "friend" | "matchmaker";
}
/**
 * The player's lifetime progression. Survives pet death: hosts pass the old
 * pet's `trainer` into createPet() when a new egg starts.
 */
export interface TrainerProgress {
    readonly xp: number;
    readonly level: number;
    /** Ids of unlocked achievements (see ACHIEVEMENTS), in unlock order. */
    readonly achievements: readonly string[];
    /** Lifetime counters that drive the achievements (keys: AchievementCounter). */
    readonly counters: Readonly<Record<string, number>>;
    /** Local date (YYYY-MM-DD) the daily XP buckets belong to. */
    readonly xpDay: string;
    /** XP earned today per daily-capped source (see XP_DAILY_CAPS). */
    readonly xpToday: Readonly<Record<string, number>>;
    /** Local clock hour (YYYY-MM-DDTHH) the hourly XP buckets belong to. */
    readonly xpHour: string;
    /** XP earned this hour per hourly-capped source (see XP_HOURLY_CAPS). */
    readonly xpThisHour: Readonly<Record<string, number>>;
}
/** A pet's daily challenges (see DAILY_CHALLENGES) and its streak. */
export interface DailyChallenges {
    /** Local date (YYYY-MM-DD) the picks belong to; "" before the first roll. */
    readonly day: string;
    /** Today's challenge ids: one coder, one keeper, one wildcard. */
    readonly picks: readonly string[];
    /** Trainer counters when the day started; progress is measured from these. */
    readonly baseline: Readonly<Record<string, number>>;
    /** Ids of today's completed challenges. */
    readonly done: readonly string[];
    /** Weekdays in a row with all three done (weekends neither break nor extend it). */
    readonly streak: number;
    /** Last day (YYYY-MM-DD) the streak was extended. */
    readonly streakDay: string;
}
/** Reasons (besides dev mode) a pet can't be submitted to the leaderboard. */
export type LeaderboardIneligibleReason = "" | "tampered" | "unverified" | "deathless";
/** True once this pet has lived in deathless mode (it can't reach the leaderboard or high score). */
export declare function isDeathlessPet(state: PetState): boolean;
/**
 * Mark a pet as having used deathless mode. Sticky; a "tampered" mark wins since
 * it is the stronger reason. Returns the same object when nothing changes.
 */
export declare function markDeathless(state: PetState): PetState;
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
 * Animals in the random rotation pool at pet creation.
 * All entries have equal probability (1 / ROTATION_ANIMALS.length each).
 * Note: some rotation animals (dog, snake, sheep) are also zodiac animals —
 * they remain accessible via zodiac character codes too.
 */
export declare const ROTATION_ANIMALS: readonly ["cat", "dog", "snake", "sheep", "classic", "kangaroo", "dragon"];
/**
 * All valid sprite type keys: the 12 Chinese zodiac animals (reachable via
 * character code only), the rotation pool, and the custom characters.
 */
export type SpriteType = "rat" | "ox" | "tiger" | "rabbit" | "dragon" | "snake" | "horse" | "sheep" | "monkey" | "rooster" | "dog" | "pig" | typeof ROTATION_ANIMALS[number] | "tim" | "testsprite" | "stu";
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
 * @param trainer - The previous pet's trainer progress, so XP and achievements carry over; null starts fresh.
 * @param lineage - Family line for an heir (see hatchHeir); null starts generation 1.
 * @returns A freshly initialised PetState.
 */
export declare function createPet(name: string, petType: string, unlockedCharacter?: string | null, trainer?: TrainerProgress | null, lineage?: {
    generation: number;
} | null): PetState;
/** Local calendar date of a timestamp as YYYY-MM-DD. */
export declare function localDateKey(ms: number): string;
/**
 * Daily age bump: the first tick on a new local calendar day adds one day to
 * dayTimer and drops the fraction (8.5 → 9.0), so idle pets still age. Only one
 * bump however many days were missed. Saves from before the feature
 * (lastAgeBumpDate null) just record today. Emits "aged_overnight".
 */
export declare function applyDailyAgeBump(state: PetState, nowMs?: number): PetState;
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
export declare function tick(state: PetState, isIdle?: boolean, isDeepIdle?: boolean, config?: GameConfig, nowMs?: number): PetState;
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
 * Apply the stat cost of viewing the token cost overlay: same energy/happiness
 * change as a pat, but no weight, events, or attention-call side effects — the
 * cost bubble is shown separately, so this must not emit a "patted" event that
 * would race it with a reaction bubble (BUGFIX-140).
 *
 * @param state - The current pet state.
 * @returns A new PetState after the action.
 */
export declare function applyTokenCostView(state: PetState): PetState;
/**
 * Return the happiness delta for a mini-game outcome.
 *
 * @param game - "guess" (legacy coin-flip), "memory" (Pattern Memory),
 *               "left_right" (Left / Right), "higher_lower" (Higher or Lower),
 *               "coin_flip" (Coin Flip), "blackjack" (Stu's one-round Blackjack),
 *               "fetch" (the dog's Coin Flip), "tug_of_war" (the dog's Left / Right),
 *               "boxing" (the kangaroos' Left / Right), "laser" (the cat's Left / Right) or
 *               "boss_battle" (turn-based Boss Battle).
 * @param result - "win" or "lose" ("push" too for blackjack).
 * @returns A positive integer to add to the pet's happiness stat (0 for coin_flip loss).
 */
export declare function happinessDeltaForMinigame(game: string, result: string): number;
/**
 * The game whose stats a mini-game uses. The dog's Fetch replaces Coin Flip and
 * its Tug-of-War replaces Left / Right, as do the kangaroos' Boxing and the cat's
 * Laser Pointer, so they share those games' rewards.
 */
export declare function minigameStatsKey(game: string): string;
/**
 * Apply a mini-game result happiness delta to the pet state.
 *
 * Also applies an additional weight loss for vigorous mini-games (BUGFIX-034):
 *   - left_right, tug_of_war, boxing, laser and higher_lower: −3 extra weight (total −6 with play() baseline)
 *   - coin_flip, fetch and blackjack: no extra weight loss (total −3 from play() only)
 *
 * @param state - The current pet state.
 * @param game - "left_right", "higher_lower", "coin_flip", "blackjack", "fetch", "tug_of_war", "boxing", "laser", "boss_battle", "guess", or "memory".
 * @param result - "win" or "lose" ("push" too for blackjack).
 * @param bossAccess - Boss Battle access from the host's dev-mode settings:
 *          "off" ignores every boss result, "queue" needs an unlocked boss,
 *          "always" also lets a pet with no boss waiting fight its tier's boss.
 * @returns A new PetState after the happiness delta is applied. A win awards
 *          "minigame" XP, or "boss_battle" XP for the Boss Battle.
 */
export declare function applyMinigameResult(state: PetState, game: string, result: string, bossAccess?: BossAccess): PetState;
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
 * If a "break" call is active, it is answered with the same happiness bonus
 * (BREAK_PRAISE_HAPPINESS_BOOST) and the pet takes a BREAK_NAP_TICKS (5-minute)
 * nap while you rest: stats are frozen except energy, aging continues, and it
 * can't be woken early — it wakes on its own.
 * If an "unhappiness" attention call is active, it is answered instead.
 * Refused while sick ("praise_refused_sick") — give medicine before a break.
 *
 * @param state - The current pet state.
 * @param opts - Optional per-character overrides.
 * @param opts.breakWeightGain - Weight gained when a break call is answered (the dog's big bone; default 0).
 * @returns A new PetState after the action.
 */
export declare function praise(state: PetState, opts?: {
    breakWeightGain?: number;
}): PetState;
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
/** How long a friend's visit lasts, in ticks (3 min). Counts down even while idle. */
export declare const VISIT_TICKS: number;
/** Active ticks after a visit starts before another can start (~1 h). */
export declare const VISIT_MIN_GAP_TICKS: number;
/** Chance per active tick, once the gap is over, that the friend visits (~50 min on average). */
export declare const VISIT_CHANCE_PER_TICK: number;
/**
 * Visit pacing. In dev mode the friend comes devModeAgingMultiplier times
 * faster (shorter gap, higher chance) so visits can be tested; a visit itself
 * still lasts VISIT_TICKS.
 */
export declare function visitPacing(config: GameConfig): {
    minGapTicks: number;
    chancePerTick: number;
};
/** Friendship gained just by visiting. */
export declare const FRIENDSHIP_PER_VISIT: number;
/** Chance a visit brings a gift for the pet. */
export declare const FRIEND_GIFT_CHANCE: number;
/** Friendship gained when the friend brings a gift. */
export declare const FRIENDSHIP_PER_RECEIVED_GIFT: number;
/** Friendship gained by playing together (once per visit). */
export declare const FRIENDSHIP_PER_PLAY: number;
/** Happiness gained by playing together. */
export declare const FRIEND_PLAY_HAPPINESS: number;
/** Energy spent playing together. */
export declare const FRIEND_PLAY_ENERGY_COST: number;
/** Friendship gained by giving the friend a toy (once per visit); food is a little less, decor more (FRIENDSHIP_PER_GIFT_KIND). */
export declare const FRIENDSHIP_PER_GIVEN_GIFT: number;
/** Friendship lost per game-day boundary without a visit. */
export declare const FRIENDSHIP_DECAY_PER_DAY: number;
/** Senior game-days without a marriage before the matchmaker arrives. */
export declare const MATCHMAKER_SENIOR_DAYS: number;
/** Most friends a pet can have at once (the visiting / last friend plus otherFriends). */
export declare const MAX_FRIENDS: number;
/** Chance a visit, with a friend slot free, is from someone new rather than an old friend. */
export declare const NEW_FRIEND_CHANCE: number;
/** Game-days without a visit, at 0 friendship, before a friend drifts away. */
export declare const FRIEND_DRIFT_DAYS: number;
/** Active ticks after a declined proposal before another can be made (~1 game day). */
export declare const PROPOSAL_DECLINE_COOLDOWN_TICKS: number;
/** Happiness gained on marriage. */
export declare const MARRIAGE_HAPPINESS: number;
/** Custom-character sprites an heir egg never inherits from its parent. */
export declare const HEIR_EXCLUDED_SPRITES: readonly string[];
/** Friendship levels, lowest first: the level is the last one whose `min` is reached. */
export declare const FRIENDSHIP_LEVELS: readonly {
    readonly name: string;
    readonly min: number;
}[];
/** Friendship needed for the "best_friends" event and achievement. */
export declare const BEST_FRIEND_FRIENDSHIP: number;
/** Friendship needed before the friend proposes. */
export declare const PARTNER_FRIENDSHIP: number;
/** Names CPU friends and matchmaker matches are drawn from. */
export declare const FRIEND_NAMES: readonly string[];
/** What an item does when used: food feeds, a toy cheers up, decor goes on the floor. */
export type ItemKind = "food" | "toy" | "decor";
/** One kind of item the pet can own. */
export interface ItemDef {
    readonly id: string;
    readonly kind: ItemKind;
    readonly emoji: string;
    readonly name: string;
}
/** Every item there is. Ids are saved, so never rename one. */
export declare const ITEM_CATALOG: readonly ItemDef[];
/** Most items the pet can carry; a new one is lost when the bag is full. */
export declare const MAX_ITEMS: number;
/** Most decorations on the floor at once; placing another replaces the oldest. */
export declare const MAX_DECOR: number;
/** Hunger from eating a food item. */
export declare const ITEM_FOOD_HUNGER: number;
/** Happiness from playing with a toy item. */
export declare const ITEM_TOY_HAPPINESS: number;
/** Happiness from placing a decoration. */
export declare const ITEM_DECOR_HAPPINESS: number;
/** Friendship from giving the visiting friend an item, by kind. */
export declare const FRIENDSHIP_PER_GIFT_KIND: Readonly<Record<ItemKind, number>>;
/** Every this-many minigame wins finds an item. */
export declare const MINIGAME_WINS_PER_ITEM: number;
/** The item with this id, or undefined. */
export declare function itemById(id: string): ItemDef | undefined;
/** A random item id. */
export declare function randomItemId(rand?: () => number): string;
/**
 * Use an item the pet owns: food raises hunger, a toy raises happiness and a
 * decoration goes on the floor (the oldest goes back when MAX_DECOR are out)
 * for a little happiness. Emits `item_used_<id>`. Refused (event
 * `item_refused`) when the pet doesn't own it, is asleep or has died.
 */
export declare function useItem(state: PetState, itemId: string): PetState;
/**
 * Plain-text list of the pet's items for the terminal plugins.
 *
 * @param cmd - How the plugin's commands are written, e.g. "/codotchi ".
 */
export declare function itemListLines(state: Pick<PetState, "name" | "items" | "decor">, cmd?: string): string[];
/** "an apple", "a kite". */
export declare function withArticle(name: string): string;
/** One-line result for useItem(), read from its events. */
export declare function itemActionMessage(state: Pick<PetState, "name" | "events">, itemId: string): string;
/** The friendship level name for a friendship score. */
export declare function friendshipLevel(friendship: number): string;
/** A random CPU pet, never sharing a name with the ones in `avoid`. */
export declare function randomFriendIdentity(avoid?: readonly string[], rand?: () => number): PetIdentity;
/**
 * Who visits, from the pet's friends (the last visitor first): with a slot
 * free, a NEW_FRIEND_CHANCE share of `r` means someone new (null); the rest
 * picks a friend weighted by friendship + 10, so close friends come more often.
 *
 * @param r - A random number in [0, 1).
 */
export declare function pickVisitor(roster: readonly FriendPet[], r: number): FriendPet | null;
/** Friendship from playing a minigame with the visiting friend, by result. A plain play counts as a draw. */
export declare const FRIENDSHIP_PER_PLAY_RESULT: Readonly<Record<"win" | "draw" | "lose", number>>;
/** Most ticks a minigame with the friend holds the visit open (the visit timer is paused meanwhile). */
export declare const FRIEND_GAME_PAUSE_TICKS: number;
/**
 * The pet starts a minigame with the visiting friend: the visit timer pauses
 * for up to FRIEND_GAME_PAUSE_TICKS so the friend doesn't leave mid-game.
 * No events; unchanged when there is no visit, it already played, or the pet sleeps.
 */
export declare function startFriendGame(state: PetState): PetState;
/**
 * Play with the visiting friend: friendship and happiness up, a little energy
 * spent. Once per visit. With a minigame `result` ("win", "lose", or "draw" /
 * "push") the friendship gain follows FRIENDSHIP_PER_PLAY_RESULT and a loss
 * gives half the happiness; it also emits `friend_game_<win|draw|lose>`.
 * Refused (event `friend_play_refused`) with no visit, when already played
 * this visit, while asleep, or with too little energy.
 */
export declare function playWithFriend(state: PetState, result?: string): PetState;
/**
 * Give the visiting friend an item the pet owns: friendship up by
 * FRIENDSHIP_PER_GIFT_KIND for its kind, and the item is gone. Without
 * `itemId` the pet gives its oldest item. Once per visit. Emits
 * `friend_gift_given` and `friend_gift_item_<id>`. Refused (event
 * `friend_gift_refused`) with no visit, when already gifted this visit,
 * while asleep, or when the pet has no such item.
 */
export declare function giveFriendGift(state: PetState, itemId?: string): PetState;
/**
 * Say goodbye to the visiting friend: the visit ends early. Emits
 * `friend_waved_goodbye` then `friend_visit_ended`. Refused (event
 * `friend_goodbye_refused`) when no friend is visiting.
 */
export declare function sayGoodbyeToFriend(state: PetState): PetState;
/**
 * Accept the pending proposal: the pet marries. Emits `married`. Refused
 * (event `proposal_refused`) when there is no offer.
 *
 * Marriage does not lay an heir egg while offspring are being redesigned
 * (backlog); `heirEgg` and `hatchHeir` stay for that redesign and old saves.
 */
export declare function acceptProposal(state: PetState, _rand?: () => number): PetState;
/** Decline the pending proposal; no new offer for PROPOSAL_DECLINE_COOLDOWN_TICKS active ticks. */
export declare function declineProposal(state: PetState): PetState;
/**
 * Hatch the heir egg a married parent left behind, as a new egg one
 * generation on. Returns null when the parent has no heir egg.
 *
 * @param parent - The previous pet (normally dead), carrying `heirEgg`.
 * @param name - The new pet's name.
 * @param trainer - Trainer progress to carry over (defaults to the parent's).
 */
export declare function hatchHeir(parent: PetState, name: string, trainer?: TrainerProgress | null): PetState | null;
/** The social slice of a pet that the terminal text helpers read. */
export type SocialView = Pick<PetState, "name" | "generation" | "friend" | "visit" | "partner" | "heirEgg" | "proposal"> & Partial<Pick<PetState, "otherFriends">>;
/**
 * Plain-text lines for the terminal plugins' status output: generation,
 * friend and friendship, an ongoing visit, partner, heir egg and any offer
 * (with the command that answers it). Empty for a pet with no social life yet.
 *
 * @param state - The pet (any object with the social fields).
 * @param cmd - How the plugin's commands are written, e.g. "/codotchi " or "codotchi_".
 */
export declare function socialSummaryLines(state: SocialView, cmd?: string): string[];
/**
 * One-line result for a social action (playWithFriend, giveFriendGift,
 * acceptProposal, declineProposal), read from the events it emitted.
 */
export declare function socialActionMessage(state: SocialView & Pick<PetState, "events"> & Partial<Pick<PetState, "items">>): string;
/** Parse the social fields from saved JSON, filling in defaults (saves before schemaVersion 2 have none). */
export declare function deserialiseSocial(data: Record<string, unknown>): Pick<PetState, "generation" | "friend" | "otherFriends" | "visit" | "ticksSinceLastVisit" | "partner" | "heirEgg" | "seniorSinceDay" | "proposal" | "proposalCooldownTicks" | "items" | "decor">;
/** Current save-format version. Bump when a migration step is added to deserialiseState(). */
export declare const SCHEMA_VERSION: number;
/** What earned the XP. Each source maps to an amount, optional hourly / daily caps and counters. */
export type XpSource = "code" | "commit" | "call" | "care" | "snack" | "clean" | "cure" | "minigame" | "evolve" | "debug" | "boss_kill" | "boss_battle" | "befriend" | "best_friend" | "friend_play" | "friend_gift" | "marriage" | "heir";
/**
 * XP per source. Care actions (care / snack / clean / cure) pay nothing on
 * their own: they only earn the "call" XP when they answer an attention call.
 */
export declare const XP_AMOUNTS: Readonly<Record<XpSource, number>>;
/** Bonus XP for unlocking an achievement. */
export declare const XP_ACHIEVEMENT_BONUS: number;
/** Boss ids, weakest first. Their art and battle rules live in the webview's bossArt.js. */
export declare const BOSS_IDS: readonly string[];
/** Most unbeaten bosses a pet can hold at once. */
export declare const BOSS_QUEUE_MAX: number;
/** Boss Battle access, from the host's dev-mode settings (see applyMinigameResult). */
export type BossAccess = "off" | "queue" | "always";
/**
 * Boss Battle access for the host's settings. Boss Battles are a dev-mode
 * preview: off unless dev mode is active and the Boss Battle setting is on.
 */
export declare function bossAccessFor(devMode: boolean, enabled: boolean, alwaysAvailable: boolean): BossAccess;
/** Pet levels that unlock a Boss Battle: 3, 5, 10, then every 5. */
export declare function isBossMilestone(level: number): boolean;
/** The boss tier for a pet level: Syntax Wraith, NullPointer Demon from 5, StackOverflow Behemoth from 10. */
export declare function bossIdForLevel(level: number): string;
/** Bosses unlocked by levelling from `from` up to `to` (one per milestone passed). */
export declare function bossesUnlockedBetween(from: number, to: number): string[];
/**
 * Load the pending bosses. Saves from before boss unlocks get one boss of
 * their tier if the pet is already past the first milestone.
 */
export declare function deserialisePendingBosses(raw: unknown, petLevel: number): string[];
/** Hourly XP caps per source (local clock hour). Sources not listed have no hourly cap. */
export declare const XP_HOURLY_CAPS: Readonly<Partial<Record<XpSource, number>>>;
/** Daily XP caps per source (local day). Sources not listed are uncapped. */
export declare const XP_DAILY_CAPS: Readonly<Partial<Record<XpSource, number>>>;
/** Commits made from midnight up to this hour (local time) count as late-night commits. */
export declare const NIGHT_OWL_END_HOUR: number;
/** Which tab an achievement sits under: the two paths, or shared trainer milestones. */
export type AchievementPath = "coder" | "keeper" | "trainer";
/** An unlockable achievement: reached when `counter` (or the trainer level, for "level") hits `threshold`. */
export interface Achievement {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly emoji: string;
    readonly counter: string;
    readonly threshold: number;
    readonly path: AchievementPath;
    /** Shown greyed out; can't be unlocked yet because its feature hasn't shipped. */
    readonly comingSoon?: boolean;
}
/** Every achievement, in display order. */
export declare const ACHIEVEMENTS: readonly Achievement[];
/** A fresh trainer with no XP. */
export declare function createTrainer(): TrainerProgress;
/** XP needed to go from `level` to `level + 1`. */
export declare function xpToNextLevel(level: number): number;
/** Level reached with `xp` total XP, plus the progress into that level. */
export declare function levelProgress(xp: number): {
    level: number;
    intoLevel: number;
    needed: number;
};
/** Local calendar date as YYYY-MM-DD. */
export declare function localDayKey(now: number): string;
/** Local clock hour as YYYY-MM-DDTHH. */
export declare function localHourKey(now: number): string;
/** Progress towards an achievement: current value (capped at the threshold) and the threshold. */
export declare function achievementProgress(a: Achievement, trainer: TrainerProgress): {
    value: number;
    threshold: number;
};
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
export declare function awardXp(state: PetState, source: XpSource, now?: number, answeredCall?: boolean): PetState;
/** Look up an achievement by id. */
export declare function achievementById(id: string): Achievement | undefined;
/**
 * Notification text for a progression event (achievement unlock or trainer
 * level-up), or null for any other event. Pet level-ups only show in the pet's
 * speech bubble, so they return null too.
 */
export declare function progressionMessage(event: string, state: PetState): string | null;
/** Parse a TrainerProgress from saved JSON, filling in defaults for anything missing. */
export declare function deserialiseTrainer(raw: unknown): TrainerProgress;
/** Which pool a daily challenge comes from. Each day picks one from each. */
export type DailyChallengePath = "coder" | "keeper" | "wild";
/** A daily challenge: done once every counter in `reqs` has gone up by its target since the day started. */
export interface DailyChallenge {
    readonly id: string;
    readonly path: DailyChallengePath;
    readonly text: string;
    readonly reqs: readonly (readonly [counter: string, target: number])[];
}
/** XP for each completed daily challenge. Uncapped, but each pays once a day. */
export declare const DAILY_CHALLENGE_XP: number;
/** Extra XP for completing all three of the day's challenges. */
export declare const DAILY_ALL_DONE_BONUS: number;
/** Every daily challenge, grouped by pool. */
export declare const DAILY_CHALLENGES: readonly DailyChallenge[];
/** Empty daily-challenge state for a new pet. */
export declare function createDailies(): DailyChallenges;
/** Look up a daily challenge by id. */
export declare function dailyChallengeById(id: string): DailyChallenge | undefined;
/** The day's three challenge ids (coder, keeper, wild), seeded from the date and the pet. */
export declare function pickDailyChallenges(day: string, pet: Pick<PetState, "name" | "spawnedAt">): string[];
/** Saturday or Sunday. */
export declare function isWeekendDay(day: string): boolean;
/** The most recent weekday before `day`. */
export declare function previousWeekday(day: string): string;
/**
 * The streak as of `now`: weekdays in a row with all three challenges done.
 * Weekends neither break nor extend it.
 */
export declare function currentStreak(dailies: DailyChallenges, now?: number): number;
/** Progress on each requirement of `c`, capped at its target. */
export declare function dailyChallengeProgress(c: DailyChallenge, baseline: Readonly<Record<string, number>>, counters: Readonly<Record<string, number>>): {
    counter: string;
    value: number;
    target: number;
}[];
/** One of today's challenges, ready to display. */
export interface DailyChallengeView {
    readonly id: string;
    readonly path: DailyChallengePath;
    readonly text: string;
    readonly value: number;
    readonly target: number;
    readonly done: boolean;
}
/** Today's challenges with progress, and the streak as of `now`. Works before the day's first roll too. */
export declare function dailiesView(state: Pick<PetState, "dailies" | "name" | "spawnedAt"> & {
    readonly trainer: Pick<TrainerProgress, "counters">;
}, now?: number): {
    challenges: DailyChallengeView[];
    streak: number;
    allDone: boolean;
};
/** Parse DailyChallenges from saved JSON, filling in defaults for anything missing. */
export declare function deserialiseDailies(raw: unknown): DailyChallenges;
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
//# sourceMappingURL=gameEngine.d.ts.map