import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

// Checks for the mini-game pixel art (vscode/media/minigameArt.js) and how
// sidebar.js uses it. PyCharm copies the same vscode/media files at build time.
const media = path.join(__dirname, "../../../media");
const sidebarSource = fs.readFileSync(path.join(media, "sidebar.js"), "utf8");
const artSource = fs.readFileSync(path.join(media, "minigameArt.js"), "utf8");

function loadArt(): Record<string, any> {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  vm.runInContext(artSource.replace(/^﻿/, ""), context, { filename: "minigameArt.js" });
  return window.minigameArt as Record<string, any>;
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

const PALETTE = { primary: "#88cc66", secondary: "#557744" };

describe("mini-game bitmap font (minigameArt.js)", () => {
  it("has a glyph for every digit and the symbols the games use", () => {
    const art = loadArt();
    for (const ch of "0123456789?!✓✗^vLEFTRIGHAJQK♥♦♠♣") {
      const g = art.GLYPHS[ch];
      assert.ok(g, `missing glyph ${ch}`);
      assert.equal(g.length, 5, `${ch} should be 5 rows`);
      assert.ok(g.every((row: string) => row.length === g[0].length && /^[01]+$/.test(row)), `${ch} rows uneven`);
    }
  });

  it("measures text with a one-column gap between glyphs", () => {
    const art = loadArt();
    assert.equal(art.textWidth("1", 2), 3 * 2);
    assert.equal(art.textWidth("100", 2), (3 + 1 + 3 + 1 + 3) * 2);
    assert.equal(art.textWidth("✓", 3), 5 * 3);
  });

  it("draws only the lit pixels", () => {
    const art = loadArt();
    const { ctx, calls } = mockCtx();
    art.drawText(ctx, "8", 0, 0, 1, "#fff");
    const lit = art.GLYPHS["8"].join("").split("").filter((c: string) => c === "1").length;
    assert.equal(calls["fillRect"], lit);
  });
});

describe("mini-game art pieces (minigameArt.js)", () => {
  it("draws a door in every state, with the pet's face only behind an open door", () => {
    const art = loadArt();
    for (const state of ["closed", "ajar", "open"]) {
      const { ctx, calls, styles } = mockCtx();
      art.drawDoor(ctx, { x: 0, y: 0, w: 60, h: 120 }, { state, hinge: "left", palette: PALETTE });
      // closed: frame, planks, knob and "?"; ajar: frame, room, half panel
      assert.ok(calls["fillRect"] >= (state === "closed" ? 10 : 5), `${state} door drew ${calls["fillRect"]} rects`);
      assert.equal(styles.includes(PALETTE.primary), state === "open", `face colour in ${state} door`);
    }
  });

  it("keeps a door inside its box and on whole pixels", () => {
    const art = loadArt();
    const { ctx } = mockCtx();
    const box = { x: 10, y: 20, w: 63, h: 125 };
    const d = art.drawDoor(ctx, box, { state: "closed", hinge: "right" });
    assert.ok(d.x >= box.x && d.x + d.w <= box.x + box.w);
    assert.ok(d.y >= box.y && d.y + d.h <= box.y + box.h);
    assert.equal(d.w % d.px, 0);
  });

  it("draws both doors and their labels for guessing and both reveal frames", () => {
    const art = loadArt();
    for (const reveal of [null,
      { petSide: "left", choice: "left", won: true, open: "ajar" },
      { petSide: "right", choice: "left", won: false, open: "open" },
      { petSide: "left", choice: null, won: false, open: "open" }]) {
      const { ctx, styles } = mockCtx();
      const doors = art.drawDoors(ctx, 260, 180, reveal, PALETTE);
      assert.equal(doors.length, 2);
      assert.ok(doors[0].x + doors[0].w <= doors[1].x, "doors overlap");
      if (reveal && reveal.choice) {
        assert.ok(styles.includes(reveal.won ? art.COLOURS.good : art.COLOURS.bad), "chosen label not tinted");
      }
    }
  });

  it("draws the number card for 1-, 2- and 3-digit numbers with a fixed width", () => {
    const art = loadArt();
    const widths = new Set<number>();
    for (const n of [7, 42, 100]) {
      for (const flash of [null, { correct: true, dir: "up" }, { correct: false, dir: "down" }]) {
        const { ctx, calls } = mockCtx();
        const card = art.drawNumberCard(ctx, 260, 180, n, flash);
        assert.ok(calls["fillRect"] > 10);
        assert.ok(card.x >= 0 && card.x + card.w <= 260, "card off canvas");
        widths.add(card.w);
      }
    }
    assert.equal(widths.size, 1, "card width changes with the number");
  });

  it("spins the coin through every frame and ends face-on", () => {
    const art = loadArt();
    const frames: number[] = art.coinFrames(800);
    assert.equal(frames[frames.length - 1], 0);
    for (let f = 0; f < art.COIN_WIDTHS.length; f++) { assert.ok(frames.includes(f), `frame ${f} unused`); }
    for (let f = 0; f < art.COIN_WIDTHS.length; f++) {
      for (const face of ["heads", "tails"]) {
        const { ctx, calls } = mockCtx();
        const c = art.drawCoin(ctx, 100, 50, 4, f, face);
        assert.ok(calls["fillRect"] > 0);
        assert.equal(c.w, art.COIN_WIDTHS[f] * 4);
      }
    }
  });

  it("draws different marks on heads and tails", () => {
    const art = loadArt();
    const heads = mockCtx(); art.drawCoin(heads.ctx, 100, 50, 4, 0, "heads");
    const tails = mockCtx(); art.drawCoin(tails.ctx, 100, 50, 4, 0, "tails");
    assert.notEqual(heads.calls["fillRect"], tails.calls["fillRect"]);
  });

  it("never sets a canvas colour to a CSS variable", () => {
    const art = loadArt();
    const { ctx, styles } = mockCtx();
    art.drawDoors(ctx, 260, 180, { petSide: "left", choice: "right", won: false, open: "open" }, PALETTE);
    art.drawCountdown(ctx, 260, 180, 3);
    art.drawNumberCard(ctx, 260, 180, 55, { correct: true, dir: "up" });
    art.drawCoin(ctx, 100, 50, 4, 0, "heads");
    art.drawBlackjackTable(ctx, 260, 180, [{ rank: "K", suit: "♥" }, { rank: "7", suit: "♣" }], [{ rank: "10", suit: "♦" }, { rank: "A", suit: "♠" }], true);
    assert.ok(styles.length > 0);
    for (const s of styles) { assert.match(s, /^#[0-9a-f]{6}$/i, `bad canvas colour ${s}`); }
  });
});

describe("blackjack (minigameArt.js)", () => {
  const card = (rank: string) => ({ rank, suit: "♠" });
  const hand = (...ranks: string[]) => ranks.map(card);

  it("counts face cards as 10 and aces as 11 or 1", () => {
    const art = loadArt();
    assert.equal(art.blackjackTotal(hand("K", "Q")), 20);
    assert.equal(art.blackjackTotal(hand("A", "K")), 21);
    assert.equal(art.blackjackTotal(hand("A", "A")), 12);
    assert.equal(art.blackjackTotal(hand("A", "9", "5")), 15);
    assert.equal(art.blackjackTotal(hand("10", "9", "5")), 24);
  });

  it("decides win, lose and push", () => {
    const art = loadArt();
    assert.equal(art.blackjackOutcome(hand("10", "9"), hand("10", "8")), "win");
    assert.equal(art.blackjackOutcome(hand("10", "7"), hand("10", "8")), "lose");
    assert.equal(art.blackjackOutcome(hand("10", "8"), hand("9", "9")), "push");
    assert.equal(art.blackjackOutcome(hand("10", "8", "5"), hand("10", "6", "9")), "lose", "player bust loses first");
    assert.equal(art.blackjackOutcome(hand("10", "8"), hand("10", "6", "9")), "win", "dealer bust");
    assert.equal(art.blackjackOutcome(hand("A", "K"), hand("7", "7", "7")), "win", "natural beats a three-card 21");
    assert.equal(art.blackjackOutcome(hand("A", "K"), hand("A", "Q")), "push");
  });

  it("draws face-up and face-down cards the same size, red for hearts and diamonds", () => {
    const art = loadArt();
    const up = mockCtx(); const a = art.drawPlayingCard(up.ctx, 0, 0, 2, { rank: "Q", suit: "♥" }, false);
    const down = mockCtx(); const b = art.drawPlayingCard(down.ctx, 0, 0, 2, { rank: "Q", suit: "♥" }, true);
    assert.deepEqual([a.w, a.h], [b.w, b.h]);
    assert.deepEqual([a.w, a.h], [art.CARD_W * 2, art.CARD_H * 2]);
    assert.ok(up.styles.includes(art.COLOURS.bad));
    assert.ok(!down.styles.includes(art.COLOURS.bad), "the hole card gives nothing away");
    const spade = mockCtx(); art.drawPlayingCard(spade.ctx, 0, 0, 2, { rank: "10", suit: "♠" }, false);
    assert.ok(!spade.styles.includes(art.COLOURS.bad));
  });
});

describe("mini-game overlay in sidebar.js", () => {
  it("assigns no CSS variables to canvas styles (they are ignored, BUGFIX-176)", () => {
    assert.ok(!/(fillStyle|strokeStyle)\s*=\s*[^;]*var\(--/.test(sidebarSource));
  });

  it("draws every game through minigameArt on #mg-canvas", () => {
    assert.ok(sidebarSource.includes('document.getElementById("mg-canvas")'));
    for (const call of ["mgArt.drawDoors(", "mgArt.drawCountdown(", "mgArt.drawNumberCard(", "mgArt.drawCoin(", "mgArt.drawBlackjackTable("]) {
      assert.ok(sidebarSource.includes(call), `${call} not used`);
    }
  });

  it("clears the overlay whenever a game ends or the panel closes", () => {
    for (const fn of ["hideMgOverlay", "endLeftRightGame", "endHigherLowerGame", "endCoinFlipGame", "endBlackjackGame"]) {
      const body = new RegExp(`function ${fn}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`).exec(sidebarSource);
      assert.ok(body, `${fn} not found`);
      assert.ok(body[1].includes("mgClear()"), `${fn} does not clear the overlay`);
    }
  });

  it("plays Blackjack instead of Coin Flip for Stu only", () => {
    assert.ok(sidebarSource.includes("if (playsBlackjack(lastState)) { startBlackjackGame(); } else { startCoinFlipGame(); }"));
    assert.ok(sidebarSource.includes('state.spriteType === "stu"'));
    assert.ok(sidebarSource.includes('sendPlayResult("blackjack", result)'));
    assert.match(sidebarSource, /function mgClear\(\) \{\r?\n(?:.*\r?\n){0,3}.*clearTimeout\(bjTimer\)/);
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    for (const id of ["mg-blackjack", "btn-bj-hit", "btn-bj-stand", "bj-feedback", "bj-hands"]) {
      assert.ok(html.includes(`id="${id}"`), `sidebar.html lacks #${id}`);
    }
  });

  it("skips the coin spin and door swing under reduced motion", () => {
    assert.match(sidebarSource, /function playCoinSpin[\s\S]*?if \(REDUCED_MOTION/);
    assert.ok(sidebarSource.includes('open: REDUCED_MOTION ? "open" : "ajar"'));
  });
});
