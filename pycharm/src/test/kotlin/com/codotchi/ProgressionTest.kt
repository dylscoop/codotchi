package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.time.LocalDateTime
import java.time.ZoneId

/** Mirrors vscode/tests/unit/progression.test.ts. */
class ProgressionTest {

    private fun at(hour: Int): Long =
        LocalDateTime.of(2026, 10, 14, hour, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    private val noon = at(12)
    private val oneAm = at(1)

    private fun pet(): PetState = createPet("Pixel", "codeling", "neon")

    @Test
    fun `level curve matches TypeScript`() {
        assertEquals(100, xpToNextLevel(1))
        assertEquals(283, xpToNextLevel(2))
        assertEquals(800, xpToNextLevel(4))
        assertEquals(LevelProgress(1, 99, 100), levelProgress(99))
        assertEquals(LevelProgress(2, 0, 283), levelProgress(100))
        assertEquals(3, levelProgress(100 + 283 + 1).level)
    }

    @Test
    fun `commit gives XP to trainer and pet and unlocks First Commit`() {
        val s = awardXp(pet(), "commit", noon)
        assertEquals(XP_AMOUNTS["commit"], s.petXp)
        assertEquals(XP_AMOUNTS["commit"]!! + XP_ACHIEVEMENT_BONUS, s.trainer.xp)
        assertTrue("first_commit" in s.trainer.achievements)
        assertTrue("achievement_unlocked_first_commit" in s.events)
    }

    @Test
    fun `level ups emit events`() {
        val s = awardXp(pet().copy(petXp = 99), "care", noon)
        assertEquals(2, s.petLevel)
        assertTrue("pet_level_up" in s.events)
        val t = awardXp(pet().copy(trainer = TrainerProgress(xp = 99)), "care", noon)
        assertEquals(2, t.trainer.level)
        assertTrue("trainer_level_up" in t.events)
    }

    @Test
    fun `code XP is capped per day but still counted`() {
        var s = pet()
        repeat(200) { s = awardXp(s, "code", noon) }
        assertEquals(XP_DAILY_CAPS["code"], s.trainer.xpToday["code"])
        assertEquals(XP_DAILY_CAPS["code"], s.petXp)
        assertEquals(200, s.trainer.counters["codeActivity"])
        val tomorrow = noon + 24L * 3600 * 1000
        s = awardXp(s, "code", tomorrow)
        assertEquals(localDayKey(tomorrow), s.trainer.xpDay)
        assertEquals(XP_AMOUNTS["code"], s.trainer.xpToday["code"])
    }

    @Test
    fun `night owl and survivor`() {
        assertTrue("night_owl" in awardXp(pet(), "commit", oneAm).trainer.achievements)
        assertFalse("night_owl" in awardXp(pet(), "commit", noon).trainer.achievements)
        assertTrue("survivor" in awardXp(pet().copy(stage = "senior"), "evolve", noon).trainer.achievements)
    }

    @Test
    fun `actions earn XP`() {
        assertEquals(XP_AMOUNTS["code"], applyCodeActivity(pet()).petXp)
        assertEquals(XP_AMOUNTS["commit"], applyCommitActivity(pet()).petXp)
        assertEquals(XP_AMOUNTS["minigame"], applyMinigameResult(pet(), "left_right", "win").petXp)
        assertEquals(0, applyMinigameResult(pet(), "left_right", "lose").petXp)
        assertEquals(0, praise(pet()).petXp)
        assertEquals(XP_AMOUNTS["care"], praise(pet().copy(activeAttentionCall = "gift")).petXp)
    }

    @Test
    fun `trainer carries into the next pet`() {
        val s = awardXp(pet(), "commit", noon)
        val next = createPet("Egg", "codeling", "neon", null, s.trainer)
        assertEquals(0, next.petXp)
        assertEquals(1, next.petLevel)
        assertEquals(s.trainer, next.trainer)
    }

    @Test
    fun `trainer parses junk safely`() {
        val t = trainerFromRaw(mapOf("xp" to "lots", "achievements" to listOf(1.0, "gamer"), "counters" to mapOf("commits" to 3.0, "bad" to "x")))
        assertEquals(0, t.xp)
        assertEquals(listOf("gamer"), t.achievements)
        assertEquals(mapOf("commits" to 3), t.counters)
        assertEquals(TrainerProgress(), trainerFromRaw(null))
    }

    @Test
    fun `progression round-trips through persistence`() {
        val p = CodotchiPersistence()
        val s = awardXp(pet(), "commit", noon)
        p.savePetState(s)
        val loaded = p.loadPetState()!!
        assertEquals(s.petXp, loaded.petXp)
        assertEquals(s.trainer, loaded.trainer)
        assertEquals(SCHEMA_VERSION, loaded.schemaVersion)
    }

    @Test
    fun `achievement ids are unique`() {
        assertEquals(ACHIEVEMENTS.size, ACHIEVEMENTS.map { it.id }.toSet().size)
    }
}
