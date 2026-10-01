#!/usr/bin/env node
/**
 * sync-core.mjs — copy the shared TypeScript core into every plugin.
 *
 * packages/core/src/ is the only place to edit gameEngine.ts and asciiArt.ts.
 * This script writes a copy (with a "do not edit" header) into each plugin's
 * src/ so every plugin keeps its own tsc / bun / esbuild setup unchanged.
 *
 * Usage:
 *   node scripts/sync-core.mjs          write the copies
 *   node scripts/sync-core.mjs --check  exit 1 if any copy is out of date
 *
 * Each plugin's package.json runs this automatically before build/test.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const coreDir = path.join(root, "packages", "core", "src");

/** core file -> plugin src/ folders that get a copy */
const TARGETS = {
  "gameEngine.ts": ["vscode", "opencode-codotchi", "claude-codotchi", "claude-desktop-codotchi"],
  "asciiArt.ts":   ["opencode-codotchi", "claude-codotchi", "claude-desktop-codotchi"],
};

const check = process.argv.includes("--check");
const stale = [];

for (const [file, plugins] of Object.entries(TARGETS)) {
  const source = fs.readFileSync(path.join(coreDir, file), "utf8").replace(/\r\n/g, "\n");
  const header =
    `// GENERATED from packages/core/src/${file} by scripts/sync-core.mjs — do not edit here.\n` +
    `// Edit packages/core/src/${file}, then run: node scripts/sync-core.mjs\n`;
  const expected = header + source;

  for (const plugin of plugins) {
    const dest = path.join(root, plugin, "src", file);
    const current = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8").replace(/\r\n/g, "\n") : null;
    if (current === expected) continue;
    if (check) {
      stale.push(path.relative(root, dest));
    } else {
      fs.writeFileSync(dest, expected, "utf8");
      console.log(`sync-core: wrote ${path.relative(root, dest)}`);
    }
  }
}

if (check && stale.length > 0) {
  console.error("sync-core: these copies are out of date with packages/core/src:");
  for (const f of stale) console.error(`  ${f}`);
  console.error("Run: node scripts/sync-core.mjs");
  process.exit(1);
}
