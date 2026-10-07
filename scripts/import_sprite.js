#!/usr/bin/env node
/**
 * import_sprite.js — convert a PNG, JPEG, WebP, or .pixil file into a Codotchi DEFS entry
 *
 * Usage:
 *   node scripts/import_sprite.js <file> <spriteType> <stage> [options]
 *
 * Supported formats:
 *   .png    — decoded natively (pure JS, no dependencies)
 *   .pixil  — Pixilart JSON format, decoded natively
 *   .jpg / .jpeg — transcoded to PNG via PowerShell System.Drawing, ImageMagick, ffmpeg, or Python/Pillow
 *   .webp   — transcoded to PNG via ImageMagick, dwebp, ffmpeg, or Python/Pillow
 *
 *   Format is detected from file content (magic bytes), not just the extension.
 *   A JPEG file named .png is handled correctly; a warning is printed when the
 *   detected format disagrees with the file extension.
 *
 *   JPEG/WebP transcoding requires one of the following to be available:
 *     1. ImageMagick v7+  (magick)           — install from https://imagemagick.org
 *     2. PowerShell System.Drawing            — built into Windows, no install needed
 *     3. ImageMagick legacy (convert)         — only used when not C:\Windows\System32\convert.exe
 *     3b. dwebp (Google libwebp)             — WebP only; install from https://developers.google.com/speed/webp/download
 *     4. ffmpeg                               — install from https://ffmpeg.org
 *     5. Python + Pillow                     — pip install Pillow (if Python is already installed)
 *
 * Options:
 *   --frame      <N>      .pixil frame index to use (default: 0)
 *   --leg-row    <N>      Row index where leg zone begins (default: floor(rows * 0.78))
 *   --primary    <hex>    Colour in source image → index 1 (body fill)
 *   --secondary  <hex>    Colour in source image → index 2 (eyes/markings)
 *   --accent     <hex>    Colour in source image → index 3 (stripes/accent)
 *   --threshold  <0-255>  Alpha value below which a pixel is treated as transparent (default: 128)
 *   --transparent <hex>   Source colour to treat as transparent (for JPEG/flat backgrounds)
 *   --transparent-distance <N>  RGB distance tolerance for --transparent (default: 2500)
 *   --crop-transparent    Trim transparent border after applying --transparent
 *   --flip                Mirror the grid horizontally (reverse each row) so the sprite
 *                         faces the opposite direction; use when the source image faces right
 *                         but the sprite should face left in-game
 *   --preview             Print an ASCII art preview of the mapped grid to stdout
 *
 * To add or update a species in the game, use the bulk pipeline instead:
 * put the stage images in sprites/<species>/ and run
 * node scripts/import_sprites_bulk.js (see developer_notes/SPRITE_IMPORT.md).
 * This script only prints a DEFS entry for review; it no longer edits
 * sprites.js (the old --inject option is gone).
 *
 * Resolution:
 *   The output grid is capped at 192×128 for runtime performance.
 *   If the source image is larger than 192×128, it is scaled down to fit using
 *   nearest-neighbour sampling while preserving the aspect ratio.
 *   A warning is printed to stderr when downsampling occurs so the operator
 *   knows the runtime grid differs from the source image resolution.
 *
 * Colour mapping (pixel art mode — 3-4 flat colours):
 *   If --primary / --secondary / --accent are given, each pixel is mapped to the
 *   nearest provided colour by Euclidean RGB distance.
 *   If no palette flags are given, the three most frequent non-transparent colours
 *   are ranked by luminance (brightest → primary, mid → secondary, darkest → accent).
 *
 * Zero npm dependencies — the decoding and quantisation live in scripts/lib/spriteImport.js.
 */

"use strict";

var path = require("path");
var lib  = require("./lib/spriteImport");

// ── CLI argument parsing ──────────────────────────────────────────────────────

var args = process.argv.slice(2);

function getFlag(name, def) {
  var i = args.indexOf(name);
  if (i === -1) { return def; }
  return args[i + 1];
}
function hasFlag(name) { return args.indexOf(name) !== -1; }

