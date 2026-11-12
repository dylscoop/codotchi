/**
 * Daily age bump: the first tick on a new local calendar day adds one day to
 * dayTimer and drops the fraction (8.5 → 9.0), even for idle pets.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPet,
  tick,
  applyDailyAgeBump,
  localDateKey,
  deserialiseState,
  serialiseState,
  DEFAULT_GAME_CONFIG,
  PetState,
} from "../../src/gameEngine";

const NOW = new Date(2026, 10, 12, 8, 30).getTime();
const TODAY = localDateKey(NOW);
const YESTERDAY = localDateKey(new Date(2026, 10, 11, 23, 0).getTime());
const NO_CALLS = { ...DEFAULT_GAME_CONFIG, attentionCallsEnabled: false };

function pet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Rex", "codeling"), stage: "adult", dayTimer: 8.5, ageDays: 8, lastAgeBumpDate: YESTERDAY, ...overrides };
}

describe("localDateKey", () => {
  it("formats the local date as YYYY-MM-DD", () => {
    assert.equal(localDateKey(new Date(2026, 0, 5, 0, 1).getTime()), "2026-01-05");
  });
});

describe("applyDailyAgeBump", () => {
  it("adds a day and drops the fraction on the first run of a new day", () => {
    const next = applyDailyAgeBump(pet(), NOW);
    assert.equal(next.dayTimer, 9);
    assert.equal(next.ageDays, 9);
    assert.equal(next.lastAgeBumpDate, TODAY);
    assert.ok(next.events.includes("aged_overnight"));
  });

  it("a whole-number dayTimer still gains exactly one day", () => {
    assert.equal(applyDailyAgeBump(pet({ dayTimer: 8 }), NOW).dayTimer, 9);
  });

  it("does nothing a second time the same day", () => {
    const once = applyDailyAgeBump(pet(), NOW);
    const twice = applyDailyAgeBump({ ...once, events: [] }, NOW + 3600_000);
    assert.equal(twice.dayTimer, 9);
    assert.ok(!twice.events.includes("aged_overnight"));
  });

  it("gives only one bump however many days were missed", () => {
    const next = applyDailyAgeBump(pet({ lastAgeBumpDate: "2026-11-01" }), NOW);
    assert.equal(next.dayTimer, 9);
  });

  it("an old save without the field records today and doesn't bump", () => {
    const next = applyDailyAgeBump(pet({ lastAgeBumpDate: null }), NOW);
    assert.equal(next.dayTimer, 8.5);
    assert.equal(next.lastAgeBumpDate, TODAY);
    assert.ok(!next.events.includes("aged_overnight"));
  });

  it("skips dead and paused pets", () => {
    assert.equal(applyDailyAgeBump(pet({ alive: false }), NOW).dayTimer, 8.5);
    assert.equal(applyDailyAgeBump(pet({ paused: true }), NOW).dayTimer, 8.5);
  });

  it("a new pet is not bumped on the day it hatches", () => {
    const fresh = createPet("Rex", "codeling");
    assert.equal(applyDailyAgeBump(fresh).dayTimer, fresh.dayTimer);
  });
});

describe("tick with the daily age bump", () => {
  it("bumps a deep-idle pet and keeps the aged_overnight event", () => {
    const next = tick(pet(), true, true, NO_CALLS, NOW);
    assert.equal(next.dayTimer, 9);
    assert.equal(next.ageDays, 9);
    assert.ok(next.events.includes("aged_overnight"));
  });

  it("the next tick the same day doesn't bump again", () => {
    const first = tick(pet(), true, true, NO_CALLS, NOW);
    const second = tick(first, true, true, NO_CALLS, NOW + 3000);
    assert.equal(second.dayTimer, 9);
    assert.ok(!second.events.includes("aged_overnight"));
  });

  it("a pet left open past midnight bumps once", () => {
    const lateNight = new Date(2026, 10, 11, 23, 59, 59).getTime();
    let s = tick(pet(), false, false, NO_CALLS, lateNight);
    const before = s.dayTimer;
    s = tick(s, false, false, NO_CALLS, lateNight + 3000);
    assert.ok(s.events.includes("aged_overnight"));
    assert.equal(s.dayTimer >= Math.floor(before + 1), true);
  });
});

describe("lastAgeBumpDate persistence", () => {
  it("round-trips through serialise/deserialise", () => {
    const s = pet();
    assert.equal(deserialiseState(serialiseState(s) as Record<string, unknown>).lastAgeBumpDate, YESTERDAY);
  });

  it("is null for saves without it", () => {
    const raw = serialiseState(pet()) as Record<string, unknown>;
    delete raw.lastAgeBumpDate;
    assert.equal(deserialiseState(raw).lastAgeBumpDate, null);
  });
});
