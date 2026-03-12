package com.gotchi

import com.gotchi.engine.*
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.util.concurrency.AppExecutorUtil
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * GotchiPlugin — application-level service that owns the pet state and
 * tick scheduler.
 *
 * Responsibilities:
 *  - Load state from [GotchiPersistence] on [initialize], applying offline decay.
 *  - Schedule a tick every [TICK_INTERVAL_SECONDS] seconds via a fixed-delay
 *    executor (AppExecutorUtil so IntelliJ owns the thread lifecycle).
 *  - Expose [handleCommand] which mirrors sidebarProvider.ts's switch exactly.
 *  - [broadcastState] saves to persistence, posts to browser panel, and updates
 *    the status-bar widget — always on the EDT.
 *
 * This class is registered as an app service in plugin.xml and is created lazily
 * by IntelliJ; [GotchiAppLifecycleListener.appStarted] accesses it to force
 * initialisation.
 */
class GotchiPlugin : Disposable {

    @Volatile private var currentState: PetState? = null
    @Volatile private var currentHighScore: HighScore? = null
    @Volatile private var mealsGivenThisCycle: Int = 0
    @Volatile private var lastCodeActivityTime: Long = 0L

    private var browserPanel:  GotchiBrowserPanel?  = null
    private var statusWidget:  GotchiStatusWidget?  = null

    private var tickFuture: ScheduledFuture<*>? = null

    // ── Initialisation ─────────────────────────────────────────────────────

    fun initialize() {
        val persistence = service<GotchiPersistence>()

        // Restore saved high score
        currentHighScore = persistence.loadHighScore()

        // Restore saved state
        val savedState = persistence.loadPetState()
        if (savedState != null) {
            mealsGivenThisCycle = persistence.mealsGivenThisCycle

            // Apply offline decay
            val elapsedSeconds = if (persistence.lastSaveTimestamp > 0L) {
                ((System.currentTimeMillis() - persistence.lastSaveTimestamp) / 1000L).toInt()
            } else 0

            currentState = if (elapsedSeconds > 0) {
                applyOfflineDecay(savedState, elapsedSeconds)
            } else {
                savedState
            }
        }

        // Start tick scheduler
        tickFuture = AppExecutorUtil.getAppScheduledExecutorService().scheduleWithFixedDelay(
            ::onTick,
            TICK_INTERVAL_SECONDS.toLong(),
            TICK_INTERVAL_SECONDS.toLong(),
            TimeUnit.SECONDS,
        )

        // Initial broadcast so UI reflects restored state immediately
        broadcastState()
    }

    // ── Tick ───────────────────────────────────────────────────────────────

    private fun onTick() {
        val state = currentState ?: return
        currentState = tick(state)
        broadcastState()
    }

    // ── Commands (mirrors sidebarProvider.ts handleWebviewMessage exactly) ─

