package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Unit tests for GitHubAuth.kt — mirrors the isAuthFailure coverage in
 * vscode/tests/unit/githubAuth.test.ts — plus source guards that the
 * leaderboard flows in CodotchiPlugin.kt react to a dead token (BUG-S08).
 */
class GitHubAuthTest {

    private val pluginSource: String by lazy {
        GitHubAuthTest::class.java.getResourceAsStream("/source/CodotchiPlugin.kt")!!
            .bufferedReader().readText()
    }

    @Test
    fun `401 is an auth failure`() {
        assertTrue(isGithubAuthFailure(401, null, null))
    }

    @Test
    fun `plain 403 is an auth failure`() {
        assertTrue(isGithubAuthFailure(403, "42", null))
        assertTrue(isGithubAuthFailure(403, null, null))
    }

    @Test
    fun `rate-limit 403 is not an auth failure`() {
        assertFalse(isGithubAuthFailure(403, "0", null))
        assertFalse(isGithubAuthFailure(403, "10", "60"))
    }

    @Test
    fun `other statuses are not auth failures`() {
        assertFalse(isGithubAuthFailure(200, null, null))
        assertFalse(isGithubAuthFailure(500, null, null))
    }

    @Test
    fun `device flow errors produce user-facing messages`() {
        assertTrue(describeDeviceFlowError("access_denied").contains("cancelled"))
        assertTrue(describeDeviceFlowError("expired_token").contains("expired"))
        assertTrue(describeDeviceFlowError(null).contains("timed out"))
        assertTrue(describeDeviceFlowError("weird").contains("weird"))
    }

    @Test
    fun `auth failure clears the stored token and cached username`() {
        val fn = pluginSource.substringAfter("private fun handleLeaderboardAuthFailure").substringBefore("fun initialize()")
        assertTrue(fn.contains("setPassword(CredentialAttributes(\"Codotchi\", \"github-pat\"), null)"))
        assertTrue(fn.contains("setLeaderboardUsername(null)"))
        assertTrue(fn.contains("startDeviceFlowAsync"))
    }

    @Test
    fun `live push and submit check for auth failures`() {
        val push = pluginSource.substringAfter("private fun pushLiveScoreAsync").substringBefore("private fun submitLeaderboardAsync")
        assertTrue(push.contains("isGithubAuthFailure()"), "pushLiveScoreAsync must detect a dead token")
        val submit = pluginSource.substringAfter("private fun submitLeaderboardAsync").substringBefore("private fun startDeviceFlowAsync")
        assertTrue(submit.contains("isGithubAuthFailure()"), "submitLeaderboardAsync must detect a dead token")
        assertTrue(submit.contains("retried = true"), "submit must retry at most once after re-auth")
    }

    @Test
    fun `device flow never fails silently`() {
        val flow = pluginSource.substringAfter("private fun startDeviceFlowAsync").substringBefore("private fun resolveAndCacheLeaderboardUsername")
        assertFalse(flow.contains("network failure — silent"))
        assertTrue(flow.contains("fail(describeDeviceFlowError("))
    }
}
