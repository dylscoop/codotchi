package com.codotchi

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener

/**
 * CodotchiTabSwitchListener — project-level listener that updates the idle
 * timer when the active editor tab changes, respecting the
 * [CodotchiSettings.idleResetOnTabSwitch] and [CodotchiSettings.aiMode] settings.
 *
 * Registered as a project listener in plugin.xml so IntelliJ injects it for
 * every open project.
 */
class CodotchiTabSwitchListener : FileEditorManagerListener {

    override fun selectionChanged(event: FileEditorManagerEvent) {
        val settings = service<CodotchiSettings>()
        if (!settings.aiMode && settings.idleResetOnTabSwitch) {
            ApplicationManager.getApplication().service<CodotchiPlugin>()
                .markActivity()
        }
    }
}
