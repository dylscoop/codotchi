/**
 * emojiMode.test.mjs
 *
 * End-to-end integration test for the statusline emoji mode: spawns
 * `node scripts/action.mjs emoji ...` as a real child process to set config,
 * then spawns `node scripts/statusline.mjs` and confirms it renders a single
 * moving-emoji line (no ANSI) instead of the multi-line ASCII block, matching
 * the active VS Code / PyCharm pet's creature.
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/)
 * so scripts/action.mjs and scripts/statusline.mjs can import
 * dist/gameEngine.js and dist/asciiArt.js.
 *
 * Run with:
 *   node --test tests/integration/emojiMode.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.join(__dirname, "..", "..", "scripts");
const distDir = path.join(__dirname, "..", "..", "dist");
const actionScript = path.join(scriptsDir, "action.mjs");
const statuslineScript = path.join(scriptsDir, "statusline.mjs");

async function withRunFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-emoji-test-"));
  try {
    await fn(tmpBase);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

function baseEnv(tmpBase, extra = {}) {
  return {
    ...process.env,
    APPDATA: tmpBase,
    HOME: tmpBase,
    USERPROFILE: tmpBase,
    CLAUDE_PLUGIN_DATA: path.join(tmpBase, "claude-plugin-data"),
    CLAUDE_CODE_SESSION_ID: "",
    ...extra,
  };
}

function runAction(tmpBase, ...args) {
  return execFileSync("node", [actionScript, ...args], { env: baseEnv(tmpBase), encoding: "utf8" });
}

function runStatusline(tmpBase, { columns } = {}) {
  return execFileSync("node", [statuslineScript], {
    env: baseEnv(tmpBase, columns ? { COLUMNS: String(columns) } : {}),
    input: JSON.stringify({ session_id: "test" }),
    encoding: "utf8",
  });
}

function configPath(tmpBase) {
  return path.join(tmpBase, "claude-plugin-data", "codotchi-config.json");
}

/** Writes an IDE state.json for `ide` ("vscode" | "pycharm"), with a controllable mtime. */
function writeIDEState(tmpBase, ide, state, { mtimeMs } = {}) {
  const dir = path.join(tmpBase, "codotchi", ide);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "state.json");
  fs.writeFileSync(filePath, JSON.stringify({ state, savedAt: Date.now() }), "utf8");
  if (mtimeMs !== undefined) {
    const t = new Date(mtimeMs);
    fs.utimesSync(filePath, t, t);
  }
  return filePath;
}

describe("/codotchi emoji — config persistence (integration)", () => {
  it("pins a specific emoji and switches statuslineMode to emoji", async () => {
    await withRunFixture(async (tmpBase) => {
      const output = runAction(tmpBase, "emoji", "🐸");
      assert.match(output, /Statusline emoji set to 🐸/);
      const cfg = JSON.parse(fs.readFileSync(configPath(tmpBase), "utf8"));
      assert.equal(cfg.statuslineMode, "emoji");
      assert.equal(cfg.statuslineEmoji, "🐸");
    });
  });

  it("auto clears any pinned emoji but keeps emoji mode on", async () => {
    await withRunFixture(async (tmpBase) => {
      runAction(tmpBase, "emoji", "🐸");
      const output = runAction(tmpBase, "emoji", "auto");
      assert.match(output, /auto-match/);
      const cfg = JSON.parse(fs.readFileSync(configPath(tmpBase), "utf8"));
      assert.equal(cfg.statuslineMode, "emoji");
      assert.equal(cfg.statuslineEmoji, null);
    });
  });

  it("off switches back to the full ASCII pet", async () => {
    await withRunFixture(async (tmpBase) => {
      runAction(tmpBase, "emoji", "auto");
      const output = runAction(tmpBase, "emoji", "off");
      assert.match(output, /full ASCII pet/);
      const cfg = JSON.parse(fs.readFileSync(configPath(tmpBase), "utf8"));
      assert.equal(cfg.statuslineMode, "full");
    });
  });

  it("with no argument, shows usage without changing the current mode", async () => {
    await withRunFixture(async (tmpBase) => {
      runAction(tmpBase, "emoji", "🐸");
      const before = JSON.parse(fs.readFileSync(configPath(tmpBase), "utf8"));
      const output = runAction(tmpBase, "emoji");
      assert.match(output, /Usage: \/codotchi emoji/);
      const after = JSON.parse(fs.readFileSync(configPath(tmpBase), "utf8"));
      assert.deepEqual(after.statuslineMode, before.statuslineMode);
      assert.deepEqual(after.statuslineEmoji, before.statuslineEmoji);
    });
  });
});

