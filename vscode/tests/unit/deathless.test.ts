/**
 * Deathless mode (health floor 1, old-age death still possible, off the
 * leaderboard) and the local Afterlife (Bury / Cremate).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPet,
  tick,
  deserialiseState,
  serialiseState,
  isDeathlessPet,
  markDeathless,
  DEFAULT_GAME_CONFIG,
  GameConfig,
  PetState,
} from "../../src/gameEngine";
import { leaderboardBlockedReason, sealState, verifySeal } from "../../src/integrity";
import {
  EMPTY_AFTERLIFE,
  afterlifePending,
  afterlifeView,
  decideAfterlife,
  parseAfterlife,
  settleBeforeNewPet,
} from "../../src/afterlife";

const KEY = "test-key";
const NO_CALLS: GameConfig = { ...DEFAULT_GAME_CONFIG, attentionCallsEnabled: false };
const DEATHLESS: GameConfig = { ...NO_CALLS, deathless: true };

function makePet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Pixel", "codeling"), ...overrides };
}

/** A pet one damage tick away from death: starving, miserable, sick, health 1. */
function dyingPet(): PetState {
  return makePet({ stage: "adult", hunger: 100, happiness: 0, energy: 0, health: 0.5, sick: true, hungerZeroTicks: 1000 });
}

function roundTrip(s: PetState): PetState {
  return deserialiseState(JSON.parse(JSON.stringify(serialiseState(s))));
}

describe("deathless mode — engine", () => {
  it("a normal pet still dies from neglect", () => {
    let s = dyingPet();
    for (let i = 0; i < 50 && s.alive; i++) { s = tick(s, false, false, NO_CALLS); }
    assert.equal(s.alive, false);
  });

  it("floors health at 1 so neglect can't kill the pet", () => {
    let s = dyingPet();
    for (let i = 0; i < 500; i++) { s = tick(s, false, false, DEATHLESS); }
    assert.equal(s.alive, true);
    assert.ok(s.health >= 1);
  });

  it("the pet can still get sick", () => {
    let s = dyingPet();
    for (let i = 0; i < 20; i++) { s = tick(s, false, false, DEATHLESS); }
    assert.equal(s.sick, true);
  });

  it("the pet can still die of old age", () => {
    const realRandom = Math.random;
    Math.random = () => 0; // every old-age roll hits
    try {
      let s = makePet({ stage: "senior", ageDays: 400, dayTimer: 400.99 });
      for (let i = 0; i < 20000 && s.alive; i++) { s = tick(s, false, false, DEATHLESS); }
      assert.equal(s.alive, false);
      assert.ok(s.recentEventLog.includes("died_of_old_age"));
    } finally {
      Math.random = realRandom;
    }
  });

  it("any tick in deathless mode marks the pet for life", () => {
    let s = tick(makePet(), false, false, DEATHLESS);
    assert.equal(isDeathlessPet(s), true);
    s = tick(s, false, false, NO_CALLS);
    assert.equal(isDeathlessPet(s), true);
  });

  it("the mark survives a save/load round trip", () => {
    assert.equal(isDeathlessPet(roundTrip(markDeathless(makePet()))), true);
  });

  it("markDeathless keeps a tampered mark", () => {
    const tampered = makePet({ leaderboardIneligible: "tampered" });
    assert.equal(markDeathless(tampered), tampered);
  });
});

describe("deathless mode — leaderboard", () => {
  it("blocks a deathless pet", () => {
    assert.match(leaderboardBlockedReason(markDeathless(makePet()), false, KEY) ?? "", /deathless/);
  });

  it("the seal still verifies for a deathless pet", () => {
    const s = roundTrip(markDeathless(makePet()));
    assert.equal(verifySeal(s, sealState(s, KEY), KEY).leaderboardIneligible, "deathless");
  });

  it("a missing seal doesn't clear the deathless mark", () => {
    assert.equal(verifySeal(markDeathless(makePet()), undefined, KEY).leaderboardIneligible, "deathless");
  });
});

