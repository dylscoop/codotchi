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
  for (const file of ["spriteConstants.js", "sprites.generated.js", "sprites.js"]) {
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

  it("eats a meal for twice as long as a snack, bobbing twice", () => {
    const dur = (k: string) => Number(new RegExp(`^\\s*${k}:\\s*(\\d+)`, "m").exec(sidebarSource)![1]);
    assert.equal(dur("fed_meal"), 1000);
    assert.equal(dur("fed_meal"), 2 * dur("fed_snack"));
    assert.match(sidebarSource, /var bobs = reaction\.type === "fed_meal" \? 2 : 1;/);
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

  it("draws a bowl only for a meal — no plate for a snack, nothing while sleeping", () => {
    const eating = mockCtx();
    mood.drawProps(eating.ctx, "eating", 0, box, false, false);
    assert.ok((eating.calls["fillRect"] ?? 0) >= 3, "eating: no bowl drawn");

    // The blanket read as a blue box and the pillow as a white box (BUGFIX-178)
    for (const [m, snack] of [["eating", true], ["sleeping", false], ["happy", false]] as const) {
      const { ctx, calls } = mockCtx();
      mood.drawProps(ctx, m, 0, box, false, snack);
      assert.equal(calls["fillRect"] ?? 0, 0, `${m}${snack ? " (snack)" : ""}: no props expected`);
    }
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

describe("pet stands still while eating a meal (sidebar.js)", () => {
  it("locks movement during the fed_meal reaction so the bowl stays put", () => {
    assert.match(sidebarSource,
      /\} else if \(activeReaction && activeReaction\.type === "fed_meal"\) \{[^}]*petVx = 0;/);
    const lock = sidebarSource.indexOf('activeReaction.type === "fed_meal") {');
    const wander = sidebarSource.indexOf("// ── Normal movement");
    assert.ok(lock > 0 && lock < wander, "fed_meal lock must come before the wander branch");
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

describe("pat reaction (vscode/media/sprites.js window.spritePat)", () => {
  const w = loadSpriteWindow();
  const pat = w.spritePat;
  const spriteTypes = Object.keys(w.SPRITE_ANIMAL_PALETTES ?? {}).length > 0
    ? Object.keys(w.SPRITE_ANIMAL_PALETTES)
    : ["classic", "sheep", "snake", "tim", "stu", "kangaroo", "roo", "dog", "cat", "dragon"];
  const box = { x: 40, y: 20, w: 32, h: 32 };

  it("has its own motion for every built-in pet", () => {
    for (const type of ["classic", "sheep", "snake", "tim", "stu", "kangaroo", "roo", "dog", "cat", "dragon"]) {
      assert.equal(typeof pat.MOTION[type], "function", type);
    }
  });

  it("starts and ends every motion at rest, with finite values in between", () => {
    for (const type of [...spriteTypes, "unknown"]) {
      for (const t of [0, 1]) {
        const m = pat.motion(type, t);
        assert.ok(Math.abs(m.dx) < 1e-6 && Math.abs(m.dy) < 1e-6 && Math.abs(m.rot) < 1e-6, `${type} t=${t}`);
        assert.ok(Math.abs(m.sx - 1) < 1e-6 && Math.abs(m.sy - 1) < 1e-6, `${type} t=${t}`);
      }
      const mid = pat.motion(type, 0.3);
      for (const v of [mid.dx, mid.dy, mid.sx, mid.sy, mid.rot]) { assert.ok(Number.isFinite(v), type); }
    }
  });

  it("moves each pet mid-pat", () => {
    for (const type of ["classic", "sheep", "snake", "tim", "kangaroo", "dog", "cat", "dragon"]) {
      const m = pat.motion(type, 0.3);
      const moved = Math.abs(m.dx) + Math.abs(m.dy) + Math.abs(m.sx - 1) + Math.abs(m.sy - 1) + Math.abs(m.rot);
      assert.ok(moved > 0.01, type);
    }
  });

  it("draws the patting hand and the human blush", () => {
    const { ctx, calls } = mockCtx();
    pat.drawHand(ctx, 0.25, box, false, 2);
    assert.ok((calls.fillRect ?? 0) >= 6);
    const blush = mockCtx();
    pat.drawBlush(blush.ctx, "tim", 0.5, box, 2);
    assert.equal(blush.calls.fillRect, 2);
    const none = mockCtx();
    pat.drawBlush(none.ctx, "dog", 0.5, box, 2);
    assert.equal(none.calls.fillRect ?? 0, 0);
  });

  it("draws the patting hand at half a prop-pixel per hand pixel", () => {
    for (const px of [2, 4, 5, 8]) {
      const rects: number[][] = [];
      const ctx = new Proxy({} as any, {
        get(t, k: string) { return k in t ? t[k] : k === "fillRect" ? (...a: number[]) => { rects.push(a); } : () => undefined; },
        set(t, k: string, v) { t[k] = v; return true; },
      });
      pat.drawHand(ctx, 0.25, box, false, px);
      const w = Math.max(...rects.map((r) => r[0] + r[2])) - Math.min(...rects.map((r) => r[0]));
      const h = Math.max(...rects.map((r) => r[1] + r[3])) - Math.min(...rects.map((r) => r[1]));
      assert.ok(Math.abs(w - 3.5 * px) <= 1, `width at px=${px}: ${w}`);    // was 7 * px
      assert.ok(Math.abs(h - 3.5 * px) <= 1, `height at px=${px}: ${h}`);   // was 7 * px
      for (const r of rects) { assert.ok(r[2] >= 1 && r[3] >= 1 && Number.isInteger(r[0]) && Number.isInteger(r[1])); }
    }
  });

  it("spawns hearts for every pet, prr for the cat and smoke for the dragon, within the cap", () => {
    const particles: any[] = [];
    pat.spawn(particles, "dog", box, false, 1, () => 0);
    assert.deepEqual(particles.map((p) => p.kind), ["heart"]);
    const cat: any[] = [];
    pat.spawn(cat, "cat", box, false, 1, () => 0);
    assert.ok(cat.some((p) => p.kind === "prr"));
    const dragon: any[] = [];
    pat.spawn(dragon, "dragon", box, true, 1, () => 0);
    assert.ok(dragon.some((p) => p.kind === "puff"));
    const many: any[] = [];
    for (let i = 0; i < 100; i++) { pat.spawn(many, "cat", box, false, 1, () => 0); }
    assert.ok(many.length <= 24);
    const { ctx, calls } = mockCtx();
    w.spriteMood.drawParticles(ctx, [...cat, ...dragon], 2);
    assert.ok((calls.fillRect ?? 0) + (calls.fillText ?? 0) >= 3);
  });
});

describe("AI-usage device (vscode/media/sprites.js window.spritePat)", () => {
  const w = loadSpriteWindow();
  const pat = w.spritePat;
  const box = { x: 40, y: 20, w: 32, h: 32 };

  it("gives every pet a phone, tablet or laptop", () => {
    for (const type of ["classic", "sheep", "snake", "tim", "stu", "kangaroo", "roo", "dog", "cat", "dragon", "unknown"]) {
      assert.ok(["phone", "tablet", "laptop"].includes(pat.device(type)), type);
    }
    assert.equal(pat.device("tim"), "laptop");
    assert.equal(pat.device("dog"), "tablet");
    assert.equal(pat.device("cat"), "phone");
  });

  it("draws each device, and nothing once faded out", () => {
    for (const device of ["phone", "tablet", "laptop"]) {
      const { ctx, calls } = mockCtx();
      pat.drawDevice(ctx, device, box, false, 2, 1, 1, 40);
      assert.ok((calls.fillRect ?? 0) >= 3, device);
    }
    const gone = mockCtx();
    pat.drawDevice(gone.ctx, "laptop", box, false, 2, 1, 0, 40);
    assert.equal(gone.calls.fillRect ?? 0, 0);
  });

  it("keeps every device a few prop-pixels clear of the pet on either side", () => {
    const px = 2;
    assert.ok(pat.DEVICE_GAP >= 3);
    for (const device of ["phone", "tablet", "laptop"]) {
      for (const facingLeft of [false, true]) {
        const rects: number[][] = [];
        const ctx = new Proxy({} as any, {
          get(t, k: string) { return k in t ? t[k] : k === "fillRect" ? (...a: number[]) => { rects.push(a); } : () => undefined; },
          set(t, k: string, v) { t[k] = v; return true; },
        });
        pat.drawDevice(ctx, device, box, facingLeft, px, 1, 1, 40);
        const left  = Math.min(...rects.map((r) => r[0]));
        const right = Math.max(...rects.map((r) => r[0] + r[2]));
        if (facingLeft) { assert.equal(box.x - right, pat.DEVICE_GAP * px, device + " (left)"); }
        else            { assert.equal(left - (box.x + box.w), pat.DEVICE_GAP * px, device + " (right)"); }
      }
    }
  });
});

describe("AI-usage bubble timing (sidebar.js)", () => {
  it("passes the bubble kind through and fades the device with the bubble", () => {
    assert.match(sidebarSource, /showBubble\(message\.text, message\.kind\)/);
    assert.match(sidebarSource, /activeBubble\.kind === "usage"[\s\S]{0,400}bubbleAlpha\(activeBubble, nowMs\)/);
    assert.match(sidebarSource, /var alpha = bubbleAlpha\(activeBubble, nowMs\);/);
  });

  it("bubbleAlpha holds for 6 s and fades over 0.5 s", () => {
    const fn = /function bubbleAlpha\(bubble, nowMs\) \{[\s\S]*?\n  \}/.exec(sidebarSource);
    assert.ok(fn, "bubbleAlpha not found");
    const bubbleAlpha = new Function(`${fn[0]}; return bubbleAlpha;`)();
    const b = { startMs: 0, fadeOutMs: 6000, fadeDurMs: 500 };
    assert.equal(bubbleAlpha(b, 5999), 1);
    assert.ok(Math.abs(bubbleAlpha(b, 6250) - 0.5) < 1e-9);
    assert.equal(bubbleAlpha(b, 6500), 0);
    assert.equal(bubbleAlpha({ startMs: 0, fadeOutMs: Infinity, fadeDurMs: 500 }, 1e9), 1);
    assert.equal(bubbleAlpha(null, 0), 0);
  });
});

describe("Play or Pat banner (sidebar.html)", () => {
  it("is gone from the play overlay", () => {
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    assert.ok(!html.includes("Play or Pat"));
    assert.ok(!sidebarSource.includes("mgTitle"));
  });
});

describe("classic creature box (vscode/media/sprites.js)", () => {
  /** Draw classic at (x, y) and return every fillRect as [x, y, w, h]. */
  function classicRects(w: Record<string, any>, state: Record<string, unknown>, x: number, y: number, legFrame: number) {
    const rects: number[][] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get(target, key: string) {
        if (key in target) { return target[key]; }
        if (key === "fillRect") { return (...a: number[]) => { rects.push(a); }; }
        return () => undefined;
      },
      set(target, key: string, value) { target[key] = value; return true; },
    });
    w.renderSpriteGrid(ctx, state, x, y, false, legFrame, 0,
      w.SPRITE_STAGE_SCALES, w.spriteWeightWidthMult, w.spriteGetPalette,
      w.spriteHeightRatio, w.spriteQuadBellySag);
    return rects;
  }

  for (const stage of ["baby", "child", "teen", "adult", "senior"]) {
    it(`${stage}: draws inside its box, centred, with its feet on the box floor`, () => {
      const w = loadSpriteWindow();
      const state = { spriteType: "classic", stage, weight: 50, mood: "neutral", alive: true };
      const box = w.spriteClassicBox(state);
      const x = 100, y = 50;
      for (const legFrame of [0, 1]) {
        const rects = classicRects(w, state, x, y, legFrame);
        assert.ok(rects.length > 0);
        const top    = Math.min(...rects.map((r) => r[1]));
        const bottom = Math.max(...rects.map((r) => r[1] + r[3]));
        assert.equal(top, y, "the head sits at the top of the box — no empty band above");
        assert.equal(bottom, y + box.h, "the longest leg reaches the box floor");
        // Body (not the adult's 2px shoulder stubs) spans exactly the box width
        const body = rects.filter((r) => r[2] === box.w);
        assert.ok(body.length > 0);
        for (const r of body) { assert.equal(r[0], x); }
      }
    });
  }

  it("is a small box, not the 32×48 grid box", () => {
    const w = loadSpriteWindow();
    const box = w.spriteClassicBox({ spriteType: "classic", stage: "adult", weight: 50 });
    assert.deepEqual([box.w, box.h], [18, 27 + 5]);   // medium petSize: 24 × 1.0 × 0.75
  });

  it("treats species with no sprite art as classic", () => {
    const w = loadSpriteWindow();
    assert.equal(w.spriteDrawsAsClassic("classic", "adult"), true);
    assert.equal(w.spriteDrawsAsClassic("dog", "adult"), false);
    assert.equal(w.spriteDrawsAsClassic("no_such_pet", "adult"), true);
  });
});

describe("head gap above every pet (vscode/media/sidebar.js)", () => {
  it("lifts the status indicator and speech bubble a little above the head", () => {
    assert.match(sidebarSource, /function headGap\(state\) \{\s*return Math\.max\(2, Math\.round\(petPropWidth\(state\) \/ 16\)\);/);
    assert.match(sidebarSource, /var _petTopY  = Math\.round\(petY\) \+ walkBob - headGap\(lastState\);/);
    assert.match(sidebarSource, /var indicatorY = bodyY - 3 - headGap\(state\);/);
    assert.match(sidebarSource, /drawSpeechBubble\(staticX \+ Math\.round\(bWidth \/ 2\), staticY - headGap\(state\),/);
  });
});

describe("speech bubble vs emojis above the head (vscode/media/sidebar.js)", () => {
  it("lifts the bubble above the z's / hearts while sleeping or patted", () => {
    assert.match(sidebarSource, /drawSpeechBubble\(_petCx, _petTopY, nowMs,\s*emojiClearance\(lastState\.sleeping \|\| patting, moodPxSize\)\)/);
    assert.match(sidebarSource, /var boxBottomY = petTopY - \(clearance \|\| 0\) - TAIL_H - 2;/);
  });

  it("keeps grid-sized props for the narrow classic creature", () => {
    assert.match(sidebarSource, /pxW: petPropWidth\(lastState\)/);
    const w = loadSpriteWindow();
    assert.equal(w.spriteMood.px({ x: 0, y: 0, w: 18, h: 32, pxW: 72 }), 5);
    assert.equal(w.spriteMood.px({ x: 0, y: 0, w: 72, h: 108 }), 5);
  });
});

describe("Tim's run and Stu's stickers replace the pat (sprites.js + sidebar.js)", () => {
  const w = loadSpriteWindow();
  const pat = w.spritePat;
  const box = { x: 40, y: 20, w: 32, h: 48 };

  it("Tim and Stu get no hand and no hearts; other pets keep both", () => {
    assert.equal(pat.usesHand("tim"), false);
    assert.equal(pat.usesHand("stu"), false);
    assert.equal(pat.usesHand("dog"), true);
    for (const type of ["tim", "stu"]) {
      const particles: any[] = [];
      for (let i = 0; i < 20; i++) { pat.spawn(particles, type, box, false, 0.05, Math.random, 0.6); }
      assert.ok(!particles.some((p) => p.kind === "heart"), type);
    }
  });

  it("Tim jogs a lap: out to the far end at half time and back, kicking up dust", () => {
    assert.equal(pat.runLap("tim", 0), 0);
    assert.ok(Math.abs(pat.runLap("tim", 0.5) - 1) < 1e-9);
    assert.ok(Math.abs(pat.runLap("tim", 1)) < 1e-9);
    assert.equal(pat.runLap("stu", 0.5), null);
    assert.ok(pat.durationMs("tim", 1400) > 1400);
    const dust: any[] = [];
    pat.spawn(dust, "tim", box, false, 1, () => 0, 0.3);
    assert.deepEqual(dust.map((p) => p.kind), ["dust"]);
    assert.ok(dust[0].x < box.x + box.w / 2, "dust trails behind a right-facing runner");
  });

  it("Stu opens a binder or a pack, and stickers burst out after the reveal", () => {
    assert.equal(pat.pickProp("stu", () => 0), "binder");
    assert.equal(pat.pickProp("stu", () => 0.99), "pack");
    assert.equal(pat.pickProp("tim", () => 0), null);
    const early: any[] = [];
    pat.spawn(early, "stu", box, false, 1, () => 0, 0.2);
    assert.equal(early.length, 0, "nothing before the binder opens / pack tears");
    const burst: any[] = [];
    pat.spawn(burst, "stu", box, false, 1, () => 0, 0.6);
    assert.deepEqual(burst.map((p) => p.kind), ["sticker"]);
    for (const variant of ["binder", "pack"]) {
      for (const t of [0.1, 0.5, 0.9]) {
        const { ctx, calls } = mockCtx();
        pat.drawProp(ctx, variant, t, box, 2);
        assert.ok((calls.fillRect ?? 0) >= 3, `${variant} t=${t}`);
      }
    }
    const { ctx, calls } = mockCtx();
    w.spriteMood.drawParticles(ctx, [...burst, { kind: "dust", x: 1, y: 1, age: 0, life: 1 }], 2);
    assert.ok((calls.fillRect ?? 0) >= 3);
  });

  it("sidebar.js runs Tim round the stage and draws Stu's prop instead of the hand", () => {
    assert.match(sidebarSource, /window\.spritePat\.runLap\(lastState\.spriteType, 0\) !== null/);
    assert.match(sidebarSource, /activeReaction\.runFromX = petX;/);
    assert.match(sidebarSource, /patting && window\.spritePat\.usesHand\(lastState\.spriteType\)/);
    assert.match(sidebarSource, /window\.spritePat\.drawProp\(spriteCtx, activeReaction\.prop/);
    assert.match(sidebarSource, /pushReaction\("patted", nowMs, window\.spritePat\.durationMs\(state\.spriteType/);
  });
});
