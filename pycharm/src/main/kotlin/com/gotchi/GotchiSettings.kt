package com.gotchi

import com.intellij.openapi.components.*

/**
 * GotchiSettings — persisted display preferences for the Gotchi tool window.
 *
 * Stored in gotchi_settings.xml (separate from game state in gotchi.xml).
 * Fields:
 *  - [fontSize]               : "small" | "normal" | "large"  — maps to CSS body class
 *  - [textColor]              : CSS hex colour string           — injected as body colour override
 *  - [enableAttentionCalls]   : whether to show balloon notifications for attention calls
 *  - [idleThresholdSeconds]   : seconds of no IDE activity before idle mode (default 60)
 *  - [idleDeepThresholdSeconds]: seconds of sustained idle before deep-idle mode (default 600)
 */
@State(
    name = "GotchiSettings",
    storages = [Storage("gotchi_settings.xml")]
)
@Service(Service.Level.APP)
class GotchiSettings : PersistentStateComponent<GotchiSettings.State> {

    /** Plain bean-style class required by IntelliJ's XmlSerializer. */
    class State {
        var fontSize:  String  = "normal"    // "small" | "normal" | "large"
        var textColor: String  = "#cccccc"   // any CSS hex colour
        var enableAttentionCalls: Boolean = true
        var idleThresholdSeconds: Int = 60
        var idleDeepThresholdSeconds: Int = 600
    }

    private var _state = State()

    override fun getState(): State = _state

    override fun loadState(state: State) {
        _state = state
    }

    var fontSize: String
        get() = _state.fontSize
        set(v) { _state.fontSize = v }

    var textColor: String
        get() = _state.textColor
        set(v) { _state.textColor = v }

    var enableAttentionCalls: Boolean
        get() = _state.enableAttentionCalls
        set(v) { _state.enableAttentionCalls = v }

    var idleThresholdSeconds: Int
        get() = _state.idleThresholdSeconds
        set(v) { _state.idleThresholdSeconds = v }

    var idleDeepThresholdSeconds: Int
        get() = _state.idleDeepThresholdSeconds
        set(v) { _state.idleDeepThresholdSeconds = v }
}
