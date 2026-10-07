package com.codotchi

import com.codotchi.engine.*
import com.google.gson.JsonParser
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/**
 * CodotchiPersistence seals the codotchi.xml copy of the pet state and verifies it
 * on load. No IntelliJ application runs in unit tests, so the per-IDE state.json
 * write/read is skipped (best-effort, exceptions swallowed) and only the XML path
 * is exercised here.
 */
class PersistenceIntegrityTest {

    private fun pet(): PetState = createPet("Pixel", "codeling", "neon").copy(dayTimer = 3.25, ticksAlive = 500)

    @Test
    fun `saved state round-trips with its seal and the new fields`() {
        val p = CodotchiPersistence()
        p.savePetState(pet().copy(devModeEverUsed = true))
        assertNotNull(p.petStateSeal)
        val loaded = p.loadPetState()!!
        assertTrue(loaded.devModeEverUsed)
        assertEquals("", loaded.leaderboardIneligible)
    }

    @Test
    fun `seal survives an XML getState-loadState round trip`() {
        val a = CodotchiPersistence()
        a.savePetState(pet())
        val b = CodotchiPersistence()
        b.loadState(a.getState())
        assertEquals(a.petStateSeal, b.petStateSeal)
        assertEquals("", b.loadPetState()!!.leaderboardIneligible)
    }

    @Test
    fun `hand-edited save loads as tampered`() {
        val p = CodotchiPersistence()
        p.savePetState(pet())
        val json = JsonParser.parseString(p.petStateJson).asJsonObject
        json.addProperty("dayTimer", 300.0)
        p.petStateJson = json.toString()
        assertEquals("tampered", p.loadPetState()!!.leaderboardIneligible)
    }

    @Test
    fun `save without a seal loads as unverified`() {
        val p = CodotchiPersistence()
        p.savePetState(pet())
        p.petStateSeal = null
        assertEquals("unverified", p.loadPetState()!!.leaderboardIneligible)
    }

    @Test
    fun `old save without the new fields defaults them`() {
        val p = CodotchiPersistence()
        p.savePetState(pet())
        val json = JsonParser.parseString(p.petStateJson).asJsonObject
        json.remove("devModeEverUsed")
        json.remove("leaderboardIneligible")
        p.petStateJson = json.toString()
        val loaded = p.loadPetState()!!
        assertFalse(loaded.devModeEverUsed)
        // Defaults (false / "") are what the seal covered, so the seal still matches.
        assertEquals("", loaded.leaderboardIneligible)
    }
}
