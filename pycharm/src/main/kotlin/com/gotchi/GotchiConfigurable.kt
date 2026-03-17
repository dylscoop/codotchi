package com.gotchi

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
 * GotchiConfigurable — IDE settings page for Gotchi display preferences.
 *
 * Registered under Settings > Tools > Gotchi.
 * Changes apply immediately to the open tool-window via [GotchiPlugin.reloadWebview].
 */
class GotchiConfigurable : Configurable {

    private var fontSizeCombo:             JComboBox<String>? = null
    private var colorPanel:                ColorPanel?         = null
    private var customPrimaryPanel:        ColorPanel?         = null
    private var customSecondaryPanel:      ColorPanel?         = null
    private var customBackgroundPanel:     ColorPanel?         = null
    private var enableAttentionCallsCheck: JCheckBox?          = null
    private var idleThresholdSpinner:      JSpinner?           = null
    private var idleDeepThresholdSpinner:  JSpinner?           = null
    private var attentionCallExpiryCombo:  JComboBox<String>?  = null
    private var attentionCallRateCombo:    JComboBox<String>?  = null
    private var petStageHeightSpinner:     JSpinner?           = null
    private var reducedMotionCheck:        JCheckBox?          = null
    private var developerPasscodeField:    JTextField?         = null
    private var devModeAgingSpinner:       JSpinner?           = null

    override fun getDisplayName(): String = "Gotchi"

    override fun createComponent(): JComponent {
        val combo   = JComboBox(arrayOf("Small", "Normal", "Large"))
        val cp      = ColorPanel()
        val cpPrimary    = ColorPanel()
        val cpSecondary  = ColorPanel()
        val cpBackground = ColorPanel()
        val attentionCheck  = JCheckBox("Enable attention calls")
        val idleSpinner     = JSpinner(SpinnerNumberModel(60, 10, 3600, 10))
        val deepIdleSpinner = JSpinner(SpinnerNumberModel(600, 30, 7200, 30))
        val expiryCombo     = JComboBox(arrayOf("Needy (2 min)", "Standard (5 min)", "Chilled (10 min)"))
        val rateCombo       = JComboBox(arrayOf("Fast", "Medium", "Slow"))
        val stageHeightSpinner = JSpinner(SpinnerNumberModel(96, 48, 300, 8))
        val reducedMotionCheckbox = JCheckBox("Reduced motion (disable animation)")
        val devPasscodeField = JTextField(10)
        val devAgingSpinner = JSpinner(SpinnerNumberModel(10, 1, 1000, 1))

        fontSizeCombo            = combo
        colorPanel               = cp
        customPrimaryPanel       = cpPrimary
        customSecondaryPanel     = cpSecondary
        customBackgroundPanel    = cpBackground
        enableAttentionCallsCheck = attentionCheck
        idleThresholdSpinner     = idleSpinner
        idleDeepThresholdSpinner = deepIdleSpinner
        attentionCallExpiryCombo = expiryCombo
        attentionCallRateCombo   = rateCombo
        petStageHeightSpinner    = stageHeightSpinner
        reducedMotionCheck       = reducedMotionCheckbox
        developerPasscodeField   = devPasscodeField
        devModeAgingSpinner      = devAgingSpinner

        val panel = JPanel(GridBagLayout())
        val gbc   = GridBagConstraints()
        gbc.insets = Insets(4, 4, 4, 4)

        // Row 0 — Font size
        gbc.gridx = 0; gbc.gridy = 0
        gbc.anchor = GridBagConstraints.WEST
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Font size:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(combo, gbc)

        // Row 1 — Text colour
        gbc.gridx = 0; gbc.gridy = 1
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Text colour:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(cp, gbc)

        // Row 2 — Custom palette: primary (pet body)
        gbc.gridx = 0; gbc.gridy = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Custom palette — body:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(cpPrimary, gbc)

        // Row 3 — Custom palette: secondary (eyes / details)
        gbc.gridx = 0; gbc.gridy = 3
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Custom palette — details:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(cpSecondary, gbc)

        // Row 4 — Custom palette: background (canvas stage)
        gbc.gridx = 0; gbc.gridy = 4
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Custom palette — background:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(cpBackground, gbc)

        // Row 5 — Enable attention calls
        gbc.gridx = 0; gbc.gridy = 5; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(attentionCheck, gbc)
        gbc.gridwidth = 1

        // Row 6 — Idle threshold
        gbc.gridx = 0; gbc.gridy = 6
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Idle threshold (seconds):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(idleSpinner, gbc)

        // Row 7 — Deep-idle threshold
        gbc.gridx = 0; gbc.gridy = 7
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Deep-idle threshold (seconds):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(deepIdleSpinner, gbc)

        // Row 8 — Attention call expiry
        gbc.gridx = 0; gbc.gridy = 8
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Attention call expiry:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(expiryCombo, gbc)

        // Row 9 — Attention call rate
        gbc.gridx = 0; gbc.gridy = 9
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Attention call rate:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(rateCombo, gbc)

        // Row 10 — Pet stage height
        gbc.gridx = 0; gbc.gridy = 10
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Pet stage height (px):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(stageHeightSpinner, gbc)

        // Row 11 — Reduced motion
        gbc.gridx = 0; gbc.gridy = 11; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(reducedMotionCheckbox, gbc)
        gbc.gridwidth = 1

        // Row 12 — Developer passcode
        gbc.gridx = 0; gbc.gridy = 12
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Developer passcode:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(devPasscodeField, gbc)

        // Row 13 — Dev mode aging multiplier
        gbc.gridx = 0; gbc.gridy = 13
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Dev mode aging multiplier:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(devAgingSpinner, gbc)

        // Push content to the top
        gbc.gridx = 0; gbc.gridy = 14; gbc.gridwidth = 2
        gbc.weighty = 1.0; gbc.fill = GridBagConstraints.BOTH
        panel.add(JPanel(), gbc)

        reset()
        return panel
    }

