/**
 * sickAndNap.test.mjs
 *
 * End-to-end integration test: feed / snack / play are refused while the pet is
 * sick (BUG-S04), and /codotchi wake is refused during a break nap. Spawns
 * `node scripts/action.mjs <action>` against a fake VS Code state file, then
 * reads the state file back.
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/)
 * so scripts/action.mjs can import dist/gameEngine.js and dist/asciiArt.js.
 *
 * Run with:
 *   node --test tests/integration/sickAndNap.test.mjs
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
const distDir = path.join(__dirname, "..", "..", "dist");
const actionScript = path.join(__dirname, "..", "..", "scripts", "action.mjs");

async function withRunFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-sicknap-test-"));
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
  fs.writeFileSync(vsStatePath(tmpBase), JSON.stringify({ state, savedAt: Date.now() }), "utf8");
}

function readVSCodeState(tmpBase) {
  return JSON.parse(fs.readFileSync(vsStatePath(tmpBase), "utf8")).state;
}

function runAction(tmpBase, action) {
  const env = {
    ...process.env,
    APPDATA: tmpBase,
    HOME: tmpBase,
    USERPROFILE: tmpBase,
    CLAUDE_PLUGIN_DATA: path.join(tmpBase, "claude-plugin-data"),
    CLAUDE_CODE_SESSION_ID: "",
  };
  const output = execFileSync("node", [actionScript, action], { env, encoding: "utf8" });
  // The speech bubble word-wraps; collapse whitespace and bubble borders so phrases match.
  return output.replace(/[\s\\/|]+/g, " ");
}

async function pet(overrides) {
  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  return ge.serialiseState({ ...ge.createPet("SickBuddy", "codeling"), energy: 80, hunger: 40, happiness: 60, ...overrides });
}

describe("action.mjs — sick pets refuse feed / snack / play (integration)", () => {
  for (const [action, phrase] of [["feed", "Too sick to eat"], ["snack", "Too sick for a snack"], ["play", "Too sick to play"]]) {
    it(`/codotchi ${action} is refused while sick`, async () => {
      await withRunFixture(async (tmpBase) => {
        writeVSCodeState(tmpBase, await pet({ sick: true }));
        const output = runAction(tmpBase, action);
        assert.ok(output.includes(phrase), `expected "${phrase}" in: ${output}`);
        const saved = readVSCodeState(tmpBase);
        assert.equal(saved.hunger, 40);
        assert.equal(saved.happiness, 60);
        assert.equal(saved.snacksOnFloor, 0);
      });
    });
  }

  it("/codotchi medicine counts the doses left", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await pet({ sick: true, medicineDosesGiven: 0 }));
      const output = runAction(tmpBase, "medicine");
      assert.ok(output.includes("Still recovering") && output.includes("more doses to go"), output);
      assert.equal(readVSCodeState(tmpBase).medicineDosesGiven, 1);
    });
  });
});

describe("action.mjs — break nap (integration)", () => {
  it("/codotchi wake is refused during a break nap", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await pet({ sleeping: true, breakNapTicksRemaining: 60 }));
      const output = runAction(tmpBase, "wake");
      assert.ok(output.includes("on a break nap"), output);
      const saved = readVSCodeState(tmpBase);
      assert.equal(saved.sleeping, true);
      assert.equal(saved.breakNapTicksRemaining, 60);
    });
  });

  it("/codotchi wake wakes a normally sleeping pet", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await pet({ sleeping: true, breakNapTicksRemaining: 0 }));
      const output = runAction(tmpBase, "wake");
      assert.ok(output.includes("Wakey wakey"), output);
      assert.equal(readVSCodeState(tmpBase).sleeping, false);
    });
  });
});
