package com.codotchi

import com.google.gson.Gson
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.credentialStore.Credentials
import com.intellij.credentialStore.generateServiceName
import com.intellij.ide.passwordSafe.PasswordSafe
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

/**
 * CopilotQuota — fetches a GitHub Copilot premium-quota percentage via
 * GitHub's own OAuth Device Flow (RFC 8628) sign-in — no manual PAT, no
 * org billing-admin access required.
 *
 * Mirrors vscode/src/copilotQuota.ts. Hits the same undocumented endpoint
 * VS Code's own Copilot status bar and several third-party quota-monitor
 * extensions use (`api.github.com/copilot_internal/user`); parsing
 * tolerates several known response shapes and degrades to a typed error
 * rather than throwing on anything unrecognized.
 *
 * [RawHttp] is the sole seam to the network so [parseQuotaBody],
 * [fetchQuota], and the device-flow state machine in [CopilotDeviceFlow]
 * are all unit-testable without real HTTP calls.
 */

private const val CLIENT_ID = "Iv1.b507a08c87ecfe98" // publicly documented client ID for GitHub Copilot IDE integrations
private const val DEVICE_SCOPE = "read:user"
private const val DEVICE_CODE_URL = "https://github.com/login/device/code"
private const val ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
private const val QUOTA_URL = "https://api.github.com/copilot_internal/user"

/** In-memory cache lifetime — mirrors COPILOT_QUOTA_CACHE_TTL_MS in copilotQuota.ts. */
const val COPILOT_QUOTA_CACHE_TTL_MS = 12 * 60 * 1000L

sealed class CopilotQuotaResult {
    data class Ok(val percentRemaining: Int, val unlimited: Boolean) : CopilotQuotaResult()
    object NoToken : CopilotQuotaResult()
    object Unauthorized : CopilotQuotaResult()
    data class NetworkError(val message: String) : CopilotQuotaResult()
    data class ParseError(val message: String) : CopilotQuotaResult()
}

data class DeviceCodeResponse(
    val deviceCode: String,
    val userCode: String,
    val verificationUri: String,
    val expiresInSeconds: Int,
    val intervalSeconds: Int,
)

sealed class TokenPollResult {
    data class Success(val accessToken: String) : TokenPollResult()
    object Expired : TokenPollResult()
    object AccessDenied : TokenPollResult()
    data class Error(val message: String) : TokenPollResult()
}

/** Performs an HTTP request and returns (statusCode, responseBody). Throws on network failure. */
fun interface RawHttp {
    operator fun invoke(url: String, method: String, headers: Map<String, String>, body: String?): Pair<Int, String>
}

private val httpClient: HttpClient by lazy {
    HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
}

val defaultRawHttp = RawHttp { url, method, headers, body ->
    val builder = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(10))
    headers.forEach { (k, v) -> builder.header(k, v) }
    builder.method(method, if (body != null) HttpRequest.BodyPublishers.ofString(body) else HttpRequest.BodyPublishers.noBody())
    val response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    response.statusCode() to response.body()
}

/**
 * Parse a `copilot_internal/user` response body (already decoded to a
 * `Map`) into a quota percentage. Tries four known shapes in order (newest
 * first) — see the identical fallback chain and rationale documented in
 * vscode/src/copilotQuota.ts's `parseQuotaBody`.
 */
