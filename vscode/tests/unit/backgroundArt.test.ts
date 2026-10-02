import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

// Checks for the canvas background art (vscode/media/backgroundArt.js) and how
// sidebar.js and both IDE loaders use it. PyCharm copies the same media files.
const root = path.join(__dirname, "../../../..");
const media = path.join(root, "vscode/media");
const artSource = fs.readFileSync(path.join(media, "backgroundArt.js"), "utf8");
const sidebarSource = fs.readFileSync(path.join(media, "sidebar.js"), "utf8");

function loadArt(): Record<string, any> {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  vm.runInContext(artSource.replace(/^﻿/, ""), context, { filename: "backgroundArt.js" });
  return window.backgroundArt as Record<string, any>;
}

/** Canvas 2D stand-in: counts calls and records every fillStyle assigned. */
function mockCtx(): { ctx: any; calls: Record<string, number>; styles: string[] } {
  const calls: Record<string, number> = {};
  const styles: string[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(target, key: string) {
      if (key in target) { return target[key]; }
      return () => { calls[key] = (calls[key] ?? 0) + 1; };
    },
    set(target, key: string, value) {
      if (key === "fillStyle" || key === "strokeStyle") { styles.push(String(value)); }
      target[key] = value;
      return true;
    },
  });
  return { ctx, calls, styles };
}

function at(hour: number, minute = 0, month = 9, day = 1): Date {
  return new Date(2026, month, day, hour, minute, 0);
}

function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Relative luminance, 0 (black) … 1 (white). */
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const art = loadArt();
const SEASONS = ["spring", "summer", "autumn", "winter"];

