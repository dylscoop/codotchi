package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Daily age bump: the first tick on a new local calendar day adds one day to
 * dayTimer and drops the fraction (8.5 → 9.0). Mirrors vscode/tests/unit/dailyAgeBump.test.ts.
 */
class DailyAgeBumpTest {

    private fun ms(y: Int, mo: Int, d: Int, h: Int, mi: Int = 0, s: Int = 0): Long =
        LocalDateTime.of(y, mo, d, h, mi, s).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    private val now = ms(2026, 11, 12, 8, 30)
    private val today = localDateKey(now)
    private val yesterday = localDateKey(ms(2026, 11, 11, 23))
    private val noCalls = DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false)

    private fun pet(): PetState =
        createPet("Rex", "codeling", "neon").copy(stage = "adult", dayTimer = 8.5, ageDays = 8, lastAgeBumpDate = yesterday)

    @Test
    fun `localDateKey formats YYYY-MM-DD`() {
        assertEquals("2026-01-05", localDateKey(ms(2026, 1, 5, 0, 1)))
    }

    @Test
    fun `first run of a new day adds a day and drops the fraction`() {
        val next = applyDailyAgeBump(pet(), now)
        assertEquals(9.0, next.dayTimer)
        assertEquals(9, next.ageDays)
        assertEquals(today, next.lastAgeBumpDate)
        assertTrue("aged_overnight" in next.events)
    }

    @Test
    fun `no second bump the same day`() {
        val once = applyDailyAgeBump(pet(), now).copy(events = emptyList())
        assertEquals(9.0, applyDailyAgeBump(once, now + 3_600_000).dayTimer)
    }

    @Test
    fun `only one bump however many days were missed`() {
        assertEquals(9.0, applyDailyAgeBump(pet().copy(lastAgeBumpDate = "2026-11-01"), now).dayTimer)
    }

    @Test
    fun `old save without the field records today and does not bump`() {
        val next = applyDailyAgeBump(pet().copy(lastAgeBumpDate = null), now)
        assertEquals(8.5, next.dayTimer)
        assertEquals(today, next.lastAgeBumpDate)
    }

    @Test
    fun `dead and paused pets are skipped`() {
        assertEquals(8.5, applyDailyAgeBump(pet().copy(alive = false), now).dayTimer)
        assertEquals(8.5, applyDailyAgeBump(pet().copy(paused = true), now).dayTimer)
    }

    @Test
    fun `deep-idle tick bumps once and keeps the event`() {
        val first = tick(pet(), true, true, noCalls, nowMs = now)
        assertEquals(9.0, first.dayTimer)
        assertTrue("aged_overnight" in first.events)
        val second = tick(first, true, true, noCalls, nowMs = now + 3000)
        assertEquals(9.0, second.dayTimer)
        assertFalse("aged_overnight" in second.events)
    }

    @Test
    fun `lastAgeBumpDate round-trips through persistence`() {
        val p = CodotchiPersistence()
        p.savePetState(pet())
        assertEquals(yesterday, p.loadPetState()!!.lastAgeBumpDate)
    }
}
