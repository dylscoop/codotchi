package com.codotchi

import com.codotchi.engine.PetState
import com.intellij.openapi.diagnostic.Logger
import com.intellij.util.concurrency.AppExecutorUtil
import java.util.concurrent.TimeUnit

/**
 * Desktop (OS) notifications when hunger, happiness or energy hits 0, or health
 * drops below [HEALTH_ALERT_THRESHOLD]. Mirrors VS Code's `criticalStatNotifier.ts`.
 *
 * A notification fires when any stat newly becomes critical, or when a stat has
 * stayed critical for [CRITICAL_STAT_NOTIFY_REPEAT_MS] since its last
 * notification. The message lists every critical stat, and all of their timers
 * restart together so one notification covers them. A stat that recovers is
 * dropped from the tracker; a dead pet clears it.
 *
 * Delivery shells out to the OS notifier (PowerShell WinRT toast / osascript /
 * notify-send) like VS Code does — IntelliJ's SystemNotifications showed nothing
 * on Windows. Title and body travel as environment variables, never inside the
 * script, because the pet name is user-controlled.
 */
object CriticalStatNotifier {

    private val log = Logger.getInstance(CriticalStatNotifier::class.java)

    /** These stats are critical once they hit 0. */
    val ZERO_ALERT_STATS = listOf("hunger", "happiness", "energy")

    /** Health strictly below this value is critical. */
    const val HEALTH_ALERT_THRESHOLD = 25

    /** While a stat stays critical, re-notify this often. */
    const val CRITICAL_STAT_NOTIFY_REPEAT_MS = 15 * 60_000L

    val CRITICAL_STATS = ZERO_ALERT_STATS + "health"

    /** True when this stat's value should raise a desktop alert. */
    fun isCritical(stat: String, value: Int): Boolean =
        if (stat == "health") value < HEALTH_ALERT_THRESHOLD else value <= 0

    data class Result(val message: String?, val tracker: Map<String, Long>)

    fun evaluate(state: PetState, tracker: Map<String, Long>, nowMs: Long): Result {
        if (!state.alive) return Result(null, emptyMap())
        val values = mapOf(
            "hunger" to state.hunger,
            "happiness" to state.happiness,
            "energy" to state.energy,
            "health" to state.health,
        )
        val critical = CRITICAL_STATS.filter { isCritical(it, values.getValue(it)) }
        val due = critical.any { stat ->
            val last = tracker[stat]
            last == null || nowMs - last >= CRITICAL_STAT_NOTIFY_REPEAT_MS
        }
        val next = critical.associateWith { if (due) nowMs else tracker.getValue(it) }
        if (!due) return Result(null, next)
        val parts = critical.joinToString(", ") { "$it ${values.getValue(it)}" }
        return Result("${state.name} needs you — $parts", next)
    }

    // ── OS delivery ────────────────────────────────────────────────────────

    /** AppUserModelID registered by Windows PowerShell; lets an unpackaged script raise a toast. */
    private const val WINDOWS_TOAST_APP_ID = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe"

    private val WINDOWS_TOAST_SCRIPT = listOf(
        "\$ErrorActionPreference = 'Stop'",
        "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
        "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
        "\$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
        "\$text = \$xml.GetElementsByTagName('text')",
        "\$text.Item(0).AppendChild(\$xml.CreateTextNode(\$env:CODOTCHI_TITLE)) | Out-Null",
        "\$text.Item(1).AppendChild(\$xml.CreateTextNode(\$env:CODOTCHI_BODY)) | Out-Null",
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('$WINDOWS_TOAST_APP_ID').Show([Windows.UI.Notifications.ToastNotification]::new(\$xml))",
    ).joinToString("; ")

    data class OsCommand(val command: List<String>, val env: Map<String, String>)

    /** Build the OS notifier invocation for an `os.name` value, or null when unsupported. */
    fun osNotificationCommand(osName: String, title: String, body: String): OsCommand? {
        val env = mapOf("CODOTCHI_TITLE" to title, "CODOTCHI_BODY" to body)
        val os = osName.lowercase()
        return when {
            os.startsWith("windows") ->
                OsCommand(listOf("powershell.exe", "-NoProfile", "-NonInteractive", "-Command", WINDOWS_TOAST_SCRIPT), env)
            os.startsWith("mac") ->
                OsCommand(listOf("osascript", "-e",
                    "display notification (system attribute \"CODOTCHI_BODY\") with title (system attribute \"CODOTCHI_TITLE\")"), env)
            os.contains("linux") || os.contains("bsd") ->
                OsCommand(listOf("notify-send", "--app-name=Codotchi", title, body), env)
            else -> null
        }
    }

    /** Fire-and-forget desktop notification on a pooled thread. Failures are only logged. */
    fun sendOsNotification(title: String, body: String) {
        val cmd = osNotificationCommand(System.getProperty("os.name") ?: "", title, body) ?: return
        AppExecutorUtil.getAppExecutorService().execute {
            try {
                val pb = ProcessBuilder(cmd.command).redirectErrorStream(true)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                pb.environment().putAll(cmd.env)
                val process = pb.start()
                if (!process.waitFor(15, TimeUnit.SECONDS)) {
                    process.destroyForcibly()
                    log.warn("Codotchi desktop notification timed out")
                } else if (process.exitValue() != 0) {
                    log.warn("Codotchi desktop notification exited with ${process.exitValue()}")
                }
            } catch (e: Exception) {
                log.warn("Codotchi desktop notification failed", e)
            }
        }
    }
}
