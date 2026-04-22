/**
 * spriteConstants.js — shared sprite-rendering constants
 *
 * Exposes on `window`:
 *   SPRITE_COLOR_PALETTES      — keyed colour palette map
 *   SPRITE_STAGE_SCALES        — per-stage size multiplier
 *   spriteGetPalette(colorKey) — returns the palette object for a given key
 *   spriteWeightWidthMult(w)   — returns width multiplier for a given weight (upright/snake only)
 *   spriteHeightRatio(type)    — returns height/width ratio for a given spriteType
 *   spriteQuadBellySag(w)      — returns extra belly-sag row count for overweight quadrupeds
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

  // ── Colour palettes ────────────────────────────────────────────────────────
  var COLOR_PALETTES = {
    neon:   { primary: "#39ff14", secondary: "#ff00ff", background: "#0d0d0d" },
    pastel: { primary: "#ffb3c1", secondary: "#b5ead7", background: "#57070c" },
    mono:   { primary: "#e0e0e0", secondary: "#888888", background: "#1a1a1a" },
    ocean:  { primary: "#00cfff", secondary: "#004e7c", background: "#001f3f" },
  };

  /**
   * Return the colour palette for a given key.
   * The "custom" key reads CSS custom properties injected by the host at
   * HTML-build time via --codotchi-custom-* variables, falling back to
   * safe defaults if not set.
   */
  function getPalette(colorKey) {
    if (colorKey === "custom") {
      var s = getComputedStyle(document.documentElement);
      return {
        primary:    s.getPropertyValue("--codotchi-custom-primary").trim()    || "#ff8c00",
        secondary:  s.getPropertyValue("--codotchi-custom-secondary").trim()  || "#ffffff",
        background: s.getPropertyValue("--codotchi-custom-background").trim() || "#1a1a2e",
      };
    }
    return COLOR_PALETTES[colorKey] || COLOR_PALETTES["neon"];
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
  window.SPRITE_COLOR_PALETTES    = COLOR_PALETTES;
  window.SPRITE_STAGE_SCALES      = STAGE_SCALES;
  window.spriteGetPalette         = getPalette;
  window.spriteWeightWidthMult    = weightWidthMultiplier;
  window.spriteHeightRatio        = spriteHeightRatio;
  window.spriteQuadBellySag       = quadrupedBellySagRows;

}());
