/**
 * spriteConstants.js — shared sprite-rendering constants
 *
 * Exposes on `window`:
 *   SPRITE_ANIMAL_PALETTES      — realistic colour palette keyed by spriteType
 *   SPRITE_STAGE_SCALES         — per-stage size multiplier
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
    monkey:   { primary: "#8b5e3c", secondary: "#f5c07a", accent: "#5a3a1a", background: "#1a1a1a" },
    rooster:  { primary: "#c0392b", secondary: "#f39c12", accent: "#7d1f1f", background: "#1a1a1a" },
    dragon:   { primary: "#2ecc71", secondary: "#f1c40f", accent: "#1a6b3a", background: "#0d1a0d" },
    cat:      { primary: "#e8c98a", secondary: "#6b4c2a", accent: "#b07840", background: "#1a1a1a" },
    rat:      { primary: "#9e9e9e", secondary: "#f48fb1", accent: "#616161", background: "#1a1a1a" },
    ox:       { primary: "#5d4037", secondary: "#d7ccc8", accent: "#3e2723", background: "#1a1a1a" },
    tiger:    { primary: "#e67e22", secondary: "#2c2c2c", accent: "#1a1a1a", background: "#1a1a1a" },
    rabbit:   { primary: "#f5f5f5", secondary: "#f48fb1", accent: "#e0e0e0", background: "#1a1a1a" },
    horse:    { primary: "#8b6914", secondary: "#4a3728", accent: "#5c4a1e", background: "#1a1a1a" },
    sheep:    { primary: "#eceff1", secondary: "#5d4037", accent: "#b0bec5", background: "#1a1a1a" },
    dog:      { primary: "#c8853a", secondary: "#3d2008", accent: "#8b5320", background: "#1a1a1a" },
    pig:      { primary: "#f8bbd0", secondary: "#e91e63", accent: "#f48fb1", background: "#1a1a1a" },
    snake:    { primary: "#558b2f", secondary: "#ffeb3b", accent: "#33691e", background: "#0d1a0d" },
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

  // ── Sprite orientation ────────────────────────────────────────────────────
  /** Sprite types that use a portrait (32 cols × 48 rows) grid. */
  var UPRIGHT_TYPES = { classic: 1, monkey: 1, rooster: 1, dragon: 1 };

  /**
   * Return the height/width ratio for a given spriteType.
   * Upright grids are 32×48 → ratio 48/32 = 1.5.
   * Quadruped/snake grids are 48×32 → ratio 32/48 ≈ 0.667.
   * This gives square pixel cells, matching ASCII sketch proportions.
   * @param {string} spriteType
   * @returns {number}
   */
  function spriteHeightRatio(spriteType) {
    return UPRIGHT_TYPES[spriteType] ? (48 / 32) : (32 / 48);
  }

  // ── Weight → width multiplier (upright sprites and snake only) ───────────
  /**
   * Return the width multiplier for the sprite based on weight.
   * Used only for upright sprites (classic, monkey, rooster, dragon) and snake.
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
  window.spriteGetPalette         = getPalette;
  window.spriteWeightWidthMult    = weightWidthMultiplier;
  window.spriteHeightRatio        = spriteHeightRatio;
  window.spriteQuadBellySag       = quadrupedBellySagRows;

}());
