/**
 * saveProtection.test.mjs
 *
 * saveStateFile() write-back into an IDE state.json must be atomic and must
 * never roll the IDE's pet back to an older copy of itself.
 * Mirrors vscode/tests/unit/safeStateFile.test.ts and pycharm SaveProtectionTest.kt.
 *
 * Run with:
 *   node --test tests/unit/saveProtection.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { saveStateFile, isStaleAgainst } from "../../scripts/state.mjs";

const SPAWNED = 1_790_000_000_000;
const pet = (dayTimer, spawnedAt = SPAWNED) => ({ name: "Scout", alive: true, spawnedAt, dayTimer });

function withTmp(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-save-"));
  const prev = process.env.CLAUDE_PLUGIN_DATA;
  process.env.CLAUDE_PLUGIN_DATA = path.join(dir, "data");
  try { fn(dir); } finally {
    if (prev === undefined) delete process.env.CLAUDE_PLUGIN_DATA; else process.env.CLAUDE_PLUGIN_DATA = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("saveStateFile write-back protection", () => {
  it("does not overwrite a newer copy of the same pet", () => withTmp((dir) => {
    const ideFile = path.join(dir, "state.json");
    fs.writeFileSync(ideFile, JSON.stringify({ state: pet(122), savedAt: Date.now() }));
    saveStateFile({ state: pet(102), _anchor: { ide: "pycharm", filePath: ideFile } });
    assert.equal(JSON.parse(fs.readFileSync(ideFile, "utf8")).state.dayTimer, 122);
  }));

  it("writes forward progress atomically", () => withTmp((dir) => {
    const ideFile = path.join(dir, "state.json");
    fs.writeFileSync(ideFile, JSON.stringify({ state: pet(10), savedAt: Date.now() }));
    saveStateFile({ state: pet(11), _anchor: { ide: "pycharm", filePath: ideFile } });
    assert.equal(JSON.parse(fs.readFileSync(ideFile, "utf8")).state.dayTimer, 11);
    assert.equal(fs.existsSync(`${ideFile}.tmp`), false);
  }));

  it("treats a different pet as not stale", () => {
    assert.equal(isStaleAgainst(pet(0, SPAWNED + 1), pet(122)), false);
  });
});