var inputFile   = args[0];
var spriteType  = args[1];
var stage       = args[2];

if (hasFlag("--inject")) {
  console.error("--inject has been removed: put the images in sprites/<species>/ and run node scripts/import_sprites_bulk.js");
  process.exit(1);
}

if (!inputFile || !spriteType || !stage) {
  console.error("Usage: node scripts/import_sprite.js <file> <spriteType> <stage> [options]");
  console.error("Supported formats: .png, .jpg/.jpeg, .webp (via external converter), .pixil");
  console.error("Options: --frame N  --leg-row N  --primary #hex  --secondary #hex  --accent #hex  --threshold N  --transparent #hex  --transparent-distance N  --crop-transparent  --flip  --preview");
  process.exit(1);
}

var frameIndex  = parseInt(getFlag("--frame",     "0"), 10);
var legRowArg   = getFlag("--leg-row",   null);
var alphaThresh = parseInt(getFlag("--threshold", "128"), 10);
var transparentHex  = getFlag("--transparent", null);
var transparentDist = parseInt(getFlag("--transparent-distance", "2500"), 10);
var cropTransparent = hasFlag("--crop-transparent");
var doFlip      = hasFlag("--flip");
var doPreview   = hasFlag("--preview");
var palette     = {
  primary:   getFlag("--primary",   null),
  secondary: getFlag("--secondary", null),
  accent:    getFlag("--accent",    null),
};

// ── Main ──────────────────────────────────────────────────────────────────────

(function main() {
  var imgData;
  try {
    console.error("Decoding: " + inputFile);
    imgData = lib.decodeImageFile(inputFile, { frame: frameIndex });
  } catch (e) {
    console.error("Error: " + e.message);
    process.exit(1);
  }
  console.error("Source dimensions: " + imgData.width + " × " + imgData.height);

  // 1. Background removal: automatic for fully-opaque images, or an explicit colour
  if (!transparentHex) {
    imgData = lib.removeAutoBackground(imgData, alphaThresh, transparentDist);
  }
  imgData = lib.applyTransparentColour(imgData, transparentHex, transparentDist);
  if (cropTransparent) {
    imgData = lib.cropTransparentBorder(imgData, alphaThresh);
  }

  // 2. Clamp to max grid size (preserve aspect ratio)
  var scale   = lib.capScale(imgData.width, imgData.height);
  var targetW = Math.round(imgData.width  * scale);
  var targetH = Math.round(imgData.height * scale);
  if (scale < 1) {
    console.error("[import] Source " + imgData.width + "×" + imgData.height +
                  " exceeds runtime cap " + lib.MAX_COLS + "×" + lib.MAX_ROWS +
                  " — downsampling to " + targetW + "×" + targetH +
                  " (aspect-ratio preserved). Runtime grid will differ from source resolution.");
  }
  var resampled = lib.resample(imgData, targetW, targetH);
  var cols = resampled.width;
  var rows = resampled.height;

  // 3. Leg row
  var legRowStart = legRowArg !== null ? parseInt(legRowArg, 10) : Math.floor(rows * 0.78);
  console.error("Grid: " + cols + " cols × " + rows + " rows, legRowStart=" + legRowStart);

  // 4. Quantise, then optionally mirror
  var mapper = lib.buildColourMapper([resampled], alphaThresh, palette);
  var grid   = lib.mapGrid(resampled, mapper);
  if (doFlip) {
    grid = lib.flipGrid(grid);
    console.error("Horizontally flipped grid (" + cols + " cols).");
  }

  if (doPreview) {
    lib.printPreview(grid);
  }

  // 5. Emit the DEFS text and metadata for review
  console.log("// ── Imported: " + path.basename(inputFile) + " → " + spriteType + "/" + stage + " (" + cols + "×" + rows + ") ──");
  console.log(lib.buildDefsEntry(spriteType, stage, grid));
  console.log("");
  console.log("// SPRITE_GRID_META: " + spriteType + ": { cols: " + cols + ", rows: " + rows + ", legRowStart: " + legRowStart + " },");
  console.log("// palette: " + JSON.stringify(mapper.palette));
}());
