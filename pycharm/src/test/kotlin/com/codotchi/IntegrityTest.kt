package com.codotchi

import com.codotchi.engine.*
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import java.io.File

/**
 * Leaderboard integrity (Integrity.kt) — mirrors vscode/tests/unit/integrity.test.ts.
 *
 * The shared vector packages/core/fixtures/integrity-vector.json pins the canonical
 * seal / signature strings, so Kotlin, TypeScript and the GitHub workflow can never
 * drift apart.
 */
class IntegrityTest {

    private val key = "test-key"

    private fun loadVector(): JsonObject {
        // Tests run with the pycharm/ project dir as the working directory; walk up
        // so the fixture is found regardless.
        var dir: File? = File(System.getProperty("user.dir")).absoluteFile
        while (dir != null) {
            val f = File(dir, "packages/core/fixtures/integrity-vector.json")
            if (f.isFile) return JsonParser.parseString(f.readText(Charsets.UTF_8)).asJsonObject
            dir = dir.parentFile
        }
        error("integrity-vector.json not found above ${System.getProperty("user.dir")}")
    }

    private fun pet(): PetState = createPet("Pixel", "codeling", "neon").copy(
        spawnedAt = 1_790_000_000_000L, ticksAlive = 1234, dayTimer = 12.5, hunger = 40,
    )

    // ── Shared test vector ──────────────────────────────────────────────────

    @Test
    fun `seal payload and seal match the shared vector`() {
        val v = loadVector()
        val s = v.getAsJsonObject("state")
        val fields = Integrity.SealFields(
            spawnedAt = s["spawnedAt"].asDouble,
            name = s["name"].asString,
            petType = s["petType"].asString,
            stage = s["stage"].asString,
            alive = s["alive"].asBoolean,
            ticksAlive = s["ticksAlive"].asDouble,
            dayTimer = s["dayTimer"].asDouble,
            hunger = s["hunger"].asDouble,
            happiness = s["happiness"].asDouble,
            energy = s["energy"].asDouble,
            health = s["health"].asDouble,
            weight = s["weight"].asDouble,
            sick = s["sick"].asBoolean,
            careMistakes = s["careMistakes"].asDouble,
            lifetimeCareMistakes = s["lifetimeCareMistakes"].asDouble,
            devModeEverUsed = s["devModeEverUsed"].asBoolean,
            leaderboardIneligible = s["leaderboardIneligible"].asString,
        )
        assertEquals(v["sealPayload"].asString, Integrity.sealPayload(fields))
        assertEquals(v["seal"].asString, Integrity.sealFields(fields, v["key"].asString))
    }

    @Test
    fun `submission payload and signature match the shared vector`() {
        val v = loadVector()
        val s = v.getAsJsonObject("submission")
        val sub = Integrity.SignedSubmission(
            kind = s["kind"].asString,
            githubUsername = s["githubUsername"].asString,
            petName = s["petName"].asString,
            ageDays = s["ageDays"].asDouble,
            stage = s["stage"].asString,
            petType = s["petType"].asString,
            spawnedAt = s["spawnedAt"].asLong,
            at = s["at"].asLong,
            petRunId = s["petRunId"].asString,
            clientVersion = s["clientVersion"].asString,
        )
        assertEquals(v["submissionPayload"].asString, Integrity.submissionPayload(sub))
        assertEquals(v["signature"].asString, Integrity.signSubmission(sub, v["key"].asString))
    }

    @Test
    fun `PetState seal payload uses the same layout as the raw fields`() {
        val p = pet()
        assertEquals(Integrity.sealPayload(Integrity.SealFields.of(p)), Integrity.sealPayload(p))
        val lines = Integrity.sealPayload(p).split("\n")
        assertEquals(18, lines.size)
        assertEquals("codotchi-seal-v1", lines[0])
        assertEquals("1790000000000", lines[1])
        assertEquals("12500000", lines[7])
        assertEquals("40000", lines[8])
    }

    // ── verifySeal ──────────────────────────────────────────────────────────

    @Test
    fun `matching seal keeps the pet eligible`() {
        val p = pet()
        val verified = Integrity.verifySeal(p, Integrity.sealState(p, key), key)
        assertEquals("", verified.leaderboardIneligible)
    }

    @Test
    fun `edited state is tampered`() {
        val p = pet()
        val seal = Integrity.sealState(p, key)
        val edited = p.copy(dayTimer = 400.0)
        assertEquals("tampered", Integrity.verifySeal(edited, seal, key).leaderboardIneligible)
    }

    @Test
    fun `wrong key is tampered`() {
        val p = pet()
        assertEquals("tampered", Integrity.verifySeal(p, Integrity.sealState(p, "other"), key).leaderboardIneligible)
    }

    @Test
    fun `missing seal is unverified`() {
        assertEquals("unverified", Integrity.verifySeal(pet(), null, key).leaderboardIneligible)
        assertEquals("unverified", Integrity.verifySeal(pet(), "", key).leaderboardIneligible)
    }

