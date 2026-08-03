package com.codotchi

import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.codotchi.engine.PetState
import java.net.URLEncoder

private const val LEADERBOARD_REPO_OWNER = "dylscoop"
private const val LEADERBOARD_REPO_NAME  = "codotchi"
const val LEADERBOARD_PAGES_URL = "https://$LEADERBOARD_REPO_OWNER.github.io/$LEADERBOARD_REPO_NAME/leaderboard/"
private const val LEADERBOARD_ISSUE_URL  = "https://github.com/$LEADERBOARD_REPO_OWNER/$LEADERBOARD_REPO_NAME/issues/new"

/**
 * Builds a GitHub issue-creation URL pre-filled with the leaderboard score data.
 * The user authenticates via their browser; the GitHub Actions workflow reads
 * `issue.user.login` as the authoritative GitHub username.
 */
fun buildLeaderboardIssueUrl(state: PetState, diedAt: Long): String {
    val title = "[Leaderboard] ${state.name} (${state.petType}) lived ${state.ageDays}d"
    val json = """
        {
          "schemaVersion": 1,
          "petName": "${state.name.replace("\"", "\\\"")}",
          "ageDays": ${state.ageDays},
          "stage": "${state.stage}",
          "petType": "${state.petType}",
          "spawnedAt": ${state.spawnedAt},
          "diedAt": $diedAt
        }
    """.trimIndent()
    val body = "Leaderboard submission.\n\n```json\n$json\n```"
    val enc = { s: String -> URLEncoder.encode(s, "UTF-8") }
    return "$LEADERBOARD_ISSUE_URL?title=${enc(title)}&body=${enc(body)}&labels=${enc("leaderboard-submission")}"
}

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
