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
 *   .jpg / .jpeg — transcoded to PNG via PowerShell System.Drawing or ImageMagick
 *   .webp   — transcoded to PNG via PowerShell System.Drawing or ImageMagick
 *
 *   Format is detected from file content (magic bytes), not just the extension.
 *   A JPEG file named .png is handled correctly; a warning is printed when the
 *   detected format disagrees with the file extension.
 *
 *   JPEG/WebP transcoding requires one of the following to be available:
 *     1. ImageMagick v7+  (magick)           — install from https://imagemagick.org
 *     2. PowerShell System.Drawing            — built into Windows, no install needed
 *     3. ImageMagick legacy (convert)         — only used when not C:\Windows\System32\convert.exe
 *     4. ffmpeg                               — install from https://ffmpeg.org
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
 *   --inject              Splice the DEFS entry and SPRITE_GRID_META registration into
 *                         vscode/media/sprites.js and pycharm/.../sprites.js
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
 * Zero npm dependencies — uses only Node.js built-ins (fs, path, zlib, os, child_process).
 */

"use strict";

var fs             = require("fs");
var path           = require("path");
var zlib           = require("zlib");
var os             = require("os");
var child_process  = require("child_process");

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

if (!inputFile || !spriteType || !stage) {
  console.error("Usage: node scripts/import_sprite.js <file> <spriteType> <stage> [options]");
  console.error("Supported formats: .png, .jpg/.jpeg, .webp (via external converter), .pixil");
  console.error("Options: --frame N  --leg-row N  --primary #hex  --secondary #hex  --accent #hex  --threshold N  --transparent #hex  --transparent-distance N  --crop-transparent  --flip  --preview  --inject");
  process.exit(1);
}

var frameIndex  = parseInt(getFlag("--frame",     "0"), 10);
var legRowArg   = getFlag("--leg-row",   null);
var primaryHex  = getFlag("--primary",   null);
var secondaryHex= getFlag("--secondary", null);
var accentHex   = getFlag("--accent",    null);
var alphaThresh = parseInt(getFlag("--threshold", "128"), 10);
var transparentHex  = getFlag("--transparent", null);
var transparentDist = parseInt(getFlag("--transparent-distance", "2500"), 10);
var cropTransparent = hasFlag("--crop-transparent");
var doFlip      = hasFlag("--flip");
var doPreview   = hasFlag("--preview");
var doInject    = hasFlag("--inject");

var MAX_COLS = 192;
var MAX_ROWS = 128;

// ── Colour utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex) {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) { hex = hex.split("").map(function(c){ return c+c; }).join(""); }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
}

function rgbDist(a, b) {
  var dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return dr*dr + dg*dg + db*db;
}

