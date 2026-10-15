package com.codotchi.engine

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.roundToInt

// ---------------------------------------------------------------------------
// Progression — XP, levels and achievements (mirrors packages/core gameEngine.ts)
// ---------------------------------------------------------------------------

/** Current save-format version. Bump when a migration step is added to the loader. */
const val SCHEMA_VERSION: Int = 1

/**
 * XP per source ("code", "commit", "call", "care", "snack", "clean", "cure", "minigame", "evolve", "debug", "boss_kill", "boss_battle").
 * Care actions pay nothing on their own: they only earn "call" XP when they answer an attention call.
 */
val XP_AMOUNTS: Map<String, Int> = mapOf(
    "code" to 2,
    "commit" to 15,
    "call" to 10,
    "care" to 0,
    "snack" to 0,
    "clean" to 0,
    "cure" to 0,
    "minigame" to 10,
    "evolve" to 30,
    "debug" to 10,
    "boss_kill" to 50,
    "boss_battle" to 40,
)

/** Bonus XP for unlocking an achievement. */
const val XP_ACHIEVEMENT_BONUS: Int = 50

/** Hourly XP caps per source (local clock hour). Sources not listed have no hourly cap. */
val XP_HOURLY_CAPS: Map<String, Int> = mapOf("code" to 10, "commit" to 30, "minigame" to 20, "boss_battle" to 40)

/** Daily XP caps per source (local day). Sources not listed are uncapped. */
val XP_DAILY_CAPS: Map<String, Int> = mapOf("code" to 40, "commit" to 90, "call" to 100, "minigame" to 50, "boss_battle" to 80)

/** Commits made from midnight up to this hour (local time) count as late-night commits. */
const val NIGHT_OWL_END_HOUR: Int = 5

private val XP_COUNTERS: Map<String, List<String>> = mapOf(
    "code" to listOf("codeActivity"),
    "commit" to listOf("commits"),
    "call" to listOf("callsAnswered"),
    "care" to listOf("care"),
    "snack" to listOf("care", "snacks"),
    "clean" to listOf("care", "cleans"),
    "cure" to listOf("care", "cures"),
    "minigame" to listOf("minigameWins"),
    "evolve" to listOf("evolutions"),
    "debug" to listOf("debugSessions"),
    "boss_kill" to listOf("bossKills"),
    "boss_battle" to listOf("bossBattleWins", "minigameWins"),
)

/**
 * An unlockable achievement: reached when [counter] (or the trainer level, for "level") hits [threshold].
 * [path] is "coder", "keeper" or "trainer"; [comingSoon] ones are shown greyed out and never unlock.
 */
data class Achievement(
    val id: String,
    val name: String,
    val description: String,
    val emoji: String,
    val counter: String,
    val threshold: Int,
    val path: String,
    val comingSoon: Boolean = false,
)

/** Every achievement, in display order. Keep identical to ACHIEVEMENTS in gameEngine.ts. */
val ACHIEVEMENTS: List<Achievement> = listOf(
    Achievement("hello_world",  "Hello World",   "Write some code with your pet watching", "👋", "codeActivity",   1,    "coder"),
    Achievement("save_100",     "Busy Fingers",  "Get 100 code-activity rewards",          "⌨️", "codeActivity",   100,  "coder"),
    Achievement("save_1000",    "Ctrl+S Master", "Get 1,000 code-activity rewards",        "💾", "codeActivity",   1000, "coder"),
    Achievement("first_commit", "First Commit",  "Make a commit",                          "📌", "commits",        1,    "coder"),
    Achievement("committed",    "Committed",     "Make 100 commits",                       "📚", "commits",        100,  "coder"),
    Achievement("night_owl",    "Night Owl",     "Commit between midnight and 5 am",       "🦉", "nightCommits",   1,    "coder"),
    Achievement("detective",    "Detective",     "Finish 10 debug sessions",               "🔍", "debugSessions",  10,   "coder", comingSoon = true),
    Achievement("first_blood",  "First Blood",   "Defeat a Bug Boss",                      "⚔️", "bossKills",      1,    "coder", comingSoon = true),
    Achievement("exterminator", "Exterminator",  "Defeat 10 Bug Bosses",                   "🐛", "bossKills",      10,   "coder", comingSoon = true),
    Achievement("on_call",      "On Call",       "Answer 100 calls from your pet",         "🤲", "callsAnswered",  100,  "keeper"),
    Achievement("snack_fiend",  "Snack Fiend",   "Hand out 50 snacks",                     "🍪", "snacks",         50,   "keeper"),
    Achievement("clean_freak",  "Clean Freak",   "Clean up 50 times",                      "🧹", "cleans",         50,   "keeper"),
    Achievement("nurse",        "Nurse",         "Cure your pet 10 times",                 "💊", "cures",          10,   "keeper"),
    Achievement("gamer",        "Gamer",         "Win 10 mini-games",                      "🎮", "minigameWins",   10,   "keeper"),
    Achievement("growing_up",   "Growing Up",    "See your pets evolve 3 times",           "🌱", "evolutions",     3,    "keeper"),
    Achievement("survivor",     "Survivor",      "Raise a pet to senior",                  "🧓", "seniors",        1,    "keeper"),
    Achievement("champion",     "Champion",      "Win a Boss Battle",                      "🥊", "bossBattleWins", 1,    "keeper"),
    Achievement("level_5",      "Rising Star",   "Reach trainer level 5",                  "⭐", "level",          5,    "trainer"),
    Achievement("level_10",     "Veteran",       "Reach trainer level 10",                 "🌟", "level",          10,   "trainer"),
    Achievement("level_25",     "Legend",        "Reach trainer level 25",                 "🏆", "level",          25,   "trainer"),
)

