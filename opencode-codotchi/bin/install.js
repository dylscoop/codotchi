#!/usr/bin/env node
/**
 * bin/install.js
 *
 * CLI installer for opencode-codotchi.
 *
 * Usage:
 *   npx opencode-codotchi --install
 *
 * What it does:
 *   1. Copies commands/codotchi.md → ~/.config/opencode/commands/codotchi.md
 *      (Windows: %APPDATA%\opencode\commands\codotchi.md)
 *
 *   2. Copies config/opencode.json → ~/.config/opencode/opencode.json
 *      (Windows: %APPDATA%\opencode\opencode.json)
 *      ONLY if the destination does not already exist — never overwrites.
 *
 * Both steps are required once per machine so the /codotchi slash command and
 * the plugin registration are available in all OpenCode projects.
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const args = process.argv.slice(2);

if (!args.includes("--install")) {
  console.log("opencode-codotchi");
  console.log("");
  console.log("Usage:");
  console.log("  npx opencode-codotchi --install   Install /codotchi slash command and OpenCode config globally");
  process.exit(0);
}

// Determine OpenCode global config directory
const configBase =
  process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");

const opencodeDir  = path.join(configBase, "opencode");
const commandsDir  = path.join(opencodeDir, "commands");
const commandDest  = path.join(commandsDir, "codotchi.md");
const commandSrc   = path.join(__dirname, "..", "commands", "codotchi.md");
const configDest   = path.join(opencodeDir, "opencode.json");
const configSrc    = path.join(__dirname, "..", "config", "opencode.json");

let anyError = false;

// ── Step 1: Install /codotchi slash command ──────────────────────────────────

if (!fs.existsSync(commandsDir)) {
  fs.mkdirSync(commandsDir, { recursive: true });
  console.log(`Created directory: ${commandsDir}`);
}

try {
  fs.copyFileSync(commandSrc, commandDest);
  console.log(`Installed slash command: ${commandDest}`);
} catch (err) {
  console.error(`Failed to install slash command: ${err.message}`);
  anyError = true;
}

// ── Step 2: Install opencode.json (skip if already exists) ──────────────────

if (fs.existsSync(configDest)) {
  console.log(`Skipped opencode.json — already exists: ${configDest}`);
  console.log(`  (Add "opencode-codotchi" to the "plugin" array manually if needed.)`);
} else {
  // Ensure the opencode directory exists (commandsDir mkdir above covers this,
  // but guard in case the commands step errored and we still want to try.)
  if (!fs.existsSync(opencodeDir)) {
    fs.mkdirSync(opencodeDir, { recursive: true });
  }
  try {
    fs.copyFileSync(configSrc, configDest);
    console.log(`Installed OpenCode config: ${configDest}`);
  } catch (err) {
    console.error(`Failed to install opencode.json: ${err.message}`);
    anyError = true;
  }
}

// ── Done ─────────────────────────────────────────────────────────────────────

console.log("");
if (anyError) {
  console.error("Installation completed with errors. See above for details.");
  process.exit(1);
} else {
  console.log("Done! The /codotchi slash command is now available globally in OpenCode.");
  console.log("The plugin will be downloaded automatically by OpenCode on next startup.");
}
