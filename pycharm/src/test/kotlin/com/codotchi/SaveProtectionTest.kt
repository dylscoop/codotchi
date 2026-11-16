package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File

/** Atomic writes, stale-overwrite refusal and backup recovery for state.json. */
class SaveProtectionTest {

    @TempDir
    lateinit var dir: File

    private fun pet(day: Double): PetState =
        createPet("Scout", "codeling", "neon").copy(spawnedAt = 1_790_000_000_000L, dayTimer = day, ageDays = day.toInt())

    private fun persistence(): CodotchiPersistence =
        CodotchiPersistence().apply { stateFileOverride = File(dir, "state.json") }

    @Test
    fun `save leaves no temp file behind`() {
        val p = persistence()
        assertTrue(p.savePetState(pet(10.0)))
        assertTrue(File(dir, "state.json").exists())
        assertFalse(File(dir, "state.json.tmp").exists())
    }

    @Test
    fun `older copy of the same pet cannot overwrite a newer save`() {
        persistence().savePetState(pet(122.0))
        val stale = persistence()
        assertFalse(stale.savePetState(pet(102.0)))
        assertEquals(122, persistence().loadPetState()!!.ageDays)
    }

    @Test
    fun `a different pet can overwrite`() {
        persistence().savePetState(pet(122.0))
        val fresh = createPet("Newbie", "codeling", "neon")
        assertTrue(persistence().savePetState(fresh))
        assertEquals("Newbie", persistence().loadPetState()!!.name)
    }

    @Test
    fun `corrupt state file falls back to the newest backup`() {
        val p = persistence()
        p.savePetState(pet(50.0))
        p.savePetState(pet(51.0)) // rotates the 50-day save into bak1
        assertTrue(File(dir, "state.json.bak1").exists())
        File(dir, "state.json").writeText("{\"state\":{\"na") // truncated mid-write
        assertEquals(50, persistence().loadPetState()!!.ageDays)
    }
}
