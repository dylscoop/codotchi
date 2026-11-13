package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Companion animals (Stugotchi's cat). Mirrors vscode/tests/unit/companion.test.ts. */
class CompanionTest {

    private val noCalls = DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false, socialEnabled = true)

    private fun stu(happiness: Int = 50, cat: CompanionPet = CompanionPet("cat", 50, 50, 0)): PetState =
        createPet("Stu", "codeling", "neon", "stu").copy(stage = "adult", energy = 100, happiness = happiness, companion = cat)

    @Test
    fun `Stugotchi starts with a cat, other characters have none`() {
        assertEquals("cat", createPet("Stu", "codeling", "neon", "stu").companion?.spriteType)
        assertNull(createPet("Dog", "codeling", "neon", "dog").companion)
    }

    @Test
    fun `old Stu saves without a companion get a fresh cat, saved cats round-trip`() {
        assertEquals(CompanionPet("cat", 50, 50, 0), companionFromRaw(null, "stu"))
        val cat = CompanionPet("cat", 12, 80, 3)
        assertEquals(cat, companionFromRaw(socialToRaw(stu(cat = cat))["companion"], "stu"))
        assertNull(companionFromRaw(null, "dog"))
    }

    @Test
    fun `a meal feeds the cat and play cheers it up`() {
        val pet = stu(cat = CompanionPet("cat", 10, 20, 0)).copy(hunger = 10)
        assertEquals(10 + COMPANION_MEAL_HUNGER, feedMeal(pet, 0).companion?.hunger)
        assertEquals(20 + COMPANION_PLAY_HAPPINESS, play(pet).companion?.happiness)
    }

    @Test
    fun `petting the cat makes both happier, then goes on cooldown`() {
        val petted = petCompanion(stu(happiness = 40, cat = CompanionPet("cat", 50, 40, 0)))
        assertEquals(listOf("companion_petted"), petted.events)
        assertEquals(40 + COMPANION_PET_OWNER_HAPPINESS, petted.happiness)
        assertEquals(40 + COMPANION_PET_HAPPINESS, petted.companion?.happiness)
        assertEquals(listOf("companion_pet_refused"), petCompanion(petted).events)
    }

    @Test
    fun `a sad cat makes Stu sadder`() {
        val base = { cat: CompanionPet -> stu(happiness = 80, cat = cat).copy(ticksAlive = COMPANION_LINK_TICK_INTERVAL - 1) }
        val sad = tick(base(CompanionPet("cat", 80, 5, 0)), false, false, noCalls, { 0.99 })
        val fine = tick(base(CompanionPet("cat", 80, 80, 0)), false, false, noCalls, { 0.99 })
        assertEquals(fine.happiness - 1, sad.happiness)
    }

    @Test
    fun `the cat hisses at a visiting dog and cheers up`() {
        val pet = stu(cat = CompanionPet("cat", 80, 40, 0)).copy(
            ticksSinceLastVisit = 1_000_000,
            friend = FriendPet("Rex", "dog", "codeling", friendship = 50, visits = 1, lastVisitDay = 0.0),
        )
        val next = tick(pet, false, false, noCalls, { 0.0 })
        assertTrue("friend_visit_started" in next.events)
        assertTrue("companion_hiss" in next.events)
        assertTrue((next.companion?.happiness ?: 0) >= 40 + COMPANION_VISIT_HAPPINESS - 1)
    }
}
