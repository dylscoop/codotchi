package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Unit tests for the game engine.
 *
 * Covers:
 * - BUGFIX-113: floor-snack cap (startSnack / consumeSnack)
 * - Pause / resume behaviour
 */
class GameEngineTest {

    /** Minimal pet state for testing — all defaults via createPet. */
    private fun makePet(
        snacksOnFloor: Int = 0,
        snacksGivenThisCycle: Int = 0,
        paused: Boolean = false,
        energy: Int = 100,
        happiness: Int = 50,
        weight: Int = 40,
    ): PetState {
        val base = createPet("Pixel", "codeling", "neon")
        return base.copy(
            snacksOnFloor        = snacksOnFloor,
            snacksGivenThisCycle = snacksGivenThisCycle,
            paused               = paused,
            energy               = energy,
            happiness            = happiness,
            weight               = weight,
        )
    }

    // ── startSnack ───────────────────────────────────────────────────────────

    @Test
    fun `startSnack emits snack_refused when floor is full`() {
        val pet  = makePet(snacksOnFloor = MAX_FLOOR_SNACKS)
        val next = startSnack(pet)
        assertTrue(next.events.contains("snack_refused"))
    }

    @Test
    fun `startSnack does not increment snacksGivenThisCycle when floor is full`() {
        val pet  = makePet(snacksOnFloor = MAX_FLOOR_SNACKS, snacksGivenThisCycle = 1)
        val next = startSnack(pet)
        assertEquals(1, next.snacksGivenThisCycle)
    }

    @Test
    fun `startSnack emits snack_placed and increments snacksOnFloor on success`() {
        val pet  = makePet(snacksOnFloor = 1)
        val next = startSnack(pet)
        assertTrue(next.events.contains("snack_placed"))
        assertEquals(2, next.snacksOnFloor)
    }

    @Test
    fun `startSnack emits snack_refused when per-cycle cap reached`() {
        val pet  = makePet(snacksGivenThisCycle = SNACK_MAX_PER_CYCLE)
        val next = startSnack(pet)
        assertTrue(next.events.contains("snack_refused"))
    }

    // ── consumeSnack ─────────────────────────────────────────────────────────

    @Test
    fun `consumeSnack decrements snacksOnFloor`() {
        val pet  = makePet(snacksOnFloor = 2)
        val next = consumeSnack(pet)
        assertEquals(1, next.snacksOnFloor)
    }

    @Test
    fun `consumeSnack is silently ignored when snacksOnFloor is already 0 (duplicate report from another window)`() {
        val pet  = makePet(snacksOnFloor = 0, happiness = 40, weight = 10)
        val next = consumeSnack(pet)
        assertEquals(0, next.snacksOnFloor)
        assertEquals(40, next.happiness)
        assertEquals(10, next.weight)
        assertEquals(emptyList<String>(), next.events, "no snack_refused, so no 'threw the snack away' toast")
    }

    // ── pause / resume ───────────────────────────────────────────────────────

    @Test
    fun `pause sets paused to true and emits game_paused`() {
        val pet  = makePet()
        assertFalse(pet.paused)
        val next = pause(pet)
        assertTrue(next.paused)
        assertTrue(next.events.contains("game_paused"))
    }

    @Test
    fun `resume sets paused to false and emits game_resumed`() {
        val pet  = makePet(paused = true)
        val next = resume(pet)
        assertFalse(next.paused)
        assertTrue(next.events.contains("game_resumed"))
    }

    @Test
    fun `tick returns state unchanged when paused`() {
        val pet  = makePet(paused = true)
        val next = tick(pet)
        assertEquals(pet.hunger,     next.hunger)
        assertEquals(pet.ticksAlive, next.ticksAlive)
    }

    @Test
    fun `applyOfflineDecay returns state unchanged when paused`() {
        val pet  = makePet(paused = true).copy(hunger = 80, happiness = 80)
        val next = applyOfflineDecay(pet, 3600)
        assertEquals(80, next.hunger)
        assertEquals(80, next.happiness)
    }

    @Test
    fun `applyCodeActivity returns state unchanged when paused`() {
        val pet  = makePet(paused = true).copy(happiness = 50)
        val next = applyCodeActivity(pet)
        assertEquals(50, next.happiness)
    }

    // ── tick clears stale events while paused ───────────────────────────────

    @Test
    fun `tick clears events when paused and events non-empty`() {
        val pet  = makePet(paused = true).copy(events = listOf("game_paused"))
        val next = tick(pet)
        assertTrue(next.events.isEmpty())
    }

    @Test
    fun `tick returns same reference when paused and events already empty`() {
        val pet  = makePet(paused = true).copy(events = emptyList())
        val next = tick(pet)
        assertSame(pet, next)
    }

    // ── SILENT_EVENTS — recentEventLog filtering ────────────────────────────

    @Test
    fun `pause does not append to recentEventLog`() {
        val pet    = makePet()
        val before = pet.recentEventLog.size
        val next   = pause(pet)
        assertEquals(before, next.recentEventLog.size)
    }

