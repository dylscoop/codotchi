import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { shouldPersistTick, PulseGate, LOCAL_TICK_SAVE_INTERVAL_MS } from "../../src/ioThrottle";

const indexSource = fs.readFileSync(path.join(__dirname, "../../../src/index.ts"), "utf8");

describe("shouldPersistTick", () => {
  it("skips tick saves inside the interval", () => {
    assert.equal(shouldPersistTick(1_000, 1_000 + LOCAL_TICK_SAVE_INTERVAL_MS - 1), false);
  });

  it("saves once the interval has elapsed", () => {
    assert.equal(shouldPersistTick(1_000, 1_000 + LOCAL_TICK_SAVE_INTERVAL_MS), true);
  });

  it("saves straight away when nothing has been saved yet", () => {
    assert.equal(shouldPersistTick(0, Date.now()), true);
  });

  it("cuts tick writes by at least 10x at the 3 s tick", () => {
    let saved = 0;
    let last = 0;
    for (let now = 3_000; now <= 300_000; now += 3_000) {
      if (shouldPersistTick(last, now)) { saved++; last = now; }
    }
    assert.ok(saved <= 10, `saved ${saved} times in 100 ticks`);
  });
});

describe("PulseGate", () => {
  it("emits the first time and whenever the visible values change", () => {
    const gate = new PulseGate();
    assert.equal(gate.changed([1, "a"]), true);
    assert.equal(gate.changed([1, "a"]), false);
    assert.equal(gate.changed([2, "a"]), true);
  });

  it("emits again after reset", () => {
    const gate = new PulseGate();
    gate.changed(["x"]);
    gate.reset();
    assert.equal(gate.changed(["x"]), true);
  });
});

describe("integration — idle OpenCode window I/O", () => {
  it("local pet tick saves are throttled but evolutions save immediately", () => {
    assert.match(indexSource, /if \(evolved \|\| shouldPersistTick\(localLastSavedAt, Date\.now\(\)\)\) \{ saveLocalState\(\); \}/);
  });

  it("the throttled state is flushed on shutdown", () => {
    assert.match(indexSource, /clearInterval\(tickTimer\); tickTimer = undefined; saveLocalState\(\);/);
  });

  it("the sidebar pulse only emits when shown values change", () => {
    assert.match(indexSource, /if \(pulseGate\.changed\(parts\)\) \{ emitUpdated\(\); \}/);
    assert.ok(!indexSource.includes("setInterval(emitUpdated,"), "unconditional 3 s pulse removed");
  });
});
