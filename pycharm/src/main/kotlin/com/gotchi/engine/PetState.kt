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

    // Care-quality accumulators
    val careScoreHungerSum: Long,
    val careScoreHappinessSum: Long,
    val careScoreHealthSum: Long,
    val careScoreTicks: Long,

    // Events emitted during the last action (cleared on each new action)
    val events: List<String>,

    // Persistent rolling log of the last 20 events (survives across actions)
    val recentEventLog: List<String>,

    /** Unix ms timestamp when this pet was first created. */
    val spawnedAt: Long,

    /** Snacks given in the current wake cycle (resets on wake/createPet). */
    val snacksGivenThisCycle: Int,
)