describe("statusline.mjs — emoji mode rendering (integration)", () => {
  it("renders a single moving-emoji line matching the active VS Code pet, with no ANSI", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      // Fresh pets always start at stage "egg" (see gameEngine.ts createPet) — advance
      // past it here so the emoji reflects spriteType rather than the egg override.
      const pet = { ...ge.createPet("DragonBuddy", "codeling", "dragon"), stage: "adult" };
      writeIDEState(tmpBase, "vscode", ge.serialiseState(pet), { mtimeMs: 2_000_000 });

      runAction(tmpBase, "emoji", "auto");
      const output = runStatusline(tmpBase, { columns: 40 }).replace(/\r?\n$/, "");

      assert.doesNotMatch(output, /\x1b/, "emoji mode output must not contain ANSI escape codes");
      assert.match(output, /^DragonBuddy {1,}🐉$/, "expected the pet's name before a space-padded dragon emoji");
    });
  });

  it("shows an egg emoji for a freshly-created pet regardless of its spriteType", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      const pet = ge.createPet("EggBuddy", "codeling", "dragon"); // stage defaults to "egg"
      writeIDEState(tmpBase, "vscode", ge.serialiseState(pet), { mtimeMs: 2_000_000 });

      runAction(tmpBase, "emoji", "auto");
      const output = runStatusline(tmpBase, { columns: 40 }).replace(/\r?\n$/, "");
      assert.match(output, /^EggBuddy {1,}🥚$/);
    });
  });

  it("labels and shows the other IDE's pet when two different IDE pets are both live", async () => {
    // Whichever of VS Code/PyCharm is most recently modified becomes the "anchor" pet
    // that Claude Code's own local slot mirrors (see resolveCanonicalPetPath in
    // state.mjs). The statusline's IDE-peek loop only ever renders the *other*
    // IDE(s) — this is existing behaviour shared with the full ASCII mode, not new
    // to emoji mode: with two distinct live IDE pets, only the peeked one is shown.
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      const vsPet = { ...ge.createPet("VSPet", "codeling", "dragon"), stage: "adult" };
      const pyPet = { ...ge.createPet("PyPet", "codeling", "cat"), stage: "adult" };
      writeIDEState(tmpBase, "vscode", ge.serialiseState(vsPet), { mtimeMs: 3_000_000 }); // newer -> anchor
      writeIDEState(tmpBase, "pycharm", ge.serialiseState(pyPet), { mtimeMs: 1_000_000 });

      runAction(tmpBase, "emoji", "auto");
      const output = runStatusline(tmpBase, { columns: 40 }).replace(/\r?\n$/, "");
      const lines = output.split("\n");

      assert.equal(lines.length, 1, `expected exactly 1 line, got: ${JSON.stringify(lines)}`);
      assert.match(lines[0], /^\[PyCharm\] PyPet {1,}🐱$/, "the peeked (PyCharm) pet's line should carry its IDE label and name");
    });
  });

  it("respects a pinned emoji override even when a pet is present", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      const pet = ge.createPet("DragonBuddy", "codeling", "dragon");
      writeIDEState(tmpBase, "vscode", ge.serialiseState(pet), { mtimeMs: 2_000_000 });

      runAction(tmpBase, "emoji", "🐸");
      const output = runStatusline(tmpBase, { columns: 40 }).replace(/\r?\n$/, "");
      assert.match(output, /^DragonBuddy {1,}🐸$/, "pinned override should win over the pet's own dragon spriteType, name still shown");
    });
  });

  it("falls back to the full ASCII block when emoji mode is off", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      const pet = ge.createPet("DragonBuddy", "codeling", "dragon");
      writeIDEState(tmpBase, "vscode", ge.serialiseState(pet), { mtimeMs: 2_000_000 });

      runAction(tmpBase, "emoji", "off");
      const output = runStatusline(tmpBase, { columns: 40 });
      assert.match(output, /\x1b/, "full mode should still contain ANSI colour codes");
    });
  });
});
