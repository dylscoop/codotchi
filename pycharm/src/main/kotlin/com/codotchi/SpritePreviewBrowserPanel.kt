package com.codotchi

import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.ui.jcef.JBCefBrowser
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JPanel

/**
 * SpritePreviewBrowserPanel — wraps a JCEF browser to display the sprite
 * preview gallery (sprite_preview.html).
 *
 * Displayed by [OpenSpritePreviewAction] in a standalone dialog.
 * No message bridge is needed: the preview is read-only HTML+canvas.
 */
class SpritePreviewBrowserPanel(parentDisposable: Disposable) : Disposable {

    private val browser = JBCefBrowser()

    /** Swing component to embed in the dialog/tool window. */
    val component: JPanel = JPanel(BorderLayout()).also { it.add(browser.component) }

    init {
        browser.loadHTML(buildHtml())
    }

    // ── HTML builder ───────────────────────────────────────────────────────

    private fun buildHtml(): String {
        val spriteConstantsText = loadResource("/webview/spriteConstants.js")
        val spritesText         = loadResource("/webview/sprites.js")
        val spritesAdultText    = loadResource("/webview/sprites_adult.js")
        var html                = loadResource("/webview/sprite_preview.html")

        // Inline spriteConstants.js
        html = html.replace(
            """<script src="spriteConstants.js"></script>""",
            "<script>\n$spriteConstantsText\n</script>"
        )

        // Inline sprites.js
        html = html.replace(
            """<script src="sprites.js"></script>""",
            "<script>\n$spritesText\n</script>"
        )

        // Inline sprites_adult.js
        html = html.replace(
            """<script src="sprites_adult.js"></script>""",
            "<script>\n$spritesAdultText\n</script>"
        )

        return html
    }

    private fun loadResource(path: String): String =
        SpritePreviewBrowserPanel::class.java.getResourceAsStream(path)
            ?.bufferedReader()
            ?.readText()
            ?: error("Missing classpath resource: $path")

    // ── Disposable ─────────────────────────────────────────────────────────

    override fun dispose() {
        browser.dispose()
    }
}
