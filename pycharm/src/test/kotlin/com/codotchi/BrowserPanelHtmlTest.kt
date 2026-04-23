package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Guards against the regression where spriteConstants.js is not inlined into
 * the PyCharm webview HTML, causing sprites to render blank.
 *
 * First occurred: commit db0602e (sprites.js inlining added)
 * Re-occurred:    commit 519ef11 (spriteConstants.js extracted but not inlined)
 * Fixed:          BUGFIX-090 (v1.8.1)
 *
 * These tests load the raw webview resource files from the classpath (the same
 * way CodotchiBrowserPanel.buildHtml() does) and assert that the substitution
 * placeholders and ordering are correct — without needing a running IDE or JCEF.
 */
class BrowserPanelHtmlTest {

    // Load a classpath resource the same way CodotchiBrowserPanel does —
    // but via the test classloader to avoid loading IntelliJ/JCEF platform
    // classes that are not available in the unit-test classpath.
    private fun loadResource(path: String): String =
        BrowserPanelHtmlTest::class.java.getResourceAsStream(path)
            ?.bufferedReader()
            ?.readText()
            ?: error("Missing classpath resource: $path")

    // Simulate the key substitution from buildHtml() so we can inspect output.
    private fun buildInlinedHtml(): String {
        val spriteConstantsText = loadResource("/webview/spriteConstants.js")
        val spritesText         = loadResource("/webview/sprites.js")
        var html                = loadResource("/webview/sidebar.html")

        html = html.replace(
            """<script src="sprites.js"></script>""",
            "<script>\n$spriteConstantsText\n</script>\n<script>\n$spritesText\n</script>"
        )
        return html
    }

    @Test
    fun `spriteConstants resource exists on classpath`() {
        val content = loadResource("/webview/spriteConstants.js")
        assertTrue(content.isNotBlank(), "spriteConstants.js must not be empty")
    }

    @Test
    fun `sprites resource exists on classpath`() {
        val content = loadResource("/webview/sprites.js")
        assertTrue(content.isNotBlank(), "sprites.js must not be empty")
    }

    @Test
    fun `sidebar html has sprites script placeholder`() {
        val html = loadResource("/webview/sidebar.html")
        assertTrue(
            html.contains("""<script src="sprites.js"></script>"""),
            "sidebar.html must contain <script src=\"sprites.js\"></script> for CodotchiBrowserPanel to inline"
        )
    }

    @Test
    fun `built html contains spriteConstants content inline`() {
        val html = buildInlinedHtml()
        // STAGE_SCALES is a unique identifier declared only in spriteConstants.js
        assertTrue(
            html.contains("STAGE_SCALES"),
            "Built HTML must contain inlined spriteConstants.js content (expected STAGE_SCALES declaration)"
        )
    }

    @Test
    fun `built html contains sprites content inline`() {
        val html = buildInlinedHtml()
        // renderSpriteGrid is a function declared only in sprites.js
        assertTrue(
            html.contains("renderSpriteGrid"),
            "Built HTML must contain inlined sprites.js content (expected renderSpriteGrid function)"
        )
    }

    @Test
    fun `spriteConstants content appears before sprites content in built html`() {
        val html = buildInlinedHtml()

        // Use identifiers that are unique to each file so indexOf is unambiguous.
        // STAGE_SCALES is declared only in spriteConstants.js.
        // renderSpriteGrid is declared only in sprites.js.
        val constantsIdx = html.indexOf("STAGE_SCALES")
        val spritesIdx   = html.indexOf("renderSpriteGrid")

        assertTrue(constantsIdx >= 0, "STAGE_SCALES (from spriteConstants.js) must appear in built HTML")
        assertTrue(spritesIdx >= 0,   "renderSpriteGrid (from sprites.js) must appear in built HTML")
        assertTrue(
            constantsIdx < spritesIdx,
            "spriteConstants.js must be inlined BEFORE sprites.js — constants must be defined before renderSpriteGrid is called"
        )
    }

    @Test
    fun `built html has no literal script src for sprites js`() {
        val html = buildInlinedHtml()
        assertFalse(
            html.contains("""<script src="sprites.js"></script>"""),
            "Built HTML must not contain a literal <script src=\"sprites.js\"> — it must be fully inlined"
        )
    }

    @Test
    fun `built html has no literal script src for spriteConstants js`() {
        val html = buildInlinedHtml()
        assertFalse(
            html.contains("""<script src="spriteConstants.js"></script>"""),
            "Built HTML must not contain a literal <script src=\"spriteConstants.js\"> — it must be inlined via the sprites.js placeholder"
        )
    }
}
