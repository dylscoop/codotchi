package com.codotchi

import com.intellij.icons.AllIcons
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.components.service

/**
 * CodotchiRefreshAction — reloads pet state from the shared on-disk file and
 * pushes the result to the tool window.
 *
 * This is a manual fallback for when the automatic file-watcher fails to fire
 * (e.g. multiple PyCharm windows open simultaneously, or the JVM WatchService
 * misses a rapid atomic-replace write from another window).
 *
 * The action appears as a refresh icon in the Codotchi tool window title bar
 * (registered via plugin.xml <group> → <action>).
 */
class CodotchiRefreshAction : AnAction(
    "Refresh",
    "Reload pet state from disk (sync with other open windows)",
    AllIcons.Actions.Refresh,
) {

    override fun actionPerformed(e: AnActionEvent) {
        service<CodotchiPlugin>().reloadFromDisk()
    }
}
