/**
 * spriteConstants.js — shared sprite-rendering constants
 *
 * Exposes on `window`:
 *   SPRITE_COLOR_PALETTES      — keyed colour palette map
 *   SPRITE_STAGE_SCALES        — per-stage size multiplier
 *   SPRITE_BODY_HEIGHT_MULTS   — per-stage height aspect-ratio multiplier
 *   spriteGetPalette(colorKey) — returns the palette object for a given key
 *   spriteWeightWidthMult(w)   — returns width multiplier for a given weight
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

  // ── Body height multipliers ───────────────────────────────────────────────
  /**
   * Height multipliers per stage (relative to bodySize).
   * Quadrupeds are natively landscape (48x32) so height mult < 1.
   * Uprights are natively portrait (32x48) so height mult > 1.
   * The renderer uses isUpright to pick the right grid; these mults
   * are the aspect-ratio correction applied on top of BASE_SIZE.
   */
  var STAGE_BODY_HEIGHT_MULTS = {
    egg:    1.3,
    baby:   0.67,
    child:  0.67,
    teen:   0.75,
    adult:  0.67,
    senior: 0.67,
  };

  // ── Weight → width multiplier ──────────────────────────────────────────────
  /**
   * Return the width multiplier for the sprite based on weight.
   * @param {number} weight  0–100
   * @returns {number}
   */
  function weightWidthMultiplier(weight) {
    if (weight > 80)  { return 1.50; }
    if (weight > 50)  { return 1.30; }
    if (weight < 17)  { return 0.80; }
    return 1.0;
  }

  // ── Exports ───────────────────────────────────────────────────────────────
  window.SPRITE_COLOR_PALETTES    = COLOR_PALETTES;
  window.SPRITE_STAGE_SCALES      = STAGE_SCALES;
  window.SPRITE_BODY_HEIGHT_MULTS = STAGE_BODY_HEIGHT_MULTS;
  window.spriteGetPalette         = getPalette;
  window.spriteWeightWidthMult    = weightWidthMultiplier;

}());
