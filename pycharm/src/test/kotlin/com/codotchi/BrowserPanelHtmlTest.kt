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
 * Updated:        BUGFIX-107 (v2.0.2) — HTML now uses {{...Uri}} placeholders
 *                 instead of literal <script src="..."> tags; tests updated to match.
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
    // Mirrors the {{...Uri}} replacement logic in CodotchiBrowserPanel.buildHtml().
    private fun buildInlinedHtml(): String {
        val spriteConstantsText = loadResource("/webview/spriteConstants.js")
        val spritesText         = loadResource("/webview/sprites.js")
        var html                = loadResource("/webview/sidebar.html")

        html = html.replace(
            """<script src="{{spriteConstantsUri}}"></script>""",
            "<script>\n$spriteConstantsText\n</script>"
        )
        html = html.replace(
            """<script src="{{spritesUri}}"></script>""",
            "<script>\n$spritesText\n</script>"
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
    fun `customCharacters resource exists on classpath`() {
        val content = loadResource("/webview/customCharacters.js")
        assertTrue(content.isNotBlank(), "customCharacters.js must not be empty")
    }

    @Test
    fun `sidebar html has sprites script placeholder`() {
        val html = loadResource("/webview/sidebar.html")
        assertTrue(
            html.contains("""<script src="{{spritesUri}}"></script>"""),
            "sidebar.html must contain <script src=\"{{spritesUri}}\"></script> for CodotchiBrowserPanel to inline"
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
    fun `sprite preview includes kangaroo in the gallery list`() {
        val html = loadResource("/webview/sprite_preview.html")
        assertTrue(
            html.contains("\"kangaroo\""),
            "sprite_preview.html must include kangaroo in ALL_ANIMALS so it appears in the preview gallery"
        )
    }

    @Test
    fun `sprite preview derives gallery list from loaded sprite data`() {
        val html = loadResource("/webview/sprite_preview.html")
        assertTrue(
            html.contains("Object.keys(window.SPRITES)"),
            "sprite_preview.html must append Object.keys(window.SPRITES) so newly-added sprite data appears in preview"
        )
    }

    @Test
    fun `kangaroo sprite data exists`() {
        val spritesText = loadResource("/webview/sprites.js")
        assertTrue(
            spritesText.contains("DEFS[\"kangaroo\"]"),
            "sprites.js must contain kangaroo sprite data for the preview renderer"
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
            html.contains("""<script src="{{spritesUri}}"></script>"""),
            "Built HTML must not contain a literal <script src=\"{{spritesUri}}\"> — it must be fully inlined"
        )
    }

    @Test
    fun `built html has no literal script src for spriteConstants js`() {
        val html = buildInlinedHtml()
        assertFalse(
            html.contains("""<script src="{{spriteConstantsUri}}"></script>"""),
            "Built HTML must not contain a literal <script src=\"{{spriteConstantsUri}}\"> — it must be inlined"
        )
    }

    @Test
    fun `renderSpriteGrid function body is not truncated by a spurious closing brace`() {
        // Regression test for BUGFIX-091: a stray '};' after the colorMap object
        // literal caused renderSpriteGrid to return immediately, leaving the canvas
        // blank.  This test verifies the function contains the pixel-draw loop that
        // must execute after colorMap is built.
        val spritesText = loadResource("/webview/sprites.js")

        // The pixel drawing loop must exist after the colorMap declaration.
        // "ctx.save()" and the grid iteration are reliable markers that appear
        // only inside the functional body of renderSpriteGrid, after colorMap.
        val colorMapIdx = spritesText.indexOf("5: \"#FFD700\"")
        assertTrue(colorMapIdx >= 0, "sprites.js must contain the colorMap with index 5")

        val ctxSaveAfterColorMap = spritesText.indexOf("ctx.save()", colorMapIdx)
        assertTrue(
            ctxSaveAfterColorMap > colorMapIdx,
            "ctx.save() must appear AFTER the colorMap declaration in sprites.js — " +
            "if this fails, renderSpriteGrid has a spurious closing brace that truncates it (BUGFIX-091)"
        )

        // Additionally verify there is no double '};' sequence immediately after the colorMap close.
        val colorMapClose = spritesText.indexOf("};", colorMapIdx)
        assertTrue(colorMapClose > colorMapIdx, "colorMap must have a closing };")
        val afterClose = spritesText.substring(colorMapClose + 2).trimStart()
        assertFalse(
            afterClose.startsWith("};"),
            "There must not be a second immediate '};' after the colorMap close — " +
            "that would be the spurious brace that truncates renderSpriteGrid (BUGFIX-091)"
        )
    }
}
