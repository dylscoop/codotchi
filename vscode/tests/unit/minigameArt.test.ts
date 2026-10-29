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
    assert.ok(sidebarSource.includes("if (playsBlackjack(lastState)) { startBlackjackGame(); }"));
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

  it("plays Fetch and Tug-of-War instead of Coin Flip and Left / Right for the dog", () => {
    assert.ok(sidebarSource.includes('state.spriteType === "dog"'));
    assert.ok(sidebarSource.includes("else if (playsDogGames(lastState)) { startFetchGame(); }"));
    assert.ok(sidebarSource.includes("if (playsDogGames(lastState)) { startTugGame(); }"));
    assert.ok(sidebarSource.includes('sendPlayResult("fetch", result)'));
    assert.ok(sidebarSource.includes('sendPlayResult("tug_of_war", result)'));
    for (const fn of ["endFetchGame", "endTugGame"]) {
      const body = new RegExp(`function ${fn}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`).exec(sidebarSource);
      assert.ok(body && body[1].includes("mgClear()"), `${fn} does not clear the game`);
    }
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    for (const id of ["mg-fetch", "btn-fetch-left", "btn-fetch-right", "fetch-feedback",
                      "mg-tug", "btn-tug-pull", "btn-tug-hold", "tug-feedback", "tug-score"]) {
      assert.ok(html.includes(`id="${id}"`), `sidebar.html lacks #${id}`);
    }
  });

  it("plays the dog games on the pet's own stage, not the overlay", () => {
    assert.ok(sidebarSource.includes("var sgPose = stageGame ? stageGamePose(stageGame, nowMs, bWidth, minX, maxX) : null;"));
    assert.ok(sidebarSource.includes("if (stageGame) { drawStageGame(stageGame, moodBox, petFacingLeft, nowMs, floorY); }"));
    assert.match(sidebarSource, /function mgClear\(\) \{[\s\S]*?stageGame = null;/);
    assert.ok(!sidebarSource.includes("drawFetchScene") && !sidebarSource.includes("drawTugScene"));
    assert.match(sidebarSource, /function handleFetchThrow[\s\S]*?if \(REDUCED_MOTION\) \{ finish\(\); return; \}/);
  });

  it("Tug-of-War: Hold beats a pull and Pull beats a rest", () => {
    const body = /function tugWon\(choice, dogMove\) \{([\s\S]*?)\n  \}/.exec(sidebarSource);
    assert.ok(body);
    const tugWon = new Function("choice", "dogMove", body[1]) as (c: string, d: string) => boolean;
    assert.equal(tugWon("hold", "pull"), true);
    assert.equal(tugWon("pull", "rest"), true);
    assert.equal(tugWon("pull", "pull"), false);
    assert.equal(tugWon("hold", "rest"), false);
  });

  it("Fetch is a single throw: a catch wins, a miss loses", () => {
    assert.ok(!sidebarSource.includes("FETCH_THROWS"));
    assert.ok(sidebarSource.includes('var result = fetchCaught ? "win" : "lose";'));
  });

  it("the kangaroos box instead of Left / Right, on the pet's own stage", () => {
    assert.ok(sidebarSource.includes('return !!(state && state.spriteType === "kangaroo");'));
    assert.ok(sidebarSource.includes("else if (playsBoxing(lastState)) { startBoxingGame(); }"));
    assert.ok(sidebarSource.includes('playsBoxing(state) ? "Boxing" : "Left / Right"'));
    assert.ok(sidebarSource.includes("mgArt.boxingRoundWon(choice, oppMove, Math.random)"));
    assert.ok(sidebarSource.includes('if (game.kind === "boxing") {'));
    assert.ok(sidebarSource.includes("drawBoxingStage(game, box, nowMs, floorY, px);"));
    assert.ok(sidebarSource.includes('"minigame_boxing_win":'));
    assert.ok(sidebarSource.includes('"minigame_boxing_lose":'));
    const body = /function endBoxingGame\(\) \{([\s\S]*?)\n  \}/.exec(sidebarSource);
    assert.ok(body && body[1].includes("mgClear()"), "endBoxingGame does not clear the game");
    assert.ok(body[1].includes('var result = boxScore >= BOX_WINS_NEEDED ? "win" : "lose";'));
    assert.ok(body[1].includes('sendPlayResult("boxing", result)'));
    assert.ok(sidebarSource.includes("var BOX_WINS_NEEDED = 2;"), "best of three: first to two");
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    for (const id of ["mg-boxing", "btn-box-jab", "btn-box-dodge", "box-feedback", "box-score"]) {
      assert.ok(html.includes(`id="${id}"`), `sidebar.html lacks #${id}`);
    }
  });

  it("scores Tug-of-War from the dog's side, so the pet gets the reward when it wins", () => {
    const body = /function endTugGame\(\) \{([\s\S]*?)\n  \}/.exec(sidebarSource);
    assert.ok(body);
    assert.ok(body[1].includes("var dogRounds = TUG_ROUNDS - tugScore;"));
    assert.ok(body[1].includes('var result = dogRounds >= 2 ? "win" : "lose";'));
    assert.ok(body[1].includes('sendPlayResult("tug_of_war", result)'));
  });
});

