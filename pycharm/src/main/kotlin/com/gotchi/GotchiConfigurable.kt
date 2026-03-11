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
import javax.swing.JComboBox
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * GotchiConfigurable — IDE settings page for Gotchi display preferences.
 *
 * Registered under Settings > Tools > Gotchi.
 * Changes apply immediately to the open tool-window via [GotchiPlugin.reloadWebview].
 */
class GotchiConfigurable : Configurable {

    private var fontSizeCombo: JComboBox<String>? = null
    private var colorPanel:    ColorPanel?         = null

    override fun getDisplayName(): String = "Gotchi"

    override fun createComponent(): JComponent {
        val combo = JComboBox(arrayOf("Small", "Normal", "Large"))
        val cp    = ColorPanel()
        fontSizeCombo = combo
        colorPanel    = cp

        val panel = JPanel(GridBagLayout())
        val gbc   = GridBagConstraints()
        gbc.insets = Insets(4, 4, 4, 4)

        gbc.gridx = 0; gbc.gridy = 0
        gbc.anchor = GridBagConstraints.WEST
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Font size:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(combo, gbc)

        gbc.gridx = 0; gbc.gridy = 1
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(JBLabel("Text colour:"), gbc)

        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(cp, gbc)

        // Push content to the top
        gbc.gridx = 0; gbc.gridy = 2; gbc.gridwidth = 2
        gbc.weighty = 1.0; gbc.fill = GridBagConstraints.BOTH
        panel.add(JPanel(), gbc)

        reset()
        return panel
    }

    override fun isModified(): Boolean {
        val settings = service<GotchiSettings>()
        val uiFont   = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        val uiColor  = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        return uiFont != settings.fontSize || uiColor != settings.textColor
    }

    override fun apply() {
        val settings = service<GotchiSettings>()
        settings.fontSize  = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        settings.textColor = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        // Reload the webview immediately so the change is visible without a restart
        ApplicationManager.getApplication().service<GotchiPlugin>().reloadWebview()
    }

    override fun reset() {
        val settings = service<GotchiSettings>()
        fontSizeCombo?.selectedItem = settings.fontSize.replaceFirstChar { it.uppercaseChar() }
        colorPanel?.selectedColor   = hexToColor(settings.textColor)
    }

    // ── Colour helpers ─────────────────────────────────────────────────────

    private fun colorToHex(c: Color): String = "#%02x%02x%02x".format(c.red, c.green, c.blue)

    private fun hexToColor(hex: String): Color = try {
        Color.decode(hex)
    } catch (_: NumberFormatException) {
        Color(0xCC, 0xCC, 0xCC)
    }
}
