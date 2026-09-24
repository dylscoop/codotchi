package com.codotchi

import com.google.gson.Gson
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Today's usage totals for a single token-cost source. */
data class DailyUsage(
    val costUsd: Double,
    val hourlyCostUsd: Double,
    val tokens: Long,
    val messageCount: Int,
)

/**
 * Scans Claude Code transcripts (~/.claude/projects) and sums today's token
 * usage and cost for the "Today's Token Cost" bubble. Mirrors
 * vscode/src/claudeUsage.ts and claude-codotchi/scripts/state.mjs
 * scanClaudeUsage() — keep all three in sync.
 *
 * - "Today" starts at local midnight, compared against each message's parsed
 *   timestamp, so a session running across midnight is split at the user's
 *   midnight rather than UTC's.
 * - Claude Code writes one JSONL line per content block, each repeating the
 *   message's usage (earlier lines may carry partial output_tokens). Lines are
 *   deduplicated by message.id + requestId; the last line seen wins.
 * - Subagent (Task) transcripts under <session>/subagents/ are included.
 */
object ClaudeUsageScanner {

    private data class Pricing(val input: Double, val output: Double, val cacheRead: Double, val cacheWrite: Double)

    // Mirrors state.mjs / claudeUsage.ts MODEL_PRICING — most-specific
    // prefix first, since e.g. claude-opus-4-8 must be checked before the
    // generic claude-opus-4 / bare "opus" fallback.
    private fun pricingForModel(model: String): Pricing = when {
        model.startsWith("claude-opus-4-8")   -> Pricing(5.0, 25.0, 0.50, 6.25)
        model.startsWith("claude-opus-4-1")   -> Pricing(15.0, 75.0, 1.50, 18.75)
        model.startsWith("claude-3-5-sonnet") -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-3-5-haiku")  -> Pricing(0.80, 4.0, 0.08, 1.00)
        model.startsWith("claude-3-opus")     -> Pricing(15.0, 75.0, 1.50, 18.75)
        model.startsWith("claude-3-sonnet")   -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-3-haiku")    -> Pricing(0.25, 1.25, 0.03, 0.30)
        model.startsWith("claude-opus-4")     -> Pricing(15.0, 75.0, 1.50, 18.75)
        model.startsWith("claude-sonnet-5")   -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-sonnet-4")   -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-haiku-4-5")  -> Pricing(1.0, 5.0, 0.10, 1.25)
        model.startsWith("claude-fable-5")    -> Pricing(10.0, 50.0, 1.00, 12.50)
        "opus" in model    -> Pricing(15.0, 75.0, 1.5, 18.75)
        "haiku" in model   -> Pricing(0.80, 4.0, 0.08, 1.0)
        else               -> Pricing(3.0, 15.0, 0.30, 3.75) // sonnet default
    }

    private data class Entry(val usage: Map<*, *>, val model: String, val tsMs: Long?)

    /** Local calendar date ("YYYY-MM-DD") that "today" is measured by. */
    fun localDateKey(now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): String =
        LocalDate.ofInstant(now, zone).toString()

    /** Epoch ms of local midnight at the start of the day containing [now]. */
    fun localDayStartMs(now: Instant = Instant.now(), zone: ZoneId = ZoneId.systemDefault()): Long =
        LocalDate.ofInstant(now, zone).atStartOfDay(zone).toInstant().toEpochMilli()

    /** Transcript files under one project dir: top-level .jsonl files plus the .jsonl files in each <session>/subagents dir. */
    private fun listTranscripts(projDir: File): List<File> {
        val out = mutableListOf<File>()
        for (f in projDir.listFiles() ?: emptyArray()) {
            if (f.isFile && f.name.endsWith(".jsonl")) {
                out.add(f)
            } else if (f.isDirectory) {
                File(f, "subagents").listFiles()?.filter { it.isFile && it.name.endsWith(".jsonl") }?.let { out.addAll(it) }
            }
        }
        return out
    }

    fun scan(
        projsDir: File = File(System.getProperty("user.home") ?: "", ".claude/projects"),
        now: Instant = Instant.now(),
        zone: ZoneId = ZoneId.systemDefault(),
    ): DailyUsage {
        val dayStartMs = localDayStartMs(now, zone)
        val oneHourAgoMs = now.toEpochMilli() - 3_600_000L
        val byId = LinkedHashMap<String, Entry>()   // "msgId:requestId" -> entry (last line wins)
        val anonymous = mutableListOf<Entry>()      // lines without a message id — counted as-is
        val gson = Gson()

        try {
            if (projsDir.isDirectory) {
                for (proj in projsDir.listFiles() ?: emptyArray()) {
                    if (!proj.isDirectory) continue
                    for (f in listTranscripts(proj)) {
                        if (f.lastModified() < dayStartMs) continue
                        try {
                            for (line in f.readLines()) {
                                try {
                                    @Suppress("UNCHECKED_CAST")
                                    val d = gson.fromJson(line, Map::class.java) as? Map<*, *> ?: continue
                                    if (d["type"] != "assistant") continue
                                    val msg = d["message"] as? Map<*, *> ?: continue
                                    val u = msg["usage"] as? Map<*, *> ?: continue
                                    val ts = d["timestamp"] as? String ?: ""
                                    val tsMs: Long? = if (ts.isEmpty()) null else {
                                        val parsed = try { Instant.parse(ts).toEpochMilli() } catch (_: Exception) { continue }
                                        if (parsed < dayStartMs) continue
                                        parsed
                                    }
                                    val entry = Entry(u, msg["model"] as? String ?: "", tsMs)
                                    val id = msg["id"] as? String
                                    if (!id.isNullOrEmpty()) byId["$id:${d["requestId"] as? String ?: ""}"] = entry
                                    else anonymous.add(entry)
                                } catch (_: Exception) { /* skip malformed line */ }
                            }
                        } catch (_: Exception) { /* skip unreadable file */ }
                    }
                }
            }
        } catch (_: Exception) { /* projsDir missing */ }

        var costUsd = 0.0; var hourlyCostUsd = 0.0; var tokens = 0L; var messageCount = 0
        for (e in byId.values + anonymous) {
            val p = pricingForModel(e.model)
            val inp = (e.usage["input_tokens"] as? Number)?.toLong() ?: 0L
            val out = (e.usage["output_tokens"] as? Number)?.toLong() ?: 0L
            val cr  = (e.usage["cache_read_input_tokens"] as? Number)?.toLong() ?: 0L
            val cc  = (e.usage["cache_creation_input_tokens"] as? Number)?.toLong() ?: 0L
            val entryCost = (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000.0
            costUsd += entryCost
            tokens += inp + out + cr + cc
            messageCount++
            if (e.tsMs != null && e.tsMs >= oneHourAgoMs) hourlyCostUsd += entryCost
        }
        return DailyUsage(costUsd, hourlyCostUsd, tokens, messageCount)
    }
}
