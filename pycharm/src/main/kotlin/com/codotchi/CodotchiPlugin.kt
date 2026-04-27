package com.codotchi

import com.codotchi.engine.*
import com.intellij.ide.DataManager
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.application.ApplicationActivationListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.wm.IdeFrame
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.util.concurrency.AppExecutorUtil
import com.intellij.util.messages.MessageBusConnection
import java.awt.AWTEvent
import java.awt.Toolkit
import java.awt.event.AWTEventListener
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * CodotchiPlugin — application-level service that owns the pet state and
 * tick scheduler.
 *
 * Responsibilities:
 *  - Load state from [CodotchiPersistence] on [initialize], applying offline decay.
 *  - Schedule a tick every [TICK_INTERVAL_SECONDS] seconds via a fixed-delay
 *    executor (AppExecutorUtil so IntelliJ owns the thread lifecycle).
 *  - Expose [handleCommand] which mirrors sidebarProvider.ts's switch exactly.
 *  - [broadcastState] saves to persistence, posts to browser panel, and updates
 *    the status-bar widget — always on the EDT.
 *
 * This class is registered as an app service in plugin.xml and is created lazily
 * by IntelliJ; [CodotchiAppLifecycleListener.appStarted] accesses it to force
 * initialisation.
 */
class CodotchiPlugin : Disposable {

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
    /** True when the last tick ran with dev mode active; used to suppress high score updates. */
    @Volatile private var lastDevMode: Boolean = false

    /** Timestamp of the last detected keyboard or mouse activity in the IDE. */
    @Volatile private var lastActivityTime: Long = System.currentTimeMillis()

    /** AWT listener that updates [lastActivityTime] on any key press or mouse event. */
    private val awtActivityListener = AWTEventListener { event ->
        val id = event?.id ?: return@AWTEventListener
        val settings = service<CodotchiSettings>()
        val ai = settings.aiMode
        val allowed = when {
            // Key press/release/type → treat as "document change" trigger
            id in java.awt.event.KeyEvent.KEY_FIRST..java.awt.event.KeyEvent.KEY_LAST ->
                !ai && settings.idleResetOnDocumentChange
            // Mouse move / drag → mouse-movement trigger (never suppressed by aiMode)
            id == java.awt.event.MouseEvent.MOUSE_MOVED ||
            id == java.awt.event.MouseEvent.MOUSE_DRAGGED ->
                settings.idleResetOnMouseMovement
            // Mouse click/press/release → cursor-movement trigger (suppressed by aiMode)
            id in java.awt.event.MouseEvent.MOUSE_FIRST..java.awt.event.MouseEvent.MOUSE_LAST ->
                !ai && settings.idleResetOnCursorMovement
            else -> false
        }
        if (allowed) lastActivityTime = System.currentTimeMillis()
    }

    private fun isIdle(): Boolean =
        System.currentTimeMillis() - lastActivityTime > service<CodotchiSettings>().idleThresholdSeconds * 1000L

    private fun isDeepIdle(): Boolean =
        System.currentTimeMillis() - lastActivityTime > service<CodotchiSettings>().idleDeepThresholdSeconds * 1000L

    private val browserPanels: MutableList<CodotchiBrowserPanel> = mutableListOf()
    private var statusWidget:  CodotchiStatusWidget?  = null

    private var tickFuture: ScheduledFuture<*>? = null
    private var messageBusConnection: MessageBusConnection? = null

    private fun startTicker() {
        if (tickFuture != null) return
        tickFuture = AppExecutorUtil.getAppScheduledExecutorService().scheduleWithFixedDelay(
            ::onTick,
            TICK_INTERVAL_SECONDS.toLong(),
            TICK_INTERVAL_SECONDS.toLong(),
            TimeUnit.SECONDS,
        )
    }

    private fun stopTicker() {
        tickFuture?.cancel(false)
        tickFuture = null
    }

    // ── Initialisation ─────────────────────────────────────────────────────

    fun initialize() {
        // Register AWT event listener to track keyboard/mouse activity for idle detection
        val activityMask = AWTEvent.KEY_EVENT_MASK or
            AWTEvent.MOUSE_EVENT_MASK or
            AWTEvent.MOUSE_MOTION_EVENT_MASK
        Toolkit.getDefaultToolkit().addAWTEventListener(awtActivityListener, activityMask)

        // Subscribe to application-level window focus changes for idleResetOnWindowFocus.
        // Using the application message bus so we don't need a project reference here.
        val conn = ApplicationManager.getApplication().messageBus.connect(this)
        conn.subscribe(
            ApplicationActivationListener.TOPIC,
            object : ApplicationActivationListener {
                override fun applicationActivated(ideFrame: IdeFrame) {
                    val s = service<CodotchiSettings>()
                    if (s.idleResetOnWindowFocus) {
                        lastActivityTime = System.currentTimeMillis()
                    }
                    startTicker()
                }
                override fun applicationDeactivated(ideFrame: IdeFrame) {
                    // Save immediately on focus loss so no progress is lost
                    stateLock.withLock { currentState }?.let { state ->
                        service<CodotchiPersistence>().savePetState(state)
                        service<CodotchiPersistence>().lastSaveTimestamp = System.currentTimeMillis()
                    }
                    // In AI mode, keep ticking while unfocused so the pet advances
                    // while an AI agent codes in the background. The focus-gate exists
                    // only to prevent multi-window state divergence, which aiMode avoids
                    // by design (the AI doesn't open extra windows).
                    if (!service<CodotchiSettings>().aiMode) {
                        stopTicker()
                    }
                }
            }
        )
        messageBusConnection = conn

        val persistence = service<CodotchiPersistence>()

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
        startTicker()

        // Initial broadcast so UI reflects restored state immediately
        broadcastState()
    }

