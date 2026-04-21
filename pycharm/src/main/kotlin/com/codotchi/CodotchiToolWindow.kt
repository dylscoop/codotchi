package com.codotchi

import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * CodotchiToolWindow — creates the browser panel and registers it as the
 * "Gotchi" tool-window content.
 *
 * Called by IntelliJ when the tool window is first shown.  We create a fresh
 * [CodotchiBrowserPanel], register it with [CodotchiPlugin] so state broadcasts
 * reach it, then add its Swing component as the only tool-window content.
 *
 * A gear icon is added to the tool-window title bar so users can open the
 * Gotchi settings page (Settings → Tools → Gotchi) without navigating
 * through the IDE settings menu manually.
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

        val content = ContentFactory.getInstance()
            .createContent(panel.component, "", false)
        toolWindow.contentManager.addContent(content)

        // Gear icon in the tool-window title bar → opens Settings > Tools > Gotchi
        toolWindow.setTitleActions(listOf(
            object : AnAction("Gotchi Settings", "Open Gotchi settings", AllIcons.General.Settings) {
                override fun actionPerformed(e: AnActionEvent) {
                    ShowSettingsUtil.getInstance()
                        .showSettingsDialog(project, CodotchiConfigurable::class.java)
                }
            }
        ))
    }
}

