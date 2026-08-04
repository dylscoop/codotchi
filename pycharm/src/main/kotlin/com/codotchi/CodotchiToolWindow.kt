package com.codotchi

import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.ActionManager
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.wm.ex.ToolWindowManagerListener
import com.intellij.ui.jcef.JBCefApp
import com.intellij.ui.content.ContentFactory
import javax.swing.JLabel
import javax.swing.SwingConstants

/**
 * CodotchiToolWindow — creates the browser panel and registers it as the
 * "Codotchi" tool-window content.
 *
 * Called by IntelliJ when the tool window is first shown.  We create a fresh
 * [CodotchiBrowserPanel], register it with [CodotchiPlugin] so state broadcasts
 * reach it, then add its Swing component as the only tool-window content.
 *
 * A gear icon is added to the tool-window title bar so users can open the
 * Codotchi settings page (Settings → Tools → Codotchi) without navigating
 * through the IDE settings menu manually.
 *
 * Visibility tracking: a [ToolWindowManagerListener] on the project message bus
 * fires on every tool window state change via [ToolWindowManagerListener.stateChanged].
 * When the Codotchi tool window transitions to hidden the pet is pushed into deep
 * idle immediately; when it becomes visible again activity is reset so the pet
 * exits deep idle right away.
 */
class CodotchiToolWindow : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val plugin = service<CodotchiPlugin>()

        // Guard: JCEF (the embedded Chromium browser used to render the pet panel)
        // must be available.  It is on by default in 2024.1+ with the JetBrains
        // Runtime, but can be absent if the user switched to a non-JCEF JBR.
        // Without this check the plugin silently shows a blank panel with no
        // diagnostic message.
        //
        // In PyCharm 2026.2+ (build 262) JCEF was extracted into a separate
        // bundled plugin (com.intellij.modules.jcef).  We declare it as an
        // optional dependency in plugin.xml so the classes are visible when it
        // is present, but the JBCefApp reference below must still be guarded
        // with a try/catch for ClassNotFoundException / NoClassDefFoundError to
        // prevent an EDT crash on environments where JCEF is absent at runtime
        // (e.g. a non-JCEF JBR or an IDE build that strips the jcef-plugin).
        val jcefSupported: Boolean = try {
            JBCefApp.isSupported()
        } catch (e: ClassNotFoundException) {
            false
        } catch (e: NoClassDefFoundError) {
            false
        }
        if (!jcefSupported) {
            val msg = "<html><body style='padding:12px; font-family:sans-serif;'>" +
                "<b>Codotchi requires JCEF to render the pet panel.</b><br><br>" +
                "Your IDE is currently running on a JetBrains Runtime without JCEF support.<br><br>" +
                "To fix this:<br>" +
                "1. Open <b>Help → Find Action</b> (Shift+Ctrl+A / ⇧⌘A)<br>" +
                "2. Search for <b>Choose Boot Java Runtime for the IDE</b><br>" +
                "3. Select a runtime with <b>JCEF</b> in the name<br>" +
                "4. Restart the IDE<br><br>" +
                "Codotchi will appear here after restarting with a JCEF-enabled runtime." +
                "</body></html>"
            val label = JLabel(msg, SwingConstants.LEFT)
            label.verticalAlignment = SwingConstants.TOP
            val content = ContentFactory.getInstance().createContent(label, "", false)
            toolWindow.contentManager.addContent(content)
            return
        }

        val panel = CodotchiBrowserPanel(
            messageHandler    = { message -> plugin.handleCommand(message) },
            parentDisposable  = toolWindow.disposable,
            // Webview loads fresh with an empty snackItems[] — zero the floor
            // counter before broadcasting so the engine stays in sync (BUGFIX-NNN).
            onReady           = { plugin.resetFloorSnacks(); plugin.broadcastState() },
        )

        plugin.setBrowserPanel(panel)

        // Unregister when the tool window is closed / project is disposed so the
        // orphaned panel is not held in the list indefinitely (BUGFIX-096).
        Disposer.register(toolWindow.disposable) {
            plugin.unregisterBrowserPanel(panel)
        }

        val content = ContentFactory.getInstance()
            .createContent(panel.component, "", false)
        toolWindow.contentManager.addContent(content)

        // Deep-idle on panel hide: subscribe to ToolWindowManagerListener so we
        // get notified on every tool window state change.  stateChanged() is the
        // sole abstract method (no-arg) and fires for all tool windows; we filter
        // to our own window by ID and check isVisible on the ToolWindow object.
        // On hide → push lastActivityTime back by the deep-idle threshold.
        // On show → reset activity so the pet exits deep idle immediately.
        val conn = project.messageBus.connect(toolWindow.disposable)
        conn.subscribe(
            ToolWindowManagerListener.TOPIC,
            object : ToolWindowManagerListener {
                override fun stateChanged() {
                    val tw = ToolWindowManager.getInstance(project).getToolWindow(toolWindow.id)
                        ?: return
                    if (tw.isVisible) {
                        plugin.markActivity()
                    } else {
                        plugin.markDeepIdle()
                    }
                }
            }
        )

        // Title bar actions: Refresh + Pause/Resume + Settings gear.
        // Both are wired here via the supported setTitleActions() API.
        // The CodotchiToolWindowToolbar XML group was removed in 2.17.4 because
        // the platform group "ToolWindowToolbar" it relied on was removed in
        // PyCharm 2026.x, causing a PluginException on load.
        val refreshAction = ActionManager.getInstance().getAction("com.codotchi.Refresh")
        val pauseAction = object : AnAction() {
            override fun actionPerformed(e: AnActionEvent) {
                plugin.handleCommand(mapOf("command" to "pause"))
            }
            override fun update(e: AnActionEvent) {
                if (plugin.isPaused()) {
                    e.presentation.icon = AllIcons.Actions.Execute
                    e.presentation.text = "Resume game"
                } else {
                    e.presentation.icon = AllIcons.Actions.Pause
                    e.presentation.text = "Pause game"
                }
            }
            override fun getActionUpdateThread() =
                com.intellij.openapi.actionSystem.ActionUpdateThread.BGT
        }
        val settingsAction = object : AnAction("Codotchi Settings", "Open Codotchi settings", AllIcons.General.Settings) {
            override fun actionPerformed(e: AnActionEvent) {
                ShowSettingsUtil.getInstance()
                    .showSettingsDialog(project, CodotchiConfigurable::class.java)
            }
        }
        toolWindow.setTitleActions(listOfNotNull(refreshAction, pauseAction, settingsAction))
    }
}

