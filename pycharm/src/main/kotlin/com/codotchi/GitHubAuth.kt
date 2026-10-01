package com.codotchi

import java.net.HttpURLConnection

/**
 * GitHubAuth.kt
 *
 * Classifies GitHub API responses for the leaderboard sign-in (BUG-S08).
 * Mirrors `isAuthFailure` in vscode/src/githubAuth.ts: 401 always means the
 * stored token is dead; 403 does too unless it is a (secondary) rate limit,
 * which GitHub also reports as 403 and which must not wipe a valid token.
 */
fun isGithubAuthFailure(status: Int, rateLimitRemaining: String?, retryAfter: String?): Boolean {
    if (status == 401) return true
    if (status != 403) return false
    return rateLimitRemaining != "0" && retryAfter.isNullOrEmpty()
}

/** [isGithubAuthFailure] for an already-executed connection. */
fun HttpURLConnection.isGithubAuthFailure(): Boolean =
    isGithubAuthFailure(responseCode, getHeaderField("X-RateLimit-Remaining"), getHeaderField("Retry-After"))

/** User-facing message for a failed OAuth device-flow token poll `error` code. */
fun describeDeviceFlowError(error: String?): String = when (error) {
    "access_denied" -> "GitHub sign-in was cancelled."
    "expired_token" -> "GitHub sign-in code expired — try again."
    null            -> "GitHub sign-in timed out — try again."
    else            -> "GitHub sign-in failed ($error) — try again."
}

/**
 * User-facing message for a non-200 device-code request. Surfaces GitHub's
 * `error_description` (or `error`) from the JSON body so failures such as
 * `device_flow_disabled` are diagnosable instead of a bare status code.
 */
fun describeDeviceCodeFailure(status: Int, body: String?): String {
    val detail = try {
        @Suppress("UNCHECKED_CAST")
        val map = com.google.gson.Gson().fromJson(body, Map::class.java) as? Map<String, Any?>
        (map?.get("error_description") as? String) ?: (map?.get("error") as? String)
    } catch (_: Exception) { null }
    return if (detail.isNullOrBlank()) "Could not start GitHub sign-in (HTTP $status)."
    else "Could not start GitHub sign-in (HTTP $status: $detail)."
}

/** Response body of an executed connection — the error stream for non-2xx statuses. */
fun HttpURLConnection.readBodyText(): String? =
    (if (responseCode >= 400) errorStream else inputStream)?.bufferedReader()?.use { it.readText() }
