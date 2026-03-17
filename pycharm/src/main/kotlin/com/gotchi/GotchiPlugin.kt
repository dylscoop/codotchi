package com.gotchi

import com.gotchi.engine.*
import com.intellij.ide.DataManager
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.util.concurrency.AppExecutorUtil
import java.awt.AWTEvent
import java.awt.Toolkit
import java.awt.event.AWTEventListener
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

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

    /**
     * Guards all reads and writes of [currentState], [currentHighScore], and
     * [mealsGivenThisCycle] so that [onTick] (AppExecutorUtil thread) and
     * [handleCommand] / [triggerCodeActivity] (JCEF JS-query handler thread)
     * cannot interleave.  Without this lock the two threads can both read the
     * current state, compute independent next-states, and then the slower writer
     * silently discards the faster writer's changes — causing, for example, the
     * gift attention-call to be already expired by the time [praise] runs
     * (BUGFIX-022).
     */
    private val stateLock = ReentrantLock()

    private var currentState: PetState? = null
    private var currentHighScore: HighScore? = null
    private var mealsGivenThisCycle: Int = 0
    @Volatile private var lastCodeActivityTime: Long = 0L

    /** Timestamp of the last detected keyboard or mouse activity in the IDE. */
    @Volatile private var lastActivityTime: Long = System.currentTimeMillis()

    /** AWT listener that updates [lastActivityTime] on any key press or mouse event. */
    private val awtActivityListener = AWTEventListener {
        lastActivityTime = System.currentTimeMillis()
    }

    private fun isIdle(): Boolean =
        System.currentTimeMillis() - lastActivityTime > service<GotchiSettings>().idleThresholdSeconds * 1000L

    private fun isDeepIdle(): Boolean =
        System.currentTimeMillis() - lastActivityTime > service<GotchiSettings>().idleDeepThresholdSeconds * 1000L

    private var browserPanel:  GotchiBrowserPanel?  = null
    private var statusWidget:  GotchiStatusWidget?  = null

    private var tickFuture: ScheduledFuture<*>? = null

    // ── Initialisation ─────────────────────────────────────────────────────

    fun initialize() {
        // Register AWT event listener to track keyboard/mouse activity for idle detection
        val activityMask = AWTEvent.KEY_EVENT_MASK or
            AWTEvent.MOUSE_EVENT_MASK or
            AWTEvent.MOUSE_MOTION_EVENT_MASK
        Toolkit.getDefaultToolkit().addAWTEventListener(awtActivityListener, activityMask)

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
        val ticked = stateLock.withLock {
            val state = currentState ?: return@withLock false
            val settings = service<GotchiSettings>()

            // Map attentionCallExpiry setting to tick count.
            val expiryMap = mapOf("needy" to 20, "standard" to 50, "chilled" to 100)
            val attentionCallExpiryTicks = expiryMap[settings.attentionCallExpiry] ?: 50

            // Map attentionCallRate setting to rate divisor.
            val rateMap = mapOf("fast" to 1.0, "medium" to 1.5, "slow" to 2.0)
            val attentionCallRateDivisor = rateMap[settings.attentionCallRate] ?: 1.0

            val gameConfig = com.gotchi.engine.GameConfig(
                attentionCallsEnabled    = settings.enableAttentionCalls,
                attentionCallExpiryTicks = attentionCallExpiryTicks,
                attentionCallRateDivisor = attentionCallRateDivisor,
            )
            currentState = tick(state, isIdle(), isDeepIdle(), gameConfig)
            true
        }
        if (ticked) broadcastState()
    }

    // ── Commands (mirrors sidebarProvider.ts handleWebviewMessage exactly) ─

    fun handleCommand(message: Map<*, *>) {
        val command = message["command"] as? String ?: return

        // Any incoming command means the user is actively using the sidebar —
        // reset the idle timer immediately (BUGFIX-015).
        lastActivityTime = System.currentTimeMillis()

        // BUGFIX-022: hold stateLock while reading and updating currentState so
        // this handler and onTick cannot interleave (one would otherwise silently
        // overwrite the other's changes with a stale-snapshot result).
        var shouldBroadcast = false
        stateLock.withLock {
            val state   = currentState

            if (state == null && command != "new_game") return@withLock

            // BUGFIX-002: block care actions server-side while pet is sleeping
            val isSleeping = state?.sleeping ?: false
            val sleepBlocked = setOf("feed", "play", "pat", "clean", "medicine", "praise", "scold")
            if (isSleeping && command in sleepBlocked) return@withLock

            var nextState: PetState? = null

            when (command) {
                "feed" -> {
                    state ?: return@withLock
                    val feedType = message["feedType"] as? String
                    nextState = if (feedType == "snack") {
                        startSnack(state)
                    } else {
                        val ns = feedMeal(state, mealsGivenThisCycle)
                        if ("fed_meal" in ns.events) mealsGivenThisCycle++
                        ns
                    }
                }

                "snack_consumed" -> {
                    state ?: return@withLock
                    nextState = consumeSnack(state)
                }

                "play" -> {
                    state ?: return@withLock
                    var ns = play(state)
                    val game   = message["game"]   as? String
                    val result = message["result"] as? String
                    if (game != null && result != null && "play_refused_no_energy" !in ns.events) {
                        ns = applyMinigameResult(ns, game, result)
                    }
                    nextState = ns
                }

                "sleep" -> {
                    state ?: return@withLock
                    val ns = sleep(state)
                    if ("fell_asleep" in ns.events) mealsGivenThisCycle = 0
                    nextState = ns
                }

                "wake" -> {
                    state ?: return@withLock
                    nextState = wake(state)
                }

                "clean" -> {
                    state ?: return@withLock
                    nextState = clean(state)
                }

                "medicine" -> {
                    state ?: return@withLock
                    nextState = giveMedicine(state)
                }

                "scold" -> {
                    state ?: return@withLock
                    nextState = scold(state)
                }

                "praise" -> {
                    state ?: return@withLock
                    nextState = praise(state)
                }

                "pat" -> {
                    state ?: return@withLock
                    nextState = pat(state)
                }

                "new_game" -> {
                    val name    = (message["name"]    as? String) ?: "Gotchi"
                    val petType = (message["petType"] as? String) ?: "codeling"
                    val color   = (message["color"]   as? String) ?: "neon"
                    nextState = createPet(name, petType, color)
                    mealsGivenThisCycle = 0
                }

                // Idle timer already reset above; no state change needed (BUGFIX-015).
                "user_activity" -> return@withLock

                else -> return@withLock
            }

            if (nextState != null) {
                currentState = nextState
                shouldBroadcast = true
            }
        }

        if (shouldBroadcast) broadcastState()
    }

    // ── Code-activity trigger (called by GotchiEventsManager) ─────────────

    fun triggerCodeActivity() {
        val now = System.currentTimeMillis()
        if (now - lastCodeActivityTime < CODE_ACTIVITY_THROTTLE_SECONDS * 1000L) return
        lastCodeActivityTime = now
        val ticked = stateLock.withLock {
            val state = currentState ?: return@withLock false
            currentState = applyCodeActivity(state)
            true
        }
        if (ticked) broadcastState()
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
        // Take a consistent snapshot under the lock so we never observe a
        // half-written state that was modified concurrently by onTick or
        // handleCommand (BUGFIX-022).
        val (state, meals, prevHighScore) = stateLock.withLock {
            Triple(currentState, mealsGivenThisCycle, currentHighScore)
        }

        // Persist on every broadcast so crashes don't lose state
        val persistence = service<GotchiPersistence>()
        var highScore = prevHighScore
        if (state != null) {
            persistence.savePetState(state)
            persistence.mealsGivenThisCycle = meals

            // Update high score when pet dies
            if (!state.alive) {
                val diedAt    = System.currentTimeMillis()
                val elapsed   = if (state.spawnedAt > 0L) diedAt - state.spawnedAt else 0L
                val prevElapsed = if (prevHighScore != null) prevHighScore.diedAt - prevHighScore.spawnedAt else -1L
                val isNewRecord = prevHighScore == null ||
                    state.ageDays > prevHighScore.ageDays ||
                    (state.ageDays == prevHighScore.ageDays && elapsed > prevElapsed)
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
                    stateLock.withLock { currentHighScore = newScore }
                    highScore = newScore
                    persistence.saveHighScore(newScore)
                }
            }
        }
        persistence.lastSaveTimestamp = System.currentTimeMillis()

        // Fire IDE notifications for attention_call_* events (only when mechanic is enabled)
        if (state != null && service<GotchiSettings>().enableAttentionCalls) {
            for (event in state.events) {
                val msg = attentionCallMessage(state.name, event) ?: continue
                fireAttentionNotification(msg)
            }
        }

        ApplicationManager.getApplication().invokeLater {
            if (state != null) {
                browserPanel?.postState(state, meals, highScore)
                statusWidget?.update(state)
            }
        }
    }

    // ── Attention-call notifications ───────────────────────────────────────

    private fun attentionCallMessage(petName: String, event: String): String? = when (event) {
        "attention_call_hunger"          -> "$petName is hungry!"
        "attention_call_unhappiness"     -> "$petName is feeling sad!"
        "attention_call_poop"            -> "$petName made a mess and wants you to clean it up!"
        "attention_call_sick"            -> "$petName is sick!"
        "attention_call_low_energy"      -> "$petName is exhausted!"
        "attention_call_misbehaviour"    -> "$petName is misbehaving!"
        "attention_call_gift"            -> "$petName brought you a gift!"
        "attention_call_critical_health" -> "$petName's health is critical!"
        else                             -> null
    }

    private fun fireAttentionNotification(message: String) {
        ApplicationManager.getApplication().invokeLater {
            val group = NotificationGroupManager.getInstance()
                .getNotificationGroup("Gotchi Attention Calls")
                ?: return@invokeLater
            val notification = group.createNotification(message, NotificationType.WARNING)
            notification.addAction(object : com.intellij.openapi.actionSystem.AnAction("Open Gotchi") {
                override fun actionPerformed(e: com.intellij.openapi.actionSystem.AnActionEvent) {
                    val project = e.project ?: run {
                        // Fallback: grab the project from DataManager
                        val ctx = DataManager.getInstance().dataContextFromFocusAsync.blockingGet(500)
                        ctx?.getData(CommonDataKeys.PROJECT)
                    } ?: return
                    ToolWindowManager.getInstance(project).getToolWindow("Gotchi")?.show()
                    notification.expire()
                }
            })
            notification.notify(null)  // null = app-level notification visible in all projects
        }
    }

    // ── Disposable ─────────────────────────────────────────────────────────

    override fun dispose() {
        tickFuture?.cancel(false)
        Toolkit.getDefaultToolkit().removeAWTEventListener(awtActivityListener)
    }
}
