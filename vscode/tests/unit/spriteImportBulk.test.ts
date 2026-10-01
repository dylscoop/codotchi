import { describe, it, before, after } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vm from "vm";

// Tests for the bulk sprite pipeline (scripts/import_sprites_bulk.js):
// sprites/<species>/<stage>.png → vscode/media/sprites.generated.js.
// Fixture PNGs are drawn with the pipeline's own encoder into a temp folder.
const repoRoot = path.join(__dirname, "../../../..");
const media = path.join(repoRoot, "vscode", "media");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const lib = require(path.join(repoRoot, "scripts", "lib", "spriteImport.js"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bulk = require(path.join(repoRoot, "scripts", "import_sprites_bulk.js"));
lib.setLogger(null);

interface Rgba { r: number; g: number; b: number; a: number }
const CLEAR: Rgba = { r: 0, g: 0, b: 0, a: 0 };
const WHITE: Rgba = { r: 250, g: 250, b: 250, a: 255 };
const RED: Rgba = { r: 200, g: 20, b: 20, a: 255 };
const NAVY: Rgba = { r: 10, g: 10, b: 60, a: 255 };
const COLOURS: Record<string, Rgba> = { ".": CLEAR, W: WHITE, R: RED, N: NAVY };

/** Write a PNG from rows of colour letters (. W R N). */
function writePng(file: string, rows: string[]): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lib.encodePng(rows[0].length, rows.length, (x: number, y: number) => COLOURS[rows[y][x]]));
}

