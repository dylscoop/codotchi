package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * "Push live progress" must always work for an eligible pet — mirrors
 * vscode/tests/unit/liveProgress.test.ts.
 */
class LiveProgressTest {

    private val key = "test-key"

    private fun pluginSource(): String =
        LiveProgressTest::class.java.getResourceAsStream("/source/CodotchiPlugin.kt")
            ?.bufferedReader()?.readText()
            ?: error("CodotchiPlugin.kt not found on test classpath (copySourceForTest)")

    @Test
    fun `a fresh pet can push and stays eligible after a save and reload`() {
        val pet = createPet("Pixel", "codeling", "neon")
        assertNull(Integrity.leaderboardBlockedReason(pet, false, key))
        val reloaded = Integrity.verifySeal(pet, Integrity.sealState(pet, key), key)
        assertNull(Integrity.leaderboardBlockedReason(reloaded, false, key))
    }

    @Test
    fun `a pet saved before seals existed can still push`() {
        val loaded = Integrity.verifySeal(createPet("Pixel", "codeling", "neon"), null, key)
        assertEquals("unverified", loaded.leaderboardIneligible)
        assertNull(Integrity.leaderboardBlockedReason(loaded, false, key))
    }

    @Test
    fun `toggling live progress subscribes, pushes straight away and re-broadcasts`() {
        val src = pluginSource()
        val start = src.indexOf("\"toggle_live_subscribe\" -> {")
        assertTrue(start >= 0, "toggle_live_subscribe handler missing")
        val handler = src.substring(start, src.indexOf("\"reset_high_score\" -> {", start))
        assertTrue(handler.contains("props.setValue(\"codotchi.liveSubscribed\", subscribing)"))
        assertTrue(handler.contains("shouldBroadcast = true"))
        assertTrue(handler.contains("pushLiveScoreAsync(stateSnap, promptIfNoToken = true)"))
    }

    @Test
    fun `re-broadcasting the same state doesn't repeat attention-call notifications`() {
        val src = pluginSource()
        assertTrue(src.contains("state.events !== lastNotifiedEvents"))
        assertTrue(src.contains("if (state != null && freshEvents && service<CodotchiSettings>().enableAttentionCalls)"))
        assertTrue(src.contains("if (state != null && freshEvents && state.events.contains(\"died_of_old_age\"))"))
    }

    @Test
    fun `pushLiveScoreAsync posts a signed leaderboard-live issue and records the sync`() {
        val src = pluginSource()
        val push = src.substringAfter("private fun pushLiveScoreAsync").substringBefore("private fun submitLeaderboardAsync")
        assertTrue(push.contains("buildLiveEntryJson("))
        assertTrue(push.contains("\"labels\" to listOf(\"leaderboard-live\")"))
        assertTrue(push.contains("URL(GITHUB_ISSUES_API)"))
        assertTrue(push.contains("responseCode == 201"))
        assertTrue(push.contains("setValue(\"codotchi.liveLastPushedAt\""))
    }
}
