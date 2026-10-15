package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/** Mirrors vscode/tests/unit/progression.test.ts. */
class ProgressionTest {

    // Today, so the pinned (empty) dailies in pet() don't roll and pay out.
    private fun at(hour: Int): Long =
        LocalDate.now().atTime(hour, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    private fun oct(day: Int, hour: Int = 12): Long =
        LocalDateTime.of(2026, 10, day, hour, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

    private val noon = at(12)
    private val oneAm = at(1)

    /** A pet with no daily challenges today, so XP amounts are exact. */
    private fun pet(): PetState = createPet("Pixel", "codeling", "neon").copy(dailies = DailyChallenges(day = localDayKey(noon)))

    private fun petWithPicks(now: Long, streak: Int = 0, streakDay: String = ""): PetState =
        createPet("Pixel", "codeling", "neon").copy(
            dailies = DailyChallenges(localDayKey(now), listOf("commit_1", "calls_3", "win_1"), emptyMap(), emptyList(), streak, streakDay),
        )

    private fun finishAll(start: PetState, now: Long): PetState {
        var s = awardXp(start, "commit", now)
        repeat(3) { s = awardXp(s, "call", now) }
        return awardXp(s, "minigame", now)
    }

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
        assertEquals(mapOf("code" to 10, "commit" to 30, "minigame" to 20, "boss_battle" to 40), XP_HOURLY_CAPS)
        assertEquals(mapOf("code" to 40, "commit" to 90, "call" to 100, "minigame" to 50, "boss_battle" to 80), XP_DAILY_CAPS)
    }

    @Test
    fun `a Boss Battle win counts as a mini-game win and unlocks Champion`() {
        val won = applyMinigameResult(pet(), "boss_battle", "win")
        assertEquals(1, won.trainer.counters["bossBattleWins"])
        assertEquals(1, won.trainer.counters["minigameWins"])
        assertTrue("champion" in won.trainer.achievements)
        val lost = applyMinigameResult(pet(), "boss_battle", "lose")
        assertEquals(0, lost.petXp)
        assertNull(lost.trainer.counters["bossBattleWins"])
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
        assertEquals(listOf("detective", "first_blood", "exterminator"), ACHIEVEMENTS.filter { it.comingSoon }.map { it.id })
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
    fun `trainer drops retired ids and old-rules daily buckets`() {
        val old = trainerFromRaw(mapOf("achievements" to listOf("hello_world", "caretaker"), "xpToday" to mapOf("code" to 200.0)))
        assertEquals(listOf("hello_world"), old.achievements)
        assertEquals(emptyMap<String, Int>(), old.xpToday)
        val cur = trainerFromRaw(mapOf("xpToday" to mapOf("code" to 200.0, "care" to 100.0, "commit" to 15.0), "xpHour" to "2026-10-14T12", "xpThisHour" to mapOf("code" to 4.0)))
        assertEquals(mapOf("commit" to 15), cur.xpToday)
        assertEquals(mapOf("code" to 4), cur.xpThisHour)
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

    @Test
    fun `daily picks match TypeScript`() {
        assertEquals(listOf("code_10", "care_10", "snack_and_commit"), pickDailyChallenges("2026-10-14", "Pixel", 1760000000000L))
        val picks = pickDailyChallenges("2026-10-14", "Pixel", 123L)
        assertEquals(listOf("coder", "keeper", "wild"), picks.map { dailyChallengeById(it)!!.path })
    }

    @Test
    fun `daily challenges pay once and reset at midnight`() {
        val s = finishAll(petWithPicks(noon), noon)
        assertEquals(setOf("commit_1", "calls_3", "win_1"), s.dailies.done.toSet())
        assertTrue("daily_challenges_all_done" in s.recentEventLog)
        val plain = finishAll(pet(), noon)
        assertEquals(3 * DAILY_CHALLENGE_XP + DAILY_ALL_DONE_BONUS, s.petXp - plain.petXp)
        assertEquals(plain.petXp, finishAll(s, noon).petXp - s.petXp)
        val tomorrow = awardXp(s, "code", noon + 24L * 3600 * 1000)
        assertTrue(tomorrow.dailies.done.size < 3)
    }

    @Test
    fun `dailies roll on first award and show before it`() {
        val fresh = createPet("Pixel", "codeling", "neon").copy(trainer = TrainerProgress(counters = mapOf("commits" to 50)))
        val s = awardXp(fresh, "code", noon)
        assertEquals(localDayKey(noon), s.dailies.day)
        assertEquals(50, s.dailies.baseline["commits"])
        val v = dailiesView(createPet("Pixel", "codeling", "neon"), noon)
        assertEquals(3, v.challenges.size)
        assertTrue(v.challenges.all { it.value == 0 && !it.done })
    }

    @Test
    fun `streak skips weekends and is lost with the pet`() {
        assertTrue(isWeekendDay("2026-10-17"))
        assertEquals("2026-10-16", previousWeekday("2026-10-19"))
        assertEquals(2, finishAll(petWithPicks(oct(13), 1, "2026-10-12"), oct(13)).dailies.streak)
        assertEquals(1, finishAll(petWithPicks(oct(15), 4, "2026-10-13"), oct(15)).dailies.streak)
        assertEquals(6, finishAll(petWithPicks(oct(19), 5, "2026-10-16"), oct(19)).dailies.streak)
        assertEquals(5, currentStreak(DailyChallenges(streak = 5, streakDay = "2026-10-16"), oct(18)))
        assertEquals(0, currentStreak(DailyChallenges(streak = 4, streakDay = "2026-10-13"), oct(15)))
        val sat = finishAll(petWithPicks(oct(17), 5, "2026-10-16"), oct(17))
        assertEquals(5, sat.dailies.streak)
        assertEquals("2026-10-16", sat.dailies.streakDay)
        assertEquals(0, createPet("Egg", "codeling", "neon", null, sat.trainer).dailies.streak)
    }

    @Test
    fun `daily challenge messages match TypeScript`() {
        val s = finishAll(petWithPicks(oct(13), 1, "2026-10-12"), oct(13))
        assertEquals("Daily challenge done: Make a commit (+25 XP)", progressionMessage("daily_challenge_done_commit_1", s))
        assertEquals("All of today's challenges done! +25 bonus XP. Streak: 2 days.", progressionMessage("daily_challenges_all_done", s))
    }

    @Test
    fun `dailies round-trip through persistence`() {
        val p = CodotchiPersistence()
        val s = finishAll(petWithPicks(noon), noon)
        p.savePetState(s)
        assertEquals(s.dailies, p.loadPetState()!!.dailies)
        assertEquals(DailyChallenges(), dailiesFromRaw(null))
    }
}
