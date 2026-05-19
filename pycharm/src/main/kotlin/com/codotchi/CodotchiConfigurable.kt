package com.codotchi

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.ui.ColorPanel
import com.intellij.ui.components.JBLabel
import java.awt.Color
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import java.awt.Insets
import javax.swing.JCheckBox
import javax.swing.JComboBox
import javax.swing.JComponent
import javax.swing.JPanel
import javax.swing.JSpinner
import javax.swing.JTextField
import javax.swing.SpinnerNumberModel

/**
 * CodotchiConfigurable — IDE settings page for Codotchi display preferences.
 *
 * Registered under Settings > Tools > Codotchi.
 * Changes apply immediately to the open tool-window via [CodotchiPlugin.reloadWebview].
 */
class CodotchiConfigurable : Configurable {

    private var fontSizeCombo:             JComboBox<String>? = null
    private var colorPanel:                ColorPanel?         = null
    private var enableAttentionCallsCheck: JCheckBox?          = null
    private var idleThresholdSpinner:      JSpinner?           = null
    private var idleDeepThresholdSpinner:  JSpinner?           = null
    private var attentionCallExpiryCombo:  JComboBox<String>?  = null
    private var attentionCallRateCombo:    JComboBox<String>?  = null
    private var petStageHeightSpinner:     JSpinner?           = null
    private var reducedMotionCheck:        JCheckBox?          = null
    private var petSizeCombo:              JComboBox<String>?  = null
    private var devModeEnabledCheck:        JCheckBox?          = null
    private var developerPasscodeField:    JTextField?         = null
    private var characterPasscodeField:    JTextField?         = null
    private var devModeAgingSpinner:       JSpinner?           = null
    private var devModeHealthFloorSpinner: JSpinner?           = null
    private var aiModeCheck:                    JCheckBox?          = null
    private var idleResetOnDocumentChangeCheck: JCheckBox?          = null
    private var idleResetOnCursorMovementCheck: JCheckBox?          = null
    private var idleResetOnTabSwitchCheck:      JCheckBox?          = null
    private var idleResetOnWindowFocusCheck:    JCheckBox?          = null
    private var idleResetOnMouseMovementCheck:  JCheckBox?          = null
    private var backgroundCombo:               JComboBox<String>?  = null

    override fun getDisplayName(): String = "Codotchi"

