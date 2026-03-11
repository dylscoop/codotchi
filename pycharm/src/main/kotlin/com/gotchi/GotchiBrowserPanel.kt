package com.gotchi

import com.google.gson.Gson
import com.gotchi.engine.PetState
import com.intellij.openapi.Disposable
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JPanel

/**
 * GotchiBrowserPanel — wraps a JCEF browser and bridges the webview
 * message protocol used by sidebar.js.
 *
 * Build process:
 *  1. [buildHtml] reads `/webview/sidebar.html` from the classpath,
 *     strips VS Code-specific placeholders, inlines CSS and the
 *     acquireVsCodeApi shim + JS.
 *  2. A [JBCefJSQuery] is installed on load-end, injected as
 *     `window.__vscodeSendMessage`, which sidebar.js calls via its
 *     `acquireVsCodeApi().postMessage` shim.
 *  3. [postState] sends a full state snapshot to the webview by calling
 *     `window.dispatchEvent(new MessageEvent('message', {data: <json>}))`.
 *
 * Callers must pass a [messageHandler] to receive commands from the JS.
 */
class GotchiBrowserPanel(
    private val messageHandler: (Map<*, *>) -> Unit,
    parentDisposable: Disposable,
) : Disposable {

    private val gson    = Gson()
    private val browser = JBCefBrowser()
    private val jsQuery = JBCefJSQuery.create(browser)

    /** Swing component to embed in the tool-window. */
    val component: JPanel = JPanel(BorderLayout()).also { it.add(browser.component) }

    init {
        // Wire JS → Kotlin: sidebar.js calls window.__vscodeSendMessage(jsonString)
        jsQuery.addHandler { jsonStr ->
            try {
                @Suppress("UNCHECKED_CAST")
                val map = gson.fromJson(jsonStr, Map::class.java) as? Map<*, *>
                if (map != null) messageHandler(map)
            } catch (_: Exception) { /* ignore malformed messages */ }
            null   // no return value needed
        }

        // Inject the bridge after every page load
        browser.jbCefClient.addLoadHandler(object : CefLoadHandlerAdapter() {
            override fun onLoadEnd(b: CefBrowser, frame: CefFrame, httpStatusCode: Int) {
                if (!frame.isMain) return
                val injectScript = """
                    (function() {
                        window.__vscodeSendMessage = function(jsonStr) {
                            ${jsQuery.inject("jsonStr")}
                        };
                    })();
                """.trimIndent()
                b.executeJavaScript(injectScript, b.url, 0)
            }
        }, browser.cefBrowser)

        browser.loadHTML(buildHtml())
    }

    // ── State push ─────────────────────────────────────────────────────────

    /**
     * Push a full state snapshot + mealsGivenThisCycle to the webview.
     * Must be called on the EDT (JBCefBrowser.executeJavaScript is EDT-safe).
     */
    fun postState(state: PetState, mealsGivenThisCycle: Int) {
        val stateJson = gson.toJson(state)
        val payload   = """{"type":"stateUpdate","state":$stateJson,"mealsGivenThisCycle":$mealsGivenThisCycle}"""
        val js = "window.dispatchEvent(new MessageEvent('message', {data: $payload}));"
        browser.cefBrowser.executeJavaScript(js, browser.cefBrowser.url, 0)
    }

    // ── HTML builder ───────────────────────────────────────────────────────

    private fun buildHtml(): String {
        val cssText  = loadResource("/webview/sidebar.css")
        val jsText   = loadResource("/webview/sidebar.js")
        var html     = loadResource("/webview/sidebar.html")

        // Substitute font-size class (default "font-normal" until a setting is wired up)
        html = html.replace("{{fontSizeClass}}", "font-normal")

        // Inline CSS — replace <link rel="stylesheet" href="sidebar.css" />
        html = html.replace(
            """<link rel="stylesheet" href="sidebar.css" />""",
            "<style>\n$cssText\n</style>"
        )

        // Build the acquireVsCodeApi shim + sidebar.js as a single inline script block.
        // The shim maps vscode.postMessage(msg) → window.__vscodeSendMessage(JSON.stringify(msg)).
        val shimAndJs = """
            (function() {
                window.acquireVsCodeApi = function() {
                    return {
                        postMessage: function(msg) {
                            if (window.__vscodeSendMessage) {
                                window.__vscodeSendMessage(JSON.stringify(msg));
                            }
                        },
                        getState:    function() { return {}; },
                        setState:    function() {}
                    };
                };
            })();
            $jsText
        """.trimIndent()

        // Replace <script src="sidebar.js"></script>
        html = html.replace(
            """<script src="sidebar.js"></script>""",
            "<script>\n$shimAndJs\n</script>"
        )

        return html
    }

    private fun loadResource(path: String): String =
        GotchiBrowserPanel::class.java.getResourceAsStream(path)
            ?.bufferedReader()
            ?.readText()
            ?: error("Missing classpath resource: $path")

    // ── Disposable ─────────────────────────────────────────────────────────

    override fun dispose() {
        jsQuery.dispose()
        browser.dispose()
    }
}
