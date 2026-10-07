/**
 * statuslineCalls.test.mjs
 *
 * End-to-end test for attention calls in the Claude Code status line: writes a
 * VS Code pet with an active call, spawns `node scripts/statusline.mjs` and
 * checks that the call shows in each display mode (speech bubble, emoji,
 * plain status block).
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/).
 *
 * Run with:
 *   node --test tests/integration/statuslineCalls.test.mjs
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

/** Where state.mjs looks for IDE pets: APPDATA on Windows, ~/.config elsewhere. */
function ideBase(tmpBase) {
  return process.platform === "win32" ? tmpBase : path.join(tmpBase, ".config");
}

function baseEnv(tmpBase) {
  return {
    ...process.env,
    APPDATA: tmpBase,
    HOME: tmpBase,
    USERPROFILE: tmpBase,
    CLAUDE_PLUGIN_DATA: path.join(tmpBase, "claude-plugin-data"),
    CLAUDE_CODE_SESSION_ID: "",
    CODOTCHI_NO_RANK: "1",
  };
}

function runAction(tmpBase, ...args) {
  return execFileSync("node", [actionScript, ...args], { env: baseEnv(tmpBase), encoding: "utf8" });
}

function runStatusline(tmpBase) {
  return execFileSync("node", [statuslineScript], {
    env: { ...baseEnv(tmpBase), COLUMNS: "60" },
    input: JSON.stringify({ session_id: "test" }),
    encoding: "utf8",
  });
}

async function withPetCalling(call, extra, fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-calls-test-"));
  try {
    const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
    const pet = { ...ge.createPet("Caller", "codeling", "dog"), stage: "adult", activeAttentionCall: call, ...extra };
    const dir = path.join(ideBase(tmpBase), "codotchi", "vscode");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "state.json"),
      JSON.stringify({ state: ge.serialiseState(pet), savedAt: Date.now() }), "utf8");
    await fn(tmpBase);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("statusline.mjs — attention calls (integration)", () => {
  it("speech-bubble mode: the call phrase replaces the usual speech, with a ⚠", async () => {
    await withPetCalling("pat", {}, async (tmpBase) => {
      const output = stripAnsi(runStatusline(tmpBase));
      assert.match(output, /⚠ Caller/);
      assert.match(output.replace(/\s+/g, " "), /(I want a pat!|Pat me\? Pretty please!|A little pat would be nice\.)/);
    });
  });

  it("emoji mode: the line says what the pet wants", async () => {
    await withPetCalling("pat", {}, async (tmpBase) => {
      runAction(tmpBase, "emoji", "auto");
      const output = runStatusline(tmpBase).replace(/\r?\n$/, "");
      assert.match(output, /^Caller ⚠ wants a pat {1,}🐶$/);
    });
  });

  it("plain mode: adds a ⚠ line with the command that answers it", async () => {
    await withPetCalling("craving", { cravingFood: "snack" }, async (tmpBase) => {
      runAction(tmpBase, "off");
      const output = runStatusline(tmpBase);
      assert.match(output, /⚠ Caller wants a snack \(\/codotchi snack\)/);
    });
  });

  it("plain mode: a call that can't be answered in the terminal points to the IDE", async () => {
    await withPetCalling("gift", {}, async (tmpBase) => {
      runAction(tmpBase, "off");
      const output = runStatusline(tmpBase);
      assert.match(output, /⚠ Caller wants praise \(gift\) \(answer in the IDE\)/);
    });
  });

  it("no ⚠ when there is no active call", async () => {
    await withPetCalling(null, {}, async (tmpBase) => {
      runAction(tmpBase, "emoji", "auto");
      assert.doesNotMatch(runStatusline(tmpBase), /⚠/);
    });
  });
});
