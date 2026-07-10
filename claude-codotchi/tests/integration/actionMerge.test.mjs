/**
 * actionMerge.test.mjs
 *
 * End-to-end integration test for the IDE identity merge feature: spawns
 * `node scripts/action.mjs status` as a real child process against a fake
 * VS Code state file and confirms the merged pet's name surfaces in the
 * printed speech bubble output, instead of claude-codotchi's own separate
 * "Copilot" fallback pet.
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/)
 * so scripts/action.mjs can import dist/gameEngine.js and dist/asciiArt.js.
 *
 * Run with:
 *   node --test tests/integration/actionMerge.test.mjs
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

async function withRunFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-action-test-"));
  try {
    await fn(tmpBase);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

function writeVSCodeState(tmpBase, state) {
  const dir = path.join(tmpBase, "codotchi", "vscode");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ state, savedAt: Date.now() }), "utf8");
}

function runAction(tmpBase, action = "status") {
  const env = {
    ...process.env,
    APPDATA: tmpBase,
    HOME: tmpBase,
    USERPROFILE: tmpBase,
    CLAUDE_PLUGIN_DATA: path.join(tmpBase, "claude-plugin-data"),
    CLAUDE_CODE_SESSION_ID: "",
  };
  return execFileSync("node", [actionScript, action], { env, encoding: "utf8" });
}

describe("action.mjs status — IDE identity merge (integration)", () => {
  it("shows the VS Code pet's name instead of a separate local Copilot pet", async () => {
    await withRunFixture(async (tmpBase) => {
      const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
      const vsPet = ge.createPet("MergedBuddy", "codeling");
      writeVSCodeState(tmpBase, ge.serialiseState(vsPet));

      const output = runAction(tmpBase, "status");
      assert.match(output, /MergedBuddy/, "expected the merged VS Code pet's name to appear in the status output");
      assert.doesNotMatch(output, /Copilot/, "should not show the default local 'Copilot' fallback name once merged");
    });
  });

  it("falls back to creating a local 'Copilot' pet when no VS Code/PyCharm state exists", async () => {
    await withRunFixture(async (tmpBase) => {
      const output = runAction(tmpBase, "status");
      assert.match(output, /Copilot/, "expected the default local pet name when there is no IDE anchor");

      // Confirm the fresh local pet was never written anywhere discoverable by other IDEs.
      assert.equal(fs.existsSync(path.join(tmpBase, "codotchi", "vscode")), false);
      assert.equal(fs.existsSync(path.join(tmpBase, "codotchi", "pycharm")), false);
    });
  });
});