describe("background seasons and time of day (backgroundArt.js)", () => {
  it("ordered mode follows the real month; named modes are fixed", () => {
    const expected = ["winter", "winter", "spring", "spring", "spring", "summer",
                      "summer", "summer", "autumn", "autumn", "autumn", "winter"];
    for (let m = 0; m < 12; m++) {
      assert.equal(art.getActiveSeason("ordered", at(12, 0, m)), expected[m], `month ${m}`);
    }
    for (const mode of ["plain", ...SEASONS]) {
      assert.equal(art.getActiveSeason(mode, at(12, 0, 0)), mode);
    }
  });

  it("buckets the clock hour the same way as the legacy background", () => {
    const cases: Array<[number, string]> = [
      [6, "night"], [7, "dawn"], [9, "dawn"], [10, "morning"], [12, "morning"], [13, "afternoon"],
      [15, "afternoon"], [16, "sunset"], [18, "sunset"], [19, "dusk"], [21, "dusk"], [22, "night"], [0, "night"],
    ];
    for (const [h, tod] of cases) { assert.equal(art.getTimeOfDay(at(h)), tod, `hour ${h}`); }
    for (let h = 0; h < 24; h++) { assert.equal(art.getTimeOfDay(at(h)), art.legacyTimeOfDay(at(h)), `hour ${h}`); }
  });

  it("morning sky is light, not dusky", () => {
    for (const h of [10, 11, 12]) {
      const sky = art.skyColours(at(h, 30));
      assert.ok(luminance(sky.top) > 0.45, `top at ${h}:30 is ${sky.top}`);
      assert.ok(luminance(sky.bottom) > 0.5, `horizon at ${h}:30 is ${sky.bottom}`);
    }
    assert.ok(luminance(art.skyColours(at(23)).top) < 0.05, "night stays dark");
  });

  it("daytime sky has a gentle gradient, not a near-white horizon", () => {
    for (let h = 10; h <= 14; h++) {
      const sky = art.skyColours(at(h, 30));
      assert.ok(luminance(sky.bottom) < 0.7, `horizon at ${h}:30 is too white: ${sky.bottom}`);
      assert.ok(luminance(sky.bottom) - luminance(sky.top) < 0.15, `gradient at ${h}:30 is too strong`);
    }
  });

  it("sky blends minute by minute with no jumps", () => {
    let prev = art.skyColours(at(0, 0));
    for (let m = 1; m < 24 * 60; m++) {
      const cur = art.skyColours(at(Math.floor(m / 60), m % 60));
      for (const key of ["top", "bottom"]) {
        const a = rgb(prev[key]), b = rgb(cur[key]);
        const jump = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
        assert.ok(jump <= 12, `${key} jumps ${jump} at minute ${m}`);
      }
      prev = cur;
    }
  });

  it("the sunset bucket looks like sunset: warm horizon from 16:00", () => {
    const warm = (hex: string) => { const [r, , b] = rgb(hex); return r - b; };
    assert.ok(warm(art.skyColours(at(12)).bottom) < 0, "midday horizon is blue");
    assert.ok(warm(art.skyColours(at(16, 15)).bottom) > 40, "warm by 16:15");
    assert.ok(warm(art.skyColours(at(17, 30)).bottom) > 120, "full sunset at 17:30");
  });

  it("the dawn bucket has a sunrise that uses the sunset colours and ends at 10:00", () => {
    const warm = (hex: string) => { const [r, , b] = rgb(hex); return r - b; };
    for (const [h, m] of [[7, 30], [8, 0], [9, 0]]) {
      assert.ok(warm(art.skyColours(at(h, m)).bottom) > 120, `full sunrise at ${h}:${m}`);
    }
    assert.ok(warm(art.skyColours(at(9, 45)).bottom) > 0, "still warm at 09:45");
    assert.ok(warm(art.skyColours(at(10)).bottom) < 0, "blue at 10:00");
    assert.ok(warm(art.skyColours(at(11)).bottom) < 0, "blue at 11:00");
    assert.deepEqual(art.skyColours(at(8)), art.skyColours(at(17, 30)), "sunrise uses the sunset colours");
    const d = art.darkness(at(8));
    assert.ok(d > 0 && d < 1, "the scene brightens through the sunrise");
    assert.equal(art.darkness(at(9)), 0, "fully light by 09:00");
  });

  it("darkness is 0 by day and 1 at night", () => {
    assert.equal(art.darkness(at(12)), 0);
    assert.equal(art.darkness(at(2)), 1);
    const dusk = art.darkness(at(19));
    assert.ok(dusk > 0 && dusk < 1);
  });

  it("winter fairy lights are lit at dawn, morning, dusk and night only", () => {
    for (const h of [7, 9, 20, 23, 3]) { assert.equal(art.lightsOn(at(h)), true, `hour ${h}`); }
    for (const h of [13, 15, 17]) { assert.equal(art.lightsOn(at(h)), false, `hour ${h}`); }
  });
});

describe("background weather and critters (backgroundArt.js)", () => {
  const start = at(12).getTime();

  it("is deterministic for a given time", () => {
    for (let i = 0; i < 50; i++) {
      const d = new Date(start + i * 37000);
      assert.deepEqual(art.weather("spring", d), art.weather("spring", d));
      assert.deepEqual(art.critter("bird", d.getTime()), art.critter("bird", d.getTime()));
    }
  });

  it("spring showers and winter snow are occasional, not constant", () => {
    let rain = 0, snow = 0;
    const n = 2000;
    for (let w = 0; w < n; w++) {
      if (art.weather("spring", new Date(start + w * art.RAIN_MS + 1000)).raining) { rain++; }
      if (art.weather("winter", new Date(start + w * art.SNOW_MS + 1000)).snowing) { snow++; }
    }
    assert.ok(Math.abs(rain / n - art.RAIN_CHANCE) < 0.05, `rain share ${rain / n}`);
    assert.ok(Math.abs(snow / n - art.SNOW_CHANCE) < 0.05, `snow share ${snow / n}`);
    assert.equal(art.weather("summer", new Date(start)).raining, false);
    assert.equal(art.weather("spring", new Date(start)).snowing, false);
  });

  it("a rainbow only follows a shower", () => {
    let seen = 0;
    for (let w = 1; w < 3000; w++) {
      const d = new Date(start + w * art.RAIN_MS + 10000);
      if (!art.weather("spring", d).rainbow) { continue; }
      seen++;
      const before = new Date(d.getTime() - art.RAIN_MS);
      assert.equal(art.weather("spring", before).raining, true);
    }
    assert.ok(seen > 0, "expected at least one rainbow");
  });

  it("critters are rare", () => {
    for (const kind of Object.keys(art.CRITTERS)) {
      const c = art.CRITTERS[kind];
      let on = 0;
      const samples = 20000;
      for (let i = 0; i < samples; i++) {
        if (art.critter(kind, start + i * 1000)) { on++; }
      }
      const share = on / samples;
      assert.ok(share > 0, `${kind} never appears`);
      assert.ok(share < (c.chance * c.durMs) / c.windowMs * 2, `${kind} shows ${share} of the time`);
    }
  });
});

