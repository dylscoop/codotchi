import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { anotherWindowOwnsTick, TICK_LEASE_MS } from "../../src/tickLease";

// Two windows in AI mode used to tick their own copies of the pet, so a call
// answered in one came back from the other and the status bar ⚠ never cleared.
const root = path.join(__dirname, "../../../..");
const NOW = 1_000_000;

describe("anotherWindowOwnsTick", () => {
  it("yields to another window that saved within the lease", () => {
    assert.equal(anotherWindowOwnsTick({ writerId: "other", savedAt: NOW - 3_000 }, "me", NOW), true);
  });

  it("takes the tick back once the other window's save is older than the lease", () => {
    assert.equal(anotherWindowOwnsTick({ writerId: "other", savedAt: NOW - TICK_LEASE_MS }, "me", NOW), false);
  });

  it("keeps ticking after its own save", () => {
    assert.equal(anotherWindowOwnsTick({ writerId: "me", savedAt: NOW - 100 }, "me", NOW), false);
  });

  it("never yields to writes without a writerId (terminal plugins, older builds)", () => {
    assert.equal(anotherWindowOwnsTick({ savedAt: NOW - 100 }, "me", NOW), false);
  });

  it("ticks when there is no state file", () => {
    assert.equal(anotherWindowOwnsTick(null, "me", NOW), false);
  });

  it("lasts longer than one tick, so a ticking window always holds it", () => {
    assert.ok(TICK_LEASE_MS > 3_000 && TICK_LEASE_MS < 10_000);
  });

  it("acting in the other window hands the tick over to it", () => {
    // Window B was following A; you answer a call in B, so B saves.
    const afterBSaves = { writerId: "B", savedAt: NOW };
    assert.equal(anotherWindowOwnsTick(afterBSaves, "A", NOW + 1_000), true, "A follows B");
    assert.equal(anotherWindowOwnsTick(afterBSaves, "B", NOW + 3_000), false, "B ticks");
  });
});

describe("tick lease wiring", () => {
  const extension = fs.readFileSync(path.join(root, "vscode/src/extension.ts"), "utf8");
  const persistence = fs.readFileSync(path.join(root, "vscode/src/persistence.ts"), "utf8");

  it("the state file records which window wrote it", () => {
    assert.match(persistence, /writerId: WRITER_ID/);
  });

  it("an AI-mode tick follows the file while another window owns the tick", () => {
    const tickFn = extension.slice(extension.indexOf("function runOneTick"), extension.indexOf("function startTicker"));
    assert.match(tickFn, /aiMode[\s\S]*anotherWindowOwnsTick\(readStateFileStamp\(\), WRITER_ID, Date\.now\(\)\)[\s\S]*reloadAndRefreshUI\(false\)/);
    assert.ok(tickFn.indexOf("anotherWindowOwnsTick") < tickFn.indexOf("tick(currentState"), "checked before ticking");
  });
});
