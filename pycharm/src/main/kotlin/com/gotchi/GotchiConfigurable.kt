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
    private var enableAttentionCallsCheck: JCheckBox?          = null
    private var idleThresholdSpinner:      JSpinner?           = null
    private var idleDeepThresholdSpinner:  JSpinner?           = null

    override fun getDisplayName(): String = "Gotchi"

    override fun createComponent(): JComponent {
        val combo   = JComboBox(arrayOf("Small", "Normal", "Large"))
        val cp      = ColorPanel()
        val attentionCheck  = JCheckBox("Enable attention calls")
        val idleSpinner     = JSpinner(SpinnerNumberModel(60, 10, 3600, 10))
        val deepIdleSpinner = JSpinner(SpinnerNumberModel(600, 30, 7200, 30))

        fontSizeCombo            = combo
        colorPanel               = cp
        enableAttentionCallsCheck = attentionCheck
        idleThresholdSpinner     = idleSpinner
        idleDeepThresholdSpinner = deepIdleSpinner

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

        // Row 2 — Enable attention calls
        gbc.gridx = 0; gbc.gridy = 2; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(attentionCheck, gbc)
        gbc.gridwidth = 1

        // Row 3 — Idle threshold
        gbc.gridx = 0; gbc.gridy = 3
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Idle threshold (seconds):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(idleSpinner, gbc)

        // Row 4 — Deep-idle threshold
        gbc.gridx = 0; gbc.gridy = 4
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Deep-idle threshold (seconds):"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(deepIdleSpinner, gbc)

        // Push content to the top
        gbc.gridx = 0; gbc.gridy = 5; gbc.gridwidth = 2
        gbc.weighty = 1.0; gbc.fill = GridBagConstraints.BOTH
        panel.add(JPanel(), gbc)

        reset()
        return panel
    }

    override fun isModified(): Boolean {
        val settings = service<GotchiSettings>()
        val uiFont      = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        val uiColor     = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        val uiAttention = enableAttentionCallsCheck?.isSelected ?: true
        val uiIdle      = (idleThresholdSpinner?.value as? Int) ?: 60
        val uiDeepIdle  = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        return uiFont != settings.fontSize
            || uiColor != settings.textColor
            || uiAttention != settings.enableAttentionCalls
            || uiIdle != settings.idleThresholdSeconds
            || uiDeepIdle != settings.idleDeepThresholdSeconds
    }

    override fun apply() {
        val settings = service<GotchiSettings>()
        settings.fontSize               = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        settings.textColor              = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        settings.enableAttentionCalls   = enableAttentionCallsCheck?.isSelected ?: true
        settings.idleThresholdSeconds   = (idleThresholdSpinner?.value as? Int) ?: 60
        settings.idleDeepThresholdSeconds = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        // Reload the webview immediately so the change is visible without a restart
        ApplicationManager.getApplication().service<GotchiPlugin>().reloadWebview()
    }

    override fun reset() {
        val settings = service<GotchiSettings>()
        fontSizeCombo?.selectedItem        = settings.fontSize.replaceFirstChar { it.uppercaseChar() }
        colorPanel?.selectedColor          = hexToColor(settings.textColor)
        enableAttentionCallsCheck?.isSelected = settings.enableAttentionCalls
        idleThresholdSpinner?.value        = settings.idleThresholdSeconds
        idleDeepThresholdSpinner?.value    = settings.idleDeepThresholdSeconds
    }

    // ── Colour helpers ─────────────────────────────────────────────────────

    private fun colorToHex(c: Color): String = "#%02x%02x%02x".format(c.red, c.green, c.blue)

    private fun hexToColor(hex: String): Color = try {
        Color.decode(hex)
    } catch (_: NumberFormatException) {
        Color(0xCC, 0xCC, 0xCC)
    }
}
