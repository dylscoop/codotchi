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
        assertEquals(50, xpToNextLevel(1))
        assertEquals(141, xpToNextLevel(2))
        assertEquals(400, xpToNextLevel(4))
        assertEquals(LevelProgress(1, 49, 50), levelProgress(49))
        assertEquals(LevelProgress(2, 0, 141), levelProgress(50))
        assertEquals(3, levelProgress(50 + 141 + 1).level)
    }

    @Test
    fun `XP amounts and caps match TypeScript`() {
        assertEquals(10, XP_AMOUNTS["call"])
        assertEquals(10, XP_AMOUNTS["minigame"])
        assertEquals(2, XP_AMOUNTS["code"])
        assertEquals(15, XP_AMOUNTS["commit"])
        listOf("care", "snack", "clean", "cure").forEach { assertEquals(0, XP_AMOUNTS[it]) }
        assertEquals(mapOf("code" to 10, "commit" to 30, "minigame" to 20), XP_HOURLY_CAPS)
        assertEquals(mapOf("code" to 40, "commit" to 90, "call" to 100, "minigame" to 50), XP_DAILY_CAPS)
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
        val s = awardXp(pet().copy(petXp = 49), "call", noon)
        assertEquals(2, s.petLevel)
        assertTrue("pet_level_up" in s.events)
        val t = awardXp(pet().copy(trainer = TrainerProgress(xp = 49)), "call", noon)
        assertEquals(2, t.trainer.level)
        assertTrue("trainer_level_up" in t.events)
    }

    @Test
    fun `code XP is capped per hour and per day but still counted`() {
        var s = pet()
        repeat(20) { s = awardXp(s, "code", noon) }
        assertEquals(XP_HOURLY_CAPS["code"], s.trainer.xpThisHour["code"])
        assertEquals(XP_HOURLY_CAPS["code"], s.petXp)
        assertEquals(20, s.trainer.counters["codeActivity"])
        for (h in 6 until 16) repeat(10) { s = awardXp(s, "code", at(h)) }
        assertEquals(XP_DAILY_CAPS["code"], s.trainer.xpToday["code"])
        assertEquals(XP_DAILY_CAPS["code"], s.petXp)
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
        assertEquals(XP_AMOUNTS["call"], praise(pet().copy(activeAttentionCall = "gift")).petXp)
        assertEquals(XP_AMOUNTS["call"], praise(pet().copy(activeAttentionCall = "break")).petXp)
    }

    @Test
    fun `care actions earn XP only when they answer a call`() {
        assertEquals(0, feedMeal(pet(), 0).petXp)
        val fed = feedMeal(pet().copy(activeAttentionCall = "hunger"), 0)
        assertEquals(XP_AMOUNTS["call"], fed.petXp)
        assertEquals(1, fed.trainer.counters["callsAnswered"])
        assertEquals(1, fed.trainer.counters["care"])
        assertEquals(0, clean(pet().copy(poops = 1)).petXp)
        assertEquals(XP_AMOUNTS["call"], clean(pet().copy(poops = 1, activeAttentionCall = "poop")).petXp)
        assertEquals(0, startSnack(pet()).petXp)
        assertEquals(XP_AMOUNTS["call"], startSnack(pet().copy(activeAttentionCall = "hunger")).petXp)
        assertEquals(0, sleep(pet()).petXp)
        assertEquals(XP_AMOUNTS["call"], sleep(pet().copy(activeAttentionCall = "low_energy")).petXp)
    }

    @Test
    fun `answered calls are capped per day only`() {
        var s = pet()
        repeat(15) { s = awardXp(s, "call", noon) }
        assertEquals(XP_DAILY_CAPS["call"], s.trainer.xpToday["call"])
        assertEquals(15, s.trainer.counters["callsAnswered"])
    }

    @Test
    fun `coming-soon achievements never unlock and progress is capped`() {
        val s = awardXp(pet().copy(trainer = TrainerProgress(counters = mapOf("bossKills" to 99))), "code", noon)
        assertFalse("first_blood" in s.trainer.achievements)
        assertEquals(listOf("detective", "first_blood", "exterminator", "champion"), ACHIEVEMENTS.filter { it.comingSoon }.map { it.id })
        val onCall = achievementById("on_call")!!
        assertEquals(42 to 100, achievementProgress(onCall, TrainerProgress(counters = mapOf("callsAnswered" to 42))))
        assertEquals(100 to 100, achievementProgress(onCall, TrainerProgress(counters = mapOf("callsAnswered" to 420))))
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
    fun `progression messages match TypeScript`() {
        val s = awardXp(pet(), "commit", noon)
        assertEquals("Achievement unlocked: 📌 First Commit — Make a commit", progressionMessage("achievement_unlocked_first_commit", s))
        assertEquals("Level up! You're now trainer level ${s.trainer.level}.", progressionMessage("trainer_level_up", s))
        assertNull(progressionMessage("pet_level_up", s))
    }

    @Test
    fun `achievement ids are unique`() {
        assertEquals(ACHIEVEMENTS.size, ACHIEVEMENTS.map { it.id }.toSet().size)
    }
}
