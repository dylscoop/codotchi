package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Mirrors vscode/tests/unit/deathless.test.ts. */
class DeathlessTest {

    private val key = "test-key"
    private val noCalls = DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false)
    private val deathless = noCalls.copy(deathless = true)

    private fun pet() = createPet("Pixel", "codeling", "neon")

    /** A pet one damage tick away from death. */
    private fun dyingPet() = pet().copy(
        stage = "adult", hunger = 100, happiness = 0, energy = 0, health = 1, sick = true, hungerZeroTicks = 1000,
    )

    private fun dead(name: String = "Pixel", spawnedAt: Long = 1000L, log: List<String> = listOf("died")) =
        pet().copy(name = name, alive = false, spawnedAt = spawnedAt, diedAt = 5000L, ageDays = 12, recentEventLog = log)

    // ── Engine ────────────────────────────────────────────────────────────

    @Test
    fun `a normal pet still dies from neglect`() {
        var s = dyingPet()
        repeat(50) { if (s.alive) s = tick(s, false, false, noCalls) }
        assertFalse(s.alive)
    }

    @Test
    fun `floors health at 1 so neglect can't kill the pet`() {
        var s = dyingPet()
        repeat(500) { s = tick(s, false, false, deathless) }
        assertTrue(s.alive)
        assertTrue(s.health >= 1)
    }

    @Test
    fun `the pet can still get sick`() {
        var s = dyingPet()
        repeat(20) { s = tick(s, false, false, deathless) }
        assertTrue(s.sick)
    }

    @Test
    fun `old-age death still applies to a deathless pet`() {
        val senior = markDeathless(pet().copy(stage = "senior", ageDays = 400))
        var next = senior
        for (i in 0 until 1_000_000) { next = rollOldAgeDeath(senior); if (!next.alive) break }
        assertFalse(next.alive)
        assertTrue("died_of_old_age" in next.events)
    }

    @Test
    fun `any tick in deathless mode marks the pet for life`() {
        var s = tick(pet(), false, false, deathless)
        assertTrue(isDeathlessPet(s))
        s = tick(s, false, false, noCalls)
        assertTrue(isDeathlessPet(s))
    }

    @Test
    fun `markDeathless keeps a tampered mark`() {
        val tampered = pet().copy(leaderboardIneligible = "tampered")
        assertSame(tampered, markDeathless(tampered))
    }

    // ── Leaderboard ───────────────────────────────────────────────────────

    @Test
    fun `blocks a deathless pet`() {
        val reason = Integrity.leaderboardBlockedReason(markDeathless(pet()), false, key)
        assertTrue(reason!!.contains("deathless"))
    }

    @Test
    fun `the seal still verifies for a deathless pet`() {
        val s = markDeathless(pet())
        assertEquals("deathless", Integrity.verifySeal(s, Integrity.sealState(s, key), key).leaderboardIneligible)
    }

    @Test
    fun `a missing seal doesn't clear the deathless mark`() {
        assertEquals("deathless", Integrity.verifySeal(markDeathless(pet()), null, key).leaderboardIneligible)
    }

    // ── Afterlife ─────────────────────────────────────────────────────────

    @Test
    fun `a living pet isn't pending, a dead one is`() {
        assertFalse(Afterlife.pending(Afterlife.Data(), pet().copy(spawnedAt = 1000L)))
        assertTrue(Afterlife.pending(Afterlife.Data(), dead()))
    }

    @Test
    fun `bury adds an entry, newest first`() {
        val a1 = Afterlife.decide(Afterlife.Data(), dead("One"), "bury")
        val a2 = Afterlife.decide(a1, dead("Two", spawnedAt = 2000L), "bury")
        assertEquals(listOf("Two", "One"), a2.buried.map { it.name })
        assertEquals(0, a2.cremated)
        assertEquals("neglect", a2.buried[0].cause)
        assertFalse(Afterlife.pending(a2, dead(spawnedAt = 2000L)))
    }

    @Test
    fun `records old-age deaths and the deathless marker`() {
        val a = Afterlife.decide(Afterlife.Data(), markDeathless(dead(log = listOf("died_of_old_age"))), "bury")
        assertEquals("old_age", a.buried[0].cause)
        assertTrue(a.buried[0].deathless)
    }

    @Test
    fun `cremate only bumps the urn count`() {
        val a = Afterlife.decide(Afterlife.Data(), dead(), "cremate")
        assertTrue(a.buried.isEmpty())
        assertEquals(1, a.cremated)
    }

    @Test
    fun `a second choice for the same pet is ignored`() {
        val a = Afterlife.decide(Afterlife.Data(), dead(), "bury")
        assertSame(a, Afterlife.decide(a, dead(), "cremate"))
    }

    @Test
    fun `an undecided pet is cremated when a new pet hatches`() {
        val a = Afterlife.settleBeforeNewPet(Afterlife.Data(), dead())
        assertEquals(1, a.cremated)
        assertTrue(a.buried.isEmpty())
        assertSame(a, Afterlife.settleBeforeNewPet(a, dead()))
        assertSame(a, Afterlife.settleBeforeNewPet(a, null))
    }

    @Test
    fun `parse tolerates missing or corrupt data and round-trips`() {
        assertEquals(Afterlife.Data(), Afterlife.parse(null))
        assertEquals(Afterlife.Data(), Afterlife.parse("not json"))
        assertEquals(Afterlife.Data(), Afterlife.parse("""{"buried":"x","cremated":-3}"""))
        val ok = Afterlife.decide(Afterlife.Data(), dead(), "bury")
        assertEquals(ok, Afterlife.parse(Afterlife.toJson(ok)))
    }

    @Test
    fun `uses the user's afterlife name, falling back to Afterlife`() {
        assertEquals("Pet Heaven", Afterlife.displayName("  Pet Heaven "))
        assertEquals("Afterlife", Afterlife.displayName("   "))
        assertEquals("Afterlife", Afterlife.displayName(null))
        assertEquals(32, Afterlife.displayName("x".repeat(50)).length)
    }
}
