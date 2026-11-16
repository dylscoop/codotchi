import { describe, it, beforeEach } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { safeWriteStateFile, readWithBackups, backupPath, isStaleAgainst } from "../../src/safeStateFile";

// Atomic writes, stale-overwrite refusal and backup recovery for state.json.
// Mirrors pycharm SaveProtectionTest.kt.

const SPAWNED = 1_790_000_000_000;
const pet = (dayTimer: number, spawnedAt = SPAWNED) => ({ alive: true, spawnedAt, dayTimer, name: "Scout" });

describe("safeStateFile", () => {
  let file: string;
  beforeEach(() => {
    file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-safe-")), "state.json");
  });

  it("writes atomically with no temp file left behind", () => {
    assert.equal(safeWriteStateFile(file, { state: pet(10), savedAt: Date.now() }), true);
    assert.equal(fs.existsSync(`${file}.tmp`), false);
    assert.equal((readWithBackups(file)!.state as { dayTimer: number }).dayTimer, 10);
  });

  it("refuses to roll the same pet back in age", () => {
    safeWriteStateFile(file, { state: pet(122), savedAt: Date.now() });
    assert.equal(safeWriteStateFile(file, { state: pet(102), savedAt: Date.now() }), false);
    assert.equal((readWithBackups(file)!.state as { dayTimer: number }).dayTimer, 122);
  });

  it("allows a different pet to overwrite", () => {
    safeWriteStateFile(file, { state: pet(122), savedAt: Date.now() });
    assert.equal(safeWriteStateFile(file, { state: pet(0, SPAWNED + 1), savedAt: Date.now() }), true);
  });

  it("small age differences are not treated as stale", () => {
    assert.equal(isStaleAgainst(pet(10), pet(10.5)), false);
  });

  it("recovers from a truncated state file via the newest backup", () => {
    safeWriteStateFile(file, { state: pet(50), savedAt: Date.now() });
    safeWriteStateFile(file, { state: pet(51), savedAt: Date.now() });
    assert.equal(fs.existsSync(backupPath(file, 1)), true);
    fs.writeFileSync(file, "{\"state\":{\"na", "utf8");
    assert.equal((readWithBackups(file)!.state as { dayTimer: number }).dayTimer, 50);
  });
});