    fun handleCommand(message: Map<*, *>) {
        val command = message["command"] as? String ?: return
        val state   = currentState

        if (state == null && command != "new_game") return

        // BUGFIX-002: block care actions server-side while pet is sleeping
        val isSleeping = state?.sleeping ?: false
        val sleepBlocked = setOf("feed", "play", "clean", "medicine", "praise", "scold")
        if (isSleeping && command in sleepBlocked) return

        var nextState: PetState? = null

        when (command) {
            "feed" -> {
                state ?: return
                val feedType = message["feedType"] as? String
                nextState = if (feedType == "snack") {
                    feedSnack(state)
                } else {
                    val ns = feedMeal(state, mealsGivenThisCycle)
                    if ("fed_meal" in ns.events) mealsGivenThisCycle++
                    ns
                }
            }

            "play" -> {
                state ?: return
                var ns = play(state)
                val game   = message["game"]   as? String
                val result = message["result"] as? String
                if (game != null && result != null && "play_refused_no_energy" !in ns.events) {
                    ns = applyMinigameResult(ns, game, result)
                }
                nextState = ns
            }

            "sleep" -> {
                state ?: return
                val ns = sleep(state)
                if ("fell_asleep" in ns.events) mealsGivenThisCycle = 0
                nextState = ns
            }

            "wake" -> {
                state ?: return
                nextState = wake(state)
            }

            "clean" -> {
                state ?: return
                nextState = clean(state)
            }

            "medicine" -> {
                state ?: return
                nextState = giveMedicine(state)
            }

            "scold" -> {
                state ?: return
                nextState = scold(state)
            }

            "praise" -> {
                state ?: return
                nextState = praise(state)
            }

            "new_game" -> {
                val name    = (message["name"]    as? String) ?: "Gotchi"
                val petType = (message["petType"] as? String) ?: "codeling"
                val color   = (message["color"]   as? String) ?: "neon"
                nextState = createPet(name, petType, color)
                mealsGivenThisCycle = 0
            }

            else -> return
        }

        if (nextState != null) {
            currentState = nextState
            broadcastState()
        }
    }

    // ── Code-activity trigger (called by GotchiEventsManager) ─────────────

    fun triggerCodeActivity() {
        val now = System.currentTimeMillis()
        if (now - lastCodeActivityTime < CODE_ACTIVITY_THROTTLE_SECONDS * 1000L) return
        lastCodeActivityTime = now
        val state = currentState ?: return
        currentState = applyCodeActivity(state)
        broadcastState()
    }

    // ── Panel / widget registration ────────────────────────────────────────

    fun setBrowserPanel(panel: GotchiBrowserPanel) {
        browserPanel = panel
        broadcastState()
    }

    fun setStatusWidget(widget: GotchiStatusWidget) {
        statusWidget = widget
        broadcastState()
    }

    /**
     * Reload the JCEF webview with freshly built HTML (picks up new settings),
     * then re-push the current state so the UI is up to date immediately.
     * Called by [GotchiConfigurable] after the user clicks Apply.
     */
    fun reloadWebview() {
        ApplicationManager.getApplication().invokeLater {
            browserPanel?.reload()
            broadcastState()
        }
    }

    // ── Broadcast ──────────────────────────────────────────────────────────

    fun broadcastState() {
        val state = currentState
        val meals = mealsGivenThisCycle

        // Persist on every broadcast so crashes don't lose state
        val persistence = service<GotchiPersistence>()
        if (state != null) {
            persistence.savePetState(state)
            persistence.mealsGivenThisCycle = meals

            // Update high score when pet dies
            if (!state.alive) {
                val diedAt    = System.currentTimeMillis()
                val elapsed   = if (state.spawnedAt > 0L) diedAt - state.spawnedAt else 0L
                val prevScore = currentHighScore
                val prevElapsed = if (prevScore != null) prevScore.diedAt - prevScore.spawnedAt else -1L
                val isNewRecord = prevScore == null ||
                    state.ageDays > prevScore.ageDays ||
                    (state.ageDays == prevScore.ageDays && elapsed > prevElapsed)
                if (isNewRecord) {
                    val newScore = HighScore(
                        ageDays   = state.ageDays,
                        name      = state.name,
                        stage     = state.stage,
                        petType   = state.petType,
                        color     = state.color,
                        spawnedAt = state.spawnedAt,
                        diedAt    = diedAt,
                    )
                    currentHighScore = newScore
                    persistence.saveHighScore(newScore)
                }
            }
        }
        persistence.lastSaveTimestamp = System.currentTimeMillis()

        val highScore = currentHighScore
        ApplicationManager.getApplication().invokeLater {
            if (state != null) {
                browserPanel?.postState(state, meals, highScore)
                statusWidget?.update(state)
            }
        }
    }

    // ── Disposable ─────────────────────────────────────────────────────────

    override fun dispose() {
        tickFuture?.cancel(false)
    }
}
