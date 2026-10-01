#!/usr/bin/env node
/**
 * import_sprites_bulk.js — build vscode/media/sprites.generated.js from sprites/<species>/
 *
 * Usage:
 *   node scripts/import_sprites_bulk.js [--src <dir>] [--out <file>] [--check] [--quiet]
 *
 *   --src    Folder of species folders (default: <repo>/sprites)
 *   --out    Output file (default: <repo>/vscode/media/sprites.generated.js)
 *   --check  Don't write; exit 1 if the output file is out of date (used in CI)
 *   --quiet  Only print warnings and errors
 *
 * Source layout (one folder per species; the folder name is the spriteType):
 *
 *   sprites/<species>/baby.png, child.png, teen.png, adult.png, senior.png
 *   sprites/<species>/<stage>_<mood>.png   optional mood art (e.g. adult_sleeping.png)
 *   sprites/<species>/sprite.json          optional settings, all fields optional:
 *     palette        { primary, secondary, accent }  exact colours → indices 1/2/3
 *                    (default: the 3 most frequent colours across all stages,
 *                    ranked by luminance)
 *     background     canvas background colour (default "#1a1a1a")
 *     transparent    source colour to treat as transparent (default: automatic
 *                    for fully-opaque images with uniform corners)
 *     transparentDistance  RGB distance tolerance for transparent (default 2500)
 *     threshold      alpha below which a pixel is transparent (default 128)
 *     crop           trim the transparent border of each stage (default true)
 *     anchor         "centre" (default) or "left": where narrower stages sit
 *                    on the shared grid (always bottom-aligned)
 *     flip           mirror every stage (source faces right; quadrupeds must face left)
 *     legRowStart    first leg-zone row of the output grid (default floor(rows * 0.78))
 *     upright        portrait species (added to UPRIGHT_TYPES)
 *     inRotation, passcode, defaultName
 *                    checked against ROTATION_ANIMALS and customCharacters.js;
 *                    a mismatch is a warning (registration is still by hand)
 *
 * Every stage of a species shares one grid size and one palette: stages are
 * scaled by one factor so the largest fits the 192×128 cap (relative sizes are
 * kept), then padded onto the shared grid. The output is rebuilt from scratch
 * on every run and is deterministic, so --check can compare it byte for byte.
 */

"use strict";

var fs   = require("fs");
var path = require("path");
var vm   = require("vm");
var lib  = require("./lib/spriteImport");

var REPO_ROOT    = path.resolve(__dirname, "..");
var STAGES       = ["baby", "child", "teen", "adult", "senior"];
var IMAGE_EXTS   = [".png", ".jpg", ".jpeg", ".webp", ".pixil"];
var GRID_KEY_RE  = /^(baby|child|teen|adult|senior)(_[a-z]+)?$/;
var SPECIES_RE   = /^[a-z][a-z0-9_]*$/;

