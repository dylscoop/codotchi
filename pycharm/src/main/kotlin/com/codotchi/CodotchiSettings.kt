package com.codotchi

import com.intellij.openapi.components.*

/**
 * CodotchiSettings — persisted display preferences for the Gotchi tool window.
 *
 * Stored in codotchi_settings.xml (separate from game state in codotchi.xml).
 * Fields:
 *  - [fontSize]               : "small" | "normal" | "large"  — maps to CSS body class
 *  - [textColor]              : CSS hex colour string           — injected as body colour override
 *  - [customPrimaryColor]     : CSS hex colour string           — custom palette pet body colour
 *  - [customSecondaryColor]   : CSS hex colour string           — custom palette pet eyes/details colour
 *  - [customBackgroundColor]  : CSS hex colour string           — custom palette canvas background colour
 *  - [enableAttentionCalls]   : whether to show balloon notifications for attention calls
 *  - [idleThresholdSeconds]   : seconds of no IDE activity before idle mode (default 60)
 *  - [idleDeepThresholdSeconds]: seconds of sustained idle before deep-idle mode (default 600)
 *  - [attentionCallExpiry]    : "needy" | "standard" | "chilled" — response window for poop/misbehaviour/gift
 *  - [attentionCallRate]      : "fast" | "medium" | "slow" — spawn rate for probabilistic calls
 *  - [petStageHeight]         : canvas height in pixels (default 96)
 *  - [reducedMotion]          : disable rAF animation loop (default false)
 *  - [petSize]                : "small" | "medium" | "large" — sprite display size (default "medium")
 *  - [devModeEnabled]         : must be true (along with the correct passcode) to activate dev mode (default false)
 *  - [developerPasscode]      : developer passcode (combined with devModeEnabled) to activate developer mode (default "")
 *  - [devModeAgingMultiplier] : aging speed multiplier in dev mode (default 10)
 *  - [devModeHealthFloor]     : minimum health enforced in dev mode; default 1 (pet cannot die); set to 0 to allow death
 *  - [aiMode]                 : suppress document-change, cursor-movement, and tab-switch idle resets (default false)
 *  - [idleResetOnDocumentChange]  : reset idle timer on document changes (default true)
 *  - [idleResetOnCursorMovement]  : reset idle timer on cursor/selection changes (default true)
 *  - [idleResetOnTabSwitch]       : reset idle timer on active editor tab change (default true)
 *  - [idleResetOnWindowFocus]     : reset idle timer when IDE window gains focus (default true)
 *  - [idleResetOnMouseMovement]   : reset idle timer on mouse movement in the sidebar (default true)
 */
@State(
    name = "CodotchiSettings",
    storages = [Storage("codotchi_settings.xml")]
)
@Service(Service.Level.APP)
class CodotchiSettings : PersistentStateComponent<CodotchiSettings.State> {

    /** Plain bean-style class required by IntelliJ's XmlSerializer. */
    class State {
        var fontSize:  String  = "normal"    // "small" | "normal" | "large"
        var textColor: String  = "#cccccc"   // any CSS hex colour
        var customPrimaryColor:    String = "#ff8c00"  // custom palette — pet body
        var customSecondaryColor:  String = "#ffffff"  // custom palette — pet eyes / details
        var customBackgroundColor: String = "#1a1a2e"  // custom palette — canvas background
        var enableAttentionCalls: Boolean = true
        var idleThresholdSeconds: Int = 60
        var idleDeepThresholdSeconds: Int = 600
        var attentionCallExpiry: String = "standard"  // "needy" | "standard" | "chilled"
        var attentionCallRate:   String = "fast"      // "fast" | "medium" | "slow"
        var petStageHeight: Int = 240
        var reducedMotion: Boolean = false
        var petSize: String = "medium"   // "small" | "medium" | "large"
        var devModeEnabled: Boolean = false
        var developerPasscode: String = ""
        var devModeAgingMultiplier: Int = 10
        var devModeHealthFloor: Int = 1
        var aiMode: Boolean = false
        var idleResetOnDocumentChange: Boolean = true
        var idleResetOnCursorMovement: Boolean = true
        var idleResetOnTabSwitch: Boolean = true
        var idleResetOnWindowFocus: Boolean = true
        var idleResetOnMouseMovement: Boolean = true
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

    var customPrimaryColor: String
        get() = _state.customPrimaryColor
        set(v) { _state.customPrimaryColor = v }

    var customSecondaryColor: String
        get() = _state.customSecondaryColor
        set(v) { _state.customSecondaryColor = v }

    var customBackgroundColor: String
        get() = _state.customBackgroundColor
        set(v) { _state.customBackgroundColor = v }

    var enableAttentionCalls: Boolean
        get() = _state.enableAttentionCalls
        set(v) { _state.enableAttentionCalls = v }

    var idleThresholdSeconds: Int
        get() = _state.idleThresholdSeconds
        set(v) { _state.idleThresholdSeconds = v }

    var idleDeepThresholdSeconds: Int
        get() = _state.idleDeepThresholdSeconds
        set(v) { _state.idleDeepThresholdSeconds = v }

    var attentionCallExpiry: String
        get() = _state.attentionCallExpiry
        set(v) { _state.attentionCallExpiry = v }

    var attentionCallRate: String
        get() = _state.attentionCallRate
        set(v) { _state.attentionCallRate = v }

    var petStageHeight: Int
        get() = _state.petStageHeight
        set(v) { _state.petStageHeight = v }

    var reducedMotion: Boolean
        get() = _state.reducedMotion
        set(v) { _state.reducedMotion = v }

    var petSize: String
        get() = _state.petSize
        set(v) { _state.petSize = v }

    var devModeEnabled: Boolean
        get() = _state.devModeEnabled
        set(v) { _state.devModeEnabled = v }

    var developerPasscode: String
        get() = _state.developerPasscode
        set(v) { _state.developerPasscode = v }

    var devModeAgingMultiplier: Int
        get() = _state.devModeAgingMultiplier
        set(v) { _state.devModeAgingMultiplier = v }

    var devModeHealthFloor: Int
        get() = _state.devModeHealthFloor
        set(v) { _state.devModeHealthFloor = v }

    var aiMode: Boolean
        get() = _state.aiMode
        set(v) { _state.aiMode = v }

    var idleResetOnDocumentChange: Boolean
        get() = _state.idleResetOnDocumentChange
        set(v) { _state.idleResetOnDocumentChange = v }

    var idleResetOnCursorMovement: Boolean
        get() = _state.idleResetOnCursorMovement
        set(v) { _state.idleResetOnCursorMovement = v }

    var idleResetOnTabSwitch: Boolean
        get() = _state.idleResetOnTabSwitch
        set(v) { _state.idleResetOnTabSwitch = v }

    var idleResetOnWindowFocus: Boolean
        get() = _state.idleResetOnWindowFocus
        set(v) { _state.idleResetOnWindowFocus = v }

    var idleResetOnMouseMovement: Boolean
        get() = _state.idleResetOnMouseMovement
        set(v) { _state.idleResetOnMouseMovement = v }
}
