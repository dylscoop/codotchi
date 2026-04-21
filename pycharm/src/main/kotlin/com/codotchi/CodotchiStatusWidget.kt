package com.codotchi

import com.codotchi.engine.PetState
import com.intellij.openapi.project.Project
import com.intellij.openapi.wm.StatusBar
import com.intellij.openapi.wm.StatusBarWidget
import com.intellij.openapi.wm.StatusBarWidget.TextPresentation
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.util.Consumer
import java.awt.event.MouseEvent

/**
 * CodotchiStatusWidget — displays a compact pet summary in the IDE status bar.
 *
 * Shows the pet's stage emoji and name, e.g. "🥚 Gotchi".
 * [update] is called by [CodotchiPlugin.broadcastState] after every state change.
 */
class CodotchiStatusWidget(private val project: Project) : StatusBarWidget, TextPresentation {

    private var statusBar: StatusBar? = null

    @Volatile private var text: String = "🥚 Gotchi"
    @Volatile private var tooltip: String = "vscode_codotchi"

    companion object {
        const val ID = "CodotchiStatusWidget"

        private val STAGE_EMOJI = mapOf(
            "egg"    to "🥚",
            "baby"   to "🐣",
            "child"  to "🐥",
            "teen"   to "🐦",
            "adult"  to "🦜",
            "senior" to "🦅",
        )
    }

    // ── StatusBarWidget ────────────────────────────────────────────────────

    override fun ID(): String = ID

    override fun getPresentation(): StatusBarWidget.WidgetPresentation = this

    override fun install(statusBar: StatusBar) {
        this.statusBar = statusBar
    }

    override fun dispose() {
        statusBar = null
    }

    // ── TextPresentation ───────────────────────────────────────────────────

    override fun getText(): String = text

    override fun getTooltipText(): String = tooltip

    override fun getAlignment(): Float = 0f

    override fun getClickConsumer(): Consumer<MouseEvent> = Consumer { _ ->
        ToolWindowManager.getInstance(project).getToolWindow("Codotchi")?.activate(null)
    }

    // ── State update ───────────────────────────────────────────────────────

    fun update(state: PetState) {
        val emoji = STAGE_EMOJI[state.stage] ?: "🥚"
        text    = "$emoji ${state.name}"
        tooltip = "${state.name} | ${state.stage} | mood: ${state.mood} | health: ${state.health} | weight: ${state.weight}"
        statusBar?.updateWidget(ID())
    }
}