function luminance(rgb) {
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

function applyTransparentColour(src, transparentHex, transparentDist) {
  if (!transparentHex) { return src; }
  var target = hexToRgb(transparentHex);
  var changed = 0;
  var pixels = [];
  for (var row = 0; row < src.height; row++) {
    var pixelRow = [];
    for (var col = 0; col < src.width; col++) {
      var px = src.pixels[row][col];
      var next = { r: px.r, g: px.g, b: px.b, a: px.a };
      if (rgbDist(px, target) <= transparentDist) {
        next.a = 0;
        changed++;
      }
      pixelRow.push(next);
    }
    pixels.push(pixelRow);
  }
  console.error("Applied transparent colour " + transparentHex + " (distance <= " + transparentDist + "): " + changed + " pixels");
  return { width: src.width, height: src.height, pixels: pixels };
}

function cropTransparentBorder(src, alphaThresh) {
  var minX = src.width, minY = src.height, maxX = -1, maxY = -1;
  for (var row = 0; row < src.height; row++) {
    for (var col = 0; col < src.width; col++) {
      if (src.pixels[row][col].a >= alphaThresh) {
        if (col < minX) { minX = col; }
        if (col > maxX) { maxX = col; }
        if (row < minY) { minY = row; }
        if (row > maxY) { maxY = row; }
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    console.error("Warning: --crop-transparent found no visible pixels; leaving image unchanged");
    return src;
  }

  if (minX === 0 && minY === 0 && maxX === src.width - 1 && maxY === src.height - 1) {
    console.error("--crop-transparent: no transparent border to trim");
    return src;
  }

  var newW = maxX - minX + 1;
  var newH = maxY - minY + 1;
  var pixels = [];
  for (var y = minY; y <= maxY; y++) {
    var pixelRow = [];
    for (var x = minX; x <= maxX; x++) {
      pixelRow.push(src.pixels[y][x]);
    }
    pixels.push(pixelRow);
  }
  console.error("Cropped transparent border: " + src.width + " × " + src.height + " → " + newW + " × " + newH);
  return { width: newW, height: newH, pixels: pixels };
}

// ── Format detection (magic bytes) ───────────────────────────────────────────
// Detects the actual image format from file content, not the file extension.
// Returns "png", "jpeg", "webp", or "pixil".

function detectFormat(buffer, ext) {
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return "png";
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return "jpeg";
  }
  // WebP: RIFF????WEBP  (bytes 0-3 = "RIFF", bytes 8-11 = "WEBP")
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return "webp";
  }
  // .pixil: Pixilart JSON — try JSON parse heuristic or fall back to extension
  if (ext === ".pixil") { return "pixil"; }
  // Last-resort: try to detect JSON (pixil files start with "{")
  if (buffer[0] === 0x7B) { return "pixil"; }
  return null;
}

// ── JPEG/WebP → PNG transcoder ────────────────────────────────────────────────
// Converts a JPEG or WebP file to a temporary PNG using an available external
// tool, then returns the PNG buffer. Tries converters in order: ImageMagick v7+
// (magick), PowerShell System.Drawing, ImageMagick legacy (convert, guarded
// against Windows System32\convert.exe), then ffmpeg. On WebP, PowerShell may
// fail if the Windows WebP codec is not installed — the next converter is tried.

function transcodeToPng(inputFile, format) {
  var tmpFile = path.join(os.tmpdir(), "codotchi_import_" + Date.now() + ".png");
  var absInput = path.resolve(inputFile);
  var lastError = null;

  // Helper: attempt a single converter command, return true on success
  function tryCmd(label, cmd) {
    try {
      child_process.execSync(cmd, { stdio: "pipe", timeout: 30000 });
      if (fs.existsSync(tmpFile) && fs.statSync(tmpFile).size > 0) {
        console.error("Transcoding " + format.toUpperCase() + " → PNG via " + label + ": " + inputFile);
        return true;
      }
    } catch (e) {
      lastError = e.message || String(e);
    }
    return false;
  }

  // Helper: safe where.exe lookup
  function which(cmd) {
    try {
      var r = child_process.execSync("where.exe " + cmd + " 2>NUL", { encoding: "utf8" }).trim();
      return r.split(/\r?\n/)[0] || null;
    } catch (e) { return null; }
  }

  var success = false;

  // 1. ImageMagick v7+ (magick) — supports PNG, JPEG, WebP natively
  var magick = which("magick");
  if (!success && magick) {
    success = tryCmd("ImageMagick (magick)", '"' + magick + '" "' + absInput + '" "' + tmpFile + '"');
  }

  // 2. PowerShell System.Drawing — supports JPEG/BMP/GIF/TIFF on Windows;
  //    WebP requires the optional Windows WebP codec (may not be installed)
  if (!success) {
    var psCmd = [
      "Add-Type -AssemblyName System.Drawing;",
      "$b = [System.Drawing.Bitmap]::new('" + absInput.replace(/\\/g, "\\\\").replace(/'/g, "''") + "');",
      "$b.Save('" + tmpFile.replace(/\\/g, "\\\\").replace(/'/g, "''") + "', [System.Drawing.Imaging.ImageFormat]::Png);",
      "$b.Dispose()"
    ].join(" ");
    success = tryCmd("PowerShell System.Drawing", 'powershell -NoProfile -Command "' + psCmd + '"');
  }

  // 3. ImageMagick legacy (convert) — guard against Windows System32\convert.exe
  if (!success) {
    var convert = which("convert");
    if (convert && !/System32[\\\/]convert\.exe$/i.test(convert)) {
      success = tryCmd("ImageMagick (convert)", '"' + convert + '" "' + absInput + '" "' + tmpFile + '"');
    }
  }

  // 4. ffmpeg
  if (!success) {
    var ffmpeg = which("ffmpeg");
    if (ffmpeg) {
      success = tryCmd("ffmpeg", '"' + ffmpeg + '" -y -i "' + absInput + '" "' + tmpFile + '"');
    }
  }

  if (!success) {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* best-effort */ }
    console.error("Error: could not transcode " + format.toUpperCase() + " to PNG. No working converter found.");
    if (lastError) { console.error("Last error: " + lastError); }
    console.error("Install one of the following, then retry:");
    console.error("  - ImageMagick v7+  https://imagemagick.org  (recommended, supports all formats)");
    console.error("  - ffmpeg           https://ffmpeg.org");
    if (format === "webp") {
      console.error("  - Or install the Windows WebP codec to enable PowerShell System.Drawing support.");
    }
    console.error("  Or pre-convert the file to PNG before importing.");
    process.exit(1);
  }

  try {
    var pngBuffer = fs.readFileSync(tmpFile);
    return pngBuffer;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* best-effort cleanup */ }
  }
}

