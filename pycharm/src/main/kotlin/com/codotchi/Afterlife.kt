package com.codotchi

import com.codotchi.engine.PetState
import com.codotchi.engine.isDeathlessPet
import com.google.gson.Gson
import com.google.gson.JsonParser

/**
 * Afterlife — the user's local Afterlife: every pet they cremated, with its
 * name, age and real time alive. Stored in PropertiesComponent, so it is local
 * to this IDE. The death screen offers a Cremate button; a pet left uncremated
 * when a new one hatches is cremated then. The user can remove entries or clear it.
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
        /** Cremated pets, newest first. */
        val cremated: List<Entry> = emptyList(),
        /** spawnedAt of the last pet cremated (0 = none); stops a pet being cremated twice. */
        val lastDecidedSpawnedAt: Long = 0L,
    )

    /** The slice sent to the webview with every stateUpdate. */
    data class View(val name: String, val cremated: List<Entry>, val pending: Boolean)

    const val MAX_ENTRIES = 100
    private const val PROPERTY_KEY = "codotchi.afterlife.v1"
    private val gson = Gson()

    /** Normalise a stored JSON string (missing / partial / corrupt / 2.35.0) into [Data]. */
    fun parse(json: String?): Data {
        if (json.isNullOrBlank()) return Data()
        return try {
            val o = JsonParser.parseString(json).asJsonObject
            val raw = o.get("cremated")?.takeIf { it.isJsonArray }?.asJsonArray
            val cremated = raw?.mapNotNull {
                // Gson ignores Kotlin nullability, so a corrupt entry can carry a null name.
                runCatching { gson.fromJson(it, Entry::class.java) }.getOrNull()?.takeIf { e -> (e.name as String?) != null }
            } ?: emptyList()
            val last = o.get("lastDecidedSpawnedAt")?.takeIf { it.isJsonPrimitive }?.asLong ?: 0L
            Data(cremated, last)
        } catch (_: Exception) {
            Data()
        }
    }

    fun toJson(data: Data): String = gson.toJson(data)

    /** True when this dead pet is still waiting to be cremated. */
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

    /** Cremate a dead pet. No-op (same object) when the pet isn't waiting. */
    fun cremate(data: Data, state: PetState): Data {
        if (!pending(data, state)) return data
        return Data((listOf(entryFor(state)) + data.cremated).take(MAX_ENTRIES), state.spawnedAt)
    }

    /** A new pet is hatching: an uncremated dead pet is cremated now. */
    fun settleBeforeNewPet(data: Data, previous: PetState?): Data =
        if (previous == null) data else cremate(data, previous)

    /** Remove one entry (matched by spawnedAt). */
    fun remove(data: Data, spawnedAt: Long): Data {
        val kept = data.cremated.filter { it.spawnedAt != spawnedAt }
        return if (kept.size == data.cremated.size) data else data.copy(cremated = kept)
    }

    /** Empty the Afterlife. The cremated marker stays, so the current dead pet can't be cremated again. */
    fun clear(data: Data): Data = data.copy(cremated = emptyList())

    /** The user's name for their Afterlife, trimmed; blank falls back to "Afterlife". */
    fun displayName(raw: String?): String = raw?.trim()?.take(32)?.takeIf { it.isNotEmpty() } ?: "Afterlife"

    fun view(data: Data, state: PetState?, name: String?): View =
        View(displayName(name), data.cremated, pending(data, state))

    // ── Persistence (application-level, local to this IDE) ────────────────

    fun load(): Data = parse(com.intellij.ide.util.PropertiesComponent.getInstance().getValue(PROPERTY_KEY))

    fun save(data: Data) {
        com.intellij.ide.util.PropertiesComponent.getInstance().setValue(PROPERTY_KEY, toJson(data))
    }
}