describe("background drawing (backgroundArt.js)", () => {
  it("draws every season at every hour with fillRect only", () => {
    for (const season of SEASONS) {
      for (let h = 0; h < 24; h++) {
        for (const [W, H] of [[200, 150], [320, 180], [480, 240]]) {
          const { ctx, calls } = mockCtx();
          art.drawBackground(ctx, W, H, season, at(h, 15));
          assert.ok((calls.fillRect ?? 0) > 50, `${season} ${h}h ${W}x${H} drew ${calls.fillRect}`);
          assert.equal(calls.arc, undefined, "pixel art only: no arc()");
          assert.equal(calls.beginPath, undefined);
        }
      }
    }
  });

  it("plain mode draws only the ground strip", () => {
    const { ctx, calls, styles } = mockCtx();
    art.drawBackground(ctx, 320, 180, "plain", at(9));
    assert.equal(calls.fillRect, 2);
    assert.deepEqual(styles, ["#2a2a3a", "#3a3a4e"]);
  });

  it("each season has its own scenery", () => {
    const has = (season: string, colour: string, h = 9) => {
      const { ctx, styles } = mockCtx();
      art.drawBackground(ctx, 320, 180, season, at(h));
      return styles.includes(colour);
    };
    assert.ok(has("spring", "#f2b6cb"), "blossom tree");
    assert.ok(has("summer", "#f8d020"), "sunflower");
    assert.ok(has("summer", "#d84040"), "picnic blanket");
    assert.ok(has("autumn", "#e87a20"), "pumpkin");
    assert.ok(has("autumn", "#d03028"), "toadstool");
    assert.ok(has("winter", "#f08a24"), "snowman carrot");
    // Light colours rotate with the epoch time, so look for any of them (time-zone independent).
    const lit = (h: number) => ["#ff5050", "#ffd040", "#50a0ff", "#60e070"].some((c) => has("winter", c, h));
    assert.ok(lit(9), "fairy lights on in the morning");
    assert.ok(!lit(14), "fairy lights off in the afternoon");
  });

  it("keeps trees at the edges and only one on narrow canvases", () => {
    const wide = art.layout("summer", 320, 180);
    assert.equal(wide.trees.length, 2);
    assert.ok(wide.trees[0].x < 320 * 0.15 && wide.trees[1].x + wide.trees[1].w > 320 * 0.85);
    assert.equal(art.layout("summer", 200, 150).trees.length, 1);
    assert.equal(art.layout("winter", 200, 150).trees[0].kind, "pine");
  });

  it("layout is stable between frames", () => {
    const a = JSON.stringify(art.layout("spring", 300, 180));
    art.layout("autumn", 300, 180);
    assert.equal(JSON.stringify(art.layout("spring", 300, 180)), a);
  });
});