fun parseQuotaBody(body: Map<*, *>): CopilotQuotaResult {
    fun num(v: Any?): Double? = (v as? Number)?.toDouble()
    fun pctFromLimitUsed(limit: Double, used: Double, remaining: Double?): Int {
        val rem = remaining ?: (limit - used)
        return if (limit > 0) Math.round((rem / limit) * 100).toInt() else 0
    }

    @Suppress("UNCHECKED_CAST")
    val snapshots = body["quota_snapshots"] as? Map<*, *>
    if (snapshots != null) {
        @Suppress("UNCHECKED_CAST")
        val premium = snapshots["premium_interactions"] as? Map<*, *>
        if (premium != null && premium["percent_remaining"] != null) {
            val pct = num(premium["percent_remaining"]) ?: 0.0
            return CopilotQuotaResult.Ok(Math.round(pct).toInt(), premium["unlimited"] == true)
        }
    }

    @Suppress("UNCHECKED_CAST")
    val legacyRoot = body["limited_user_quotas"] as? Map<*, *>
    if (legacyRoot != null) {
        @Suppress("UNCHECKED_CAST")
        val legacy = (legacyRoot["premium_interactions"] ?: legacyRoot["completions"]) as? Map<*, *>
        if (legacy != null) {
            val limit = num(legacy["limit"] ?: legacy["monthly_maximum"]) ?: 0.0
            val used = num(legacy["used"]) ?: 0.0
            val remaining = num(legacy["remaining"])
            return CopilotQuotaResult.Ok(pctFromLimitUsed(limit, used, remaining), false)
        }
    }

    @Suppress("UNCHECKED_CAST")
    val nested = (body["quota"] ?: body["premium_interactions"] ?: body["premium_requests"]) as? Map<*, *>
    if (nested != null) {
        val limit = num(nested["monthly_maximum"] ?: nested["maximum"] ?: nested["total"] ?: nested["limit"]) ?: 0.0
        val used = num(nested["used"]) ?: 0.0
        val remaining = num(nested["remaining"])
        return CopilotQuotaResult.Ok(pctFromLimitUsed(limit, used, remaining), false)
    }

    val flatMax = num(body["premium_requests_maximum"] ?: body["monthly_maximum_premium_requests"] ?: body["premium_requests_monthly_limit"])
    if (flatMax != null) {
        val used = num(body["premium_requests_used"]) ?: 0.0
        return CopilotQuotaResult.Ok(pctFromLimitUsed(flatMax, used, null), false)
    }

    return CopilotQuotaResult.ParseError("Unrecognized Copilot quota response shape")
}

/** Fetches the Copilot premium-quota percentage for a stored access token. */
fun fetchQuota(token: String, http: RawHttp = defaultRawHttp): CopilotQuotaResult {
    val (status, responseBody) = try {
        http(QUOTA_URL, "GET", mapOf(
            "Authorization" to "token $token",
            "Accept" to "application/json",
            "User-Agent" to "Codotchi-PyCharm",
        ), null)
    } catch (e: Exception) {
        return CopilotQuotaResult.NetworkError(e.message ?: "network error")
    }
    if (status == 401 || status == 403) return CopilotQuotaResult.Unauthorized
    if (status !in 200..299) return CopilotQuotaResult.NetworkError("HTTP $status")
    return try {
        @Suppress("UNCHECKED_CAST")
        val map = Gson().fromJson(responseBody, Map::class.java) as Map<*, *>
        parseQuotaBody(map)
    } catch (e: Exception) {
        CopilotQuotaResult.ParseError(e.message ?: "parse error")
    }
}

/** Short-lived in-memory cache — avoids re-hitting the network on every bubble click. */
object CopilotQuotaCache {
    private var cached: Pair<CopilotQuotaResult, Long>? = null

    fun get(nowMs: Long = System.currentTimeMillis(), fetch: () -> CopilotQuotaResult): CopilotQuotaResult {
        val c = cached
        if (c != null && nowMs - c.second < COPILOT_QUOTA_CACHE_TTL_MS) return c.first
        val result = fetch()
        // Only cache definitive outcomes — a transient network error shouldn't
        // be pinned in the cache for the full TTL.
        if (result is CopilotQuotaResult.Ok || result is CopilotQuotaResult.Unauthorized) {
            cached = result to nowMs
        }
        return result
    }

    fun clear() { cached = null }
}

/** PasswordSafe-backed storage for the device-flow access token. */
object CopilotQuotaToken {
    private val attributes = CredentialAttributes(generateServiceName("Codotchi", "copilotQuotaToken"))

    fun get(): String? = PasswordSafe.instance.getPassword(attributes)

    fun set(token: String) {
        PasswordSafe.instance.set(attributes, Credentials("codotchi", token))
    }

