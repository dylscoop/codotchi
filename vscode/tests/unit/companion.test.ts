/**
 * Companion animals: Stugotchi lives with a cat that has its own hunger and
 * happiness, is cared for by Stu's actions, can be petted and reacts to visitors.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "node:vm";
import {
  createPet,
  tick,
  feedMeal,
  play,
  petCompanion,
  serialiseState,
  deserialiseState,
  PetState,
  COMPANION_MEAL_HUNGER,
  COMPANION_PLAY_HAPPINESS,
  COMPANION_PET_HAPPINESS,
  COMPANION_PET_OWNER_HAPPINESS,
  COMPANION_VISIT_HAPPINESS,
  COMPANION_LINK_TICK_INTERVAL,
  DEFAULT_GAME_CONFIG as DEFAULT_CONFIG,
} from "../../src/gameEngine";
import { formatStatusBar } from "../../src/statusBarText";

function stuAdult(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Stu", "codeling", "stu"), stage: "adult", energy: 100, ...overrides };
}

describe("companion", () => {
  it("Stugotchi starts with a cat; other characters have none", () => {
    assert.equal(createPet("Stu", "codeling", "stu").companion?.spriteType, "cat");
    assert.equal(createPet("Dog", "codeling", "dog").companion, null);
  });

  it("old Stu saves without a companion get a fresh cat on load", () => {
    const data = serialiseState(stuAdult());
    delete data["companion"];
    const loaded = deserialiseState(data);
    assert.equal(loaded.companion?.spriteType, "cat");
    assert.equal(loaded.companion?.hunger, 50);
  });

  it("round-trips the cat's stats through save and load", () => {
    const pet = stuAdult({ companion: { spriteType: "cat", hunger: 12, happiness: 80, petCooldownTicks: 3 } });
    assert.deepEqual(deserialiseState(serialiseState(pet)).companion, pet.companion);
  });

  it("a meal feeds the cat too", () => {
    const pet = stuAdult({ hunger: 10, companion: { spriteType: "cat", hunger: 10, happiness: 50, petCooldownTicks: 0 } });
    assert.equal(feedMeal(pet, 0).companion?.hunger, 10 + COMPANION_MEAL_HUNGER);
  });

  it("playing cheers the cat up too", () => {
    const pet = stuAdult({ companion: { spriteType: "cat", hunger: 50, happiness: 20, petCooldownTicks: 0 } });
    assert.equal(play(pet).companion?.happiness, 20 + COMPANION_PLAY_HAPPINESS);
  });

  it("petting the cat makes both happier, then goes on cooldown", () => {
    const pet = stuAdult({ happiness: 40, companion: { spriteType: "cat", hunger: 50, happiness: 40, petCooldownTicks: 0 } });
    const petted = petCompanion(pet);
    assert.deepEqual(petted.events, ["companion_petted"]);
    assert.equal(petted.happiness, 40 + COMPANION_PET_OWNER_HAPPINESS);
    assert.equal(petted.companion?.happiness, 40 + COMPANION_PET_HAPPINESS);
    assert.deepEqual(petCompanion(petted).events, ["companion_pet_refused"]);
  });

  it("a sad cat makes Stu sadder (linked moods)", () => {
    const base = { ticksAlive: COMPANION_LINK_TICK_INTERVAL - 1, happiness: 80 };
    const sad = tick(stuAdult({ ...base, companion: { spriteType: "cat", hunger: 80, happiness: 5, petCooldownTicks: 0 } }));
    const fine = tick(stuAdult({ ...base, companion: { spriteType: "cat", hunger: 80, happiness: 80, petCooldownTicks: 0 } }));
    assert.equal(sad.happiness, fine.happiness - 1);
  });

  it("the cat hisses at a visiting dog and gets a happiness boost", () => {
    const pet = stuAdult({
      ticksSinceLastVisit: 1e9,
      companion: { spriteType: "cat", hunger: 80, happiness: 40, petCooldownTicks: 0 },
      friend: { name: "Rex", spriteType: "dog", petType: "codeling", friendship: 50, visits: 1 },
    });
    const orig = Math.random;
    Math.random = () => 0;
    try {
      const next = tick(pet, false, false, { ...DEFAULT_CONFIG, attentionCallsEnabled: false, socialEnabled: true });
      assert.ok(next.events.includes("friend_visit_started"));
      assert.ok(next.events.includes("companion_hiss"));
      assert.ok((next.companion?.happiness ?? 0) >= 40 + COMPANION_VISIT_HAPPINESS - 1);
    } finally {
      Math.random = orig;
    }
  });

  it("status bar shows 🐱 and the cat's stats, and warns when it is hungry", () => {
    const ok = formatStatusBar(stuAdult({ companion: { spriteType: "cat", hunger: 60, happiness: 70, petCooldownTicks: 0 } }));
    assert.match(ok.text, /🐱$/);
    assert.match(ok.tooltip, /🐱 Cat: hunger 60, happiness 70/);
    const hungry = formatStatusBar(stuAdult({ companion: { spriteType: "cat", hunger: 10, happiness: 70, petCooldownTicks: 0 } }));
    assert.match(hungry.text, /🐱!$/);
    assert.match(hungry.tooltip, /Cat is hungry/);
    assert.doesNotMatch(formatStatusBar(createPet("Rex", "codeling", "dog")).text, /🐱/);
  });
});

describe("companion: webview", () => {
  const js = fs.readFileSync(path.join(__dirname, "../../../media/sidebar.js"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../../../media/sidebar.html"), "utf8");

  it("shrinks adult and senior companions to 75% while keeping younger stage scales", () => {
    const m = js.match(/var COMPANION_SCALE = (\{[^}]+\})/);
    assert.ok(m, "COMPANION_SCALE found");
    const scale = Function(`return ${m![1]}`)() as Record<string, number>;
    assert.deepEqual(scale, { egg: 0.5, baby: 0.5, child: 0.5, teen: 0.58, adult: 0.66 * 0.75, senior: 0.66 * 0.75 });
  });

  it("every companion bubble event has text, and the Pet button exists", () => {
    const m = js.match(/var COMPANION_BUBBLE_EVENTS = \[([^\]]+)\]/);
    assert.ok(m);
    for (const ev of m![1].match(/"[a-z_]+"/g)!) {
      assert.match(js, new RegExp(`${ev}:\\s+_cat`), `${ev} has a label`);
    }
    assert.match(html, /id="btn-pet-companion"/);
    assert.match(js, /command: "pet_companion"/);
  });

  it("a senior companion lounges and lies down like the cat character", () => {
    assert.match(js, /var canLie = !!\(window\.spriteHasLyingPose && window\.spriteHasLyingPose\(cs\)\)/);
    assert.match(js, /mgArt\.catLoungeStep\(!!companionAnim\.lounging/);
    assert.match(js, /companionAnim\.lie = REDUCED_MOTION/);
  });

  it("the cat climbs its cat tree now and then, and sleeps up there if it was perched", () => {
    assert.match(js, /function companionClimbStep\(/);
    assert.match(js, /var cl = companionClimbStep\(cw, tree, w, h, y, nowMs, climbBusy\)/);
    assert.match(js, /slClimb\.phase === "perch" \|\| slClimb\.phase === "up"/);
  });

  it("Pet cat is one of the game options in the Play menu, after Pat", () => {
    assert.match(html, /id="btn-mg-pat"[^\n]*\n[^\n]*mg-game-btn hidden" id="btn-pet-companion"/);
    assert.doesNotMatch(html, /id="btn-sleep-wake"[^\n]*\n[^\n]*id="btn-pet-companion"/);
  });

  it("the cat eats its own food when the pet is fed, and has a small cat tree", () => {
    assert.match(js, /companionMeal = \{ kind: _meal \? "tuna" : "milk"/);
    assert.match(js, /drawCompanionTree\(lastState\)/);
    const bg = fs.readFileSync(path.join(__dirname, "../../../media/backgroundArt.js"), "utf8");
    assert.match(bg, /drawCatTree:\s+drawCatTree/);
  });

  it("Pet cat walks the pet over, the cat speaks its own lines, sleeps in place and joins games", () => {
    assert.match(js, /companionPetting = \{ phase: "walk"/);
    assert.match(js, /showBubble\(_cText, "companion"\)/);
    assert.match(js, /activeBubble\.kind === "companion" && companionBox/);
    assert.match(js, /\/\/ Sleeps right where it is/);
    assert.doesNotMatch(js, /Naps on the perch of its cat tree/);
    assert.match(js, /if \(gw && friendGame && inMinigame\(\)\)/);
    assert.match(js, /companionCheer = \{ won: _won/);
    assert.match(js, /function followPet\(/);
    assert.doesNotMatch(js, /the pet stays put so its companion/);
  });
});

describe("companion: rendered size and calm direction changes", () => {
  const media = path.join(__dirname, "../../../media");
  const src = fs.readFileSync(path.join(media, "sidebar.js"), "utf8");

  function loadScene(petSize = "medium", random = 0.5): any {
    const ctx: any = {
      window: {}, document: { body: { dataset: { petSize } } },
      Math: Object.assign(Object.create(Math), { random: () => random }),
      BASE_SIZE: 96, REDUCED_MOTION: false, stageGame: null,
      spriteCanvas: { width: 600, height: 180 },
      spriteCtx: { save() {}, restore() {}, translate() {}, scale() {}, fillText() {} },
      guestAnim: { wander: null }, gameOpen: false, facing: false,
      companionTreeBox: () => ({ x: 4, y: 60, w: 40, h: 60, p: 3 }),
      companionClimbStep: () => null,
    };
    vm.createContext(ctx);
    for (const file of ["spriteConstants.js", "sprites.generated.js", "sprites.js", "minigameArt.js"]) {
      vm.runInContext(fs.readFileSync(path.join(media, file), "utf8"), ctx);
    }
    ctx.STAGE_SCALES = ctx.window.SPRITE_STAGE_SCALES;
    ctx.mgArt = ctx.window.minigameArt;
    ctx.spriteHeightRatio = ctx.window.spriteHeightRatio;
    ctx.inMinigame = () => ctx.gameOpen;
    ctx.spriteCtx.scale = (x: number, y: number) => { ctx.drawScale = { x, y }; };
    ctx.drawBody = (_state: any, _x: number, _y: number, facing: boolean) => { ctx.facing = facing; };
    const constants = ["COMPANION_SCALE", "COMPANION_SAD", "COMPANION_FLIP_MIN_MS", "COMPANION_FLIP_MAX_MS",
      "COMPANION_TURN_MS", "COMPANION_FACE_SETTLE_MS", "COMPANION_CHEER_MS", "GUEST_MEET_MS",
      "GUEST_MEET_GAP_MIN_MS", "GUEST_MEET_GAP_MAX_MS", "FOLLOW_START_PX", "FOLLOW_FACE_PET_MS", "FOLLOW_TURN_MS"];
    const functions = ["petSizeMultiplier", "effectiveBWidth", "petBoxHeight", "companionState", "companionSize",
      "drawCompanion", "wanderGuest", "followPet", "resetFollow", "companionFacingStep"];
    vm.runInContext([
      ...constants.map(name => src.match(new RegExp(`var ${name} = [^;]+;`))![0]),
      src.match(/var companionAnim = [\s\S]*?;/)![0],
      "var companionMeal = null, companionPetting = null, companionCheer = null, companionBox = null;",
      ...functions.map(name => src.match(new RegExp(`function ${name}\\([\\s\\S]*?\\r?\\n {2,3}\\}`))![0]),
    ].join("\n"), ctx);
    return ctx;
  }

  it("keeps Stu's base sizes but scales only adults to 60%, preserving the companion", () => {
    const oldStu = { small: 0.375, medium: 0.5625, large: 0.75 };
    for (const size of ["small", "medium", "large"] as const) {
      const h = loadScene(size);
      assert.equal(h.petSizeMultiplier("stu"), oldStu[size] * 4 / 3);
      assert.equal(h.petSizeMultiplier("tim"), oldStu[size]);
      assert.equal(h.petSizeMultiplier("cat"), { small: 0.5, medium: 0.75, large: 1 }[size]);
      for (const stage of ["baby", "child", "teen", "adult", "senior"]) {
        const state = { ...stuAdult(), stage };
        const sz = h.companionSize(state);
        const expectedMult = oldStu[size] * 4 / 3 * (stage === "adult" ? 0.6 : 1);
        assert.equal(h.petSizeMultiplier("stu", stage), expectedMult);
        assert.equal(h.petSizeMultiplier("cat", stage), h.petSizeMultiplier("cat"));
        const stuW = h.effectiveBWidth(state, Math.round(96 * h.petSizeMultiplier("stu", stage) * h.STAGE_SCALES[stage]));
        assert.equal(stuW, Math.round(96 * expectedMult * h.STAGE_SCALES[stage]));
        assert.equal(sz.w, Math.round(sz.fullW * sz.f));
        assert.equal(sz.h, Math.round(sz.fullH * sz.f));
        const box = h.drawCompanion(state, 300, null, 0, stuW);
        assert.equal(box.w, sz.w);
        assert.equal(box.y + box.h, 168, "cat stays on the floor");
      }
    }
  });

  it("renders adult and senior companions at 75% of their former size at every preset", () => {
    for (const size of ["small", "medium", "large"]) {
      const h = loadScene(size);
      for (const stage of ["baby", "child", "teen", "adult", "senior"]) {
        const state = { ...stuAdult(), stage };
        const oldScale = stage === "teen" ? 0.58 : stage === "adult" || stage === "senior" ? 0.66 : 0.5;
        const expected = oldScale * (stage === "adult" || stage === "senior" ? 0.75 : 1);
        const sz = h.companionSize(state);
        assert.equal(sz.f, expected, `${size}/${stage} scale`);
        assert.equal(sz.w, Math.round(sz.fullW * expected));
        assert.equal(sz.h, Math.round(sz.fullH * expected));
        const box = h.drawCompanion(state, 300, null, 0, 43);
        assert.equal(h.drawScale.x, expected);
        assert.equal(h.drawScale.y, expected, "uniform scale preserves proportions");
        assert.equal(box.w, sz.w);
        assert.equal(box.h, sz.h);
        assert.equal(box.y + box.h, 168, "feet remain on the floor");
        assert.equal(h.petSizeMultiplier("cat", stage), h.petSizeMultiplier("cat"), "standalone cat unchanged");
        assert.equal(h.petSizeMultiplier("stu", stage), h.petSizeMultiplier("stu") * (stage === "adult" ? 0.6 : 1), "Stu unchanged");
      }
    }
  });

  it("schedules 4–8 second companion turns, including after meetings and edge bounces", () => {
    for (const random of [0, 0.5, 0.999]) {
      const h = loadScene("medium", random);
      const a = h.companionAnim;
      h.wanderGuest(300, 40, 600, 100, 0, a);
      const check = (now: number) => assert.ok(a.wander.nextFlipMs - now >= 4000 && a.wander.nextFlipMs - now <= 8000);
      check(0);
      a.wander.nextMeetMs = Infinity;
      const now = a.wander.nextFlipMs;
      h.wanderGuest(300, 40, 600, 100, now, a);
      check(now);
      a.wander.x = 4; a.wander.dir = -1; a.wander.pauseUntilMs = 0;
      h.wanderGuest(300, 40, 600, 100, now + 50, a);
      assert.equal(a.wander.dir, 1);
      check(now + 50);
      a.wander.meetUntilMs = now + 100;
      h.wanderGuest(300, 40, 600, 100, now + 100, a);
      check(now + 100);
      const guest: any = { onRight: true, wander: null };
      h.wanderGuest(300, 40, 600, 100, 0, guest);
      assert.ok(guest.wander.nextFlipMs >= 1500 && guest.wander.nextFlipMs <= 4000, "guest timing unchanged");
    }
  });

  it("draws stable facing under target jitter, preserves it during sleep and guest handoffs, and eventually turns", () => {
    const h = loadScene();
    const state = stuAdult();
    h.companionPetting = { phase: "walk" };
    h.drawCompanion(state, 300, null, 0, 72);
    const startFacing = h.facing;
    for (let t = 16; t < 2000; t += 16) {
      const cx = h.companionAnim.wander.x + h.companionSize(state).w / 2;
      h.drawCompanion(state, cx + (t % 32 ? 1 : -1), null, t, 72);
      assert.equal(h.facing, startFacing, "sub-frame target jitter never turns the drawn cat");
    }
    h.drawCompanion(state, 0, null, 2200, 72);
    h.drawCompanion(state, 0, null, 2600, 72);
    assert.equal(h.facing, true, "sustained target makes the cat face left");
    h.drawCompanion({ ...state, sleeping: true }, 600, { x: 0, w: 40 }, 2616, 72);
    assert.equal(h.facing, true, "handoff and sleep preserve the facing");
    h.drawCompanion(state, 600, { x: 0, w: 40 }, 2700, 72);
    h.drawCompanion(state, 600, { x: 0, w: 40 }, 3700, 72);
    assert.equal(h.facing, false, "turns to face right after settling");
  });

  it("never renders turns less than one second apart even across game transitions", () => {
    const h = loadScene();
    let last: boolean | undefined;
    let lastTurn = -Infinity;
    let turns = 0;
    for (let t = 0; t < 12000; t += 16) {
      h.gameOpen = t % 2400 >= 1200;
      h.drawCompanion(stuAdult(), t % 1600 < 800 ? 100 : 500, null, t, 72);
      if (last !== undefined && last !== h.facing) {
        assert.ok(t - lastTurn >= 1000);
        turns++; lastTurn = t;
      }
      last = h.facing;
    }
    assert.ok(turns > 0, "cat still turns rather than getting stuck");
  });
});

describe("companion: following the pet in a game", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../../media/sidebar.js"), "utf8");
  const body = src.match(/function followPet\([\s\S]*?\r?\n  \}\r?\n/)![0];
  const consts = src.match(/var FOLLOW_START_PX[\s\S]*?var FOLLOW_TURN_MS = \d+;/)![0];
  // eslint-disable-next-line no-new-func
  const followPet = new Function(consts + "\n" + body + "\nreturn followPet;")() as
    (g: Record<string, unknown>, w: number, W: number, petCx: number, half: number, side: number, now: number) =>
      { x: number; facingLeft: boolean; frame: number };

  it("does not flip facing every frame while tagging along on the side the pet walks towards", () => {
    const g: Record<string, unknown> = { x: 150 };
    let flips = 0;
    let last: boolean | null = null;
    for (let i = 0; i < 300; i++) {
      const now = 1000 + i * 16;
      const petCx = 100 + i * 0.6;   // the pet walks right, slower than the follower
      const r = followPet(g, 20, 400, petCx, 15, 1, now);
      if (last !== null && r.facingLeft !== last) { flips++; }
      last = r.facingLeft;
    }
    assert.ok(flips <= 3, `facing flipped ${flips} times`);
  });

  it("never turns twice within 300ms", () => {
    const g: Record<string, unknown> = { x: 50 };
    let lastTurn = -Infinity;
    let last: boolean | null = null;
    for (let i = 0; i < 400; i++) {
      const now = i * 16;
      const petCx = 100 + Math.sin(i / 5) * 12;   // the pet dithers back and forth
      const r = followPet(g, 20, 400, petCx, 15, -1, now);
      if (last !== null && r.facingLeft !== last) {
        assert.ok(now - lastTurn >= 300, "turned again too soon");
        lastTurn = now;
      }
      last = r.facingLeft;
    }
  });
});
