package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * Guards against the race-condition regression where setBrowserPanel() calls
 * broadcastState() immediately, before the JCEF page has finished loading.
 * At that point the sidebar.js message listener does not exist, so the state
 * dispatch is silently dropped and sprites never render.
 *
 * The correct design: onReady() in CodotchiBrowserPanel fires after onLoadEnd
 * (once the JS bridge is injected) and calls broadcastState() safely.
 * setBrowserPanel() must NOT call broadcastState() itself.
 *
 * Fixed: BUGFIX-090 (v1.8.1)
 *
 * This test inspects the source text of CodotchiPlugin.kt as a static
 * source-guard assertion — if the offending call is ever reintroduced the test
 * will fail immediately, before any build or runtime step.
 */
class PluginStateBroadcastTest {

    // Read CodotchiPlugin.kt source from the classpath (bundled as a test resource).
    // The Gradle test task is configured to include src/main/kotlin on the test
    // resource path so we can load source files for static analysis.
    private fun pluginSource(): String {
        val stream = PluginStateBroadcastTest::class.java
            .getResourceAsStream("/source/CodotchiPlugin.kt")
            ?: error(
                "CodotchiPlugin.kt not found on test classpath. " +
                "Ensure the copySourceForTest task ran before the test task."
            )
        return stream.bufferedReader().readText()
    }

    @Test
    fun `setBrowserPanel does not call broadcastState`() {
        val source = pluginSource()

        // Locate the setBrowserPanel function body
        val fnStart = source.indexOf("fun setBrowserPanel(")
        assertTrue(fnStart >= 0, "setBrowserPanel function must exist in CodotchiPlugin.kt")

        // Find the closing brace of the function (first } after the opening {)
        val braceOpen  = source.indexOf('{', fnStart)
        assertTrue(braceOpen >= 0, "setBrowserPanel must have an opening brace")

        var depth = 1
        var i     = braceOpen + 1
        while (i < source.length && depth > 0) {
            when (source[i]) {
                '{' -> depth++
                '}' -> depth--
            }
            i++
        }
        val fnBody = source.substring(braceOpen, i)

        assertFalse(
            // Strip single-line comments before checking, so comment text like
            // "// Do NOT call broadcastState() here" does not cause false failures.
            fnBody.lines()
                .map { it.replace(Regex("//.*$"), "") }
                .joinToString("\n")
                .contains("broadcastState()"),
            """
            setBrowserPanel() must NOT call broadcastState() directly.
            
            Reason: setBrowserPanel is called when the tool-window panel is first
            registered, which happens BEFORE the JCEF page has finished loading.
            At that point the sidebar.js 'message' event listener does not exist,
            so window.dispatchEvent(...) is silently dropped and sprites never render.
            
            The correct path: CodotchiBrowserPanel.onReady() calls broadcastState()
            AFTER onLoadEnd fires and the JS bridge is injected.  See BUGFIX-090.
            """.trimIndent()
        )
    }

    @Test
    fun `setBrowserPanel assigns the panel field`() {
        val source  = pluginSource()
        val fnStart = source.indexOf("fun setBrowserPanel(")
        val braceOpen = source.indexOf('{', fnStart)
        var depth = 1
        var i     = braceOpen + 1
        while (i < source.length && depth > 0) {
            when (source[i]) { '{' -> depth++; '}' -> depth-- }
            i++
        }
        val fnBody = source.substring(braceOpen, i)

        assertTrue(
            fnBody.contains("browserPanel = panel"),
            "setBrowserPanel must assign the panel to the browserPanel field"
        )
    }
}