    // ── Tick ───────────────────────────────────────────────────────────────

    private fun onTick() {
        val ticked = stateLock.withLock {
            val state = currentState ?: return@withLock false
            val settings = service<CodotchiSettings>()

            // Map attentionCallExpiry setting to tick count.
            val expiryMap = mapOf("needy" to 20, "standard" to 50, "chilled" to 100)
            val attentionCallExpiryTicks = expiryMap[settings.attentionCallExpiry] ?: 50

            // Map attentionCallRate setting to rate divisor.
            val rateMap = mapOf("fast" to 1.0, "medium" to 1.5, "slow" to 2.0)
            val attentionCallRateDivisor = rateMap[settings.attentionCallRate] ?: 1.0

            val gameConfig = com.codotchi.engine.GameConfig(
                attentionCallsEnabled    = settings.enableAttentionCalls,
                attentionCallExpiryTicks = attentionCallExpiryTicks,
                attentionCallRateDivisor = attentionCallRateDivisor,
                devMode                  = settings.devModeEnabled && settings.developerPasscode == "1234",
                devModeAgingMultiplier   = maxOf(1, settings.devModeAgingMultiplier).toDouble(),
                devModeHealthFloor       = maxOf(0, minOf(100, settings.devModeHealthFloor)),
            )
            lastDevMode = gameConfig.devMode
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

                "reset_high_score" -> {
                    currentHighScore = null
                    service<CodotchiPersistence>().clearHighScore()
                    shouldBroadcast = true
                    return@withLock
                }

                else -> return@withLock
            }

            if (nextState != null) {
                currentState = nextState
                shouldBroadcast = true
            }
        }

        if (shouldBroadcast) broadcastState()
    }

    // ── Code-activity trigger (called by CodotchiEventsManager) ─────────────

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

    // ── External activity signal ───────────────────────────────────────────

    /**
     * Mark that user activity has just occurred. Called by [CodotchiTabSwitchListener]
     * (and any other project-level listener that needs to reset the idle timer).
     */
    fun markActivity() {
        lastActivityTime = System.currentTimeMillis()
    }

    // ── Panel / widget registration ────────────────────────────────────────

    fun setBrowserPanel(panel: CodotchiBrowserPanel) {
        browserPanels.add(panel)
        // Do NOT call broadcastState() here — the JCEF page is still loading
        // at this point and the sidebar.js message listener does not exist yet.
        // The onReady callback in CodotchiBrowserPanel fires after onLoadEnd,
        // once the JS bridge is injected, and calls broadcastState() safely.
        // Calling it here races against the load and the state dispatch is
        // silently dropped, leaving sprites unrendered (BUGFIX-090).
    }

    fun unregisterBrowserPanel(panel: CodotchiBrowserPanel) {
        browserPanels.remove(panel)
    }

    fun setStatusWidget(widget: CodotchiStatusWidget) {
        statusWidget = widget
        broadcastState()
    }

    /**
     * Reload the JCEF webview with freshly built HTML (picks up new settings),
     * then re-push the current state so the UI is up to date immediately.
     * Called by [CodotchiConfigurable] after the user clicks Apply.
     */
    fun reloadWebview() {
        ApplicationManager.getApplication().invokeLater {
            browserPanels.forEach { it.reload() }
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
        val devMode = lastDevMode

        // Persist on every broadcast so crashes don't lose state
        val persistence = service<CodotchiPersistence>()
        var highScore = prevHighScore
        if (state != null) {
            persistence.savePetState(state)
            persistence.mealsGivenThisCycle = meals

            // Update high score when pet dies (suppressed in dev mode — scores don't count)
            if (!state.alive && !lastDevMode) {
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
        if (state != null && service<CodotchiSettings>().enableAttentionCalls) {
            for (event in state.events) {
                val msg = attentionCallMessage(state.name, event) ?: continue
                fireAttentionNotification(msg)
            }
        }

        // Fire notification on old-age natural-causes death
        if (state != null && state.events.contains("died_of_old_age")) {
            fireAttentionNotification(
                "${state.name} has passed away of unforeseen natural causes due to old age."
            )
        }

        ApplicationManager.getApplication().invokeLater {
            if (state != null) {
                browserPanels.forEach { it.postState(state, meals, highScore, devMode) }
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
                .getNotificationGroup("Codotchi Attention Calls")
                ?: return@invokeLater
            val notification = group.createNotification(message, NotificationType.WARNING)
            notification.addAction(object : com.intellij.openapi.actionSystem.AnAction("Open Gotchi") {
                override fun actionPerformed(e: com.intellij.openapi.actionSystem.AnActionEvent) {
                    val project = e.project ?: run {
                        // Fallback: grab the project from DataManager
                        val ctx = DataManager.getInstance().dataContextFromFocusAsync.blockingGet(500)
                        ctx?.getData(CommonDataKeys.PROJECT)
                    } ?: return
                    ToolWindowManager.getInstance(project).getToolWindow("Codotchi")?.show()
                    notification.expire()
                }
            })
            notification.notify(null)  // null = app-level notification visible in all projects
        }
    }

    // ── Disposable ─────────────────────────────────────────────────────────

    override fun dispose() {
        stopTicker()
        Toolkit.getDefaultToolkit().removeAWTEventListener(awtActivityListener)
        messageBusConnection?.disconnect()
    }
}
