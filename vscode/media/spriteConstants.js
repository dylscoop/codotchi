/**
 * spriteConstants.js — shared sprite-rendering constants
 *
 * Exposes on `window`:
 *   SPRITE_ANIMAL_PALETTES      — realistic colour palette keyed by spriteType
 *   SPRITE_STAGE_SCALES         — per-stage size multiplier
 *   SPRITE_EGG_HATCH_DAYS       — dayTimer at which the egg hatches (drives the hatch animation)
 *   spriteGetPalette(spriteType) — returns the palette object for a given spriteType
 *   spriteWeightWidthMult(w)    — returns width multiplier for a given weight (upright/snake only)
 *   spriteHeightRatio(type)     — returns height/width ratio for a given spriteType
 *   spriteQuadBellySag(w)       — returns extra belly-sag row count for overweight quadrupeds
 *
 * Loaded by:
 *   - sidebar.html   (before sidebar.js, after sprites.js)
 *   - sprite_preview.html (before sprite_preview inline script)
 *
 * IMPORTANT: if any value changes here, update sidebar.js to match and
 * run the full test suite.
 */
(function () {
  "use strict";

  // ── Realistic per-animal colour palettes ───────────────────────────────────
  // primary   = body fill (pixel index 1)
  // secondary = eyes, snout, markings (pixel index 2)
  // accent    = stripes, comb, ridges (pixel index 3)
  // background = canvas background behind the pet
  var ANIMAL_PALETTES = {
    classic:  { primary: "#39ff14", secondary: "#ff00ff", accent: "#1aad00", background: "#0d0d0d" },
    sheep:    { primary: "#eceff1", secondary: "#5d4037", accent: "#b0bec5", background: "#1a1a1a" },
    snake:    { primary: "#558b2f", secondary: "#ffeb3b", accent: "#33691e", background: "#0d1a0d" },
    kangaroo: { primary: "#d9bb7b", secondary: "#663300", accent: "#8c5a24", background: "#1a1a1a" },
    tim:      { primary: "#f5c5a3", secondary: "#4a90d9", accent: "#2c3e50", background: "#1a1a2e" },
    stu:      { primary: "#f0f0e8", secondary: "#0055b3", accent: "#cc1100", background: "#1a1a2e" },
  };

  /** Fallback palette used when spriteType is not found in ANIMAL_PALETTES. */
  var FALLBACK_PALETTE = ANIMAL_PALETTES["classic"];

  /**
   * Return the realistic colour palette for a given spriteType.
   * Falls back to the classic palette if the type is unknown.
   * @param {string} spriteType
   * @returns {{ primary: string, secondary: string, accent: string, background: string }}
   */
  function getPalette(spriteType) {
    return ANIMAL_PALETTES[spriteType] || FALLBACK_PALETTE;
  }

  // ── Stage scales ──────────────────────────────────────────────────────────
  /** Per-stage multiplier applied to BASE_SIZE to derive bodySize. */
  var STAGE_SCALES = {
    egg:    0.325,
    baby:   0.65,
    child:  0.75,
    teen:   0.85,
    adult:  1.00,
    senior: 1.00,
  };

  // ── Egg hatch progress ────────────────────────────────────────────────────
  /** dayTimer at which the egg hatches. Must match EVOLUTION_DAY_THRESHOLDS.egg
   *  in packages/core/src/gameEngine.ts (and Constants.kt); a test checks this. */
  var EGG_HATCH_DAYS = 0.267;

  // ── Sprite orientation ────────────────────────────────────────────────────
  /** Sprite types that use a portrait (32 cols × 48 rows) grid. */
  var UPRIGHT_TYPES = { classic: 1, tim: 1, stu: 1 };

  // ── Sprite grid metadata (v2) ─────────────────────────────────────────────
  /**
   * Per-spriteType grid dimensions and leg row boundary.
   * Hand-drawn sprites declare their fixed sizes here. Species built from
   * sprites/<species>/ get their entries (and palettes) from
   * sprites.generated.js, which loads next and extends both objects.
   *
   * cols        — number of columns in the sprite grid
   * rows        — number of rows in the sprite grid
   * legRowStart — first row index that belongs to the leg zone
   *               (legs must sit in rows legRowStart..rows-1)
   */
  var SPRITE_GRID_META = {
    // Upright sprites (32 × 48)
    classic:  { cols: 32, rows: 48, legRowStart: 37 },
    tim:      { cols: 32, rows: 48, legRowStart: 37 },
    stu:      { cols: 64, rows: 48, legRowStart: 37 },
    // Quadruped sprites (48 × 32; bulk-imported ones are in sprites.generated.js)
    sheep:    { cols: 48, rows: 32, legRowStart: 25 },
    snake:    { cols: 48, rows: 32, legRowStart: 25 },
    kangaroo: { cols: 48, rows: 32, legRowStart: 25 },
  };

  /**
   * Return the height/width ratio for a given spriteType.
   * Reads from SPRITE_GRID_META for all known types (including custom v2 imports).
   * Falls back to UPRIGHT_TYPES heuristic for unknown types.
   * @param {string} spriteType
   * @returns {number}
   */
  function spriteHeightRatio(spriteType) {
    var meta = SPRITE_GRID_META[spriteType];
    if (meta) { return meta.rows / meta.cols; }
    // Fallback for any spriteType not yet registered in SPRITE_GRID_META
    return UPRIGHT_TYPES[spriteType] ? (48 / 32) : (32 / 48);
  }

  // ── Weight → width multiplier (upright sprites and snake only) ───────────
  /**
   * Return the width multiplier for the sprite based on weight.
   * Used only for upright sprites (classic, tim, stu) and snake.
   * Quadrupeds other than snake use belly-sag rows instead — see spriteQuadBellySag().
   * @param {number} weight  0–100
   * @returns {number}
   */
  function weightWidthMultiplier(weight) {
    if (weight > 80)  { return 1.50; }
    if (weight > 50)  { return 1.30; }
    if (weight < 17)  { return 0.80; }
    return 1.0;
  }

  // ── Overweight quadruped belly-sag ────────────────────────────────────────
  /**
   * Return the number of extra belly-sag rows to insert between the body and
   * legs for an overweight quadruped.  Sag rows are drawn procedurally in the
   * renderer using the body's bottom-row silhouette, so the sprite becomes
   * taller (not wider) when overweight.
   *
   * Only applies to quadruped sprites that are NOT snake.
   * Snake keeps the standard width-multiplier path.
   *
   * @param {number} weight  0–100
   * @returns {number}  0, 1, or 3 extra rows
   */
  function quadrupedBellySagRows(weight) {
    if (weight > 80)  { return 3; }
    if (weight > 50)  { return 1; }
    return 0;
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  window.SPRITE_ANIMAL_PALETTES   = ANIMAL_PALETTES;
  window.SPRITE_STAGE_SCALES      = STAGE_SCALES;
  window.SPRITE_EGG_HATCH_DAYS    = EGG_HATCH_DAYS;
  window.UPRIGHT_TYPES            = UPRIGHT_TYPES;
  window.SPRITE_GRID_META         = SPRITE_GRID_META;
  window.spriteGetPalette         = getPalette;
  window.spriteWeightWidthMult    = weightWidthMultiplier;
  window.spriteHeightRatio        = spriteHeightRatio;
  window.spriteQuadBellySag       = quadrupedBellySagRows;

}());
