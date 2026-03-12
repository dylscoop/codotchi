/**
 * gameEngine.test.ts
 *
 * Unit tests for src/gameEngine.ts — mirrors the coverage of the 94 Python
 * tests in the retired tests/unit_tests/ and tests/integration_tests/.
 *
 * Uses the built-in Node.js test runner (node:test + node:assert), available
 * since Node 18.  No additional npm packages are required.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPet,
  tick,
  feedMeal,
  feedSnack,
  play,
  applyMinigameResult,
  sleep,
  wake,
  clean,
  giveMedicine,
  scold,
  praise,
  applyCodeActivity,
  promoteToSenior,
  checkOldAgeDeath,
  applyOfflineDecay,
  moodFromStats,
  tierFromCareScore,
  characterForStage,
  computeCareScore,
  careTierLabel,
  happinessDeltaForMinigame,
  serialiseState,
  deserialiseState,
  TICK_INTERVAL_SECONDS,
  CODE_ACTIVITY_THROTTLE_SECONDS,
  EGG_DURATION_TICKS,
  BABY_DURATION_TICKS,
  CHILD_DURATION_TICKS,
  TEEN_DURATION_TICKS,
  SENIOR_NATURAL_DEATH_AGE_DAYS,
  VALID_PET_TYPES,
  STAGE_ORDER,
  PetState,
} from "../../src/gameEngine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a default codeling pet for use in tests. */
function makePet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Pixel", "codeling", "neon"), ...overrides };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("TICK_INTERVAL_SECONDS is 5", () => {
    assert.equal(TICK_INTERVAL_SECONDS, 5);
  });

  it("CODE_ACTIVITY_THROTTLE_SECONDS is 30", () => {
    assert.equal(CODE_ACTIVITY_THROTTLE_SECONDS, 30);
  });

  it("VALID_PET_TYPES contains the four types", () => {
    assert.deepEqual([...VALID_PET_TYPES].sort(), [
      "bytebug",
      "codeling",
      "pixelpup",
      "shellscript",
    ]);
  });

  it("STAGE_ORDER has six stages in order", () => {
    assert.deepEqual([...STAGE_ORDER], [
      "egg", "baby", "child", "teen", "adult", "senior",
    ]);
  });

  it("stage durations are positive integers", () => {
    assert.ok(EGG_DURATION_TICKS > 0);
    assert.ok(BABY_DURATION_TICKS > 0);
    assert.ok(CHILD_DURATION_TICKS > 0);
    assert.ok(TEEN_DURATION_TICKS > 0);
  });
});

// ---------------------------------------------------------------------------
// createPet
// ---------------------------------------------------------------------------

describe("createPet", () => {
  it("creates a pet with the given name, type, and color", () => {
    const pet = createPet("Noodle", "bytebug", "pastel");
    assert.equal(pet.name, "Noodle");
    assert.equal(pet.petType, "bytebug");
    assert.equal(pet.color, "pastel");
  });

  it("starts at stage egg", () => {
    const pet = createPet("X", "codeling", "neon");
    assert.equal(pet.stage, "egg");
  });

  it("starts alive with default stats", () => {
    const pet = createPet("X", "codeling", "neon");
    assert.equal(pet.alive, true);
    assert.equal(pet.sick, false);
    assert.equal(pet.sleeping, false);
    assert.equal(pet.hunger, 50);
    assert.equal(pet.happiness, 50);
    assert.equal(pet.energy, 100);
  });

  it("shellscript gets base health of 120", () => {
    const pet = createPet("Shell", "shellscript", "mono");
    assert.equal(pet.health, 120);
  });

  it("codeling gets base health of 100", () => {
    const pet = createPet("Code", "codeling", "neon");
    assert.equal(pet.health, 100);
  });

  it("has mood and sprite derived fields", () => {
    const pet = createPet("X", "codeling", "neon");
    assert.ok(typeof pet.mood === "string" && pet.mood.length > 0);
    assert.ok(typeof pet.sprite === "string" && pet.sprite.length > 0);
  });

  it("care score defaults to 0.5 with no ticks accumulated", () => {
    const pet = createPet("X", "codeling", "neon");
    assert.equal(pet.careScore, 0.5);
  });
});

// ---------------------------------------------------------------------------
// moodFromStats
// ---------------------------------------------------------------------------

describe("moodFromStats", () => {
  it("returns sleeping when sleeping is true", () => {
    assert.equal(moodFromStats(50, 50, 100, true), "sleeping");
  });

  it("returns sick when health < 30", () => {
    assert.equal(moodFromStats(50, 50, 29, false), "sick");
  });

  it("returns sad when hunger < 10", () => {
    assert.equal(moodFromStats(5, 50, 100, false), "sad");
  });

  it("returns sad when happiness < 10", () => {
    assert.equal(moodFromStats(50, 5, 100, false), "sad");
  });

  it("returns happy when happiness >= 70 and hunger >= 50", () => {
    assert.equal(moodFromStats(50, 70, 100, false), "happy");
  });

  it("returns neutral otherwise", () => {
    assert.equal(moodFromStats(50, 50, 100, false), "neutral");
  });

  it("sleeping takes priority over sick", () => {
    assert.equal(moodFromStats(50, 50, 10, true), "sleeping");
  });
});

