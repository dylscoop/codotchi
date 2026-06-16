// mirror_roo.js
// Horizontally mirrors all roo sprite row strings in a sprites.js file.
// Each pixel-data line looks like:  "0001110000..." //N
// We reverse the digit string between the outer quotes, leave everything else intact.
// Usage: node scripts/mirror_roo.js <path/to/sprites.js>

'use strict';
const fs   = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) { console.error('Usage: node mirror_roo.js <sprites.js>'); process.exit(1); }

const lines = fs.readFileSync(filePath, 'utf8').split('\n');

// State machine: track when we're inside a roo stage block
let insideRoo = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect start of a roo stage
  if (/DEFS\["roo"\]\["(?:baby|child|teen|adult|senior)"\]\s*=/.test(line) ||
      /DEFS\["roo"\]\s*=/.test(line) && /\["(?:baby|child|teen|adult|senior)"\]/.test(lines[i + 1] || '')) {
    insideRoo = true;
  }
  // Also detect the assignment lines: DEFS["roo"]["baby"] = [
  if (/DEFS\["roo"\]\["(?:baby|child|teen|adult|senior)"\]/.test(line)) {
    insideRoo = true;
  }

  // Detect end of stage block: a line that is just ]; (possibly with trailing comma/space)
  if (insideRoo && /^\s*\];\s*$/.test(line)) {
    insideRoo = false;
    continue;
  }

  // If inside a roo stage, reverse pixel strings
  if (insideRoo) {
    // Match a quoted all-digit string (the pixel row data)
    lines[i] = line.replace(/"([0-9]+)"/, (match, digits) => '"' + digits.split('').reverse().join('') + '"');
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Done: mirrored all roo rows in', path.basename(filePath));
