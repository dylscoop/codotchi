#!/usr/bin/env node
/**
 * export_sprite_pngs.js — write existing sprite grids out as sprites/<species>/ source folders
 *
 * Usage:
 *   node scripts/export_sprite_pngs.js <species> [<species> ...] [--out <dir>]
 *
 * Loads vscode/media/spriteConstants.js, sprites.generated.js and sprites.js the
 * way the webview does, then for each species writes one PNG per grid (in the
 * species' palette colours, 0 = transparent) plus a sprite.json, so
 * scripts/import_sprites_bulk.js can rebuild the same grids. Used to move
 * hand-maintained DEFS out of sprites.js into the bulk pipeline.
 *
 * The sprite.json keeps the grid exactly as the renderer draws it: no crop,
 * narrower stages anchored left, the exact palette and legRowStart. A species
 * over the 192×128 cap is scaled down on the next bulk import, and its
 * legRowStart is scaled to match.
 */

"use strict";

var fs   = require("fs");
var path = require("path");
var vm   = require("vm");
var lib  = require("./lib/spriteImport");

var REPO_ROOT = path.resolve(__dirname, "..");
var MEDIA     = path.join(REPO_ROOT, "vscode", "media");

function loadWebviewSprites() {
  var window = {};
  var context = vm.createContext({ window: window });
  ["spriteConstants.js", "sprites.generated.js", "sprites.js", "customCharacters.js"].forEach(function (file) {
    var full = path.join(MEDIA, file);
    if (!fs.existsSync(full)) { return; }
    vm.runInContext(fs.readFileSync(full, "utf8").replace(/^﻿/, ""), context, { filename: file });
  });
  return window;
}

function rotationAnimals() {
  var engine = fs.readFileSync(path.join(REPO_ROOT, "packages", "core", "src", "gameEngine.ts"), "utf8");
  var m = /ROTATION_ANIMALS\s*=\s*\[([\s\S]*?)\]/.exec(engine);
  return m ? (m[1].match(/"([^"]+)"/g) || []).map(function (s) { return s.slice(1, -1); }) : [];
}

function exportSpecies(window, species, outDir, rotation) {
  var grids   = window.SPRITES && window.SPRITES[species];
  var meta    = window.SPRITE_GRID_META && window.SPRITE_GRID_META[species];
  var palette = window.SPRITE_ANIMAL_PALETTES && window.SPRITE_ANIMAL_PALETTES[species];
  if (!grids || !meta || !palette) {
    throw new Error(species + ": needs grids, SPRITE_GRID_META and a palette");
  }

  var colours = {
    1: lib.hexToRgb(palette.primary),
    2: lib.hexToRgb(palette.secondary),
    3: lib.hexToRgb(palette.accent || palette.primary),
  };
  var dir = path.join(outDir, species);
  fs.mkdirSync(dir, { recursive: true });

  Object.keys(grids).forEach(function (key) {
    var grid = grids[key];
    var png = lib.encodePng(meta.cols, meta.rows, function (x, y) {
      var v = grid[y] && grid[y][x];
      if (!v) { return { r: 0, g: 0, b: 0, a: 0 }; }
      if (v === 4 || v === 5) { throw new Error(species + "/" + key + ": gold cells (4/5) can't round-trip through a 3-colour palette"); }
      var c = colours[v];
      return { r: c.r, g: c.g, b: c.b, a: 255 };
    });
    fs.writeFileSync(path.join(dir, key + ".png"), png);
  });

  var scale = lib.capScale(meta.cols, meta.rows);
  var config = {
    palette: {
      primary:   lib.normaliseHex(palette.primary),
      secondary: lib.normaliseHex(palette.secondary),
      accent:    lib.normaliseHex(palette.accent || palette.primary),
    },
    background:  lib.normaliseHex(palette.background || "#1a1a1a"),
    crop:        false,
    anchor:      "left",
    legRowStart: Math.round(meta.legRowStart * scale),
  };
  if (window.UPRIGHT_TYPES && window.UPRIGHT_TYPES[species]) { config.upright = true; }
  config.inRotation = rotation.indexOf(species) !== -1;
  var ch = window.CUSTOM_CHARACTERS && window.CUSTOM_CHARACTERS[species];
  if (ch) {
    config.passcode = ch.passcode;
    config.defaultName = ch.defaultName;
  }
  fs.writeFileSync(path.join(dir, "sprite.json"), JSON.stringify(config, null, 2) + "\n");
  console.log(species + ": " + Object.keys(grids).length + " grid(s), " + meta.cols + "×" + meta.rows +
              (scale < 1 ? " (will be scaled to fit the cap on import)" : "") + " → " + path.relative(REPO_ROOT, dir));
}

(function main() {
  var args = process.argv.slice(2);
  var outIdx = args.indexOf("--out");
  var outDir = outIdx === -1 ? path.join(REPO_ROOT, "sprites") : path.resolve(args[outIdx + 1]);
  var species = args.filter(function (a, i) { return a.indexOf("--") !== 0 && (outIdx === -1 || i !== outIdx + 1); });
  if (species.length === 0) {
    console.error("Usage: node scripts/export_sprite_pngs.js <species> [<species> ...] [--out <dir>]");
    process.exit(1);
  }
  var window = loadWebviewSprites();
  var rotation = rotationAnimals();
  species.forEach(function (s) { exportSpecies(window, s, outDir, rotation); });
}());
