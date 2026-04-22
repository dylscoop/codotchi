package com.codotchi

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.ui.DialogWrapper
import javax.swing.JComponent

/**
 * OpenSpritePreviewAction — opens the Codotchi Sprite Preview gallery
 * in a JCEF dialog.  Only enabled when developer mode is active.
 */
class OpenSpritePreviewAction : AnAction("Codotchi: Open Sprite Preview (Dev)") {

    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return
        SpritePreviewDialog(e).show()
    }

    override fun update(e: AnActionEvent) {
        val settings = ApplicationManager.getApplication().getService(CodotchiSettings::class.java)
        val devMode  = (settings?.devModeEnabled == true) && (settings.developerPasscode == "1234")
        e.presentation.isEnabledAndVisible = devMode
    }

    // ── Inner dialog ───────────────────────────────────────────────────────

    private class SpritePreviewDialog(e: AnActionEvent) : DialogWrapper(e.project, true) {

        private val panel = SpritePreviewBrowserPanel(disposable)

        init {
            title = "Codotchi Sprite Preview"
            setSize(1100, 820)
            init()
        }

        override fun createCenterPanel(): JComponent = panel.component

        override fun createActions() = arrayOf(okAction)
    }
}