// ---------------------------------------------------------------------------
// tierFromCareScore
// ---------------------------------------------------------------------------

describe("tierFromCareScore", () => {
  it("returns best for score >= 0.80", () => {
    assert.equal(tierFromCareScore(0.80), "best");
    assert.equal(tierFromCareScore(1.0), "best");
  });

  it("returns mid for score >= 0.55 and < 0.80", () => {
    assert.equal(tierFromCareScore(0.55), "mid");
    assert.equal(tierFromCareScore(0.79), "mid");
  });

  it("returns low for score < 0.55", () => {
    assert.equal(tierFromCareScore(0.54), "low");
    assert.equal(tierFromCareScore(0.0), "low");
  });
});

// ---------------------------------------------------------------------------
// careTierLabel
// ---------------------------------------------------------------------------

describe("careTierLabel", () => {
  it("returns Excellent for best tier", () => {
    assert.equal(careTierLabel(0.9), "Excellent");
  });

  it("returns Good for mid tier", () => {
    assert.equal(careTierLabel(0.6), "Good");
  });

  it("returns Poor for low tier", () => {
    assert.equal(careTierLabel(0.3), "Poor");
  });
});

// ---------------------------------------------------------------------------
// characterForStage
// ---------------------------------------------------------------------------

describe("characterForStage", () => {
  it("resolves a character name for codeling baby best tier", () => {
    assert.equal(characterForStage("codeling", "baby", 0.9), "codeling_baby_a");
  });

  it("resolves mid tier correctly", () => {
    assert.equal(characterForStage("codeling", "baby", 0.6), "codeling_baby_b");
  });

  it("resolves low tier correctly", () => {
    assert.equal(characterForStage("codeling", "baby", 0.3), "codeling_baby_c");
  });

  it("works for all four pet types at adult stage", () => {
    for (const petType of VALID_PET_TYPES) {
      const char = characterForStage(petType, "adult", 0.9);
      assert.ok(char.startsWith(petType), `${petType} adult best char should start with type`);
    }
  });
});

// ---------------------------------------------------------------------------
// tick — stat decay
// ---------------------------------------------------------------------------

describe("tick — stat decay", () => {
  it("decrements hunger by 1 per tick while awake", () => {
    const pet = makePet({ hunger: 50 });
    const next = tick(pet);
    assert.equal(next.hunger, 49);
  });

  it("decrements happiness by 1 per tick while awake", () => {
    const pet = makePet({ happiness: 50 });
    const next = tick(pet);
    assert.equal(next.happiness, 49);
  });

  it("does not decay hunger or happiness while sleeping", () => {
    const pet = makePet({ hunger: 50, happiness: 50, sleeping: true });
    const next = tick(pet);
    assert.equal(next.hunger, 50);
    assert.equal(next.happiness, 50);
  });

  it("regenerates energy while sleeping", () => {
    const pet = makePet({ energy: 50, sleeping: true });
    const next = tick(pet);
    assert.ok(next.energy > 50, "energy should increase while sleeping");
  });

  it("does not go below 0 when hunger is already 0", () => {
    const pet = makePet({ hunger: 0 });
    const next = tick(pet);
    assert.equal(next.hunger, 0);
  });

  it("increments ticksAlive on each tick", () => {
    const pet = makePet({ ticksAlive: 0 });
    const next = tick(pet);
    assert.equal(next.ticksAlive, 1);
  });

  it("returns state unchanged when pet is dead", () => {
    const pet = makePet({ alive: false });
    const next = tick(pet);
    assert.equal(next, pet);
  });

  it("bytebug decays hunger faster than codeling", () => {
    const codeling = createPet("A", "codeling", "neon");
    const bytebug = createPet("B", "bytebug", "neon");
    const nextCodeling = tick(codeling);
    const nextBytebug = tick(bytebug);
    assert.ok(
      nextBytebug.hunger < nextCodeling.hunger,
      "bytebug hunger should drop more than codeling"
    );
  });

  it("pixelpup decays happiness faster than codeling", () => {
    const codeling = createPet("A", "codeling", "neon");
    const pixelpup = createPet("B", "pixelpup", "neon");
    const nextCodeling = tick(codeling);
    const nextPixelpup = tick(pixelpup);
    assert.ok(
      nextPixelpup.happiness < nextCodeling.happiness,
      "pixelpup happiness should drop more than codeling"
    );
  });
});

// ---------------------------------------------------------------------------
// tick — poop accumulation
// ---------------------------------------------------------------------------