    @Test
    fun `tampered and unverified are sticky`() {
        val tampered = pet().copy(leaderboardIneligible = "tampered")
        // A seal written after the mark covers the mark itself, and tampered never clears.
        assertEquals("tampered", Integrity.verifySeal(tampered, Integrity.sealState(tampered, key), key).leaderboardIneligible)
        assertEquals("tampered", Integrity.verifySeal(tampered, null, key).leaderboardIneligible)

        val unverified = pet().copy(leaderboardIneligible = "unverified")
        assertEquals("unverified", Integrity.verifySeal(unverified, Integrity.sealState(unverified, key), key).leaderboardIneligible)
        assertEquals("unverified", Integrity.verifySeal(unverified, null, key).leaderboardIneligible)
        // Clearing the mark by hand breaks the seal.
        val cleared = unverified.copy(leaderboardIneligible = "")
        assertEquals("tampered", Integrity.verifySeal(cleared, Integrity.sealState(unverified, key), key).leaderboardIneligible)
    }

    @Test
    fun `clearing devModeEverUsed by hand breaks the seal`() {
        val dev = pet().copy(devModeEverUsed = true)
        val seal = Integrity.sealState(dev, key)
        assertEquals("tampered", Integrity.verifySeal(dev.copy(devModeEverUsed = false), seal, key).leaderboardIneligible)
    }

    // ── leaderboardBlockedReason ────────────────────────────────────────────

    @Test
    fun `blocked reasons`() {
        val p = pet()
        assertNull(Integrity.leaderboardBlockedReason(p, false, key))
        assertEquals("This build of Codotchi can't submit to the leaderboard.",
            Integrity.leaderboardBlockedReason(p, false, ""))
        assertEquals("This pet has lived in dev mode, so it can't go on the leaderboard.",
            Integrity.leaderboardBlockedReason(p, true, key))
        assertEquals("This pet has lived in dev mode, so it can't go on the leaderboard.",
            Integrity.leaderboardBlockedReason(p.copy(devModeEverUsed = true), false, key))
        assertEquals("This pet's save file was edited outside Codotchi, so it can't go on the leaderboard.",
            Integrity.leaderboardBlockedReason(p.copy(leaderboardIneligible = "tampered"), false, key))
        assertEquals("This pet was hatched before leaderboard verification, so it can't go on the leaderboard. Your next pet can.",
            Integrity.leaderboardBlockedReason(p.copy(leaderboardIneligible = "unverified"), false, key))
    }

    // ── Payload builders ────────────────────────────────────────────────────

    @Test
    fun `score issue body is a signed schemaVersion 2 fenced json block`() {
        val p = pet().copy(name = "Big \"Q\" <b>", ageDays = 12, stage = "adult")
        val body = buildScoreIssueBody(p, "Stuart-Mac", 1_790_100_000_000L, "2.27.0", key)
        assertTrue(body.startsWith("Leaderboard submission.\n\n```json\n{\n  \"schemaVersion\": 2,"), body)
        assertTrue(body.endsWith("\n}\n```"), body)
        val json = JsonParser.parseString(body.substringAfter("```json\n").substringBeforeLast("\n```")).asJsonObject
        assertEquals(listOf("schemaVersion", "githubUsername", "petName", "ageDays", "stage", "petType",
            "spawnedAt", "diedAt", "clientVersion", "sig"), json.keySet().toList())
        assertEquals("Big \"Q\" <b>", json["petName"].asString)
        val expected = Integrity.signSubmission(Integrity.SignedSubmission(
            "score", "Stuart-Mac", p.name, 12.0, "adult", p.petType, p.spawnedAt, 1_790_100_000_000L, "", "2.27.0"), key)
        assertEquals(expected, json["sig"].asString)
    }

    @Test
    fun `live entry has the VS Code fields and a live signature`() {
        val p = pet().copy(ageDays = 3, stage = "child")
        val entry = JsonParser.parseString(
            buildLiveEntryJson(p, "Stuart-Mac", "run-123", 1_790_200_000_000L, "2.27.0", key)).asJsonObject
        assertEquals(listOf("schemaVersion", "username", "petName", "petRunId", "spawnedAt", "ageDays", "stage",
            "petType", "updatedAt", "clientVersion", "sig"), entry.keySet().toList())
        assertEquals(2, entry["schemaVersion"].asInt)
        val expected = Integrity.signSubmission(Integrity.SignedSubmission(
            "live", "Stuart-Mac", p.name, 3.0, "child", p.petType, p.spawnedAt, 1_790_200_000_000L, "run-123", "2.27.0"), key)
        assertEquals(expected, entry["sig"].asString)
    }

    @Test
    fun `jsonStringOrNull escapes for the webview`() {
        assertEquals("null", jsonStringOrNull(null))
        assertEquals("\"a \\\"b\\\" \\\\ c\"", jsonStringOrNull("a \"b\" \\ c"))
        assertEquals("\"pet's\"", jsonStringOrNull("pet's"))
    }
}
