package com.codotchi

import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidgetFactory

/**
 * CodotchiStatusWidgetFactory — creates [CodotchiStatusWidget] instances and
 * registers them with [CodotchiPlugin] so state broadcasts reach the widget.
 */
class CodotchiStatusWidgetFactory : StatusBarWidgetFactory {

    override fun getId(): String = CodotchiStatusWidget.ID

    override fun getDisplayName(): String = "Codotchi"

    override fun isAvailable(project: Project): Boolean = true

    override fun createWidget(project: Project): StatusBarWidget {
        val widget = CodotchiStatusWidget(project)
        service<CodotchiPlugin>().setStatusWidget(widget)
        return widget
    }

    override fun disposeWidget(widget: StatusBarWidget) {
        widget.dispose()
    }

    override fun canBeEnabledOn(statusBar: StatusBar): Boolean = true
}
