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
 *   1. Builds the single-file plugin bundle (dist-plugin/codotchi.js) if it is
 *      not already present, then copies it to the global plugin directory:
 *        dist-plugin/codotchi.js  → ~/.config/opencode/plugins/codotchi.js
 *
 *      OpenCode loads every file in ~/.config/opencode/plugins/ as a plugin.
 *      Shipping a single bundled file means only the real plugin is loaded;
 *      previous installs copied four loose helper .ts files into that directory
 *      which OpenCode also attempted to load as plugins, crashing the process.
 *
 *   2. Removes any stale helper files left behind by previous installs:
 *        ~/.config/opencode/plugins/codotchi.ts   (old entry point)
 *        ~/.config/opencode/plugins/gameEngine.ts
 *        ~/.config/opencode/plugins/asciiArt.ts
 *        ~/.config/opencode/plugins/statePathResolver.ts
 *
 *   3. Copies commands/codotchi.md → ~/.config/opencode/commands/codotchi.md
 *
 *   4. Creates or updates ~/.config/opencode/package.json to add the
 *      @opencode-ai/plugin dependency. OpenCode runs `bun install` on startup,
 *      so the dependency is resolved automatically.
 *
 * "~/.config" is resolved via XDG_CONFIG_HOME (if set) or os.homedir()/.config
 * — the same logic OpenCode itself uses on every platform, including Windows.
 */

const fs            = require("fs");
const path          = require("path");
const os            = require("os");
const { execSync }  = require("child_process");

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

// Single bundled plugin file — the only file that should live in plugins/
const bundleSrc  = path.join(__dirname, "..", "dist-plugin", "codotchi.js");
const bundleDest = path.join(pluginsDir, "codotchi.js");

// Stale files left behind by old installs (shipped four loose .ts helpers that
// OpenCode attempted to load as plugins, crashing the process).
const staleFiles = [
  path.join(pluginsDir, "codotchi.ts"),
  path.join(pluginsDir, "gameEngine.ts"),
  path.join(pluginsDir, "asciiArt.ts"),
  path.join(pluginsDir, "statePathResolver.ts"),
];

const configPkgDest = path.join(opencodeDir, "package.json");
const PLUGIN_DEP    = "@opencode-ai/plugin";
const PLUGIN_VER    = "1.2.27";   // must match opencode-codotchi/package.json

let anyError = false;

// ── Step 0: Always rebuild the bundle from source ────────────────────────────
// Never skip: a stale bundle from a previous version would be installed
// silently, defeating the purpose of the install step.

console.log("Building dist-plugin/codotchi.js from source...");
try {
  execSync("node scripts/bundle-plugin.js", {
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });
} catch (err) {
  console.error(`Failed to build bundle: ${err.message}`);
  console.error("Run: node scripts/bundle-plugin.js  (requires bun on PATH)");
  anyError = true;
}

if (!fs.existsSync(bundleSrc)) {
  console.error(`Bundle still missing after build attempt: ${bundleSrc}`);
  process.exit(1);
}

// ── Step 1: Install /codotchi slash command ───────────────────────────────────

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

// ── Step 2: Remove stale plugin files from previous installs ─────────────────

if (!fs.existsSync(pluginsDir)) {
  fs.mkdirSync(pluginsDir, { recursive: true });
  console.log(`Created directory: ${pluginsDir}`);
}

for (const stale of staleFiles) {
  if (fs.existsSync(stale)) {
    try {
      fs.rmSync(stale);
      console.log(`Removed stale plugin file: ${stale}`);
    } catch (err) {
      console.error(`Failed to remove stale file ${path.basename(stale)}: ${err.message}`);
      anyError = true;
    }
  }
}

// ── Step 3: Install the single bundled plugin file ────────────────────────────

try {
  fs.copyFileSync(bundleSrc, bundleDest);
  console.log(`Installed plugin bundle:  ${bundleDest}`);
} catch (err) {
  console.error(`Failed to install plugin bundle: ${err.message}`);
  anyError = true;
}

// ── Step 4: Add @opencode-ai/plugin to ~/.config/opencode/package.json ────────

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

if (pkg.dependencies[PLUGIN_DEP] === PLUGIN_VER) {
  console.log(`Dependency already at correct version: ${PLUGIN_DEP}@${PLUGIN_VER} — skipping.`);
} else {
  pkg.dependencies[PLUGIN_DEP] = PLUGIN_VER;
  try {
    fs.writeFileSync(configPkgDest, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    console.log(`Updated package.json:   ${configPkgDest}`);
    console.log(`  Set dependency: ${PLUGIN_DEP}@${PLUGIN_VER}`);
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
  console.log("Done! Restart OpenCode — the /codotchi plugin loads from the single bundle automatically.");
  console.log("On first startup, OpenCode installs plugin dependencies via bun.");
}
