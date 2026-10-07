package com.codotchi

import com.intellij.openapi.components.*

/**
 * CodotchiSettings — persisted display preferences for the Codotchi tool window.
 *
 * Stored in codotchi_settings.xml (separate from game state in codotchi.xml).
 * Fields:
 *  - [fontSize]               : "small" | "normal" | "large"  — maps to CSS body class
 *  - [textColor]              : CSS hex colour string           — injected as body colour override
 *  - [enableAttentionCalls]   : whether to show balloon notifications for attention calls
 *  - [osNotifications]        : desktop (OS) notification when hunger, happiness or energy hits 0, or health < 25 (default true)
 *  - [statusBarEnabled]       : show the pet in the status bar, with ⚠ during attention calls (default true)
 *  - [idleThresholdSeconds]   : seconds of no IDE activity before idle mode (default 60)
 *  - [idleDeepThresholdSeconds]: seconds of sustained idle before deep-idle mode (default 600)
 *  - [attentionCallExpiry]    : "needy" | "standard" | "chilled" — response window for poop/misbehaviour/gift/play/pat/craving
 *  - [attentionCallRate]      : "fast" | "medium" | "slow" — spawn rate for probabilistic calls (poop/misbehaviour/gift/play/pat/craving)
 *  - [stageHeight]            : "compact" | "normal" | "tall" | "extraTall" — pet stage height preset (default "normal")
 *  - [reducedMotion]          : disable rAF animation loop (default false)
 *  - [petSize]                : "small" | "medium" | "large" — sprite display size (default "medium")
 *  - [devModeEnabled]         : must be true (along with the correct passcode) to activate dev mode (default false)
 *  - [developerPasscode]      : developer passcode (combined with devModeEnabled) to activate developer mode (default "")
 *  - [characterPasscode]      : hidden character passcode — enter to unlock a secret character on next hatch (default "")
 *  - [devModeAgingMultiplier] : aging speed multiplier in dev mode (default 10)
 *  - [devModeHealthFloor]     : minimum health enforced in dev mode; default 1 (pet cannot die); set to 0 to allow death
 *  - [aiMode]                 : suppress document-change, cursor-movement, and tab-switch idle resets (default true)
 *  - [idleResetOnDocumentChange]  : reset idle timer on document changes (default true)
 *  - [idleResetOnCursorMovement]  : reset idle timer on cursor/selection changes (default true)
 *  - [idleResetOnTabSwitch]       : reset idle timer on active editor tab change (default true)
 *  - [idleResetOnWindowFocus]     : reset idle timer when IDE window gains focus (default true)
 *  - [idleResetOnMouseMovement]   : reset idle timer on mouse movement in the sidebar (default true)
 *  - [background]                 : "plain" | "ordered" | "spring" | "summer" | "autumn" | "winter" (default "ordered")
 *  - [backgroundStyle]            : "scenic" | "legacy" — pixel-art scenery or the pre-2.25 look (default "scenic")
 *  - [backgroundOpacity]          : "subtle" | "medium" | "vivid" — how strongly the scene shows (default "medium")
 *  - [backgroundAnimations]       : animate clouds, stars, lights, weather and critters (default true)
 *  - [perWorkspacePet]            : each project gets its own independent pet state file (default false)
 *  - [tokenCostIncludeClaudeCode] : include Claude Code dollar-cost usage in Today's Token Cost (default true)
 *  - [tokenCostIncludeOpenCode]   : include OpenCode dollar-cost usage in Today's Token Cost (default true)
 *  - [tokenCostIncludeCopilot]    : include GitHub Copilot premium-quota percentage in Today's Token Cost (default false); requires signing in via "Codotchi: Sign in to GitHub (Copilot Quota)"
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
        var enableAttentionCalls: Boolean = true
        var osNotifications: Boolean = true
        var statusBarEnabled: Boolean = true
        var idleThresholdSeconds: Int = 60
        var idleDeepThresholdSeconds: Int = 600
        var attentionCallExpiry: String = "standard"  // "needy" | "standard" | "chilled"
        var attentionCallRate:   String = "fast"      // "fast" | "medium" | "slow"
        var stageHeight: String = "normal"  // "compact" | "normal" | "tall" | "extraTall"
        var reducedMotion: Boolean = false
        var petSize: String = "medium"   // "small" | "medium" | "large"
        var devModeEnabled: Boolean = false
        var developerPasscode: String = ""
        var characterPasscode: String = ""
        var devModeAgingMultiplier: Int = 10
        var devModeHealthFloor: Int = 1
        var aiMode: Boolean = true
        var idleResetOnDocumentChange: Boolean = true
        var idleResetOnCursorMovement: Boolean = true
        var idleResetOnTabSwitch: Boolean = true
        var idleResetOnWindowFocus: Boolean = true
        var idleResetOnMouseMovement: Boolean = true
        var background: String = "ordered"  // "plain" | "ordered" | "spring" | "summer" | "autumn" | "winter"
        var backgroundStyle: String = "scenic"  // "scenic" | "legacy"
        var backgroundOpacity: String = "medium"  // "subtle" | "medium" | "vivid"
        var backgroundAnimations: Boolean = true
        var perWorkspacePet: Boolean = false
        var tokenCostIncludeClaudeCode: Boolean = true
        var tokenCostIncludeOpenCode: Boolean = true
        var tokenCostIncludeCopilot: Boolean = false
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

    var osNotifications: Boolean
        get() = _state.osNotifications
        set(v) { _state.osNotifications = v }

    var statusBarEnabled: Boolean
        get() = _state.statusBarEnabled
        set(v) { _state.statusBarEnabled = v }

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

    var stageHeight: String
        get() = _state.stageHeight
        set(v) { _state.stageHeight = v }

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

    var characterPasscode: String
        get() = _state.characterPasscode
        set(v) { _state.characterPasscode = v }

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

    var background: String
        get() = _state.background
        set(v) { _state.background = v }

    var backgroundStyle: String
        get() = _state.backgroundStyle
        set(v) { _state.backgroundStyle = v }

    var backgroundOpacity: String
        get() = _state.backgroundOpacity
        set(v) { _state.backgroundOpacity = v }

    var backgroundAnimations: Boolean
        get() = _state.backgroundAnimations
        set(v) { _state.backgroundAnimations = v }

    var perWorkspacePet: Boolean
        get() = _state.perWorkspacePet
        set(v) { _state.perWorkspacePet = v }

    var tokenCostIncludeClaudeCode: Boolean
        get() = _state.tokenCostIncludeClaudeCode
        set(v) { _state.tokenCostIncludeClaudeCode = v }

    var tokenCostIncludeOpenCode: Boolean
        get() = _state.tokenCostIncludeOpenCode
        set(v) { _state.tokenCostIncludeOpenCode = v }

    var tokenCostIncludeCopilot: Boolean
        get() = _state.tokenCostIncludeCopilot
        set(v) { _state.tokenCostIncludeCopilot = v }
}
