/**
 * Companion animals: Stugotchi lives with a cat that has its own hunger and
 * happiness, is cared for by Stu's actions, can be petted and reacts to visitors.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
});
