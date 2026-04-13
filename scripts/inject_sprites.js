"use strict";
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');

var root = path.join(__dirname, '..');
var spritesPath = path.join(root, 'vscode', 'media', 'sprites.js');

// Read current sprites.js
var content = fs.readFileSync(spritesPath, 'utf8');

// Find the start marker (the line "  DEFS["classic"] = {")
var startMarker = '  DEFS["classic"] = {';
// Find the end marker (the line "  };" after DEFS["snake"])
// Strategy: find DEFS["snake"], then find its closing "};"
var startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.error('START MARKER NOT FOUND'); process.exit(1); }

// Find the closing of DEFS["snake"] = { ... };
var snakeMarker = '  DEFS["snake"] = {';
var snakeIdx = content.indexOf(snakeMarker);
if (snakeIdx === -1) { console.error('SNAKE MARKER NOT FOUND'); process.exit(1); }

// After snake marker, find "  };" (closing of the snake DEFS entry)
var afterSnake = snakeIdx + snakeMarker.length;
var closingIdx = content.indexOf('\n  };', afterSnake);
if (closingIdx === -1) { console.error('CLOSING NOT FOUND'); process.exit(1); }
var endIdx = closingIdx + '\n  };'.length;

// Generate new DEFS content
var newDefs = child_process.execSync('node scripts/gen_sprites.js', {cwd: root}).toString();
// Remove trailing newline
newDefs = newDefs.replace(/\n$/, '');

// Rebuild
var newContent = content.slice(0, startIdx) + newDefs + content.slice(endIdx);

fs.writeFileSync(spritesPath, newContent, 'utf8');
console.log('sprites.js updated. New size:', newContent.length, 'chars,', newContent.split('\n').length, 'lines');