// ── PNG decoder (pure Node — no dependencies) ─────────────────────────────────
// Supports 8-bit RGBA, RGB, greyscale, and paletted (indexed) PNG files.

function decodePng(buffer) {
  // Verify PNG signature
  var sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (var i = 0; i < 8; i++) {
    if (buffer[i] !== sig[i]) { throw new Error("Not a valid PNG file"); }
  }

  var offset = 8;
  var width, height, bitDepth, colorType, palette;
  var idatChunks = [];

  function readUint32(buf, off) {
    return ((buf[off] << 24) | (buf[off+1] << 16) | (buf[off+2] << 8) | buf[off+3]) >>> 0;
  }
  function readStr(buf, off, len) {
    return buf.slice(off, off + len).toString("ascii");
  }

  while (offset < buffer.length) {
    var chunkLen  = readUint32(buffer, offset);     offset += 4;
    var chunkType = readStr(buffer, offset, 4);      offset += 4;
    var chunkData = buffer.slice(offset, offset + chunkLen);  offset += chunkLen;
    offset += 4; // skip CRC

    if (chunkType === "IHDR") {
      width     = readUint32(chunkData, 0);
      height    = readUint32(chunkData, 4);
      bitDepth  = chunkData[8];
      colorType = chunkData[9];
      // interlace = chunkData[12]  (we don't support interlaced PNGs)
      if (chunkData[12] !== 0) { throw new Error("Interlaced PNGs are not supported"); }
    } else if (chunkType === "PLTE") {
      palette = [];
      for (var pi = 0; pi < chunkLen; pi += 3) {
        palette.push({ r: chunkData[pi], g: chunkData[pi+1], b: chunkData[pi+2], a: 255 });
      }
    } else if (chunkType === "tRNS") {
      // Transparency chunk — add alpha to palette entries
      if (colorType === 3 && palette) {
        for (var ti = 0; ti < chunkData.length; ti++) {
          if (palette[ti]) { palette[ti].a = chunkData[ti]; }
        }
      }
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (!width || !height) { throw new Error("PNG missing IHDR chunk"); }

  // Inflate all IDAT chunks together
  var compressed = Buffer.concat(idatChunks);
  var raw = zlib.inflateSync(compressed);

  // Determine bytes per sample and channels
  var channels;
  if      (colorType === 0) { channels = 1; }  // greyscale
  else if (colorType === 2) { channels = 3; }  // RGB
  else if (colorType === 3) { channels = 1; }  // indexed (palette)
  else if (colorType === 4) { channels = 2; }  // greyscale + alpha
  else if (colorType === 6) { channels = 4; }  // RGBA
  else { throw new Error("Unsupported PNG color type: " + colorType); }

  var bytesPerSample = bitDepth / 8;
  if (bytesPerSample < 1) { bytesPerSample = 1; } // sub-byte depth — we'll handle below
  var stride = Math.ceil(width * channels * bitDepth / 8) + 1; // +1 for filter byte

  // Reconstruct pixel rows from filter types
  var pixels = []; // array of rows, each row is array of {r,g,b,a}
  var prevRow = new Uint8Array(stride - 1);

  for (var row = 0; row < height; row++) {
    var filterType = raw[row * stride];
    var rowData    = new Uint8Array(stride - 1);

    for (var bi = 0; bi < stride - 1; bi++) {
      var x    = raw[row * stride + 1 + bi];
      var a    = rowData[bi - channels * bytesPerSample] || 0;  // left pixel same channel
      var b2   = prevRow[bi];                                    // pixel above
      var c2   = (bi >= channels * bytesPerSample) ? prevRow[bi - channels * bytesPerSample] : 0;
      switch (filterType) {
        case 0: rowData[bi] = x; break;
        case 1: rowData[bi] = (x + a) & 0xFF; break;
        case 2: rowData[bi] = (x + b2) & 0xFF; break;
        case 3: rowData[bi] = (x + Math.floor((a + b2) / 2)) & 0xFF; break;
        case 4: // Paeth
          var pa = Math.abs(b2 - c2);
          var pb2= Math.abs(a  - c2);
          var pc2= Math.abs(a + b2 - 2*c2);
          var pr = (pa <= pb2 && pa <= pc2) ? a : (pb2 <= pc2) ? b2 : c2;
          rowData[bi] = (x + pr) & 0xFF;
          break;
        default: throw new Error("Unknown PNG filter type: " + filterType);
      }
    }
    prevRow = rowData;

    // Extract RGBA pixels from rowData
    var pixelRow = [];
    for (var col = 0; col < width; col++) {
      var r2, g2, b3, a2;
      if (bitDepth === 1 || bitDepth === 2 || bitDepth === 4) {
        // Sub-byte depth — extract pixel index
        var samplesPerByte = 8 / bitDepth;
        var byteIndex = Math.floor(col / samplesPerByte);
        var shift = bitDepth * (samplesPerByte - 1 - (col % samplesPerByte));
        var mask  = (1 << bitDepth) - 1;
        var idx   = (rowData[byteIndex] >> shift) & mask;
        if (colorType === 3 && palette) {
          var pe = palette[idx] || { r: 0, g: 0, b: 0, a: 0 };
          pixelRow.push({ r: pe.r, g: pe.g, b: pe.b, a: pe.a });
        } else {
          var v = Math.round(idx * 255 / mask);
          pixelRow.push({ r: v, g: v, b: v, a: 255 });
        }
        continue;
      }
      var base = col * channels * bytesPerSample;
      if (colorType === 0) { // greyscale
        r2 = g2 = b3 = rowData[base]; a2 = 255;
      } else if (colorType === 2) { // RGB
        r2 = rowData[base]; g2 = rowData[base+1]; b3 = rowData[base+2]; a2 = 255;
      } else if (colorType === 3) { // indexed
        var pe2 = palette[rowData[base]] || { r: 0, g: 0, b: 0, a: 0 };
        r2 = pe2.r; g2 = pe2.g; b3 = pe2.b; a2 = pe2.a;
      } else if (colorType === 4) { // greyscale + alpha
        r2 = g2 = b3 = rowData[base]; a2 = rowData[base+1];
      } else { // RGBA
        r2 = rowData[base]; g2 = rowData[base+1]; b3 = rowData[base+2]; a2 = rowData[base+3];
      }
      pixelRow.push({ r: r2, g: g2, b: b3, a: a2 });
    }
    pixels.push(pixelRow);
  }

  return { width: width, height: height, pixels: pixels };
}

// ── .pixil decoder ────────────────────────────────────────────────────────────
// Pixilart .pixil files are plain JSON.  Structure:
//   { frames: [ { layers: [ { data: { "<x>,<y>": "#rrggbb" }, ... } ] }, ... ] }
// Alpha is always 255 (Pixilart doesn't support per-pixel alpha in this format).
// Empty pixel entries or missing keys = transparent.

function decodePixil(buffer, frameIdx) {
  var json;
  try {
    json = JSON.parse(buffer.toString("utf8"));
  } catch (e) {
    throw new Error("Failed to parse .pixil file as JSON: " + e.message);
  }

  var frames = json.frames || json.art || [];
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error(".pixil file contains no frames");
  }
  if (frameIdx >= frames.length) {
    throw new Error(".pixil frame " + frameIdx + " does not exist (file has " + frames.length + " frame(s))");
  }

  var frame = frames[frameIdx];

  // Determine canvas dimensions
  var canvasW = json.width  || (frame && frame.width)  || 0;
  var canvasH = json.height || (frame && frame.height) || 0;

  // Flatten all layers (bottom to top — later layers overwrite earlier ones)
  var flatPixels = {};  // key = "col,row", value = {r,g,b,a}

  var layers = frame.layers || [];
  for (var li = 0; li < layers.length; li++) {
    var layer = layers[li];
    if (!layer || !layer.data) { continue; }
    var data = layer.data;
    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) { continue; }
      var hex = data[key];
      if (!hex || hex === "" || hex === "null") { continue; }
      var rgb = hexToRgb(hex);
      flatPixels[key] = { r: rgb.r, g: rgb.g, b: rgb.b, a: 255 };

      // Infer canvas dimensions from the pixel coordinates if not declared
      var parts = key.split(",");
      var px = parseInt(parts[0], 10) + 1;
      var py = parseInt(parts[1], 10) + 1;
      if (px > canvasW) { canvasW = px; }
      if (py > canvasH) { canvasH = py; }
    }
  }

  if (canvasW === 0 || canvasH === 0) {
    throw new Error(".pixil file has no pixel data and no canvas dimensions");
  }

  // Build pixel grid
  var pixels = [];
  for (var row = 0; row < canvasH; row++) {
    var pixelRow = [];
    for (var col = 0; col < canvasW; col++) {
      var p = flatPixels[col + "," + row];
      pixelRow.push(p || { r: 0, g: 0, b: 0, a: 0 });
    }
    pixels.push(pixelRow);
  }

  return { width: canvasW, height: canvasH, pixels: pixels };
}

