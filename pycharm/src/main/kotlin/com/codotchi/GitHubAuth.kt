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