    override fun isModified(): Boolean {
        val settings = service<GotchiSettings>()
        val uiFont       = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        val uiColor      = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        val uiPrimary    = customPrimaryPanel?.selectedColor?.let { colorToHex(it) } ?: "#ff8c00"
        val uiSecondary  = customSecondaryPanel?.selectedColor?.let { colorToHex(it) } ?: "#ffffff"
        val uiBackground = customBackgroundPanel?.selectedColor?.let { colorToHex(it) } ?: "#1a1a2e"
        val uiAttention  = enableAttentionCallsCheck?.isSelected ?: true
        val uiIdle       = (idleThresholdSpinner?.value as? Int) ?: 60
        val uiDeepIdle   = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        val uiExpiry     = expiryIndexToKey(attentionCallExpiryCombo?.selectedIndex ?: 1)
        val uiRate       = rateIndexToKey(attentionCallRateCombo?.selectedIndex ?: 0)
        val uiStageHeight = (petStageHeightSpinner?.value as? Int) ?: 96
        val uiReducedMotion = reducedMotionCheck?.isSelected ?: false
        val uiDevPasscode = developerPasscodeField?.text ?: ""
        val uiDevAging = (devModeAgingSpinner?.value as? Int) ?: 10
        return uiFont != settings.fontSize
            || uiColor != settings.textColor
            || uiPrimary != settings.customPrimaryColor
            || uiSecondary != settings.customSecondaryColor
            || uiBackground != settings.customBackgroundColor
            || uiAttention != settings.enableAttentionCalls
            || uiIdle != settings.idleThresholdSeconds
            || uiDeepIdle != settings.idleDeepThresholdSeconds
            || uiExpiry != settings.attentionCallExpiry
            || uiRate != settings.attentionCallRate
            || uiStageHeight != settings.petStageHeight
            || uiReducedMotion != settings.reducedMotion
            || uiDevPasscode != settings.developerPasscode
            || uiDevAging != settings.devModeAgingMultiplier
    }

