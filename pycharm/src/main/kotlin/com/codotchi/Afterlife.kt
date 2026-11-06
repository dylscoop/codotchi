package com.codotchi

import com.codotchi.engine.PetState
import com.codotchi.engine.isDeathlessPet
import com.google.gson.Gson
import com.google.gson.JsonParser

/**
 * Afterlife — the user's local Afterlife: pets they chose to bury, plus a count
 * of cremated pets (an urn count). Stored in PropertiesComponent, so it is local
 * to this IDE. Every pet that dies gets a Bury / Cremate choice on the death
 * screen; a pet left undecided when a new one hatches is cremated.
 *
 * Mirrors vscode/src/afterlife.ts.
 */
object Afterlife {

    data class Entry(
        val name: String,
        val petType: String,
        val spriteType: String,
        val stage: String,
        val ageDays: Int,
        /** "old_age" or "neglect". */
        val cause: String,
        val deathless: Boolean,
        val spawnedAt: Long,
        val diedAt: Long,
    )

    data class Data(
        /** Buried pets, newest first. */
        val buried: List<Entry> = emptyList(),
        val cremated: Int = 0,
        /** spawnedAt of the last pet whose fate was decided (0 = none). */
        val lastDecidedSpawnedAt: Long = 0L,
    )

    /** The slice sent to the webview with every stateUpdate. */
    data class View(val name: String, val buried: List<Entry>, val cremated: Int, val pending: Boolean)

    const val MAX_ENTRIES = 100
    private const val PROPERTY_KEY = "codotchi.afterlife.v1"
    private val gson = Gson()

    /** Normalise a stored JSON string (missing / partial / corrupt) into [Data]. */
    fun parse(json: String?): Data {
        if (json.isNullOrBlank()) return Data()
        return try {
            val o = JsonParser.parseString(json).asJsonObject
            val buried = o.getAsJsonArray("buried")?.mapNotNull {
                // Gson ignores Kotlin nullability, so a corrupt entry can carry a null name.
                runCatching { gson.fromJson(it, Entry::class.java) }.getOrNull()?.takeIf { e -> (e.name as String?) != null }
            } ?: emptyList()
            val cremated = o.get("cremated")?.takeIf { it.isJsonPrimitive }?.asInt?.coerceAtLeast(0) ?: 0
            val last = o.get("lastDecidedSpawnedAt")?.takeIf { it.isJsonPrimitive }?.asLong ?: 0L
            Data(buried, cremated, last)
        } catch (_: Exception) {
            Data()
        }
    }

    fun toJson(data: Data): String = gson.toJson(data)

    /** True when this dead pet still needs a Bury / Cremate choice. */
    fun pending(data: Data, state: PetState?): Boolean =
        state != null && !state.alive && state.spawnedAt > 0L && state.spawnedAt != data.lastDecidedSpawnedAt

    fun entryFor(state: PetState): Entry = Entry(
        name       = state.name,
        petType    = state.petType,
        spriteType = state.spriteType,
        stage      = state.stage,
        ageDays    = state.ageDays,
        cause      = if ("died_of_old_age" in state.recentEventLog) "old_age" else "neglect",
        deathless  = isDeathlessPet(state),
        spawnedAt  = state.spawnedAt,
        diedAt     = state.diedAt.takeIf { it > 0L } ?: System.currentTimeMillis(),
    )

    /** Apply the user's choice. No-op (same object) when the pet isn't awaiting one. */
    fun decide(data: Data, state: PetState, choice: String): Data {
        if (!pending(data, state)) return data
        return when (choice) {
            "bury" -> Data(
                buried = (listOf(entryFor(state)) + data.buried).take(MAX_ENTRIES),
                cremated = data.cremated,
                lastDecidedSpawnedAt = state.spawnedAt,
            )
            "cremate" -> data.copy(cremated = data.cremated + 1, lastDecidedSpawnedAt = state.spawnedAt)
            else -> data
        }
    }

    /** A new pet is hatching: an undecided dead pet is cremated. */
    fun settleBeforeNewPet(data: Data, previous: PetState?): Data =
        if (previous == null) data else decide(data, previous, "cremate")

    /** The user's name for their Afterlife, trimmed; blank falls back to "Afterlife". */
    fun displayName(raw: String?): String = raw?.trim()?.take(32)?.takeIf { it.isNotEmpty() } ?: "Afterlife"

    fun view(data: Data, state: PetState?, name: String?): View =
        View(displayName(name), data.buried, data.cremated, pending(data, state))

    // ── Persistence (application-level, local to this IDE) ────────────────

    fun load(): Data = parse(com.intellij.ide.util.PropertiesComponent.getInstance().getValue(PROPERTY_KEY))

    fun save(data: Data) {
        com.intellij.ide.util.PropertiesComponent.getInstance().setValue(PROPERTY_KEY, toJson(data))
    }
}