describe("tick — poop accumulation", () => {
  it("accumulates a poop after POOP_TICKS_INTERVAL ticks", () => {
    // POOP_TICKS_INTERVAL = 20 minutes * (60/5) ticks/min = 240 ticks
    let state = makePet({ ticksSinceLastPoop: 239 });
    state = tick(state);
    assert.equal(state.poops, 1);
    assert.ok(state.events.includes("pooped"));
  });

  it("resets ticksSinceLastPoop to 0 after a poop", () => {
    let state = makePet({ ticksSinceLastPoop: 239 });
    state = tick(state);
    assert.equal(state.ticksSinceLastPoop, 0);
  });

  it("does not accumulate poops while sleeping", () => {
    const state = makePet({ sleeping: true, energy: 50, ticksSinceLastPoop: 999 });
    const next = tick(state);
    assert.equal(next.poops, 0);
  });
});

// ---------------------------------------------------------------------------
// tick — sickness from poops
// ---------------------------------------------------------------------------

describe("tick — sickness from dirty environment", () => {
  it("becomes sick when poops reach MAX_UNCLEANED_POOPS_BEFORE_SICK (3)", () => {
    // Already have 2 poops, one more poop during this tick triggers sickness
    let state = makePet({ poops: 2, ticksSinceLastPoop: 239 });
    state = tick(state);
    assert.equal(state.sick, true);
    assert.ok(state.events.includes("became_sick"));
  });

  it("does not trigger sickness again if already sick", () => {
    let state = makePet({ poops: 3, sick: true });
    state = tick(state);
    const becameSickCount = state.events.filter((e) => e === "became_sick").length;
    assert.equal(becameSickCount, 0);
  });
});

// ---------------------------------------------------------------------------
// tick — starvation and health damage
// ---------------------------------------------------------------------------

describe("tick — starvation damage", () => {
  it("starts counting hunger_zero_ticks when hunger reaches 0", () => {
    const pet = makePet({ hunger: 1 });
    const next = tick(pet);
    // hunger will be 0 after decay
    assert.equal(next.hunger, 0);
    assert.equal(next.hungerZeroTicks, 1);
  });

  it("deals health damage after 3 consecutive hunger-zero ticks", () => {
    let state = makePet({ hunger: 0, hungerZeroTicks: 2, health: 100 });
    state = tick(state);
    assert.ok(state.health < 100, "health should drop after starvation damage");
    assert.ok(state.events.includes("starvation_damage"));
  });

  it("resets hunger_zero_ticks when hunger is above 0", () => {
    let state = makePet({ hunger: 50, hungerZeroTicks: 2 });
    state = tick(state);
    assert.equal(state.hungerZeroTicks, 0);
  });
});

// ---------------------------------------------------------------------------
// tick — happiness-critical health damage
// ---------------------------------------------------------------------------

describe("tick — happiness-critical health damage", () => {
  it("damages health when happiness drops to 0 while awake", () => {
    const pet = makePet({ happiness: 0, health: 100 });
    const next = tick(pet);
    assert.ok(next.health < 100);
    assert.ok(next.events.includes("unhappiness_damage"));
  });

  it("does not damage health from happiness-critical while sleeping", () => {
    const pet = makePet({ happiness: 0, health: 100, sleeping: true, energy: 50 });
    const next = tick(pet);
    assert.equal(next.health, 100);
  });
});

// ---------------------------------------------------------------------------
// tick — sickness health drain and death
// ---------------------------------------------------------------------------

describe("tick — sickness health drain and death", () => {
  it("drains health each tick when sick", () => {
    const pet = makePet({ sick: true, health: 50 });
    const next = tick(pet);
    assert.ok(next.health < 50);
  });

  it("pet dies when health drops to 0", () => {
    // Set health to exactly CRITICAL_HEALTH_DAMAGE_PER_TICK (5) so one sick
    // tick kills it.
    const pet = makePet({ sick: true, health: 5 });
    const next = tick(pet);
    assert.equal(next.alive, false);
    assert.ok(next.events.includes("died"));
  });
});

// ---------------------------------------------------------------------------
// tick — care-score accumulation
// ---------------------------------------------------------------------------

describe("tick — care-score accumulation", () => {
  it("increments careScoreTicks after a tick if pet survives", () => {
    const pet = makePet({ careScoreTicks: 0 });
    const next = tick(pet);
    assert.equal(next.careScoreTicks, 1);
  });

  it("does not increment careScoreTicks if pet dies on this tick", () => {
    const pet = makePet({ health: 5, sick: true, careScoreTicks: 0 });
    const next = tick(pet);
    assert.equal(next.alive, false);
    // careScoreTicks should not be incremented after death
    assert.equal(next.careScoreTicks, 0);
  });
});

// ---------------------------------------------------------------------------
// tick — stage progression (egg → baby)
// ---------------------------------------------------------------------------