describe("afterlife", () => {
  const dead = (overrides: Partial<PetState> = {}): PetState =>
    makePet({ alive: false, spawnedAt: 1000, diedAt: 5000, ageDays: 12, recentEventLog: ["died"], ...overrides });

  it("a living pet isn't pending", () => {
    assert.equal(afterlifePending(EMPTY_AFTERLIFE, makePet({ spawnedAt: 1000 })), false);
  });

  it("a dead pet is pending until decided", () => {
    assert.equal(afterlifePending(EMPTY_AFTERLIFE, dead()), true);
  });

  it("bury adds an entry, newest first", () => {
    const a1 = decideAfterlife(EMPTY_AFTERLIFE, dead({ name: "One" }), "bury");
    const a2 = decideAfterlife(a1, dead({ name: "Two", spawnedAt: 2000 }), "bury");
    assert.deepEqual(a2.buried.map((e) => e.name), ["Two", "One"]);
    assert.equal(a2.cremated, 0);
    assert.equal(a2.buried[0].cause, "neglect");
    assert.equal(afterlifePending(a2, dead({ spawnedAt: 2000 })), false);
  });

  it("records old-age deaths and the deathless marker", () => {
    const a = decideAfterlife(EMPTY_AFTERLIFE,
      markDeathless(dead({ recentEventLog: ["died_of_old_age"] })), "bury");
    assert.equal(a.buried[0].cause, "old_age");
    assert.equal(a.buried[0].deathless, true);
  });

  it("cremate only bumps the urn count", () => {
    const a = decideAfterlife(EMPTY_AFTERLIFE, dead(), "cremate");
    assert.equal(a.buried.length, 0);
    assert.equal(a.cremated, 1);
  });

  it("a second choice for the same pet is ignored", () => {
    const a = decideAfterlife(EMPTY_AFTERLIFE, dead(), "bury");
    assert.equal(decideAfterlife(a, dead(), "cremate"), a);
  });

  it("an undecided pet is cremated when a new pet hatches", () => {
    const a = settleBeforeNewPet(EMPTY_AFTERLIFE, dead());
    assert.equal(a.cremated, 1);
    assert.equal(a.buried.length, 0);
  });

  it("settling a decided or living pet changes nothing", () => {
    const a = decideAfterlife(EMPTY_AFTERLIFE, dead(), "bury");
    assert.equal(settleBeforeNewPet(a, dead()), a);
    assert.equal(settleBeforeNewPet(a, makePet({ spawnedAt: 9 })), a);
    assert.equal(settleBeforeNewPet(a, null), a);
  });

  it("parseAfterlife tolerates missing or corrupt data", () => {
    assert.deepEqual(parseAfterlife(undefined), EMPTY_AFTERLIFE);
    assert.deepEqual(parseAfterlife({ buried: "x", cremated: -3 }), EMPTY_AFTERLIFE);
    const ok = decideAfterlife(EMPTY_AFTERLIFE, dead(), "bury");
    assert.deepEqual(parseAfterlife(JSON.parse(JSON.stringify(ok))), ok);
  });

  it("afterlifeView reports pending for the dead pet", () => {
    assert.equal(afterlifeView(EMPTY_AFTERLIFE, dead()).pending, true);
    assert.equal(afterlifeView(EMPTY_AFTERLIFE, null).pending, false);
  });

  it("uses the user's afterlife name, falling back to Afterlife", () => {
    assert.equal(afterlifeView(EMPTY_AFTERLIFE, null, "  Pet Heaven ").name, "Pet Heaven");
    assert.equal(afterlifeView(EMPTY_AFTERLIFE, null, "   ").name, "Afterlife");
    assert.equal(afterlifeView(EMPTY_AFTERLIFE, null, undefined).name, "Afterlife");
    assert.equal(afterlifeView(EMPTY_AFTERLIFE, null, "x".repeat(50)).name.length, 32);
  });
});