let tmp: string;
function freshDir(name: string): string {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function rowsOf(grid: number[][]): string[] { return grid.map((r) => r.join("")); }

before(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-bulk-")); });
after(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

describe("bulk sprite import", () => {
  it("pads every stage bottom-centre onto one shared grid", () => {
    const src = freshDir("shared");
    writePng(path.join(src, "pup", "baby.png"), ["WR", "WW"]);
    writePng(path.join(src, "pup", "adult.png"), ["WWWW", "WRRW", "NWWN"]);
    const { species } = bulk.generate(src);
    const pup = species[0];
    assert.equal(pup.cols, 4);
    assert.equal(pup.rows, 3);
    assert.deepEqual(rowsOf(pup.grids.baby), ["0000", "0120", "0110"]);
    assert.deepEqual(rowsOf(pup.grids.adult), ["1111", "1221", "3113"]);
  });

  it("crops the transparent border before sizing", () => {
    const src = freshDir("crop");
    writePng(path.join(src, "pup", "adult.png"), ["....", ".WR.", ".WW.", "...."]);
    const pup = bulk.generate(src).species[0];
    assert.equal(pup.cols, 2);
    assert.equal(pup.rows, 2);
  });

  it("keeps the canvas with crop:false and anchors left with anchor:left", () => {
    const src = freshDir("nocrop");
    writePng(path.join(src, "pup", "baby.png"), ["W.", "WW"]);
    writePng(path.join(src, "pup", "adult.png"), ["....", "WWWW"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ crop: false, anchor: "left" }));
    const pup = bulk.generate(src).species[0];
    assert.equal(pup.cols, 4);
    assert.deepEqual(rowsOf(pup.grids.baby), ["1000", "1100"]);
  });

  it("uses one palette for all stages, ranked by luminance", () => {
    const src = freshDir("palette");
    // Navy only appears in the adult; the baby still maps it to the shared index 3.
    writePng(path.join(src, "pup", "baby.png"), ["WR"]);
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    const pup = bulk.generate(src).species[0];
    assert.deepEqual(pup.palette, { primary: "#fafafa", secondary: "#c81414", accent: "#0a0a3c", background: "#1a1a1a" });
    assert.deepEqual(rowsOf(pup.grids.adult), ["123"]);
  });

  it("maps exact colours from sprite.json palette", () => {
    const src = freshDir("explicit");
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({
      palette: { primary: "#0a0a3c", secondary: "#fafafa", accent: "#c81414ff" },
    }));
    const pup = bulk.generate(src).species[0];
    assert.deepEqual(rowsOf(pup.grids.adult), ["231"]);
    assert.equal(pup.palette.accent, "#c81414");
  });

  it("mirrors every stage with flip:true", () => {
    const src = freshDir("flip");
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ flip: true }));
    assert.deepEqual(rowsOf(bulk.generate(src).species[0].grids.adult), ["321"]);
  });

  it("scales all stages by one factor so the largest fits 192×128", () => {
    const src = freshDir("cap");
    // One clear pixel stops the auto-background removal (fully-opaque, uniform corners).
    writePng(path.join(src, "big", "adult.png"), [".".concat("W".repeat(399))].concat(Array(99).fill("W".repeat(400))));
    writePng(path.join(src, "big", "baby.png"), [".".concat("W".repeat(199))].concat(Array(49).fill("W".repeat(200))));
    const big = bulk.generate(src).species[0];
    assert.equal(big.cols, 192);
    assert.equal(big.rows, 48);
    // baby keeps its half size inside the shared grid
    assert.equal(rowsOf(big.grids.baby).filter((r) => r.includes("1")).length, 24);
  });

  it("warns about missing stages and registration mismatches", () => {
    const src = freshDir("warn");
    writePng(path.join(src, "pup", "adult.png"), ["W"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ inRotation: true, passcode: "woof" }));
    const { species, warnings } = bulk.generate(src);
    assert.deepEqual(species[0].missing, ["baby", "child", "teen", "senior"]);
    assert.ok(warnings.some((w: string) => w.includes("missing baby, child, teen, senior")));
    assert.ok(warnings.some((w: string) => w.includes("ROTATION_ANIMALS")));
    assert.ok(warnings.some((w: string) => w.includes("customCharacters.js has no entry")));
  });

  it("picks up mood variants after the stages", () => {
    const src = freshDir("mood");
    writePng(path.join(src, "pup", "adult.png"), ["W"]);
    writePng(path.join(src, "pup", "adult_sleeping.png"), ["R"]);
    writePng(path.join(src, "pup", "notes.png"), ["N"]);
    assert.deepEqual(Object.keys(bulk.generate(src).species[0].grids), ["adult", "adult_sleeping"]);
  });

  it("rejects a species folder name that is not a valid spriteType", () => {
    const src = freshDir("badname");
    writePng(path.join(src, "Big Dog", "adult.png"), ["W"]);
    assert.throws(() => bulk.generate(src), /species folder names/);
  });

  it("produces the same output on every run", () => {
    const src = freshDir("determinism");
    writePng(path.join(src, "b", "adult.png"), ["WR"]);
    writePng(path.join(src, "a", "adult.png"), ["RW"]);
    const first = bulk.generate(src).text;
    assert.equal(bulk.generate(src).text, first);
    assert.ok(first.indexOf('DEFS["a"]') < first.indexOf('DEFS["b"]'), "species sorted by name");
  });

  it("emits a file that extends spriteConstants.js when loaded after it", () => {
    const src = freshDir("load");
    writePng(path.join(src, "pup", "adult.png"), ["WR", "WW"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ upright: true, legRowStart: 1 }));
    const window: Record<string, any> = {};
    const context = vm.createContext({ window });
    vm.runInContext(fs.readFileSync(path.join(media, "spriteConstants.js"), "utf8").replace(/^﻿/, ""), context);
    vm.runInContext(bulk.generate(src).text, context);
    assert.deepEqual([...window.GENERATED_SPRITE_DEFS.pup.adult], ["12", "11"]);
    assert.deepEqual({ ...window.SPRITE_GRID_META.pup }, { cols: 2, rows: 2, legRowStart: 1 });
    assert.equal(window.spriteGetPalette("pup").primary, "#fafafa");
    assert.equal(window.UPRIGHT_TYPES.pup, 1);
    assert.ok(window.SPRITE_GRID_META.classic, "existing entries are kept");
  });
});
