/**
 * idleReplay.test.mjs
 *
 * End-to-end integration test for BUG-S02: when statusline.mjs replays
 * elapsed ticks on an IDE-anchored pet, it must pass through the IDE's own
 * idle flag (the raw `wasIdle` / `wasDeepIdle` in the shared state file)
 * instead of always ticking as "active", so a pet whose owner is away from
 * the IDE never loses health via a Claude Code replay.
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/)
 * so scripts/statusline.mjs can import dist/gameEngine.js and dist/asciiArt.js.
 *
 * Run with:
 *   node --test tests/integration/idleReplay.test.mjs
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

/** Where state.mjs looks for IDE pets under the test HOME / APPDATA: APPDATA on Windows, ~/.config elsewhere. */
function ideBase(tmpBase) {
  return process.platform === "win32" ? tmpBase : path.join(tmpBase, ".config");
}
const scriptsDir = path.join(__dirname, "..", "..", "scripts");
const distDir = path.join(__dirname, "..", "..", "dist");
const statuslineScript = path.join(scriptsDir, "statusline.mjs");

/** 30 ticks ago — enough to replay ticks, below the 60-tick offline-decay cut-over. */
const ELAPSED_MS = 30 * 3 * 1000;

async function withRunFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-idle-test-"));
  try {
    await fn(tmpBase);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

function vsStatePath(tmpBase) {
  return path.join(ideBase(tmpBase), "codotchi", "vscode", "state.json");
}

function writeVSCodeState(tmpBase, state) {
  fs.mkdirSync(path.dirname(vsStatePath(tmpBase)), { recursive: true });
  fs.writeFileSync(vsStatePath(tmpBase), JSON.stringify({ state, savedAt: Date.now() - ELAPSED_MS }), "utf8");
}

function runStatusline(tmpBase) {
  const env = {
    ...process.env,
    APPDATA: tmpBase,
    HOME: tmpBase,
    USERPROFILE: tmpBase,
    CLAUDE_PLUGIN_DATA: path.join(tmpBase, "claude-plugin-data"),
    CODOTCHI_NO_RANK: "1", // no network: the rank line depends on the live leaderboard
    CLAUDE_CODE_SESSION_ID: "",
  };
  execFileSync("node", [statuslineScript], { env, encoding: "utf8", input: "{}" });
}

async function sickPetSerialised(ge, wasIdle) {
  const pet = { ...ge.createPet("IdleBuddy", "codeling"), sick: true, health: 80, hunger: 80, happiness: 80 };
  return { ...ge.serialiseState(pet), wasIdle };
}

describe("statusline.mjs tick replay — IDE idle flag (integration, BUG-S02)", () => {
  it("does not damage an IDE-anchored sick pet whose IDE reported the user as idle", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      writeVSCodeState(tmpBase, await sickPetSerialised(ge, true));

      runStatusline(tmpBase);

      const saved = JSON.parse(fs.readFileSync(vsStatePath(tmpBase), "utf8")).state;
      assert.equal(saved.health, 80, `health should be unchanged while the IDE is idle (got ${saved.health})`);
      assert.equal(saved.sick, true);
    });
  });

  it("control: the same pet does take sickness damage when the IDE reported the user as active", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      writeVSCodeState(tmpBase, await sickPetSerialised(ge, false));

      runStatusline(tmpBase);

      const saved = JSON.parse(fs.readFileSync(vsStatePath(tmpBase), "utf8")).state;
      assert.ok(saved.health < 80, `health should drop while active (got ${saved.health})`);
    });
  });
});
