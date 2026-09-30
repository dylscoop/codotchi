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