    @Test
    fun `resume does not append to recentEventLog`() {
        val pet    = makePet(paused = true)
        val before = pet.recentEventLog.size
        val next   = resume(pet)
        assertEquals(before, next.recentEventLog.size)
    }

    @Test
    fun `snack_placed does not append to recentEventLog`() {
        val pet    = makePet()
        val before = pet.recentEventLog.size
        val next   = startSnack(pet)
        assertTrue(next.events.contains("snack_placed"))
        assertEquals(before, next.recentEventLog.size)
    }

    @Test
    fun `fed_meal non-silent event appends to recentEventLog`() {
        val pet    = makePet().copy(hunger = 50)
        val before = pet.recentEventLog.size
        val next   = feedMeal(pet, 0)
        assertTrue(next.events.contains("fed_meal"))
        assertEquals(before + 1, next.recentEventLog.size)
    }

    // ── per-character weight overrides ───────────────────────────────────────

    @Test
    fun `feedMeal feedMealWeightGain overrides default weight gain`() {
        val pet  = makePet().copy(weight = 10)
        val next = feedMeal(pet, 0, feedMealWeightGain = 1)
        assertEquals(11, next.weight)
    }

    @Test
    fun `consumeSnack feedSnackWeightGain overrides default weight gain`() {
        val pet  = makePet().copy(weight = 10, snacksOnFloor = 1)
        val next = consumeSnack(pet, feedSnackWeightGain = 2)
        assertEquals(12, next.weight)
    }

    @Test
    fun `play playWeightLoss overrides default weight loss`() {
        val pet  = makePet().copy(weight = 10, energy = 50)
        val next = play(pet, playWeightLoss = 5)
        assertEquals(5, next.weight)
    }

    // ── applyTokenCostView — BUGFIX-142 ─────────────────────────────────────

    @Test
    fun `applyTokenCostView increases happiness by 10`() {
        val pet  = makePet(happiness = 50, energy = 50)
        val next = applyTokenCostView(pet)
        assertEquals(60, next.happiness)
    }

    @Test
    fun `applyTokenCostView decreases energy by 20`() {
        val pet  = makePet(energy = 50)
        val next = applyTokenCostView(pet)
        assertEquals(30, next.energy)
    }

    @Test
    fun `applyTokenCostView does not change weight`() {
        val pet  = makePet(weight = 30, energy = 50)
        val next = applyTokenCostView(pet)
        assertEquals(30, next.weight)
    }

    @Test
    fun `applyTokenCostView does not emit a patted event`() {
        val pet  = makePet(energy = 50)
        val next = applyTokenCostView(pet)
        assertTrue(next.events.isEmpty())
    }

    @Test
    fun `applyTokenCostView clamps energy at 0 rather than refusing when energy below 20`() {
        val pet  = makePet(energy = 15, happiness = 50)
        val next = applyTokenCostView(pet)
        assertEquals(0, next.energy)
        assertEquals(60, next.happiness)
    }

    @Test
    fun `applyTokenCostView clears any stale events already on state`() {
        val pet  = makePet(energy = 50).copy(events = listOf("snack_placed"))
        val next = applyTokenCostView(pet)
        assertTrue(next.events.isEmpty())
    }

    // ── Sickness sources: only poop / overfeeding, never starvation ──────────

