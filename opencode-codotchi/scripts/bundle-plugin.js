#!/usr/bin/env node
/**
 * scripts/bundle-plugin.js
 *
 * Bundles the opencode-codotchi plugin source into a single self-contained
 * ESM file suitable for direct deployment into OpenCode's plugin directory.
 *
 * WHY BUNDLE?
 *   OpenCode loads every file in ~/.config/opencode/plugins/ as a plugin and
 *   invokes every exported value as a plugin function.  Shipping the four
 *   helper modules (gameEngine, asciiArt, statePathResolver) as separate files
 *   alongside the entry point caused them to be treated as independent plugins,
 *   which threw "Plugin export is not a function" on every startup and then
 *   crashed the config-hook loop with "undefined is not an object".
 *
 *   Bundling inlines all helpers into one file so the installer copies exactly
 *   ONE file into the plugins directory.
 *
 * OUTPUT
 *   dist-plugin/codotchi.js  — single ESM bundle (~90 KB)
 *
 * EXTERNAL PACKAGES
 *   @opencode-ai/plugin and @opencode-ai/sdk are kept external; OpenCode
 *   provides them in its own module resolution context at runtime.
 *
 * USAGE
 *   node scripts/bundle-plugin.js          # from opencode-codotchi/
 *   bun scripts/bundle-plugin.js           # also works
 *
 * The output file is gitignored (listed in .gitignore alongside dist/).
 * bin/install.js builds the bundle automatically if the file is missing.
 */

const { execSync } = require("child_process");
const fs   = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const outDir  = path.join(rootDir, "dist-plugin");
const outFile = path.join(outDir, "codotchi.js");
const entry   = path.join(rootDir, "src", "index.ts");

// ── Ensure output directory exists ───────────────────────────────────────────

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// ── Run Bun bundler ───────────────────────────────────────────────────────────

const cmd = [
  "bun build",
  `"${entry}"`,
  "--target=node",
  "--format=esm",
  "--external @opencode-ai/plugin",
  "--external @opencode-ai/sdk",
  `--outfile "${outFile}"`,
].join(" ");

console.log("Bundling opencode-codotchi plugin...");
console.log(`  Entry : ${entry}`);
console.log(`  Output: ${outFile}`);
console.log(`  Cmd   : ${cmd}`);

try {
  execSync(cmd, { cwd: rootDir, stdio: "inherit" });
} catch (err) {
  console.error("Bundle failed:", err.message);
  process.exit(1);
}

// ── Verify output exists and is non-empty ─────────────────────────────────────

if (!fs.existsSync(outFile)) {
  console.error(`Bundle output not found at: ${outFile}`);
  process.exit(1);
}

const size = fs.statSync(outFile).size;
if (size < 1000) {
  console.error(`Bundle output is suspiciously small (${size} bytes): ${outFile}`);
  process.exit(1);
}

console.log(`\nBundle complete: ${outFile} (${(size / 1024).toFixed(1)} KB)`);