describe("background opacity and still mode (backgroundArt.js)", () => {
  /** Full-canvas fills in draw order, as [fillStyle, globalAlpha]. */
  function fullFills(opts: Record<string, unknown> | undefined, date = at(12)) {
    const fills: Array<[string, number]> = [];
    const props: Record<string, any> = { globalAlpha: 1 };
    const stack: number[] = [];
    const ctx = new Proxy(props, {
      get(target, key: string) {
        if (key === "save") { return () => stack.push(target.globalAlpha); }
        if (key === "restore") { return () => { target.globalAlpha = stack.pop(); }; }
        if (key === "fillRect") {
          return (x: number, y: number, w: number, h: number) => {
            if (x === 0 && y === 0 && w === 320 && h === 180) { fills.push([target.fillStyle, target.globalAlpha]); }
          };
        }
        if (key in target) { return target[key]; }
        return () => {};
      },
      set(target, key: string, value) { target[key] = value; return true; },
    });
    art.drawBackground(ctx, 320, 180, "summer", date, opts);
    return fills;
  }

  it("veil strength: vivid none, medium default, subtle strongest; lighter at night", () => {
    assert.equal(art.veilAlpha("vivid", at(12)), 0);
    assert.equal(art.veilAlpha("vivid", at(2)), 0);
    assert.ok(Math.abs(art.veilAlpha("medium", at(12)) - 0.10) < 1e-9);
    assert.ok(Math.abs(art.veilAlpha("medium", at(2)) - 0.05) < 1e-9);
    assert.ok(art.veilAlpha("subtle", at(12)) > art.veilAlpha("medium", at(12)));
    assert.equal(art.veilAlpha(undefined, at(12)), art.veilAlpha("medium", at(12)));
    assert.equal(art.veilAlpha("bogus", at(12)), art.veilAlpha("medium", at(12)));
  });

  it("lays the pet backdrop over the scene, except in vivid", () => {
    assert.deepEqual(fullFills({ opacity: "medium", backdrop: "#123456" }), [["#123456", 0.1]]);
    assert.deepEqual(fullFills({ opacity: "vivid", backdrop: "#123456" }), []);
    assert.equal(fullFills(undefined).length, 1, "no options means medium");
  });

  it("vivid draws exactly the unveiled scene", () => {
    const a = mockCtx(), b = mockCtx();
    art.drawBackground(a.ctx, 320, 180, "autumn", at(12), { opacity: "vivid" });
    art.drawBackground(b.ctx, 320, 180, "autumn", at(12), { opacity: "medium", backdrop: "#1a1a1a" });
    assert.equal((b.calls.fillRect ?? 0) - (a.calls.fillRect ?? 0), 1, "medium adds only the veil");
  });

  it("still mode draws the same frame whatever the time, with no weather or critters", () => {
    const frame = (ms: number) => {
      const m = mockCtx();
      art.drawBackground(m.ctx, 320, 180, "winter", new Date(at(9).getTime() + ms), { animate: false });
      return m.styles.join(",");
    };
    assert.equal(frame(0), frame(1234), "clouds, stars and lights don't move");
    // Find a snowy, animated frame, then check the still frame has no snowflakes.
    let snowy = at(9);
    for (let w = 0; w < 200 && !art.weather("winter", snowy).snowing; w++) { snowy = new Date(snowy.getTime() + art.SNOW_MS); }
    const anim = mockCtx(), still = mockCtx();
    art.drawBackground(anim.ctx, 320, 180, "winter", snowy, { animate: true });
    art.drawBackground(still.ctx, 320, 180, "winter", snowy, { animate: false });
    assert.ok((anim.calls.fillRect ?? 0) > (still.calls.fillRect ?? 0));
  });
});

