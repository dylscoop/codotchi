package com.codotchi

import com.google.gson.Gson
import com.codotchi.engine.PetState
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.ui.jcef.JBCefBrowser
import com.intellij.ui.jcef.JBCefJSQuery
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.handler.CefLoadHandlerAdapter
import java.awt.BorderLayout
import javax.swing.JPanel

/**
 * CodotchiBrowserPanel — wraps a JCEF browser and bridges the webview
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
 * The optional [onReady] callback is invoked after every page load (initial
 * load and any subsequent reloads) once the JS bridge is injected and the
 * page is guaranteed ready to receive messages.  Use it to push an initial
 * state snapshot so the webview never sits in a state-less limbo.
 */
class CodotchiBrowserPanel(
    private val messageHandler: (Map<*, *>) -> Unit,
    parentDisposable: Disposable,
    private val onReady: () -> Unit = {},
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
                // Notify the caller that the page is ready and the bridge is
                // injected — safe to push state now.
                onReady()
            }
        }, browser.cefBrowser)

        browser.loadHTML(buildHtml())
    }

    // ── State push ─────────────────────────────────────────────────────────

    /**
     * Push a full state snapshot + mealsGivenThisCycle + highScore + devMode to the webview.
     * Must be called on the EDT (JBCefBrowser.executeJavaScript is EDT-safe).
     */
    fun postState(state: PetState, mealsGivenThisCycle: Int, highScore: HighScore?, devMode: Boolean) {
        val stateJson     = gson.toJson(state)
        val highScoreJson = if (highScore != null) gson.toJson(highScore) else "null"
        val payload = """{"type":"stateUpdate","state":$stateJson,"mealsGivenThisCycle":$mealsGivenThisCycle,"highScore":$highScoreJson,"devMode":$devMode}"""
        val js = "window.dispatchEvent(new MessageEvent('message', {data: $payload}));"
        browser.cefBrowser.executeJavaScript(js, browser.cefBrowser.url, 0)
    }

    /**
     * Reload the webview with freshly built HTML (picks up latest settings).
     * Safe to call from any thread — defers to the EDT internally via JCEF.
     */
    fun reload() {
        browser.loadHTML(buildHtml())
    }

    // ── HTML builder ───────────────────────────────────────────────────────

    private fun buildHtml(): String {
        val settings      = ApplicationManager.getApplication().getService(CodotchiSettings::class.java)
        val fontSizeClass = "font-${settings?.fontSize ?: "normal"}"
        val textColor     = settings?.textColor ?: "#cccccc"
        val customPrimary    = settings?.customPrimaryColor    ?: "#ff8c00"
        val customSecondary  = settings?.customSecondaryColor  ?: "#ffffff"
        val customBackground = settings?.customBackgroundColor ?: "#1a1a2e"
        val stageHeight      = settings?.petStageHeight ?: 160
        val reducedMotion    = settings?.reducedMotion ?: false
        val petSize          = settings?.petSize ?: "medium"

        val cssText     = loadResource("/webview/sidebar.css")
        val spritesText = loadResource("/webview/sprites.js")
        val jsText      = loadResource("/webview/sidebar.js")
        var html        = loadResource("/webview/sidebar.html")

        // Substitute font-size class from settings
        html = html.replace("{{fontSizeClass}}", fontSizeClass)

        // Substitute stage height and reduced motion
        html = html.replace("{{stageHeight}}", stageHeight.toString())
        html = html.replace("{{reducedMotion}}", reducedMotion.toString())
        html = html.replace("{{petSize}}", petSize)

        // Inline CSS — replace <link rel="stylesheet" href="sidebar.css" />
        // Append a colour override so user preference takes precedence over
        // the CSS default without touching the shared webview CSS file.
        val colorOverride = """
            body { color: $textColor !important; }
            :root {
                --codotchi-custom-primary: $customPrimary;
                --codotchi-custom-secondary: $customSecondary;
                --codotchi-custom-background: $customBackground;
            }
        """.trimIndent()
        html = html.replace(
            """<link rel="stylesheet" href="sidebar.css" />""",
            "<style>\n$cssText\n$colorOverride\n</style>"
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

        // Replace <script src="sprites.js"></script> with an inline block.
        // Must come before sidebar.js is inlined so renderSpriteGrid is defined first.
        html = html.replace(
            """<script src="sprites.js"></script>""",
            "<script>\n$spritesText\n</script>"
        )

        // Replace <script src="sidebar.js"></script>
        html = html.replace(
            """<script src="sidebar.js"></script>""",
            "<script>\n$shimAndJs\n</script>"
        )

        return html
    }

    private fun loadResource(path: String): String =
        CodotchiBrowserPanel::class.java.getResourceAsStream(path)
            ?.bufferedReader()
            ?.readText()
            ?: error("Missing classpath resource: $path")

    // ── Disposable ─────────────────────────────────────────────────────────

    override fun dispose() {
        jsQuery.dispose()
        browser.dispose()
    }
}