/** Progress towards [a]: current value (capped at the threshold) and the threshold. */
fun achievementProgress(a: Achievement, trainer: TrainerProgress): Pair<Int, Int> {
    val raw = if (a.counter == "level") trainer.level else trainer.counters[a.counter] ?: 0
    return minOf(raw, a.threshold) to a.threshold
}

fun achievementById(id: String): Achievement? = ACHIEVEMENTS.firstOrNull { it.id == id }

/**
 * Notification text for a progression event (achievement unlock or trainer
 * level-up), or null for any other event. Mirrors progressionMessage in gameEngine.ts.
 */
fun progressionMessage(event: String, state: PetState): String? {
    if (event == "trainer_level_up") return "Level up! You're now trainer level ${state.trainer.level}."
    if (event.startsWith("achievement_unlocked_")) {
        val a = achievementById(event.removePrefix("achievement_unlocked_")) ?: return null
        return "Achievement unlocked: ${a.emoji} ${a.name} — ${a.description}"
    }
    if (event.startsWith("daily_challenge_done_")) {
        val c = dailyChallengeById(event.removePrefix("daily_challenge_done_")) ?: return null
        return "Daily challenge done: ${c.text} (+$DAILY_CHALLENGE_XP XP)"
    }
    if (event == "daily_challenges_all_done") {
        val d = state.dailies
        val streak = if (d.streakDay == d.day && d.streak > 0) " Streak: ${d.streak} day${if (d.streak == 1) "" else "s"}." else ""
        return "All of today's challenges done! +$DAILY_ALL_DONE_BONUS bonus XP.$streak"
    }
    return null
}

/** XP needed to go from [level] to level + 1. */
fun xpToNextLevel(level: Int): Int = (50.0 * max(1, level).toDouble().pow(1.5)).roundToInt()

data class LevelProgress(val level: Int, val intoLevel: Int, val needed: Int)

/** Level reached with [xp] total XP, plus the progress into that level. */
fun levelProgress(xp: Int): LevelProgress {
    var level = 1
    var remaining = max(0, xp)
    while (remaining >= xpToNextLevel(level)) {
        remaining -= xpToNextLevel(level)
        level++
    }
    return LevelProgress(level, remaining, xpToNextLevel(level))
}

private fun localDateTime(now: Long): LocalDateTime =
    LocalDateTime.ofInstant(Instant.ofEpochMilli(now), ZoneId.systemDefault())

/** Local calendar date as YYYY-MM-DD. */
fun localDayKey(now: Long): String = localDateTime(now).toLocalDate().toString()

/** Local clock hour as YYYY-MM-DDTHH. */
fun localHourKey(now: Long): String = "${localDayKey(now)}T${localDateTime(now).hour.toString().padStart(2, '0')}"

/**
 * Award XP to both the trainer and the current pet, update the achievement
 * counters, and unlock any achievements now reached. With [answeredCall] the
 * action also answered an attention call and earns "call" XP on top.
 * See awardXp in gameEngine.ts.
 */
