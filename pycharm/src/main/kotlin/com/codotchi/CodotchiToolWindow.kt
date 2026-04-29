package com.codotchi

import com.intellij.icons.AllIcons
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
import com.intellij.ui.content.ContentFactory

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

        val panel = CodotchiBrowserPanel(
            messageHandler    = { message -> plugin.handleCommand(message) },
            parentDisposable  = toolWindow.disposable,
            onReady           = { plugin.broadcastState() },
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

        // Gear icon in the tool-window title bar → opens Settings > Tools > Codotchi
        toolWindow.setTitleActions(listOf(
            object : AnAction("Codotchi Settings", "Open Codotchi settings", AllIcons.General.Settings) {
                override fun actionPerformed(e: AnActionEvent) {
                    ShowSettingsUtil.getInstance()
                        .showSettingsDialog(project, CodotchiConfigurable::class.java)
                }
            }
        ))
    }
}

