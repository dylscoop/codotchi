package com.codotchi

import com.codotchi.engine.createPet
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Unit tests for StatusBarText.kt — mirrors vscode/tests/unit/statusBarText.test.ts. */
class StatusBarTextTest {

    private val pet = createPet("Pixel", "codeling", "neon")

    @Test
    fun `has no warning when no attention call is active`() {
        val (text, tooltip) = formatStatusWidget(pet.copy(activeAttentionCall = null), enabled = true)
        assertFalse("⚠" in text)
        assertFalse("⚠" in tooltip)
        assertTrue("Pixel" in text)
    }

    @Test
    fun `prefixes the text with a warning and leads the tooltip with the call`() {
        val (text, tooltip) = formatStatusWidget(pet.copy(activeAttentionCall = "pat"), enabled = true)
        assertTrue(text.startsWith("⚠ "))
        assertTrue(tooltip.startsWith("⚠ Pixel wants a pat!"))
    }

    @Test
    fun `names the craved food for a craving call`() {
        assertEquals("⚠ Pixel is craving a snack!",
            attentionCallLine(pet.copy(activeAttentionCall = "craving", cravingFood = "snack")))
    }

    @Test
    fun `shows a sick line in the tooltip`() {
        assertTrue("⚠ Sick!" in formatStatusWidget(pet.copy(sick = true), enabled = true).second)
    }

    @Test
    fun `is blank when the status bar setting is off`() {
        assertEquals("" to "", formatStatusWidget(pet.copy(activeAttentionCall = "pat"), enabled = false))
    }

    @Test
    fun `Tim wants a run and Stu wants stickers instead of a pat`() {
        assertEquals("⚠ Pixel wants to go for a run!", attentionCallLine(pet.copy(spriteType = "tim", activeAttentionCall = "pat")))
        assertEquals("⚠ Pixel wants to collect stickers!", attentionCallLine(pet.copy(spriteType = "stu", activeAttentionCall = "pat")))
    }

    @Test
    fun `Tim craves a tea`() {
        assertEquals("⚠ Pixel is craving a tea!",
            attentionCallLine(pet.copy(spriteType = "tim", activeAttentionCall = "craving", cravingFood = "snack")))
    }

    @Test
    fun `Stu craves a pint or salmon, kept for the whole craving`() {
        val craving = pet.copy(spriteType = "stu", activeAttentionCall = "craving", cravingFood = "snack")
        cravingItemFor(pet.copy(spriteType = "stu"))
        assertEquals("a pint", cravingItemFor(craving) { 0.0 })
        assertEquals("a pint", cravingItemFor(craving) { 0.99 })
        cravingItemFor(pet.copy(spriteType = "stu"))
        assertEquals("some salmon", cravingItemFor(craving) { 0.99 })
        assertNull(cravingItemFor(pet.copy(spriteType = "dog", activeAttentionCall = "craving", cravingFood = "snack")))
    }
}
