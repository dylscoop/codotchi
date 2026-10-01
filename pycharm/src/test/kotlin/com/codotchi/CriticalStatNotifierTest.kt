package com.codotchi

import com.codotchi.CriticalStatNotifier.CRITICAL_STAT_NOTIFY_REPEAT_MS
import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Mirrors vscode/tests/unit/criticalStatNotifier.test.ts. */
class CriticalStatNotifierTest {

    private val t0 = 1_000_000L

    private fun pet(hunger: Int = 60, happiness: Int = 60, energy: Int = 60, health: Int = 60, discipline: Int = 60, alive: Boolean = true) =
        createPet("Pip", "codeling", "neon").copy(
            hunger = hunger, happiness = happiness, energy = energy, health = health, discipline = discipline, alive = alive,
        )

    @Test
    fun `stays quiet while every stat is 20 or more`() {
        val r = CriticalStatNotifier.evaluate(pet(hunger = 20), emptyMap(), t0)
        assertNull(r.message)
        assertTrue(r.tracker.isEmpty())
    }

    @Test
    fun `notifies as soon as a stat drops below 20`() {
        val r = CriticalStatNotifier.evaluate(pet(hunger = 12), emptyMap(), t0)
        assertEquals("Pip needs you — critical hunger 12", r.message)
        assertEquals(mapOf("hunger" to t0), r.tracker)
    }

    @Test
    fun `repeats only after 15 minutes while the stat stays critical`() {
        val low = pet(energy = 5)
        val first = CriticalStatNotifier.evaluate(low, emptyMap(), t0)
        val soon = CriticalStatNotifier.evaluate(low, first.tracker, t0 + CRITICAL_STAT_NOTIFY_REPEAT_MS - 1)
        assertNull(soon.message)
        assertEquals(mapOf("energy" to t0), soon.tracker)
        assertNotNull(CriticalStatNotifier.evaluate(low, soon.tracker, t0 + CRITICAL_STAT_NOTIFY_REPEAT_MS).message)
    }

    @Test
    fun `forgets a stat that recovers so the next drop notifies straight away`() {
        val first = CriticalStatNotifier.evaluate(pet(health = 10), emptyMap(), t0)
        val recovered = CriticalStatNotifier.evaluate(pet(), first.tracker, t0 + 1000)
        assertTrue(recovered.tracker.isEmpty())
        assertNotNull(CriticalStatNotifier.evaluate(pet(health = 10), recovered.tracker, t0 + 2000).message)
    }

    @Test
    fun `lists every critical stat in one message and restarts all their timers`() {
        val first = CriticalStatNotifier.evaluate(pet(hunger = 10), emptyMap(), t0)
        val both = CriticalStatNotifier.evaluate(pet(hunger = 10, energy = 8), first.tracker, t0 + 1000)
        assertEquals("Pip needs you — critical hunger 10, energy 8", both.message)
        assertEquals(mapOf("hunger" to t0 + 1000, "energy" to t0 + 1000), both.tracker)
    }

    @Test
    fun `ignores discipline and dead pets`() {
        assertNull(CriticalStatNotifier.evaluate(pet(discipline = 0), emptyMap(), t0).message)
        val dead = CriticalStatNotifier.evaluate(pet(health = 0, alive = false), mapOf("health" to t0), t0)
        assertNull(dead.message)
        assertTrue(dead.tracker.isEmpty())
    }
}
