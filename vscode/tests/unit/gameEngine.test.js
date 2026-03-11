"use strict";
/**
 * gameEngine.test.ts
 *
 * Unit tests for src/gameEngine.ts — mirrors the coverage of the 94 Python
 * tests in the retired tests/unit_tests/ and tests/integration_tests/.
 *
 * Uses the built-in Node.js test runner (node:test + node:assert), available
 * since Node 18.  No additional npm packages are required.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const strict_1 = require("node:assert/strict");
const gameEngine_1 = require("../../src/gameEngine");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Create a default codeling pet for use in tests. */
function makePet(overrides = {}) {
    return { ...(0, gameEngine_1.createPet)("Pixel", "codeling", "neon"), ...overrides };
}
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("constants", () => {
    (0, node_test_1.it)("TICK_INTERVAL_SECONDS is 5", () => {
        strict_1.default.equal(gameEngine_1.TICK_INTERVAL_SECONDS, 5);
    });
    (0, node_test_1.it)("CODE_ACTIVITY_THROTTLE_SECONDS is 30", () => {
        strict_1.default.equal(gameEngine_1.CODE_ACTIVITY_THROTTLE_SECONDS, 30);
    });
    (0, node_test_1.it)("VALID_PET_TYPES contains the four types", () => {
        strict_1.default.deepEqual([...gameEngine_1.VALID_PET_TYPES].sort(), [
            "bytebug",
            "codeling",
            "pixelpup",
            "shellscript",
        ]);
    });
    (0, node_test_1.it)("STAGE_ORDER has six stages in order", () => {
        strict_1.default.deepEqual([...gameEngine_1.STAGE_ORDER], [
            "egg", "baby", "child", "teen", "adult", "senior",
        ]);
    });
    (0, node_test_1.it)("stage durations are positive integers", () => {
        strict_1.default.ok(gameEngine_1.EGG_DURATION_TICKS > 0);
        strict_1.default.ok(gameEngine_1.BABY_DURATION_TICKS > 0);
        strict_1.default.ok(gameEngine_1.CHILD_DURATION_TICKS > 0);
        strict_1.default.ok(gameEngine_1.TEEN_DURATION_TICKS > 0);
    });
});
// ---------------------------------------------------------------------------
// createPet
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("createPet", () => {
    (0, node_test_1.it)("creates a pet with the given name, type, and color", () => {
        const pet = (0, gameEngine_1.createPet)("Noodle", "bytebug", "pastel");
        strict_1.default.equal(pet.name, "Noodle");
        strict_1.default.equal(pet.petType, "bytebug");
        strict_1.default.equal(pet.color, "pastel");
    });
    (0, node_test_1.it)("starts at stage egg", () => {
        const pet = (0, gameEngine_1.createPet)("X", "codeling", "neon");
        strict_1.default.equal(pet.stage, "egg");
    });
    (0, node_test_1.it)("starts alive with default stats", () => {
        const pet = (0, gameEngine_1.createPet)("X", "codeling", "neon");
        strict_1.default.equal(pet.alive, true);
        strict_1.default.equal(pet.sick, false);
        strict_1.default.equal(pet.sleeping, false);
        strict_1.default.equal(pet.hunger, 50);
        strict_1.default.equal(pet.happiness, 50);
        strict_1.default.equal(pet.energy, 100);
    });
    (0, node_test_1.it)("shellscript gets base health of 120", () => {
        const pet = (0, gameEngine_1.createPet)("Shell", "shellscript", "mono");
        strict_1.default.equal(pet.health, 120);
    });
    (0, node_test_1.it)("codeling gets base health of 100", () => {
        const pet = (0, gameEngine_1.createPet)("Code", "codeling", "neon");
        strict_1.default.equal(pet.health, 100);
    });
    (0, node_test_1.it)("has mood and sprite derived fields", () => {
        const pet = (0, gameEngine_1.createPet)("X", "codeling", "neon");
        strict_1.default.ok(typeof pet.mood === "string" && pet.mood.length > 0);
        strict_1.default.ok(typeof pet.sprite === "string" && pet.sprite.length > 0);
    });
    (0, node_test_1.it)("care score defaults to 0.5 with no ticks accumulated", () => {
        const pet = (0, gameEngine_1.createPet)("X", "codeling", "neon");
        strict_1.default.equal(pet.careScore, 0.5);
    });
});
// ---------------------------------------------------------------------------
// moodFromStats
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("moodFromStats", () => {
    (0, node_test_1.it)("returns sleeping when sleeping is true", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(50, 50, 100, true), "sleeping");
    });
    (0, node_test_1.it)("returns sick when health < 30", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(50, 50, 29, false), "sick");
    });
    (0, node_test_1.it)("returns sad when hunger < 10", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(5, 50, 100, false), "sad");
    });
    (0, node_test_1.it)("returns sad when happiness < 10", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(50, 5, 100, false), "sad");
    });
    (0, node_test_1.it)("returns happy when happiness >= 70 and hunger >= 50", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(50, 70, 100, false), "happy");
    });
    (0, node_test_1.it)("returns neutral otherwise", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(50, 50, 100, false), "neutral");
    });
    (0, node_test_1.it)("sleeping takes priority over sick", () => {
        strict_1.default.equal((0, gameEngine_1.moodFromStats)(50, 50, 10, true), "sleeping");
    });
});
// ---------------------------------------------------------------------------
// tierFromCareScore
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tierFromCareScore", () => {
    (0, node_test_1.it)("returns best for score >= 0.80", () => {
        strict_1.default.equal((0, gameEngine_1.tierFromCareScore)(0.80), "best");
        strict_1.default.equal((0, gameEngine_1.tierFromCareScore)(1.0), "best");
    });
    (0, node_test_1.it)("returns mid for score >= 0.55 and < 0.80", () => {
        strict_1.default.equal((0, gameEngine_1.tierFromCareScore)(0.55), "mid");
        strict_1.default.equal((0, gameEngine_1.tierFromCareScore)(0.79), "mid");
    });
    (0, node_test_1.it)("returns low for score < 0.55", () => {
        strict_1.default.equal((0, gameEngine_1.tierFromCareScore)(0.54), "low");
        strict_1.default.equal((0, gameEngine_1.tierFromCareScore)(0.0), "low");
    });
});
// ---------------------------------------------------------------------------
// careTierLabel
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("careTierLabel", () => {
    (0, node_test_1.it)("returns Excellent for best tier", () => {
        strict_1.default.equal((0, gameEngine_1.careTierLabel)(0.9), "Excellent");
    });
    (0, node_test_1.it)("returns Good for mid tier", () => {
        strict_1.default.equal((0, gameEngine_1.careTierLabel)(0.6), "Good");
    });
    (0, node_test_1.it)("returns Poor for low tier", () => {
        strict_1.default.equal((0, gameEngine_1.careTierLabel)(0.3), "Poor");
    });
});
// ---------------------------------------------------------------------------
// characterForStage
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("characterForStage", () => {
    (0, node_test_1.it)("resolves a character name for codeling baby best tier", () => {
        strict_1.default.equal((0, gameEngine_1.characterForStage)("codeling", "baby", 0.9), "codeling_baby_a");
    });
    (0, node_test_1.it)("resolves mid tier correctly", () => {
        strict_1.default.equal((0, gameEngine_1.characterForStage)("codeling", "baby", 0.6), "codeling_baby_b");
    });
    (0, node_test_1.it)("resolves low tier correctly", () => {
        strict_1.default.equal((0, gameEngine_1.characterForStage)("codeling", "baby", 0.3), "codeling_baby_c");
    });
    (0, node_test_1.it)("works for all four pet types at adult stage", () => {
        for (const petType of gameEngine_1.VALID_PET_TYPES) {
            const char = (0, gameEngine_1.characterForStage)(petType, "adult", 0.9);
            strict_1.default.ok(char.startsWith(petType), `${petType} adult best char should start with type`);
        }
    });
});
// ---------------------------------------------------------------------------
// tick — stat decay
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — stat decay", () => {
    (0, node_test_1.it)("decrements hunger by 1 per tick while awake", () => {
        const pet = makePet({ hunger: 50 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.hunger, 49);
    });
    (0, node_test_1.it)("decrements happiness by 1 per tick while awake", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.happiness, 49);
    });
    (0, node_test_1.it)("does not decay hunger or happiness while sleeping", () => {
        const pet = makePet({ hunger: 50, happiness: 50, sleeping: true });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.hunger, 50);
        strict_1.default.equal(next.happiness, 50);
    });
    (0, node_test_1.it)("regenerates energy while sleeping", () => {
        const pet = makePet({ energy: 50, sleeping: true });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.ok(next.energy > 50, "energy should increase while sleeping");
    });
    (0, node_test_1.it)("does not go below 0 when hunger is already 0", () => {
        const pet = makePet({ hunger: 0 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.hunger, 0);
    });
    (0, node_test_1.it)("increments ticksAlive on each tick", () => {
        const pet = makePet({ ticksAlive: 0 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.ticksAlive, 1);
    });
    (0, node_test_1.it)("returns state unchanged when pet is dead", () => {
        const pet = makePet({ alive: false });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next, pet);
    });
    (0, node_test_1.it)("bytebug decays hunger faster than codeling", () => {
        const codeling = (0, gameEngine_1.createPet)("A", "codeling", "neon");
        const bytebug = (0, gameEngine_1.createPet)("B", "bytebug", "neon");
        const nextCodeling = (0, gameEngine_1.tick)(codeling);
        const nextBytebug = (0, gameEngine_1.tick)(bytebug);
        strict_1.default.ok(nextBytebug.hunger < nextCodeling.hunger, "bytebug hunger should drop more than codeling");
    });
    (0, node_test_1.it)("pixelpup decays happiness faster than codeling", () => {
        const codeling = (0, gameEngine_1.createPet)("A", "codeling", "neon");
        const pixelpup = (0, gameEngine_1.createPet)("B", "pixelpup", "neon");
        const nextCodeling = (0, gameEngine_1.tick)(codeling);
        const nextPixelpup = (0, gameEngine_1.tick)(pixelpup);
        strict_1.default.ok(nextPixelpup.happiness < nextCodeling.happiness, "pixelpup happiness should drop more than codeling");
    });
});
// ---------------------------------------------------------------------------
// tick — poop accumulation
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — poop accumulation", () => {
    (0, node_test_1.it)("accumulates a poop after POOP_TICKS_INTERVAL ticks", () => {
        // POOP_TICKS_INTERVAL = 20 minutes * (60/5) ticks/min = 240 ticks
        let state = makePet({ ticksSinceLastPoop: 239 });
        state = (0, gameEngine_1.tick)(state);
        strict_1.default.equal(state.poops, 1);
        strict_1.default.ok(state.events.includes("pooped"));
    });
    (0, node_test_1.it)("resets ticksSinceLastPoop to 0 after a poop", () => {
        let state = makePet({ ticksSinceLastPoop: 239 });
        state = (0, gameEngine_1.tick)(state);
        strict_1.default.equal(state.ticksSinceLastPoop, 0);
    });
    (0, node_test_1.it)("does not accumulate poops while sleeping", () => {
        const state = makePet({ sleeping: true, ticksSinceLastPoop: 999 });
        const next = (0, gameEngine_1.tick)(state);
        strict_1.default.equal(next.poops, 0);
    });
});
// ---------------------------------------------------------------------------
// tick — sickness from poops
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — sickness from dirty environment", () => {
    (0, node_test_1.it)("becomes sick when poops reach MAX_UNCLEANED_POOPS_BEFORE_SICK (3)", () => {
        // Already have 2 poops, one more poop during this tick triggers sickness
        let state = makePet({ poops: 2, ticksSinceLastPoop: 239 });
        state = (0, gameEngine_1.tick)(state);
        strict_1.default.equal(state.sick, true);
        strict_1.default.ok(state.events.includes("became_sick"));
    });
    (0, node_test_1.it)("does not trigger sickness again if already sick", () => {
        let state = makePet({ poops: 3, sick: true });
        state = (0, gameEngine_1.tick)(state);
        const becameSickCount = state.events.filter((e) => e === "became_sick").length;
        strict_1.default.equal(becameSickCount, 0);
    });
});
// ---------------------------------------------------------------------------
// tick — starvation and health damage
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — starvation damage", () => {
    (0, node_test_1.it)("starts counting hunger_zero_ticks when hunger reaches 0", () => {
        const pet = makePet({ hunger: 1 });
        const next = (0, gameEngine_1.tick)(pet);
        // hunger will be 0 after decay
        strict_1.default.equal(next.hunger, 0);
        strict_1.default.equal(next.hungerZeroTicks, 1);
    });
    (0, node_test_1.it)("deals health damage after 3 consecutive hunger-zero ticks", () => {
        let state = makePet({ hunger: 0, hungerZeroTicks: 2, health: 100 });
        state = (0, gameEngine_1.tick)(state);
        strict_1.default.ok(state.health < 100, "health should drop after starvation damage");
        strict_1.default.ok(state.events.includes("starvation_damage"));
    });
    (0, node_test_1.it)("resets hunger_zero_ticks when hunger is above 0", () => {
        let state = makePet({ hunger: 50, hungerZeroTicks: 2 });
        state = (0, gameEngine_1.tick)(state);
        strict_1.default.equal(state.hungerZeroTicks, 0);
    });
});
// ---------------------------------------------------------------------------
// tick — happiness-critical health damage
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — happiness-critical health damage", () => {
    (0, node_test_1.it)("damages health when happiness drops to 0 while awake", () => {
        const pet = makePet({ happiness: 0, health: 100 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.ok(next.health < 100);
        strict_1.default.ok(next.events.includes("unhappiness_damage"));
    });
    (0, node_test_1.it)("does not damage health from happiness-critical while sleeping", () => {
        const pet = makePet({ happiness: 0, health: 100, sleeping: true });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.health, 100);
    });
});
// ---------------------------------------------------------------------------
// tick — sickness health drain and death
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — sickness health drain and death", () => {
    (0, node_test_1.it)("drains health each tick when sick", () => {
        const pet = makePet({ sick: true, health: 50 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.ok(next.health < 50);
    });
    (0, node_test_1.it)("pet dies when health drops to 0", () => {
        // Set health to exactly CRITICAL_HEALTH_DAMAGE_PER_TICK (5) so one sick
        // tick kills it.
        const pet = makePet({ sick: true, health: 5 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.alive, false);
        strict_1.default.ok(next.events.includes("died"));
    });
});
// ---------------------------------------------------------------------------
// tick — care-score accumulation
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — care-score accumulation", () => {
    (0, node_test_1.it)("increments careScoreTicks after a tick if pet survives", () => {
        const pet = makePet({ careScoreTicks: 0 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.careScoreTicks, 1);
    });
    (0, node_test_1.it)("does not increment careScoreTicks if pet dies on this tick", () => {
        const pet = makePet({ health: 5, sick: true, careScoreTicks: 0 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.alive, false);
        // careScoreTicks should not be incremented after death
        strict_1.default.equal(next.careScoreTicks, 0);
    });
});
// ---------------------------------------------------------------------------
// tick — stage progression (egg → baby)
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("tick — stage progression", () => {
    (0, node_test_1.it)("promotes egg to baby after EGG_DURATION_TICKS", () => {
        // Set ticksAlive to one below threshold so the next tick triggers evolution
        const pet = makePet({ stage: "egg", ticksAlive: gameEngine_1.EGG_DURATION_TICKS - 1 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.stage, "baby");
        strict_1.default.ok(next.events.includes("evolved_to_baby"));
    });
    (0, node_test_1.it)("resets ticksAlive to 0 on evolution", () => {
        const pet = makePet({ stage: "egg", ticksAlive: gameEngine_1.EGG_DURATION_TICKS - 1 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.ticksAlive, 0);
    });
    (0, node_test_1.it)("resets care accumulators on evolution", () => {
        const pet = makePet({
            stage: "egg",
            ticksAlive: gameEngine_1.EGG_DURATION_TICKS - 1,
            careScoreHungerSum: 1000,
            careScoreTicks: 20,
        });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.careScoreHungerSum, 0);
        strict_1.default.equal(next.careScoreTicks, 0);
    });
    (0, node_test_1.it)("does not promote adult or senior via normal tick", () => {
        const adult = makePet({ stage: "adult", ticksAlive: 99999 });
        const next = (0, gameEngine_1.tick)(adult);
        strict_1.default.equal(next.stage, "adult");
    });
    (0, node_test_1.it)("promotes baby to child after BABY_DURATION_TICKS", () => {
        const pet = makePet({ stage: "baby", ticksAlive: gameEngine_1.BABY_DURATION_TICKS - 1 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.stage, "child");
    });
    (0, node_test_1.it)("promotes child to teen after CHILD_DURATION_TICKS", () => {
        const pet = makePet({ stage: "child", ticksAlive: gameEngine_1.CHILD_DURATION_TICKS - 1 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.stage, "teen");
    });
    (0, node_test_1.it)("promotes teen to adult after TEEN_DURATION_TICKS", () => {
        const pet = makePet({ stage: "teen", ticksAlive: gameEngine_1.TEEN_DURATION_TICKS - 1 });
        const next = (0, gameEngine_1.tick)(pet);
        strict_1.default.equal(next.stage, "adult");
    });
});
// ---------------------------------------------------------------------------
// feedMeal
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("feedMeal", () => {
    (0, node_test_1.it)("increases hunger by 20", () => {
        const pet = makePet({ hunger: 30 });
        const next = (0, gameEngine_1.feedMeal)(pet, 0);
        strict_1.default.equal(next.hunger, 50);
    });
    (0, node_test_1.it)("increases weight by 1", () => {
        const pet = makePet({ weight: 10 });
        const next = (0, gameEngine_1.feedMeal)(pet, 0);
        strict_1.default.equal(next.weight, 11);
    });
    (0, node_test_1.it)("resets consecutiveSnacks to 0", () => {
        const pet = makePet({ consecutiveSnacks: 2 });
        const next = (0, gameEngine_1.feedMeal)(pet, 0);
        strict_1.default.equal(next.consecutiveSnacks, 0);
    });
    (0, node_test_1.it)("emits fed_meal event", () => {
        const pet = makePet();
        const next = (0, gameEngine_1.feedMeal)(pet, 0);
        strict_1.default.ok(next.events.includes("fed_meal"));
    });
    (0, node_test_1.it)("clamps hunger at 100", () => {
        const pet = makePet({ hunger: 90 });
        const next = (0, gameEngine_1.feedMeal)(pet, 0);
        strict_1.default.equal(next.hunger, 100);
    });
    (0, node_test_1.it)("refuses when cycle cap (4) is reached", () => {
        const pet = makePet({ hunger: 30 });
        const next = (0, gameEngine_1.feedMeal)(pet, 4);
        strict_1.default.equal(next.hunger, 30);
        strict_1.default.ok(next.events.includes("meal_refused"));
    });
    (0, node_test_1.it)("allows exactly 4 meals per cycle (indices 0–3)", () => {
        let pet = makePet({ hunger: 0 });
        for (let i = 0; i < 4; i++) {
            pet = (0, gameEngine_1.feedMeal)(pet, i);
            strict_1.default.ok(pet.events.includes("fed_meal"));
        }
    });
});
// ---------------------------------------------------------------------------
// feedSnack
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("feedSnack", () => {
    (0, node_test_1.it)("increases happiness by 10", () => {
        const pet = makePet({ happiness: 40 });
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(next.happiness, 50);
    });
    (0, node_test_1.it)("increases weight by 2", () => {
        const pet = makePet({ weight: 10 });
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(next.weight, 12);
    });
    (0, node_test_1.it)("increments consecutiveSnacks", () => {
        const pet = makePet({ consecutiveSnacks: 0 });
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(next.consecutiveSnacks, 1);
    });
    (0, node_test_1.it)("triggers sickness on 3rd consecutive snack", () => {
        const pet = makePet({ consecutiveSnacks: 2 });
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(next.sick, true);
        strict_1.default.ok(next.events.includes("became_sick"));
    });
    (0, node_test_1.it)("does not trigger sickness again if already sick", () => {
        const pet = makePet({ consecutiveSnacks: 2, sick: true });
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(next.sick, true);
        const becameSickCount = next.events.filter((e) => e === "became_sick").length;
        strict_1.default.equal(becameSickCount, 0);
    });
    (0, node_test_1.it)("emits fed_snack event", () => {
        const pet = makePet();
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.ok(next.events.includes("fed_snack"));
    });
    (0, node_test_1.it)("clamps happiness at 100", () => {
        const pet = makePet({ happiness: 95 });
        const next = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(next.happiness, 100);
    });
});
// ---------------------------------------------------------------------------
// play
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("play", () => {
    (0, node_test_1.it)("increases happiness by 15", () => {
        const pet = makePet({ happiness: 50, energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.happiness, 65);
    });
    (0, node_test_1.it)("decreases energy by 10", () => {
        const pet = makePet({ energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.energy, 40);
    });
    (0, node_test_1.it)("decreases weight by 1", () => {
        const pet = makePet({ weight: 10, energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.weight, 9);
    });
    (0, node_test_1.it)("resets consecutiveSnacks to 0", () => {
        const pet = makePet({ consecutiveSnacks: 2, energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.consecutiveSnacks, 0);
    });
    (0, node_test_1.it)("emits played event", () => {
        const pet = makePet({ energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.ok(next.events.includes("played"));
    });
    (0, node_test_1.it)("refuses when energy is 0", () => {
        const pet = makePet({ energy: 0, happiness: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.happiness, 50);
        strict_1.default.ok(next.events.includes("play_refused_no_energy"));
    });
    (0, node_test_1.it)("clamps happiness at 100", () => {
        const pet = makePet({ happiness: 90, energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.happiness, 100);
    });
    (0, node_test_1.it)("clamps weight at WEIGHT_MIN (1)", () => {
        const pet = makePet({ weight: 1, energy: 50 });
        const next = (0, gameEngine_1.play)(pet);
        strict_1.default.equal(next.weight, 1);
    });
});
// ---------------------------------------------------------------------------
// applyMinigameResult
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("applyMinigameResult", () => {
    (0, node_test_1.it)("guess win adds 15 happiness", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.applyMinigameResult)(pet, "guess", "win");
        strict_1.default.equal(next.happiness, 65);
    });
    (0, node_test_1.it)("guess lose adds 5 happiness", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.applyMinigameResult)(pet, "guess", "lose");
        strict_1.default.equal(next.happiness, 55);
    });
    (0, node_test_1.it)("memory win adds 20 happiness", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.applyMinigameResult)(pet, "memory", "win");
        strict_1.default.equal(next.happiness, 70);
    });
    (0, node_test_1.it)("memory lose adds 5 happiness", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.applyMinigameResult)(pet, "memory", "lose");
        strict_1.default.equal(next.happiness, 55);
    });
    (0, node_test_1.it)("unknown game falls back to lose bonus", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.applyMinigameResult)(pet, "unknown", "whatever");
        strict_1.default.equal(next.happiness, 55);
    });
});
// ---------------------------------------------------------------------------
// happinessDeltaForMinigame
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("happinessDeltaForMinigame", () => {
    (0, node_test_1.it)("guess win → 15", () => {
        strict_1.default.equal((0, gameEngine_1.happinessDeltaForMinigame)("guess", "win"), 15);
    });
    (0, node_test_1.it)("guess lose → 5", () => {
        strict_1.default.equal((0, gameEngine_1.happinessDeltaForMinigame)("guess", "lose"), 5);
    });
    (0, node_test_1.it)("memory win → 20", () => {
        strict_1.default.equal((0, gameEngine_1.happinessDeltaForMinigame)("memory", "win"), 20);
    });
    (0, node_test_1.it)("memory lose → 5", () => {
        strict_1.default.equal((0, gameEngine_1.happinessDeltaForMinigame)("memory", "lose"), 5);
    });
});
// ---------------------------------------------------------------------------
// sleep / wake
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("sleep", () => {
    (0, node_test_1.it)("sets sleeping to true", () => {
        const pet = makePet({ sleeping: false });
        const next = (0, gameEngine_1.sleep)(pet);
        strict_1.default.equal(next.sleeping, true);
    });
    (0, node_test_1.it)("emits fell_asleep event", () => {
        const pet = makePet({ sleeping: false });
        const next = (0, gameEngine_1.sleep)(pet);
        strict_1.default.ok(next.events.includes("fell_asleep"));
    });
    (0, node_test_1.it)("is a no-op when already sleeping", () => {
        const pet = makePet({ sleeping: true });
        const next = (0, gameEngine_1.sleep)(pet);
        strict_1.default.equal(next.sleeping, true);
        strict_1.default.ok(next.events.includes("already_sleeping"));
    });
});
(0, node_test_1.describe)("wake", () => {
    (0, node_test_1.it)("sets sleeping to false", () => {
        const pet = makePet({ sleeping: true });
        const next = (0, gameEngine_1.wake)(pet);
        strict_1.default.equal(next.sleeping, false);
    });
    (0, node_test_1.it)("increments ageDays", () => {
        const pet = makePet({ sleeping: true, ageDays: 3 });
        const next = (0, gameEngine_1.wake)(pet);
        strict_1.default.equal(next.ageDays, 4);
    });
    (0, node_test_1.it)("emits woke_up event", () => {
        const pet = makePet({ sleeping: true });
        const next = (0, gameEngine_1.wake)(pet);
        strict_1.default.ok(next.events.includes("woke_up"));
    });
    (0, node_test_1.it)("is a no-op when already awake", () => {
        const pet = makePet({ sleeping: false });
        const next = (0, gameEngine_1.wake)(pet);
        strict_1.default.equal(next.sleeping, false);
        strict_1.default.ok(next.events.includes("already_awake"));
    });
});
// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("clean", () => {
    (0, node_test_1.it)("sets poops to 0", () => {
        const pet = makePet({ poops: 3 });
        const next = (0, gameEngine_1.clean)(pet);
        strict_1.default.equal(next.poops, 0);
    });
    (0, node_test_1.it)("resets ticksSinceLastPoop to 0", () => {
        const pet = makePet({ poops: 3, ticksSinceLastPoop: 100 });
        const next = (0, gameEngine_1.clean)(pet);
        strict_1.default.equal(next.ticksSinceLastPoop, 0);
    });
    (0, node_test_1.it)("emits cleaned event", () => {
        const pet = makePet({ poops: 2 });
        const next = (0, gameEngine_1.clean)(pet);
        strict_1.default.ok(next.events.includes("cleaned"));
    });
    (0, node_test_1.it)("is a no-op when already clean", () => {
        const pet = makePet({ poops: 0 });
        const next = (0, gameEngine_1.clean)(pet);
        strict_1.default.equal(next.poops, 0);
        strict_1.default.ok(next.events.includes("already_clean"));
    });
});
// ---------------------------------------------------------------------------
// giveMedicine
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("giveMedicine", () => {
    (0, node_test_1.it)("increases health by 20", () => {
        const pet = makePet({ sick: true, health: 50 });
        const next = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.equal(next.health, 70);
    });
    (0, node_test_1.it)("increments medicineDosesGiven", () => {
        const pet = makePet({ sick: true, medicineDosesGiven: 0 });
        const next = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.equal(next.medicineDosesGiven, 1);
    });
    (0, node_test_1.it)("cures after 3 doses", () => {
        let pet = makePet({ sick: true, medicineDosesGiven: 0, health: 50 });
        pet = (0, gameEngine_1.giveMedicine)(pet); // dose 1
        pet = (0, gameEngine_1.giveMedicine)(pet); // dose 2
        pet = (0, gameEngine_1.giveMedicine)(pet); // dose 3
        strict_1.default.equal(pet.sick, false);
        strict_1.default.ok(pet.events.includes("cured"));
    });
    (0, node_test_1.it)("resets medicineDosesGiven to 0 after cure", () => {
        let pet = makePet({ sick: true, medicineDosesGiven: 2, health: 50 });
        pet = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.equal(pet.medicineDosesGiven, 0);
    });
    (0, node_test_1.it)("emits medicine_given event", () => {
        const pet = makePet({ sick: true });
        const next = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.ok(next.events.includes("medicine_given"));
    });
    (0, node_test_1.it)("is a no-op when pet is not sick", () => {
        const pet = makePet({ sick: false, health: 80 });
        const next = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.equal(next.health, 80);
        strict_1.default.ok(next.events.includes("medicine_not_needed"));
    });
    (0, node_test_1.it)("clamps health at 100", () => {
        const pet = makePet({ sick: true, health: 90 });
        const next = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.equal(next.health, 100);
    });
});
// ---------------------------------------------------------------------------
// scold / praise
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("scold", () => {
    (0, node_test_1.it)("increases discipline by 10", () => {
        const pet = makePet({ discipline: 40 });
        const next = (0, gameEngine_1.scold)(pet);
        strict_1.default.equal(next.discipline, 50);
    });
    (0, node_test_1.it)("emits scolded event", () => {
        const pet = makePet();
        const next = (0, gameEngine_1.scold)(pet);
        strict_1.default.ok(next.events.includes("scolded"));
    });
    (0, node_test_1.it)("clamps discipline at 100", () => {
        const pet = makePet({ discipline: 95 });
        const next = (0, gameEngine_1.scold)(pet);
        strict_1.default.equal(next.discipline, 100);
    });
});
(0, node_test_1.describe)("praise", () => {
    (0, node_test_1.it)("increases discipline by 10", () => {
        const pet = makePet({ discipline: 40 });
        const next = (0, gameEngine_1.praise)(pet);
        strict_1.default.equal(next.discipline, 50);
    });
    (0, node_test_1.it)("emits praised event", () => {
        const pet = makePet();
        const next = (0, gameEngine_1.praise)(pet);
        strict_1.default.ok(next.events.includes("praised"));
    });
});
// ---------------------------------------------------------------------------
// applyCodeActivity
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("applyCodeActivity", () => {
    (0, node_test_1.it)("increases happiness by 5", () => {
        const pet = makePet({ happiness: 50 });
        const next = (0, gameEngine_1.applyCodeActivity)(pet);
        strict_1.default.equal(next.happiness, 55);
    });
    (0, node_test_1.it)("increases discipline by 2", () => {
        const pet = makePet({ discipline: 50 });
        const next = (0, gameEngine_1.applyCodeActivity)(pet);
        strict_1.default.equal(next.discipline, 52);
    });
    (0, node_test_1.it)("emits code_activity_rewarded event", () => {
        const pet = makePet();
        const next = (0, gameEngine_1.applyCodeActivity)(pet);
        strict_1.default.ok(next.events.includes("code_activity_rewarded"));
    });
    (0, node_test_1.it)("clamps happiness at 100", () => {
        const pet = makePet({ happiness: 98 });
        const next = (0, gameEngine_1.applyCodeActivity)(pet);
        strict_1.default.equal(next.happiness, 100);
    });
});
// ---------------------------------------------------------------------------
// promoteToSenior
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("promoteToSenior", () => {
    (0, node_test_1.it)("transitions adult to senior", () => {
        const pet = makePet({ stage: "adult" });
        const next = (0, gameEngine_1.promoteToSenior)(pet);
        strict_1.default.equal(next.stage, "senior");
    });
    (0, node_test_1.it)("emits evolved_to_senior event", () => {
        const pet = makePet({ stage: "adult" });
        const next = (0, gameEngine_1.promoteToSenior)(pet);
        strict_1.default.ok(next.events.includes("evolved_to_senior"));
    });
    (0, node_test_1.it)("resets ticksAlive and care accumulators", () => {
        const pet = makePet({
            stage: "adult",
            ticksAlive: 5000,
            careScoreHungerSum: 9000,
            careScoreTicks: 100,
        });
        const next = (0, gameEngine_1.promoteToSenior)(pet);
        strict_1.default.equal(next.ticksAlive, 0);
        strict_1.default.equal(next.careScoreHungerSum, 0);
        strict_1.default.equal(next.careScoreTicks, 0);
    });
    (0, node_test_1.it)("assigns a character string", () => {
        const pet = makePet({ stage: "adult" });
        const next = (0, gameEngine_1.promoteToSenior)(pet);
        strict_1.default.ok(typeof next.character === "string" && next.character.length > 0);
    });
    (0, node_test_1.it)("throws when called on a non-adult pet", () => {
        const pet = makePet({ stage: "teen" });
        strict_1.default.throws(() => (0, gameEngine_1.promoteToSenior)(pet), /adult/);
    });
});
// ---------------------------------------------------------------------------
// checkOldAgeDeath
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("checkOldAgeDeath", () => {
    (0, node_test_1.it)("kills a senior with health <= 0 and age >= 20", () => {
        const pet = makePet({ stage: "senior", health: 0, ageDays: 20 });
        const next = (0, gameEngine_1.checkOldAgeDeath)(pet);
        strict_1.default.equal(next.alive, false);
        strict_1.default.ok(next.events.includes("died_of_old_age"));
    });
    (0, node_test_1.it)("does not kill a senior below the death age", () => {
        const pet = makePet({ stage: "senior", health: 0, ageDays: 19 });
        const next = (0, gameEngine_1.checkOldAgeDeath)(pet);
        strict_1.default.equal(next.alive, true);
    });
    (0, node_test_1.it)("does not kill a senior with health above 0", () => {
        const pet = makePet({ stage: "senior", health: 10, ageDays: 25 });
        const next = (0, gameEngine_1.checkOldAgeDeath)(pet);
        strict_1.default.equal(next.alive, true);
    });
    (0, node_test_1.it)("returns unchanged state for non-senior pets", () => {
        const pet = makePet({ stage: "adult", health: 0, ageDays: 99 });
        const next = (0, gameEngine_1.checkOldAgeDeath)(pet);
        strict_1.default.equal(next, pet);
    });
    (0, node_test_1.it)("SENIOR_NATURAL_DEATH_AGE_DAYS is 20", () => {
        strict_1.default.equal(gameEngine_1.SENIOR_NATURAL_DEATH_AGE_DAYS, 20);
    });
});
// ---------------------------------------------------------------------------
// applyOfflineDecay
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("applyOfflineDecay", () => {
    (0, node_test_1.it)("decreases hunger and happiness for elapsed time", () => {
        const pet = makePet({ hunger: 80, happiness: 80 });
        // 100 seconds offline ≈ 20 ticks of decay
        const next = (0, gameEngine_1.applyOfflineDecay)(pet, 100);
        strict_1.default.ok(next.hunger < 80, "hunger should decrease");
        strict_1.default.ok(next.happiness < 80, "happiness should decrease");
    });
    (0, node_test_1.it)("caps hunger loss at 60% of current value", () => {
        const pet = makePet({ hunger: 50, happiness: 50 });
        // Extremely long time offline
        const next = (0, gameEngine_1.applyOfflineDecay)(pet, 999999);
        // Max loss = floor(50 * 0.60) = 30, so hunger >= 50 - 30 = 20
        strict_1.default.ok(next.hunger >= 20, `hunger should be at least 20, got ${next.hunger}`);
    });
    (0, node_test_1.it)("caps happiness loss at 60% of current value", () => {
        const pet = makePet({ hunger: 50, happiness: 50 });
        const next = (0, gameEngine_1.applyOfflineDecay)(pet, 999999);
        strict_1.default.ok(next.happiness >= 20, `happiness should be at least 20, got ${next.happiness}`);
    });
    (0, node_test_1.it)("is a no-op for elapsed <= 0", () => {
        const pet = makePet({ hunger: 80 });
        const next = (0, gameEngine_1.applyOfflineDecay)(pet, 0);
        strict_1.default.equal(next, pet);
    });
    (0, node_test_1.it)("is a no-op if pet is dead", () => {
        const pet = makePet({ alive: false, hunger: 80 });
        const next = (0, gameEngine_1.applyOfflineDecay)(pet, 3600);
        strict_1.default.equal(next, pet);
    });
    (0, node_test_1.it)("applies faster decay for bytebug (higher hunger multiplier)", () => {
        const codeling = (0, gameEngine_1.createPet)("A", "codeling", "neon");
        const bytebug = (0, gameEngine_1.createPet)("B", "bytebug", "neon");
        const nextCodeling = (0, gameEngine_1.applyOfflineDecay)({ ...codeling, hunger: 80 }, 100);
        const nextBytebug = (0, gameEngine_1.applyOfflineDecay)({ ...bytebug, hunger: 80 }, 100);
        strict_1.default.ok(nextBytebug.hunger < nextCodeling.hunger, "bytebug should lose more hunger offline");
    });
});
// ---------------------------------------------------------------------------
// computeCareScore
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("computeCareScore", () => {
    (0, node_test_1.it)("returns 0.5 when no ticks have been accumulated", () => {
        const pet = makePet({ careScoreTicks: 0 });
        strict_1.default.equal((0, gameEngine_1.computeCareScore)(pet), 0.5);
    });
    (0, node_test_1.it)("returns a higher score for a well-fed, happy, healthy pet", () => {
        const wellCared = makePet({
            careScoreTicks: 100,
            careScoreHungerSum: 8000, // average 80
            careScoreHappinessSum: 8000, // average 80
            careScoreHealthSum: 9000, // average 90
            discipline: 90,
            poops: 0,
        });
        const neglected = makePet({
            careScoreTicks: 100,
            careScoreHungerSum: 1000, // average 10
            careScoreHappinessSum: 1000, // average 10
            careScoreHealthSum: 2000, // average 20
            discipline: 10,
            poops: 3,
        });
        strict_1.default.ok((0, gameEngine_1.computeCareScore)(wellCared) > (0, gameEngine_1.computeCareScore)(neglected), "well-cared pet should have higher care score");
    });
    (0, node_test_1.it)("returns a value in the range 0.0–1.0", () => {
        const pet = makePet({
            careScoreTicks: 50,
            careScoreHungerSum: 4000,
            careScoreHappinessSum: 4000,
            careScoreHealthSum: 4500,
            discipline: 50,
            poops: 0,
        });
        const score = (0, gameEngine_1.computeCareScore)(pet);
        strict_1.default.ok(score >= 0.0 && score <= 1.0, `score ${score} out of range`);
    });
});
// ---------------------------------------------------------------------------
// serialiseState / deserialiseState (round-trip)
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("serialiseState / deserialiseState", () => {
    (0, node_test_1.it)("round-trips a pet state without loss", () => {
        const original = (0, gameEngine_1.createPet)("RoundTrip", "pixelpup", "ocean");
        const serialised = (0, gameEngine_1.serialiseState)(original);
        const restored = (0, gameEngine_1.deserialiseState)(serialised);
        strict_1.default.equal(restored.name, original.name);
        strict_1.default.equal(restored.petType, original.petType);
        strict_1.default.equal(restored.color, original.color);
        strict_1.default.equal(restored.hunger, original.hunger);
        strict_1.default.equal(restored.happiness, original.happiness);
        strict_1.default.equal(restored.discipline, original.discipline);
        strict_1.default.equal(restored.energy, original.energy);
        strict_1.default.equal(restored.health, original.health);
        strict_1.default.equal(restored.stage, original.stage);
        strict_1.default.equal(restored.alive, original.alive);
        strict_1.default.equal(restored.sick, original.sick);
        strict_1.default.equal(restored.sleeping, original.sleeping);
    });
    (0, node_test_1.it)("deserialiseState fills in defaults for missing fields", () => {
        const minimal = { name: "Ghost" };
        const pet = (0, gameEngine_1.deserialiseState)(minimal);
        strict_1.default.equal(pet.name, "Ghost");
        strict_1.default.equal(pet.petType, "codeling");
        strict_1.default.equal(pet.color, "neon");
        strict_1.default.equal(pet.hunger, 50);
        strict_1.default.equal(pet.alive, true);
    });
    (0, node_test_1.it)("serialiseState includes derived fields for the webview", () => {
        const pet = (0, gameEngine_1.createPet)("Test", "codeling", "neon");
        const serialised = (0, gameEngine_1.serialiseState)(pet);
        strict_1.default.ok("mood" in serialised);
        strict_1.default.ok("sprite" in serialised);
        strict_1.default.ok("careScore" in serialised);
    });
});
// ---------------------------------------------------------------------------
// Integration: full action sequence
// ---------------------------------------------------------------------------
(0, node_test_1.describe)("integration — action sequence", () => {
    (0, node_test_1.it)("new pet can be fed, played with, and put to sleep", () => {
        let pet = (0, gameEngine_1.createPet)("Gotchi", "codeling", "neon");
        pet = (0, gameEngine_1.feedMeal)(pet, 0);
        strict_1.default.ok(pet.events.includes("fed_meal"));
        pet = (0, gameEngine_1.play)(pet);
        strict_1.default.ok(pet.events.includes("played"));
        pet = (0, gameEngine_1.sleep)(pet);
        strict_1.default.ok(pet.sleeping);
        pet = (0, gameEngine_1.wake)(pet);
        strict_1.default.equal(pet.sleeping, false);
        strict_1.default.equal(pet.ageDays, 1);
    });
    (0, node_test_1.it)("consecutive snacks → sick → medicine → cured", () => {
        let pet = (0, gameEngine_1.createPet)("Sickly", "codeling", "neon");
        pet = (0, gameEngine_1.feedSnack)(pet);
        pet = (0, gameEngine_1.feedSnack)(pet);
        pet = (0, gameEngine_1.feedSnack)(pet);
        strict_1.default.equal(pet.sick, true);
        pet = (0, gameEngine_1.giveMedicine)(pet);
        pet = (0, gameEngine_1.giveMedicine)(pet);
        pet = (0, gameEngine_1.giveMedicine)(pet);
        strict_1.default.equal(pet.sick, false);
    });
    (0, node_test_1.it)("starving pet loses health over time and dies", () => {
        let pet = (0, gameEngine_1.createPet)("Starved", "codeling", "neon");
        // Zero out hunger and simulate HUNGER_ZERO_TICKS_BEFORE_RISK+1 ticks
        pet = { ...pet, hunger: 0, hungerZeroTicks: 0 };
        // Run enough ticks so health drains to 0 (100 health / 5 per tick = 20 ticks after risk)
        for (let i = 0; i < 200; i++) {
            if (!pet.alive) {
                break;
            }
            // Force hunger to stay 0 so starvation damage always applies
            pet = (0, gameEngine_1.tick)({ ...pet, hunger: 0 });
        }
        strict_1.default.equal(pet.alive, false);
    });
    (0, node_test_1.it)("evolves from egg through all stages to adult over many ticks", () => {
        let pet = (0, gameEngine_1.createPet)("Grower", "codeling", "neon");
        const totalTicks = gameEngine_1.EGG_DURATION_TICKS +
            gameEngine_1.BABY_DURATION_TICKS +
            gameEngine_1.CHILD_DURATION_TICKS +
            gameEngine_1.TEEN_DURATION_TICKS +
            1;
        for (let i = 0; i < totalTicks; i++) {
            if (!pet.alive) {
                break;
            }
            // Keep hunger, happiness, and health high; reset poops to prevent
            // sickness from dirty environment during this long simulation.
            pet = (0, gameEngine_1.tick)({
                ...pet,
                hunger: 80,
                happiness: 80,
                health: 100,
                poops: 0,
                sick: false,
            });
        }
        strict_1.default.equal(pet.stage, "adult");
    });
});
//# sourceMappingURL=gameEngine.test.js.map