describe("legacy background style (backgroundArt.js)", () => {
  it("uses the pre-2.25 clock buckets", () => {
    const cases: Array<[number, string]> = [
      [6, "night"], [7, "dawn"], [9, "dawn"], [10, "morning"], [12, "morning"], [13, "afternoon"],
      [16, "sunset"], [18, "sunset"], [19, "dusk"], [21, "dusk"], [22, "night"], [2, "night"],
    ];
    for (const [h, tod] of cases) { assert.equal(art.legacyTimeOfDay(at(h)), tod, `${h}:00`); }
  });

  it("fills its own base: #243444 by day, the pet backdrop otherwise", () => {
    const day = mockCtx(), night = mockCtx();
    art.drawLegacyBackground(day.ctx, 200, 150, "summer", at(11), "#123456");
    art.drawLegacyBackground(night.ctx, 200, 150, "summer", at(23), "#123456");
    assert.equal(day.styles[0], "#243444");
    assert.equal(night.styles[0], "#123456");
  });

  it("keeps the old seasonal ground colours and props", () => {
    const ground: Record<string, string> = { spring: "#5ec44a", summer: "#4caf30", autumn: "#c86820", winter: "#d8e8f0" };
    const prop: Record<string, string> = { spring: "#e87898", summer: "#f8d020", autumn: "#e88020", winter: "#e8f0f8" };
    for (const season of SEASONS) {
      const m = mockCtx();
      art.drawLegacyBackground(m.ctx, 200, 150, season, at(11), "#1a1a1a");
      assert.ok(m.styles.includes(ground[season]), season + " ground");
      assert.ok(m.styles.includes(prop[season]), season + " props");
      assert.ok(!m.styles.includes("#a9cdea"), season + ": no scenic sky");
    }
  });

  it("ordered follows the month, and plain draws only the ground strip", () => {
    const m = mockCtx();
    art.drawLegacyBackground(m.ctx, 200, 150, "ordered", at(11, 0, 0), "#1a1a1a");
    assert.ok(m.styles.includes("#d8e8f0"), "January is winter");
    const plain = mockCtx();
    art.drawLegacyBackground(plain.ctx, 200, 150, "plain", at(23), "#1a1a1a");
    assert.deepEqual(plain.styles, ["#1a1a1a", "#2a2a3a", "#3a3a4e"]);
  });

  it("draws one static frame: the same calls at any second of the hour", () => {
    const frame = (ms: number) => {
      const m = mockCtx();
      art.drawLegacyBackground(m.ctx, 200, 150, "autumn", new Date(at(17).getTime() + ms), "#1a1a1a");
      return m.styles.join(",") + JSON.stringify(m.calls);
    };
    assert.equal(frame(0), frame(59 * 60 * 1000));
  });
});

describe("autumn pumpkin, snacks and poos stand out", () => {
  it("autumn has a single pumpkin, at the side of the stage", () => {
    for (const W of [320, 160]) {
      const pumpkins = art.layout("autumn", W, 180).props.filter((p: { kind: string }) => p.kind === "pumpkin");
      assert.equal(pumpkins.length, 1, `one pumpkin at width ${W}`);
      const x = pumpkins[0].x;
      assert.ok(x < 0.3 * W || x > 0.7 * W, `pumpkin at x=${x} is in the middle of a ${W}px stage`);
    }
  });

  it("snacks and poos are drawn at scale 3 with an outline", () => {
    assert.match(sidebarSource, /var SNACK_SCALE = 3;/);
    assert.match(sidebarSource, /var POO_SCALE = 3;/);
    assert.match(sidebarSource, /var SS = SNACK_SCALE;/);
    assert.match(sidebarSource, /var PS = POO_SCALE;/);
    assert.match(sidebarSource, /drawGridOutline\(spx, sX, sY, SS,/);
    assert.match(sidebarSource, /drawGridOutline\(POO_PIXELS, pooX, pooGroundY, PS,/);
  });

  it("the pet aims at the centre of the bigger snack", () => {
    assert.doesNotMatch(sidebarSource, /\.x \+ 4\)/);
    assert.equal((sidebarSource.match(/\.x \+ SNACK_HALF_W\)/g) || []).length, 6);
  });
});

