#!/usr/bin/env node
/**
 * scripts/package.js
 *
 * Creates the distributable zip for claude-codotchi.
 *
 * Output: claude-codotchi/claude-codotchi-X.Y.Z.zip
 *
 * The zip contains a top-level folder named claude-codotchi-X.Y.Z/ with:
 *   dist/              ← compiled JS (gameEngine.js, asciiArt.js + maps)
 *   scripts/           ← all .mjs runtime scripts + build.js
 *   commands/codotchi.md
 *   hooks/
 *   .claude-plugin/plugin.json
 *   settings.json
 *   install.ps1        ← prints /plugin commands for Windows
 *   install.sh         ← prints /plugin commands for macOS/Linux
 *   INSTALL.md         ← installation guide
 *
 * Usage (run from claude-codotchi/):
 *   node scripts/package.js
 */

import fs           from "fs";
import path         from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const pkg     = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const version = pkg.version;
const zipName = `claude-codotchi-${version}.zip`;
const rootDir = path.resolve(__dirname, "..");
const outPath = path.join(rootDir, zipName);

// ── Verify dist/ exists ───────────────────────────────────────────────────────

const distDir = path.join(rootDir, "dist");
if (!fs.existsSync(distDir) || !fs.existsSync(path.join(distDir, "gameEngine.js"))) {
  console.log("dist/ missing or incomplete — building first...");
  execSync("node scripts/build.js", { cwd: rootDir, stdio: "inherit" });
}

if (!fs.existsSync(path.join(distDir, "gameEngine.js"))) {
  console.error("Build failed: dist/gameEngine.js not found.");
  process.exit(1);
}

// ── Items to stage ────────────────────────────────────────────────────────────

const includes = [
  "dist",
  "scripts",
  "commands",
  "hooks",
  ".claude-plugin",
  "settings.json",
  "install.ps1",
  "install.sh",
  "INSTALL.md",
];

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
const stageDir  = path.join(stageRoot, `claude-codotchi-${version}`);

if (fs.existsSync(stageRoot)) fs.rmSync(stageRoot, { recursive: true });
fs.mkdirSync(stageDir, { recursive: true });

for (const item of includes) {
  const src  = path.join(rootDir, item);
  const dest = path.join(stageDir, item);
  if (!fs.existsSync(src)) {
    console.warn(`Warning: staged item not found, skipping: ${src}`);
    continue;
  }
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
  const ps1Path = path.join(stageRoot, "compress.ps1");
  fs.writeFileSync(ps1Path,
    `Compress-Archive -Path "${stageDir}" -DestinationPath "${outPath}" -Force\n`
  );
  execSync(`powershell -ExecutionPolicy Bypass -File "${ps1Path}"`, { stdio: "inherit" });
} else {
  execSync(
    `zip -r "${outPath}" "claude-codotchi-${version}"`,
    { cwd: stageRoot, stdio: "inherit" }
  );
}

// ── Clean up staging dir ──────────────────────────────────────────────────────

fs.rmSync(stageRoot, { recursive: true });

console.log(`\nCreated: ${zipName}`);
