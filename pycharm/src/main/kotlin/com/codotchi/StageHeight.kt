package com.codotchi

/**
 * Pet stage height presets ([CodotchiSettings.stageHeight]) → canvas pixel height.
 * Compact stays above ~160 px so an upright Large pet (144 px + 12 px floor) still fits.
 * Mirrors vscode/src/stageHeight.ts.
 */
val STAGE_HEIGHT_PX: Map<String, Int> = linkedMapOf(
    "compact" to 180,
    "normal" to 240,
    "tall" to 320,
    "extraTall" to 400,
)

/** Canvas height for a stageHeight setting value; unknown values fall back to Normal. */
fun stageHeightPx(key: String?): Int = STAGE_HEIGHT_PX[key] ?: STAGE_HEIGHT_PX.getValue("normal")
