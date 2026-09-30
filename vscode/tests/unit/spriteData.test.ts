import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import { ROTATION_ANIMALS } from "../../src/gameEngine";

// Data checks for the webview sprite grids in vscode/media (PyCharm copies
// the same files at build time). Loads spriteConstants.js and sprites.js the
// way the webview does, in a sandbox with a bare `window`, then checks every
// grid against SPRITE_GRID_META.
const media = path.join(__dirname, "../../../media");

type Grid = number[][];
interface Meta { cols: number; rows: number; legRowStart: number }

function loadSprites(): { sprites: Record<string, Record<string, Grid>>; meta: Record<string, Meta> } {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  for (const file of ["spriteConstants.js", "sprites.js"]) {
    const source = fs.readFileSync(path.join(media, file), "utf8").replace(/^﻿/, "");
    vm.runInContext(source, context, { filename: file });
  }
  return {
    sprites: window["SPRITES"] as Record<string, Record<string, Grid>>,
    meta: window["SPRITE_GRID_META"] as Record<string, Meta>,
  };
}

const { sprites, meta } = loadSprites();
const STAGES = ["baby", "child", "teen", "adult", "senior"];

describe("sprite data (vscode/media/sprites.js)", () => {
  it("defines at least one sprite", () => {
    assert.ok(Object.keys(sprites).length > 0);
  });

  it("uses only colour indices 0-5", () => {
    for (const [type, stages] of Object.entries(sprites)) {
      for (const [stage, grid] of Object.entries(stages)) {
        grid.forEach((row, r) => {
          const bad = row.find((v) => !(Number.isInteger(v) && v >= 0 && v <= 5));
          assert.equal(bad, undefined, `${type}/${stage} row ${r} has an invalid digit`);
        });
      }
    }
  });

  it("keeps every row of a grid the same width", () => {
    for (const [type, stages] of Object.entries(sprites)) {
      for (const [stage, grid] of Object.entries(stages)) {
        const width = grid[0].length;
        grid.forEach((row, r) => {
          assert.equal(row.length, width, `${type}/${stage} row ${r}: ${row.length} cols, row 0 has ${width}`);
        });
      }
    }
  });

  // SPRITE_GRID_META holds one size per species. Image-imported species can
  // have narrower stages than the meta width (dragon: 112–180 cols against
  // 180), so only the row count must match exactly and no stage may be wider.
  // One shared grid per species is part of the bulk sprite pipeline
  // (FEATURES_SEPTEMBER_2026.md §2.2); tighten this to an exact match then.
  it("fits SPRITE_GRID_META for every species that has an entry", () => {
    for (const [type, stages] of Object.entries(sprites)) {
      const m = meta[type];
      if (!m) { continue; }
      for (const [stage, grid] of Object.entries(stages)) {
        assert.equal(grid.length, m.rows, `${type}/${stage}: ${grid.length} rows, meta says ${m.rows}`);
        assert.ok(grid[0].length <= m.cols, `${type}/${stage}: ${grid[0].length} cols is wider than meta ${m.cols}`);
      }
    }
  });

  it("gives every grid-drawn species a SPRITE_GRID_META entry", () => {
    for (const type of Object.keys(sprites)) {
      assert.ok(meta[type], `${type} has grids but no SPRITE_GRID_META entry`);
    }
  });

  it("has all five stages for every rotation animal (so no hatched pet falls back)", () => {
    for (const type of ROTATION_ANIMALS) {
      if (type === "classic") { continue; } // drawn procedurally, no grid
      for (const stage of STAGES) {
        assert.ok(sprites[type]?.[stage], `rotation animal ${type} has no ${stage} grid`);
      }
    }
  });
});
