package com.gotchi

import com.google.gson.Gson
import com.google.gson.JsonSyntaxException
import com.gotchi.engine.*
import com.intellij.openapi.components.*
import org.jdom.Element
import java.io.File

/**
 * GotchiPersistence — app-level persistent state stored in `gotchi.xml`.
 *
 * Uses IntelliJ's PersistentStateComponent with a raw JDOM Element so that
 * unknown/future attributes survive round-trips without breaking.
 *
 * JSON serialisation of PetState is handled by Gson (bundled with IntelliJ).
 *
 * Cross-IDE shared state: every save also writes to a JSON file on disk at
 *   Windows : %APPDATA%\gotchi\state.json
 *   macOS   : ~/.config/gotchi/state.json
 *   Linux   : ~/.config/gotchi/state.json
 *
 * On load, if the shared file is newer than the local `gotchi.xml` copy (e.g.
 * because VS Code or the OpenCode plugin saved more recently), the shared file
 * wins and the IntelliJ-side state is promoted to match it.
 */
@State(
    name = "GotchiPersistence",
    storages = [Storage("gotchi.xml")]
)
@Service(Service.Level.APP)
class GotchiPersistence : PersistentStateComponent<Element> {

    private val gson = Gson()

    /** Raw JSON string of the last saved PetState, or null if none. */
    var petStateJson: String? = null

    /** Epoch-millis timestamp of the last save (used for offline decay). */
    var lastSaveTimestamp: Long = 0L

    /** Meals given in the current wake cycle (persisted across restarts). */
    var mealsGivenThisCycle: Int = 0

    /** Raw JSON string of the all-time high score, or null if none. */
    var highScoreJson: String? = null

    // ── PersistentStateComponent ───────────────────────────────────────────

    override fun getState(): Element {
        val el = Element("GotchiPersistence")
        petStateJson?.let { el.setAttribute("petStateJson", it) }
        el.setAttribute("lastSaveTimestamp", lastSaveTimestamp.toString())
        el.setAttribute("mealsGivenThisCycle", mealsGivenThisCycle.toString())
        highScoreJson?.let { el.setAttribute("highScoreJsonV2", it) } // v2: ageDays now driven by dayTimer
        return el
    }