describe("tick — stage progression", () => {
  it("promotes egg to baby after EGG_DURATION_TICKS", () => {
    // Set ticksAlive to one below threshold so the next tick triggers evolution
    const pet = makePet({ stage: "egg", ticksAlive: EGG_DURATION_TICKS - 1 });
    const next = tick(pet);
    assert.equal(next.stage, "baby");
    assert.ok(next.events.includes("evolved_to_baby"));
  });

  it("resets ticksAlive to 0 on evolution", () => {
    const pet = makePet({ stage: "egg", ticksAlive: EGG_DURATION_TICKS - 1 });
    const next = tick(pet);
    assert.equal(next.ticksAlive, 0);
  });

  it("resets care accumulators on evolution", () => {
    const pet = makePet({
      stage: "egg",
      ticksAlive: EGG_DURATION_TICKS - 1,
      careScoreHungerSum: 1000,
      careScoreTicks: 20,
    });
    const next = tick(pet);
    assert.equal(next.careScoreHungerSum, 0);
    assert.equal(next.careScoreTicks, 0);
  });

  it("does not promote adult or senior via normal tick", () => {
    const adult = makePet({ stage: "adult", ticksAlive: 99999 });
    const next = tick(adult);
    assert.equal(next.stage, "adult");
  });

  it("promotes baby to child after BABY_DURATION_TICKS", () => {
    const pet = makePet({ stage: "baby", ticksAlive: BABY_DURATION_TICKS - 1 });
    const next = tick(pet);
    assert.equal(next.stage, "child");
  });

  it("promotes child to teen after CHILD_DURATION_TICKS", () => {
    const pet = makePet({ stage: "child", ticksAlive: CHILD_DURATION_TICKS - 1 });
    const next = tick(pet);
    assert.equal(next.stage, "teen");
  });

  it("promotes teen to adult after TEEN_DURATION_TICKS", () => {
    const pet = makePet({ stage: "teen", ticksAlive: TEEN_DURATION_TICKS - 1 });
    const next = tick(pet);
    assert.equal(next.stage, "adult");
  });
});

// ---------------------------------------------------------------------------
// feedMeal
// ---------------------------------------------------------------------------

describe("feedMeal", () => {
  it("increases hunger by 20", () => {
    const pet = makePet({ hunger: 30 });
    const next = feedMeal(pet, 0);
    assert.equal(next.hunger, 50);
  });

  it("increases weight by 1", () => {
    const pet = makePet({ weight: 10 });
    const next = feedMeal(pet, 0);
    assert.equal(next.weight, 11);
  });

  it("resets consecutiveSnacks to 0", () => {
    const pet = makePet({ consecutiveSnacks: 2 });
    const next = feedMeal(pet, 0);
    assert.equal(next.consecutiveSnacks, 0);
  });

  it("emits fed_meal event", () => {
    const pet = makePet();
    const next = feedMeal(pet, 0);
    assert.ok(next.events.includes("fed_meal"));
  });

  it("clamps hunger at 100", () => {
    const pet = makePet({ hunger: 90 });
    const next = feedMeal(pet, 0);
    assert.equal(next.hunger, 100);
  });

  it("refuses when cycle cap (4) is reached", () => {
    const pet = makePet({ hunger: 30 });
    const next = feedMeal(pet, 4);
    assert.equal(next.hunger, 30);
    assert.ok(next.events.includes("meal_refused"));
  });

  it("allows exactly 4 meals per cycle (indices 0–3)", () => {
    let pet = makePet({ hunger: 0 });
    for (let i = 0; i < 4; i++) {
      pet = feedMeal(pet, i);
      assert.ok(pet.events.includes("fed_meal"));
    }
  });
});

// ---------------------------------------------------------------------------
// feedSnack
// ---------------------------------------------------------------------------

describe("feedSnack", () => {
  it("increases happiness by 10", () => {
    const pet = makePet({ happiness: 40 });
    const next = feedSnack(pet);
    assert.equal(next.happiness, 50);
  });

  it("increases weight by 2", () => {
    const pet = makePet({ weight: 10 });
    const next = feedSnack(pet);
    assert.equal(next.weight, 12);
  });

  it("increments consecutiveSnacks", () => {
    const pet = makePet({ consecutiveSnacks: 0 });
    const next = feedSnack(pet);
    assert.equal(next.consecutiveSnacks, 1);
  });

  it("triggers sickness on 3rd consecutive snack", () => {
    const pet = makePet({ consecutiveSnacks: 2 });
    const next = feedSnack(pet);
    assert.equal(next.sick, true);
    assert.ok(next.events.includes("became_sick"));
  });

  it("does not trigger sickness again if already sick", () => {
    const pet = makePet({ consecutiveSnacks: 2, sick: true });
    const next = feedSnack(pet);
    assert.equal(next.sick, true);
    const becameSickCount = next.events.filter((e) => e === "became_sick").length;
    assert.equal(becameSickCount, 0);
  });

  it("emits fed_snack event", () => {
    const pet = makePet();
    const next = feedSnack(pet);
    assert.ok(next.events.includes("fed_snack"));
  });

  it("clamps happiness at 100", () => {
    const pet = makePet({ happiness: 95 });
    const next = feedSnack(pet);
    assert.equal(next.happiness, 100);
  });
});

