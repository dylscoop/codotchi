package com.codotchi

import com.codotchi.engine.*
import com.codotchi.getCustomCharacterByPasscode
import com.codotchi.getCustomCharacterBySpriteType
import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import java.io.File
import com.intellij.credentialStore.CredentialAttributes
import com.intellij.ide.BrowserUtil
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.Disposable
import com.intellij.openapi.application.ApplicationActivationListener
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.service
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.wm.IdeFrame
import com.intellij.openapi.wm.ToolWindowManager
import com.intellij.openapi.vfs.newvfs.BulkFileListener
import com.intellij.openapi.vfs.newvfs.events.VFileEvent
import com.intellij.openapi.vfs.VirtualFileManager
import com.intellij.util.concurrency.AppExecutorUtil
import com.intellij.util.messages.MessageBusConnection
import java.awt.AWTEvent
import java.awt.Toolkit
import java.awt.event.AWTEventListener
import java.nio.file.FileSystems
import java.nio.file.Path
import java.nio.file.StandardWatchEventKinds
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Source-file extensions monitored by the VFS BulkFileListener for
 * external-save detection (terminal, AI agent, external editor).
 * Mirrors the SOURCE_FILE_GLOB in VS Code's events.ts.
 */
private val SOURCE_FILE_EXTENSIONS = setOf(
    "ts", "tsx", "js", "jsx", "mjs", "cjs",
    "py", "kt", "kts", "java", "go", "rs", "rb", "cs",
    "cpp", "cc", "cxx", "c", "h", "hpp",
    "swift", "vue", "svelte", "html", "css", "scss", "sass", "less",
    "json", "yaml", "yml", "toml", "sh", "bash", "zsh", "fish",
    "lua", "php", "r", "dart", "ex", "exs", "erl", "hrl",
    "clj", "cljs", "elm", "hs", "ml", "mli", "fs", "fsx", "fsi",
    "nim", "zig", "v", "tf"
)

