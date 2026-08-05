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
import org.cef.handler.CefLoadHandler
import org.cef.handler.CefLoadHandlerAdapter
import org.cef.network.CefRequest
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

        // Inject the bridge after every page load; surface an error message if the
        // page fails to load (e.g. missing resource, JCEF initialisation failure).
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

            override fun onLoadError(
                b: CefBrowser,
                frame: CefFrame,
                errorCode: CefLoadHandler.ErrorCode,
                errorText: String?,
                failedUrl: String?,
            ) {
                if (!frame.isMain) return
                val msg = errorText ?: "unknown error"
                val fallbackHtml = """
                    <html><body style='padding:12px;font-family:sans-serif;color:#cc0000;'>
                    <b>Codotchi failed to load the pet panel.</b><br><br>
                    Error: $msg<br><br>
                    Try reopening the tool window or restarting the IDE.
                    </body></html>
                """.trimIndent()
                b.loadURL("data:text/html;charset=utf-8,${java.net.URLEncoder.encode(fallbackHtml, "UTF-8").replace("+", "%20")}")
            }
        }, browser.cefBrowser)

        browser.loadHTML(buildHtml())
    }

    // ── State push ─────────────────────────────────────────────────────────

    /**
     * Push a full state snapshot + mealsGivenThisCycle + highScore + devMode to the webview.
     * Must be called on the EDT (JBCefBrowser.executeJavaScript is EDT-safe).
     */
    fun postState(state: PetState, mealsGivenThisCycle: Int, highScore: HighScore?, devMode: Boolean, unlockedCharacter: String? = null, defaultPetName: String = "Codotchi", liveRank: Int? = null, liveTotalScores: Int? = null, liveSubscribed: Boolean = false, liveLastPushedAt: Long? = null) {
        val stateJson     = gson.toJson(state)
        val highScoreJson = if (highScore != null) gson.toJson(highScore) else "null"
        val unlockedCharJson = if (unlockedCharacter != null) "\"$unlockedCharacter\"" else "null"
        val liveRankJson = liveRank?.toString() ?: "null"
        val liveTotalJson = liveTotalScores?.toString() ?: "null"
        val liveLastPushedJson = liveLastPushedAt?.toString() ?: "null"
        val payload = """{"type":"stateUpdate","state":$stateJson,"mealsGivenThisCycle":$mealsGivenThisCycle,"highScore":$highScoreJson,"devMode":$devMode,"unlockedCharacter":$unlockedCharJson,"defaultPetName":"$defaultPetName","leaderboardAvailable":true,"liveRank":$liveRankJson,"liveTotalScores":$liveTotalJson,"liveSubscribed":$liveSubscribed,"liveLastPushedAt":$liveLastPushedJson}"""
        val js = "window.dispatchEvent(new MessageEvent('message', {data: $payload}));"
        browser.cefBrowser.executeJavaScript(js, browser.cefBrowser.url, 0)
    }

    /** Send an arbitrary JSON payload to the webview as a MessageEvent. */
    fun postMessage(payload: String) {
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
        val stageHeight      = settings?.petStageHeight ?: 240
        val reducedMotion    = settings?.reducedMotion ?: false
        val petSize          = settings?.petSize ?: "medium"
        val background       = settings?.background ?: "ordered"

        val cssText                  = loadResource("/webview/sidebar.css")
        val spriteConstantsText      = loadResource("/webview/spriteConstants.js")
        val customCharactersText     = loadResource("/webview/customCharacters.js")
        val spritesText              = loadResource("/webview/sprites.js")
        val jsText              = loadResource("/webview/sidebar.js")
        var html        = loadResource("/webview/sidebar.html")

        // Substitute font-size class from settings
        html = html.replace("{{fontSizeClass}}", fontSizeClass)

        // Substitute stage height and reduced motion
        html = html.replace("{{stageHeight}}", stageHeight.toString())
        html = html.replace("{{reducedMotion}}", reducedMotion.toString())
        html = html.replace("{{petSize}}", petSize)
        html = html.replace("{{background}}", background)
        html = html.replace("{{idleResetOnMouseMovement}}", "true")

        // Remove the VS Code Content-Security-Policy meta tag — PyCharm uses a native
        // JCEF browser which does not honour webview CSPs and the literal {{cspSource}}
        // placeholder would be left in the DOM if not stripped.
        html = html.replace(Regex("""<meta\s[^>]*Content-Security-Policy[^>]*>"""), "")

        // Inline CSS — replace <link rel="stylesheet" href="{{cssUri}}" />
        // Append a colour override so user preference takes precedence over
        // the CSS default without touching the shared webview CSS file.
        val colorOverride = """
            body { color: $textColor !important; }
        """.trimIndent()
        html = html.replace(
            """<link rel="stylesheet" href="{{cssUri}}" />""",
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

        // Replace <script src="{{spriteConstantsUri}}"></script>, <script src="{{spritesUri}}"></script>,
        // and <script src="{{customCharactersUri}}"></script> with inlined scripts in the correct order.
        // constants must be defined before renderSpriteGrid is called.
        html = html.replace(
            """<script src="{{spriteConstantsUri}}"></script>""",
            "<script>\n$spriteConstantsText\n</script>"
        )
        html = html.replace(
            """<script src="{{spritesUri}}"></script>""",
            "<script>\n$spritesText\n</script>"
        )

        // Replace {{customCharactersUri}} placeholder (VS Code uses a URI; PyCharm inlines it here)
        html = html.replace(
            """<script src="{{customCharactersUri}}"></script>""",
            "<script>\n$customCharactersText\n</script>"
        )

        // Replace <script src="{{jsUri}}"></script> with the shim + sidebar.js inlined
        html = html.replace(
            """<script src="{{jsUri}}"></script>""",
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
