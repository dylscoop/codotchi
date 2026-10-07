/**
 * spriteImport.js — shared image → sprite-grid helpers
 *
 * Used by scripts/import_sprite.js (one image, prints a DEFS entry) and
 * scripts/import_sprites_bulk.js (every sprites/<species>/ folder →
 * vscode/media/sprites.generated.js).
 *
 * Decoding:
 *   .png    — decoded natively (pure JS, no dependencies; no interlaced PNGs)
 *   .pixil  — Pixilart JSON format, decoded natively
 *   .jpg / .jpeg / .webp — transcoded to PNG via an external tool
 *     (ImageMagick, PowerShell System.Drawing, dwebp, ffmpeg or Python/Pillow)
 *   Format is detected from file content (magic bytes), not the extension.
 *
 * Zero npm dependencies — uses only Node.js built-ins (fs, path, zlib, os, child_process).
 */

"use strict";

var fs             = require("fs");
var path           = require("path");
var zlib           = require("zlib");
var os             = require("os");
var child_process  = require("child_process");

/** Runtime grid cap (cols × rows) — larger sources are scaled down to fit. */
var MAX_COLS = 192;
var MAX_ROWS = 128;

// ── Logging ───────────────────────────────────────────────────────────────────
// Progress goes to stderr so stdout stays clean for piping; tests silence it.

var log = function (msg) { console.error(msg); };
function setLogger(fn) { log = fn || function () {}; }

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