/** How often to re-fire the rescue notification while the pet is sick/losing health while idle. */
private const val RESCUE_NOTIFY_REPEAT_MS: Long = 5 * 60_000L // 5 minutes

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
 * by IntelliJ; [CodotchiStartupActivity] accesses it to force initialisation.
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
    @Volatile private var lastRunDiedAt: Long = 0L
    @Volatile private var lastCodeActivityTime: Long = 0L
    @Volatile private var lastCommitActivityTime: Long = 0L
    /** True when the last tick ran with dev mode active; used to suppress high score updates. */
    @Volatile private var lastDevMode: Boolean = false

    /** Timestamp of the last detected keyboard or mouse activity in the IDE. */
    @Volatile private var lastActivityTime: Long = System.currentTimeMillis()

    /**
     * Timestamp of the last tick in which the pet was in deep idle.
     * Used to enforce a re-entry grace period (BUGFIX-097): after the user returns
     * from deep idle (e.g. screen unlock, IDE focus regain), the pet stays in
     * deep-idle protection for DEEP_IDLE_REENTRY_GRACE_MS before full active
     * decay resumes.  Persisted across restarts so a crash/restart also benefits
     * from the grace period.  Mirrors VS Code lastDeepIdleTickMs in extension.ts.
     */
    @Volatile private var lastDeepIdleTickMs: Long = 0L

    /** Epoch-ms of the last "pet needs rescue while idle" notification, so it can repeat. */
    @Volatile private var lastRescueNotifyMs: Long = 0L

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

    // Live rank cache — refreshed at most every 5 minutes from scores.json.
    private data class RankCache(val rank: Int, val total: Int, val at: Long)
    @Volatile private var rankCache: RankCache? = null
    private val RANK_CACHE_TTL_MS = 5 * 60_000L
    private val SCORES_JSON_URL = "https://raw.githubusercontent.com/dylscoop/codotchi/leaderboard/leaderboard/scores.json"
    private val LIVE_JSON_URL   = "https://raw.githubusercontent.com/dylscoop/codotchi/leaderboard/leaderboard/live.json"
    private val GITHUB_ISSUES_API = "https://api.github.com/repos/dylscoop/codotchi/issues"
    private val LIVE_PUSH_INTERVAL_MS = 15 * 60_000L
    @Volatile private var liveLastPushedAtMs: Long = 0L
    @Volatile private var leaderboardGithubUsername: String? = null

    /** Background thread running the JVM WatchService for cross-window file sync. */
    @Volatile private var fileWatcherThread: Thread? = null
    /** Background thread watching .git/COMMIT_EDITMSG for commit events. */
    @Volatile private var gitCommitWatcherThread: Thread? = null
    /** Epoch-ms of the last reload triggered by the file watcher (debounce). */
    private val lastWatcherReload = AtomicLong(0L)

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

    private fun setLeaderboardUsername(username: String?) {
        leaderboardGithubUsername = username
        val props = com.intellij.ide.util.PropertiesComponent.getInstance()
        if (username != null) props.setValue("codotchi.leaderboardGithubUsername", username)
        else props.unsetValue("codotchi.leaderboardGithubUsername")
    }

    fun initialize() {
        liveLastPushedAtMs = com.intellij.ide.util.PropertiesComponent.getInstance()
            .getValue("codotchi.liveLastPushedAt")?.toLongOrNull() ?: 0L
        leaderboardGithubUsername = com.intellij.ide.util.PropertiesComponent.getInstance()
            .getValue("codotchi.leaderboardGithubUsername")

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
                    // BUGFIX-097: persist the deep-idle timestamp so the grace period
                    // survives a crash/force-quit and applies on the next startup.
                    service<CodotchiPersistence>().lastDeepIdleTickMs = lastDeepIdleTickMs
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
        // Subscribe to VFS bulk-file events to catch saves from the integrated
        // terminal (vim/nano), external editors, and AI agents writing files
        // directly to disk — none of which trigger FileDocumentManagerListener.
        // Filtered to source-file extensions to avoid noise from build output,
        // lock files, and log files.  Mirrors the FileSystemWatcher approach in
        // the VS Code extension's events.ts.
        conn.subscribe(
            VirtualFileManager.VFS_CHANGES,
            object : BulkFileListener {
                override fun after(events: List<VFileEvent>) {
                    val hasSourceChange = events.any { e ->
                        val ext = e.file?.extension?.lowercase() ?: return@any false
                        ext in SOURCE_FILE_EXTENSIONS
                    }
                    if (hasSourceChange) triggerCodeActivity()
                }
            }
        )

        messageBusConnection = conn

        val persistence = service<CodotchiPersistence>()

        // Populate the current project base path so persistence can compute the
        // workspace-specific state file path when perWorkspacePet is enabled.
        persistence.currentProjectBasePath =
            ProjectManager.getInstance().openProjects.firstOrNull()?.basePath

        // Restore saved high score
        currentHighScore = persistence.loadHighScore()

        // BUGFIX-097: restore deep-idle timestamp so the re-entry grace period
        // also applies after a crash or force-quit restart.
        lastDeepIdleTickMs = persistence.lastDeepIdleTickMs

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

        // Start file watcher for cross-window sync
        startFileWatcher()

        // Start git commit watcher for happiness boost on commit
        startGitCommitWatcher()

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
            // BUGFIX-097: compute deep idle with re-entry grace period so the pet
            // stays protected for DEEP_IDLE_REENTRY_GRACE_MS after screen unlock
            // or IDE focus regain — mirrors VS Code extension.ts grace period logic.
            val rawDeepIdle = isDeepIdle()
            if (rawDeepIdle) lastDeepIdleTickMs = System.currentTimeMillis()
            val inGracePeriod = lastDeepIdleTickMs > 0L &&
                System.currentTimeMillis() - lastDeepIdleTickMs < DEEP_IDLE_REENTRY_GRACE_MS
            val deepIdle = rawDeepIdle || inGracePeriod
            currentState = tick(state, isIdle(), deepIdle, gameConfig)
            true
        }
        if (ticked) broadcastState()
    }

    // ── Daily token cost scanning ──────────────────────────────────────────

    private data class DailyUsage(
        val costUsd: Double,
        val hourlyCostUsd: Double,
        val tokens: Long,
        val messageCount: Int,
    )

    // Mirrors state.mjs / sidebarProvider.ts MODEL_PRICING — most-specific
    // prefix first, since e.g. claude-opus-4-8 must be checked before the
    // generic claude-opus-4 / bare "opus" fallback.
    private data class Pricing(val input: Double, val output: Double, val cacheRead: Double, val cacheWrite: Double)
    private fun pricingForModel(model: String): Pricing = when {
        model.startsWith("claude-opus-4-8")   -> Pricing(5.0, 25.0, 0.50, 6.25)
        model.startsWith("claude-opus-4-1")   -> Pricing(15.0, 75.0, 1.50, 18.75)
        model.startsWith("claude-3-5-sonnet") -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-3-5-haiku")  -> Pricing(0.80, 4.0, 0.08, 1.00)
        model.startsWith("claude-3-opus")     -> Pricing(15.0, 75.0, 1.50, 18.75)
        model.startsWith("claude-3-sonnet")   -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-3-haiku")    -> Pricing(0.25, 1.25, 0.03, 0.30)
        model.startsWith("claude-opus-4")     -> Pricing(15.0, 75.0, 1.50, 18.75)
        model.startsWith("claude-sonnet-5")   -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-sonnet-4")   -> Pricing(3.0, 15.0, 0.30, 3.75)
        model.startsWith("claude-haiku-4-5")  -> Pricing(1.0, 5.0, 0.10, 1.25)
        model.startsWith("claude-fable-5")    -> Pricing(10.0, 50.0, 1.00, 12.50)
        "opus" in model    -> Pricing(15.0, 75.0, 1.5, 18.75)
        "haiku" in model   -> Pricing(0.80, 4.0, 0.08, 1.0)
        else               -> Pricing(3.0, 15.0, 0.30, 3.75) // sonnet default
    }

    /** Scan ~/.claude/projects (all .jsonl transcripts) and return today's Claude Code usage totals. */
    private fun scanClaudeCodeDailyUsage(): DailyUsage {
        val home = System.getProperty("user.home") ?: ""
        val today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString() // "YYYY-MM-DD"
        val oneHourAgoMs = System.currentTimeMillis() - 3_600_000L
        val oneHourAgoIso = java.time.Instant.ofEpochMilli(oneHourAgoMs).toString().substring(0, 19)
        var costUsd = 0.0; var hourlyCostUsd = 0.0; var tokens = 0L; var messageCount = 0
        val gson = Gson()

        try {
            val projsDir = File(home, ".claude/projects")
            if (projsDir.isDirectory) {
                for (proj in projsDir.listFiles() ?: emptyArray()) {
                    if (!proj.isDirectory) continue
                    for (f in proj.listFiles() ?: emptyArray()) {
                        if (!f.name.endsWith(".jsonl")) continue
                        try {
                            val modified = java.time.Instant.ofEpochMilli(f.lastModified())
                                .atZone(java.time.ZoneOffset.UTC).toLocalDate().toString()
                            if (modified < today) continue
                        } catch (_: Exception) { continue }
                        try {
                            for (line in f.readLines()) {
                                try {
                                    @Suppress("UNCHECKED_CAST")
                                    val d = gson.fromJson(line, Map::class.java) as? Map<*, *> ?: continue
                                    if (d["type"] != "assistant") continue
                                    @Suppress("UNCHECKED_CAST")
                                    val msg = d["message"] as? Map<*, *> ?: continue
                                    @Suppress("UNCHECKED_CAST")
                                    val u = msg["usage"] as? Map<*, *> ?: continue
                                    val ts = d["timestamp"] as? String ?: ""
                                    if (ts.isNotEmpty() && !ts.startsWith(today)) continue
                                    val p = pricingForModel(msg["model"] as? String ?: "")
                                    val inp = (u["input_tokens"] as? Number)?.toLong() ?: 0L
                                    val out = (u["output_tokens"] as? Number)?.toLong() ?: 0L
                                    val cr  = (u["cache_read_input_tokens"] as? Number)?.toLong() ?: 0L
                                    val cc  = (u["cache_creation_input_tokens"] as? Number)?.toLong() ?: 0L
                                    val entryCost = (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000.0
                                    costUsd += entryCost
                                    tokens += inp + out + cr + cc
                                    messageCount++
                                    if (ts.isNotEmpty() && ts >= oneHourAgoIso) hourlyCostUsd += entryCost
                                } catch (_: Exception) { /* skip malformed line */ }
                            }
                        } catch (_: Exception) { /* skip unreadable file */ }
                    }
                }
            }
        } catch (_: Exception) { /* projsDir missing */ }

        return DailyUsage(costUsd, hourlyCostUsd, tokens, messageCount)
    }

    /** Read ~/.config/opencode/codotchi-daily.json and return today's OpenCode usage totals. */
    private fun scanOpenCodeDailyUsage(): DailyUsage {
        val home = System.getProperty("user.home") ?: ""
        val today = java.time.LocalDate.now(java.time.ZoneOffset.UTC).toString() // "YYYY-MM-DD"
        var costUsd = 0.0; var tokens = 0L; var messageCount = 0
        val gson = Gson()

        try {
            val xdgConfig = System.getenv("XDG_CONFIG_HOME")
                ?: File(home, ".config").absolutePath
            val ocFile = File(xdgConfig, "opencode/codotchi-daily.json")
            if (ocFile.exists()) {
                @Suppress("UNCHECKED_CAST")
                val ocData = gson.fromJson(ocFile.readText(), Map::class.java) as? Map<*, *>
                val date = ocData?.get("date") as? String ?: ""
                if (date == today) {
                    costUsd      = (ocData?.get("costUSD") as? Number)?.toDouble() ?: 0.0
                    tokens       = (ocData?.get("tokens") as? Number)?.toLong() ?: 0L
                    messageCount = (ocData?.get("messages") as? Number)?.toInt() ?: 0
                }
            }
        } catch (_: Exception) { /* opencode daily file missing or malformed */ }

        // OpenCode only persists daily totals — last-1h is in-memory in the plugin, not in this file.
        return DailyUsage(costUsd, 0.0, tokens, messageCount)
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
        // Pre-compute file I/O (and the Copilot quota network call) outside the
        // state lock to avoid holding it during disk reads / HTTP requests.
        val tokenCostSettings = service<CodotchiSettings>()
        // Each source is scanned independently (never merged) so one source's
        // message-count/token shape can't drag another source's own "avg
        // tok/msg" figure away from what it reports on its own.
        val claudeCodeUsage = if (command == "token_cost" && tokenCostSettings.tokenCostIncludeClaudeCode)
            scanClaudeCodeDailyUsage()
        else null
        val openCodeUsage = if (command == "token_cost" && tokenCostSettings.tokenCostIncludeOpenCode)
            scanOpenCodeDailyUsage()
        else null
        val copilotQuota: CopilotQuotaResult? = if (command == "token_cost" && tokenCostSettings.tokenCostIncludeCopilot) {
            val token = CopilotQuotaToken.get()
            if (token == null) CopilotQuotaResult.NoToken
            else CopilotQuotaCache.get { fetchQuota(token) }
        } else null

        stateLock.withLock {
            val state   = currentState

            if (state == null && command != "new_game") return@withLock

            // BUGFIX-002: block care actions server-side while pet is sleeping
            val isSleeping = state?.sleeping ?: false
            val sleepBlocked = setOf("feed", "play", "pat", "token_cost", "clean", "medicine", "praise", "scold")
            if (isSleeping && command in sleepBlocked) return@withLock

            // Block all actions while paused, except the pause toggle itself and new_game
            val isPaused = state?.paused ?: false
            val pauseBlocked = setOf("feed", "snack_consumed", "play", "pat", "token_cost", "sleep", "wake", "clean", "medicine", "scold", "praise", "reset_high_score")
            if (isPaused && command in pauseBlocked) return@withLock

            var nextState: PetState? = null

            when (command) {
                "feed" -> {
                    state ?: return@withLock
                    val feedType = message["feedType"] as? String
                    val _cc = getCustomCharacterBySpriteType(state.spriteType)
                    nextState = if (feedType == "snack") {
                        startSnack(state, feedSnackMaxPerCycle = _cc?.feedSnackMaxPerCycle)
                    } else {
                        val ns = feedMeal(state, mealsGivenThisCycle,
                            feedMealMaxPerCycle = _cc?.feedMealMaxPerCycle,
                            feedHungerMult      = _cc?.feedHungerMult,
                            feedMealWeightGain  = _cc?.feedMealWeightGain)
                        if ("fed_meal" in ns.events) mealsGivenThisCycle++
                        ns
                    }
                }

                "snack_consumed" -> {
                    state ?: return@withLock
                    val _cc = getCustomCharacterBySpriteType(state.spriteType)
                    nextState = consumeSnack(state,
                        feedHungerMult      = _cc?.feedHungerMult,
                        snackSickThreshold  = _cc?.snackSickThreshold,
                        feedSnackWeightGain = _cc?.feedSnackWeightGain)
                }

                "play" -> {
                    state ?: return@withLock
                    var ns = play(state, playWeightLoss = getCustomCharacterBySpriteType(state.spriteType)?.playWeightLoss)
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

                "token_cost" -> {
                    state ?: return@withLock
                    nextState = applyTokenCostView(state)
                    // bubble dispatched after lock via dailyUsage (see below)
                }

                "pause" -> {
                    state ?: return@withLock
                    nextState = if (state.paused) resume(state) else pause(state)
                }

                "new_game" -> {
                    lastRunDiedAt = 0L   // reset so the next death gets a fresh timestamp
                    val rawName = (message["name"]    as? String)?.trim() ?: ""
                    val petType = (message["petType"] as? String) ?: "codeling"
                    val color   = (message["color"]   as? String) ?: "neon"
                    val settings = service<CodotchiSettings>()
                    val customChar = getCustomCharacterByPasscode(settings.characterPasscode)
                    val defaultName = customChar?.defaultName ?: "Codotchi"
                    val isTimChar   = customChar?.spriteType == "tim"
                    val resolvedName = when {
                        isTimChar && rawName.lowercase() == "codotchi" -> defaultName
                        rawName.isNotEmpty() -> rawName
                        else -> defaultName
                    }
                    val unlockedCharacter = customChar?.spriteType
                    nextState = createPet(resolvedName, petType, color, unlockedCharacter)
                    mealsGivenThisCycle = 0
                }

                // Idle timer already reset above; no state change needed (BUGFIX-015).
                "user_activity" -> return@withLock

                "submit_leaderboard" -> {
                    val deadState  = currentState?.takeIf { !it.alive }
                    val diedAtSnap = lastRunDiedAt.takeIf { it > 0L } ?: System.currentTimeMillis()
                    shouldBroadcast = false
                    if (deadState != null) {
                        submitLeaderboardAsync(deadState, diedAtSnap)
                    }
                    return@withLock
                }

                "open_leaderboard_url" -> {
                    shouldBroadcast = false
                    AppExecutorUtil.getAppExecutorService().submit {
                        com.intellij.ide.BrowserUtil.browse(LEADERBOARD_PAGES_URL)
                    }
                    return@withLock
                }

                "sign_in_leaderboard" -> {
                    val stateSnap = currentState
                    shouldBroadcast = false
                    startDeviceFlowAsync(stateSnap?.takeIf { it.alive })
                    return@withLock
                }

                "toggle_live_subscribe" -> {
                    val props = com.intellij.ide.util.PropertiesComponent.getInstance()
                    val current = props.getBoolean("codotchi.liveSubscribed", false)
                    val subscribing = !current
                    props.setValue("codotchi.liveSubscribed", subscribing)
                    shouldBroadcast = true
                    if (subscribing) {
                        val stateSnap = currentState?.takeIf { it.alive }
                        if (stateSnap != null) pushLiveScoreAsync(stateSnap, promptIfNoToken = true)
                    }
                    return@withLock
                }

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

        // Token cost bubble — dispatched after state broadcast so the energy/happiness
        // update lands first, then the speech bubble appears on top.
        if (command == "token_cost") {
            fun fmtTok(n: Long) = when {
                n >= 1_000_000L -> "${"%.1f".format(n / 1_000_000.0)}M"
                n >= 1_000L     -> "${"%.1f".format(n / 1_000.0)}k"
                else            -> "$n"
            }
            fun fmtCost(u: Double) = if (u < 0.005) "<$0.01" else "$" + "%.2f".format(u)
            // Each source reports its own totals — never merged, so a source
            // with a different message-count/token shape (e.g. OpenCode)
            // can't drag another source's "avg tok/msg" figure away from
            // what it shows on its own.
            fun usageSegment(label: String, usage: DailyUsage, showHourly: Boolean): String {
                val avg = if (usage.messageCount > 0) usage.tokens / usage.messageCount else usage.tokens
                val hourlyPart = if (showHourly) " | Last 1h: ${fmtCost(usage.hourlyCostUsd)}" else ""
                return "$label: ${fmtCost(usage.costUsd)}$hourlyPart, Avg ${fmtTok(avg)} tok/msg"
            }

            val segments = mutableListOf<String>()

            if (claudeCodeUsage != null) {
                segments.add(usageSegment("Claude", claudeCodeUsage, showHourly = true))
            }
            if (openCodeUsage != null) {
                // OpenCode's daily file only persists a running total — no
                // last-1h breakdown is available, so omit it rather than
                // show a misleading $0.00.
                segments.add(usageSegment("OpenCode", openCodeUsage, showHourly = false))
            }

            when (copilotQuota) {
                is CopilotQuotaResult.Ok -> segments.add(
                    if (copilotQuota.unlimited) "Copilot: unlimited premium requests"
                    else "Copilot: ${copilotQuota.percentRemaining}% premium quota remaining"
                )
                is CopilotQuotaResult.NoToken -> segments.add(
                    "Copilot: run Tools > Codotchi: Sign in to GitHub (Copilot Quota) to include it"
                )
                // Unauthorized / NetworkError / ParseError / null -> silently omit; never break the base bubble
                else -> {}
            }

            val text = if (segments.isNotEmpty()) segments.joinToString(" | ") else "Today's Token Cost: no sources selected"
            val escaped = text.replace("\\", "\\\\").replace("\"", "\\\"")
            val payload = """{"type":"showBubble","text":"$escaped"}"""
            ApplicationManager.getApplication().invokeLater {
                browserPanels.forEach { it.postMessage(payload) }
            }
        }
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

    // ── Commit-activity trigger (called by CodotchiEventsManager) ───────────

    fun triggerCommitActivity() {
        val now = System.currentTimeMillis()
        if (now - lastCommitActivityTime < COMMIT_ACTIVITY_THROTTLE_SECONDS * 1000L) return
        lastCommitActivityTime = now
        val ticked = stateLock.withLock {
            val state = currentState ?: return@withLock false
            currentState = applyCommitActivity(state)
            true
        }
        if (ticked) broadcastState()
    }

    // ── External activity signal ───────────────────────────────────────────

    /**
     * Mark that user activity has just occurred. Called by [CodotchiTabSwitchListener]
     * (and any other project-level listener that needs to reset the idle timer).
     */
    fun isPaused(): Boolean = stateLock.withLock { currentState?.paused ?: false }

    /** Fetch live rank in the background; result stored in [rankCache]. */
    private fun fetchLiveRankAsync(ageDays: Int) {
        val now = System.currentTimeMillis()
        val cached = rankCache
        if (cached != null && now - cached.at < RANK_CACHE_TTL_MS) return
        AppExecutorUtil.getAppExecutorService().execute {
            try {
                fun get(rawUrl: String): String? {
                    val conn = java.net.URL(rawUrl).openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 5000
                    conn.readTimeout = 5000
                    conn.setRequestProperty("Accept", "application/json")
                    conn.setRequestProperty("User-Agent", "Codotchi-PyCharm")
                    return if (conn.responseCode == 200) conn.inputStream.bufferedReader().readText() else null
                }

                val scoresText = get(SCORES_JSON_URL) ?: return@execute
                val liveText   = try { get(LIVE_JSON_URL) } catch (_: Exception) { null }

                @Suppress("UNCHECKED_CAST")
                val scoresParsed = Gson().fromJson(scoresText, Any::class.java)
                val scoresList: List<Map<String, Any>> = when (scoresParsed) {
                    is List<*> -> scoresParsed as List<Map<String, Any>>
                    is Map<*, *> -> (scoresParsed["scores"] as? List<Map<String, Any>>) ?: emptyList()
                    else -> emptyList()
                }

                val staleMs = 48 * 60 * 60 * 1000L
                val msPerGameDayApprox = 5 * 60 * 1000L // 5 real min ≈ 1 game day (awake rate)
                val selfRunId = com.intellij.openapi.application.PermanentInstallationID.get()
                @Suppress("UNCHECKED_CAST")
                val freshLive: List<Map<String, Any>> = if (liveText != null) {
                    val liveParsed = Gson().fromJson(liveText, Any::class.java)
                    val liveList = if (liveParsed is List<*>) liveParsed as List<Map<String, Any>> else emptyList()
                    liveList
                        .filter { entry ->
                            val updatedAt = (entry["updatedAt"] as? Number)?.toLong() ?: 0L
                            val entryRunId = entry["petRunId"] as? String
                            // Exclude own entry by petRunId only — username exclusion was too broad.
                            updatedAt > 0L && (now - updatedAt) < staleMs
                                && entryRunId != selfRunId
                        }
                        .map { entry ->
                            val storedAge = (entry["ageDays"] as? Number)?.toDouble() ?: 0.0
                            val updatedAt = (entry["updatedAt"] as? Number)?.toLong() ?: now
                            val extrapolated = storedAge + (now - updatedAt).toDouble() / msPerGameDayApprox
                            entry + mapOf("ageDays" to extrapolated)
                        }
                } else emptyList()

                val combined = scoresList + freshLive
                val rank = combined.count { (it["ageDays"] as? Number)?.toDouble()?.let { d -> d > ageDays } == true } + 1
                rankCache = RankCache(rank, combined.size + 1, System.currentTimeMillis())
                // Re-broadcast so the sidebar picks up the new rank immediately
                broadcastState()
            } catch (_: Exception) { /* network failure — keep stale cache */ }
        }
    }

    private fun pushLiveScoreAsync(state: PetState, promptIfNoToken: Boolean) {
        AppExecutorUtil.getAppExecutorService().execute {
            try {
                val credAttrs = CredentialAttributes("Codotchi", "github-pat")
                var pat = PasswordSafe.instance.getPassword(credAttrs)

                if (pat.isNullOrBlank()) {
                    if (!promptIfNoToken) return@execute
                    startDeviceFlowAsync(state)
                    return@execute
                }

                // Resolve GitHub username
                val userConn = java.net.URL("https://api.github.com/user").openConnection() as java.net.HttpURLConnection
                userConn.connectTimeout = 5000
                userConn.readTimeout = 5000
                userConn.setRequestProperty("Authorization", "token $pat")
                userConn.setRequestProperty("Accept", "application/vnd.github+json")
                userConn.setRequestProperty("User-Agent", "Codotchi-PyCharm")
                if (userConn.responseCode != 200) return@execute
                @Suppress("UNCHECKED_CAST")
                val userMap = Gson().fromJson(userConn.inputStream.bufferedReader().readText(), Map::class.java) as Map<String, Any>
                val username = userMap["login"] as? String ?: return@execute
                setLeaderboardUsername(username)

                val entry = mapOf(
                    "username" to username,
                    "petName" to state.name,
                    "petRunId" to com.intellij.openapi.application.PermanentInstallationID.get(),
                    "spawnedAt" to state.spawnedAt,
                    "ageDays" to state.ageDays,
                    "stage" to state.stage,
                    "petType" to state.petType,
                    "updatedAt" to System.currentTimeMillis()
                )
                val issueBody = mapOf(
                    "title" to "[Live] $username — ${state.name} (${state.ageDays}d ${state.stage})",
                    "body" to Gson().toJson(entry),
                    "labels" to listOf("leaderboard-live")
                )

                val issueConn = java.net.URL(GITHUB_ISSUES_API).openConnection() as java.net.HttpURLConnection
                issueConn.requestMethod = "POST"
                issueConn.doOutput = true
                issueConn.connectTimeout = 10000
                issueConn.readTimeout = 10000
                issueConn.setRequestProperty("Authorization", "token $pat")
                issueConn.setRequestProperty("Accept", "application/vnd.github+json")
                issueConn.setRequestProperty("Content-Type", "application/json")
                issueConn.setRequestProperty("User-Agent", "Codotchi-PyCharm")
                issueConn.outputStream.writer().use { it.write(Gson().toJson(issueBody)) }

                if (issueConn.responseCode == 201) {
                    val now = System.currentTimeMillis()
                    liveLastPushedAtMs = now
                    com.intellij.ide.util.PropertiesComponent.getInstance()
                        .setValue("codotchi.liveLastPushedAt", now.toString())
                    broadcastState()
                }
            } catch (_: Exception) { /* network failure — silent */ }
        }
    }

    private fun submitLeaderboardAsync(state: PetState, diedAt: Long) {
        AppExecutorUtil.getAppExecutorService().execute {
            fun postResult(status: String, message: String? = null) {
                val msgPart = if (message != null) ""","message":"${message.replace("\"", "\\\"")}"""" else ""
                val payload = """{"type":"leaderboard_submit_result","status":"$status"$msgPart}"""
                ApplicationManager.getApplication().invokeLater {
                    browserPanels.forEach { it.postMessage(payload) }
                }
            }
            try {
                val credAttrs = CredentialAttributes("Codotchi", "github-pat")
                val pat = PasswordSafe.instance.getPassword(credAttrs)
                if (pat.isNullOrBlank()) {
                    startDeviceFlowAsync(null) { submitLeaderboardAsync(state, diedAt) }
                    return@execute
                }

                val userConn = java.net.URL("https://api.github.com/user").openConnection() as java.net.HttpURLConnection
                userConn.connectTimeout = 5000
                userConn.readTimeout = 5000
                userConn.setRequestProperty("Authorization", "token $pat")
                userConn.setRequestProperty("Accept", "application/vnd.github+json")
                userConn.setRequestProperty("User-Agent", "Codotchi-PyCharm")
                if (userConn.responseCode != 200) {
                    postResult("error", "GitHub API error: ${userConn.responseCode}")
                    return@execute
                }
                @Suppress("UNCHECKED_CAST")
                val userMap = Gson().fromJson(userConn.inputStream.bufferedReader().readText(), Map::class.java) as Map<String, Any>
                val username = userMap["login"] as? String ?: run { postResult("error", "Could not read GitHub username."); return@execute }
                setLeaderboardUsername(username)

                val scoreJson = """{"schemaVersion":1,"petName":"${state.name.replace("\"","\\\"")}","ageDays":${state.ageDays},"stage":"${state.stage}","petType":"${state.petType}","spawnedAt":${state.spawnedAt},"diedAt":$diedAt}"""
                val issueBody = "Leaderboard submission.\n\n```json\n$scoreJson\n```"
                val issueTitle = "[Leaderboard] ${state.name} (${state.petType}) lived ${state.ageDays}d — @$username"
                val issuePayload = mapOf(
                    "title" to issueTitle,
                    "body"  to issueBody,
                    "labels" to listOf("leaderboard-submission")
                )

                val issueConn = java.net.URL(GITHUB_ISSUES_API).openConnection() as java.net.HttpURLConnection
                issueConn.requestMethod = "POST"
                issueConn.doOutput = true
                issueConn.connectTimeout = 10000
                issueConn.readTimeout = 10000
                issueConn.setRequestProperty("Authorization", "token $pat")
                issueConn.setRequestProperty("Accept", "application/vnd.github+json")
                issueConn.setRequestProperty("Content-Type", "application/json")
                issueConn.setRequestProperty("User-Agent", "Codotchi-PyCharm")
                issueConn.outputStream.writer().use { it.write(Gson().toJson(issuePayload)) }

                if (issueConn.responseCode == 201) {
                    postResult("success")
                } else {
                    val errBody = issueConn.errorStream?.bufferedReader()?.readText()?.take(120) ?: ""
                    postResult("error", "Failed to submit (HTTP ${issueConn.responseCode}): $errBody")
                }
            } catch (e: Exception) {
                postResult("error", "Network error: ${e.message?.take(80)}")
            }
        }
    }

    private fun startDeviceFlowAsync(state: PetState?, onAuthSuccess: (() -> Unit)? = null) {
        AppExecutorUtil.getAppExecutorService().execute {
            try {
                val clientId = "Ov23lilG4ngpe3lHdC88"

                val dcConn = java.net.URL("https://github.com/login/device/code").openConnection() as java.net.HttpURLConnection
                dcConn.requestMethod = "POST"
                dcConn.doOutput = true
                dcConn.connectTimeout = 10000
                dcConn.readTimeout = 10000
                dcConn.setRequestProperty("Accept", "application/json")
                dcConn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                dcConn.outputStream.writer().use { it.write("client_id=$clientId&scope=public_repo") }
                if (dcConn.responseCode != 200) return@execute

                @Suppress("UNCHECKED_CAST")
                val dcResp = Gson().fromJson(dcConn.inputStream.bufferedReader().readText(), Map::class.java) as Map<String, Any>
                val deviceCode     = dcResp["device_code"] as? String ?: return@execute
                val userCode       = dcResp["user_code"]   as? String ?: return@execute
                val verifyUri      = (dcResp["verification_uri_complete"] as? String)
                    ?: dcResp["verification_uri"] as? String
                    ?: "https://github.com/login/device"
                val expiresIn      = (dcResp["expires_in"] as? Double)?.toLong() ?: 900L
                var pollInterval   = (dcResp["interval"]   as? Double)?.toLong() ?: 5L

                ApplicationManager.getApplication().invokeLater {
                    BrowserUtil.browse(verifyUri)
                    NotificationGroupManager.getInstance()
                        .getNotificationGroup("Codotchi Leaderboard")
                        .createNotification(
                            "Codotchi: Sign in to GitHub",
                            "Your code is <b>$userCode</b>. Enter it on the GitHub page that just opened, then authorise. Live progress will start syncing automatically.",
                            NotificationType.INFORMATION
                        )
                        .notify(null)
                }

                val deadline = System.currentTimeMillis() + expiresIn * 1000L
                while (System.currentTimeMillis() < deadline) {
                    Thread.sleep(pollInterval * 1000L)

                    val tokConn = java.net.URL("https://github.com/login/oauth/access_token").openConnection() as java.net.HttpURLConnection
                    tokConn.requestMethod = "POST"
                    tokConn.doOutput = true
                    tokConn.connectTimeout = 10000
                    tokConn.readTimeout = 10000
                    tokConn.setRequestProperty("Accept", "application/json")
                    tokConn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
                    tokConn.outputStream.writer().use {
                        it.write("client_id=$clientId&device_code=$deviceCode&grant_type=urn:ietf:params:oauth:grant-type:device_code")
                    }

                    @Suppress("UNCHECKED_CAST")
                    val tokResp = Gson().fromJson(tokConn.inputStream.bufferedReader().readText(), Map::class.java) as Map<String, Any>
                    val accessToken = tokResp["access_token"] as? String
                    if (!accessToken.isNullOrBlank()) {
                        PasswordSafe.instance.setPassword(CredentialAttributes("Codotchi", "github-pat"), accessToken)
                        resolveAndCacheLeaderboardUsername(accessToken)
                        if (onAuthSuccess != null) {
                            onAuthSuccess()
                        } else if (state != null) {
                            pushLiveScoreAsync(state, promptIfNoToken = false)
                        }
                        return@execute
                    }
                    when (tokResp["error"] as? String) {
                        "slow_down"             -> pollInterval += 5
                        "authorization_pending" -> { /* continue polling */ }
                        else                    -> return@execute
                    }
                }
            } catch (_: Exception) { /* network failure — silent */ }
        }
    }

    private fun resolveAndCacheLeaderboardUsername(pat: String) {
        AppExecutorUtil.getAppExecutorService().execute {
            try {
                val conn = java.net.URL("https://api.github.com/user").openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 5000; conn.readTimeout = 5000
                conn.setRequestProperty("Authorization", "token $pat")
                conn.setRequestProperty("Accept", "application/vnd.github+json")
                conn.setRequestProperty("User-Agent", "Codotchi-PyCharm")
                if (conn.responseCode != 200) return@execute
                @Suppress("UNCHECKED_CAST")
                val map = Gson().fromJson(conn.inputStream.bufferedReader().readText(), Map::class.java) as Map<String, Any>
                val username = map["login"] as? String ?: return@execute
                setLeaderboardUsername(username)
                ApplicationManager.getApplication().invokeLater {
                    browserPanels.forEach { it.postMessage("""{"type":"leaderboard_sign_in_result","username":"$username"}""") }
                }
            } catch (_: Exception) { /* silent */ }
        }
    }

    fun startLeaderboardSignIn() {
        startDeviceFlowAsync(stateLock.withLock { currentState?.takeIf { it.alive } })
    }

    fun getLeaderboardUsername(): String? = leaderboardGithubUsername

    fun markActivity() {
        lastActivityTime = System.currentTimeMillis()
    }

    /**
     * Immediately push [lastActivityTime] far enough into the past that the next
     * tick sees deep idle. Called when the Codotchi tool window is hidden so the
     * pet enters the protected low-decay state without waiting 10 minutes of
     * inactivity.  The re-entry path calls [markActivity] when the panel is shown
     * again so the pet exits deep idle right away.
     */
    fun markDeepIdle() {
        val settings = service<CodotchiSettings>()
        lastActivityTime = System.currentTimeMillis() - settings.idleDeepThresholdSeconds * 1000L
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
            // Webview reloads with an empty snackItems[] — zero the floor counter (BUGFIX-NNN).
            resetFloorSnacks()
            browserPanels.forEach { it.reload() }
            broadcastState()
        }
    }

    /**
     * Zero out the in-flight floor snack counter.
     * Call whenever the webview reloads so the engine stays in sync with the
     * webview's empty snackItems[].
     */
    fun resetFloorSnacks() {
        stateLock.withLock {
            currentState = currentState?.copy(snacksOnFloor = 0)
        }
    }

    // ── Cross-window reload ────────────────────────────────────────────────

    /**
     * Read the latest state from the shared on-disk file, apply offline decay
     * for the elapsed time since it was saved, and push the result to the UI.
     *
     * This is the PyCharm equivalent of VS Code's `reloadAndRefreshUI()`.  It
     * is called both from the manual refresh action and from the JVM WatchService
     * file watcher when another window writes the shared state file.
     *
     * NOTE: deliberately does NOT call [broadcastState] / savePetState — an
     * inactive window must not overwrite the shared file written by the active
     * ticker (mirrors BUGFIX-050 from the VS Code side).
     */
    fun reloadFromDisk() {
        val persistence = service<CodotchiPersistence>()
        val shared = persistence.loadSharedFileForSync() ?: return
        val (freshState, savedAt) = shared

        val elapsedSeconds = if (savedAt > 0L) {
            ((System.currentTimeMillis() - savedAt) / 1000L).toInt()
        } else 0

        val decayed = if (elapsedSeconds > 0) {
            applyOfflineDecay(freshState, elapsedSeconds)
        } else freshState

        stateLock.withLock {
            currentState = decayed
            // Reset meal cycle — we can't know what the other window gave
            mealsGivenThisCycle = 0
        }

        // Push to UI without saving (the other window is the authoritative writer)
        val (state, meals, highScore) = stateLock.withLock {
            Triple(currentState, mealsGivenThisCycle, currentHighScore)
        }
        val devMode = lastDevMode
        val unlockedCharacter2 = getCustomCharacterByPasscode(service<CodotchiSettings>().characterPasscode)?.spriteType
        val defaultPetName2 = getCustomCharacterByPasscode(service<CodotchiSettings>().characterPasscode)?.defaultName ?: "Codotchi"
        val liveSubscribed2 = com.intellij.ide.util.PropertiesComponent.getInstance()
            .getBoolean("codotchi.liveSubscribed", false)
        val cached2 = rankCache
        val liveRank2 = if (liveSubscribed2 && state != null && state.alive && cached2 != null) cached2.rank else null
        val liveTotalScores2 = if (liveSubscribed2 && state != null && state.alive && cached2 != null) cached2.total else null
        val liveLastPushed2 = liveLastPushedAtMs.takeIf { it > 0L }
        ApplicationManager.getApplication().invokeLater {
            if (state != null) {
                browserPanels.forEach { it.postState(state, meals, highScore, devMode, unlockedCharacter2, defaultPetName2, liveRank2, liveTotalScores2, liveSubscribed2, liveLastPushed2) }
                statusWidget?.update(state)
            }
        }
    }

    /**
     * Start a JVM WatchService on the directory containing the shared state file.
     * When the file is modified by another window, calls [reloadFromDisk] with a
     * 200 ms debounce (WatchService can fire multiple events per atomic write).
     *
     * Runs on a daemon thread so it does not prevent IDE shutdown.
     */
    private fun startFileWatcher() {
        if (fileWatcherThread != null) return
        val persistence = service<CodotchiPersistence>()
        val stateDir: Path = persistence.getSharedStateDir() ?: return

        val thread = Thread {
            try {
                val watcher = FileSystems.getDefault().newWatchService()
                stateDir.register(
                    watcher,
                    StandardWatchEventKinds.ENTRY_CREATE,
                    StandardWatchEventKinds.ENTRY_MODIFY,
                )
                while (!Thread.currentThread().isInterrupted) {
                    // Poll with a timeout so the thread can be interrupted
                    val key = watcher.poll(2, TimeUnit.SECONDS) ?: continue
                    var relevant = false
                    for (event in key.pollEvents()) {
                        val ctx = event.context()
                        if (ctx is Path && ctx.toString() == "state.json") {
                            relevant = true
                        }
                    }
                    key.reset()
                    if (!relevant) continue

                    // Debounce: skip if we reloaded within the last 200 ms
                    val now = System.currentTimeMillis()
                    if (now - lastWatcherReload.get() < 200L) continue

                    // Only reload if this instance is NOT the active ticker
                    // (if we are ticking we are the writer — no need to re-read)
                    if (tickFuture != null) continue

                    lastWatcherReload.set(now)
                    reloadFromDisk()
                }
                watcher.close()
            } catch (_: InterruptedException) {
                // Normal shutdown
            } catch (_: Exception) {
                // Watch service unavailable on this platform — silent degradation
            }
        }
        thread.isDaemon = true
        thread.name = "codotchi-file-watcher"
        thread.start()
        fileWatcherThread = thread
    }

    /** Stop the file-watcher thread if it is running. */
    private fun stopFileWatcher() {
        fileWatcherThread?.interrupt()
        fileWatcherThread = null
    }

    /**
     * Called by [CodotchiConfigurable] when the user enables [perWorkspacePet].
     * Copies the shared state file to the project-specific path (first-enable
     * migration), then restarts the file watcher on the new directory and reloads
     * the webview.
     */
    fun onPerWorkspacePetEnabled() {
        val persistence = service<CodotchiPersistence>()
        persistence.copySharedToProject(persistence.currentProjectBasePath)
        stopFileWatcher()
        startFileWatcher()
        reloadWebview()
    }

    /**
     * Called by [CodotchiConfigurable] when the user disables [perWorkspacePet].
     * Restarts the file watcher on the shared (global) state directory and reloads.
     */
    fun onPerWorkspacePetDisabled() {
        stopFileWatcher()
        startFileWatcher()
        reloadWebview()
    }

    /**
     * Start a JVM WatchService on every .git directory found in currently-open
     * projects, watching for modifications to COMMIT_EDITMSG.  When the file is
     * written (i.e. a git commit was made), calls [triggerCommitActivity].
     *
     * Runs on a single daemon thread.  Gracefully no-ops if no .git directories
     * are found or if the WatchService is unavailable on this platform.
     */
    private fun startGitCommitWatcher() {
        if (gitCommitWatcherThread != null) return

        // Collect all .git directories from open projects.
        val gitDirs = ProjectManager.getInstance().openProjects.mapNotNull { project ->
            project.basePath?.let { base ->
                val gitDir = java.nio.file.Paths.get(base, ".git")
                if (gitDir.toFile().isDirectory) gitDir else null
            }
        }
        if (gitDirs.isEmpty()) return

        val thread = Thread {
            try {
                val watcher = FileSystems.getDefault().newWatchService()
                for (gitDir in gitDirs) {
                    gitDir.register(
                        watcher,
                        StandardWatchEventKinds.ENTRY_CREATE,
                        StandardWatchEventKinds.ENTRY_MODIFY,
                    )
                }
                while (!Thread.currentThread().isInterrupted) {
                    val key = watcher.poll(2, TimeUnit.SECONDS) ?: continue
                    var relevant = false
                    for (event in key.pollEvents()) {
                        val ctx = event.context()
                        if (ctx is Path && ctx.toString() == "COMMIT_EDITMSG") {
                            relevant = true
                        }
                    }
                    key.reset()
                    if (relevant) {
                        triggerCommitActivity()
                    }
                }
                watcher.close()
            } catch (_: InterruptedException) {
                // Normal shutdown
            } catch (_: Exception) {
                // WatchService unavailable or project path inaccessible — silent degradation
            }
        }
        thread.isDaemon = true
        thread.name = "codotchi-git-commit-watcher"
        thread.start()
        gitCommitWatcherThread = thread
    }

    private fun stopGitCommitWatcher() {
        gitCommitWatcherThread?.interrupt()
        gitCommitWatcherThread = null
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
        val unlockedCharacter = getCustomCharacterByPasscode(service<CodotchiSettings>().characterPasscode)?.spriteType
        val defaultPetName = getCustomCharacterByPasscode(service<CodotchiSettings>().characterPasscode)?.defaultName ?: "Codotchi"

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
                // Capture death time of THIS run on the first dead tick only.
                // Never use highScore.diedAt — when the current run is not a new record,
                // highScore still points to the previous run, whose diedAt predates this
                // run's spawnedAt and causes leaderboard validation to reject the submission.
                if (lastRunDiedAt == 0L) { lastRunDiedAt = diedAt }

                // One-time leaderboard notification on first death
                val props = com.intellij.ide.util.PropertiesComponent.getInstance()
                if (!props.getBoolean("codotchi.leaderboardDeathNotifShown", false)) {
                    props.setValue("codotchi.leaderboardDeathNotifShown", true)
                    ApplicationManager.getApplication().invokeLater {
                        val group = NotificationGroupManager.getInstance()
                            .getNotificationGroup("Codotchi Attention Calls")
                            ?: return@invokeLater
                        val notification = group.createNotification(
                            "Your Codotchi died! The leaderboard link is on the death screen — the page auto-refreshes every hour.",
                            NotificationType.INFORMATION
                        )
                        notification.addAction(object : com.intellij.openapi.actionSystem.AnAction("View Leaderboard") {
                            override fun actionPerformed(e: com.intellij.openapi.actionSystem.AnActionEvent) {
                                com.intellij.ide.BrowserUtil.browse("https://dylscoop.github.io/codotchi/leaderboard/")
                            }
                        })
                        notification.notify(null)
                    }
                }
            }
        }
        persistence.lastSaveTimestamp = System.currentTimeMillis()

        // Fire IDE notifications for attention_call_* events (only when mechanic is enabled)
        if (state != null && service<CodotchiSettings>().enableAttentionCalls) {
            for (event in state.events) {
                val msg = attentionCallMessage(state.name, event, state.spriteType) ?: continue
                fireAttentionNotification(msg)
            }
        }

        // Fire notification on old-age natural-causes death
        if (state != null && state.events.contains("died_of_old_age")) {
            fireAttentionNotification(
                "${state.name} has passed away of unforeseen natural causes due to old age."
            )
        }

        // Sick or losing health while idle means the pet needs the user to come back
        // and rescue it. Escalate to error-level severity and keep re-firing every
        // RESCUE_NOTIFY_REPEAT_MS while the condition persists, so a notification the
        // user missed or dismissed doesn't leave them unaware the pet is at risk.
        if (state != null && state.alive && isIdle()) {
            val tookDamageThisTick = state.events.any { it.endsWith("_damage") }
            if (state.sick || tookDamageThisTick) {
                val now = System.currentTimeMillis()
                if (now - lastRescueNotifyMs >= RESCUE_NOTIFY_REPEAT_MS) {
                    lastRescueNotifyMs = now
                    fireRescueNotification("${state.name} needs help and you're away — come back and rescue them!")
                }
            } else {
                lastRescueNotifyMs = 0L
            }
        } else {
            lastRescueNotifyMs = 0L
        }

        val liveSubscribed = com.intellij.ide.util.PropertiesComponent.getInstance()
            .getBoolean("codotchi.liveSubscribed", false)

        // Kick off a background rank refresh when subscribed and alive.
        if (liveSubscribed && state != null && state.alive) {
            fetchLiveRankAsync(state.ageDays)
            // Hourly live push — optimistically update timestamp to prevent duplicate launches.
            val now = System.currentTimeMillis()
            if (now - liveLastPushedAtMs >= LIVE_PUSH_INTERVAL_MS) {
                liveLastPushedAtMs = now
                pushLiveScoreAsync(state, promptIfNoToken = false)
            }
        }

        val cached = rankCache
        val liveRank = if (liveSubscribed && state != null && state.alive && cached != null) cached.rank else null
        val liveTotalScores = if (liveSubscribed && state != null && state.alive && cached != null) cached.total else null
        val liveLastPushed = liveLastPushedAtMs.takeIf { it > 0L }

        ApplicationManager.getApplication().invokeLater {
            if (state != null) {
                browserPanels.forEach { it.postState(state, meals, highScore, devMode, unlockedCharacter, defaultPetName, liveRank, liveTotalScores, liveSubscribed, liveLastPushed, leaderboardGithubUsername) }
                statusWidget?.update(state)
            }
        }
    }

    // ── Attention-call notifications ───────────────────────────────────────

    private fun attentionCallMessage(petName: String, event: String, spriteType: String? = null): String? {
        val customChar = spriteType?.let { getCustomCharacterBySpriteType(it) }
        return when (event) {
            "attention_call_hunger"          -> "$petName is hungry!"
            "attention_call_unhappiness"     -> "$petName is feeling sad!"
            "attention_call_poop"            -> "$petName made a mess and wants you to clean it up!"
            "attention_call_sick"            -> "$petName is sick!"
            "attention_call_low_energy"      -> "$petName is exhausted!"
            "attention_call_misbehaviour"    -> "$petName is misbehaving!"
            "attention_call_gift"            -> (customChar?.giftMessage ?: "$petName brought you a gift!").replace("__Name__", petName)
            "attention_call_critical_health" -> "$petName's health is critical!"
            else                             -> null
        }
    }

    private fun fireAttentionNotification(message: String) {
        ApplicationManager.getApplication().invokeLater {
            val group = NotificationGroupManager.getInstance()
                .getNotificationGroup("Codotchi Attention Calls")
                ?: return@invokeLater
            val notification = group.createNotification(message, NotificationType.WARNING)
            notification.addAction(object : com.intellij.openapi.actionSystem.AnAction("Open Gotchi") {
                override fun actionPerformed(e: com.intellij.openapi.actionSystem.AnActionEvent) {
                    val project = e.project
                        ?: ProjectManager.getInstance().openProjects.firstOrNull()
                        ?: return
                    ToolWindowManager.getInstance(project).getToolWindow("Codotchi")?.show()
                    notification.expire()
                }
            })
            notification.notify(null)  // null = app-level notification visible in all projects
        }
    }

    /** Error-level notification for the sick/losing-health-while-idle rescue case — louder than [fireAttentionNotification]. */
    private fun fireRescueNotification(message: String) {
        ApplicationManager.getApplication().invokeLater {
            val group = NotificationGroupManager.getInstance()
                .getNotificationGroup("Codotchi Attention Calls")
                ?: return@invokeLater
            val notification = group.createNotification(message, NotificationType.ERROR)
            notification.addAction(object : com.intellij.openapi.actionSystem.AnAction("Open Gotchi") {
                override fun actionPerformed(e: com.intellij.openapi.actionSystem.AnActionEvent) {
                    val project = e.project
                        ?: ProjectManager.getInstance().openProjects.firstOrNull()
                        ?: return
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
        stopFileWatcher()
        stopGitCommitWatcher()
        Toolkit.getDefaultToolkit().removeAWTEventListener(awtActivityListener)
        messageBusConnection?.disconnect()
    }
}
