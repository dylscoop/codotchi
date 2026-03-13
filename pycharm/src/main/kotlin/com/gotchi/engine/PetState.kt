package com.gotchi.engine

/**
 * Full serialisable snapshot of the pet's state.
 * All fields are camelCase to match the JS/TS webview protocol.
 */
data class PetState(
    // Identity
    val name: String,
    val petType: String,
    val color: String,

    // Core stats
    val hunger: Int,
    val happiness: Int,
    val discipline: Int,
    val energy: Int,
    val health: Int,
    val weight: Int,
    val ageDays: Int,

    // Life-cycle
    val stage: String,
    val character: String,
    val alive: Boolean,
    val sick: Boolean,
    val sleeping: Boolean,

    // Derived display fields
    val mood: String,
    val sprite: String,
    val careScore: Double,

    // Bookkeeping
    val ticksAlive: Int,
    val poops: Int,
    val ticksSinceLastPoop: Int,
    /**
     * Ticks until the next dropping.  Sampled fresh each time the pet poops
     * using the type's poopIntervalMultiplier and poopIntervalVolatility.
     */
    val nextPoopIntervalTicks: Int,
    val consecutiveSnacks: Int,
    val hungerZeroTicks: Int,
    val medicineDosesGiven: Int,

    /**
     * Monotonically-increasing fractional day counter.
     * `ageDays` is derived as `dayTimer.toInt()` each tick.
     * Advances by `1.0 / TICKS_PER_GAME_DAY_SLEEPING` per tick while sleeping,
     * or `1.0 / TICKS_PER_GAME_DAY_AWAKE` per tick while awake.
     */
    val dayTimer: Double,

    // Care-quality accumulators
    val careScoreHungerSum: Long,
    val careScoreHappinessSum: Long,
    val careScoreHealthSum: Long,
    val careScoreTicks: Long,

    // Events emitted during the last action (cleared on each new action)
    val events: List<String>,

    // Persistent rolling log of the last 20 events (survives across actions)
    val recentEventLog: List<String>,

    /** Whether the IDE was idle on the previous tick (used to detect idle transition). */
    val wasIdle: Boolean,

    /** Whether the IDE was in deep idle (≥10 min) on the previous tick. */
    val wasDeepIdle: Boolean,

    /** Unix ms timestamp when this pet was first created. */
    val spawnedAt: Long,

    /** Snacks given in the current wake cycle (resets on wake/createPet). */
    val snacksGivenThisCycle: Int,

    // ── Attention Call fields ────────────────────────────────────────────────

    /** The currently active attention call type, or null if none is active. */
    val activeAttentionCall: String?,

    /** Number of active (non-idle) ticks elapsed since the current attention call fired. */
    val attentionCallActiveTicks: Int,

    /** Per-type cooldown counters (ticks remaining). Decremented each tick. */
    val attentionCallCooldowns: Map<String, Int>,

    /** Cumulative count of attention calls that expired unanswered (decays slowly over time). */
    val neglectCount: Int,

    /** Ticks the current poop(s) have remained uncleaned; resets to 0 when poops === 0. */
    val ticksWithUncleanedPoop: Int,

    /** Ticks since the last misbehaviour attention call fired; used for log-chance formula. */
    val ticksSinceLastMisbehaviour: Int,

    /** Ticks since the last gift attention call fired; used for log-chance formula. */
    val ticksSinceLastGift: Int,
)