    override fun loadState(state: Element) {
        petStateJson        = state.getAttributeValue("petStateJson")
        lastSaveTimestamp   = state.getAttributeValue("lastSaveTimestamp")?.toLongOrNull()  ?: 0L
        mealsGivenThisCycle = state.getAttributeValue("mealsGivenThisCycle")?.toIntOrNull() ?: 0
        highScoreJson       = state.getAttributeValue("highScoreJsonV2") // v2: ageDays now driven by dayTimer
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Serialise [state] into [petStateJson] and write to the cross-IDE shared file. */
    fun savePetState(state: PetState) {
        petStateJson = gson.toJson(toRaw(state))
        lastSaveTimestamp = System.currentTimeMillis()
        saveToSharedFile(state)
    }

    /**
     * Deserialise [petStateJson] into a PetState, applying sanitisation for
     * fields that may be missing in saves from older plugin versions.
     *
     * If the cross-IDE shared file is newer than the local copy (e.g. VS Code
     * or OpenCode saved more recently), the shared file wins and the IntelliJ
     * state is promoted so the next save picks it up.
     *
     * Returns null if there is no saved state or the JSON is corrupt.
     */
    fun loadPetState(): PetState? {
        val localState: PetState? = petStateJson?.let { json ->
            try {
                val raw = gson.fromJson(json, RawPetState::class.java) ?: return@let null
                sanitise(raw)
            } catch (_: JsonSyntaxException) {
                null
            }
        }

        // Prefer the shared file if it is strictly newer.
        val shared = loadFromSharedFile()
        if (shared != null && shared.second > lastSaveTimestamp) {
            // Promote the shared state so the next getState() / save picks it up.
            petStateJson      = gson.toJson(toRaw(shared.first))
            lastSaveTimestamp = shared.second
            return shared.first
        }

        return localState
    }

    // ── High score helpers ─────────────────────────────────────────────────

    /**
     * Deserialise [highScoreJson] into a [HighScore], or null if none saved.
     */
    fun loadHighScore(): HighScore? {
        val json = highScoreJson ?: return null
        return try {
            gson.fromJson(json, HighScore::class.java)
        } catch (_: Exception) {
            null
        }
    }

    /** Serialise [score] into [highScoreJson]. */
    fun saveHighScore(score: HighScore) {
        highScoreJson = gson.toJson(score)
    }

    /** Clear the saved high score. */
    fun clearHighScore() {
        highScoreJson = null
    }

    // ── Cross-IDE shared state ─────────────────────────────────────────────

    private data class SharedStateFile(
        val state: RawPetState?,
        val savedAt: Long?,
    )

    private fun getSharedStatePath(): File {
        val base = if (System.getProperty("os.name").lowercase().contains("win")) {
            System.getenv("APPDATA") ?: "${System.getProperty("user.home")}/AppData/Roaming"
        } else {
            "${System.getProperty("user.home")}/.config"
        }
        return File(base, "gotchi/state.json")
    }

    /**
     * Write the current pet state to the shared cross-IDE file.
     * Failures are silently swallowed — the shared file is best-effort only.
     */
    private fun saveToSharedFile(state: PetState) {
        try {
            val file = getSharedStatePath()
            file.parentFile?.mkdirs()
            val payload = SharedStateFile(state = toRaw(state), savedAt = System.currentTimeMillis())
            file.writeText(gson.toJson(payload))
        } catch (_: Exception) {
            // Best-effort — never crash the plugin if the shared file is unavailable.
        }
    }

    /**
     * Read the shared cross-IDE file.
     * Returns a (PetState, savedAt) pair, or null if the file is absent / unparseable.
     */
    private fun loadFromSharedFile(): Pair<PetState, Long>? {
        return try {
            val file = getSharedStatePath()
            if (!file.exists()) return null
            val raw = gson.fromJson(file.readText(), SharedStateFile::class.java) ?: return null
            val rawState = raw.state ?: return null
            val savedAt  = raw.savedAt ?: return null
            Pair(sanitise(rawState), savedAt)
        } catch (_: Exception) {
            null
        }
    }

    // ── Internal raw DTO (maps 1:1 to JSON fields) ─────────────────────────

    /** Nullable mirror of PetState — all fields nullable so Gson never throws. */
    private data class RawPetState(
        val name: String?,
        val petType: String?,
        val spriteType: String?,       // absent in saves before v1.0.3
        val color: String?,
        val hunger: Int?,
        val happiness: Int?,
        val discipline: Int?,
        val energy: Int?,
        val health: Int?,
        val weight: Int?,
        val ageDays: Int?,
        val stage: String?,
        val character: String?,
        val alive: Boolean?,
        val sick: Boolean?,
        val sleeping: Boolean?,
        val mood: String?,
        val sprite: String?,
        val careScore: Double?,
        val ticksAlive: Int?,
        val poops: Int?,
        val ticksSinceLastPoop: Int?,
        val nextPoopIntervalTicks: Int?,   // may be absent in v0.0.1 saves
        val consecutiveSnacks: Int?,
        val hungerZeroTicks: Int?,
        val medicineDosesGiven: Int?,
        val dayTimer: Double?,             // absent in saves before v1.1.0
        val careScoreHungerSum: Long?,
        val careScoreHappinessSum: Long?,
        val careScoreHealthSum: Long?,
        val careScoreTicks: Long?,
        val events: List<String>?,
        val recentEventLog: List<String>?,  // absent in saves before v0.0.5
        val spawnedAt: Long?,               // absent in saves before v0.0.5
        val snacksGivenThisCycle: Int?,     // absent in saves before v0.0.5
        val wasIdle: Boolean?,              // absent in saves before v0.1.4
        val wasDeepIdle: Boolean?,          // absent in saves before v0.2.0
        // absent in saves before v0.4.0
        val activeAttentionCall: String?,
        val attentionCallActiveTicks: Int?,
        val attentionCallCooldowns: Map<String, Double>?, // Gson deserialises numbers as Double
        val neglectCount: Int?,
        val ticksWithUncleanedPoop: Int?,
        val ticksSinceLastMisbehaviour: Int?,
        val ticksSinceLastGift: Int?,
    )

    private fun sanitise(r: RawPetState): PetState {
        val petType = r.petType ?: "codeling"
        // nextPoopIntervalTicks absent in v0.0.1 saves — resample on load
        val nextPoop = r.nextPoopIntervalTicks ?: sampleNextPoopInterval(petType)

        val partial = PetState(
            name                  = r.name                  ?: "Gotchi",
            petType               = petType,
            // Back-compat: old saves won't have spriteType; default to "classic"
            spriteType            = r.spriteType            ?: "classic",
            color                 = r.color                 ?: "neon",
            hunger                = r.hunger                ?: 50,
            happiness             = r.happiness             ?: 50,
            discipline            = r.discipline            ?: 50,
            energy                = r.energy                ?: 100,
            health                = r.health                ?: 100,
            weight                = r.weight                ?: 5,
            ageDays               = r.ageDays               ?: 0,
            stage                 = r.stage                 ?: "egg",
            character             = r.character             ?: "",
            alive                 = r.alive                 ?: true,
            sick                  = r.sick                  ?: false,
            sleeping              = r.sleeping              ?: false,
            mood                  = r.mood                  ?: "",
            sprite                = r.sprite                ?: "",
            careScore             = r.careScore             ?: 0.5,
            ticksAlive            = r.ticksAlive            ?: 0,
            poops                 = r.poops                 ?: 0,
            ticksSinceLastPoop    = r.ticksSinceLastPoop    ?: 0,
            nextPoopIntervalTicks = nextPoop,
            consecutiveSnacks     = r.consecutiveSnacks     ?: 0,
            hungerZeroTicks       = r.hungerZeroTicks       ?: 0,
            medicineDosesGiven    = r.medicineDosesGiven    ?: 0,
            // Back-compat: old saves lack dayTimer; seed from ageDays integer
            dayTimer              = r.dayTimer              ?: (r.ageDays ?: 0).toDouble(),
            careScoreHungerSum    = r.careScoreHungerSum    ?: 0L,
            careScoreHappinessSum = r.careScoreHappinessSum ?: 0L,
            careScoreHealthSum    = r.careScoreHealthSum    ?: 0L,
            careScoreTicks        = r.careScoreTicks        ?: 0L,
            events                = emptyList(),
            recentEventLog        = r.recentEventLog        ?: emptyList(),
            wasIdle               = r.wasIdle               ?: false,
            wasDeepIdle           = r.wasDeepIdle           ?: false,
            spawnedAt             = r.spawnedAt             ?: System.currentTimeMillis(),
            snacksGivenThisCycle  = r.snacksGivenThisCycle ?: 0,
            // v0.4.0 attention-call fields — default to clean slate on old saves
            activeAttentionCall        = r.activeAttentionCall,
            attentionCallActiveTicks   = r.attentionCallActiveTicks   ?: 0,
            attentionCallCooldowns     = r.attentionCallCooldowns
                                            ?.mapValues { it.value.toInt() }
                                            ?: emptyMap(),
            neglectCount               = r.neglectCount               ?: 0,
            ticksWithUncleanedPoop     = r.ticksWithUncleanedPoop     ?: 0,
            ticksSinceLastMisbehaviour = r.ticksSinceLastMisbehaviour ?: 0,
            ticksSinceLastGift         = r.ticksSinceLastGift         ?: 0,
        )
        return partial
    }

    private fun toRaw(s: PetState) = RawPetState(
        name                  = s.name,
        petType               = s.petType,
        spriteType            = s.spriteType,
        color                 = s.color,
        hunger                = s.hunger,
        happiness             = s.happiness,
        discipline            = s.discipline,
        energy                = s.energy,
        health                = s.health,
        weight                = s.weight,
        ageDays               = s.ageDays,
        stage                 = s.stage,
        character             = s.character,
        alive                 = s.alive,
        sick                  = s.sick,
        sleeping              = s.sleeping,
        mood                  = s.mood,
        sprite                = s.sprite,
        careScore             = s.careScore,
        ticksAlive            = s.ticksAlive,
        poops                 = s.poops,
        ticksSinceLastPoop    = s.ticksSinceLastPoop,
        nextPoopIntervalTicks = s.nextPoopIntervalTicks,
        consecutiveSnacks     = s.consecutiveSnacks,
        hungerZeroTicks       = s.hungerZeroTicks,
        medicineDosesGiven    = s.medicineDosesGiven,
        dayTimer              = s.dayTimer,
        careScoreHungerSum    = s.careScoreHungerSum,
        careScoreHappinessSum = s.careScoreHappinessSum,
        careScoreHealthSum    = s.careScoreHealthSum,
        careScoreTicks        = s.careScoreTicks,
        events                = s.events,
        recentEventLog        = s.recentEventLog,
        wasIdle               = s.wasIdle,
        wasDeepIdle           = s.wasDeepIdle,
        spawnedAt             = s.spawnedAt,
        snacksGivenThisCycle  = s.snacksGivenThisCycle,
        // v0.4.0 attention-call fields
        activeAttentionCall        = s.activeAttentionCall,
        attentionCallActiveTicks   = s.attentionCallActiveTicks,
        attentionCallCooldowns     = s.attentionCallCooldowns.mapValues { it.value.toDouble() },
        neglectCount               = s.neglectCount,
        ticksWithUncleanedPoop     = s.ticksWithUncleanedPoop,
        ticksSinceLastMisbehaviour = s.ticksSinceLastMisbehaviour,
        ticksSinceLastGift         = s.ticksSinceLastGift,
    )
}

// ---------------------------------------------------------------------------
// HighScore — persisted record of the best run
// ---------------------------------------------------------------------------

/**
 * Summary of the best run ever recorded.
 * Compared by ageDays; ties broken by real-world elapsed time (longer wins).
 */
data class HighScore(
    val ageDays:   Int,
    val name:      String,
    val stage:     String,
    val petType:   String,
    val color:     String,
    val spawnedAt: Long,
    val diedAt:    Long,
)