    fun clear() {
        PasswordSafe.instance.set(attributes, null)
    }
}

/**
 * GitHub OAuth Device Flow (RFC 8628) — the same flow (and the same public
 * IDE-integration client ID) used by third-party Copilot quota-monitor
 * plugins. Requires only the `read:user` scope; no admin access needed.
 */
object CopilotDeviceFlow {

    /** Requests a device code + user code from GitHub. Blocks the calling thread. */
    fun requestDeviceCode(http: RawHttp = defaultRawHttp): DeviceCodeResponse {
        val body = "client_id=$CLIENT_ID&scope=$DEVICE_SCOPE"
        val (_, responseBody) = http(DEVICE_CODE_URL, "POST", mapOf(
            "Accept" to "application/json",
            "Content-Type" to "application/x-www-form-urlencoded",
        ), body)
        @Suppress("UNCHECKED_CAST")
        val map = Gson().fromJson(responseBody, Map::class.java) as Map<*, *>
        return parseDeviceCodeResponse(map)
    }

    /**
     * Polls the token endpoint until the user authorizes, denies, or the code
     * expires. Blocks the calling thread — always call from a background task.
     */
    fun pollForToken(
        deviceCode: String,
        intervalSeconds: Int,
        expiresInSeconds: Int,
        http: RawHttp = defaultRawHttp,
        sleep: (Long) -> Unit = { Thread.sleep(it) },
        nowMs: () -> Long = { System.currentTimeMillis() },
    ): TokenPollResult {
        var interval = intervalSeconds
        val deadline = nowMs() + expiresInSeconds * 1000L
        while (nowMs() < deadline) {
            sleep(interval * 1000L)
            val body = "client_id=$CLIENT_ID&device_code=$deviceCode&grant_type=urn:ietf:params:oauth:grant-type:device_code"
            val (_, responseBody) = try {
                http(ACCESS_TOKEN_URL, "POST", mapOf(
                    "Accept" to "application/json",
                    "Content-Type" to "application/x-www-form-urlencoded",
                ), body)
            } catch (e: Exception) {
                return TokenPollResult.Error(e.message ?: "network error")
            }
            @Suppress("UNCHECKED_CAST")
            val map = try {
                Gson().fromJson(responseBody, Map::class.java) as? Map<*, *>
            } catch (_: Exception) { null } ?: continue

            when (val result = parseTokenPollResponse(map)) {
                is PollStepResult.Done -> return result.outcome
                is PollStepResult.SlowDown -> interval += 5
                is PollStepResult.Pending -> { /* keep polling */ }
            }
        }
        return TokenPollResult.Expired
    }
}

/** Pure parse of the device-code response — split out from requestDeviceCode for testability. */
fun parseDeviceCodeResponse(body: Map<*, *>): DeviceCodeResponse = DeviceCodeResponse(
    deviceCode = body["device_code"] as String,
    userCode = body["user_code"] as String,
    verificationUri = (body["verification_uri"] ?: body["verification_uri_complete"]) as String,
    expiresInSeconds = (body["expires_in"] as? Number)?.toInt() ?: 900,
    intervalSeconds = (body["interval"] as? Number)?.toInt() ?: 5,
)

private sealed class PollStepResult {
    data class Done(val outcome: TokenPollResult) : PollStepResult()
    object SlowDown : PollStepResult()
    object Pending : PollStepResult()
}

/** Pure parse of a single token-poll response — split out for testability. */
private fun parseTokenPollResponse(body: Map<*, *>): PollStepResult {
    val accessToken = body["access_token"] as? String
    if (accessToken != null) return PollStepResult.Done(TokenPollResult.Success(accessToken))

    return when (body["error"] as? String) {
        "authorization_pending" -> PollStepResult.Pending
        "slow_down" -> PollStepResult.SlowDown
        "expired_token" -> PollStepResult.Done(TokenPollResult.Expired)
        "access_denied" -> PollStepResult.Done(TokenPollResult.AccessDenied)
        else -> PollStepResult.Done(TokenPollResult.Error(body["error_description"] as? String ?: "unknown error"))
    }
}
