package com.codotchi

/**
 * Pet stage height presets ([CodotchiSettings.stageHeight]) → canvas pixel height.
 * Compact (150 px) is a little short for an upright Large pet (144 px + 12 px floor): its head can touch the top.
 * Mirrors vscode/src/stageHeight.ts.
 */
val STAGE_HEIGHT_PX: Map<String, Int> = linkedMapOf(
    "compact" to 150,
    "normal" to 180,
    "tall" to 210,
    "extraTall" to 240,
)

/** Canvas height for a stageHeight setting value; unknown values fall back to Normal. */
fun stageHeightPx(key: String?): Int = STAGE_HEIGHT_PX[key] ?: STAGE_HEIGHT_PX.getValue("normal")