// ---------------------------------------------------------------------------
// play
// ---------------------------------------------------------------------------

describe("play", () => {
  it("increases happiness by 15", () => {
    const pet = makePet({ happiness: 50, energy: 50 });
    const next = play(pet);
    assert.equal(next.happiness, 65);
  });

  it("decreases energy by 25", () => {
    const pet = makePet({ energy: 50 });
    const next = play(pet);
    assert.equal(next.energy, 25);
  });

  it("decreases weight by 1", () => {
    const pet = makePet({ weight: 10, energy: 50 });
    const next = play(pet);
    assert.equal(next.weight, 9);
  });

  it("resets consecutiveSnacks to 0", () => {
    const pet = makePet({ consecutiveSnacks: 2, energy: 50 });
    const next = play(pet);
    assert.equal(next.consecutiveSnacks, 0);
  });

  it("emits played event", () => {
    const pet = makePet({ energy: 50 });
    const next = play(pet);
    assert.ok(next.events.includes("played"));
  });

  it("refuses when energy is 0", () => {
    const pet = makePet({ energy: 0, happiness: 50 });
    const next = play(pet);
    assert.equal(next.happiness, 50);
    assert.ok(next.events.includes("play_refused_no_energy"));
  });

  it("clamps happiness at 100", () => {
    const pet = makePet({ happiness: 90, energy: 50 });
    const next = play(pet);
    assert.equal(next.happiness, 100);
  });

  it("clamps weight at WEIGHT_MIN (1)", () => {
    const pet = makePet({ weight: 1, energy: 50 });
    const next = play(pet);
    assert.equal(next.weight, 1);
  });
});

// ---------------------------------------------------------------------------
// applyMinigameResult
// ---------------------------------------------------------------------------

describe("applyMinigameResult", () => {
  it("guess win adds 15 happiness", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "guess", "win");
    assert.equal(next.happiness, 65);
  });

  it("guess lose adds 5 happiness", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "guess", "lose");
    assert.equal(next.happiness, 55);
  });

  it("memory win adds 20 happiness", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "memory", "win");
    assert.equal(next.happiness, 70);
  });

  it("memory lose adds 5 happiness", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "memory", "lose");
    assert.equal(next.happiness, 55);
  });

  it("unknown game falls back to lose bonus", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "unknown", "whatever");
    assert.equal(next.happiness, 55);
  });
});

// ---------------------------------------------------------------------------
// happinessDeltaForMinigame
// ---------------------------------------------------------------------------

describe("happinessDeltaForMinigame", () => {
  it("guess win → 15", () => {
    assert.equal(happinessDeltaForMinigame("guess", "win"), 15);
  });

  it("guess lose → 5", () => {
    assert.equal(happinessDeltaForMinigame("guess", "lose"), 5);
  });

  it("memory win → 20", () => {
    assert.equal(happinessDeltaForMinigame("memory", "win"), 20);
  });

  it("memory lose → 5", () => {
    assert.equal(happinessDeltaForMinigame("memory", "lose"), 5);
  });
});

// ---------------------------------------------------------------------------
// sleep / wake
// ---------------------------------------------------------------------------

describe("sleep", () => {
  it("sets sleeping to true", () => {
    const pet = makePet({ sleeping: false });
    const next = sleep(pet);
    assert.equal(next.sleeping, true);
  });

  it("emits fell_asleep event", () => {
    const pet = makePet({ sleeping: false });
    const next = sleep(pet);
    assert.ok(next.events.includes("fell_asleep"));
  });

  it("is a no-op when already sleeping", () => {
    const pet = makePet({ sleeping: true });
    const next = sleep(pet);
    assert.equal(next.sleeping, true);
    assert.ok(next.events.includes("already_sleeping"));
  });
});

describe("wake", () => {
  it("sets sleeping to false", () => {
    const pet = makePet({ sleeping: true });
    const next = wake(pet);
    assert.equal(next.sleeping, false);
  });

  it("increments ageDays", () => {
    const pet = makePet({ sleeping: true, ageDays: 3 });
    const next = wake(pet);
    assert.equal(next.ageDays, 4);
  });

  it("emits woke_up event", () => {
    const pet = makePet({ sleeping: true });
    const next = wake(pet);
    assert.ok(next.events.includes("woke_up"));
  });

  it("is a no-op when already awake", () => {
    const pet = makePet({ sleeping: false });
    const next = wake(pet);
    assert.equal(next.sleeping, false);
    assert.ok(next.events.includes("already_awake"));
  });
});

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

