#!/usr/bin/env node
/**
 * bin/install.js
 *
 * CLI installer for opencode-codotchi.
 *
 * Usage:
 *   node bin/install.js --install
 *   (or: npx opencode-codotchi --install  — once the package is published to npm)
 *
 * What it does:
 *   1. Copies commands/codotchi.md → ~/.config/opencode/commands/codotchi.md
 *      (XDG_CONFIG_HOME/opencode/commands/codotchi.md if XDG_CONFIG_HOME is set)
 *
 *   2. Copies the plugin TypeScript source files into the global plugin directory:
 *        src/index.ts      → ~/.config/opencode/plugins/codotchi.ts
 *        src/gameEngine.ts → ~/.config/opencode/plugins/gameEngine.ts
 *        src/asciiArt.ts   → ~/.config/opencode/plugins/asciiArt.ts
 *
 *      Files in ~/.config/opencode/plugins/ are loaded automatically by OpenCode
 *      on every startup — no "plugin" config entry needed.
 *
 *   3. Creates or updates ~/.config/opencode/package.json to add the
 *      @opencode-ai/plugin dependency. OpenCode runs `bun install` on startup,
 *      so the dependency is resolved automatically.
 *
 * "~/.config" is resolved via XDG_CONFIG_HOME (if set) or os.homedir()/.config
 * — the same logic OpenCode itself uses on every platform, including Windows.
 *
 * All three steps are required once per machine so the /codotchi slash command
 * and the plugin are available in every OpenCode project.
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const args = process.argv.slice(2);

if (!args.includes("--install")) {
  console.log("opencode-codotchi");
  console.log("");
  console.log("Usage:");
  console.log("  node bin/install.js --install   Install /codotchi slash command and plugin globally");
  process.exit(0);
}

// ── Config paths ─────────────────────────────────────────────────────────────
// Honour XDG_CONFIG_HOME if the user has set it (OpenCode uses the same logic).
// On Windows this resolves to C:\Users\<name>\.config, which is where OpenCode
// stores its config — NOT %APPDATA%.

const configBase = process.env["XDG_CONFIG_HOME"] ?? path.join(os.homedir(), ".config");

const opencodeDir = path.join(configBase, "opencode");
const commandsDir = path.join(opencodeDir, "commands");
const pluginsDir  = path.join(opencodeDir, "plugins");

const commandSrc  = path.join(__dirname, "..", "commands", "codotchi.md");
const commandDest = path.join(commandsDir, "codotchi.md");

const pluginFiles = [
  { src: path.join(__dirname, "..", "src", "index.ts"),      dest: path.join(pluginsDir, "codotchi.ts")   },
  { src: path.join(__dirname, "..", "src", "gameEngine.ts"), dest: path.join(pluginsDir, "gameEngine.ts") },
  { src: path.join(__dirname, "..", "src", "asciiArt.ts"),   dest: path.join(pluginsDir, "asciiArt.ts")   },
];

const configPkgDest = path.join(opencodeDir, "package.json");
const PLUGIN_DEP    = "@opencode-ai/plugin";
const PLUGIN_VER    = "1.2.27";

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

// ── Step 2: Install plugin source files ──────────────────────────────────────

if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
  console.log(`Created directory: ${pluginsDir}`);
}

for (const { src, dest } of pluginFiles) {
  try {
    fs.copyFileSync(src, dest);
    console.log(`Installed plugin file:  ${dest}`);
  } catch (err) {
    console.error(`Failed to install ${path.basename(dest)}: ${err.message}`);
    anyError = true;
  }
}

// ── Step 3: Add @opencode-ai/plugin to ~/.config/opencode/package.json ────────

let pkg = { dependencies: {} };

if (fs.existsSync(configPkgDest)) {
  try {
    pkg = JSON.parse(fs.readFileSync(configPkgDest, "utf8"));
    if (!pkg.dependencies) pkg.dependencies = {};
  } catch (err) {
    console.error(`Could not read existing package.json at ${configPkgDest}: ${err.message}`);
    anyError = true;
  }
}

if (pkg.dependencies[PLUGIN_DEP]) {
  console.log(`Dependency already present: ${PLUGIN_DEP} — skipping.`);
} else {
  pkg.dependencies[PLUGIN_DEP] = PLUGIN_VER;
  try {
    fs.writeFileSync(configPkgDest, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log(`Updated package.json:   ${configPkgDest}`);
    console.log(`  Added dependency: ${PLUGIN_DEP}@${PLUGIN_VER}`);
  } catch (err) {
    console.error(`Failed to update package.json: ${err.message}`);
    anyError = true;
  }
}

// ── Done ─────────────────────────────────────────────────────────────────────

console.log("");
if (anyError) {
  console.error("Installation completed with errors. See above for details.");
  process.exit(1);
} else {
  console.log("Done! Open any project in OpenCode — the /codotchi plugin loads automatically.");
  console.log("On first startup, OpenCode installs plugin dependencies via bun.");
}
