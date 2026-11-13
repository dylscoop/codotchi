/**
 * Companion animals: Stugotchi lives with a cat that has its own hunger and
 * happiness, is cared for by Stu's actions, can be petted and reacts to visitors.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
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

  it("draws the companion at 50–66% of a pet's size, growing with the stage", () => {
    const m = js.match(/var COMPANION_SCALE = (\{[^}]+\})/);
    assert.ok(m, "COMPANION_SCALE found");
    const scale = Function(`return ${m![1]}`)() as Record<string, number>;
    for (const stage of ["baby", "child", "teen", "adult", "senior"]) {
      assert.ok(scale[stage] >= 0.5 && scale[stage] <= 0.66, `${stage} in range`);
    }
    assert.ok(scale.adult > scale.child);
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

  it("Pet cat sits in the action grid right under Play (after Sleep in the 2-column grid)", () => {
    assert.match(html, /id="btn-play"[^\n]*\n[^\n]*id="btn-sleep-wake"[^\n]*\n[^\n]*id="btn-pet-companion"/);
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