/** Order grid keys: the five stages first, then mood variants alphabetically. */
function compareGridKeys(a, b) {
  var sa = STAGES.indexOf(a), sb = STAGES.indexOf(b);
  if (sa !== -1 || sb !== -1) {
    if (sa === -1) { return 1; }
    if (sb === -1) { return -1; }
    return sa - sb;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

function readJson(file) {
  if (!fs.existsSync(file)) { return {}; }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch (e) {
    throw new Error(file + ": " + e.message);
  }
}

/** The image files of one species folder, keyed by grid key. */
function findImages(dir) {
  var images = {};
  fs.readdirSync(dir).forEach(function (name) {
    var ext = path.extname(name).toLowerCase();
    var key = path.basename(name, path.extname(name));
    if (IMAGE_EXTS.indexOf(ext) === -1 || !GRID_KEY_RE.test(key)) { return; }
    if (images[key]) {
      throw new Error(dir + ": two images for " + key + " (" + path.basename(images[key]) + ", " + name + ")");
    }
    images[key] = path.join(dir, name);
  });
  return images;
}

/**
 * Import one species folder.
 * @returns {{ species, cols, rows, legRowStart, palette, upright, grids, missing, config }}
 */
function importSpecies(species, dir) {
  var config  = readJson(path.join(dir, "sprite.json"));
  var files   = findImages(dir);
  var keys    = Object.keys(files).sort(compareGridKeys);
  if (keys.length === 0) { throw new Error(dir + ": no stage images found"); }

  var alphaThresh = config.threshold != null ? config.threshold : 128;
  var transDist   = config.transparentDistance != null ? config.transparentDistance : 2500;
  var crop        = config.crop !== false;

  // 1. Decode, remove the background, crop
  var images = keys.map(function (key) {
    var img = lib.decodeImageFile(files[key]);
    if (config.transparent) {
      img = lib.applyTransparentColour(img, config.transparent, transDist);
    } else {
      img = lib.removeAutoBackground(img, alphaThresh, transDist);
    }
    if (crop) { img = lib.cropTransparentBorder(img, alphaThresh); }
    return img;
  });

  // 2. One scale for every stage, so the largest fits the runtime cap
  var maxW  = Math.max.apply(null, images.map(function (i) { return i.width; }));
  var maxH  = Math.max.apply(null, images.map(function (i) { return i.height; }));
  var scale = lib.capScale(maxW, maxH);
  var cols  = Math.max(1, Math.round(maxW * scale));
  var rows  = Math.max(1, Math.round(maxH * scale));
  var resampled = images.map(function (img) {
    return lib.resample(img,
      Math.min(cols, Math.max(1, Math.round(img.width  * scale))),
      Math.min(rows, Math.max(1, Math.round(img.height * scale))));
  });

  // 3. One palette for every stage; quantise, mirror, pad onto the shared grid
  var mapper = lib.buildColourMapper(resampled, alphaThresh, config.palette);
  var grids  = {};
  resampled.forEach(function (img, i) {
    var grid = lib.mapGrid(img, mapper);
    if (config.flip) { grid = lib.flipGrid(grid); }
    grids[keys[i]] = lib.padGrid(grid, cols, rows, config.anchor === "left" ? "left" : "centre");
  });

  var legRowStart = config.legRowStart != null ? config.legRowStart : Math.floor(rows * 0.78);
  if (!(legRowStart >= 0 && legRowStart < rows)) {
    throw new Error(dir + ": legRowStart " + legRowStart + " is outside the " + rows + "-row grid");
  }

  return {
    species:     species,
    cols:        cols,
    rows:        rows,
    legRowStart: legRowStart,
    palette: {
      primary:    mapper.palette.primary,
      secondary:  mapper.palette.secondary,
      accent:     mapper.palette.accent,
      background: config.background ? lib.normaliseHex(config.background) : "#1a1a1a",
    },
    upright: !!config.upright,
    grids:   grids,
    missing: STAGES.filter(function (s) { return !files[s]; }),
    config:  config,
  };
}

// ── Registration checks (warnings only) ──────────────────────────────────────

function loadRegistration(repoRoot) {
  var reg = { rotation: null, characters: null };
  try {
    var engine = fs.readFileSync(path.join(repoRoot, "packages", "core", "src", "gameEngine.ts"), "utf8");
    var m = /ROTATION_ANIMALS\s*=\s*\[([\s\S]*?)\]/.exec(engine);
    if (m) { reg.rotation = (m[1].match(/"([^"]+)"/g) || []).map(function (s) { return s.slice(1, -1); }); }
  } catch (e) { /* not in a full checkout */ }
  try {
    var src = fs.readFileSync(path.join(repoRoot, "vscode", "media", "customCharacters.js"), "utf8");
    var win = {};
    vm.runInNewContext(src, { window: win });
    reg.characters = win.CUSTOM_CHARACTERS || null;
  } catch (e) { /* not in a full checkout */ }
  return reg;
}

function registrationWarnings(sp, reg) {
  var out = [];
  var c = sp.config;
  if (c.inRotation != null && reg.rotation) {
    var inList = reg.rotation.indexOf(sp.species) !== -1;
    if (!!c.inRotation !== inList) {
      out.push(sp.species + ": sprite.json inRotation is " + !!c.inRotation +
               " but ROTATION_ANIMALS " + (inList ? "includes" : "does not include") + " it");
    }
  }
  if ((c.passcode || c.defaultName) && reg.characters) {
    var ch = reg.characters[sp.species];
    if (!ch) {
      out.push(sp.species + ": sprite.json has a passcode/defaultName but customCharacters.js has no entry");
    } else {
      if (c.passcode && c.passcode !== ch.passcode) {
        out.push(sp.species + ": passcode \"" + c.passcode + "\" differs from customCharacters.js (\"" + ch.passcode + "\")");
      }
      if (c.defaultName && c.defaultName !== ch.defaultName) {
        out.push(sp.species + ": defaultName \"" + c.defaultName + "\" differs from customCharacters.js (\"" + ch.defaultName + "\")");
      }
    }
  }
  return out;
}

// ── Output ───────────────────────────────────────────────────────────────────

function q(s) { return JSON.stringify(s); }

function renderOutput(all) {
  var L = [];
  L.push("/**");
  L.push(" * sprites.generated.js — GENERATED by scripts/import_sprites_bulk.js from");
  L.push(" * sprites/<species>/. Do not edit: change the source images or sprite.json and");
  L.push(" * re-run the script.");
  L.push(" *");
  L.push(" * Loaded after spriteConstants.js (whose SPRITE_GRID_META, palettes and");
  L.push(" * UPRIGHT_TYPES it extends) and before sprites.js (which merges");
  L.push(" * window.GENERATED_SPRITE_DEFS into its DEFS).");
  L.push(" */");
  L.push("");
  L.push("/* global window */");
  L.push("(function () {");
  L.push("  \"use strict\";");
  L.push("");
  L.push("  var DEFS = {};");
  all.forEach(function (sp) {
    L.push("");
    L.push("  // -- " + sp.species + " (" + sp.cols + " x " + sp.rows + ") " + "-".repeat(Math.max(3, 60 - sp.species.length)));
    L.push("  DEFS[" + q(sp.species) + "] = {};");
    Object.keys(sp.grids).sort(compareGridKeys).forEach(function (key) {
      var grid = sp.grids[key];
      L.push("  DEFS[" + q(sp.species) + "][" + q(key) + "] = [");
      grid.forEach(function (row, r) {
        L.push("    \"" + row.join("") + "\"" + (r < grid.length - 1 ? "," : "") + " //" + r);
      });
      L.push("  ];");
    });
  });
  L.push("");
  L.push("  window.GENERATED_SPRITE_DEFS = DEFS;");
  L.push("");
  L.push("  Object.assign(window.SPRITE_GRID_META, {");
  all.forEach(function (sp) {
    L.push("    " + q(sp.species) + ": { cols: " + sp.cols + ", rows: " + sp.rows + ", legRowStart: " + sp.legRowStart + " },");
  });
  L.push("  });");
  L.push("");
  L.push("  Object.assign(window.SPRITE_ANIMAL_PALETTES, {");
  all.forEach(function (sp) {
    var p = sp.palette;
    L.push("    " + q(sp.species) + ": { primary: " + q(p.primary) + ", secondary: " + q(p.secondary) +
           ", accent: " + q(p.accent) + ", background: " + q(p.background) + " },");
  });
  L.push("  });");
  var upright = all.filter(function (sp) { return sp.upright; });
  if (upright.length) {
    L.push("");
    upright.forEach(function (sp) { L.push("  window.UPRIGHT_TYPES[" + q(sp.species) + "] = 1;"); });
  }
  L.push("}());");
  L.push("");
  return L.join("\n");
}

/**
 * Import every species folder under srcDir.
 * @returns {{ text: string, species: object[], warnings: string[] }}
 */
function generate(srcDir, opts) {
  var repoRoot = (opts && opts.repoRoot) || REPO_ROOT;
  var names = fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir).filter(function (n) { return fs.statSync(path.join(srcDir, n)).isDirectory(); }).sort()
    : [];
  var warnings = [];
  var reg = loadRegistration(repoRoot);
  var all = names.map(function (name) {
    if (!SPECIES_RE.test(name)) {
      throw new Error(path.join(srcDir, name) + ": species folder names must be lower-case letters, digits or _");
    }
    var sp = importSpecies(name, path.join(srcDir, name));
    if (sp.missing.length) {
      warnings.push(name + ": missing " + sp.missing.join(", ") + " (falls back to adult" +
                    (sp.missing.indexOf("adult") !== -1 ? ", which is missing too — drawn as classic" : "") + ")");
    }
    warnings = warnings.concat(registrationWarnings(sp, reg));
    return sp;
  });
  return { text: renderOutput(all), species: all, warnings: warnings };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main(argv) {
  function flag(name, def) { var i = argv.indexOf(name); return i === -1 ? def : argv[i + 1]; }
  var srcDir = path.resolve(flag("--src", path.join(REPO_ROOT, "sprites")));
  var out    = path.resolve(flag("--out", path.join(REPO_ROOT, "vscode", "media", "sprites.generated.js")));
  var check  = argv.indexOf("--check") !== -1;
  var quiet  = argv.indexOf("--quiet") !== -1 || check;
  if (quiet) { lib.setLogger(null); }

  var result;
  try {
    result = generate(srcDir);
  } catch (e) {
    console.error("Error: " + e.message);
    return 1;
  }

  result.species.forEach(function (sp) {
    if (!quiet) {
      console.log(sp.species + ": " + sp.cols + "×" + sp.rows + ", legRowStart " + sp.legRowStart +
                  ", " + Object.keys(sp.grids).length + " grid(s), palette " +
                  [sp.palette.primary, sp.palette.secondary, sp.palette.accent].join(" "));
    }
  });
  result.warnings.forEach(function (w) { console.error("Warning: " + w); });

  if (check) {
    var current = fs.existsSync(out) ? fs.readFileSync(out, "utf8").replace(/\r\n/g, "\n") : null;
    if (current !== result.text) {
      console.error(path.relative(REPO_ROOT, out) + " is out of date — run node scripts/import_sprites_bulk.js");
      return 1;
    }
    console.log(path.relative(REPO_ROOT, out) + " is up to date (" + result.species.length + " species)");
    return 0;
  }

  fs.writeFileSync(out, result.text, "utf8");
  console.log("Wrote " + path.relative(REPO_ROOT, out) + " (" + result.species.length + " species, " +
              Math.round(result.text.length / 1024) + " KB)");
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = { generate: generate, importSpecies: importSpecies, renderOutput: renderOutput, STAGES: STAGES };
