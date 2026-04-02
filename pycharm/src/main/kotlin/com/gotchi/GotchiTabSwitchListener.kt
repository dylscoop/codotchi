package com.gotchi

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.fileEditor.FileEditorManagerEvent
import com.intellij.openapi.fileEditor.FileEditorManagerListener

/**
 * GotchiTabSwitchListener — project-level listener that updates the idle
 * timer when the active editor tab changes, respecting the
 * [GotchiSettings.idleResetOnTabSwitch] and [GotchiSettings.aiMode] settings.
 *
 * Registered as a project listener in plugin.xml so IntelliJ injects it for
 * every open project.
 */
class GotchiTabSwitchListener : FileEditorManagerListener {

    override fun selectionChanged(event: FileEditorManagerEvent) {
        val settings = service<GotchiSettings>()
        if (!settings.aiMode && settings.idleResetOnTabSwitch) {
            ApplicationManager.getApplication().service<GotchiPlugin>()
                .markActivity()
        }
    }
}
