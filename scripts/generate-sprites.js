#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

const ROOT = path.resolve(__dirname, "..");
const DESIGNS_DIR = path.join(ROOT, "sprite_designs");
const VSCODE_SPRITES_DIR = path.join(ROOT, "vscode", "media", "sprites");
const PYCHARM_SPRITES_DIR = path.join(ROOT, "pycharm", "src", "main", "resources", "webview", "sprites");
const VSCODE_MANIFEST_PATH = path.join(ROOT, "vscode", "media", "sprite-manifest.js");
const PYCHARM_MANIFEST_PATH = path.join(ROOT, "pycharm", "src", "main", "resources", "webview", "sprite-manifest.js");
const PREVIEW_DIR = path.join(ROOT, "sprite_designs", "previews");
const OUTPUT_SCALE = 6;
const PREVIEW_SCALE = 8;
const GIF_FPS = 8;
const GIF_DELAY = Math.round(1000 / GIF_FPS);

const SYMBOL_COLORS = {
  ".": null,
  u: "#1f1f1f",
  o: "#f08c2e",
  l: "#ffe4ae",
  s: "#8a3d15",
  e: "#101010",
  n: "#ff7a7a",
};

const ANIMAL_ORDER = [
  "classic",
  "monkey",
  "rooster",
  "dragon",
  "cat",
  "rat",
  "ox",
  "tiger",
  "rabbit",
  "horse",
  "goat",
  "dog",
  "pig",
  "snake",
];

const STAGE_ORDER = ["baby", "child", "teen", "adult", "senior"];
const ANIMATION_STATES = ["idle", "walk", "sleep", "react"];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function emptyDir(dirPath) {
  ensureDir(dirPath);
  for (const entry of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function hexToRgba(hex, alpha = 255) {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
    a: alpha,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lighten(hex, factor) {
  const rgba = hexToRgba(hex);
  const mix = (channel) => Math.round(channel + (255 - channel) * factor);
  return {
    r: mix(rgba.r),
    g: mix(rgba.g),
    b: mix(rgba.b),
    a: 255,
  };
}

function createPixelGrid(tileSize) {
  return Array.from({ length: tileSize }, () => Array(tileSize).fill("."));
}

function cloneGrid(rows) {
  return rows.map((row) => row.split(""));
}

function normalizeRow(row, tileSize) {
  if (row.length === tileSize) {
    return row;
  }
  if (row.length > tileSize) {
    return row.slice(0, tileSize);
  }
  return row + ".".repeat(tileSize - row.length);
}

function loadDesigns() {
  const files = fs.readdirSync(DESIGNS_DIR)
    .filter((file) => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const designs = {};
  for (const file of files) {
    const spriteType = path.basename(file, ".json");
    const json = JSON.parse(fs.readFileSync(path.join(DESIGNS_DIR, file), "utf8"));
    const tileSize = json.tileSize || 16;
    const stages = {};
    for (const stage of STAGE_ORDER) {
      const rows = (json.stages && json.stages[stage]) || [];
      stages[stage] = rows.map((row) => normalizeRow(row, tileSize));
    }
    designs[spriteType] = { tileSize, stages };
  }
  return designs;
}

function shiftRows(rows, delta) {
  const tileSize = rows.length;
  const next = createPixelGrid(tileSize);
  for (let y = 0; y < tileSize; y += 1) {
    const targetY = y + delta;
    if (targetY < 0 || targetY >= tileSize) {
      continue;
    }
    next[targetY] = rows[y].slice();
  }
  return next;
}

function shiftTail(rows, deltaY) {
  const tileSize = rows.length;
  const next = rows.map((row) => row.slice());
  const tailPixels = [];
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = Math.floor(tileSize * 0.6); x < tileSize; x += 1) {
      const symbol = rows[y][x];
      if (symbol === "u" || symbol === "o" || symbol === "s") {
        tailPixels.push({ x, y, symbol });
        next[y][x] = ".";
      }
    }
  }
  for (const pixel of tailPixels) {
    const targetY = clamp(pixel.y + deltaY, 0, tileSize - 1);
    next[targetY][pixel.x] = pixel.symbol;
  }
  return next;
}

function adjustLegs(rows, frame) {
  const tileSize = rows.length;
  const next = rows.map((row) => row.slice());
  const startY = Math.floor(tileSize * 0.65);
  const middleX = Math.floor(tileSize / 2);
  for (let y = startY; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const symbol = rows[y][x];
      if (symbol === ".") {
        continue;
      }
      const leftHalf = x < middleX;
      const shouldShift = frame === 0 ? !leftHalf : leftHalf;
      next[y][x] = ".";
      const targetY = clamp(y + (shouldShift ? 1 : 0), 0, tileSize - 1);
      next[targetY][x] = symbol;
    }
  }
  return next;
}

function closeEyes(rows) {
  const tileSize = rows.length;
  const next = rows.map((row) => row.slice());
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      if (next[y][x] === "e") {
        next[y][x] = "u";
      }
    }
  }
  return next;
}