// ── Nearest-neighbour resampling ──────────────────────────────────────────────

function resample(src, targetW, targetH) {
  if (src.width === targetW && src.height === targetH) { return src; }
  var pixels = [];
  for (var row = 0; row < targetH; row++) {
    var srcRow = Math.min(Math.floor(row * src.height / targetH), src.height - 1);
    var pixelRow = [];
    for (var col = 0; col < targetW; col++) {
      var srcCol = Math.min(Math.floor(col * src.width / targetW), src.width - 1);
      pixelRow.push(src.pixels[srcRow][srcCol]);
    }
    pixels.push(pixelRow);
  }
  return { width: targetW, height: targetH, pixels: pixels };
}

// ── Colour quantisation ───────────────────────────────────────────────────────
// Map each pixel to 0 (transparent), 1, 2, or 3.
// If palette colours are provided, use RGB distance.
// Otherwise auto-detect the 3 most frequent colours and rank by luminance.

function buildColourMapper(pixels, width, height, alphaThresh, priHex, secHex, accHex) {
  if (priHex || secHex || accHex) {
    // Explicit palette mapping
    var targets = [];
    if (priHex) { targets.push({ idx: 1, rgb: hexToRgb(priHex) }); }
    if (secHex) { targets.push({ idx: 2, rgb: hexToRgb(secHex) }); }
    if (accHex) { targets.push({ idx: 3, rgb: hexToRgb(accHex) }); }

    return function(px) {
      if (px.a < alphaThresh) { return 0; }
      var best = 0, bestDist = Infinity;
      for (var ti = 0; ti < targets.length; ti++) {
        var d = rgbDist({ r: px.r, g: px.g, b: px.b }, targets[ti].rgb);
        if (d < bestDist) { bestDist = d; best = targets[ti].idx; }
      }
      return best || 1;
    };
  }

  // Auto-detect: count colour frequencies
  var freq = {};
  for (var row = 0; row < height; row++) {
    for (var col = 0; col < width; col++) {
      var px = pixels[row][col];
      if (px.a < alphaThresh) { continue; }
      var key = px.r + "," + px.g + "," + px.b;
      freq[key] = (freq[key] || 0) + 1;
    }
  }

  // Sort by frequency descending, take top 3
  var sorted = Object.keys(freq).sort(function(a, b) { return freq[b] - freq[a]; });
  var top3 = sorted.slice(0, 3).map(function(k) {
    var parts = k.split(",");
    return { r: parseInt(parts[0]), g: parseInt(parts[1]), b: parseInt(parts[2]) };
  });

  if (top3.length === 0) {
    console.error("Warning: no non-transparent pixels found in source image");
    return function() { return 0; };
  }

  // Rank top 3 by luminance: highest luminance = primary (1), mid = secondary (2), lowest = accent (3)
  var ranked = top3.slice().sort(function(a, b) { return luminance(b) - luminance(a); });

  console.error("Auto-detected palette:");
  ranked.forEach(function(c, i) {
    console.error("  index " + (i + 1) + ": rgb(" + c.r + "," + c.g + "," + c.b + ")  lum=" + luminance(c).toFixed(1));
  });

  return function(px) {
    if (px.a < alphaThresh) { return 0; }
    var best = 0, bestDist = Infinity;
    for (var ri = 0; ri < ranked.length; ri++) {
      var d = rgbDist({ r: px.r, g: px.g, b: px.b }, ranked[ri]);
      if (d < bestDist) { bestDist = d; best = ri + 1; }
    }
    return best;
  };
}