fun awardXp(state: PetState, source: String, now: Long = System.currentTimeMillis(), answeredCall: Boolean = false): PetState {
    val t = state.trainer
    val day = localDayKey(now)
    val hour = localHourKey(now)
    val xpToday = if (t.xpDay == day) t.xpToday.toMutableMap() else mutableMapOf()
    val xpThisHour = if (t.xpHour == hour) t.xpThisHour.toMutableMap() else mutableMapOf()
    val counters = t.counters.toMutableMap()
    fun bump(key: String) { counters[key] = (counters[key] ?: 0) + 1 }
    if (source == "commit" && localDateTime(now).hour < NIGHT_OWL_END_HOUR) bump("nightCommits")
    if (source == "evolve" && state.stage == "senior") bump("seniors")

    var amount = 0
    val sources = if (answeredCall && source != "call") listOf(source, "call") else listOf(source)
    for (src in sources) {
        XP_COUNTERS[src]?.forEach { bump(it) }
        var earned = XP_AMOUNTS[src] ?: 0
        val hourCap = XP_HOURLY_CAPS[src]
        val dayCap = XP_DAILY_CAPS[src]
        if (hourCap != null) earned = minOf(earned, max(0, hourCap - (xpThisHour[src] ?: 0)))
        if (dayCap != null) earned = minOf(earned, max(0, dayCap - (xpToday[src] ?: 0)))
        if (hourCap != null) xpThisHour[src] = (xpThisHour[src] ?: 0) + earned
        if (dayCap != null) xpToday[src] = (xpToday[src] ?: 0) + earned
        amount += earned
    }
    val daily = advanceDailies(state, t.counters, counters, day)
    amount += daily.xp

    val events = daily.events.toMutableList()
    var xp = t.xp + amount
    var level = levelProgress(xp).level
    val achievements = t.achievements.toMutableList()
    // Unlock bonuses can raise the level, which can unlock a level achievement.
    while (true) {
        val fresh = ACHIEVEMENTS.filter {
            !it.comingSoon && it.id !in achievements &&
                (if (it.counter == "level") level else counters[it.counter] ?: 0) >= it.threshold
        }
        if (fresh.isEmpty()) break
        for (a in fresh) {
            achievements.add(a.id)
            events.add("achievement_unlocked_${a.id}")
            xp += XP_ACHIEVEMENT_BONUS
        }
        level = levelProgress(xp).level
    }
    if (level > t.level) events.add(0, "trainer_level_up")

    val petXp = state.petXp + amount
    val petLevel = levelProgress(petXp).level
    if (petLevel > state.petLevel) events.add(0, "pet_level_up")

    return state.copy(
        petXp = petXp,
        petLevel = petLevel,
        trainer = TrainerProgress(xp, level, achievements, counters, day, xpToday, hour, xpThisHour),
        dailies = daily.dailies,
        events = state.events + events,
        recentEventLog = if (events.isNotEmpty()) (state.recentEventLog + events).takeLast(RECENT_EVENT_LOG_MAX) else state.recentEventLog,
    )
}

/** Parse a TrainerProgress from a Gson-decoded map, filling in defaults for anything missing. */
fun trainerFromRaw(raw: Map<*, *>?): TrainerProgress {
    if (raw == null) return TrainerProgress()
    fun numMap(v: Any?): Map<String, Int> =
        (v as? Map<*, *>)?.entries
            ?.mapNotNull { (k, n) -> if (k is String && n is Number && n.toDouble().isFinite()) k to n.toInt() else null }
            ?.toMap() ?: emptyMap()
    val xp = max(0, (raw["xp"] as? Number)?.toInt() ?: 0)
    return TrainerProgress(
        xp = xp,
        level = levelProgress(xp).level,
        // Unknown ids (e.g. the retired "caretaker") are dropped.
        achievements = (raw["achievements"] as? List<*>)?.filterIsInstance<String>()?.filter { achievementById(it) != null } ?: emptyList(),
        counters = numMap(raw["counters"]),
        xpDay = raw["xpDay"] as? String ?: "",
        // Buckets for uncapped sources, or over today's cap, come from the old rules: start them afresh.
        xpToday = numMap(raw["xpToday"]).filter { (k, v) -> XP_DAILY_CAPS[k]?.let { v <= it } ?: false },
        xpHour = raw["xpHour"] as? String ?: "",
        xpThisHour = numMap(raw["xpThisHour"]).filter { (k, v) -> XP_HOURLY_CAPS[k]?.let { v <= it } ?: false },
    )
}