function addReactionFlash(rows, bright) {
  return rows.map((row) => row.map((symbol) => {
    if (!bright) {
      return symbol;
    }
    if (symbol === "o") {
      return "l";
    }
    if (symbol === "s") {
      return "o";
    }
    return symbol;
  }));
}

function createEggFrames(tileSize) {
  const centers = [0, 1, 0, -1, 0, 1, 0, -1];
  return centers.map((shiftX, index) => {
    const grid = createPixelGrid(tileSize);
    const cx = Math.floor(tileSize / 2) + shiftX;
    const cy = Math.floor(tileSize / 2) + (index % 2 === 0 ? 0 : -1);
    const rx = Math.floor(tileSize * 0.25);
    const ry = Math.floor(tileSize * 0.35);
    for (let y = 0; y < tileSize; y += 1) {
      for (let x = 0; x < tileSize; x += 1) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) {
          const isEdge = Math.abs(dx * dx + dy * dy - 1.0) < 0.28;
          grid[y][x] = isEdge ? "u" : "o";
        }
      }
    }
    grid[cy - 1][cx - 1] = "e";
    grid[cy - 1][cx + 1] = "e";
    return grid;
  });
}

function buildFrames(rows, animationState) {
  switch (animationState) {
    case "walk":
      return [adjustLegs(rows, 0), adjustLegs(shiftTail(rows, -1), 1)];
    case "sleep": {
      const sleeping = closeEyes(rows);
      return [
        shiftRows(sleeping, 0),
        shiftRows(sleeping, -1),
        shiftRows(sleeping, 0),
        shiftRows(sleeping, 1),
      ];
    }
    case "react":
      return [shiftRows(addReactionFlash(rows, true), -1), addReactionFlash(rows, false)];
    case "idle":
    default:
      return [rows.map((row) => row.slice())];
  }
}

function writePixel(png, x, y, rgba) {
  const idx = (png.width * y + x) << 2;
  png.data[idx] = rgba.r;
  png.data[idx + 1] = rgba.g;
  png.data[idx + 2] = rgba.b;
  png.data[idx + 3] = rgba.a;
}

function frameToPng(rows, scale) {
  const tileSize = rows.length;
  const png = new PNG({ width: tileSize * scale, height: tileSize * scale });
  for (let y = 0; y < tileSize; y += 1) {
    for (let x = 0; x < tileSize; x += 1) {
      const symbol = rows[y][x];
      const hex = SYMBOL_COLORS[symbol];
      if (!hex) {
        continue;
      }
      const rgba = symbol === "l" && hex === SYMBOL_COLORS.l ? lighten(hex, 0.08) : hexToRgba(hex);
      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          writePixel(png, x * scale + sx, y * scale + sy, rgba);
        }
      }
    }
  }
  return png;
}

