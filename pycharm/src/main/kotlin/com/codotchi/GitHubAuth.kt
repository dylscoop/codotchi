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

/**
 * OAuth scopes the leaderboard sign-in asks for. `notifications` lets us
 * unsubscribe from the issues we open (GraphQL updateSubscription accepts no
 * other scope). Mirrors LEADERBOARD_GITHUB_SCOPES in vscode/src/sidebarProvider.ts.
 */
const val LEADERBOARD_OAUTH_SCOPE = "public_repo notifications"

/**
 * True when GitHub's `X-OAuth-Scopes` header shows a token from before
 * `notifications` was added; such tokens are treated as expired so the user
 * signs in again. A missing header (not an OAuth token) is not flagged.
 */
fun lacksLeaderboardScopes(oauthScopesHeader: String?): Boolean {
    if (oauthScopesHeader == null) return false
    val granted = oauthScopesHeader.split(",").map { it.trim() }
    return "notifications" !in granted
}

/** [lacksLeaderboardScopes] for an already-executed connection. */
fun HttpURLConnection.lacksLeaderboardScopes(): Boolean =
    lacksLeaderboardScopes(getHeaderField("X-OAuth-Scopes"))

/** User-facing message for a failed OAuth device-flow token poll `error` code. */
fun describeDeviceFlowError(error: String?): String = when (error) {
    "access_denied" -> "GitHub sign-in was cancelled."
    "expired_token" -> "GitHub sign-in code expired — try again."
    null            -> "GitHub sign-in timed out — try again."
    else            -> "GitHub sign-in failed ($error) — try again."
}
