package com.codotchi.engine

import java.time.Instant
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
val XP_HOURLY_CAPS: Map<String, Int> = mapOf("code" to 10, "commit" to 30, "minigame" to 20)

/** Daily XP caps per source (local day). Sources not listed are uncapped. */
val XP_DAILY_CAPS: Map<String, Int> = mapOf("code" to 40, "commit" to 90, "call" to 100, "minigame" to 50)

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
    "boss_battle" to listOf("bossBattleWins"),
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
    Achievement("champion",     "Champion",      "Win a Boss Battle",                      "🥊", "bossBattleWins", 1,    "keeper", comingSoon = true),
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

    val events = mutableListOf<String>()
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
        achievements = (raw["achievements"] as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
        counters = numMap(raw["counters"]),
        xpDay = raw["xpDay"] as? String ?: "",
        xpToday = numMap(raw["xpToday"]),
        xpHour = raw["xpHour"] as? String ?: "",
        xpThisHour = numMap(raw["xpThisHour"]),
    )
}
