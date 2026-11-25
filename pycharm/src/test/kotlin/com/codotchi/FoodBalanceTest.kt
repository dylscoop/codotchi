package com.codotchi

import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class FoodBalanceTest {
    private val noCalls = DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false)
    private fun pet(sprite: String = "cat") = createPet("Foodie", "codeling", "neon", sprite).copy(stage = "child")

    @Test
    fun `meal counters enforce normal and Stu caps even when a legacy host passes zero`() {
        for ((sprite, cap, gain) in listOf(Triple("cat", 3, 5), Triple("stu", 10, 4))) {
            var state = pet(sprite).copy(weight = 10)
            repeat(cap) { i ->
                state = feedMeal(state)
                assertTrue("fed_meal" in state.events)
                assertEquals(i + 1, state.mealsGivenThisCycle)
            }
            val refused = feedMeal(state, 0)
            assertEquals(listOf("meal_refused"), refused.events)
            assertEquals(cap, refused.mealsGivenThisCycle)
            assertEquals(10 + cap * gain, refused.weight)
        }
    }

    @Test
    fun `food weight comfortably exceeds full energy game loss for both characters`() {
        for ((sprite, mealCap, snackCap) in listOf(Triple("cat", 3, 7), Triple("stu", 10, 15))) {
            var fed = pet(sprite).copy(weight = 10)
            repeat(mealCap) { fed = feedMeal(fed) }
            repeat(snackCap) {
                fed = consumeSnack(startSnack(fed))
                assertTrue("fed_snack" in fed.events)
                while (fed.sick) fed = giveMedicine(fed)
            }
            assertEquals(snackCap, fed.snacksGivenThisCycle)
            assertEquals(listOf("snack_refused"), startSnack(fed).events)
            val foodWeight = if (sprite == "stu") 70 else 36
            assertEquals(foodWeight, fed.weight - 10)
            var played = pet(sprite).copy(weight = 90, energy = 100)
            repeat(4) { played = applyMinigameResult(play(played), "higher_lower", "lose") }
            assertEquals(0, played.energy)
            assertEquals(if (sprite == "stu") 32 else 20, 90 - played.weight)
            assertTrue(foodWeight >= (90 - played.weight) * 1.75)
        }
    }

    @Test
    fun `only full normal sleep resets food and permits eating again`() {
        var state = sleep(pet().copy(energy = 20, mealsGivenThisCycle = 3, snacksGivenThisCycle = 7))
        assertEquals(3, state.mealsGivenThisCycle)
        assertEquals(7, state.snacksGivenThisCycle)
        state = tick(state, config = noCalls)
        assertTrue(state.sleeping)
        val early = wake(state)
        assertEquals(3, early.mealsGivenThisCycle)
        assertEquals(7, early.snacksGivenThisCycle)
        assertEquals(listOf("meal_refused"), feedMeal(early).events)
        var ticks = 0
        while (state.sleeping && ticks++ < 100) state = tick(state, config = noCalls)
        assertTrue("auto_woke_up" in state.events)
        assertEquals(100, state.energy)
        assertEquals(0, state.mealsGivenThisCycle)
        assertEquals(0, state.snacksGivenThisCycle)
        assertTrue("fed_meal" in feedMeal(state).events)
        assertTrue("snack_placed" in startSnack(state).events)
    }

    @Test
    fun `break naps including offline expiry never refill food`() {
        val state = pet().copy(sleeping = true, energy = 100, breakNapTicksRemaining = 1,
            mealsGivenThisCycle = 3, snacksGivenThisCycle = 7)
        for (next in listOf(tick(state, config = noCalls), applyOfflineDecay(state, 600))) {
            assertFalse(next.sleeping)
            assertEquals(3, next.mealsGivenThisCycle)
            assertEquals(7, next.snacksGivenThisCycle)
        }
    }

    @Test
    fun `three floor snacks block another even for Stu and eating one frees a slot`() {
        for (sprite in listOf("cat", "stu")) {
            var state = pet(sprite)
            repeat(3) { state = startSnack(state) }
            assertEquals(listOf("snack_refused"), startSnack(state).events)
            assertEquals(3, state.snacksGivenThisCycle)
            state = startSnack(consumeSnack(state))
            assertEquals(3, state.snacksOnFloor)
            assertEquals(4, state.snacksGivenThisCycle)
            assertTrue("snack_placed" in state.events)
        }
    }

    @Test
    fun `every normal game costs exactly five weight and twenty five energy on win or loss`() {
        for (game in listOf("coin_flip", "left_right", "higher_lower", "fetch", "tug_of_war", "boxing", "laser", "blackjack", "guess", "memory", "boss_battle")) {
            for (result in listOf("win", "lose")) {
                val next = applyMinigameResult(play(pet().copy(weight = 40, energy = 100)), game, result, "always")
                assertEquals(35, next.weight, "$game $result")
                assertEquals(75, next.energy, "$game $result")
            }
        }
        assertEquals(35, applyMinigameResult(play(pet("stu").copy(weight = 40)), "blackjack", "win").weight)
        assertEquals(32, applyMinigameResult(play(pet("stu").copy(weight = 40)), "higher_lower", "win").weight)
    }

    @Test
    fun `elapsed normal sleep can finish but reopening before full recovery does not refill`() {
        val sleeping = sleep(pet().copy(energy = 20, mealsGivenThisCycle = 3, snacksGivenThisCycle = 7))
        val partial = applyOfflineDecay(sleeping, 3)
        assertTrue(partial.sleeping)
        assertEquals(3, partial.mealsGivenThisCycle)
        assertEquals(7, partial.snacksGivenThisCycle)
        val full = applyOfflineDecay(sleeping, 90)
        assertEquals(100, full.energy)
        assertFalse(full.sleeping)
        assertEquals(0, full.mealsGivenThisCycle)
        assertEquals(0, full.snacksGivenThisCycle)
        assertEquals(3, applyOfflineDecay(wake(sleeping), 90).mealsGivenThisCycle)
        assertEquals(3, applyOfflineDecay(sleeping.copy(paused = true), 90).mealsGivenThisCycle)
    }

    @Test
    fun `refusal preserves usage and food weights clamp`() {
        assertEquals(1, feedMeal(pet().copy(sick = true, mealsGivenThisCycle = 1)).mealsGivenThisCycle)
        assertEquals(99, feedMeal(pet().copy(weight = 98)).weight)
        assertEquals(99, consumeSnack(pet().copy(weight = 98, snacksOnFloor = 1)).weight)
    }
}
