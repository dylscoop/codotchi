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
    ): PetState {
        val base = createPet("Pixel", "codeling", "neon")
        return base.copy(
            snacksOnFloor        = snacksOnFloor,
            snacksGivenThisCycle = snacksGivenThisCycle,
            paused               = paused,
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
    fun `consumeSnack snacksOnFloor does not go below 0`() {
        val pet  = makePet(snacksOnFloor = 0)
        val next = consumeSnack(pet)
        assertEquals(0, next.snacksOnFloor)
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
}