// ── ASCII preview ─────────────────────────────────────────────────────────────

var PREVIEW_CHARS = { 0: " ", 1: "█", 2: "▓", 3: "░" };

function printPreview(grid, cols, rows) {
  var border = "+" + "-".repeat(cols) + "+";
  console.log(border);
  for (var row = 0; row < rows; row++) {
    var line = "|";
    for (var col = 0; col < cols; col++) {
      line += PREVIEW_CHARS[grid[row][col]] || "?";
    }
    line += "|";
    console.log(line);
  }
  console.log(border);
}

// ── DEFS string generation ────────────────────────────────────────────────────

function buildDefsEntry(spriteType, stage, grid, cols, rows) {
  var lines = [];
  lines.push('  DEFS["' + spriteType + '"] = DEFS["' + spriteType + '"] || {};');
  lines.push('  DEFS["' + spriteType + '"]["' + stage + '"] = [');
  for (var row = 0; row < rows; row++) {
    var rowStr = grid[row].join("");
    var comma  = (row < rows - 1) ? "," : "";
    lines.push('    "' + rowStr + '"' + comma + ' //' + row);
  }
  lines.push("  ];");
  return lines.join("\n");
}

// ── Injection into sprites.js ─────────────────────────────────────────────────

function injectIntoSpritesJs(filePath, spriteType, stage, grid, cols, rows, legRowStart) {
  var content = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");

  // 1. Insert or update the DEFS entry
  //    We look for an existing DEFS["spriteType"]["stage"] block and replace it,
  //    or append a new one before SPRITES is built from Object.keys(DEFS).
  var defsBlock = buildDefsEntry(spriteType, stage, grid, cols, rows);

  var existingPattern = new RegExp(
    '  DEFS\\["' + spriteType + '"\\] = DEFS\\["' + spriteType + '"\\] \\|\\| \\{\\};\\s*' +
    '  DEFS\\["' + spriteType + '"\\]\\["' + stage + '"\\] = \\[[\\s\\S]*?\\];',
    "m"
  );

  if (existingPattern.test(content)) {
    content = content.replace(existingPattern, defsBlock);
    console.error("Updated existing DEFS[\"" + spriteType + '"]["' + stage + '"] in ' + filePath);
  } else {
    // Append before SPRITES is parsed/exported.  Inserting after this leaves
    // DEFS text in the file but never exposes it via window.SPRITES.
    var parseMarker = "  var SPRITES = {};";
    var parseIdx = content.indexOf(parseMarker);
    if (parseIdx !== -1) {
      content = content.slice(0, parseIdx) + defsBlock + "\n\n" + content.slice(parseIdx);
    } else {
      throw new Error("Cannot find SPRITES parse insertion point in " + filePath);
    }
    console.error('Inserted new DEFS["' + spriteType + '"]["' + stage + '"] in ' + filePath);
  }

  // 2. Register SPRITE_GRID_META entry (append after existing SPRITE_GRID_META block if needed)
  //    Only add if the spriteType isn't already in the meta block.
  var metaEntry = '    ' + spriteType.padEnd(10) + ': { cols: ' + cols + ', rows: ' + rows + ', legRowStart: ' + legRowStart + ' },';
  var metaPattern = new RegExp('    ' + spriteType + '\\s*:');
  if (!metaPattern.test(content)) {
    // Append before the closing }; of SPRITE_GRID_META
    var metaClose = "  };\n\n  /**\n   * Return the height/width ratio";
    if (content.indexOf(metaClose) !== -1) {
      content = content.replace(metaClose, "  " + metaEntry + "\n" + metaClose);
      console.error("Added SPRITE_GRID_META entry for " + spriteType + " in " + filePath);
    }
  } else {
    // Update existing entry
    content = content.replace(
      new RegExp('    ' + spriteType + '\\s*:.*\\n'),
      "  " + metaEntry + "\n"
    );
    console.error("Updated SPRITE_GRID_META entry for " + spriteType + " in " + filePath);
  }

  fs.writeFileSync(filePath, content, "utf8");
}