function rgbToHex(rgb) {
  function h(n) { return ("0" + Math.max(0, Math.min(255, n)).toString(16)).slice(-2); }
  return "#" + h(rgb.r) + h(rgb.g) + h(rgb.b);
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
  log("Applied transparent colour " + transparentHex + " (distance <= " + transparentDist + "): " + changed + " pixels");
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
    log("Warning: --crop-transparent found no visible pixels; leaving image unchanged");
    return src;
  }

  if (minX === 0 && minY === 0 && maxX === src.width - 1 && maxY === src.height - 1) {
    log("--crop-transparent: no transparent border to trim");
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
  log("Cropped transparent border: " + src.width + " × " + src.height + " → " + newW + " × " + newH);
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
        log("Transcoding " + format.toUpperCase() + " → PNG via " + label + ": " + inputFile);
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

  // 3b. dwebp (Google libwebp) — WebP only
  if (!success && format === "webp") {
    var dwebp = which("dwebp");
    if (dwebp) {
      success = tryCmd("dwebp", '"' + dwebp + '" "' + absInput + '" -o "' + tmpFile + '"');
    }
  }

  // 4. ffmpeg
  if (!success) {
    var ffmpeg = which("ffmpeg");
    if (ffmpeg) {
      success = tryCmd("ffmpeg", '"' + ffmpeg + '" -y -i "' + absInput + '" "' + tmpFile + '"');
    }
  }

  // 5. Python + Pillow — try 'py' (Windows Launcher) then 'python'
  if (!success) {
    var pyScript = "from PIL import Image; Image.open('" +
      absInput.replace(/\\/g, "/").replace(/'/g, "\\'") +
      "').convert('RGBA').save('" +
      tmpFile.replace(/\\/g, "/").replace(/'/g, "\\'") +
      "')";
    var pyLaunchers = ["py", "python"];
    for (var pi = 0; !success && pi < pyLaunchers.length; pi++) {
      var pyLauncher = which(pyLaunchers[pi]);
      if (pyLauncher) {
        success = tryCmd("Python (Pillow)", '"' + pyLauncher + '" -c "' + pyScript + '"');
      }
    }
  }

  if (!success) {
    try { fs.unlinkSync(tmpFile); } catch (e) { /* best-effort */ }
    log("Error: could not transcode " + format.toUpperCase() + " to PNG. No working converter found.");
    if (lastError) { log("Last error: " + lastError); }
    log("Install one of the following, then retry:");
    log("  - ImageMagick v7+  https://imagemagick.org  (recommended, supports all formats)");
    if (format === "webp") {
      log("  - dwebp (Google libwebp)  https://developers.google.com/speed/webp/download  (WebP only, tiny tool)");
    }
    log("  - ffmpeg           https://ffmpeg.org");
    log("  - Python + Pillow  pip install Pillow  (if Python is already installed)");
    if (format === "webp") {
      log("  - Or install the Windows WebP codec to enable PowerShell System.Drawing support.");
    }
    log("  Or pre-convert the file to PNG before importing.");
    throw new Error("Could not transcode " + format.toUpperCase() + " to PNG: no working converter found");
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

// ── File loading ──────────────────────────────────────────────────────────────

var EXT_FORMATS = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".webp": "webp", ".pixil": "pixil" };

/**
 * Decode an image file of any supported format.
 * @param {string} file
 * @param {{ frame?: number }} [opts]  frame — .pixil frame index (default 0)
 * @returns {{ width: number, height: number, pixels: {r,g,b,a}[][] }}
 */
function decodeImageFile(file, opts) {
  var frameIndex = (opts && opts.frame) || 0;
  var ext    = path.extname(file).toLowerCase();
  var buffer = fs.readFileSync(file);
  var format = detectFormat(buffer, ext);
  if (!format) {
    throw new Error("Unsupported file type: " + file + " (supported: .png, .jpg, .jpeg, .webp, .pixil)");
  }
  if (EXT_FORMATS[ext] && EXT_FORMATS[ext] !== format) {
    log("Warning: file extension is '" + ext + "' but content is detected as " + format.toUpperCase() + " — treating as " + format.toUpperCase() + ".");
  }
  if (format === "png")   { return decodePng(buffer); }
  if (format === "pixil") { return decodePixil(buffer, frameIndex); }
  return decodePng(transcodeToPng(file, format));
}

/**
 * Remove a solid background from a fully-opaque image (e.g. RGB PNG, JPEG):
 * when every pixel is opaque and all four corners share one colour, that
 * colour is made transparent and the border cropped.
 */
function removeAutoBackground(img, alphaThresh, transparentDist) {
  for (var r = 0; r < img.height; r++) {
    for (var c = 0; c < img.width; c++) {
      if (img.pixels[r][c].a < alphaThresh) { return img; }
    }
  }
  var corners = [
    img.pixels[0][0],
    img.pixels[0][img.width - 1],
    img.pixels[img.height - 1][0],
    img.pixels[img.height - 1][img.width - 1]
  ];
  var bg = corners[0];
  if (!corners.every(function (p) { return rgbDist(p, bg) <= transparentDist; })) { return img; }
  var bgHex = rgbToHex(bg);
  log("Auto-background: image is fully opaque with uniform corners (" + bgHex + ") — removing as background and cropping. Use --transparent to override.");
  return cropTransparentBorder(applyTransparentColour(img, bgHex, transparentDist), alphaThresh);
}

/**
 * Scale factor that fits w × h inside the runtime cap (1 when it already fits).
 */
function capScale(w, h, maxCols, maxRows) {
  maxCols = maxCols || MAX_COLS;
  maxRows = maxRows || MAX_ROWS;
  if (w <= maxCols && h <= maxRows) { return 1; }
  return Math.min(maxCols / w, maxRows / h);
}

// ── Colour quantisation ───────────────────────────────────────────────────────
// Map each pixel to 0 (transparent), 1, 2, or 3.
// With an explicit palette, each pixel maps to the nearest given colour.
// Otherwise the 3 most frequent colours across ALL the given images are
// ranked by luminance (brightest → 1 primary, mid → 2 secondary, darkest → 3
// accent), so every stage of a species shares one palette.

function normaliseHex(hex) { return rgbToHex(hexToRgb(hex)); }

/**
 * @param {{width,height,pixels}[]} images
 * @param {number} alphaThresh
 * @param {{primary?: string, secondary?: string, accent?: string}} [explicit]
 * @returns {{ fn: function({r,g,b,a}): number, palette: {primary, secondary, accent} }}
 */
function buildColourMapper(images, alphaThresh, explicit) {
  explicit = explicit || {};
  if (explicit.primary || explicit.secondary || explicit.accent) {
    var targets = [];
    if (explicit.primary)   { targets.push({ idx: 1, rgb: hexToRgb(explicit.primary) }); }
    if (explicit.secondary) { targets.push({ idx: 2, rgb: hexToRgb(explicit.secondary) }); }
    if (explicit.accent)    { targets.push({ idx: 3, rgb: hexToRgb(explicit.accent) }); }
    return {
      fn: function (px) {
        if (px.a < alphaThresh) { return 0; }
        var best = 0, bestDist = Infinity;
        for (var ti = 0; ti < targets.length; ti++) {
          var d = rgbDist(px, targets[ti].rgb);
          if (d < bestDist) { bestDist = d; best = targets[ti].idx; }
        }
        return best || 1;
      },
      palette: {
        primary:   explicit.primary   ? normaliseHex(explicit.primary)   : "#888888",
        secondary: explicit.secondary ? normaliseHex(explicit.secondary) : "#444444",
        accent:    explicit.accent    ? normaliseHex(explicit.accent)    : "#222222",
      },
    };
  }

  var freq = {};
  images.forEach(function (img) {
    for (var row = 0; row < img.height; row++) {
      for (var col = 0; col < img.width; col++) {
        var px = img.pixels[row][col];
        if (px.a < alphaThresh) { continue; }
        var key = px.r + "," + px.g + "," + px.b;
        freq[key] = (freq[key] || 0) + 1;
      }
    }
  });

  // Most frequent first; ties broken by key so the output is deterministic.
  var sorted = Object.keys(freq).sort(function (a, b) {
    return (freq[b] - freq[a]) || (a < b ? -1 : a > b ? 1 : 0);
  });
  var top3 = sorted.slice(0, 3).map(function (k) {
    var parts = k.split(",");
    return { r: parseInt(parts[0], 10), g: parseInt(parts[1], 10), b: parseInt(parts[2], 10) };
  });

  if (top3.length === 0) {
    log("Warning: no non-transparent pixels found in source image");
    return {
      fn: function () { return 0; },
      palette: { primary: "#888888", secondary: "#444444", accent: "#222222" },
    };
  }

  var ranked = top3.slice().sort(function (a, b) { return luminance(b) - luminance(a); });
  log("Auto-detected palette:");
  ranked.forEach(function (c, i) {
    log("  index " + (i + 1) + ": rgb(" + c.r + "," + c.g + "," + c.b + ")  lum=" + luminance(c).toFixed(1) + "  hex=" + rgbToHex(c));
  });

  return {
    fn: function (px) {
      if (px.a < alphaThresh) { return 0; }
      var best = 0, bestDist = Infinity;
      for (var ri = 0; ri < ranked.length; ri++) {
        var d = rgbDist(px, ranked[ri]);
        if (d < bestDist) { bestDist = d; best = ri + 1; }
      }
      return best;
    },
    palette: {
      primary:   ranked[0] ? rgbToHex(ranked[0]) : "#888888",
      secondary: ranked[1] ? rgbToHex(ranked[1]) : "#444444",
      accent:    ranked[2] ? rgbToHex(ranked[2]) : "#222222",
    },
  };
}

// ── Grid helpers ──────────────────────────────────────────────────────────────

/** Map an image to a grid (array of rows of colour indices). */
function mapGrid(img, mapper) {
  var grid = [];
  for (var row = 0; row < img.height; row++) {
    var gridRow = [];
    for (var col = 0; col < img.width; col++) {
      gridRow.push(mapper.fn(img.pixels[row][col]));
    }
    grid.push(gridRow);
  }
  return grid;
}

/** Mirror a grid horizontally (reverse each row). */
function flipGrid(grid) {
  return grid.map(function (row) { return row.slice().reverse(); });
}

/**
 * Pad a grid with transparent cells to cols × rows, bottom-aligned so the feet
 * stay on the ground. anchor "centre" (default) centres it horizontally;
 * "left" keeps column 0 in place (how the renderer draws narrower grids).
 */
function padGrid(grid, cols, rows, anchor) {
  var h = grid.length;
  var w = h ? grid[0].length : 0;
  if (w > cols || h > rows) {
    throw new Error("padGrid: " + w + "×" + h + " grid does not fit in " + cols + "×" + rows);
  }
  var left = anchor === "left" ? 0 : Math.floor((cols - w) / 2);
  var top  = rows - h;
  var out = [];
  for (var r = 0; r < rows; r++) {
    var src = grid[r - top];
    var line = [];
    for (var c = 0; c < cols; c++) {
      line.push(src && c >= left && c < left + w ? src[c - left] : 0);
    }
    out.push(line);
  }
  return out;
}

// ── ASCII preview ─────────────────────────────────────────────────────────────

var PREVIEW_CHARS = { 0: " ", 1: "█", 2: "▓", 3: "░" };

function printPreview(grid) {
  var cols = grid.length ? grid[0].length : 0;
  var border = "+" + "-".repeat(cols) + "+";
  console.log(border);
  grid.forEach(function (row) {
    console.log("|" + row.map(function (v) { return PREVIEW_CHARS[v] || "?"; }).join("") + "|");
  });
  console.log(border);
}

// ── DEFS string generation ────────────────────────────────────────────────────

function buildDefsEntry(spriteType, stage, grid) {
  var lines = [];
  lines.push('  DEFS["' + spriteType + '"] = DEFS["' + spriteType + '"] || {};');
  lines.push('  DEFS["' + spriteType + '"]["' + stage + '"] = [');
  for (var row = 0; row < grid.length; row++) {
    var comma = (row < grid.length - 1) ? "," : "";
    lines.push('    "' + grid[row].join("") + '"' + comma + ' //' + row);
  }
  lines.push("  ];");
  return lines.join("\n");
}

// ── PNG encoder (8-bit RGBA, no dependencies) ─────────────────────────────────

var CRC_TABLE = (function () {
  var table = [];
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) { c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); }
    table.push(c >>> 0);
  }
  return table;
}());