// ---------------------------------------------------------------------------
// Daily challenges (mirrors the Daily challenges section of gameEngine.ts)
// ---------------------------------------------------------------------------

/**
 * A daily challenge from the "coder", "keeper" or "wild" pool: done once every
 * counter in [reqs] has gone up by its target since the day started.
 */
data class DailyChallenge(
    val id: String,
    val path: String,
    val text: String,
    val reqs: List<Pair<String, Int>>,
)

/** XP for each completed daily challenge. Uncapped, but each pays once a day. */
const val DAILY_CHALLENGE_XP: Int = 25

/** Extra XP for completing all three of the day's challenges. */
const val DAILY_ALL_DONE_BONUS: Int = 25

/** Every daily challenge, grouped by pool. Keep identical to DAILY_CHALLENGES in gameEngine.ts. */
val DAILY_CHALLENGES: List<DailyChallenge> = listOf(
    DailyChallenge("code_10",          "coder",  "Get 10 code-activity rewards",                    listOf("codeActivity" to 10)),
    DailyChallenge("code_25",          "coder",  "Get 25 code-activity rewards",                    listOf("codeActivity" to 25)),
    DailyChallenge("commit_1",         "coder",  "Make a commit",                                   listOf("commits" to 1)),
    DailyChallenge("commit_3",         "coder",  "Make 3 commits",                                  listOf("commits" to 3)),
    DailyChallenge("commit_5",         "coder",  "Make 5 commits",                                  listOf("commits" to 5)),
    DailyChallenge("calls_3",          "keeper", "Answer 3 calls from your pet",                    listOf("callsAnswered" to 3)),
    DailyChallenge("calls_6",          "keeper", "Answer 6 calls from your pet",                    listOf("callsAnswered" to 6)),
    DailyChallenge("snacks_3",         "keeper", "Hand out 3 snacks",                               listOf("snacks" to 3)),
    DailyChallenge("clean_2",          "keeper", "Clean up twice",                                  listOf("cleans" to 2)),
    DailyChallenge("care_10",          "keeper", "Look after your pet 10 times",                    listOf("care" to 10)),
    DailyChallenge("win_1",            "wild",   "Win a mini-game",                                 listOf("minigameWins" to 1)),
    DailyChallenge("win_3",            "wild",   "Win 3 mini-games",                                listOf("minigameWins" to 3)),
    DailyChallenge("commit_and_call",  "wild",   "Make a commit and answer a call",                 listOf("commits" to 1, "callsAnswered" to 1)),
    DailyChallenge("code_and_win",     "wild",   "Get 5 code-activity rewards and win a mini-game", listOf("codeActivity" to 5, "minigameWins" to 1)),
    DailyChallenge("snack_and_commit", "wild",   "Hand out a snack and make a commit",              listOf("snacks" to 1, "commits" to 1)),
)

private val DAILY_PATHS = listOf("coder", "keeper", "wild")

fun dailyChallengeById(id: String): DailyChallenge? = DAILY_CHALLENGES.firstOrNull { it.id == id }

/** 32-bit FNV-1a over UTF-16 code units, identical to seedHash in gameEngine.ts. */
private fun seedHash(s: String): Long {
    var h = 0x811c9dc5.toInt()
    for (c in s) {
        h = h xor c.code
        h *= 16777619
    }
    return h.toLong() and 0xFFFFFFFFL
}

/** The day's three challenge ids (coder, keeper, wild), seeded from the date and the pet. */
fun pickDailyChallenges(day: String, name: String, spawnedAt: Long): List<String> {
    val seed = "$day|$name|$spawnedAt"
    return DAILY_PATHS.map { path ->
        val pool = DAILY_CHALLENGES.filter { it.path == path }
        pool[(seedHash("$seed|$path") % pool.size).toInt()].id
    }
}

/** Saturday or Sunday. */
fun isWeekendDay(day: String): Boolean =
    LocalDate.parse(day).dayOfWeek.let { it == DayOfWeek.SATURDAY || it == DayOfWeek.SUNDAY }

/** The most recent weekday before [day]. */
fun previousWeekday(day: String): String {
    var d = LocalDate.parse(day).minusDays(1)
    while (d.dayOfWeek == DayOfWeek.SATURDAY || d.dayOfWeek == DayOfWeek.SUNDAY) d = d.minusDays(1)
    return d.toString()
}