    override fun apply() {
        val settings = service<GotchiSettings>()
        settings.fontSize               = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        settings.textColor              = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        settings.customPrimaryColor     = customPrimaryPanel?.selectedColor?.let { colorToHex(it) } ?: "#ff8c00"
        settings.customSecondaryColor   = customSecondaryPanel?.selectedColor?.let { colorToHex(it) } ?: "#ffffff"
        settings.customBackgroundColor  = customBackgroundPanel?.selectedColor?.let { colorToHex(it) } ?: "#1a1a2e"
        settings.enableAttentionCalls   = enableAttentionCallsCheck?.isSelected ?: true
        settings.idleThresholdSeconds   = (idleThresholdSpinner?.value as? Int) ?: 60
        settings.idleDeepThresholdSeconds = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        settings.attentionCallExpiry    = expiryIndexToKey(attentionCallExpiryCombo?.selectedIndex ?: 1)
        settings.attentionCallRate      = rateIndexToKey(attentionCallRateCombo?.selectedIndex ?: 0)
        settings.petStageHeight         = (petStageHeightSpinner?.value as? Int) ?: 96
        settings.reducedMotion          = reducedMotionCheck?.isSelected ?: false
        settings.developerPasscode      = developerPasscodeField?.text ?: ""
        settings.devModeAgingMultiplier = (devModeAgingSpinner?.value as? Int) ?: 10
        // Reload the webview immediately so the change is visible without a restart
        ApplicationManager.getApplication().service<GotchiPlugin>().reloadWebview()
    }

    override fun reset() {
        val settings = service<GotchiSettings>()
        fontSizeCombo?.selectedItem        = settings.fontSize.replaceFirstChar { it.uppercaseChar() }
        colorPanel?.selectedColor          = hexToColor(settings.textColor)
        customPrimaryPanel?.selectedColor    = hexToColor(settings.customPrimaryColor)
        customSecondaryPanel?.selectedColor  = hexToColor(settings.customSecondaryColor)
        customBackgroundPanel?.selectedColor = hexToColor(settings.customBackgroundColor)
        enableAttentionCallsCheck?.isSelected = settings.enableAttentionCalls
        idleThresholdSpinner?.value        = settings.idleThresholdSeconds
        idleDeepThresholdSpinner?.value    = settings.idleDeepThresholdSeconds
        attentionCallExpiryCombo?.selectedIndex = expiryKeyToIndex(settings.attentionCallExpiry)
        attentionCallRateCombo?.selectedIndex   = rateKeyToIndex(settings.attentionCallRate)
        petStageHeightSpinner?.value            = settings.petStageHeight
        reducedMotionCheck?.isSelected          = settings.reducedMotion
        developerPasscodeField?.text            = settings.developerPasscode
        devModeAgingSpinner?.value              = settings.devModeAgingMultiplier
    }

    // ── Enum helpers ───────────────────────────────────────────────────────

    private fun expiryIndexToKey(index: Int) = when (index) { 0 -> "needy"; 2 -> "chilled"; else -> "standard" }
    private fun expiryKeyToIndex(key: String) = when (key) { "needy" -> 0; "chilled" -> 2; else -> 1 }
    private fun rateIndexToKey(index: Int)  = when (index) { 1 -> "medium"; 2 -> "slow"; else -> "fast" }
    private fun rateKeyToIndex(key: String) = when (key) { "medium" -> 1; "slow" -> 2; else -> 0 }

    // ── Colour helpers ─────────────────────────────────────────────────────

    private fun colorToHex(c: Color): String = "#%02x%02x%02x".format(c.red, c.green, c.blue)

    private fun hexToColor(hex: String): Color = try {
        Color.decode(hex)
    } catch (_: NumberFormatException) {
        Color(0xCC, 0xCC, 0xCC)
    }
}