describe("background wiring", () => {
  it("sidebar.js draws through backgroundArt and has no old background code", () => {
    assert.match(sidebarSource, /window\.backgroundArt\.drawBackground\(spriteCtx, W, H, BG_MODE, new Date\(\),/);
    assert.doesNotMatch(sidebarSource, /function drawBackground|function getTimeOfDay|#243444/);
    assert.match(sidebarSource, /BG_STYLE === "legacy"[\s\S]{0,120}drawLegacyBackground\(spriteCtx, W, H, BG_MODE, new Date\(\), background\)/);
  });

  it("passes the opacity and animation settings through in both IDEs", () => {
    assert.match(sidebarSource, /{ opacity: BG_OPACITY, backdrop: background, animate: BG_ANIMATE }/);
    assert.match(sidebarSource, /const BG_ANIMATE = !REDUCED_MOTION/);
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    assert.match(html, /data-background-style="{{backgroundStyle}}"/);
    assert.match(html, /data-background-opacity="{{backgroundOpacity}}"/);
    assert.match(html, /data-background-animations="{{backgroundAnimations}}"/);
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "vscode/package.json"), "utf8"));
    const main = pkg.contributes.configuration[0].properties;
    assert.deepEqual(main["codotchi.backgroundOpacity"].enum, ["subtle", "medium", "vivid"]);
    assert.equal(main["codotchi.backgroundOpacity"].default, "medium");
    assert.deepEqual(main["codotchi.backgroundStyle"].enum, ["scenic", "legacy"]);
    assert.equal(main["codotchi.backgroundStyle"].default, "scenic");
    assert.equal(main["codotchi.backgroundAnimations"].type, "boolean");
    assert.equal(main["codotchi.backgroundAnimations"].default, true);
    const provider = fs.readFileSync(path.join(root, "vscode/src/sidebarProvider.ts"), "utf8");
    assert.match(provider, /{{backgroundStyle}}/);
    assert.match(provider, /{{backgroundOpacity}}/);
    assert.match(provider, /{{backgroundAnimations}}/);
    const panel = fs.readFileSync(path.join(root, "pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt"), "utf8");
    assert.match(panel, /{{backgroundStyle}}/);
    assert.match(panel, /{{backgroundOpacity}}/);
    assert.match(panel, /{{backgroundAnimations}}/);
    const settings = fs.readFileSync(path.join(root, "pycharm/src/main/kotlin/com/codotchi/CodotchiSettings.kt"), "utf8");
    assert.match(settings, /var backgroundStyle: String = "scenic"/);
    assert.match(settings, /var backgroundOpacity: String = "medium"/);
    assert.match(settings, /var backgroundAnimations: Boolean = true/);
  });

  it("both IDEs load backgroundArt.js", () => {
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    assert.match(html, /<script src="\{\{backgroundArtUri\}\}"><\/script>/);
    const provider = fs.readFileSync(path.join(root, "vscode/src/sidebarProvider.ts"), "utf8");
    assert.match(provider, /\{\{backgroundArtUri\}\}/);
    const panel = fs.readFileSync(path.join(root, "pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt"), "utf8");
    assert.match(panel, /\/webview\/backgroundArt\.js/);
    const gradle = fs.readFileSync(path.join(root, "pycharm/build.gradle.kts"), "utf8");
    assert.match(gradle, /"backgroundArt\.js"/);
  });

  it("the sprite preview can show backgrounds in both IDEs", () => {
    const preview = fs.readFileSync(path.join(media, "sprite_preview.html"), "utf8");
    assert.match(preview, /<script src="backgroundArt\.js"><\/script>/);
    assert.match(preview, /id="bg-canvas"/);
    assert.match(preview, /id="bg-style"/);
    assert.match(preview, /drawLegacyBackground/);
    const vsPanel = fs.readFileSync(path.join(root, "vscode/src/spritePreviewPanel.ts"), "utf8");
    assert.match(vsPanel, /backgroundArt\.js/);
    const pyPanel = fs.readFileSync(path.join(root, "pycharm/src/main/kotlin/com/codotchi/SpritePreviewBrowserPanel.kt"), "utf8");
    assert.match(pyPanel, /\/webview\/backgroundArt\.js/);
  });
});
