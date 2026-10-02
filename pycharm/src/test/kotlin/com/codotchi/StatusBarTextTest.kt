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
}
