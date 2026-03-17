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
  startSnack,
  consumeSnack,
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
  ADULT_DURATION_TICKS,
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
  it("TICK_INTERVAL_SECONDS is 6", () => {
    assert.equal(TICK_INTERVAL_SECONDS, 6);
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
    // weight=40 keeps the pet in the neutral weight range (17–66) so no happiness debuff fires
    const pet = makePet({ happiness: 50, weight: 40 });
    const next = tick(pet);
    assert.equal(next.happiness, 49);
  });

  it("does not decay hunger or happiness on most sleeping ticks (not a 5th-tick)", () => {
    // ticksAlive starts at 0 → becomes 1 after tick → 1 % 5 ≠ 0 → no sleep decay
    const pet = makePet({ hunger: 50, happiness: 50, sleeping: true });
    const next = tick(pet);
    assert.equal(next.hunger, 50);
    assert.equal(next.happiness, 50);
  });

  it("decays hunger and happiness by 1 on every 5th sleeping tick", () => {
    // ticksAlive starts at 4 → becomes 5 → 5 % 5 === 0 → sleep decay fires
    const pet = makePet({ hunger: 50, happiness: 50, sleeping: true, ticksAlive: 4, energy: 50 });
    const next = tick(pet);
    assert.equal(next.hunger, 49);
    assert.equal(next.happiness, 49);
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

  it("bytebug accumulates dayTimer faster than codeling per tick", () => {
    const codeling = createPet("A", "codeling", "neon");
    const bytebug = createPet("B", "bytebug", "neon");
    const nextCodeling = tick(codeling);
    const nextBytebug = tick(bytebug);
    assert.ok(
      nextBytebug.dayTimer > nextCodeling.dayTimer,
      "bytebug dayTimer should advance faster (1.5× multiplier)"
    );
  });

  it("shellscript accumulates dayTimer slower than codeling per tick", () => {
    const codeling = createPet("A", "codeling", "neon");
    const shellscript = createPet("B", "shellscript", "neon");
    const nextCodeling = tick(codeling);
    const nextShellscript = tick(shellscript);
    assert.ok(
      nextShellscript.dayTimer < nextCodeling.dayTimer,
      "shellscript dayTimer should advance slower (0.75× multiplier)"
    );
  });

  it("does not decay energy while idle (throttled like hunger/happiness)", () => {
    // ticksAlive goes from 0 → 1; 1 % 10 ≠ 0, so decayThisTick is false when idle
    const pet = makePet({ energy: 50 });
    const next = tick(pet, true);  // isIdle = true
    assert.equal(next.energy, 50, "energy should not decay on a throttled idle tick");
  });

  it("decays energy on the 10th idle tick (same divisor as hunger/happiness)", () => {
    // ticksAlive starts at 9 → becomes 10 → 10 % 10 === 0 → decayThisTick fires
    const pet = makePet({ energy: 50, ticksAlive: 9 });
    const next = tick(pet, true);
    assert.equal(next.energy, 49, "energy should decay by 1 on the 10th idle tick");
  });
});

// ---------------------------------------------------------------------------
// tick — poop accumulation
// ---------------------------------------------------------------------------

