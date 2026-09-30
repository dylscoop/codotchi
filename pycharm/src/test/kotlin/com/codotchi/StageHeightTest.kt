package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Unit tests for StageHeight.kt — mirrors vscode/tests/unit/stageHeight.test.ts. */
class StageHeightTest {

    @Test
    fun `maps each preset to its pixel height`() {
        assertEquals(180, stageHeightPx("compact"))
        assertEquals(240, stageHeightPx("normal"))
        assertEquals(320, stageHeightPx("tall"))
        assertEquals(400, stageHeightPx("extraTall"))
    }

    @Test
    fun `falls back to Normal for missing or unknown values`() {
        assertEquals(240, stageHeightPx(null))
        assertEquals(240, stageHeightPx("huge"))
    }

    @Test
    fun `presets match the VS Code stageHeight presets`() {
        assertEquals(listOf("compact", "normal", "tall", "extraTall"), STAGE_HEIGHT_PX.keys.toList())
        assertEquals("normal", CodotchiSettings.State().stageHeight)
    }
}