describe("clean", () => {
  it("sets poops to 0", () => {
    const pet = makePet({ poops: 3 });
    const next = clean(pet);
    assert.equal(next.poops, 0);
  });

  it("resets ticksSinceLastPoop to 0", () => {
    const pet = makePet({ poops: 3, ticksSinceLastPoop: 100 });
    const next = clean(pet);
    assert.equal(next.ticksSinceLastPoop, 0);
  });

  it("emits cleaned event", () => {
    const pet = makePet({ poops: 2 });
    const next = clean(pet);
    assert.ok(next.events.includes("cleaned"));
  });

  it("is a no-op when already clean", () => {
    const pet = makePet({ poops: 0 });
    const next = clean(pet);
    assert.equal(next.poops, 0);
    assert.ok(next.events.includes("already_clean"));
  });
});

// ---------------------------------------------------------------------------
// giveMedicine
// ---------------------------------------------------------------------------

describe("giveMedicine", () => {
  it("does not change health (medicine no longer boosts health)", () => {
    const pet = makePet({ sick: true, health: 50 });
    const next = giveMedicine(pet);
    assert.equal(next.health, 50);
  });

  it("increments medicineDosesGiven", () => {
    const pet = makePet({ sick: true, medicineDosesGiven: 0 });
    const next = giveMedicine(pet);
    assert.equal(next.medicineDosesGiven, 1);
  });

  it("cures after 3 doses", () => {
    let pet = makePet({ sick: true, medicineDosesGiven: 0, health: 50 });
    pet = giveMedicine(pet); // dose 1
    pet = giveMedicine(pet); // dose 2
    pet = giveMedicine(pet); // dose 3
    assert.equal(pet.sick, false);
    assert.ok(pet.events.includes("cured"));
  });

  it("resets medicineDosesGiven to 0 after cure", () => {
    let pet = makePet({ sick: true, medicineDosesGiven: 2, health: 50 });
    pet = giveMedicine(pet);
    assert.equal(pet.medicineDosesGiven, 0);
  });

  it("emits medicine_given event", () => {
    const pet = makePet({ sick: true });
    const next = giveMedicine(pet);
    assert.ok(next.events.includes("medicine_given"));
  });

  it("is a no-op when pet is not sick", () => {
    const pet = makePet({ sick: false, health: 80 });
    const next = giveMedicine(pet);
    assert.equal(next.health, 80);
    assert.ok(next.events.includes("medicine_not_needed"));
  });

  it("health is unchanged (no longer boosted by medicine)", () => {
    const pet = makePet({ sick: true, health: 90 });
    const next = giveMedicine(pet);
    assert.equal(next.health, 90);
  });
});

// ---------------------------------------------------------------------------
// scold / praise
// ---------------------------------------------------------------------------

describe("scold", () => {
  it("increases discipline by 10", () => {
    const pet = makePet({ discipline: 40 });
    const next = scold(pet);
    assert.equal(next.discipline, 50);
  });

  it("emits scolded event", () => {
    const pet = makePet();
    const next = scold(pet);
    assert.ok(next.events.includes("scolded"));
  });

  it("clamps discipline at 100", () => {
    const pet = makePet({ discipline: 95 });
    const next = scold(pet);
    assert.equal(next.discipline, 100);
  });
});

describe("praise", () => {
  it("increases discipline by 10", () => {
    const pet = makePet({ discipline: 40 });
    const next = praise(pet);
    assert.equal(next.discipline, 50);
  });

  it("emits praised event", () => {
    const pet = makePet();
    const next = praise(pet);
    assert.ok(next.events.includes("praised"));
  });
});

// ---------------------------------------------------------------------------
// applyCodeActivity
// ---------------------------------------------------------------------------

describe("applyCodeActivity", () => {
  it("increases happiness by 5", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyCodeActivity(pet);
    assert.equal(next.happiness, 55);
  });

  it("increases discipline by 2", () => {
    const pet = makePet({ discipline: 50 });
    const next = applyCodeActivity(pet);
    assert.equal(next.discipline, 52);
  });

  it("emits code_activity_rewarded event", () => {
    const pet = makePet();
    const next = applyCodeActivity(pet);
    assert.ok(next.events.includes("code_activity_rewarded"));
  });

  it("clamps happiness at 100", () => {
    const pet = makePet({ happiness: 98 });
    const next = applyCodeActivity(pet);
    assert.equal(next.happiness, 100);
  });
});

// ---------------------------------------------------------------------------
// promoteToSenior
// ---------------------------------------------------------------------------