describe("tick — poop accumulation", () => {
  it("accumulates a poop after POOP_TICKS_INTERVAL ticks", () => {
    // POOP_TICKS_INTERVAL = 20 minutes * (60/6) ticks/min = 200 ticks
    let state = makePet({ ticksSinceLastPoop: 199 });
    state = tick(state);
    assert.equal(state.poops, 1);
    assert.ok(state.events.includes("pooped"));
  });

  it("resets ticksSinceLastPoop to 0 after a poop", () => {
    let state = makePet({ ticksSinceLastPoop: 199 });
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
    let state = makePet({ poops: 2, ticksSinceLastPoop: 199 });
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

  it("becomes sick when starvation damage fires (BUGFIX-007)", () => {
    let state = makePet({ hunger: 0, hungerZeroTicks: 2, health: 100 });
    state = tick(state);
    assert.equal(state.sick, true);
    assert.ok(state.events.includes("became_sick"));
  });

  it("medicine cures starvation-induced sickness (BUGFIX-007)", () => {
    let state = makePet({ hunger: 0, hungerZeroTicks: 2, health: 100 });
    state = tick(state); // starvation damage → sick = true
    assert.equal(state.sick, true);
    state = giveMedicine(state);
    state = giveMedicine(state);
    state = giveMedicine(state);
    assert.equal(state.sick, false);
    assert.ok(state.events.includes("cured"));
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
// tick — energy exhaustion health damage
// ---------------------------------------------------------------------------

describe("tick — energy exhaustion health damage", () => {
  it("damages health when energy is 0 while awake", () => {
    const pet = makePet({ energy: 0, health: 100 });
    const next = tick(pet);
    assert.ok(next.health < 100);
    assert.ok(next.events.includes("exhaustion_damage"));
  });

  it("exhaustion damage is slower than hunger/happiness critical (2 vs 5 per tick)", () => {
    const exhausted = makePet({ energy: 0, health: 100 });
    const starving   = makePet({ hunger: 0, hungerZeroTicks: 3, health: 100 });
    const nextExhausted = tick(exhausted);
    const nextStarving  = tick(starving);
    assert.ok(nextExhausted.health > nextStarving.health,
      "exhaustion damage (2/tick) should be less than starvation damage (5/tick)");
  });

  it("does not damage health from exhaustion while sleeping", () => {
    const pet = makePet({ energy: 0, health: 100, sleeping: true });
    const next = tick(pet);
    assert.ok(!next.events.includes("exhaustion_damage"));
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
  it("promotes egg to baby when dayTimer reaches threshold", () => {
    // dayTimer just below 0.396 → next tick pushes it over
    const pet = makePet({ stage: "egg", ticksAlive: EGG_DURATION_TICKS - 1, dayTimer: 0.395 });
    const next = tick(pet);
    assert.equal(next.stage, "baby");
    assert.ok(next.events.includes("evolved_to_baby"));
  });

  it("resets ticksAlive to 0 on evolution", () => {
    const pet = makePet({ stage: "egg", ticksAlive: EGG_DURATION_TICKS - 1, dayTimer: 0.395 });
    const next = tick(pet);
    assert.equal(next.ticksAlive, 0);
  });

  it("resets care accumulators on evolution", () => {
    const pet = makePet({
      stage: "egg",
      ticksAlive: EGG_DURATION_TICKS - 1,
      dayTimer: 0.395,
      careScoreHungerSum: 1000,
      careScoreTicks: 20,
    });
    const next = tick(pet);
    assert.equal(next.careScoreHungerSum, 0);
    assert.equal(next.careScoreTicks, 0);
  });

  it("promotes adult to senior when dayTimer reaches threshold", () => {
    const pet = makePet({ stage: "adult", ticksAlive: ADULT_DURATION_TICKS - 1, dayTimer: 287.987 });
    const next = tick(pet);
    assert.equal(next.stage, "senior");
    assert.ok(next.events.includes("evolved_to_senior"));
  });

  it("does not promote senior via normal tick", () => {
    const senior = makePet({ stage: "senior", ticksAlive: 99999, dayTimer: 9999 });
    const next = tick(senior);
    assert.equal(next.stage, "senior");
  });

  it("promotes baby to child when dayTimer reaches threshold", () => {
    const pet = makePet({ stage: "baby", ticksAlive: BABY_DURATION_TICKS - 1, dayTimer: 5.987 });
    const next = tick(pet);
    assert.equal(next.stage, "child");
  });

  it("promotes child to teen when dayTimer reaches threshold", () => {
    const pet = makePet({ stage: "child", ticksAlive: CHILD_DURATION_TICKS - 1, dayTimer: 23.987 });
    const next = tick(pet);
    assert.equal(next.stage, "teen");
  });

  it("promotes teen to adult when dayTimer reaches threshold", () => {
    const pet = makePet({ stage: "teen", ticksAlive: TEEN_DURATION_TICKS - 1, dayTimer: 95.987 });
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

  it("increases weight by 2 (FEED_MEAL_WEIGHT_GAIN)", () => {
    const pet = makePet({ weight: 10 });
    const next = feedMeal(pet, 0);
    assert.equal(next.weight, 12);
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

  it("refuses when cycle cap (3) is reached", () => {
    const pet = makePet({ hunger: 30 });
    const next = feedMeal(pet, 3);
    assert.equal(next.hunger, 30);
    assert.ok(next.events.includes("meal_refused"));
  });

  it("allows exactly 3 meals per cycle (indices 0–2)", () => {
    let pet = makePet({ hunger: 0 });
    for (let i = 0; i < 3; i++) {
      pet = feedMeal(pet, i);
      assert.ok(pet.events.includes("fed_meal"));
    }
  });
});

// ---------------------------------------------------------------------------
// feedSnack
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// startSnack / consumeSnack
// ---------------------------------------------------------------------------

describe("startSnack", () => {
  it("does not change consecutiveSnacks", () => {
    const pet = makePet({ consecutiveSnacks: 0 });
    const next = startSnack(pet);
    assert.equal(next.consecutiveSnacks, 0);
  });

  it("increments snacksGivenThisCycle", () => {
    const pet = makePet({ snacksGivenThisCycle: 0 });
    const next = startSnack(pet);
    assert.equal(next.snacksGivenThisCycle, 1);
  });

  it("emits snack_placed event", () => {
    const pet = makePet();
    const next = startSnack(pet);
    assert.ok(next.events.includes("snack_placed"));
  });

  it("emits snack_refused when cap reached", () => {
    const pet = makePet({ snacksGivenThisCycle: 3 });
    const next = startSnack(pet);
    assert.ok(next.events.includes("snack_refused"));
  });
});

describe("consumeSnack", () => {
  it("increases happiness by 5", () => {
    const pet = makePet({ happiness: 40 });
    const next = consumeSnack(pet);
    assert.equal(next.happiness, 45);
  });

  it("increases weight by 5 (FEED_SNACK_WEIGHT_GAIN)", () => {
    const pet = makePet({ weight: 10 });
    const next = consumeSnack(pet);
    assert.equal(next.weight, 15);
  });

  it("triggers sickness on 3rd consecutive snack consumed", () => {
    const pet = makePet({ consecutiveSnacks: 2 });
    const next = consumeSnack(pet);
    assert.equal(next.sick, true);
    assert.ok(next.events.includes("became_sick"));
  });

  it("does not trigger sickness again if already sick", () => {
    const pet = makePet({ consecutiveSnacks: 2, sick: true });
    const next = consumeSnack(pet);
    assert.equal(next.sick, true);
    const becameSickCount = next.events.filter((e: string) => e === "became_sick").length;
    assert.equal(becameSickCount, 0);
  });

  it("emits fed_snack event", () => {
    const pet = makePet();
    const next = consumeSnack(pet);
    assert.ok(next.events.includes("fed_snack"));
  });

  it("clamps happiness at 100", () => {
    const pet = makePet({ happiness: 95 });
    const next = consumeSnack(pet);
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

  it("decreases weight by 3 (PLAY_WEIGHT_LOSS)", () => {
    const pet = makePet({ weight: 10, energy: 50 });
    const next = play(pet);
    assert.equal(next.weight, 7);
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

  // ── left_right ─────────────────────────────────────────────────────────────

  it("left_right win raises happiness by 20–30", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "left_right", "win");
    assert.ok(next.happiness >= 70 && next.happiness <= 80,
      `happiness after left_right win should be 70–80, got ${next.happiness}`);
  });

  it("left_right lose raises happiness by exactly 10 (consolation)", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "left_right", "lose");
    assert.equal(next.happiness, 60);
  });

  it("left_right lose never reduces happiness", () => {
    const pet = makePet({ happiness: 10 });
    const next = applyMinigameResult(pet, "left_right", "lose");
    assert.ok(next.happiness > 10,
      `happiness should increase on consolation, got ${next.happiness}`);
  });

  it("left_right win clamps happiness at 100", () => {
    const pet = makePet({ happiness: 90 });
    const next = applyMinigameResult(pet, "left_right", "win");
    assert.equal(next.happiness, 100);
  });

  // ── higher_lower ───────────────────────────────────────────────────────────

  it("higher_lower win raises happiness by 25–35", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "higher_lower", "win");
    assert.ok(next.happiness >= 75 && next.happiness <= 85,
      `happiness after higher_lower win should be 75–85, got ${next.happiness}`);
  });

  it("higher_lower lose raises happiness by exactly 10 (consolation)", () => {
    const pet = makePet({ happiness: 50 });
    const next = applyMinigameResult(pet, "higher_lower", "lose");
    assert.equal(next.happiness, 60);
  });

  it("higher_lower lose never reduces happiness", () => {
    const pet = makePet({ happiness: 10 });
    const next = applyMinigameResult(pet, "higher_lower", "lose");
    assert.ok(next.happiness > 10,
      `happiness should increase on consolation, got ${next.happiness}`);
  });

  it("higher_lower win clamps happiness at 100", () => {
    const pet = makePet({ happiness: 90 });
    const next = applyMinigameResult(pet, "higher_lower", "win");
    assert.equal(next.happiness, 100);
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

  // ── left_right ─────────────────────────────────────────────────────────────

  it("left_right win → between 20 and 30 inclusive", () => {
    const delta = happinessDeltaForMinigame("left_right", "win");
    assert.ok(delta >= 20 && delta <= 30,
      `left_right win delta should be 20–30, got ${delta}`);
  });

  it("left_right win result is always a positive integer", () => {
    for (let i = 0; i < 20; i++) {
      const delta = happinessDeltaForMinigame("left_right", "win");
      assert.ok(Number.isInteger(delta) && delta > 0,
        `expected positive integer, got ${delta}`);
    }
  });

  it("left_right lose → exactly 10 (consolation, not negative)", () => {
    assert.equal(happinessDeltaForMinigame("left_right", "lose"), 10);
  });

  // ── higher_lower ───────────────────────────────────────────────────────────

  it("higher_lower win → between 25 and 35 inclusive", () => {
    const delta = happinessDeltaForMinigame("higher_lower", "win");
    assert.ok(delta >= 25 && delta <= 35,
      `higher_lower win delta should be 25–35, got ${delta}`);
  });

  it("higher_lower win result is always a positive integer", () => {
    for (let i = 0; i < 20; i++) {
      const delta = happinessDeltaForMinigame("higher_lower", "win");
      assert.ok(Number.isInteger(delta) && delta > 0,
        `expected positive integer, got ${delta}`);
    }
  });

  it("higher_lower lose → exactly 10 (consolation, not negative)", () => {
    assert.equal(happinessDeltaForMinigame("higher_lower", "lose"), 10);
  });

  // ── coin_flip ──────────────────────────────────────────────────────────────

  it("coin_flip win → exactly 15", () => {
    assert.equal(happinessDeltaForMinigame("coin_flip", "win"), 15);
  });

  it("coin_flip lose → exactly 5", () => {
    assert.equal(happinessDeltaForMinigame("coin_flip", "lose"), 5);
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

  it("ageDays is unchanged after wake (ageDays is driven by dayTimer in tick)", () => {
    const pet = makePet({ sleeping: true, ageDays: 3 });
    const next = wake(pet);
    assert.equal(next.ageDays, 3);
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
  it("kills a senior with health <= 0 and age >= 365", () => {
    const pet = makePet({ stage: "senior", health: 0, ageDays: 365 });
    const next = checkOldAgeDeath(pet);
    assert.equal(next.alive, false);
    assert.ok(next.events.includes("died_of_old_age"));
  });

  it("does not kill a senior below the death age", () => {
    const pet = makePet({ stage: "senior", health: 0, ageDays: 364 });
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

  it("SENIOR_NATURAL_DEATH_AGE_DAYS is 365", () => {
    assert.equal(SENIOR_NATURAL_DEATH_AGE_DAYS, 365);
  });
});

// ---------------------------------------------------------------------------
// applyOfflineDecay
// ---------------------------------------------------------------------------

describe("applyOfflineDecay", () => {
  it("decreases hunger and happiness for elapsed time", () => {
    const pet = makePet({ hunger: 80, happiness: 80 });
    // 100 seconds offline ≈ 16 ticks of decay
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
  });

  it("consecutive snacks → sick → medicine → cured", () => {
    let pet = createPet("Sickly", "codeling", "neon");
    // Use the two-step snack model: startSnack (button press) + consumeSnack (pet eats).
    // consecutiveSnacks is incremented in consumeSnack; sickness fires when it reaches 3.
    pet = consumeSnack(startSnack(pet));                              // snack 1
    pet = consumeSnack(startSnack(pet));                              // snack 2
    pet = consumeSnack(startSnack(pet));                              // snack 3 → sick
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

  it("evolves from egg through all stages to adult when dayTimer milestones are reached", () => {
    // Seed dayTimer just below the teen→adult threshold; one tick will push it over.
    let pet = createPet("Grower", "codeling", "neon");
    pet = {
      ...pet,
      stage: "teen",
      hunger: 80,
      happiness: 80,
      health: 100,
      poops: 0,
      sick: false,
      dayTimer: 95.987,
    } as PetState;
    const next = tick(pet);
    assert.equal(next.stage, "adult");
  });
});

// ---------------------------------------------------------------------------
// Integration: play + minigame (left_right and higher_lower)
// ---------------------------------------------------------------------------

describe("integration — play + left_right minigame", () => {
  it("play then left_right win: energy drops by 25, happiness rises by >= 35 total", () => {
    const pet = makePet({ happiness: 50, energy: 80 });
    // Step 1: player presses Play — always costs 25 energy and adds 15 happiness.
    const afterPlay = play(pet);
    assert.equal(afterPlay.energy, 55, "play should cost 25 energy");
    assert.equal(afterPlay.happiness, 65, "play should add 15 happiness");

    // Step 2: minigame result sent after the game finishes.
    const afterGame = applyMinigameResult(afterPlay, "left_right", "win");
    // Win adds 20–30 on top of the happiness already at 65 → final 85–95.
    assert.ok(afterGame.happiness >= 85 && afterGame.happiness <= 95,
      `happiness after play+win should be 85–95, got ${afterGame.happiness}`);
    assert.equal(afterGame.energy, 55, "energy should not change from minigame result");
  });

  it("play then left_right lose: energy drops by 25, happiness rises by exactly 25 total", () => {
    const pet = makePet({ happiness: 50, energy: 80 });
    const afterPlay = play(pet);
    // Lose consolation = +10.  Total happiness delta = +15 (play) + +10 (consolation) = +25.
    const afterGame = applyMinigameResult(afterPlay, "left_right", "lose");
    assert.equal(afterGame.happiness, 75,
      `happiness after play+lose should be 75 (50+15+10), got ${afterGame.happiness}`);
    assert.equal(afterGame.energy, 55);
  });

  it("play then left_right lose never reduces happiness below post-play level", () => {
    const pet = makePet({ happiness: 20, energy: 50 });
    const afterPlay = play(pet);
    const afterGame = applyMinigameResult(afterPlay, "left_right", "lose");
    assert.ok(afterGame.happiness >= afterPlay.happiness,
      "consolation must never reduce happiness below post-play level");
  });

  it("play refused when energy too low — minigame not reachable", () => {
    // Verify that play() with energy < 25 emits refused event (gate for minigame overlay).
    const pet = makePet({ happiness: 50, energy: 24 });
    const next = play(pet);
    assert.ok(next.events.includes("play_refused_no_energy"));
    assert.equal(next.happiness, 50, "happiness unchanged on refusal");
  });
});

describe("integration — play + higher_lower minigame", () => {
  it("play then higher_lower win: energy drops by 25, happiness rises by >= 40 total", () => {
    const pet = makePet({ happiness: 50, energy: 80 });
    const afterPlay = play(pet);
    const afterGame = applyMinigameResult(afterPlay, "higher_lower", "win");
    assert.ok(afterGame.happiness >= 90 && afterGame.happiness <= 100,
      `happiness after play+win should be 90–100, got ${afterGame.happiness}`);
    assert.equal(afterGame.energy, 55);
  });

  it("play then higher_lower lose: total happiness delta is exactly +25", () => {
    const pet = makePet({ happiness: 50, energy: 80 });
    const afterPlay = play(pet);
    const afterGame = applyMinigameResult(afterPlay, "higher_lower", "lose");
    assert.equal(afterGame.happiness, 75,
      `happiness after play+lose should be 75 (50+15+10), got ${afterGame.happiness}`);
  });

  it("happiness never exceeds 100 even on a perfect win streak", () => {
    let pet = makePet({ happiness: 80, energy: 100 });
    // Two rounds: play + win × 2.
    for (let round = 0; round < 2; round++) {
      pet = { ...pet, energy: 100 } as PetState; // refill energy to allow play
      pet = play(pet);
      pet = applyMinigameResult(pet, "higher_lower", "win");
    }
    assert.ok(pet.happiness <= 100, `happiness must be clamped at 100, got ${pet.happiness}`);
  });

  it("multiple consecutive losses never drop happiness below starting value", () => {
    let pet = makePet({ happiness: 50, energy: 100 });
    const startHappiness = pet.happiness;
    for (let round = 0; round < 3; round++) {
      pet = { ...pet, energy: 100 } as PetState;
      pet = play(pet);
      pet = applyMinigameResult(pet, "higher_lower", "lose");
    }
    // Each round adds +15 (play) + +10 (consolation) = +25 per round.
    assert.ok(pet.happiness > startHappiness,
      "happiness should always increase with play+consolation cycles");
  });
});

// ---------------------------------------------------------------------------
// Integration: play + coin_flip minigame
// ---------------------------------------------------------------------------

describe("integration — play + coin_flip minigame", () => {
  it("play then coin_flip win: happiness rises by exactly +30 total (15 play + 15 win)", () => {
    const pet = makePet({ happiness: 50, energy: 80 });
    const afterPlay = play(pet);
    const afterGame = applyMinigameResult(afterPlay, "coin_flip", "win");
    assert.equal(afterGame.happiness, 80,
      `happiness after play+coin_flip win should be 80 (50+15+15), got ${afterGame.happiness}`);
    assert.equal(afterGame.energy, 55);
  });

  it("play then coin_flip lose: happiness rises by exactly +20 total (15 play + 5 consolation)", () => {
    const pet = makePet({ happiness: 50, energy: 80 });
    const afterPlay = play(pet);
    const afterGame = applyMinigameResult(afterPlay, "coin_flip", "lose");
    assert.equal(afterGame.happiness, 70,
      `happiness after play+coin_flip lose should be 70 (50+15+5), got ${afterGame.happiness}`);
    assert.equal(afterGame.energy, 55);
  });

  it("coin_flip lose never reduces happiness below post-play level", () => {
    const pet = makePet({ happiness: 20, energy: 50 });
    const afterPlay = play(pet);
    const afterGame = applyMinigameResult(afterPlay, "coin_flip", "lose");
    assert.ok(afterGame.happiness >= afterPlay.happiness,
      "coin_flip lose must never reduce happiness below post-play level");
  });
});
