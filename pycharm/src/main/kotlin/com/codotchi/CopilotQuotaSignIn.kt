package com.codotchi

import com.intellij.ide.BrowserUtil
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.progress.ProgressIndicator
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.progress.Task
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection

private fun notifyCopilotQuota(message: String, type: NotificationType) {
    val group = NotificationGroupManager.getInstance().getNotificationGroup("Codotchi Copilot Quota") ?: return
    group.createNotification(message, type).notify(null)
}

/**
 * "Codotchi: Sign in to GitHub (Copilot Quota)" — Tools menu action.
 *
 * Runs the GitHub OAuth Device Flow as a cancellable background task: request
 * a device code, surface it to the user (clipboard + notification + browser),
 * then poll until the user authorizes, denies, or the code expires. The
 * resulting token is stored via [CopilotQuotaToken] (PasswordSafe) — no PAT,
 * no org billing-admin access required.
 */
class CopilotSignInAction : AnAction("Codotchi: Sign in to GitHub (Copilot Quota)") {
    override fun actionPerformed(e: AnActionEvent) {
        ProgressManager.getInstance().run(object : Task.Backgroundable(e.project, "Signing in to GitHub for Copilot quota", true) {
            override fun run(indicator: ProgressIndicator) {
                val device = try {
                    CopilotDeviceFlow.requestDeviceCode()
                } catch (ex: Exception) {
                    notifyCopilotQuota("Codotchi: could not start GitHub sign-in (${ex.message ?: "network error"}).", NotificationType.ERROR)
                    return
                }

                // Best-effort UX niceties — sign-in still works if either fails.
                try {
                    Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(device.userCode), null)
                } catch (_: Exception) { /* clipboard unavailable — user can still read the code from the notification */ }
                notifyCopilotQuota(
                    "Codotchi: enter code ${device.userCode} at ${device.verificationUri} (copied to clipboard). Opening browser...",
                    NotificationType.INFORMATION,
                )
                BrowserUtil.browse(device.verificationUri)

                indicator.text = "Waiting for GitHub authorization..."
                when (val result = CopilotDeviceFlow.pollForToken(device.deviceCode, device.intervalSeconds, device.expiresInSeconds)) {
                    is TokenPollResult.Success -> {
                        CopilotQuotaToken.set(result.accessToken)
                        CopilotQuotaCache.clear()
                        notifyCopilotQuota("Codotchi: signed in to GitHub — Copilot quota is now available.", NotificationType.INFORMATION)
                    }
                    is TokenPollResult.Expired -> notifyCopilotQuota("Codotchi: GitHub sign-in code expired before it was used.", NotificationType.WARNING)
                    is TokenPollResult.AccessDenied -> notifyCopilotQuota("Codotchi: GitHub sign-in was denied.", NotificationType.WARNING)
                    is TokenPollResult.Error -> notifyCopilotQuota("Codotchi: GitHub sign-in failed (${result.message}).", NotificationType.ERROR)
                }
            }
        })
    }
}

/** "Codotchi: Sign out (Copilot Quota)" — Tools menu action. */
class CopilotSignOutAction : AnAction("Codotchi: Sign out (Copilot Quota)") {
    override fun actionPerformed(e: AnActionEvent) {
        CopilotQuotaToken.clear()
        CopilotQuotaCache.clear()
        notifyCopilotQuota("Codotchi: signed out of GitHub Copilot quota.", NotificationType.INFORMATION)
    }
}
