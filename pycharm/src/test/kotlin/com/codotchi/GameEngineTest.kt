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
    fun `consumeSnack is refused when snacksOnFloor is already 0 (duplicate or stale report)`() {
        val pet  = makePet(snacksOnFloor = 0, happiness = 40, weight = 10)
        val next = consumeSnack(pet)
        assertEquals(0, next.snacksOnFloor)
        assertEquals(40, next.happiness)
        assertEquals(10, next.weight)
        assertEquals(listOf("snack_refused"), next.events)
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
}