    @Test
    fun `does not become sick from starvation damage`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 2, health = 100)
        val next = tick(pet)
        assertFalse(next.sick)
        assertFalse(next.events.contains("became_sick"))
        assertTrue(next.events.contains("starvation_damage"))
    }

    @Test
    fun `stays sick-free after many consecutive starvation-damage ticks`() {
        var pet = makePet().copy(hunger = 0, hungerZeroTicks = 99, health = 100)
        repeat(10) { pet = tick(pet) }
        assertFalse(pet.sick)
    }

    // ── Idle safety floor: sick or losing health while idle ───────────────────

    @Test
    fun `does not raise health already below IDLE_STAT_FLOOR when starving pet takes damage while idle`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, health = 5)
        val next = tick(pet, isIdle = true, isDeepIdle = false)
        assertEquals(5, next.health)
    }

    @Test
    fun `does not raise health already below IDLE_STAT_FLOOR during deep idle`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, health = 5)
        val next = tick(pet, isIdle = false, isDeepIdle = true)
        assertEquals(5, next.health)
    }

    @Test
    fun `floors health at IDLE_STAT_FLOOR when a healthy pet takes damage while idle`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, sick = true, health = 25)
        val next = tick(pet, isIdle = true, isDeepIdle = false)
        assertTrue(next.health >= IDLE_STAT_FLOOR, "health should not decay below the idle floor (got ${next.health})")
    }

    @Test
    fun `does not floor health when starving and not idle -- pet can still die`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, health = 5)
        val next = tick(pet)
        assertFalse(next.alive)
    }

    @Test
    fun `does not raise hunger happiness and energy already below IDLE_STAT_FLOOR for a sick pet while idle`() {
        val pet  = makePet().copy(sick = true, hunger = 5, happiness = 5, energy = 5, health = 50)
        val next = tick(pet, isIdle = true, isDeepIdle = false)
        assertTrue(next.hunger <= 5, "hunger should not be raised above its starting value (got ${next.hunger})")
        assertTrue(next.happiness <= 5, "happiness should not be raised above its starting value (got ${next.happiness})")
        assertTrue(next.energy <= 5, "energy should not be raised above its starting value (got ${next.energy})")
    }

    @Test
    fun `a same-tick damage source cannot push health back below the floor`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, sick = true, health = 21)
        val next = tick(pet, isIdle = true, isDeepIdle = false)
        assertTrue(next.health >= IDLE_STAT_FLOOR, "health should never drop below the idle floor (got ${next.health})")
    }

    // BUGFIX-177: damage is skipped while idle, so the floor must key off the
    // damage *state*, not damage taken — otherwise only sick pets were floored.
    @Test
    fun `floors happiness and energy for a starving (not sick) pet while idle and deep idle`() {
        for ((idle, deep) in listOf(true to false, true to true)) {
            var pet = makePet().copy(hunger = 0, hungerZeroTicks = 99, happiness = 30, energy = 30, health = 50, sick = false)
            repeat(3000) { pet = tick(pet, isIdle = idle, isDeepIdle = deep) }
            assertTrue(pet.alive)
            assertTrue(pet.happiness >= IDLE_STAT_FLOOR, "happiness slid below the idle floor (got ${pet.happiness}, deep=$deep)")
            assertTrue(pet.energy >= IDLE_STAT_FLOOR, "energy slid below the idle floor (got ${pet.energy}, deep=$deep)")
            assertTrue(pet.health >= 50, "health dropped while idle (got ${pet.health}, deep=$deep)")
        }
    }

    @Test
    fun `floors hunger and energy for a miserable (happiness 0) pet while idle and deep idle`() {
        for ((idle, deep) in listOf(true to false, true to true)) {
            var pet = makePet().copy(happiness = 0, hunger = 30, energy = 30, health = 50, sick = false, sleeping = false)
            repeat(3000) { pet = tick(pet, isIdle = idle, isDeepIdle = deep) }
            assertTrue(pet.alive)
            assertTrue(pet.hunger >= IDLE_STAT_FLOOR, "hunger slid below the idle floor (got ${pet.hunger}, deep=$deep)")
            assertTrue(pet.energy >= IDLE_STAT_FLOOR, "energy slid below the idle floor (got ${pet.energy}, deep=$deep)")
        }
    }

    @Test
    fun `does not log a health-loss event when the idle floor fully absorbs the damage`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, health = 5)
        val next = tick(pet, isIdle = true, isDeepIdle = false)
        assertEquals(5, next.health)
        assertFalse(next.events.contains("starvation_damage"), "events should not include starvation_damage (got ${next.events})")
    }

    @Test
    fun `does not lose health while idle even when well above IDLE_STAT_FLOOR (BUG-S02)`() {
        val pet  = makePet().copy(hunger = 0, hungerZeroTicks = 99, health = 25)
        val next = tick(pet, isIdle = true, isDeepIdle = false)
        assertEquals(25, next.health)
        assertFalse(next.events.contains("starvation_damage"), "events should not include starvation_damage (got ${next.events})")
    }

    // ── No health loss while idle (BUG-S02) ──────────────────────────────────

    private val damageEvents = listOf("starvation_damage", "unhappiness_damage", "exhaustion_damage", "sickness_damage")

    private fun assertNoIdleHealthLoss(start: PetState) {
        for ((idle, deep) in listOf(true to false, false to true)) {
            var pet = start.copy(health = 80, nextPoopIntervalTicks = 99999)
            repeat(200) { i ->
                pet = tick(pet, isIdle = idle, isDeepIdle = deep)
                damageEvents.forEach { e -> assertFalse(pet.events.contains(e), "unexpected $e on tick $i (idle=$idle deep=$deep)") }
            }
            assertTrue(pet.health >= 80, "health dropped to ${pet.health} (idle=$idle deep=$deep)")
            assertTrue(pet.alive)
        }
    }

    @Test fun `starving pet keeps its health while idle`()  = assertNoIdleHealthLoss(makePet().copy(hunger = 0, hungerZeroTicks = 99))
    @Test fun `unhappy pet keeps its health while idle`()   = assertNoIdleHealthLoss(makePet(happiness = 0))
    @Test fun `exhausted pet keeps its health while idle`() = assertNoIdleHealthLoss(makePet(energy = 0))
    @Test fun `sick pet keeps its health while idle`()      = assertNoIdleHealthLoss(makePet().copy(sick = true))
    @Test fun `pet with every damage source keeps its health while idle`() =
        assertNoIdleHealthLoss(makePet(happiness = 0, energy = 0).copy(hunger = 0, hungerZeroTicks = 99, sick = true))

    @Test
    fun `sick pet stays sick while idle`() {
        val next = tick(makePet().copy(sick = true, health = 50), isIdle = true, isDeepIdle = false)
        assertTrue(next.sick)
        assertEquals(50, next.health)
    }

    @Test
    fun `a very old senior crossing a day boundary while idle never rolls old-age death`() {
        // ticksAlive 59 → 60 is divisible by AGING_TICK_INTERVAL (3) and IDLE_DECAY_TICK_DIVISOR (20),
        // so aging advances even in regular idle. The Kotlin roll uses Math.random() internally,
        // so repeat enough times that an un-gated roll would almost certainly kill the pet.
        val age = SENIOR_NATURAL_DEATH_AGE_DAYS * 3
        val pet = makePet().copy(stage = "senior", ticksAlive = 59, ageDays = age, dayTimer = age + 0.99999)
        repeat(200) {
            val next = tick(pet, isIdle = true, isDeepIdle = false, config = NO_CALLS)
            assertEquals(age + 1, next.ageDays, "precondition: day boundary crossed")
            assertTrue(next.alive)
            assertFalse(next.sick)
        }
    }

    // ── Poop sickness grace period and poop attention call ───────────────────

    private val NO_CALLS = DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false)

    @Test
    fun `becomes sick only after POOP_SICK_GRACE_TICKS active ticks at the poop limit`() {
        var pet = makePet().copy(poops = MAX_UNCLEANED_POOPS_BEFORE_SICK, nextPoopIntervalTicks = 99999)
        repeat(POOP_SICK_GRACE_TICKS - 1) { i ->
            pet = tick(pet, config = NO_CALLS)
            assertFalse(pet.sick, "should not be sick after ${i + 1} ticks")
        }
        pet = tick(pet, config = NO_CALLS)
        assertTrue(pet.sick)
        assertTrue(pet.events.contains("became_sick"))
    }

    @Test
    fun `never becomes sick one poop below the limit`() {
        var pet = makePet().copy(poops = MAX_UNCLEANED_POOPS_BEFORE_SICK - 1, nextPoopIntervalTicks = 99999)
        repeat(100) { pet = tick(pet, config = NO_CALLS) }
        assertFalse(pet.sick)
        assertEquals(0, pet.poopOverLimitTicks)
    }

    @Test
    fun `clean resets the grace counter and prevents sickness`() {
        var pet = makePet().copy(poops = MAX_UNCLEANED_POOPS_BEFORE_SICK, nextPoopIntervalTicks = 99999)
        repeat(15) { pet = tick(pet, config = NO_CALLS) }
        pet = clean(pet)
        assertEquals(0, pet.poopOverLimitTicks)
        repeat(30) { pet = tick(pet, config = NO_CALLS) }
        assertFalse(pet.sick)
    }

    @Test
    fun `idle ticks freeze the grace counter`() {
        var pet = makePet().copy(poops = MAX_UNCLEANED_POOPS_BEFORE_SICK, poopOverLimitTicks = 10, nextPoopIntervalTicks = 99999)
        repeat(50) { pet = tick(pet, isIdle = true, isDeepIdle = false, config = NO_CALLS) }
        repeat(50) { pet = tick(pet, isIdle = false, isDeepIdle = true, config = NO_CALLS) }
        assertEquals(10, pet.poopOverLimitTicks)
        assertFalse(pet.sick)
    }

    @Test
    fun `an expired poop call below the poop limit is a care mistake, not sickness`() {
        val pet  = makePet().copy(poops = 2, activeAttentionCall = "poop", attentionCallActiveTicks = 999,
                                  careMistakes = 0.0, nextPoopIntervalTicks = 99999)
        val next = tick(pet)
        assertTrue(next.events.contains("attention_call_expired_poop"))
        assertFalse(next.sick)
        assertEquals(1.0, next.careMistakes)
    }

    @Test
    fun `an expired poop call at the poop limit makes the pet sick`() {
        val pet  = makePet().copy(poops = MAX_UNCLEANED_POOPS_BEFORE_SICK, activeAttentionCall = "poop",
                                  attentionCallActiveTicks = 999, nextPoopIntervalTicks = 99999)
        val next = tick(pet)
        assertTrue(next.events.contains("attention_call_expired_poop"))
        assertTrue(next.sick)
    }

    @Test
    fun `no poop call fires while idle`() {
        val pet = makePet().copy(poops = 3, ticksWithUncleanedPoop = 5000, nextPoopIntervalTicks = 99999)
        repeat(200) {
            assertFalse(tick(pet, isIdle = true, isDeepIdle = false).events.contains("attention_call_poop"))
            assertFalse(tick(pet, isIdle = false, isDeepIdle = true).events.contains("attention_call_poop"))
        }
    }

    // ── Whim attention calls: play, pat, craving (§2.6) ──────────────────────

    /** A tiny rate divisor pushes every random-call chance above 1, so random calls always fire. */
    private val ALWAYS_CALLS = DEFAULT_GAME_CONFIG.copy(attentionCallRateDivisor = 1e-6)

    /** A content pet that no need-based call would fire for, with the given calls on cooldown. */
    private fun contentPet(vararg blocked: String): PetState {
        val cooldowns = (listOf("misbehaviour") + blocked).associateWith { 999 }
        return makePet(energy = 80, happiness = 80).copy(
            hunger = 70, health = 100, nextPoopIntervalTicks = 99999, attentionCallCooldowns = cooldowns,
        )
    }

    @Test
    fun `cooldowns are 5 minutes after an answer and after an expiry (BUG-S06)`() {
        assertEquals(100, ATTENTION_ANSWER_COOLDOWN_TICKS)
        assertEquals(100, ATTENTION_EXPIRY_COOLDOWN_TICKS)
    }

    @Test
    fun `a craving fires at any hunger level and records the food`() {
        val next = tick(contentPet().copy(hunger = 95), config = ALWAYS_CALLS)
        assertEquals("craving", next.activeAttentionCall)
        assertEquals("snack", next.cravingFood, "nearly full: asks for a snack, not a pointless meal")
        assertTrue(next.events.contains("attention_call_craving_snack"))
        assertEquals(0, next.ticksSinceLastCraving)
    }

    @Test
    fun `idle ticks don't advance the call-chance counters`() {
        val pet = contentPet().copy(
            poops = 1, ticksWithUncleanedPoop = 5, ticksSinceLastMisbehaviour = 5, ticksSinceLastGift = 5,
            ticksSinceLastPlayCall = 5, ticksSinceLastPatCall = 5, ticksSinceLastCraving = 5,
        )
        val quiet = DEFAULT_GAME_CONFIG.copy(attentionCallRateDivisor = 1e9)
        for ((idle, deep) in listOf(true to false, false to true)) {
            val next = tick(pet, isIdle = idle, isDeepIdle = deep, config = quiet)
            assertEquals(5, next.ticksWithUncleanedPoop, "idle=$idle deep=$deep")
            assertEquals(5, next.ticksSinceLastMisbehaviour)
            assertEquals(5, next.ticksSinceLastGift)
            assertEquals(5, next.ticksSinceLastPlayCall)
            assertEquals(5, next.ticksSinceLastPatCall)
            assertEquals(5, next.ticksSinceLastCraving)
        }
        val active = tick(pet, config = quiet)
        assertEquals(6, active.ticksSinceLastCraving, "control: counts on active ticks")
        assertEquals(6, active.ticksWithUncleanedPoop)
    }

    @Test
    fun `misbehaviour and gift calls don't fire while idle`() {
        val pet = makePet(energy = 80, happiness = 80).copy(
            hunger = 70, health = 100, nextPoopIntervalTicks = 99999,
            attentionCallCooldowns = mapOf("craving" to 999, "play" to 999, "pat" to 999),
        )
        for ((idle, deep) in listOf(true to false, false to true)) {
            val next = tick(pet, isIdle = idle, isDeepIdle = deep, config = ALWAYS_CALLS)
            assertNull(next.activeAttentionCall, "idle=$idle deep=$deep fired ${next.activeAttentionCall}")
        }
        assertEquals("misbehaviour", tick(pet, config = ALWAYS_CALLS).activeAttentionCall, "control: fires when active")
        val noMisbehaviour = pet.copy(attentionCallCooldowns = pet.attentionCallCooldowns + ("misbehaviour" to 999))
        assertEquals("gift", tick(noMisbehaviour, config = ALWAYS_CALLS).activeAttentionCall, "control: gift fires when active")
    }

    @Test
    fun `expiry settings map to 4, 10 and 20 minutes of ticks`() {
        val source = javaClass.getResourceAsStream("/source/CodotchiPlugin.kt")!!.bufferedReader().readText()
        assertTrue(source.contains("""mapOf("needy" to 80, "standard" to 200, "chilled" to 400)"""))
        assertEquals(200, DEFAULT_GAME_CONFIG.attentionCallExpiryTicks)
        assertEquals(3, TICK_INTERVAL_SECONDS)
    }

    @Test
    fun `rate settings map to divisors 3_0, 4_5 and 6_0`() {
        val source = javaClass.getResourceAsStream("/source/CodotchiPlugin.kt")!!.bufferedReader().readText()
        assertTrue(source.contains("""mapOf("fast" to 3.0, "medium" to 4.5, "slow" to 6.0)"""))
        assertEquals(3.0, DEFAULT_GAME_CONFIG.attentionCallRateDivisor)
    }

    @Test
    fun `a craving asks for a meal after 2+ snacks in a row or when the snack cap is used up`() {
        assertEquals("meal", tick(contentPet().copy(consecutiveSnacks = 2), config = ALWAYS_CALLS).cravingFood)
        assertEquals("meal", tick(contentPet().copy(snacksGivenThisCycle = SNACK_MAX_PER_CYCLE), config = ALWAYS_CALLS).cravingFood)
    }

    @Test
    fun `no craving when sick, full, or when only a pointless meal is left`() {
        for (pet in listOf(
            contentPet("play", "pat", "sick", "gift").copy(sick = true),
            contentPet("play", "pat", "sick", "gift").copy(hunger = 100),
            contentPet("play", "pat", "sick", "gift").copy(hunger = 95, consecutiveSnacks = 2),
        )) {
            assertNotEquals("craving", tick(pet, config = ALWAYS_CALLS).activeAttentionCall)
        }
    }

    @Test
    fun `play and pat calls fire when the earlier calls are on cooldown`() {
        assertEquals("play", tick(contentPet("craving"), config = ALWAYS_CALLS).activeAttentionCall)
        assertEquals("pat", tick(contentPet("craving", "play"), config = ALWAYS_CALLS).activeAttentionCall)
    }

    @Test
    fun `play needs energy and health, pat needs energy`() {
        assertEquals("pat", tick(contentPet("craving", "low_energy").copy(energy = 22), config = ALWAYS_CALLS).activeAttentionCall)
        assertEquals("pat", tick(contentPet("craving", "sick", "critical_health").copy(sick = true), config = ALWAYS_CALLS).activeAttentionCall)
        val drained = tick(contentPet("craving", "low_energy").copy(energy = 10), config = ALWAYS_CALLS).activeAttentionCall
        assertTrue(drained != "play" && drained != "pat")
    }

    @Test
    fun `no whim call fires while sleeping, idle or deep idle`() {
        val whims = setOf("play", "pat", "craving")
        assertFalse(tick(contentPet("gift"), isIdle = true, isDeepIdle = false, config = ALWAYS_CALLS).activeAttentionCall in whims)
        assertFalse(tick(contentPet("gift"), isIdle = false, isDeepIdle = true, config = ALWAYS_CALLS).activeAttentionCall in whims)
        assertFalse(tick(contentPet("gift").copy(sleeping = true, energy = 50), config = ALWAYS_CALLS).activeAttentionCall in whims)
    }

    @Test
    fun `need-based calls win over whims`() {
        assertEquals("hunger", tick(contentPet().copy(hunger = 10), config = ALWAYS_CALLS).activeAttentionCall)
    }

    @Test
    fun `cooldowns only count down on active ticks`() {
        val never = DEFAULT_GAME_CONFIG.copy(attentionCallRateDivisor = 1e9)
        var pet = contentPet().copy(attentionCallCooldowns = mapOf("play" to 10))
        repeat(20) { pet = tick(pet, isIdle = true, isDeepIdle = false, config = never) }
        assertEquals(10, pet.attentionCallCooldowns["play"])
        pet = tick(pet, config = never)
        assertEquals(9, pet.attentionCallCooldowns["play"])
    }

    @Test
    fun `play answers a play call and pat answers a pat call`() {
        val played = play(makePet(energy = 80).copy(activeAttentionCall = "play", careMistakes = 1.0))
        assertNull(played.activeAttentionCall)
        assertTrue(played.events.contains("attention_call_answered_play"))
        assertEquals(100, played.attentionCallCooldowns["play"])
        assertEquals(0.5, played.careMistakes)
        val patted = pat(makePet(energy = 80).copy(activeAttentionCall = "pat"))
        assertNull(patted.activeAttentionCall)
        assertTrue(patted.events.contains("attention_call_answered_pat"))
    }

    @Test
    fun `the answered event survives applyMinigameResult after play`() {
        val afterGame = applyMinigameResult(play(makePet(energy = 80).copy(activeAttentionCall = "play")), "coin_flip", "win")
        assertTrue(afterGame.events.contains("attention_call_answered_play"), afterGame.events.toString())
        assertTrue(afterGame.events.contains("minigame_coin_flip_win"))
        assertFalse(afterGame.events.contains("played"))
    }

    @Test
    fun `blackjack win, push and lose give +10, 0 and -10 with no weight change`() {
        assertEquals(10, happinessDeltaForMinigame("blackjack", "win"))
        assertEquals(0, happinessDeltaForMinigame("blackjack", "push"))
        assertEquals(-10, happinessDeltaForMinigame("blackjack", "lose"))
        val pet = makePet().copy(happiness = 50, weight = 40)
        val pushed = applyMinigameResult(pet, "blackjack", "push")
        assertEquals(50, pushed.happiness)
        assertEquals(40, pushed.weight)
        assertTrue(pushed.events.contains("minigame_blackjack_push"))
    }

    @Test
    fun `only the craved food answers a craving`() {
        val wantsMeal = makePet().copy(activeAttentionCall = "craving", cravingFood = "meal")
        assertEquals("craving", startSnack(wantsMeal).activeAttentionCall)
        val fed = feedMeal(wantsMeal, 0)
        assertNull(fed.activeAttentionCall)
        assertNull(fed.cravingFood)
        assertTrue(fed.events.contains("attention_call_answered_craving"))

        val wantsSnack = makePet().copy(activeAttentionCall = "craving", cravingFood = "snack")
        assertEquals("craving", feedMeal(wantsSnack, 0).activeAttentionCall)
        val placed = startSnack(wantsSnack)
        assertNull(placed.activeAttentionCall)
        assertNull(placed.cravingFood)
        assertTrue(placed.events.contains("attention_call_answered_craving"))
    }

    @Test
    fun `an ignored whim call costs 10 health and a care mistake, using the configurable expiry`() {
        val cfg = DEFAULT_GAME_CONFIG.copy(attentionCallExpiryTicks = 50)
        for (type in listOf("play", "pat", "craving")) {
            val pet = makePet().copy(
                activeAttentionCall = type, cravingFood = if (type == "craving") "meal" else null,
                attentionCallActiveTicks = 48, health = 100, careMistakes = 0.0, nextPoopIntervalTicks = 99999,
            )
            val stillOpen = tick(pet, config = cfg)
            assertEquals(type, stillOpen.activeAttentionCall, "$type: tick 49 of 50 — still open")
            val expired = tick(stillOpen, config = cfg)
            assertTrue(expired.events.contains("attention_call_expired_$type"))
            assertEquals(90, expired.health, type)
            assertEquals(1.0, expired.careMistakes, type)
            assertNull(expired.cravingFood)
            assertEquals(99, expired.attentionCallCooldowns[type], "$type: expiry cooldown set, then counted down once")
        }
    }

    // ── Break reminder attention call ────────────────────────────────────────

    /** Every random call on cooldown, so only the break call can fire. */
    private fun breakPet(ticks: Int) =
        contentPet("craving", "play", "pat", "gift", "poop").copy(ticksSinceLastBreakCall = ticks)

    @Test
    fun `break call fires after 30 active awake minutes and restarts its timer`() {
        assertEquals(30 * 60, BREAK_CALL_INTERVAL_TICKS * 3)
        val almost = tick(breakPet(BREAK_CALL_INTERVAL_TICKS - 2))
        assertNull(almost.activeAttentionCall)
        val due = tick(almost)
        assertEquals("break", due.activeAttentionCall)
        assertTrue("attention_call_break" in due.events)
        assertEquals(0, due.ticksSinceLastBreakCall)
    }

    @Test
    fun `break timer only counts active awake time and deep idle restarts it`() {
        assertEquals(100, tick(breakPet(100), isIdle = true).ticksSinceLastBreakCall)
        assertEquals(100, tick(breakPet(100).copy(sleeping = true)).ticksSinceLastBreakCall)
        assertEquals(0, tick(breakPet(100), isDeepIdle = true).ticksSinceLastBreakCall)
    }

    @Test
    fun `break call does not fire asleep or idle and a real need wins`() {
        val due = breakPet(BREAK_CALL_INTERVAL_TICKS)
        assertNotEquals("break", tick(due.copy(sleeping = true, energy = 50)).activeAttentionCall)
        assertNotEquals("break", tick(due, isIdle = true).activeAttentionCall)
        assertEquals("hunger", tick(due.copy(hunger = 10)).activeAttentionCall)
    }

    @Test
    fun `praise answers a break call with the gift happiness boost and puts the pet to sleep`() {
        val calling = makePet(happiness = 50).copy(activeAttentionCall = "break", consecutiveSnacks = 2)
        val next = praise(calling)
        assertNull(next.activeAttentionCall)
        assertEquals(50 + GIFT_PRAISE_HAPPINESS_BOOST, next.happiness)
        assertTrue(next.sleeping)
        assertEquals(0, next.consecutiveSnacks)
        assertTrue("attention_call_answered_break" in next.events)
        assertTrue("fell_asleep" in next.events)
        assertFalse(praise(makePet()).sleeping, "praise without a break call keeps the pet awake")
    }

    @Test
    fun `a skipped break call is no care mistake`() {
        val pet = breakPet(0).copy(activeAttentionCall = "break", attentionCallActiveTicks = 10_000, careMistakes = 0.0)
        val next = tick(pet)
        assertTrue("attention_call_expired_break" in next.events)
        assertEquals(0.0, next.careMistakes)
        assertEquals(100, next.health)
    }

    // ── break nap ────────────────────────────────────────────────────────────

    private fun napping(): PetState = praise(
        makePet(energy = 20, happiness = 30, weight = 25).copy(
            activeAttentionCall = "break", sleeping = false, hunger = 40, health = 70,
            poops = 2, nextPoopIntervalTicks = 1,
        )
    )

    @Test
    fun `praising a break call starts a 5-minute nap`() {
        assertEquals(5 * 60, BREAK_NAP_TICKS * TICK_INTERVAL_SECONDS)
        val pet = napping()
        assertTrue(pet.sleeping)
        assertEquals(BREAK_NAP_TICKS, pet.breakNapTicksRemaining)
        assertTrue("break_nap_started" in pet.events)
        val alreadyAsleep = praise(makePet().copy(activeAttentionCall = "break", sleeping = true))
        assertEquals(BREAK_NAP_TICKS, alreadyAsleep.breakNapTicksRemaining)
    }

    @Test
    fun `break nap freezes stats except energy but keeps aging through idle and wakes on its own`() {
        val start = napping()
        var pet = start
        for (i in 0 until BREAK_NAP_TICKS - 1) {
            pet = tick(pet, isIdle = i > 20, isDeepIdle = i > 40)
            assertTrue(pet.sleeping, "still asleep at tick ${i + 1}")
        }
        assertEquals(start.hunger, pet.hunger)
        assertEquals(start.happiness, pet.happiness)
        assertEquals(100, pet.energy, "energy regenerates while napping")
        assertEquals(start.health, pet.health)
        assertEquals(start.weight, pet.weight)
        assertEquals(start.poops, pet.poops)
        assertEquals(start.ticksSinceLastPoop, pet.ticksSinceLastPoop)
        assertEquals(start.careMistakes, pet.careMistakes)
        assertTrue(pet.dayTimer > start.dayTimer, "keeps aging")
        assertEquals(1, pet.breakNapTicksRemaining)
        val awake = tick(pet, isIdle = true, isDeepIdle = true)
        assertFalse(awake.sleeping)
        assertEquals(0, awake.breakNapTicksRemaining)
        assertTrue("break_nap_over" in awake.events)
    }

    @Test
    fun `break nap ages at the sleeping rate even while deep idle and never auto-wakes`() {
        val start = napping()
        var deepIdle = start
        var active = start
        repeat(30) { deepIdle = tick(deepIdle, isIdle = true, isDeepIdle = true); active = tick(active) }
        assertEquals(active.dayTimer, deepIdle.dayTimer, 1e-10)
        assertTrue(deepIdle.dayTimer > start.dayTimer)
        val full = tick(start.copy(energy = 100))
        assertTrue(full.sleeping)
        assertEquals(100, full.energy)
    }

    @Test
    fun `break nap regenerates energy and never loses health`() {
        val start = napping()
        assertTrue(tick(start).energy > start.energy)
        var pet = start.copy(hunger = 0, happiness = 0, sick = true, health = 50)
        repeat(BREAK_NAP_TICKS - 1) { pet = tick(pet) }
        assertEquals(50, pet.health)
        assertTrue(pet.alive)
    }

    @Test
    fun `a break nap can't be woken manually`() {
        val pet = wake(napping())
        assertTrue(pet.sleeping)
        assertEquals(BREAK_NAP_TICKS, pet.breakNapTicksRemaining)
        assertEquals(listOf("break_nap_no_wake"), pet.events)
        assertEquals(BREAK_NAP_TICKS - 1, tick(pet).breakNapTicksRemaining)
        val after = wake(makePet().copy(sleeping = true, breakNapTicksRemaining = 0))
        assertFalse(after.sleeping)
        assertTrue("woke_up" in after.events)
    }

    // ── Sickness blocks Feed / Snack / Play (BUG-S04) ───────────────────────

    @Test
    fun `feed, snack and play are refused while sick`() {
        val sick = makePet(energy = 0).copy(sick = true, hunger = 30, activeAttentionCall = "hunger")
        val meal = feedMeal(sick, 0)
        assertEquals(30, meal.hunger)
        assertEquals(listOf("meal_refused_sick"), meal.events)
        assertEquals("hunger", meal.activeAttentionCall)
        val snack = startSnack(sick)
        assertEquals(listOf("snack_refused_sick"), snack.events)
        assertEquals(0, snack.snacksOnFloor)
        val played = play(sick)
        assertEquals(listOf("play_refused_sick"), played.events)
        assertEquals(sick.happiness, played.happiness)
    }

    @Test
    fun `offline time during a break nap does not decay stats and wakes the pet when it ran out`() {
        val start = makePet(happiness = 80).copy(sleeping = true, breakNapTicksRemaining = 40, hunger = 80)
        val short = applyOfflineDecay(start, 30 * 3)
        assertEquals(80, short.hunger)
        assertEquals(80, short.happiness)
        assertTrue(short.sleeping)
        assertEquals(10, short.breakNapTicksRemaining)
        val long = applyOfflineDecay(start, 50 * 3)
        assertFalse(long.sleeping)
        assertEquals(0, long.breakNapTicksRemaining)
        assertTrue(long.hunger < 80)
        val noNap = applyOfflineDecay(start.copy(breakNapTicksRemaining = 0), 50 * 3)
        assertTrue(long.hunger > noNap.hunger, "the nap portion was not counted")
    }

    @Test
    fun `a meal fills 15 hunger`() {
        assertEquals(45, feedMeal(makePet().copy(hunger = 30), 0).hunger)
        assertEquals(4, feedMeal(makePet().copy(hunger = 30), 0, feedHungerMult = 0.25).hunger - 30,
            "rounds like the TS engine")
    }

    // ── Leaderboard integrity: sticky devModeEverUsed ───────────────────────

    @Test
    fun `new pet has not used dev mode and is leaderboard eligible`() {
        val pet = makePet()
        assertFalse(pet.devModeEverUsed)
        assertEquals("", pet.leaderboardIneligible)
    }

    @Test
    fun `tick in dev mode sets devModeEverUsed and it stays set after dev mode is off`() {
        val devTicked = tick(makePet(), config = GameConfig(devMode = true))
        assertTrue(devTicked.devModeEverUsed)
        var s = devTicked
        repeat(5) { s = tick(s, config = GameConfig(devMode = false)) }
        assertTrue(s.devModeEverUsed, "devModeEverUsed must be sticky")
    }

    @Test
    fun `tick without dev mode leaves devModeEverUsed false`() {
        var s = makePet()
        repeat(5) { s = tick(s) }
        assertFalse(s.devModeEverUsed)
    }

    @Test
    fun `paused pet ticked in dev mode is not marked`() {
        val s = tick(makePet(paused = true), config = GameConfig(devMode = true))
        assertFalse(s.devModeEverUsed)
    }

    @Test
    fun `dev mode tick during a break nap still marks the pet`() {
        val s = tick(makePet().copy(breakNapTicksRemaining = 3), config = GameConfig(devMode = true))
        assertTrue(s.devModeEverUsed)
    }
}
