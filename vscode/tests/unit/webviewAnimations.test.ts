import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

// Checks for the webview reaction animations (sidebar.js) and the hatching
// egg (sprites.js). PyCharm copies the same vscode/media files at build time.
const media = path.join(__dirname, "../../../media");
const repoRoot = path.join(__dirname, "../../../..");
const sidebarSource = fs.readFileSync(path.join(media, "sidebar.js"), "utf8");

function loadSpriteWindow(): Record<string, any> {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  for (const file of ["spriteConstants.js", "sprites.js"]) {
    const source = fs.readFileSync(path.join(media, file), "utf8").replace(/^﻿/, "");
    vm.runInContext(source, context, { filename: file });
  }
  return window as Record<string, any>;
}

/** Canvas 2D context stand-in that counts method calls and accepts any property. */
function mockCtx(): { ctx: any; calls: Record<string, number> } {
  const calls: Record<string, number> = {};
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(target, key: string) {
      if (key in target) { return target[key]; }
      return () => { calls[key] = (calls[key] ?? 0) + 1; };
    },
    set(target, key: string, value) { target[key] = value; return true; },
  });
  return { ctx, calls };
}

function drawEgg(spriteType: string, dayTimer: number): Record<string, number> {
  const w = loadSpriteWindow();
  const { ctx, calls } = mockCtx();
  w.renderSpriteGrid(ctx, { spriteType, stage: "egg", dayTimer, weight: 40 },
    10, 10, false, 0, 0,
    w.SPRITE_STAGE_SCALES, w.spriteWeightWidthMult, w.spriteGetPalette,
    w.spriteHeightRatio, w.spriteQuadBellySag);
  return calls;
}

function reactionDurationKeys(): string[] {
  const block = /const REACTION_DURATIONS = \{([\s\S]*?)\};/.exec(sidebarSource);
  assert.ok(block, "REACTION_DURATIONS not found in sidebar.js");
  return [...block[1].matchAll(/^\s*(\w+):\s*\d+/gm)].map((m) => m[1]);
}