describe("promoteToSenior", () => {
  it("transitions adult to senior", () => {
    const pet = makePet({ stage: "adult" });
    const next = promoteToSenior(pet);
    assert.equal(next.stage, "senior");
  });

  it("emits evolved_to_senior event", () => {
    const pet = makePet({ stage: "adult" });
    const next = promoteToSenior(pet);
    assert.ok(next.events.includes("evolved_to_senior"));
  });

  it("resets ticksAlive and care accumulators", () => {
    const pet = makePet({
      stage: "adult",
      ticksAlive: 5000,
      careScoreHungerSum: 9000,
      careScoreTicks: 100,
    });
    const next = promoteToSenior(pet);
    assert.equal(next.ticksAlive, 0);
    assert.equal(next.careScoreHungerSum, 0);
    assert.equal(next.careScoreTicks, 0);
  });

  it("assigns a character string", () => {
    const pet = makePet({ stage: "adult" });
    const next = promoteToSenior(pet);
    assert.ok(typeof next.character === "string" && next.character.length > 0);
  });

  it("throws when called on a non-adult pet", () => {
    const pet = makePet({ stage: "teen" });
    assert.throws(() => promoteToSenior(pet), /adult/);
  });
});

// ---------------------------------------------------------------------------
// checkOldAgeDeath
// ---------------------------------------------------------------------------

describe("checkOldAgeDeath", () => {
  it("kills a senior with health <= 0 and age >= 20", () => {
    const pet = makePet({ stage: "senior", health: 0, ageDays: 20 });
    const next = checkOldAgeDeath(pet);
    assert.equal(next.alive, false);
    assert.ok(next.events.includes("died_of_old_age"));
  });

  it("does not kill a senior below the death age", () => {
    const pet = makePet({ stage: "senior", health: 0, ageDays: 19 });
    const next = checkOldAgeDeath(pet);
    assert.equal(next.alive, true);
  });

  it("does not kill a senior with health above 0", () => {
    const pet = makePet({ stage: "senior", health: 10, ageDays: 25 });
    const next = checkOldAgeDeath(pet);
    assert.equal(next.alive, true);
  });

  it("returns unchanged state for non-senior pets", () => {
    const pet = makePet({ stage: "adult", health: 0, ageDays: 99 });
    const next = checkOldAgeDeath(pet);
    assert.equal(next, pet);
  });

  it("SENIOR_NATURAL_DEATH_AGE_DAYS is 20", () => {
    assert.equal(SENIOR_NATURAL_DEATH_AGE_DAYS, 20);
  });
});

// ---------------------------------------------------------------------------
// applyOfflineDecay
// ---------------------------------------------------------------------------

describe("applyOfflineDecay", () => {
  it("decreases hunger and happiness for elapsed time", () => {
    const pet = makePet({ hunger: 80, happiness: 80 });
    // 100 seconds offline ≈ 20 ticks of decay
    const next = applyOfflineDecay(pet, 100);
    assert.ok(next.hunger < 80, "hunger should decrease");
    assert.ok(next.happiness < 80, "happiness should decrease");
  });

  it("caps hunger loss at 60% of current value", () => {
    const pet = makePet({ hunger: 50, happiness: 50 });
    // Extremely long time offline
    const next = applyOfflineDecay(pet, 999999);
    // Max loss = floor(50 * 0.60) = 30, so hunger >= 50 - 30 = 20
    assert.ok(next.hunger >= 20, `hunger should be at least 20, got ${next.hunger}`);
  });

  it("caps happiness loss at 60% of current value", () => {
    const pet = makePet({ hunger: 50, happiness: 50 });
    const next = applyOfflineDecay(pet, 999999);
    assert.ok(next.happiness >= 20, `happiness should be at least 20, got ${next.happiness}`);
  });

  it("is a no-op for elapsed <= 0", () => {
    const pet = makePet({ hunger: 80 });
    const next = applyOfflineDecay(pet, 0);
    assert.equal(next, pet);
  });

  it("is a no-op if pet is dead", () => {
    const pet = makePet({ alive: false, hunger: 80 });
    const next = applyOfflineDecay(pet, 3600);
    assert.equal(next, pet);
  });

  it("applies faster decay for bytebug (higher hunger multiplier)", () => {
    const codeling = createPet("A", "codeling", "neon");
    const bytebug = createPet("B", "bytebug", "neon");
    const nextCodeling = applyOfflineDecay({ ...codeling, hunger: 80 } as PetState, 100);
    const nextBytebug = applyOfflineDecay({ ...bytebug, hunger: 80 } as PetState, 100);
    assert.ok(
      nextBytebug.hunger < nextCodeling.hunger,
      "bytebug should lose more hunger offline"
    );
  });
});

// ---------------------------------------------------------------------------
// computeCareScore
// ---------------------------------------------------------------------------