function writePng(filePath, rows, scale) {
  const png = frameToPng(rows, scale);
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function pngToRgbaBuffer(png) {
  const data = new Uint8Array(png.width * png.height * 4);
  png.data.copy(data);
  return data;
}

function writeGif(filePath, frameRows, scale) {
  const firstPng = frameToPng(frameRows[0], scale);
  const encoder = GIFEncoder();

  frameRows.forEach((rows, frameIndex) => {
    const png = frameToPng(rows, scale);
    const rgba = pngToRgbaBuffer(png);
    const palette = quantize(rgba, 256, { format: "rgba4444" });
    const index = applyPalette(rgba, palette, { format: "rgba4444" });
    encoder.writeFrame(index, firstPng.width, firstPng.height, {
      palette,
      delay: GIF_DELAY,
      repeat: frameIndex === 0 ? 0 : undefined,
      transparent: true,
      transparentIndex: 0,
      dispose: 1,
    });
  });

  encoder.finish();
  fs.writeFileSync(filePath, Buffer.from(encoder.bytes()));
}

function buildPreviewSheet(designs) {
  ensureDir(PREVIEW_DIR);
  const cellTile = 16 * PREVIEW_SCALE;
  const labelHeight = 18;
  const columns = 5;
  const rows = Math.ceil(ANIMAL_ORDER.length / columns);
  const width = columns * cellTile;
  const height = rows * (cellTile + labelHeight);
  const png = new PNG({ width, height });

  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 248;
    png.data[i + 1] = 246;
    png.data[i + 2] = 238;
    png.data[i + 3] = 255;
  }

  ANIMAL_ORDER.forEach((animal, index) => {
    const design = designs[animal];
    if (!design) {
      return;
    }
    const col = index % columns;
    const row = Math.floor(index / columns);
    const offsetX = col * cellTile;
    const offsetY = row * (cellTile + labelHeight);
    const sprite = frameToPng(cloneGrid(design.stages.adult), PREVIEW_SCALE);
    for (let y = 0; y < sprite.height; y += 1) {
      for (let x = 0; x < sprite.width; x += 1) {
        const src = (sprite.width * y + x) << 2;
        const dst = (png.width * (offsetY + y) + (offsetX + x)) << 2;
        if (sprite.data[src + 3] === 0) {
          continue;
        }
        png.data[dst] = sprite.data[src];
        png.data[dst + 1] = sprite.data[src + 1];
        png.data[dst + 2] = sprite.data[src + 2];
        png.data[dst + 3] = sprite.data[src + 3];
      }
    }
  });

  fs.writeFileSync(path.join(PREVIEW_DIR, "sprite-sheet-preview.png"), PNG.sync.write(png));
}

function writeManifest() {
  const manifest = {};
  const files = fs.readdirSync(VSCODE_SPRITES_DIR)
    .filter((file) => file.endsWith(".gif"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const bytes = fs.readFileSync(path.join(VSCODE_SPRITES_DIR, file));
    manifest[file] = `data:image/gif;base64,${bytes.toString("base64")}`;
  }

  const js = `window.__GOTCHI_SPRITE_MANIFEST = ${JSON.stringify(manifest, null, 2)};\n`;
  fs.writeFileSync(VSCODE_MANIFEST_PATH, js);
  fs.writeFileSync(PYCHARM_MANIFEST_PATH, js);
}

function generateSpriteAssets() {
  const designs = loadDesigns();
  emptyDir(VSCODE_SPRITES_DIR);
  emptyDir(PYCHARM_SPRITES_DIR);
  ensureDir(PREVIEW_DIR);

  for (const animal of ANIMAL_ORDER) {
    const design = designs[animal];
    if (!design) {
      continue;
    }

    for (const stage of STAGE_ORDER) {
      const rows = cloneGrid(design.stages[stage]);
      for (const animationState of ANIMATION_STATES) {
        const frames = buildFrames(rows, animationState);
        const baseName = `${animal}_${stage}_${animationState}`;
        writeGif(path.join(VSCODE_SPRITES_DIR, `${baseName}.gif`), frames, OUTPUT_SCALE);
        writePng(path.join(VSCODE_SPRITES_DIR, `${baseName}.png`), frames[0], OUTPUT_SCALE);
      }
    }
  }

  const eggFrames = createEggFrames(16);
  writeGif(path.join(VSCODE_SPRITES_DIR, "egg.gif"), eggFrames, OUTPUT_SCALE);
  writePng(path.join(VSCODE_SPRITES_DIR, "egg.png"), eggFrames[0], OUTPUT_SCALE);

  for (const file of fs.readdirSync(VSCODE_SPRITES_DIR)) {
    fs.copyFileSync(
      path.join(VSCODE_SPRITES_DIR, file),
      path.join(PYCHARM_SPRITES_DIR, file)
    );
  }

  writeManifest();
  buildPreviewSheet(designs);
  console.log(`Generated sprites into ${path.relative(ROOT, VSCODE_SPRITES_DIR)} and ${path.relative(ROOT, PYCHARM_SPRITES_DIR)}`);
  console.log(`Preview sheet: ${path.relative(ROOT, path.join(PREVIEW_DIR, "sprite-sheet-preview.png"))}`);
}

generateSpriteAssets();