describe("webview reactions (vscode/media/sidebar.js)", () => {
  it("has a died and a hatched reaction", () => {
    const keys = reactionDurationKeys();
    assert.ok(keys.includes("died"));
    assert.ok(keys.includes("hatched"));
  });

  it("draws every reaction in REACTION_DURATIONS", () => {
    for (const key of reactionDurationKeys()) {
      assert.ok(sidebarSource.includes(`case "${key}":`), `no case "${key}" in drawBodyWithReaction`);
    }
  });

  it("queues died on death and hatched on egg -> baby", () => {
    assert.match(sidebarSource, /pushReaction\("died"/);
    assert.match(sidebarSource, /"evolved_to_baby"\) \{ pushReaction\("hatched"/);
  });
});

describe("hatching egg (vscode/media/sprites.js)", () => {
  it("uses the same hatch threshold as the TypeScript and Kotlin engines", () => {
    const hatchDays = loadSpriteWindow().SPRITE_EGG_HATCH_DAYS;
    const ts = fs.readFileSync(path.join(repoRoot, "packages/core/src/gameEngine.ts"), "utf8");
    const kt = fs.readFileSync(
      path.join(repoRoot, "pycharm/src/main/kotlin/com/codotchi/engine/Constants.kt"), "utf8");
    assert.equal(Number(/^\s*egg:\s*([\d.]+)/m.exec(ts)?.[1]), hatchDays);
    assert.equal(Number(/"egg"\s+to\s+([\d.]+)/.exec(kt)?.[1]), hatchDays);
  });

  for (const spriteType of ["dog", "classic"]) {
    it(`${spriteType}: no cracks on a fresh egg`, () => {
      const calls = drawEgg(spriteType, 0);
      assert.equal(calls["ellipse"], 1);
      assert.equal(calls["stroke"] ?? 0, 0);
    });

    it(`${spriteType}: one crack from half-way`, () => {
      const calls = drawEgg(spriteType, 0.267 * 0.6);
      assert.equal(calls["stroke"], 1);
      assert.equal(calls["lineTo"], 5);
    });

    it(`${spriteType}: second crack from 80%`, () => {
      const calls = drawEgg(spriteType, 0.267 * 0.9);
      assert.equal(calls["stroke"], 1);
      assert.equal(calls["lineTo"], 7);
    });
  }
});

describe("mood layer (vscode/media/sprites.js window.spriteMood)", () => {
  const mood = loadSpriteWindow().spriteMood;
  const box = { x: 40, y: 20, w: 32, h: 32 };
  const alive = { alive: true, stage: "adult", sleeping: false, sick: false, mood: "neutral" };

  it("picks the mood shown by the webview", () => {
    assert.equal(mood.current({ ...alive, mood: "happy" }, null, false), "happy");
    assert.equal(mood.current({ ...alive, mood: "sad" }, null, false), "sad");
    assert.equal(mood.current({ ...alive, sleeping: true, mood: "sleeping" }, null, false), "sleeping");
    assert.equal(mood.current({ ...alive, mood: "happy" }, "fed_meal", false), "eating");
    assert.equal(mood.current(alive, null, true), "eating");
    assert.equal(mood.current(alive, null, false), null);
    assert.equal(mood.current({ ...alive, sick: true, mood: "sick" }, null, false), null);
    assert.equal(mood.current({ ...alive, stage: "egg", mood: "happy" }, null, false), null);
    assert.equal(mood.current({ ...alive, alive: false, mood: "happy" }, null, false), null);
  });

  it("cycles the chomp through three frames and leaves neutral unscaled", () => {
    assert.deepEqual([0, 8, 16, 24].map((t) => mood.frame("eating", t)), [0, 1, 2, 0]);
    assert.deepEqual([0, 1, 2].map((f) => mood.scaleY("eating", f)), [1, 0.92, 1.04]);
    assert.equal(mood.scaleY(null, 0), 1);
    assert.ok(mood.scaleY("sleeping", 0) < 1);
  });

  it("draws a bowl while eating and a blanket while sleeping, nothing otherwise", () => {
    for (const m of ["eating", "sleeping"]) {
      const { ctx, calls } = mockCtx();
      mood.drawProps(ctx, m, 0, box, false, false);
      assert.ok((calls["fillRect"] ?? 0) >= 3, `${m}: no props drawn`);
    }
    const { ctx, calls } = mockCtx();
    mood.drawProps(ctx, "happy", 0, box, false, false);
    assert.equal(calls["fillRect"] ?? 0, 0);
  });

  it("empties the bowl across the chomp", () => {
    const fills = [0, 1, 2].map((f) => {
      const { ctx, calls } = mockCtx();
      mood.drawProps(ctx, "eating", f, box, false, false);
      return calls["fillRect"];
    });
    assert.deepEqual(fills, [4, 4, 3]);
  });

  it("spawns crumbs on the chomp frame and tears that fall to the floor", () => {
    const particles: any[] = [];
    mood.spawn(particles, "eating", 1, true, box, false, 1 / 60, () => 0);
    assert.ok(particles.length >= 2 && particles.every((p) => p.kind === "crumb"));

    const tears: any[] = [];
    mood.spawn(tears, "sad", 1, true, box, false, 1 / 60, () => 0);
    assert.equal(tears[0].kind, "tear");
    for (let i = 0; i < 120 && tears.length; i++) { mood.step(tears, 1 / 60, box.y + box.h); }
    assert.equal(tears.length, 0, "tear should land on the floor and vanish");
  });

  it("caps the particle pool", () => {
    const particles: any[] = [];
    for (let i = 0; i < 100; i++) { mood.spawn(particles, "sleeping", 0, false, box, false, 10, () => 0); }
    assert.ok(particles.length <= 20);
  });

  /** Run a mood over `ticks` frames from animTick 0 and count what it does. */
  function runMood(m: string, ticks: number) {
    const particles: any[] = [];
    let spawned = 0, burstTicks = 0, stretched = 0, lastFrame = -1;
    for (let t = 0; t < ticks; t++) {
      const f = mood.frame(m, t);
      const before = particles.length;
      mood.spawn(particles, m, f, f !== lastFrame, box, false, 1 / 60, Math.random);
      spawned += particles.length - before;
      particles.length = 0;
      if (f > 0) { burstTicks++; }
      if (mood.scaleY(m, f) > 1) { stretched++; }
      lastFrame = f;
    }
    return { spawned, burstTicks, stretched };
  }

  it("plays happy as a short burst about every 30 s, still in between", () => {
    assert.equal(mood.frame("happy", 0), 0);
    assert.equal(mood.frame("happy", 900), 0);
    assert.equal(mood.scaleY("happy", 0), 1);
    // First burst ~20 s in: frames 1, 2, 1, 2 then idle
    assert.deepEqual([1200, 1215, 1230, 1245, 1260].map((t) => mood.frame("happy", t)), [1, 2, 1, 2, 0]);
    const oneMinute = runMood("happy", 3600);
    assert.equal(oneMinute.burstTicks, 120, "two 1-second bursts per minute");
    assert.equal(oneMinute.stretched, 60, "stretch only on the pulse frames");
    assert.ok(oneMinute.spawned >= 4 && oneMinute.spawned <= 8, `sparkles: ${oneMinute.spawned}`);
  });

  it("keeps sad drooped but only cries in bursts", () => {
    assert.equal(mood.scaleY("sad", 0), 0.95);
    assert.equal(mood.scaleY("sad", 1), 0.95);
    assert.equal(runMood("sad", 500).spawned, 0, "no tears before the first burst");
    assert.equal(runMood("sad", 1800).spawned, 3, "one burst of three tears");
  });

  it("never spawns particles for a neutral pet", () => {
    const particles: any[] = [];
    mood.spawn(particles, null, 0, true, box, false, 10, () => 0);
    assert.equal(particles.length, 0);
  });
});

describe("per-mood sprite grids (renderSpriteGrid hook)", () => {
  function drawSheep(w: Record<string, any>, state: Record<string, unknown>): Record<string, number> {
    const { ctx, calls } = mockCtx();
    w.renderSpriteGrid(ctx, { spriteType: "sheep", stage: "adult", weight: 50, ...state },
      10, 10, false, 0, 0,
      w.SPRITE_STAGE_SCALES, w.spriteWeightWidthMult, w.spriteGetPalette,
      w.spriteHeightRatio, w.spriteQuadBellySag);
    return calls;
  }

  it("uses DEFS[type][stage_mood] when present and the stage grid otherwise", () => {
    const w = loadSpriteWindow();
    const normal = w.SPRITES.sheep.adult;
    // A single-pixel stand-in grid of the same size makes the difference easy to see
    const tiny = normal.map((row: number[], r: number) => row.map((_: number, c: number) => (r === 0 && c === 0 ? 1 : 0)));
    w.SPRITES.sheep.adult_sleeping = tiny;
    w.invalidateSpriteRasterCache();
    const asleep = drawSheep(w, { mood: "sleeping", sleeping: true });
    const awake = drawSheep(w, { mood: "happy" });
    assert.ok(asleep["fillRect"] < awake["fillRect"], `mood grid not used: ${asleep["fillRect"]} vs ${awake["fillRect"]}`);
  });

  it("ignores mood grids in the five-stage sprite data", () => {
    const w = loadSpriteWindow();
    for (const stages of Object.values(w.SPRITES as Record<string, Record<string, unknown>>)) {
      assert.ok(!Object.keys(stages).some((k) => k.includes("_")), "no per-mood grids are shipped yet");
    }
  });
});

describe("snack answer text waits for the pet to eat (sidebar.js)", () => {
  it("holds answered-call events when a snack is placed and releases them on every eat path", () => {
    assert.match(sidebarSource, /if \(snackPlaced && !REDUCED_MOTION\) \{\s*heldSnackAnswers = heldSnackAnswers\.concat\(events\.filter\(isAnsweredCall\)\);\s*events = events\.filter/);
    const eats = sidebarSource.split("releaseSnackAnswers();").length - 1;
    const consumed = sidebarSource.split('vscode.postMessage({ command: "snack_consumed" });').length - 1;
    assert.ok(consumed > 0);
    assert.equal(eats, consumed, "every snack_consumed path must release the held text");
  });

  it("logs the filtered events, not the raw state.events", () => {
    assert.ok(sidebarSource.includes("appendEvents(events, state.name, state);"));
    assert.ok(!sidebarSource.includes("appendEvents(state.events"));
  });
});
