package com.gotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.ToolWindow
import com.intellij.openapi.wm.ToolWindowFactory
import com.intellij.ui.content.ContentFactory

/**
 * GotchiToolWindow — creates the browser panel and registers it as the
 * "Gotchi" tool-window content.
 *
 * Called by IntelliJ when the tool window is first shown.  We create a fresh
 * [GotchiBrowserPanel], register it with [GotchiPlugin] so state broadcasts
 * reach it, then add its Swing component as the only tool-window content.
 */
class GotchiToolWindow : ToolWindowFactory {

    override fun createToolWindowContent(project: Project, toolWindow: ToolWindow) {
        val plugin = service<GotchiPlugin>()

        val panel = GotchiBrowserPanel(
            messageHandler    = { message -> plugin.handleCommand(message) },
            parentDisposable  = toolWindow.disposable,
            onReady           = { plugin.broadcastState() },
        )

        plugin.setBrowserPanel(panel)

        val content = ContentFactory.getInstance()
            .createContent(panel.component, "", false)
        toolWindow.contentManager.addContent(content)
    }
}
