/**
 * whimCalls.test.mjs
 *
 * End-to-end integration test for the terminal side of the play / pat /
 * craving attention calls: spawns `node scripts/action.mjs <action>` against a
 * fake VS Code state file whose pet has an active call, then reads the state
 * file back to check the call was answered.
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/)
 * so scripts/action.mjs can import dist/gameEngine.js and dist/asciiArt.js.
 *
 * Run with:
 *   node --test tests/integration/whimCalls.test.mjs
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
const actionScript = path.join(scriptsDir, "action.mjs");
const { WHIM_ANSWER_SPEECH } = await import(pathToFileURL(path.join(scriptsDir, "whimSpeech.mjs")).href);

/** Assert the (whitespace-collapsed) output contains one of the answered-call lines for `call`. */
function assertWhimSpeech(output, call) {
  const lines = WHIM_ANSWER_SPEECH[call].map((l) => l.replace(/[\s\\/|]+/g, " "));
  assert.ok(lines.some((l) => output.includes(l)), `expected a ${call} answer line in: ${output}`);
}

async function withRunFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-whim-test-"));
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

async function petWithCall(overrides) {
  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  const pet = { ...ge.createPet("WhimBuddy", "codeling"), energy: 80, hunger: 60, happiness: 60, ...overrides };
  return ge.serialiseState(pet);
}

describe("action.mjs play / snack — answering whim calls (integration)", () => {
  it("/codotchi play answers an active play call", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await petWithCall({ activeAttentionCall: "play" }));
      const output = runAction(tmpBase, "play");
      assertWhimSpeech(output, "play");
      const saved = readVSCodeState(tmpBase);
      assert.equal(saved.activeAttentionCall, null);
      assert.equal(saved.attentionCallCooldowns.play, 100);
    });
  });

  it("/codotchi snack answers a snack craving and eats the snack", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await petWithCall({ activeAttentionCall: "craving", cravingFood: "snack" }));
      const output = runAction(tmpBase, "snack");
      assertWhimSpeech(output, "craving");
      const saved = readVSCodeState(tmpBase);
      assert.equal(saved.activeAttentionCall, null);
      assert.equal(saved.cravingFood, null);
      assert.equal(saved.snacksOnFloor, 0, "eaten straight away in the terminal");
      assert.ok(saved.hunger > 60);
    });
  });

  it("/codotchi pat answers an active pat call with pat speech", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await petWithCall({ activeAttentionCall: "pat" }));
      const output = runAction(tmpBase, "pat");
      assertWhimSpeech(output, "pat");
      assert.equal(readVSCodeState(tmpBase).activeAttentionCall, null);
    });
  });

  it("/codotchi feed answers a meal craving with craving speech", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await petWithCall({ activeAttentionCall: "craving", cravingFood: "meal" }));
      const output = runAction(tmpBase, "feed");
      assertWhimSpeech(output, "craving");
      assert.equal(readVSCodeState(tmpBase).activeAttentionCall, null);
    });
  });

  it("/codotchi snack leaves a meal craving open", async () => {
    await withRunFixture(async (tmpBase) => {
      writeVSCodeState(tmpBase, await petWithCall({ activeAttentionCall: "craving", cravingFood: "meal" }));
      runAction(tmpBase, "snack");
      const saved = readVSCodeState(tmpBase);
      assert.equal(saved.activeAttentionCall, "craving");
      assert.equal(saved.cravingFood, "meal");
    });
  });
});
