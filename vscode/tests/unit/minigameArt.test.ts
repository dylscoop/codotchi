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
    assert.ok(sidebarSource.includes('playsBoxing(state) ? "Boxing"'));
    assert.ok(sidebarSource.includes("mgArt.boxingRoundWon(choice, oppMove, Math.random)"));
    assert.ok(sidebarSource.includes('if (game.kind === "boxing") {'));
    assert.ok(sidebarSource.includes("drawBoxingStage(game, box, nowMs, floorY);"));
    assert.ok(sidebarSource.includes("function boxerBounds(state, w, h, facingLeft) {"), "gloves follow where the kangaroo is drawn");
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

  it("the cat chases a laser dot instead of Left / Right, on the pet's own stage", () => {
    assert.ok(sidebarSource.includes('return !!(state && state.spriteType === "cat");'));
    assert.ok(sidebarSource.includes("else if (playsLaser(lastState)) { startLaserGame(); }"));
    assert.ok(sidebarSource.includes('playsLaser(state) ? "Laser Pointer" : "Left / Right"'));
    assert.ok(sidebarSource.includes("if (!mgArt || REDUCED_MOTION) { startLeftRightGame(); return; }"), "reduced motion keeps Left / Right");
    assert.ok(sidebarSource.includes('if (game.kind === "laser") {'));
    assert.ok(sidebarSource.includes("mgArt.drawLaserDot(spriteCtx, dotX, dotY, dpx, nowMs, Math.round(spriteCanvas.width * 0.85));"), "pulsing dot with a beam");
    assert.ok(sidebarSource.includes("var caught = !tooSlow && mgArt.laserCaught(dotX, laserCatX, stageGame.window * W);"), "caught around the cat, not the stage middle");
    assert.ok(sidebarSource.includes("laserHomeX = petX;"), "plays from where it stands");
    assert.ok(sidebarSource.includes("laserCatX = lHome + bWidth / 2;"));
    assert.ok(sidebarSource.includes("petY  = floorY + Math.round(sgPose.dy || 0);"), "the pounce leaves the floor");
    assert.ok(sidebarSource.includes('"minigame_laser_win":'));
    assert.ok(sidebarSource.includes('"minigame_laser_lose":'));
    assert.ok(sidebarSource.includes("left: padBack ? game.dotAt > laserCatX : game.dotAt < laserCatX,"), "turns round to pad back");
    assert.match(sidebarSource, /function mgClear\(\) \{[\s\S]*?if \(stageGame\) \{ petVx = 0; \}\s*stageGame = null;/,
                 "a game's last step does not carry into the wander (no walking backwards)");
    const body = /function endLaserGame\(\) \{([\s\S]*?)\n  \}/.exec(sidebarSource);
    assert.ok(body && body[1].includes("mgClear()"), "endLaserGame does not clear the game");
    assert.ok(body[1].includes('var result = laserCatches >= mgArt.LASER_WINS_NEEDED ? "win" : "lose";'));
    assert.ok(body[1].includes('sendPlayResult("laser", result)'));
    const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");
    for (const id of ["mg-laser", "btn-laser-pounce", "laser-feedback", "laser-score"]) {
      assert.ok(html.includes(`id="${id}"`), `sidebar.html lacks #${id}`);
    }
  });

  it("Laser Pointer: three tries, first to two, each quicker with a narrower window", () => {
    const art = loadArt();
    assert.equal(art.LASER_ROUNDS, 3);
    assert.equal(art.LASER_WINS_NEEDED, 2);
    const tries = [0, 1, 2].map((r) => art.laserRound(r, () => 0.5));
    for (let r = 1; r < 3; r++) {
      assert.ok(tries[r].speed > tries[r - 1].speed, "quicker");
      assert.ok(tries[r].window < tries[r - 1].window, "narrower");
    }
    // Catchable by timing: the window spans a few frames even on the last try
    const W = 300, last = tries[2];
    const msInWindow = (2 * last.window * W) / (2 * Math.PI * last.speed * 0.4 * W) * 1000;
    assert.ok(msInWindow > 80, `only ${msInWindow.toFixed(0)} ms to pounce`);
  });

  it("the dot sweeps across the middle of the stage and a pounce catches it near the cat", () => {
    const art = loadArt();
    const xs = Array.from({ length: 200 }, (_, i) => art.laserDotX(i * 25, 0.4, 300, 0));
    assert.ok(Math.min(...xs) >= 30 - 1e-9 && Math.max(...xs) <= 270 + 1e-9);
    assert.ok(Math.min(...xs) < 40 && Math.max(...xs) > 260, "reaches both sides");
    assert.equal(art.laserDotX(0, 0.4, 300, 0), 150);
    assert.ok(art.laserCaught(160, 150, 12));
    assert.ok(!art.laserCaught(170, 150, 12));
    assert.equal(art.laserPounceArc(0).dy, -0);
    assert.ok(Math.abs(art.laserPounceArc(0.5).dy + 1) < 1e-9);
    assert.equal(art.laserPounceArc(2).f, 1);
  });

  it("draws a big, outlined, pulsing laser dot, with a beam only when asked", () => {
    const art = loadArt();
    const p = mockCtx();
    art.drawLaserDot(p.ctx, 50, 50, 3, 0);
    assert.ok(p.styles.includes("#ff1a1a"), "red core");
    assert.ok(p.styles.includes("#ffffff"), "white-hot centre");
    assert.ok(p.styles.includes("#4a0000"), "dark outline shows on bright skies");
    assert.ok(p.styles.includes("#ff4040"), "glow");
    assert.ok(!p.calls.stroke, "no beam");
    assert.ok(art.LASER_DOT_SIZE >= 7, "at least 7 art pixels across");
    const beam = mockCtx();
    art.drawLaserDot(beam.ctx, 50, 50, 3, 0, 200);
    assert.equal(beam.calls.stroke, 1);
    const glows = Array.from({ length: 100 }, (_, i) => art.laserGlow(i * 20));
    assert.ok(Math.min(...glows) >= 0.3 && Math.max(...glows) <= 0.8 && Math.max(...glows) - Math.min(...glows) > 0.3, "pulses");
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

  it("jab lunges in and punches, dodge leans back, and both settle back to zero", () => {
    const art = loadArt();
    for (const move of ["jab", "dodge"]) {
      for (const lost of [true, false]) {
        for (const t of [0, 1]) {
          const p = art.boxingPose(move, lost, t);
          assert.ok(Math.abs(p.dx) < 1e-9 && p.reach === 0, `${move} ${lost} t=${t}`);
        }
      }
    }
    const jab = art.boxingPose("jab", false, 0.5);
    assert.ok(jab.dx > 0 && jab.reach > 0);
    const dodge = art.boxingPose("dodge", false, 0.5);
    assert.ok(dodge.dx < 0 && dodge.reach === 0);
    assert.ok(art.boxingPose("jab", true, 0.75).dx < art.boxingPose("jab", false, 0.75).dx, "the loser is knocked back");
    assert.equal(art.boxingPose("jab", true, 0.5).dx, art.boxingPose("jab", false, 0.5).dx, "not before the punch lands");
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

  it("stands the boxers nose to nose at the centre, gloves on their front paws", () => {
    const art = loadArt();
    // A kangaroo drawn from x 20 to 120 in a 140-wide box, facing right; mirrored facing left
    const right = { left: 20, right: 120, top: 10, bottom: 90 };
    const left  = { left: 20, right: 120, top: 10, bottom: 90 };
    const px = art.boxingPx(right);
    assert.equal(px, 4);
    assert.equal(art.boxingPx({ left: 0, right: 10, top: 0, bottom: 10 }), 1, "never below one pixel");
    const homes = art.boxingHomes(300, right, left, px);
    assert.equal(homes.pet + right.right, 150 - 12, "your nose sits just left of centre");
    assert.equal(homes.opp + left.left, 150 + 12, "their nose sits just right of centre");
    const paw = art.boxingPaw(right, false);
    assert.ok(paw.x > 70 && paw.x < 120 && paw.y > 10 && paw.y < 90, "front paw is ahead of the middle");
    assert.ok(art.boxingPaw(left, true).x < 70, "a left-facing boxer's paw is on its left");
    assert.equal(art.boxingNose(right, false).x, 120);
    assert.equal(art.boxingNose(left, true).x, 20);
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

describe("the cat's gift run and cat-tree climb (minigameArt.js + sidebar.js)", () => {
  const art = loadArt();
  const src = sidebarSource.replace(/\r\n/g, "\n");

  it("runs out, back and drops the gift; walks, climbs up and sits on the perch", () => {
    const run = (p: string | null): string[] => (p ? [p, ...run(art.catNextPhase(p))] : []);
    assert.deepEqual(run("out"), ["out", "back", "drop"]);
    assert.deepEqual(run("walk"), ["walk", "up", "perch"]);
    assert.equal(art.catNextPhase("toString"), null);
  });

  it("stepToward moves at most one step and says when it has arrived", () => {
    const plain = (o: unknown): unknown => JSON.parse(JSON.stringify(o));
    assert.deepEqual(plain(art.stepToward(0, 10, 4)), { x: 4, arrived: false });
    assert.deepEqual(plain(art.stepToward(10, 0, 4)), { x: 6, arrived: false });
    assert.deepEqual(plain(art.stepToward(8, 10, 4)), { x: 10, arrived: true });
  });

  it("holds the gift at the front of its head", () => {
    const b = { left: 10, right: 70, top: 20, bottom: 80 };
    assert.deepEqual(JSON.parse(JSON.stringify(art.catMouth(b, false))), { x: 70, y: 41 });
    assert.equal(art.catMouth(b, true).x, 10);
  });

  it("draws a grey mouse or a brown bird, mirrored when facing right", () => {
    const mouse = mockCtx();
    art.drawCatGift(mouse.ctx, "mouse", 0, 0, 2, false);
    assert.ok(mouse.styles.includes("#9a9aa4") && mouse.styles.includes("#f0a0b0"));
    const bird = mockCtx();
    art.drawCatGift(bird.ctx, "bird", 0, 0, 2, false);
    assert.ok(bird.styles.includes("#8a5a3a") && bird.styles.includes("#f0a030"));
    assert.deepEqual(art.catGiftSize("unknown"), art.catGiftSize("mouse"));
    // The mouse's pink nose is at the far left facing left, the far right facing right
    const rects = (right: boolean): Array<[string, number]> => {
      const out: Array<[string, number]> = [];
      let style = "";
      const ctx = { set fillStyle(v: string) { style = v; }, fillRect: (x: number) => { out.push([style, x]); } };
      art.drawCatGift(ctx, "mouse", 0, 0, 1, right);
      return out;
    };
    const w = art.catGiftSize("mouse").w;
    assert.ok(rects(false).some(([s, x]) => s === "#f0a0b0" && x === 0));
    assert.ok(rects(true).some(([s, x]) => s === "#f0a0b0" && x === w - 1));
  });

  it("starts a gift run when a cat's gift call fires, unless it can't move", () => {
    assert.ok(src.includes('if (state.spriteType === "cat" && state.stage !== "egg" && !state.sleeping && !stageGame && !REDUCED_MOTION) {\n        catErrand = { kind: "gift", phase: "out"'));
    assert.ok(src.includes('if (catErrand && catErrand.kind === "gift") { catErrand.cancelled = true; }'), "answered early: back empty-mouthed");
    assert.ok(src.includes("if (!isCarryingGift()) {"), "the floor gift waits for the drop");
    assert.ok(src.includes("giftBoxX = Math.max(0, carriedGiftBox(ceB, nowMs).x);"), "left where it was dropped");
  });

  it("climbs only as an energetic, awake teen or adult cat and gets down for anything else", () => {
    assert.match(src, /function wantsToClimb\(state\) \{\n\s*return !!\(state && state\.spriteType === "cat" && \(state\.stage === "teen" \|\| state\.stage === "adult"\) &&\n\s*!state\.sleeping && !state\.sick && \(state\.energy \|\| 0\) >= mgArt\.CAT_CLIMB_MIN_ENERGY && !REDUCED_MOTION\);/);
    assert.ok(src.includes("Math.random() < dt / mgArt.CAT_CLIMB_EVERY_S"));
    assert.ok(src.includes("climbTree.y - climbB.bottom + climbB.top >= 0"), "only if the cat fits under the top of the stage");
    assert.ok(src.includes("(!wantsToClimb(lastState) || !catTreeNow(lastState) || stageGame || snackItems.length > 0 ||"));
    assert.ok(src.indexOf("} else if (catErrand) {") < src.indexOf("} else if (lastState.sleeping) {"));
    assert.ok(art.CAT_PERCH_MS >= 3000 && art.CAT_CLIMB_EVERY_S >= 30);
  });
});