// ── Main ──────────────────────────────────────────────────────────────────────

(function main() {
  var repoRoot = path.resolve(__dirname, "..");
  var ext      = path.extname(inputFile).toLowerCase();
  var buffer   = fs.readFileSync(inputFile);
  var imgData;

  // 1. Detect actual format from magic bytes (not just extension)
  var detectedFormat = detectFormat(buffer, ext);

  if (!detectedFormat) {
    console.error("Unsupported file type: " + ext + " (supported: .png, .jpg, .jpeg, .webp, .pixil)");
    process.exit(1);
  }

  // Warn if extension disagrees with detected content
  var extFormats = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp", ".pixil": "pixil" };
  var expectedByExt = extFormats[ext] || null;
  if (expectedByExt && expectedByExt !== detectedFormat) {
    console.error("Warning: file extension is '" + ext + "' but content is detected as " + detectedFormat.toUpperCase() + " — treating as " + detectedFormat.toUpperCase() + ".");
  }

  // 2. Decode
  if (detectedFormat === "png") {
    console.error("Decoding PNG: " + inputFile);
    imgData = decodePng(buffer);
  } else if (detectedFormat === "pixil") {
    console.error("Decoding .pixil (frame " + frameIndex + "): " + inputFile);
    imgData = decodePixil(buffer, frameIndex);
  } else if (detectedFormat === "jpeg" || detectedFormat === "webp") {
    var pngBuffer = transcodeToPng(inputFile, detectedFormat);
    console.error("Decoding transcoded PNG from " + detectedFormat.toUpperCase() + ": " + inputFile);
    imgData = decodePng(pngBuffer);
  }

  console.error("Source dimensions: " + imgData.width + " × " + imgData.height);

  // Auto-detect and remove solid background for fully-opaque images (e.g. RGB PNG, JPEG/WebP).
  // When every pixel has alpha >= alphaThresh and all four corners share the same colour
  // (within transparentDist), that corner colour is almost certainly the background.
  // Skip this when the caller already supplied --transparent.
  if (!transparentHex) {
    var opaqueOnly = true;
    outerCheck: for (var _r = 0; _r < imgData.height; _r++) {
      for (var _c = 0; _c < imgData.width; _c++) {
        if (imgData.pixels[_r][_c].a < alphaThresh) { opaqueOnly = false; break outerCheck; }
      }
    }
    if (opaqueOnly) {
      var corners = [
        imgData.pixels[0][0],
        imgData.pixels[0][imgData.width - 1],
        imgData.pixels[imgData.height - 1][0],
        imgData.pixels[imgData.height - 1][imgData.width - 1]
      ];
      var bg = corners[0];
      var uniformCorners = corners.every(function(p) { return rgbDist(p, bg) <= transparentDist; });
      if (uniformCorners) {
        var autoBgHex = "#" + [bg.r, bg.g, bg.b].map(function(v) {
          return ("0" + v.toString(16)).slice(-2);
        }).join("");
        console.error("Auto-background: image is fully opaque with uniform corners (" + autoBgHex + ") — removing as background and cropping. Use --transparent to override.");
        imgData = applyTransparentColour(imgData, autoBgHex, transparentDist);
        imgData = cropTransparentBorder(imgData, alphaThresh);
      }
    }
  }

  // 2. Optional background transparency and crop (useful for JPEGs with a flat backdrop)
  imgData = applyTransparentColour(imgData, transparentHex, transparentDist);
  if (cropTransparent) {
    imgData = cropTransparentBorder(imgData, alphaThresh);
  }

  // 3. Clamp to max grid size (preserve aspect ratio)
  var targetW = imgData.width;
  var targetH = imgData.height;
  if (targetW > MAX_COLS || targetH > MAX_ROWS) {
    var scaleW = MAX_COLS / targetW;
    var scaleH = MAX_ROWS / targetH;
    var scale  = Math.min(scaleW, scaleH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
    console.error("[import] Source " + imgData.width + "×" + imgData.height +
                  " exceeds runtime cap " + MAX_COLS + "×" + MAX_ROWS +
                  " — downsampling to " + targetW + "×" + targetH +
                  " (aspect-ratio preserved). Runtime grid will differ from source resolution.");
  }

  // 4. Resample if needed
  var resampled = resample(imgData, targetW, targetH);
  var cols = resampled.width;
  var rows = resampled.height;

  // 5. Determine leg row
  var legRowStart = legRowArg !== null ? parseInt(legRowArg, 10) : Math.floor(rows * 0.78);
  console.error("Grid: " + cols + " cols × " + rows + " rows, legRowStart=" + legRowStart);

  // 6. Build colour mapper
  var mapColour = buildColourMapper(
    resampled.pixels, cols, rows, alphaThresh,
    primaryHex, secondaryHex, accentHex
  );

  // 7. Build grid (array of arrays of colour indices)
  var grid = [];
  for (var row = 0; row < rows; row++) {
    var gridRow = [];
    for (var col = 0; col < cols; col++) {
      gridRow.push(mapColour(resampled.pixels[row][col]));
    }
    grid.push(gridRow);
  }

  // 7b. Horizontal flip (reverses each row so the sprite faces the opposite direction)
  if (doFlip) {
    for (var fi = 0; fi < grid.length; fi++) {
      grid[fi] = grid[fi].slice().reverse();
    }
    console.error("Horizontally flipped grid (" + cols + " cols).");
  }

  // 8. Preview
  if (doPreview) {
    printPreview(grid, cols, rows);
  }

  // 9. Emit DEFS text to stdout (always — useful for piping / review)
  var defsText = buildDefsEntry(spriteType, stage, grid, cols, rows);
  console.log("// ── Imported: " + path.basename(inputFile) + " → " + spriteType + "/" + stage + " (" + cols + "×" + rows + ") ──");
  console.log(defsText);
  console.log("");
  console.log("// SPRITE_GRID_META entry to add to spriteConstants.js:");
  console.log("//   " + spriteType + ": { cols: " + cols + ", rows: " + rows + ", legRowStart: " + legRowStart + " },");

  // 10. Inject into both sprites.js files
  if (doInject) {
    var vscodeSprites  = path.join(repoRoot, "vscode",   "media",                               "sprites.js");
    var pycharmSprites = path.join(repoRoot, "pycharm",  "src", "main", "resources", "webview", "sprites.js");
    var vscodeConst    = path.join(repoRoot, "vscode",   "media",                               "spriteConstants.js");
    var pycharmConst   = path.join(repoRoot, "pycharm",  "src", "main", "resources", "webview", "spriteConstants.js");

    injectIntoSpritesJs(vscodeSprites,  spriteType, stage, grid, cols, rows, legRowStart);
    injectIntoSpritesJs(pycharmSprites, spriteType, stage, grid, cols, rows, legRowStart);

    // Also register/update the SPRITE_GRID_META entry in both spriteConstants.js files
    [vscodeConst, pycharmConst].forEach(function(constFile) {
      var constContent = fs.readFileSync(constFile, "utf8").replace(/\r\n/g, "\n");
      var metaLine = '    ' + spriteType.padEnd(10) + ': { cols: ' + cols + ', rows: ' + rows + ', legRowStart: ' + legRowStart + ' },';
      var metaExistsPattern = new RegExp('^\\s*' + spriteType + '\\s*:\\s*\\{\\s*cols\\s*:', "m");
      if (!metaExistsPattern.test(constContent)) {
        // Append before the closing }; of SPRITE_GRID_META
        var insertBefore = "  };\n\n  /**\n   * Return the height/width ratio";
        if (constContent.indexOf(insertBefore) !== -1) {
          constContent = constContent.replace(insertBefore, "  " + metaLine + "\n" + insertBefore);
          fs.writeFileSync(constFile, constContent, "utf8");
          console.error("Added SPRITE_GRID_META entry for " + spriteType + " in " + constFile);
        }
      } else {
        constContent = constContent.replace(
          new RegExp('^\\s*' + spriteType + '\\s*:\\s*\\{\\s*cols\\s*:.*$', "m"),
          metaLine
        );
        fs.writeFileSync(constFile, constContent, "utf8");
        console.error("Updated SPRITE_GRID_META entry for " + spriteType + " in " + constFile);
      }
    });

    // Also register in ANIMAL_PALETTES if missing (with a default neutral palette)
    [vscodeConst, pycharmConst].forEach(function(constFile) {
      var constContent = fs.readFileSync(constFile, "utf8").replace(/\r\n/g, "\n");
      var paletteExistsPattern = new RegExp('^\\s*' + spriteType + '\\s*:\\s*\\{\\s*primary\\s*:', "m");
      var quotedPaletteExists = constContent.indexOf('"' + spriteType + '"') !== -1 ||
                                constContent.indexOf("'" + spriteType + "'") !== -1;
      if (!paletteExistsPattern.test(constContent) && !quotedPaletteExists) {
        var paletteLine = '    ' + spriteType.padEnd(10) + ': { primary: "#888888", secondary: "#444444", accent: "#222222", background: "#1a1a1a" },';
        var insertAfter = "var ANIMAL_PALETTES = {";
        constContent = constContent.replace(insertAfter, insertAfter + "\n  " + paletteLine);
        fs.writeFileSync(constFile, constContent, "utf8");
        console.error("Added default ANIMAL_PALETTES entry for " + spriteType + " in " + constFile + " (update colours manually)");
      }
    });

    console.error("\nInjection complete. Run node scripts/validate_sprites.js to verify row lengths.");
  }
}());