    override fun createComponent(): JComponent {
        val combo   = JComboBox(arrayOf("Small", "Normal", "Large"))
        val cp      = ColorPanel()
        val attentionCheck  = JCheckBox("Enable attention calls")
        val idleSpinner     = JSpinner(SpinnerNumberModel(60, 10, 3600, 10))
        val deepIdleSpinner = JSpinner(SpinnerNumberModel(600, 30, 7200, 30))
        val expiryCombo     = JComboBox(arrayOf("Needy (2 min)", "Standard (5 min)", "Chilled (10 min)"))
        val rateCombo       = JComboBox(arrayOf("Fast", "Medium", "Slow"))
        val stageHeightSpinner = JSpinner(SpinnerNumberModel(240, 48, 300, 8))
        val reducedMotionCheckbox = JCheckBox("Reduced motion (disable animation)")
        val petSizeDropdown = JComboBox(arrayOf("Small", "Medium", "Large"))
        val devModeEnabledCheckbox = JCheckBox("Enable developer mode")
        val devPasscodeField = JTextField(10)
        val charPasscodeField = JTextField(10)
        val devAgingSpinner = JSpinner(SpinnerNumberModel(10, 1, 1000, 1))
        val devHealthFloorSpinner = JSpinner(SpinnerNumberModel(1, 0, 100, 1))
        val aiModeCheckbox = JCheckBox("AI mode (suppress doc-change / cursor / tab-switch idle resets)")
        val idleResetDocChangeCheckbox = JCheckBox("Reset idle timer on document changes")
        val idleResetCursorCheckbox = JCheckBox("Reset idle timer on cursor movement")
        val idleResetTabCheckbox = JCheckBox("Reset idle timer on tab switch")
        val idleResetFocusCheckbox = JCheckBox("Reset idle timer on window focus")
        val idleResetMouseCheckbox = JCheckBox("Reset idle timer on mouse movement (sidebar)")
        val bgCombo = JComboBox(arrayOf("Plain", "Ordered (auto)", "Spring", "Summer", "Autumn", "Winter"))

        fontSizeCombo            = combo
        colorPanel               = cp
        enableAttentionCallsCheck = attentionCheck
        idleThresholdSpinner     = idleSpinner
        idleDeepThresholdSpinner = deepIdleSpinner
        attentionCallExpiryCombo = expiryCombo
        attentionCallRateCombo   = rateCombo
        petStageHeightSpinner    = stageHeightSpinner
        reducedMotionCheck       = reducedMotionCheckbox
        petSizeCombo             = petSizeDropdown
        devModeEnabledCheck      = devModeEnabledCheckbox
        developerPasscodeField   = devPasscodeField
        characterPasscodeField   = charPasscodeField
        devModeAgingSpinner      = devAgingSpinner
        devModeHealthFloorSpinner = devHealthFloorSpinner
        aiModeCheck                    = aiModeCheckbox
        idleResetOnDocumentChangeCheck = idleResetDocChangeCheckbox
        idleResetOnCursorMovementCheck = idleResetCursorCheckbox
        idleResetOnTabSwitchCheck      = idleResetTabCheckbox
        idleResetOnWindowFocusCheck    = idleResetFocusCheckbox
        idleResetOnMouseMovementCheck  = idleResetMouseCheckbox
        backgroundCombo                = bgCombo

        val panel = JPanel(GridBagLayout())
        val gbc   = GridBagConstraints()
        gbc.insets = Insets(4, 4, 4, 4)

        // Row 0 — Background
        gbc.gridx = 0; gbc.gridy = 0
        gbc.anchor = GridBagConstraints.WEST
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Background:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(bgCombo, gbc)

        // Row 1 — Font size
        gbc.gridx = 0; gbc.gridy = 1
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Font size:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(combo, gbc)

        // Row 2 — Text colour
        gbc.gridx = 0; gbc.gridy = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Text colour:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(cp, gbc)

        // Row 3 — Enable attention calls
        gbc.gridx = 0; gbc.gridy = 3; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(attentionCheck, gbc)
        gbc.gridwidth = 1

        // Row 4 — Idle threshold
        gbc.gridx = 0; gbc.gridy = 4
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Idle threshold (seconds):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(idleSpinner, gbc)

        // Row 5 — Deep-idle threshold
        gbc.gridx = 0; gbc.gridy = 5
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Deep-idle threshold (seconds):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(deepIdleSpinner, gbc)

        // Row 6 — Attention call expiry
        gbc.gridx = 0; gbc.gridy = 6
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Attention call expiry:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(expiryCombo, gbc)

        // Row 7 — Attention call rate
        gbc.gridx = 0; gbc.gridy = 7
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Attention call rate:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(rateCombo, gbc)

        // Row 8 — Pet stage height
        gbc.gridx = 0; gbc.gridy = 8
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Pet stage height (px):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(stageHeightSpinner, gbc)

        // Row 9 — Reduced motion
        gbc.gridx = 0; gbc.gridy = 9; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(reducedMotionCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 10 — Pet size
        gbc.gridx = 0; gbc.gridy = 10
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Pet size:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(petSizeDropdown, gbc)

        // Row 11 — Dev mode enabled
        gbc.gridx = 0; gbc.gridy = 11; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(devModeEnabledCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 12 — Developer passcode
        gbc.gridx = 0; gbc.gridy = 12
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Developer passcode:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(devPasscodeField, gbc)

        // Row 13 — Character passcode
        gbc.gridx = 0; gbc.gridy = 13
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Character passcode:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(charPasscodeField, gbc)

        // Row 14 — Dev mode aging multiplier
        gbc.gridx = 0; gbc.gridy = 14
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Dev mode aging multiplier:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(devAgingSpinner, gbc)

        // Row 15 — Dev mode health floor
        gbc.gridx = 0; gbc.gridy = 15
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Dev mode health floor:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(devHealthFloorSpinner, gbc)

        // Row 16 — AI mode
        gbc.gridx = 0; gbc.gridy = 16; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(aiModeCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 17 — Idle reset: document changes
        gbc.gridx = 0; gbc.gridy = 17; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(idleResetDocChangeCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 18 — Idle reset: cursor movement
        gbc.gridx = 0; gbc.gridy = 18; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(idleResetCursorCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 19 — Idle reset: tab switch
        gbc.gridx = 0; gbc.gridy = 19; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(idleResetTabCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 20 — Idle reset: window focus
        gbc.gridx = 0; gbc.gridy = 20; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(idleResetFocusCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 21 — Idle reset: mouse movement
        gbc.gridx = 0; gbc.gridy = 21; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(idleResetMouseCheckbox, gbc)
        gbc.gridwidth = 1

        // Push content to the top
        gbc.gridx = 0; gbc.gridy = 22; gbc.gridwidth = 2
        gbc.weighty = 1.0; gbc.fill = GridBagConstraints.BOTH
        panel.add(JPanel(), gbc)

        reset()
        return panel
    }

    override fun isModified(): Boolean {
        val settings = service<CodotchiSettings>()
        val uiFont       = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        val uiColor      = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        val uiAttention  = enableAttentionCallsCheck?.isSelected ?: true
        val uiIdle       = (idleThresholdSpinner?.value as? Int) ?: 60
        val uiDeepIdle   = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        val uiExpiry     = expiryIndexToKey(attentionCallExpiryCombo?.selectedIndex ?: 1)
        val uiRate       = rateIndexToKey(attentionCallRateCombo?.selectedIndex ?: 0)
        val uiStageHeight = (petStageHeightSpinner?.value as? Int) ?: 96
        val uiReducedMotion = reducedMotionCheck?.isSelected ?: false
        val uiPetSize = petSizeIndexToKey(petSizeCombo?.selectedIndex ?: 1)
        val uiDevModeEnabled = devModeEnabledCheck?.isSelected ?: false
        val uiDevPasscode = developerPasscodeField?.text ?: ""
        val uiCharPasscode = characterPasscodeField?.text ?: ""
        val uiDevAging = (devModeAgingSpinner?.value as? Int) ?: 10
        val uiDevHealthFloor = (devModeHealthFloorSpinner?.value as? Int) ?: 1
        val uiAiMode = aiModeCheck?.isSelected ?: false
        val uiIdleResetDocChange = idleResetOnDocumentChangeCheck?.isSelected ?: true
        val uiIdleResetCursor = idleResetOnCursorMovementCheck?.isSelected ?: true
        val uiIdleResetTab = idleResetOnTabSwitchCheck?.isSelected ?: true
        val uiIdleResetFocus = idleResetOnWindowFocusCheck?.isSelected ?: true
        val uiIdleResetMouse = idleResetOnMouseMovementCheck?.isSelected ?: true
        val uiBg = bgIndexToKey(backgroundCombo?.selectedIndex ?: 1)
        return uiFont != settings.fontSize
            || uiColor != settings.textColor
            || uiAttention != settings.enableAttentionCalls
            || uiIdle != settings.idleThresholdSeconds
            || uiDeepIdle != settings.idleDeepThresholdSeconds
            || uiExpiry != settings.attentionCallExpiry
            || uiRate != settings.attentionCallRate
            || uiStageHeight != settings.petStageHeight
            || uiReducedMotion != settings.reducedMotion
            || uiPetSize != settings.petSize
            || uiDevModeEnabled != settings.devModeEnabled
            || uiDevPasscode != settings.developerPasscode
            || uiCharPasscode != settings.characterPasscode
            || uiDevAging != settings.devModeAgingMultiplier
            || uiDevHealthFloor != settings.devModeHealthFloor
            || uiAiMode != settings.aiMode
            || uiIdleResetDocChange != settings.idleResetOnDocumentChange
            || uiIdleResetCursor != settings.idleResetOnCursorMovement
            || uiIdleResetTab != settings.idleResetOnTabSwitch
            || uiIdleResetFocus != settings.idleResetOnWindowFocus
            || uiIdleResetMouse != settings.idleResetOnMouseMovement
            || uiBg != settings.background
    }

    override fun apply() {
        val settings = service<CodotchiSettings>()
        settings.fontSize               = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        settings.textColor              = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        settings.enableAttentionCalls   = enableAttentionCallsCheck?.isSelected ?: true
        settings.idleThresholdSeconds   = (idleThresholdSpinner?.value as? Int) ?: 60
        settings.idleDeepThresholdSeconds = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        settings.attentionCallExpiry    = expiryIndexToKey(attentionCallExpiryCombo?.selectedIndex ?: 1)
        settings.attentionCallRate      = rateIndexToKey(attentionCallRateCombo?.selectedIndex ?: 0)
        settings.petStageHeight         = (petStageHeightSpinner?.value as? Int) ?: 96
        settings.reducedMotion          = reducedMotionCheck?.isSelected ?: false
        settings.petSize                = petSizeIndexToKey(petSizeCombo?.selectedIndex ?: 1)
        settings.devModeEnabled         = devModeEnabledCheck?.isSelected ?: false
        settings.developerPasscode      = developerPasscodeField?.text ?: ""
        settings.characterPasscode      = characterPasscodeField?.text ?: ""
        settings.devModeAgingMultiplier = (devModeAgingSpinner?.value as? Int) ?: 10
        settings.devModeHealthFloor     = (devModeHealthFloorSpinner?.value as? Int) ?: 1
        settings.aiMode                    = aiModeCheck?.isSelected ?: false
        settings.idleResetOnDocumentChange = idleResetOnDocumentChangeCheck?.isSelected ?: true
        settings.idleResetOnCursorMovement = idleResetOnCursorMovementCheck?.isSelected ?: true
        settings.idleResetOnTabSwitch      = idleResetOnTabSwitchCheck?.isSelected ?: true
        settings.idleResetOnWindowFocus    = idleResetOnWindowFocusCheck?.isSelected ?: true
        settings.idleResetOnMouseMovement  = idleResetOnMouseMovementCheck?.isSelected ?: true
        settings.background                = bgIndexToKey(backgroundCombo?.selectedIndex ?: 1)
        // Reload the webview immediately so the change is visible without a restart
        ApplicationManager.getApplication().service<CodotchiPlugin>().reloadWebview()
    }

    override fun reset() {
        val settings = service<CodotchiSettings>()
        fontSizeCombo?.selectedItem        = settings.fontSize.replaceFirstChar { it.uppercaseChar() }
        colorPanel?.selectedColor          = hexToColor(settings.textColor)
        enableAttentionCallsCheck?.isSelected = settings.enableAttentionCalls
        idleThresholdSpinner?.value        = settings.idleThresholdSeconds
        idleDeepThresholdSpinner?.value    = settings.idleDeepThresholdSeconds
        attentionCallExpiryCombo?.selectedIndex = expiryKeyToIndex(settings.attentionCallExpiry)
        attentionCallRateCombo?.selectedIndex   = rateKeyToIndex(settings.attentionCallRate)
        petStageHeightSpinner?.value            = settings.petStageHeight
        reducedMotionCheck?.isSelected          = settings.reducedMotion
        petSizeCombo?.selectedIndex             = petSizeKeyToIndex(settings.petSize)
        devModeEnabledCheck?.isSelected         = settings.devModeEnabled
        developerPasscodeField?.text            = settings.developerPasscode
        characterPasscodeField?.text            = settings.characterPasscode
        devModeAgingSpinner?.value              = settings.devModeAgingMultiplier
        devModeHealthFloorSpinner?.value        = settings.devModeHealthFloor
        aiModeCheck?.isSelected                    = settings.aiMode
        idleResetOnDocumentChangeCheck?.isSelected = settings.idleResetOnDocumentChange
        idleResetOnCursorMovementCheck?.isSelected = settings.idleResetOnCursorMovement
        idleResetOnTabSwitchCheck?.isSelected      = settings.idleResetOnTabSwitch
        idleResetOnWindowFocusCheck?.isSelected    = settings.idleResetOnWindowFocus
        idleResetOnMouseMovementCheck?.isSelected  = settings.idleResetOnMouseMovement
        backgroundCombo?.selectedIndex             = bgKeyToIndex(settings.background)
    }

    // ── Enum helpers ───────────────────────────────────────────────────────

    private fun expiryIndexToKey(index: Int) = when (index) { 0 -> "needy"; 2 -> "chilled"; else -> "standard" }
    private fun expiryKeyToIndex(key: String) = when (key) { "needy" -> 0; "chilled" -> 2; else -> 1 }
    private fun rateIndexToKey(index: Int)  = when (index) { 1 -> "medium"; 2 -> "slow"; else -> "fast" }
    private fun rateKeyToIndex(key: String) = when (key) { "medium" -> 1; "slow" -> 2; else -> 0 }
    private fun petSizeIndexToKey(index: Int) = when (index) { 0 -> "small"; 2 -> "large"; else -> "medium" }
    private fun petSizeKeyToIndex(key: String) = when (key) { "small" -> 0; "large" -> 2; else -> 1 }
    private fun bgIndexToKey(index: Int) = when (index) { 0 -> "plain"; 2 -> "spring"; 3 -> "summer"; 4 -> "autumn"; 5 -> "winter"; else -> "ordered" }
    private fun bgKeyToIndex(key: String) = when (key) { "plain" -> 0; "spring" -> 2; "summer" -> 3; "autumn" -> 4; "winter" -> 5; else -> 1 }

    // ── Colour helpers ─────────────────────────────────────────────────────

    private fun colorToHex(c: Color): String = "#%02x%02x%02x".format(c.red, c.green, c.blue)

    private fun hexToColor(hex: String): Color = try {
        Color.decode(hex)
    } catch (_: NumberFormatException) {
        Color(0xCC, 0xCC, 0xCC)
    }
}