describe("dog mini-game art (minigameArt.js)", () => {
  it("throws the ball in an arc off the chosen edge", () => {
    const art = loadArt();
    const start = art.fetchBallPose(0, 50, 80, -10, 40);
    const mid = art.fetchBallPose(art.FETCH_FLIGHT_MS / 2, 50, 80, -10, 40);
    assert.equal(start.x, 50);
    assert.ok(mid.x < 50 && mid.y < 80 - 30, "ball should be high and heading left mid-flight");
    assert.equal(art.fetchBallPose(art.FETCH_FLIGHT_MS, 50, 80, -10, 40), null);
  });

  it("brings the ball straight back when the dog runs the right way", () => {
    const art = loadArt();
    const plan = art.fetchPlan(100, -40, 300, "right", "right");
    assert.equal(plan.caught, true);
    const xs = plan.legs.map((l: { to: number }) => l.to);
    assert.ok(xs.includes(300) && !xs.includes(-40), "it should only run off the right edge");
    const end = art.planPose(plan, plan.totalMs);
    assert.equal(end.done, true);
    assert.equal(end.x, 100);
    assert.equal(end.ball, true);
    assert.equal(art.planPose(plan, 0).ball, false);
  });

  it("runs the wrong way and comes back empty-handed", () => {
    const art = loadArt();
    const plan = art.fetchPlan(100, -40, 300, "left", "right");
    assert.equal(plan.caught, false);
    const xs = plan.legs.map((l: { to: number }) => l.to);
    assert.ok(xs.includes(300) && !xs.includes(-40), "it should only run off the wrong (right) edge");
    assert.ok(plan.legs.every((l: { ball: boolean }) => !l.ball), "no ball on a miss");
    const end = art.planPose(plan, plan.totalMs + 1);
    assert.equal(end.x, 100);
    assert.equal(end.ball, false);
    assert.equal(plan.totalMs, art.fetchPlan(100, -40, 300, "left", "left").totalMs);
  });

  it("keeps its current facing until it runs, so facing gives nothing away", () => {
    const art = loadArt();
    for (const facingLeft of [true, false]) {
      for (const dogDir of ["left", "right"]) {
        const plan = art.fetchPlan(100, -40, 300, "left", dogDir, facingLeft);
        assert.equal(art.planPose(plan, 0).left, facingLeft);
        assert.equal(plan.legs[1].left, dogDir === "left");
      }
    }
  });

  it("trots rather than dashes across the stage", () => {
    const art = loadArt();
    const plan = art.fetchPlan(100, -40, 300, "right", "right");
    const run = plan.legs.find((l: { to: number }) => l.to === 300);
    assert.ok(run.ms >= 1200, `run leg is ${run.ms} ms`);
    assert.ok(plan.totalMs >= 3500, `a catch takes ${plan.totalMs} ms`);
  });

  it("draws the tug rope with its red marker", () => {
    const art = loadArt();
    const m = mockCtx();
    art.drawTugRope(m.ctx, 0, 100, 50, 2, 1);
    assert.ok(m.styles.includes(art.COLOURS.rope));
    assert.ok(m.styles.includes(art.COLOURS.bad));
  });
});

