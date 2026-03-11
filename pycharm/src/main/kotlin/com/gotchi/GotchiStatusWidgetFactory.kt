package com.gotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory

/**
 * GotchiStatusWidgetFactory — creates [GotchiStatusWidget] instances and
 * registers them with [GotchiPlugin] so state broadcasts reach the widget.
 */
class GotchiStatusWidgetFactory : StatusBarWidgetFactory {

    override fun getId(): String = GotchiStatusWidget.ID

    override fun getDisplayName(): String = "Gotchi"

    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget {
        val widget = GotchiStatusWidget(project)
        service<GotchiPlugin>().setStatusWidget(widget)
        return widget
    }

    override fun disposeWidget(widget: StatusBarWidget) {
        widget.dispose()
    }

    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true
}
