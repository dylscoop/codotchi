#!/usr/bin/env node
/**
 * bin/install.js
 *
 * CLI installer for the opencode-codotchi slash command.
 *
 * Usage:
 *   npx opencode-codotchi --install
 *
 * What it does:
 *   Copies commands/codotchi.md → ~/.config/opencode/commands/codotchi.md
 *   (Windows: %APPDATA%\opencode\commands\codotchi.md)
 *
 * This step is required once per machine so the /codotchi slash command is
 * available in all OpenCode projects, not just this repo.
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const args = process.argv.slice(2);

if (!args.includes("--install")) {
  console.log("opencode-codotchi");
  console.log("");
  console.log("Usage:");
  console.log("  npx opencode-codotchi --install   Install /codotchi slash command globally");
  console.log("");
  console.log("After installing, add the plugin to ~/.config/opencode/opencode.json:");
  console.log('  { "plugin": ["opencode-codotchi"] }');
  process.exit(0);
}

// Determine OpenCode global config directory
const configBase =
  process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");

const commandsDir = path.join(configBase, "opencode", "commands");
const dest        = path.join(commandsDir, "codotchi.md");
const src         = path.join(__dirname, "..", "commands", "codotchi.md");

// Ensure the commands directory exists
if (!fs.existsSync(commandsDir)) {
  fs.mkdirSync(commandsDir, { recursive: true });
  console.log(`Created directory: ${commandsDir}`);
}

// Copy the command file
try {
  fs.copyFileSync(src, dest);
  console.log(`Installed: ${dest}`);
  console.log("");
  console.log("Done! The /codotchi slash command is now available globally in OpenCode.");
  console.log("");
  console.log("Next step — add the plugin to ~/.config/opencode/opencode.json:");
  console.log('  { "plugin": ["opencode-codotchi"] }');
} catch (err) {
  console.error(`Failed to install: ${err.message}`);
  process.exit(1);
}
