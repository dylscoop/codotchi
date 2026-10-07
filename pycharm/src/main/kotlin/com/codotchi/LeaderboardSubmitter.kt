package com.codotchi

import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.codotchi.engine.PetState
import com.google.gson.GsonBuilder
import com.google.gson.JsonObject

private const val LEADERBOARD_REPO_OWNER = "dylscoop"
private const val LEADERBOARD_REPO_NAME  = "codotchi"
const val LEADERBOARD_PAGES_URL = "https://$LEADERBOARD_REPO_OWNER.github.io/$LEADERBOARD_REPO_NAME/leaderboard/"
const val GITHUB_SIGN_IN_HELP_URL = "https://github.com/$LEADERBOARD_REPO_OWNER/$LEADERBOARD_REPO_NAME/blob/main/pycharm/README.md#github-sign-in-help"

private val payloadGson = GsonBuilder().disableHtmlEscaping().create()
private val prettyPayloadGson = GsonBuilder().disableHtmlEscaping().setPrettyPrinting().create()

/**
 * Body of a signed [Leaderboard] issue for a dead pet (schemaVersion 2) — the same
 * fenced JSON block VS Code posts. The workflow rejects any issue whose signature
 * doesn't match, so hand-written issues never land.
 */
fun buildScoreIssueBody(
    state: PetState, username: String, diedAt: Long, clientVersion: String,
    key: String = Integrity.buildKey,
): String {
    val sig = Integrity.signSubmission(
        Integrity.SignedSubmission(
            kind = "score", githubUsername = username, petName = state.name,
            ageDays = state.ageDays.toDouble(), stage = state.stage, petType = state.petType,
            spawnedAt = state.spawnedAt, at = diedAt, petRunId = "", clientVersion = clientVersion,
        ),
        key,
    )
    val json = JsonObject().apply {
        addProperty("schemaVersion", 2)
        addProperty("githubUsername", username)
        addProperty("petName", state.name)
        addProperty("ageDays", state.ageDays)
        addProperty("stage", state.stage)
        addProperty("petType", state.petType)
        addProperty("spawnedAt", state.spawnedAt)
        addProperty("diedAt", diedAt)
        addProperty("clientVersion", clientVersion)
        addProperty("sig", sig)
    }
    return "Leaderboard submission.\n\n```json\n${prettyPayloadGson.toJson(json)}\n```"
}

/** Body of a signed [Live] issue (schemaVersion 2) — same fields as VS Code's live entry. */
fun buildLiveEntryJson(
    state: PetState, username: String, petRunId: String, updatedAt: Long, clientVersion: String,
    key: String = Integrity.buildKey,
): String {
    val sig = Integrity.signSubmission(
        Integrity.SignedSubmission(
            kind = "live", githubUsername = username, petName = state.name,
            ageDays = state.ageDays.toDouble(), stage = state.stage, petType = state.petType,
            spawnedAt = state.spawnedAt, at = updatedAt, petRunId = petRunId, clientVersion = clientVersion,
        ),
        key,
    )
    val json = JsonObject().apply {
        addProperty("schemaVersion", 2)
        addProperty("username", username)
        addProperty("petName", state.name)
        addProperty("petRunId", petRunId)
        addProperty("spawnedAt", state.spawnedAt)
        addProperty("ageDays", state.ageDays)
        addProperty("stage", state.stage)
        addProperty("petType", state.petType)
        addProperty("updatedAt", updatedAt)
        addProperty("clientVersion", clientVersion)
        addProperty("sig", sig)
    }
    return payloadGson.toJson(json)
}

/** JSON string literal (quoted and escaped) for [value], or `null`. */
fun jsonStringOrNull(value: String?): String = if (value == null) "null" else payloadGson.toJson(value)

private fun notifyLeaderboard(message: String, type: NotificationType) {
    val group = NotificationGroupManager.getInstance().getNotificationGroup("Codotchi Leaderboard") ?: return
    group.createNotification(message, type).notify(null)
}

/** "Codotchi: View Leaderboard" — Tools menu action. */
class ViewLeaderboardAction : AnAction("Codotchi: View Leaderboard") {
    override fun actionPerformed(e: AnActionEvent) {
        BrowserUtil.browse(LEADERBOARD_PAGES_URL)
    }
}