describe("computeCareScore", () => {
  it("returns 0.5 when no ticks have been accumulated", () => {
    const pet = makePet({ careScoreTicks: 0 });
    assert.equal(computeCareScore(pet), 0.5);
  });

  it("returns a higher score for a well-fed, happy, healthy pet", () => {
    const wellCared = makePet({
      careScoreTicks: 100,
      careScoreHungerSum: 8000,    // average 80
      careScoreHappinessSum: 8000, // average 80
      careScoreHealthSum: 9000,    // average 90
      discipline: 90,
      poops: 0,
    });
    const neglected = makePet({
      careScoreTicks: 100,
      careScoreHungerSum: 1000,    // average 10
      careScoreHappinessSum: 1000, // average 10
      careScoreHealthSum: 2000,    // average 20
      discipline: 10,
      poops: 3,
    });
    assert.ok(
      computeCareScore(wellCared) > computeCareScore(neglected),
      "well-cared pet should have higher care score"
    );
  });

  it("returns a value in the range 0.0–1.0", () => {
    const pet = makePet({
      careScoreTicks: 50,
      careScoreHungerSum: 4000,
      careScoreHappinessSum: 4000,
      careScoreHealthSum: 4500,
      discipline: 50,
      poops: 0,
    });
    const score = computeCareScore(pet);
    assert.ok(score >= 0.0 && score <= 1.0, `score ${score} out of range`);
  });
});

// ---------------------------------------------------------------------------
// serialiseState / deserialiseState (round-trip)
// ---------------------------------------------------------------------------

describe("serialiseState / deserialiseState", () => {
  it("round-trips a pet state without loss", () => {
    const original = createPet("RoundTrip", "pixelpup", "ocean");
    const serialised = serialiseState(original);
    const restored = deserialiseState(serialised);
    assert.equal(restored.name, original.name);
    assert.equal(restored.petType, original.petType);
    assert.equal(restored.color, original.color);
    assert.equal(restored.hunger, original.hunger);
    assert.equal(restored.happiness, original.happiness);
    assert.equal(restored.discipline, original.discipline);
    assert.equal(restored.energy, original.energy);
    assert.equal(restored.health, original.health);
    assert.equal(restored.stage, original.stage);
    assert.equal(restored.alive, original.alive);
    assert.equal(restored.sick, original.sick);
    assert.equal(restored.sleeping, original.sleeping);
  });

  it("deserialiseState fills in defaults for missing fields", () => {
    const minimal: Record<string, unknown> = { name: "Ghost" };
    const pet = deserialiseState(minimal);
    assert.equal(pet.name, "Ghost");
    assert.equal(pet.petType, "codeling");
    assert.equal(pet.color, "neon");
    assert.equal(pet.hunger, 50);
    assert.equal(pet.alive, true);
  });

  it("serialiseState includes derived fields for the webview", () => {
    const pet = createPet("Test", "codeling", "neon");
    const serialised = serialiseState(pet);
    assert.ok("mood" in serialised);
    assert.ok("sprite" in serialised);
    assert.ok("careScore" in serialised);
  });
});

// ---------------------------------------------------------------------------
// Integration: full action sequence
// ---------------------------------------------------------------------------

describe("integration — action sequence", () => {
  it("new pet can be fed, played with, and put to sleep", () => {
    let pet = createPet("Gotchi", "codeling", "neon");
    pet = feedMeal(pet, 0);
    assert.ok(pet.events.includes("fed_meal"));

    pet = play(pet);
    assert.ok(pet.events.includes("played"));

    pet = sleep(pet);
    assert.ok(pet.sleeping);

    pet = wake(pet);
    assert.equal(pet.sleeping, false);
    assert.equal(pet.ageDays, 1);
  });

  it("consecutive snacks → sick → medicine → cured", () => {
    let pet = createPet("Sickly", "codeling", "neon");
    pet = feedSnack(pet);
    pet = feedSnack(pet);
    pet = feedSnack(pet);
    assert.equal(pet.sick, true);

    pet = giveMedicine(pet);
    pet = giveMedicine(pet);
    pet = giveMedicine(pet);
    assert.equal(pet.sick, false);
  });

  it("starving pet loses health over time and dies", () => {
    let pet = createPet("Starved", "codeling", "neon");
    // Zero out hunger and simulate HUNGER_ZERO_TICKS_BEFORE_RISK+1 ticks
    pet = { ...pet, hunger: 0, hungerZeroTicks: 0 } as PetState;
    // Run enough ticks so health drains to 0 (100 health / 5 per tick = 20 ticks after risk)
    for (let i = 0; i < 200; i++) {
      if (!pet.alive) {
        break;
      }
      // Force hunger to stay 0 so starvation damage always applies
      pet = tick({ ...pet, hunger: 0 } as PetState);
    }
    assert.equal(pet.alive, false);
  });

  it("evolves from egg through all stages to adult over many ticks", () => {
    let pet = createPet("Grower", "codeling", "neon");
    const totalTicks =
      EGG_DURATION_TICKS +
      BABY_DURATION_TICKS +
      CHILD_DURATION_TICKS +
      TEEN_DURATION_TICKS +
      1;
    for (let i = 0; i < totalTicks; i++) {
      if (!pet.alive) {
        break;
      }
      // Keep hunger, happiness, and health high; reset poops to prevent
      // sickness from dirty environment during this long simulation.
      pet = tick({
        ...pet,
        hunger: 80,
        happiness: 80,
        health: 100,
        poops: 0,
        sick: false,
      } as PetState);
    }
    assert.equal(pet.stage, "adult");
  });
});
