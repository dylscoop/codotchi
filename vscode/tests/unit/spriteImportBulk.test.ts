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
  it("detects separate legs near the feet and alternates their walk groups", () => {
    const g = (rows: string[]) => rows.map((r) => r.split("").map(Number));
    const grid = g([
      "1111111111111",
      "1111111111111",
      "1100110011000",
      "1100110011000",
      "1100110011003",   // a 1-row tail tip on the floor is not a leg
    ]);
    assert.deepEqual(bulk.detectLegs(grid, 2), [[0, 1, 0], [4, 5, 1], [8, 9, 0]]);
    assert.deepEqual(bulk.detectLegs(g(["111", "111", "111"]), 1), []);
  });

  it("writes legs into SPRITE_GRID_META and lets sprite.json override them", () => {
    const src = freshDir("legs");
    const body = "WWWWWWWWWWWWWWWW";
    const feet = "WW..WW..WW.W..WW";
    writePng(path.join(src, "pup", "adult.png"), [body, body, feet, feet, feet, feet]);
    writePng(path.join(src, "pup", "child.png"), [body, body, feet, feet, feet, feet]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"),
      JSON.stringify({ legRowStart: 2, legs: { child: [[0, 3, 1], [8, 11, 0]] } }));
    const out = bulk.generate(src);
    const pup = out.species[0];
    assert.deepEqual(pup.legs.adult, [[0, 1, 0], [4, 5, 1], [8, 11, 0], [14, 15, 1]]);
    assert.deepEqual(pup.legs.child, [[0, 3, 1], [8, 11, 0]]);
    assert.ok(out.text.includes('legs: { "child": [[0,3,1],[8,11,0]], "adult": [[0,1,0],[4,5,1],[8,11,0],[14,15,1]] }'));
  });

  it("rejects a malformed legs override", () => {
    const src = freshDir("badlegs");
    writePng(path.join(src, "pup", "adult.png"), ["WW", "WW"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ legs: { adult: [[0, 5, 2]] } }));
    assert.throws(() => bulk.generate(src), /legs\.adult/);
  });
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

  it("mirrors only the listed stages with a flip list", () => {
    const src = freshDir("flip-list");
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    writePng(path.join(src, "pup", "child.png"), ["WRN"]);
    writePng(path.join(src, "pup", "senior_lying.png"), ["WRN"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ flip: ["adult", "senior"] }));
    const pup = bulk.generate(src).species[0];
    assert.deepEqual(rowsOf(pup.grids.adult), ["321"]);
    assert.deepEqual(rowsOf(pup.grids.child), ["123"]);
    assert.deepEqual(rowsOf(pup.grids.senior_lying), ["321"], "a stage in the list mirrors its mood grids too");
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ flip: ["elder"] }));
    assert.throws(() => bulk.generate(src), /flip has unknown stage "elder"/);
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

  it("peels a framed background layer by layer and keeps interior matches", () => {
    const src = freshDir("frame");
    // Red frame around a white background; the navy pet has a white eye.
    writePng(path.join(src, "pup", "adult.png"), [
      "RRRRRRR",
      "RWWWWWR",
      "RWWNWWR",
      "RWNWNWR",
      "RWNNNWR",
      "RWWWWWR",
      "RRRRRRR",
    ]);
    const pup = bulk.generate(src).species[0];
    // Frame and white background go; the pet keeps its white eye.
    assert.equal(pup.cols, 3);
    assert.equal(pup.rows, 3);
    const g = rowsOf(pup.grids.adult);
    assert.equal(g[0][0], "0");
    assert.equal(g[0][2], "0");
    assert.ok(g[1][1] !== "0", "interior white eye is kept");
  });

  it("stops peeling once a layer leaves the sprite shape", () => {
    const src = freshDir("frame2");
    writePng(path.join(src, "pup", "adult.png"), [
      "WWWWW",
      "WNNNW",
      "WNRNW",
      "WN.NW",
      "WWWWW",
    ]);
    // Has a transparent pixel, so it's not an opaque background: untouched apart from crop.
    assert.equal(bulk.generate(src).species[0].cols, 5);
  });

  it("picks distinct colours, not near-identical shades", () => {
    const src = freshDir("distinct");
    // Lots of near-black shades and a smaller tan patch: the tan must survive.
    const shades = [[10, 10, 10], [14, 12, 11], [18, 16, 14], [22, 20, 18]];
    const rows: Rgba[][] = [];
    for (let y = 0; y < 10; y++) {
      const row: Rgba[] = [];
      for (let x = 0; x < 10; x++) {
        const [r, g, b] = y >= 8 ? [210, 160, 100] : shades[(x + y) % 4];
        row.push({ r, g, b, a: 255 });
      }
      rows.push(row);
    }
    rows[0][0] = CLEAR;
    fs.mkdirSync(path.join(src, "pup"), { recursive: true });
    fs.writeFileSync(path.join(src, "pup", "adult.png"), lib.encodePng(10, 10, (x: number, y: number) => rows[y][x]));
    const pup = bulk.generate(src).species[0];
    const g = rowsOf(pup.grids.adult);
    assert.notEqual(g[9][5], g[4][5], "tan and black map to different indices");
    assert.equal(pup.palette.primary, "#d2a064");
  });

  it("enlarges one stage with stageScale", () => {
    const src = freshDir("stagescale");
    writePng(path.join(src, "pup", "baby.png"), ["WR", "WW"]);
    writePng(path.join(src, "pup", "adult.png"), ["WWWWWW", "WRRWWW", "NWWNWW", "WWWWWW", "WWWWWW", "WWWWWW"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ stageScale: { baby: 3 } }));
    const pup = bulk.generate(src).species[0];
    assert.equal(pup.cols, 6);
    assert.equal(rowsOf(pup.grids.baby).filter((r) => r.includes("1")).length, 6);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ stageScale: { elder: 2 } }));
    assert.throws(() => bulk.generate(src), /unknown stage "elder"/);
  });

  it("scales one grid key with stageScale, overriding its stage", () => {
    const src = freshDir("stagescale-key");
    writePng(path.join(src, "pup", "adult.png"), ["WWWWWW", "WRRWWW", "NWWNWW", "WWWWWW", "WWWWWW", "WWWWWW"]);
    writePng(path.join(src, "pup", "senior_lying.png"), ["WR", "WW"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ stageScale: { senior: 2, senior_lying: 3 } }));
    const pup = bulk.generate(src).species[0];
    assert.equal(pup.cols, 6);
    assert.equal(rowsOf(pup.grids.senior_lying).filter((r) => r.includes("1")).length, 6);
  });

  it("removes large enclosed background pockets but keeps small ones", () => {
    const src = freshDir("pocket");
    const big = 30;
    const rows: string[] = [];
    for (let y = 0; y < big; y++) {
      let r = "";
      for (let x = 0; x < big; x++) {
        const ring = x >= 2 && x < 28 && y >= 2 && y < 28 && (x < 5 || x >= 25 || y < 5 || y >= 25);
        const eye = x === 3 && y === 3;
        r += eye ? "W" : ring ? "N" : "W";
      }
      rows.push(r);
    }
    writePng(path.join(src, "pup", "adult.png"), rows);
    const g = rowsOf(bulk.generate(src).species[0].grids.adult);
    assert.equal(g[12][12], "0", "20×20 enclosed white pocket is removed");
    assert.notEqual(g[1][1], "0", "single enclosed white pixel (eye) is kept");
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

  it("keeps one palette and no byStage without perStagePalette", () => {
    const src = freshDir("nostage");
    writePng(path.join(src, "pup", "baby.png"), ["WR"]);
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    const { species, text } = bulk.generate(src);
    assert.deepEqual(species[0].byStage, {});
    assert.ok(!text.includes("byStage"));
  });

  it("auto-detects a palette per stage with perStagePalette:true", () => {
    const src = freshDir("perstage");
    // baby is red/navy only; adult is white/red/navy
    writePng(path.join(src, "pup", "baby.png"), ["RN"]);
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    writePng(path.join(src, "pup", "adult_sleeping.png"), ["WWN"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ perStagePalette: true }));
    const pup = bulk.generate(src).species[0];
    // baby: red brightest → 1, navy → 2
    assert.deepEqual(rowsOf(pup.grids.baby), ["120"]);
    assert.deepEqual(pup.byStage.baby, { primary: "#c81414", secondary: "#0a0a3c", accent: "#222222" });
    // adult + adult_sleeping share a palette identical to the species one → no byStage entry
    assert.deepEqual(rowsOf(pup.grids.adult), ["123"]);
    assert.deepEqual(rowsOf(pup.grids.adult_sleeping), ["113"]);
    assert.equal(pup.byStage.adult, undefined);
  });

  it("uses palettes.<stage> exact colours over auto-detection", () => {
    const src = freshDir("stageexplicit");
    writePng(path.join(src, "pup", "baby.png"), ["WR"]);
    writePng(path.join(src, "pup", "adult.png"), ["WR"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({
      palettes: { baby: { primary: "#c81414", secondary: "#fafafa" } },
    }));
    const pup = bulk.generate(src).species[0];
    assert.deepEqual(rowsOf(pup.grids.baby), ["21"]);
    assert.deepEqual(rowsOf(pup.grids.adult), ["12"]);
    assert.equal(pup.byStage.baby.primary, "#c81414");
  });

  it("rejects an unknown stage in palettes", () => {
    const src = freshDir("badstage");
    writePng(path.join(src, "pup", "adult.png"), ["W"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ palettes: { elder: { primary: "#fff" } } }));
    assert.throws(() => bulk.generate(src), /unknown stage "elder"/);
  });

  it("spriteGetPalette returns stage colours from byStage", () => {
    const src = freshDir("stageload");
    writePng(path.join(src, "pup", "baby.png"), ["RN"]);
    writePng(path.join(src, "pup", "adult.png"), ["WRN"]);
    fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ perStagePalette: true, background: "#101010" }));
    const window: Record<string, any> = {};
    const context = vm.createContext({ window });
    vm.runInContext(fs.readFileSync(path.join(media, "spriteConstants.js"), "utf8").replace(/^﻿/, ""), context);
    vm.runInContext(bulk.generate(src).text, context);
    assert.equal(window.spriteGetPalette("pup").primary, "#fafafa");
    assert.equal(window.spriteGetPalette("pup", "adult").primary, "#fafafa");
    const baby = window.spriteGetPalette("pup", "baby");
    assert.equal(baby.primary, "#c81414");
    assert.equal(baby.background, "#101010");
    assert.equal(window.spriteGetPalette("nope", "baby"), window.spriteGetPalette("classic"));
  });

  describe("detailed colours (sprite.json colors)", () => {
    /** One row of n clearly different opaque colours (a grey ramp). */
    function rampPng(file: string, n: number): void {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, lib.encodePng(n, 1, (x: number) => {
        const v = Math.round(10 + x * (235 / (n - 1)));
        return { r: v, g: v, b: v, a: 255 };
      }));
    }

    it("quantises a stage to n colours: indices 1-3, then 6+ as base-36 extra colours", () => {
      const src = freshDir("colors");
      rampPng(path.join(src, "pup", "adult.png"), 13);
      writePng(path.join(src, "pup", "baby.png"), ["WR"]);
      fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ crop: false, colors: { adult: 13 } }));
      const { species, text } = bulk.generate(src);
      const pup = species[0];
      const cells = pup.grids.adult[0];
      assert.equal(new Set(cells).size, 13);
      assert.ok(cells.every((v: number) => (v >= 1 && v <= 3) || (v >= 6 && v <= 15)), cells.join(","));
      assert.ok(!cells.includes(4) && !cells.includes(5), "4/5 stay reserved for gold");
      assert.equal(pup.byStage.adult.extra.length, 10);
      assert.equal(pup.byStage.baby, undefined, "a 3-colour stage is unchanged");
      assert.ok(/"[0-9a-f]*[a-f][0-9a-f]*" \/\/0/.test(text), "indices 10+ are written as letters");

      // The webview parses the letters back and getPalette hands over the extra colours.
      const window: Record<string, any> = {};
      const context = vm.createContext({ window });
      vm.runInContext(fs.readFileSync(path.join(media, "spriteConstants.js"), "utf8").replace(/^﻿/, ""), context);
      vm.runInContext(text, context);
      vm.runInContext(fs.readFileSync(path.join(media, "sprites.js"), "utf8").replace(/^﻿/, ""), context);
      assert.deepEqual([...window.SPRITES.pup.adult[0]], cells);
      assert.deepEqual([...window.spriteGetPalette("pup", "adult").extra], pup.byStage.adult.extra);
      assert.equal(window.spriteGetPalette("pup", "baby").extra, undefined);
    });

    it("keeps the three most common colours as primary/secondary/accent", () => {
      const src = freshDir("colorsrank");
      // white ×4, red ×3, navy ×2, then one pixel each of two greys
      fs.mkdirSync(path.join(src, "pup"), { recursive: true });
      const px: Rgba[] = [WHITE, WHITE, WHITE, WHITE, RED, RED, RED, NAVY, NAVY,
        { r: 120, g: 120, b: 120, a: 255 }, { r: 60, g: 200, b: 60, a: 255 }];
      fs.writeFileSync(path.join(src, "pup", "adult.png"), lib.encodePng(px.length, 1, (x: number) => px[x]));
      fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ crop: false, colors: 5 }));
      const pal = bulk.generate(src).species[0].byStage.adult;
      assert.deepEqual([pal.primary, pal.secondary, pal.accent], ["#fafafa", "#c81414", "#0a0a3c"]);
      assert.equal(pal.extra.length, 2);
    });

    it("averages source pixels when shrinking a multi-colour stage", () => {
      const img = { width: 2, height: 1, pixels: [[RED, { r: 0, g: 0, b: 0, a: 0 }]] };
      // transparent pixels don't darken the colour, only lower the alpha
      assert.deepEqual(lib.resampleArea(img, 1, 1).pixels[0][0], { r: 200, g: 20, b: 20, a: 128 });
      const two = { width: 2, height: 1, pixels: [[WHITE, NAVY]] };
      assert.deepEqual(lib.resampleArea(two, 1, 1).pixels[0][0], { r: 130, g: 130, b: 155, a: 255 });
    });

    it("rejects a bad colors setting", () => {
      const src = freshDir("badcolors");
      writePng(path.join(src, "pup", "adult.png"), ["WR"]);
      fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ colors: { adult: 40 } }));
      assert.throws(() => bulk.generate(src), /colors\.adult must be a whole number from 3 to 33/);
      fs.writeFileSync(path.join(src, "pup", "sprite.json"), JSON.stringify({ colors: { elder: 8 } }));
      assert.throws(() => bulk.generate(src), /colors has unknown stage "elder"/);
      fs.writeFileSync(path.join(src, "pup", "sprite.json"),
        JSON.stringify({ colors: { adult: 8 }, palettes: { adult: { primary: "#ffffff" } } }));
      assert.throws(() => bulk.generate(src), /both colors and palettes/);
    });
  });
});
