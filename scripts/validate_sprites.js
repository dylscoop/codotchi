#!/usr/bin/env node
/**
 * validate_sprites.js — check the webview sprite data in vscode/media
 *
 * Usage:
 *   node scripts/validate_sprites.js
 *
 * Loads spriteConstants.js, sprites.generated.js and sprites.js the way the
 * webview does (in a sandbox with a bare `window`) and checks, for every
 * species with grids:
 *   - a SPRITE_GRID_META entry within the 192×128 cap, legRowStart inside the grid
 *   - every grid is exactly cols × rows
 *   - only colour indices 0-5
 *   - all five stages (baby, child, teen, adult, senior)
 *   - a palette with primary, secondary and accent colours
 *
 * Exits 1 and lists every problem if any check fails. Runs in CI.
 */

"use strict";

var fs   = require("fs");
var path = require("path");
var vm   = require("vm");

var MEDIA  = path.resolve(__dirname, "..", "vscode", "media");
var FILES  = ["spriteConstants.js", "sprites.generated.js", "sprites.js"];
var STAGES = ["baby", "child", "teen", "adult", "senior"];
var HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

function load() {
  var window = {};
  var context = vm.createContext({ window: window });
  FILES.forEach(function (file) {
    var source = fs.readFileSync(path.join(MEDIA, file), "utf8").replace(/^﻿/, "");
    vm.runInContext(source, context, { filename: file });
  });
  return window;
}

function validate(window) {
  var problems = [];
  var sprites  = window.SPRITES || {};
  var meta     = window.SPRITE_GRID_META || {};
  var palettes = window.SPRITE_ANIMAL_PALETTES || {};

  Object.keys(sprites).sort().forEach(function (type) {
    var m = meta[type];
    if (!m) {
      problems.push(type + ": no SPRITE_GRID_META entry");
    } else {
      if (m.cols > 192 || m.rows > 128) { problems.push(type + ": " + m.cols + "×" + m.rows + " is over the 192×128 cap"); }
      if (!(m.legRowStart >= 0 && m.legRowStart < m.rows)) { problems.push(type + ": legRowStart " + m.legRowStart + " is outside " + m.rows + " rows"); }
    }

    var p = palettes[type];
    if (!p) {
      problems.push(type + ": no palette");
    } else {
      ["primary", "secondary", "accent"].forEach(function (k) {
        if (!HEX_RE.test(p[k] || "")) { problems.push(type + ": palette " + k + " is " + JSON.stringify(p[k])); }
      });
    }

    STAGES.forEach(function (stage) {
      if (!sprites[type][stage]) { problems.push(type + ": no " + stage + " grid"); }
    });

    Object.keys(sprites[type]).forEach(function (key) {
      var grid = sprites[type][key];
      if (m && grid.length !== m.rows) { problems.push(type + "/" + key + ": " + grid.length + " rows, meta says " + m.rows); }
      grid.forEach(function (row, r) {
        if (m && row.length !== m.cols) { problems.push(type + "/" + key + " row " + r + ": " + row.length + " cols, meta says " + m.cols); }
        if (row.some(function (v) { return !(Number.isInteger(v) && v >= 0 && v <= 5); })) {
          problems.push(type + "/" + key + " row " + r + ": colour index outside 0-5");
        }
      });
    });
  });
  return problems;
}

if (require.main === module) {
  var window = load();
  var problems = validate(window);
  var count = Object.keys(window.SPRITES || {}).length;
  if (problems.length) {
    problems.forEach(function (p) { console.error("✗ " + p); });
    console.error(problems.length + " problem(s) in " + count + " species");
    process.exitCode = 1;
  } else {
    console.log("✓ " + count + " species OK (" + FILES.join(", ") + ")");
  }
}

module.exports = { load: load, validate: validate };