/** The streak as of [now]: weekdays in a row with all three done. Weekends neither break nor extend it. */
fun currentStreak(dailies: DailyChallenges, now: Long = System.currentTimeMillis()): Int {
    val today = localDayKey(now)
    if (dailies.streak <= 0 || dailies.streakDay.isEmpty()) return 0
    return if (dailies.streakDay == today || dailies.streakDay == previousWeekday(today)) dailies.streak else 0
}

private fun rollDailies(dailies: DailyChallenges, state: PetState, counters: Map<String, Int>, day: String): DailyChallenges =
    if (dailies.day == day) dailies
    else dailies.copy(day = day, picks = pickDailyChallenges(day, state.name, state.spawnedAt), baseline = counters, done = emptyList())

data class DailyRequirementProgress(val counter: String, val value: Int, val target: Int)

/** Progress on each requirement of [c], capped at its target. */
fun dailyChallengeProgress(c: DailyChallenge, baseline: Map<String, Int>, counters: Map<String, Int>): List<DailyRequirementProgress> =
    c.reqs.map { (counter, target) ->
        DailyRequirementProgress(counter, minOf(target, max(0, (counters[counter] ?: 0) - (baseline[counter] ?: 0))), target)
    }

data class DailyChallengeView(val id: String, val path: String, val text: String, val value: Int, val target: Int, val done: Boolean)

data class DailiesView(val challenges: List<DailyChallengeView>, val streak: Int, val allDone: Boolean)

/** Today's challenges with progress, and the streak as of [now]. Works before the day's first roll too. */
fun dailiesView(state: PetState, now: Long = System.currentTimeMillis()): DailiesView {
    val d = rollDailies(state.dailies, state, state.trainer.counters, localDayKey(now))
    val challenges = d.picks.mapNotNull { id ->
        val c = dailyChallengeById(id) ?: return@mapNotNull null
        val p = dailyChallengeProgress(c, d.baseline, state.trainer.counters)
        DailyChallengeView(id, c.path, c.text, p.sumOf { it.value }, p.sumOf { it.target }, id in d.done)
    }
    return DailiesView(challenges, currentStreak(d, now), challenges.isNotEmpty() && challenges.all { it.done })
}

internal data class DailyAdvance(val dailies: DailyChallenges, val xp: Int, val events: List<String>)

/** Roll the day if needed, then mark any challenges now complete. */
internal fun advanceDailies(state: PetState, before: Map<String, Int>, after: Map<String, Int>, day: String): DailyAdvance {
    val d = rollDailies(state.dailies, state, before, day)
    val done = d.done.toMutableList()
    val events = mutableListOf<String>()
    var xp = 0
    for (id in d.picks) {
        val c = dailyChallengeById(id) ?: continue
        if (id in done) continue
        if (dailyChallengeProgress(c, d.baseline, after).all { it.value >= it.target }) {
            done.add(id)
            events.add("daily_challenge_done_$id")
            xp += DAILY_CHALLENGE_XP
        }
    }
    var streak = d.streak
    var streakDay = d.streakDay
    if (events.isNotEmpty() && d.picks.isNotEmpty() && done.size == d.picks.size) {
        events.add("daily_challenges_all_done")
        xp += DAILY_ALL_DONE_BONUS
        if (!isWeekendDay(day) && streakDay != day) {
            streak = (if (streakDay == previousWeekday(day)) streak else 0) + 1
            streakDay = day
        }
    }
    return DailyAdvance(d.copy(done = done, streak = streak, streakDay = streakDay), xp, events)
}

/** Parse DailyChallenges from a Gson-decoded map, filling in defaults for anything missing. */
fun dailiesFromRaw(raw: Map<*, *>?): DailyChallenges {
    if (raw == null) return DailyChallenges()
    fun strings(v: Any?): List<String> = (v as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    val baseline = (raw["baseline"] as? Map<*, *>)?.entries
        ?.mapNotNull { (k, n) -> if (k is String && n is Number && n.toDouble().isFinite()) k to n.toInt() else null }
        ?.toMap() ?: emptyMap()
    return DailyChallenges(
        day = raw["day"] as? String ?: "",
        picks = strings(raw["picks"]),
        baseline = baseline,
        done = strings(raw["done"]),
        streak = max(0, (raw["streak"] as? Number)?.toInt() ?: 0),
        streakDay = raw["streakDay"] as? String ?: "",
    )
}
