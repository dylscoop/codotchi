package com.gotchi

import com.intellij.openapi.components.*

/**
 * GotchiSettings — persisted display preferences for the Gotchi tool window.
 *
 * Stored in gotchi_settings.xml (separate from game state in gotchi.xml).
 * Fields:
 *  - [fontSize]  : "small" | "normal" | "large"  — maps to CSS body class
 *  - [textColor] : CSS hex colour string           — injected as body colour override
 */
@State(
    name = "GotchiSettings",
    storages = [Storage("gotchi_settings.xml")]
)
@Service(Service.Level.APP)
class GotchiSettings : PersistentStateComponent<GotchiSettings.State> {

    /** Plain bean-style class required by IntelliJ's XmlSerializer. */
    class State {
        var fontSize:  String = "normal"    // "small" | "normal" | "large"
        var textColor: String = "#cccccc"   // any CSS hex colour
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
}
