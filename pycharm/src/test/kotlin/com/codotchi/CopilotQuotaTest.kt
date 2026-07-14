package com.codotchi

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Unit tests for CopilotQuota.kt — mirrors the coverage of
 * vscode/tests/unit/copilotQuota.test.ts. Only the pure parsing logic and the
 * injectable-RawHttp orchestration/cache/device-flow state machine are
 * tested — real network I/O is never exercised.
 */
class CopilotQuotaTest {

    @AfterEach
    fun clearCache() {
        CopilotQuotaCache.clear()
    }

    // ── parseQuotaBody ───────────────────────────────────────────────────────

    @Test
    fun `parseQuotaBody parses the modern quota_snapshots shape`() {
        val body = mapOf("quota_snapshots" to mapOf("premium_interactions" to mapOf("percent_remaining" to 42.6, "unlimited" to false)))
        assertEquals(CopilotQuotaResult.Ok(43, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the modern shape with unlimited true`() {
        val body = mapOf("quota_snapshots" to mapOf("premium_interactions" to mapOf("percent_remaining" to 100.0, "unlimited" to true)))
        assertEquals(CopilotQuotaResult.Ok(100, true), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the legacy premium_interactions shape`() {
        val body = mapOf("limited_user_quotas" to mapOf("premium_interactions" to mapOf("limit" to 300.0, "used" to 75.0)))
        assertEquals(CopilotQuotaResult.Ok(75, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the legacy completions shape with explicit remaining`() {
        val body = mapOf("limited_user_quotas" to mapOf("completions" to mapOf("monthly_maximum" to 300.0, "used" to 100.0, "remaining" to 150.0)))
        assertEquals(CopilotQuotaResult.Ok(50, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the nested quota shape`() {
        val body = mapOf("quota" to mapOf("maximum" to 100.0, "used" to 20.0))
        assertEquals(CopilotQuotaResult.Ok(80, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the nested premium_interactions shape`() {
        val body = mapOf("premium_interactions" to mapOf("total" to 50.0, "used" to 10.0))
        assertEquals(CopilotQuotaResult.Ok(80, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the flat premium_requests_maximum shape`() {
        val body = mapOf("premium_requests_maximum" to 200.0, "premium_requests_used" to 50.0)
        assertEquals(CopilotQuotaResult.Ok(75, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody parses the flat monthly_maximum_premium_requests shape`() {
        val body = mapOf("monthly_maximum_premium_requests" to 10.0, "premium_requests_used" to 10.0)
        assertEquals(CopilotQuotaResult.Ok(0, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody returns 0 percent for a zero-limit legacy quota instead of dividing by zero`() {
        val body = mapOf("limited_user_quotas" to mapOf("premium_interactions" to mapOf("limit" to 0.0, "used" to 0.0)))
        assertEquals(CopilotQuotaResult.Ok(0, false), parseQuotaBody(body))
    }

    @Test
    fun `parseQuotaBody returns ParseError for an unrecognized body shape`() {
        assertEquals(CopilotQuotaResult.ParseError("Unrecognized Copilot quota response shape"), parseQuotaBody(mapOf("some" to "unrelated field")))
    }

    // ── fetchQuota (injected RawHttp) ────────────────────────────────────────

    @Test
    fun `fetchQuota parses a successful response`() {
        val http = RawHttp { _, _, _, _ -> 200 to """{"quota_snapshots":{"premium_interactions":{"percent_remaining":60,"unlimited":false}}}""" }
        assertEquals(CopilotQuotaResult.Ok(60, false), fetchQuota("tok", http))
    }

    @Test
    fun `fetchQuota maps 401 and 403 to Unauthorized`() {
        val http401 = RawHttp { _, _, _, _ -> 401 to "" }
        val http403 = RawHttp { _, _, _, _ -> 403 to "" }
        assertEquals(CopilotQuotaResult.Unauthorized, fetchQuota("tok", http401))
        assertEquals(CopilotQuotaResult.Unauthorized, fetchQuota("tok", http403))
    }

    @Test
    fun `fetchQuota maps other non-2xx statuses to NetworkError`() {
        val http = RawHttp { _, _, _, _ -> 500 to "" }
        assertEquals(CopilotQuotaResult.NetworkError("HTTP 500"), fetchQuota("tok", http))
    }

    @Test
    fun `fetchQuota maps a thrown RawHttp to NetworkError`() {
        val http = RawHttp { _, _, _, _ -> throw RuntimeException("network down") }
        assertEquals(CopilotQuotaResult.NetworkError("network down"), fetchQuota("tok", http))
    }

    @Test
    fun `fetchQuota maps an unparseable body to ParseError`() {
        val http = RawHttp { _, _, _, _ -> 200 to "not json" }
        assertTrue(fetchQuota("tok", http) is CopilotQuotaResult.ParseError)
    }

    // ── CopilotQuotaCache ────────────────────────────────────────────────────

    @Test
    fun `CopilotQuotaCache does not re-fetch within the TTL`() {
        var calls = 0
        val fetch = { calls++; CopilotQuotaResult.Ok(60, false) as CopilotQuotaResult }
        CopilotQuotaCache.get(1_000L, fetch)
        CopilotQuotaCache.get(1_000L + COPILOT_QUOTA_CACHE_TTL_MS - 1, fetch)
        assertEquals(1, calls)
    }

    @Test
    fun `CopilotQuotaCache re-fetches once the TTL has elapsed`() {
        var calls = 0
        val fetch = { calls++; CopilotQuotaResult.Ok(60, false) as CopilotQuotaResult }
        CopilotQuotaCache.get(1_000L, fetch)
        CopilotQuotaCache.get(1_000L + COPILOT_QUOTA_CACHE_TTL_MS + 1, fetch)
        assertEquals(2, calls)
    }

    @Test
    fun `CopilotQuotaCache does not cache a transient NetworkError`() {
        var calls = 0
        val fetch = { calls++; CopilotQuotaResult.NetworkError("boom") as CopilotQuotaResult }
        CopilotQuotaCache.get(1_000L, fetch)
        CopilotQuotaCache.get(1_001L, fetch)
        assertEquals(2, calls)
    }

    // ── Device flow ──────────────────────────────────────────────────────────

    @Test
    fun `parseDeviceCodeResponse reads all fields with defaults for missing optionals`() {
        val body = mapOf("device_code" to "dc", "user_code" to "ABCD-1234", "verification_uri" to "https://github.com/login/device")
        val result = parseDeviceCodeResponse(body)
        assertEquals(DeviceCodeResponse("dc", "ABCD-1234", "https://github.com/login/device", 900, 5), result)
    }

    @Test
    fun `parseDeviceCodeResponse falls back to verification_uri_complete when verification_uri is absent`() {
        val body = mapOf("device_code" to "dc", "user_code" to "ABCD-1234", "verification_uri_complete" to "https://github.com/login/device?x=1", "expires_in" to 600.0, "interval" to 10.0)
        val result = parseDeviceCodeResponse(body)
        assertEquals(DeviceCodeResponse("dc", "ABCD-1234", "https://github.com/login/device?x=1", 600, 10), result)
    }

    @Test
    fun `pollForToken returns Success once access_token appears`() {
        var call = 0
        val http = RawHttp { _, _, _, _ ->
            call++
            if (call < 3) 200 to """{"error":"authorization_pending"}"""
            else 200 to """{"access_token":"gho_abc123"}"""
        }
        val result = CopilotDeviceFlow.pollForToken(
            deviceCode = "dc", intervalSeconds = 1, expiresInSeconds = 60,
            http = http, sleep = { /* no-op in tests */ }, nowMs = { 0L },
        )
        assertEquals(TokenPollResult.Success("gho_abc123"), result)
        assertEquals(3, call)
    }

    @Test
    fun `pollForToken returns AccessDenied when the user declines`() {
        val http = RawHttp { _, _, _, _ -> 200 to """{"error":"access_denied"}""" }
        val result = CopilotDeviceFlow.pollForToken("dc", 1, 60, http, sleep = {}, nowMs = { 0L })
        assertEquals(TokenPollResult.AccessDenied, result)
    }

    @Test
    fun `pollForToken returns Expired when the code expires server-side`() {
        val http = RawHttp { _, _, _, _ -> 200 to """{"error":"expired_token"}""" }
        val result = CopilotDeviceFlow.pollForToken("dc", 1, 60, http, sleep = {}, nowMs = { 0L })
        assertEquals(TokenPollResult.Expired, result)
    }

    @Test
    fun `pollForToken returns Expired when the deadline passes without a terminal response`() {
        val http = RawHttp { _, _, _, _ -> 200 to """{"error":"authorization_pending"}""" }
        var now = 0L
        val result = CopilotDeviceFlow.pollForToken(
            deviceCode = "dc", intervalSeconds = 5, expiresInSeconds = 10,
            http = http, sleep = { now += it }, nowMs = { now },
        )
        assertEquals(TokenPollResult.Expired, result)
    }

    @Test
    fun `pollForToken returns Error on an unrecognized error code`() {
        val http = RawHttp { _, _, _, _ -> 200 to """{"error":"something_else","error_description":"weird"}""" }
        val result = CopilotDeviceFlow.pollForToken("dc", 1, 60, http, sleep = {}, nowMs = { 0L })
        assertEquals(TokenPollResult.Error("weird"), result)
    }

    @Test
    fun `pollForToken returns Error when RawHttp throws`() {
        val http = RawHttp { _, _, _, _ -> throw RuntimeException("network down") }
        val result = CopilotDeviceFlow.pollForToken("dc", 1, 60, http, sleep = {}, nowMs = { 0L })
        assertEquals(TokenPollResult.Error("network down"), result)
    }
}