describe("minigameArt boxing (the kangaroos' Left / Right)", () => {
  it("a jab is a coin toss whatever the opponent does", () => {
    const art = loadArt();
    for (const opp of ["jab", "dodge"]) {
      assert.equal(art.boxingRoundWon("jab", opp, () => 0.49), true);
      assert.equal(art.boxingRoundWon("jab", opp, () => 0.5), false);
    }
  });

  it("a dodge wins only when the opponent jabs", () => {
    const art = loadArt();
    for (const r of [0, 0.99]) {
      assert.equal(art.boxingRoundWon("dodge", "jab", () => r), true);
      assert.equal(art.boxingRoundWon("dodge", "dodge", () => r), false);
    }
  });

  it("jab and dodge each win half the time against a 50/50 opponent", () => {
    const art = loadArt();
    let jabs = 0, dodges = 0;
    const rolls = [0.1, 0.9];
    for (const opp of ["jab", "dodge"]) {
      for (const r of rolls) {
        if (art.boxingRoundWon("jab", opp, () => r)) { jabs++; }
        if (art.boxingRoundWon("dodge", opp, () => r)) { dodges++; }
      }
    }
    assert.equal(jabs, 2);
    assert.equal(dodges, 2);
  });

  it("jab lunges in, dodge leans back and ducks, and both settle back to zero", () => {
    const art = loadArt();
    for (const move of ["jab", "dodge"]) {
      for (const lost of [true, false]) {
        for (const t of [0, 1]) {
          const p = art.boxingPose(move, lost, t);
          assert.ok(Math.abs(p.dx) < 1e-9 && Math.abs(p.dy) < 1e-9 && p.reach === 0, `${move} ${lost} t=${t}`);
        }
      }
    }
    const jab = art.boxingPose("jab", false, 0.5);
    assert.ok(jab.dx > 0 && jab.reach > 0);
    const dodge = art.boxingPose("dodge", false, 0.5);
    assert.ok(dodge.dx < 0 && dodge.dy > 0 && dodge.reach === 0);
    assert.ok(art.boxingPose("jab", true, 0.7).dx < art.boxingPose("jab", false, 0.7).dx, "the loser is knocked back");
  });

  it("hops the opponent on from the right edge and back off again", () => {
    const art = loadArt();
    assert.equal(art.boxingOpponentPos("enter", 0, 100, 300).x, 300);
    const landed = art.boxingOpponentPos("enter", 1, 100, 300);
    assert.equal(landed.x, 100);
    assert.equal(landed.dy, 0);
    assert.ok(art.boxingOpponentPos("enter", 0.15, 100, 300).dy < 0, "it hops in");
    assert.equal(art.boxingOpponentPos("exit", 0, 100, 300).x, 100);
    assert.equal(art.boxingOpponentPos("exit", 1, 100, 300).x, 300);
    const guard = art.boxingOpponentPos("guard", 0.5, 100, 300);
    assert.equal(guard.x, 100);
    assert.equal(guard.dy, 0);
  });

  it("draws gloves in the given colour and a POW spark", () => {
    const art = loadArt();
    const m = mockCtx();
    art.drawBoxingGlove(m.ctx, 10, 10, 2, art.COLOURS.gloveRed);
    assert.ok(m.styles.includes(art.COLOURS.gloveRed));
    assert.ok(m.styles.includes(art.COLOURS.card));
    const p = mockCtx();
    art.drawPow(p.ctx, 50, 50, 2);
    assert.ok(p.styles.includes(art.COLOURS.gold));
    assert.ok(p.styles.includes(art.COLOURS.bad));
  });
});
