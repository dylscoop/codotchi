"use strict";
/**
 * validate_sprites.js — verify that every row string in gen_sprites.js output
 * has the correct width for its spriteType.
 *
 * Uses SPRITE_GRID_META from spriteConstants.js where available, so that
 * v2 variable-grid sprites (and the fixed 'tim' type) are handled correctly.
 * Falls back to the legacy 32/48 heuristic for any unregistered type.
 */
var child_process = require('child_process');
var fs   = require('fs');
var path = require('path');

// Load SPRITE_GRID_META from spriteConstants.js by extracting the object literal.
// This avoids eval() — we parse the known static structure directly.
var SPRITE_GRID_META = null;
try {
  var constPath = path.join(__dirname, '..', 'vscode', 'media', 'spriteConstants.js');
  var constSrc  = fs.readFileSync(constPath, 'utf8');
  // Extract the SPRITE_GRID_META object literal
  var metaMatch = constSrc.match(/var SPRITE_GRID_META\s*=\s*\{([\s\S]*?)\};/);
  if (metaMatch) {
    SPRITE_GRID_META = {};
    var entryRe = /(\w+)\s*:\s*\{\s*cols\s*:\s*(\d+)\s*,\s*rows\s*:\s*(\d+)\s*,\s*legRowStart\s*:\s*(\d+)\s*\}/g;
    var em;
    while ((em = entryRe.exec(metaMatch[1])) !== null) {
      SPRITE_GRID_META[em[1]] = { cols: parseInt(em[2]), rows: parseInt(em[3]), legRowStart: parseInt(em[4]) };
    }
  }
} catch (e) {
  // spriteConstants.js unavailable — fall back to legacy heuristic only
}

// Legacy upright types (includes tim, which the old validator was missing)
var legacyUprightTypes = { classic: 1, monkey: 1, rooster: 1, dragon: 1, tim: 1 };

function expectedColsForType(spriteType) {
  if (SPRITE_GRID_META && SPRITE_GRID_META[spriteType]) {
    return SPRITE_GRID_META[spriteType].cols;
  }
  // Fallback
  return legacyUprightTypes[spriteType] ? 32 : 48;
}

var lines = child_process.execSync('node scripts/gen_sprites.js', {cwd: __dirname + '/..'}).toString().split('\n');
var currentType = null;
var errors = [];

lines.forEach(function(line, i) {
  var tm = line.match(/DEFS\["(\w+)"\]/);
  if (tm) { currentType = tm[1]; }

  var m = line.match(/^\s+"([0-9]+)"[,]?\/\/(\d+)$/);
  if (!m) { return; }

  var row    = m[1];
  var rowNum = parseInt(m[2]);
  var expected = expectedColsForType(currentType);

  if (row.length !== expected) {
    errors.push('Line ' + (i + 1) + ' type=' + currentType + ' row=' + rowNum +
                ' len=' + row.length + ' expected=' + expected);
  }
});

if (errors.length === 0) {
  console.log('ALL ROWS VALID (' + lines.length + ' lines)');
} else {
  errors.forEach(function(e) { console.log(e); });
  process.exit(1);
}
