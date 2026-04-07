#!/usr/bin/env node
/**
 * scripts/package.js
 *
 * Creates the distributable zip for opencode-codotchi.
 *
 * Output: opencode-codotchi/opencode-codotchi-X.Y.Z.zip
 *
 * The zip contains a top-level folder named opencode-codotchi-X.Y.Z/ with:
 *   bin/install.js
 *   commands/codotchi.md
 *   src/index.ts
 *   src/gameEngine.ts
 *   src/asciiArt.ts
 *   package.json
 *   README.md
 *
 * Usage (run from opencode-codotchi/):
 *   node scripts/package.js
 */

const fs             = require("fs");
const path           = require("path");
const { execSync }   = require("child_process");

const pkg     = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const version = pkg.version;
const zipName = `opencode-codotchi-${version}.zip`;
const rootDir = path.resolve(__dirname, "..");
const outPath = path.join(rootDir, zipName);

const includes = ["bin", "commands", "src", "package.json", "README.md"];

// ── Recursive directory copy ──────────────────────────────────────────────────
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

// ── Stage files ───────────────────────────────────────────────────────────────
const stageRoot = path.join(rootDir, `_stage_${version}`);
const stageDir  = path.join(stageRoot, `opencode-codotchi-${version}`);

if (fs.existsSync(stageRoot)) fs.rmSync(stageRoot, { recursive: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const item of includes) {
  const src  = path.join(rootDir, item);
  const dest = path.join(stageDir, item);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    copyDirSync(src, dest);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// ── Remove old zip if present ─────────────────────────────────────────────────
if (fs.existsSync(outPath)) {
  fs.rmSync(outPath);
  console.log(`Removed old: ${zipName}`);
}

// ── Create zip ────────────────────────────────────────────────────────────────
if (process.platform === "win32") {
  // Write a temp PS1 to avoid shell-quoting issues
  const ps1Path = path.join(stageRoot, "compress.ps1");
  fs.writeFileSync(ps1Path,
    `Compress-Archive -Path "${stageDir}" -DestinationPath "${outPath}" -Force\n`
  );
  execSync(`powershell -ExecutionPolicy Bypass -File "${ps1Path}"`, { stdio: "inherit" });
} else {
  execSync(
    `zip -r "${outPath}" "opencode-codotchi-${version}"`,
    { cwd: stageRoot, stdio: "inherit" }
  );
}

// ── Clean up staging dir ──────────────────────────────────────────────────────
fs.rmSync(stageRoot, { recursive: true });

console.log(`\nCreated: ${zipName}`);
