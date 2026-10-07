package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.io.File
import java.nio.file.Files
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Unit tests for ClaudeUsageScanner.kt — mirrors
 * vscode/tests/unit/claudeUsage.test.ts (BUGFIX-161): local-day boundary,
 * dedupe of repeated content-block lines, subagent transcripts, hourly cost.
 */
class ClaudeUsageScannerTest {

    private val zone: ZoneId = ZoneId.of("Europe/London")

    // 00:30 local (BST) on 2026-09-24 — just after the user's midnight.
    private val now = LocalDateTime.of(2026, 9, 24, 0, 30).atZone(zone).toInstant()

    private fun iso(y: Int, m: Int, d: Int, h: Int, min: Int): String =
        LocalDateTime.of(y, m, d, h, min).atZone(zone).toInstant().toString()

    private fun line(id: String, requestId: String, timestamp: String, outputTokens: Int = 50): String =
        """{"type":"assistant","timestamp":"$timestamp","requestId":"$requestId","message":{"id":"$id","model":"claude-sonnet-4-x","usage":{"input_tokens":100,"output_tokens":$outputTokens,"cache_read_input_tokens":0,"cache_creation_input_tokens":0}}}"""

    private fun withProjsDir(files: Map<String, List<String>>, block: (File) -> Unit) {
        val dir = Files.createTempDirectory("codotchi-pycharm-scan-").toFile()
        try {
            for ((rel, lines) in files) {
                val f = File(dir, rel)
                f.parentFile.mkdirs()
                f.writeText(lines.joinToString("\n") + "\n")
            }
            block(dir)
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun `localDateKey and localDayStartMs use the local calendar day`() {
        assertEquals("2026-09-24", ClaudeUsageScanner.localDateKey(now, zone))
        assertEquals(
            LocalDateTime.of(2026, 9, 24, 0, 0).atZone(zone).toInstant().toEpochMilli(),
            ClaudeUsageScanner.localDayStartMs(now, zone)
        )
    }

    @Test
    fun `splits a session that crosses midnight at local midnight`() {
        withProjsDir(mapOf("proj/sess.jsonl" to listOf(
            line("m1", "r1", iso(2026, 9, 23, 23, 59)),
            line("m2", "r2", iso(2026, 9, 24, 0, 1)),
        ))) { dir ->
            val r = ClaudeUsageScanner.scan(dir, now, zone)
            assertEquals(1, r.messageCount)
            assertEquals(150L, r.tokens)
        }
    }

    @Test
    fun `counts repeated content-block lines once keeping the last line's usage`() {
        val ts = iso(2026, 9, 24, 0, 10)
        withProjsDir(mapOf("proj/sess.jsonl" to listOf(
            line("m1", "r1", ts, 5), line("m1", "r1", ts, 50), line("m2", "r2", ts, 50),
        ))) { dir ->
            val r = ClaudeUsageScanner.scan(dir, now, zone)
            assertEquals(2, r.messageCount)
            assertEquals(300L, r.tokens)
        }
    }

    @Test
    fun `includes subagent transcripts`() {
        val ts = iso(2026, 9, 24, 0, 10)
        withProjsDir(mapOf(
            "proj/sess.jsonl" to listOf(line("m1", "r1", ts)),
            "proj/sess/subagents/agent-a.jsonl" to listOf(line("s1", "rs1", ts), line("s2", "rs2", ts)),
        )) { dir ->
            assertEquals(3, ClaudeUsageScanner.scan(dir, now, zone).messageCount)
        }
    }

    @Test
    fun `hourly cost covers only the last hour`() {
        withProjsDir(mapOf("proj/sess.jsonl" to listOf(
            line("old", "r1", iso(2026, 9, 23, 23, 0)),
            line("new", "r2", iso(2026, 9, 24, 0, 20)),
        ))) { dir ->
            val r = ClaudeUsageScanner.scan(dir, now, zone)
            assertEquals(1, r.messageCount)
            assertTrue(r.hourlyCostUsd > 0.0)
            assertEquals(r.costUsd, r.hourlyCostUsd, 1e-12)
        }
    }

    @Test
    fun `returns zeros when the projects dir does not exist`() {
        val r = ClaudeUsageScanner.scan(File(System.getProperty("java.io.tmpdir"), "codotchi-missing-dir-xyz"), now, zone)
        assertEquals(DailyUsage(0.0, 0.0, 0L, 0), r)
    }
}
