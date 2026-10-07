import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";
import { ROTATION_ANIMALS } from "../../src/gameEngine";

// Data checks for the webview sprite grids in vscode/media (PyCharm copies
// the same files at build time). Loads spriteConstants.js, sprites.generated.js
// and sprites.js the way the webview does, in a sandbox with a bare `window`, then checks every
// grid against SPRITE_GRID_META.
const media = path.join(__dirname, "../../../media");

type Grid = number[][];
interface Meta { cols: number; rows: number; legRowStart: number }

function loadSprites(): { sprites: Record<string, Record<string, Grid>>; meta: Record<string, Meta> } {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  for (const file of ["spriteConstants.js", "sprites.generated.js", "sprites.js"]) {
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

describe("sprite data (vscode/media/sprites.generated.js + sprites.js)", () => {
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

  // SPRITE_GRID_META holds one size per species, and every stage uses it: the
  // bulk pipeline (scripts/import_sprites_bulk.js) pads all stages of a
  // species onto one shared grid.
  it("matches SPRITE_GRID_META exactly for every species that has an entry", () => {
    for (const [type, stages] of Object.entries(sprites)) {
      const m = meta[type];
      if (!m) { continue; }
      for (const [stage, grid] of Object.entries(stages)) {
        assert.equal(grid.length, m.rows, `${type}/${stage}: ${grid.length} rows, meta says ${m.rows}`);
        assert.equal(grid[0].length, m.cols, `${type}/${stage}: ${grid[0].length} cols, meta says ${m.cols}`);
      }
    }
  });

  it("keeps every grid within the 192×128 runtime cap", () => {
    for (const [type, m] of Object.entries(meta)) {
      assert.ok(m.cols <= 192 && m.rows <= 128, `${type}: ${m.cols}×${m.rows} is over the 192×128 cap`);
    }
  });

  it("puts legRowStart inside the grid", () => {
    for (const [type, m] of Object.entries(meta)) {
      assert.ok(m.legRowStart >= 0 && m.legRowStart < m.rows, `${type}: legRowStart ${m.legRowStart} outside ${m.rows} rows`);
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

describe("hand-drawn human sprites (tim, stu) are centred", () => {
  // They used to hug the left edge of their grid, so they drew off-centre and,
  // because upright sprites mirror around the box centre, jumped on every turn.
  for (const type of ["tim", "stu"]) {
    it(`${type}: every stage is centred in its grid within one column`, () => {
      for (const stage of STAGES) {
        const grid = sprites[type][stage];
        let lo = Infinity, hi = -Infinity;
        for (const row of grid) {
          row.forEach((v, c) => { if (v) { lo = Math.min(lo, c); hi = Math.max(hi, c); } });
        }
        const leftPad = lo, rightPad = grid[0].length - 1 - hi;
        assert.ok(Math.abs(leftPad - rightPad) <= 1, `${type}/${stage}: ${leftPad} empty columns left, ${rightPad} right`);
      }
    });
  }

  it("renderSpriteGrid centres the drawn grid inside the pet box", () => {
    const src = fs.readFileSync(path.join(media, "sprites.js"), "utf8");
    assert.match(src, /var gx = x \+ Math\.round\(\(bodyWidth - COLS \* cellW\) \/ 2\);/);
    assert.match(src, /gx \+ col \* cellW,/);
  });
});
