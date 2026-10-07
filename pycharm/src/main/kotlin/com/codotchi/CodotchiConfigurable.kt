package com.codotchi

import com.intellij.credentialStore.CredentialAttributes
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.options.Configurable
import com.intellij.ui.ColorPanel
import com.intellij.ui.HideableDecorator
import com.intellij.ui.components.JBLabel
import java.awt.BorderLayout
import java.awt.Color
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import java.awt.Insets
import javax.swing.JButton
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
    private var osNotificationsCheck:      JCheckBox?          = null
    private var statusBarEnabledCheck:     JCheckBox?          = null
    private var idleThresholdSpinner:      JSpinner?           = null
    private var idleDeepThresholdSpinner:  JSpinner?           = null
    private var attentionCallExpiryCombo:  JComboBox<String>?  = null
    private var attentionCallRateCombo:    JComboBox<String>?  = null
    private var stageHeightCombo:          JComboBox<String>?  = null
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
    private var backgroundStyleCombo:          JComboBox<String>?  = null
    private var backgroundOpacityCombo:        JComboBox<String>?  = null
    private var backgroundAnimationsCheck:     JCheckBox?          = null
    private var perWorkspacePetCheck:          JCheckBox?          = null
    private var tokenCostIncludeClaudeCodeCheck: JCheckBox?        = null
    private var tokenCostIncludeOpenCodeCheck:   JCheckBox?        = null
    private var tokenCostIncludeCopilotCheck:    JCheckBox?        = null
    private var lbSignInButton:  JButton?  = null
    private var lbSignOutButton: JButton?  = null
    private var lbSignInStatus:  JBLabel?  = null

    override fun getDisplayName(): String = "Codotchi"

    override fun createComponent(): JComponent {
        val combo   = JComboBox(arrayOf("Small", "Normal", "Large"))
        val cp      = ColorPanel()
        val attentionCheck  = JCheckBox("Enable attention calls")
        val osNotificationsCheckbox = JCheckBox("Desktop notification when hunger, happiness or energy hits 0, or health drops below 25")
        val statusBarEnabledCheckbox = JCheckBox("Show the pet in the status bar (⚠ while it has an attention call)")
        val idleSpinner     = JSpinner(SpinnerNumberModel(60, 10, 3600, 10))
        val deepIdleSpinner = JSpinner(SpinnerNumberModel(600, 30, 7200, 30))
        val expiryCombo     = JComboBox(arrayOf("Needy (4 min)", "Standard (10 min)", "Chilled (20 min)"))
        val rateCombo       = JComboBox(arrayOf("Fast", "Medium", "Slow"))
        val stageHeightDropdown = JComboBox(arrayOf("Compact (150 px)", "Normal (180 px)", "Tall (210 px)", "Extra tall (240 px)"))
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
        val bgStyleCombo = JComboBox(arrayOf("Scenic", "Legacy"))
        val bgOpacityCombo = JComboBox(arrayOf("Subtle", "Medium", "Vivid"))
        val bgAnimationsCheckbox = JCheckBox("Animate the background (clouds, stars, lights, weather, critters)")
        val perWorkspacePetCheckbox = JCheckBox("Per-project pet (each project gets its own independent pet)")
        val tokenCostClaudeCodeCheckbox = JCheckBox("Today's Token Cost: include Claude Code")
        val tokenCostOpenCodeCheckbox = JCheckBox("Today's Token Cost: include OpenCode")
        val tokenCostCopilotCheckbox = JCheckBox("Today's Token Cost: include GitHub Copilot quota % (Tools > Codotchi: Sign in to GitHub (Copilot Quota))")

        val signInBtn  = JButton("Sign in to GitHub (Leaderboard)")
        val signOutBtn = JButton("Sign out")
        val signInStatusLabel = JBLabel("")
        lbSignInButton  = signInBtn
        lbSignOutButton = signOutBtn
        lbSignInStatus  = signInStatusLabel

        refreshSignInStatus(signInStatusLabel, signInBtn, signOutBtn)

        signInBtn.addActionListener {
            val plugin = ApplicationManager.getApplication().service<CodotchiPlugin>()
            plugin.startLeaderboardSignIn { error ->
                ApplicationManager.getApplication().invokeLater {
                    signInStatusLabel.text = "$error See Sign-in help below."
                }
            }
            signInStatusLabel.text = "Opening browser for sign-in…"
        }
        signOutBtn.addActionListener {
            PasswordSafe.instance.setPassword(CredentialAttributes("Codotchi", "github-pat"), null)
            refreshSignInStatus(signInStatusLabel, signInBtn, signOutBtn)
        }

        fontSizeCombo            = combo
        colorPanel               = cp
        enableAttentionCallsCheck = attentionCheck
        osNotificationsCheck     = osNotificationsCheckbox
        statusBarEnabledCheck    = statusBarEnabledCheckbox
        idleThresholdSpinner     = idleSpinner
        idleDeepThresholdSpinner = deepIdleSpinner
        attentionCallExpiryCombo = expiryCombo
        attentionCallRateCombo   = rateCombo
        stageHeightCombo         = stageHeightDropdown
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
        backgroundStyleCombo           = bgStyleCombo
        backgroundOpacityCombo         = bgOpacityCombo
        backgroundAnimationsCheck      = bgAnimationsCheckbox
        perWorkspacePetCheck           = perWorkspacePetCheckbox
        tokenCostIncludeClaudeCodeCheck = tokenCostClaudeCodeCheckbox
        tokenCostIncludeOpenCodeCheck   = tokenCostOpenCodeCheckbox
        tokenCostIncludeCopilotCheck    = tokenCostCopilotCheckbox

        val panel = JPanel(GridBagLayout())
        val gbc   = GridBagConstraints()
        gbc.insets = Insets(4, 4, 4, 4)
        gbc.anchor = GridBagConstraints.WEST
        var row = 0

        /** Label in column 0, control stretched across column 1. */
        fun addLabeled(target: JPanel, label: String, control: JComponent) {
            gbc.gridx = 0; gbc.gridy = row; gbc.gridwidth = 1
            gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
            target.add(JBLabel(label), gbc)
            gbc.gridx = 1
            gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
            target.add(control, gbc)
            row++
        }

        /** A control spanning both columns (checkboxes, labels). */
        fun addFull(target: JPanel, control: JComponent) {
            gbc.gridx = 0; gbc.gridy = row; gbc.gridwidth = 2
            gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
            target.add(control, gbc)
            gbc.gridwidth = 1
            row++
        }

        // General
        addFull(panel, attentionCheck)
        addLabeled(panel, "Attention call expiry:", expiryCombo)
        addLabeled(panel, "Attention call rate:", rateCombo)
        addFull(panel, osNotificationsCheckbox)
        addFull(panel, statusBarEnabledCheckbox)
        addLabeled(panel, "Pet size:", petSizeDropdown)
        addFull(panel, reducedMotionCheckbox)
        addFull(panel, perWorkspacePetCheckbox)
        addLabeled(panel, "Character passcode:", charPasscodeField)

        // AI mode
        addFull(panel, aiModeCheckbox)

        // Display
        addLabeled(panel, "Pet stage height:", stageHeightDropdown)
        addFull(panel, tokenCostClaudeCodeCheckbox)
        addFull(panel, tokenCostOpenCodeCheckbox)
        addFull(panel, tokenCostCopilotCheckbox)
        addLabeled(panel, "Background:", bgCombo)
        addLabeled(panel, "Background style:", bgStyleCombo)
        addLabeled(panel, "Background opacity:", bgOpacityCombo)
        addFull(panel, bgAnimationsCheckbox)
        addLabeled(panel, "Font size:", combo)
        addLabeled(panel, "Text colour:", cp)

        // Idle
        addLabeled(panel, "Idle threshold (seconds):", idleSpinner)
        addLabeled(panel, "Deep-idle threshold (seconds):", deepIdleSpinner)
        addFull(panel, idleResetDocChangeCheckbox)
        addFull(panel, idleResetCursorCheckbox)
        addFull(panel, idleResetTabCheckbox)
        addFull(panel, idleResetFocusCheckbox)
        addFull(panel, idleResetMouseCheckbox)

        // Leaderboard
        addFull(panel, JBLabel("Leaderboard GitHub account:"))
        addFull(panel, signInStatusLabel)
        gbc.gridx = 0; gbc.gridy = row
        gbc.fill = GridBagConstraints.NONE; gbc.weightx = 0.0
        panel.add(signInBtn, gbc)
        gbc.gridx = 1
        panel.add(signOutBtn, gbc)
        row++
        addFull(panel, com.intellij.ui.components.ActionLink("Sign-in help") {
            com.intellij.ide.BrowserUtil.browse(GITHUB_SIGN_IN_HELP_URL)
        })

        // Developer settings — collapsed by default to keep the page uncluttered
        val devContent = JPanel(GridBagLayout())
        addFull(devContent, devModeEnabledCheckbox)
        addLabeled(devContent, "Developer passcode:", devPasscodeField)
        addLabeled(devContent, "Dev mode aging multiplier:", devAgingSpinner)
        addLabeled(devContent, "Dev mode health floor:", devHealthFloorSpinner)
        val devSection = JPanel(BorderLayout())
        HideableDecorator(devSection, "Developer settings", false).apply {
            setContentComponent(devContent)
            setOn(false)
        }
        gbc.gridx = 0; gbc.gridy = row++; gbc.gridwidth = 2
        gbc.fill = GridBagConstraints.HORIZONTAL; gbc.weightx = 1.0
        panel.add(devSection, gbc)

        // Push content to the top
        gbc.gridx = 0; gbc.gridy = row; gbc.gridwidth = 2
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
        val uiOsNotifications = osNotificationsCheck?.isSelected ?: true
        val uiStatusBarEnabled = statusBarEnabledCheck?.isSelected ?: true
        val uiIdle       = (idleThresholdSpinner?.value as? Int) ?: 60
        val uiDeepIdle   = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        val uiExpiry     = expiryIndexToKey(attentionCallExpiryCombo?.selectedIndex ?: 1)
        val uiRate       = rateIndexToKey(attentionCallRateCombo?.selectedIndex ?: 0)
        val uiStageHeight = stageHeightIndexToKey(stageHeightCombo?.selectedIndex ?: 1)
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
        val uiBgStyle = bgStyleIndexToKey(backgroundStyleCombo?.selectedIndex ?: 0)
        val uiBgOpacity = bgOpacityIndexToKey(backgroundOpacityCombo?.selectedIndex ?: 1)
        val uiBgAnimations = backgroundAnimationsCheck?.isSelected ?: true
        val uiPerWorkspacePet = perWorkspacePetCheck?.isSelected ?: false
        val uiTokenCostClaudeCode = tokenCostIncludeClaudeCodeCheck?.isSelected ?: true
        val uiTokenCostOpenCode = tokenCostIncludeOpenCodeCheck?.isSelected ?: true
        val uiTokenCostCopilot = tokenCostIncludeCopilotCheck?.isSelected ?: false
        return uiFont != settings.fontSize
            || uiColor != settings.textColor
            || uiAttention != settings.enableAttentionCalls
            || uiOsNotifications != settings.osNotifications
            || uiStatusBarEnabled != settings.statusBarEnabled
            || uiIdle != settings.idleThresholdSeconds
            || uiDeepIdle != settings.idleDeepThresholdSeconds
            || uiExpiry != settings.attentionCallExpiry
            || uiRate != settings.attentionCallRate
            || uiStageHeight != settings.stageHeight
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
            || uiBgStyle != settings.backgroundStyle
            || uiBgOpacity != settings.backgroundOpacity
            || uiBgAnimations != settings.backgroundAnimations
            || uiPerWorkspacePet != settings.perWorkspacePet
            || uiTokenCostClaudeCode != settings.tokenCostIncludeClaudeCode
            || uiTokenCostOpenCode != settings.tokenCostIncludeOpenCode
            || uiTokenCostCopilot != settings.tokenCostIncludeCopilot
    }

    override fun apply() {
        val settings = service<CodotchiSettings>()
        settings.fontSize               = fontSizeCombo?.selectedItem?.toString()?.lowercase() ?: "normal"
        settings.textColor              = colorPanel?.selectedColor?.let { colorToHex(it) } ?: "#cccccc"
        settings.enableAttentionCalls   = enableAttentionCallsCheck?.isSelected ?: true
        settings.osNotifications        = osNotificationsCheck?.isSelected ?: true
        settings.statusBarEnabled       = statusBarEnabledCheck?.isSelected ?: true
        settings.idleThresholdSeconds   = (idleThresholdSpinner?.value as? Int) ?: 60
        settings.idleDeepThresholdSeconds = (idleDeepThresholdSpinner?.value as? Int) ?: 600
        settings.attentionCallExpiry    = expiryIndexToKey(attentionCallExpiryCombo?.selectedIndex ?: 1)
        settings.attentionCallRate      = rateIndexToKey(attentionCallRateCombo?.selectedIndex ?: 0)
        settings.stageHeight            = stageHeightIndexToKey(stageHeightCombo?.selectedIndex ?: 1)
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
        settings.backgroundStyle           = bgStyleIndexToKey(backgroundStyleCombo?.selectedIndex ?: 0)
        settings.backgroundOpacity         = bgOpacityIndexToKey(backgroundOpacityCombo?.selectedIndex ?: 1)
        settings.backgroundAnimations      = backgroundAnimationsCheck?.isSelected ?: true
        settings.tokenCostIncludeClaudeCode = tokenCostIncludeClaudeCodeCheck?.isSelected ?: true
        settings.tokenCostIncludeOpenCode   = tokenCostIncludeOpenCodeCheck?.isSelected ?: true
        settings.tokenCostIncludeCopilot    = tokenCostIncludeCopilotCheck?.isSelected ?: false
        val newPerWorkspace = perWorkspacePetCheck?.isSelected ?: false
        val prevPerWorkspace = settings.perWorkspacePet
        settings.perWorkspacePet           = newPerWorkspace
        // Reload the webview immediately so the change is visible without a restart
        val plugin = ApplicationManager.getApplication().service<CodotchiPlugin>()
        if (newPerWorkspace && !prevPerWorkspace) {
            // First enable: copy shared state to project file then restart watcher
            plugin.onPerWorkspacePetEnabled()
        } else if (!newPerWorkspace && prevPerWorkspace) {
            // Disabled: restart watcher on the shared path and reload
            plugin.onPerWorkspacePetDisabled()
        } else {
            plugin.reloadWebview()
        }
    }

    override fun reset() {
        val settings = service<CodotchiSettings>()
        fontSizeCombo?.selectedItem        = settings.fontSize.replaceFirstChar { it.uppercaseChar() }
        colorPanel?.selectedColor          = hexToColor(settings.textColor)
        enableAttentionCallsCheck?.isSelected = settings.enableAttentionCalls
        osNotificationsCheck?.isSelected      = settings.osNotifications
        statusBarEnabledCheck?.isSelected     = settings.statusBarEnabled
        idleThresholdSpinner?.value        = settings.idleThresholdSeconds
        idleDeepThresholdSpinner?.value    = settings.idleDeepThresholdSeconds
        attentionCallExpiryCombo?.selectedIndex = expiryKeyToIndex(settings.attentionCallExpiry)
        attentionCallRateCombo?.selectedIndex   = rateKeyToIndex(settings.attentionCallRate)
        stageHeightCombo?.selectedIndex         = stageHeightKeyToIndex(settings.stageHeight)
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
        backgroundStyleCombo?.selectedIndex        = bgStyleKeyToIndex(settings.backgroundStyle)
        backgroundOpacityCombo?.selectedIndex      = bgOpacityKeyToIndex(settings.backgroundOpacity)
        backgroundAnimationsCheck?.isSelected      = settings.backgroundAnimations
        perWorkspacePetCheck?.isSelected           = settings.perWorkspacePet
        tokenCostIncludeClaudeCodeCheck?.isSelected = settings.tokenCostIncludeClaudeCode
        tokenCostIncludeOpenCodeCheck?.isSelected   = settings.tokenCostIncludeOpenCode
        tokenCostIncludeCopilotCheck?.isSelected    = settings.tokenCostIncludeCopilot
    }

    // ── Enum helpers ───────────────────────────────────────────────────────

    private fun expiryIndexToKey(index: Int) = when (index) { 0 -> "needy"; 2 -> "chilled"; else -> "standard" }
    private fun expiryKeyToIndex(key: String) = when (key) { "needy" -> 0; "chilled" -> 2; else -> 1 }
    private fun rateIndexToKey(index: Int)  = when (index) { 1 -> "medium"; 2 -> "slow"; else -> "fast" }
    private fun rateKeyToIndex(key: String) = when (key) { "medium" -> 1; "slow" -> 2; else -> 0 }
    private fun petSizeIndexToKey(index: Int) = when (index) { 0 -> "small"; 2 -> "large"; else -> "medium" }
    private fun petSizeKeyToIndex(key: String) = when (key) { "small" -> 0; "large" -> 2; else -> 1 }
    private fun stageHeightIndexToKey(index: Int) = when (index) { 0 -> "compact"; 2 -> "tall"; 3 -> "extraTall"; else -> "normal" }
    private fun stageHeightKeyToIndex(key: String) = when (key) { "compact" -> 0; "tall" -> 2; "extraTall" -> 3; else -> 1 }
    private fun bgIndexToKey(index: Int) = when (index) { 0 -> "plain"; 2 -> "spring"; 3 -> "summer"; 4 -> "autumn"; 5 -> "winter"; else -> "ordered" }
    private fun bgKeyToIndex(key: String) = when (key) { "plain" -> 0; "spring" -> 2; "summer" -> 3; "autumn" -> 4; "winter" -> 5; else -> 1 }
    private fun bgStyleIndexToKey(index: Int) = if (index == 1) "legacy" else "scenic"
    private fun bgStyleKeyToIndex(key: String) = if (key == "legacy") 1 else 0
    private fun bgOpacityIndexToKey(index: Int) = when (index) { 0 -> "subtle"; 2 -> "vivid"; else -> "medium" }
    private fun bgOpacityKeyToIndex(key: String) = when (key) { "subtle" -> 0; "vivid" -> 2; else -> 1 }

    private fun refreshSignInStatus(label: JBLabel, signInBtn: JButton, signOutBtn: JButton) {
        val pat = PasswordSafe.instance.getPassword(CredentialAttributes("Codotchi", "github-pat"))
        if (!pat.isNullOrBlank()) {
            val cached = ApplicationManager.getApplication().service<CodotchiPlugin>().getLeaderboardUsername()
            label.text = if (cached != null) "Signed in as @$cached" else "Signed in"
            signInBtn.isEnabled = false
            signOutBtn.isEnabled = true
        } else {
            label.text = "Not signed in — leaderboard pushes are disabled"
            signInBtn.isEnabled = true
            signOutBtn.isEnabled = false
        }
    }

    // ── Colour helpers ─────────────────────────────────────────────────────

    private fun colorToHex(c: Color): String = "#%02x%02x%02x".format(c.red, c.green, c.blue)

    private fun hexToColor(hex: String): Color = try {
        Color.decode(hex)
    } catch (_: NumberFormatException) {
        Color(0xCC, 0xCC, 0xCC)
    }
}