function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) { c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/**
 * Encode an RGBA image as a PNG buffer.
 * @param {number} width
 * @param {number} height
 * @param {function(number, number): {r,g,b,a}} getPixel  (x, y) → colour
 */
function encodePng(width, height, getPixel) {
  var raw = Buffer.alloc(height * (width * 4 + 1));
  var o = 0;
  for (var y = 0; y < height; y++) {
    raw[o++] = 0; // filter: none
    for (var x = 0; x < width; x++) {
      var p = getPixel(x, y);
      raw[o++] = p.r; raw[o++] = p.g; raw[o++] = p.b; raw[o++] = p.a;
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

module.exports = {
  MAX_COLS: MAX_COLS,
  MAX_ROWS: MAX_ROWS,
  setLogger: setLogger,
  hexToRgb: hexToRgb,
  rgbToHex: rgbToHex,
  normaliseHex: normaliseHex,
  rgbDist: rgbDist,
  luminance: luminance,
  detectFormat: detectFormat,
  transcodeToPng: transcodeToPng,
  decodePng: decodePng,
  decodePixil: decodePixil,
  decodeImageFile: decodeImageFile,
  applyTransparentColour: applyTransparentColour,
  cropTransparentBorder: cropTransparentBorder,
  removeAutoBackground: removeAutoBackground,
  capScale: capScale,
  resample: resample,
  buildColourMapper: buildColourMapper,
  mapGrid: mapGrid,
  flipGrid: flipGrid,
  padGrid: padGrid,
  printPreview: printPreview,
  buildDefsEntry: buildDefsEntry,
  encodePng: encodePng,
};
