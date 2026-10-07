/**
 * liveRank.test.mjs
 *
 * computeLiveRank() must agree with leaderboard/index.html: live entries only
 * count if pushed within 48h, entries sort by stage then stored ageDays (no
 * extrapolation), and the pet's own live entry is not counted twice.
 *
 * Run with:
 *   node --test tests/integration/liveRank.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeLiveRank } from "../../scripts/state.mjs";

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

// Mirrors the real leaderboard snapshot that produced the bug report:
// 9 finished runs + 3 live entries within 48h = 12 rows on the page.
const SCORES = [
  { stage: "senior", ageDays: 339 },
  { stage: "adult", ageDays: 157 },
  { stage: "teen", ageDays: 57 },
  { stage: "teen", ageDays: 42 },
  { stage: "child", ageDays: 28 },
  { stage: "child", ageDays: 11 },
  { stage: "child", ageDays: 8 },
  { stage: "baby", ageDays: 1 },
  { stage: "baby", ageDays: 0 },
];
const ME = { stage: "teen", ageDays: 60, spawnedAt: 111 };
const LIVE = [
  { stage: "baby", ageDays: 1, spawnedAt: 1, updatedAt: NOW - 1218 * HOUR },
  { stage: "teen", ageDays: 27, spawnedAt: 2, updatedAt: NOW - 73 * HOUR },
  { stage: "baby", ageDays: 2, spawnedAt: 3, updatedAt: NOW - 0.6 * HOUR },
  { stage: "baby", ageDays: 8, spawnedAt: 4, updatedAt: NOW - 0.1 * HOUR },
  { stage: "teen", ageDays: 60, spawnedAt: ME.spawnedAt, updatedAt: NOW },
];

describe("computeLiveRank", () => {
  it("matches the leaderboard page: #3 of 12", () => {
    assert.deepEqual(computeLiveRank(SCORES, LIVE, ME, NOW), { rank: 3, total: 12 });
  });

  it("ignores live entries older than 48h", () => {
    const { total } = computeLiveRank([], LIVE.slice(0, 2), ME, NOW);
    assert.equal(total, 1);
  });

  it("does not count the pet's own live entry twice", () => {
    const { total } = computeLiveRank([], [LIVE[4]], ME, NOW);
    assert.equal(total, 1);
  });

  it("counts own pet once when it has not pushed", () => {
    const { total } = computeLiveRank(SCORES, LIVE.slice(0, 4), ME, NOW);
    assert.equal(total, 12);
  });

  it("ranks a higher stage above a higher age", () => {
    const { rank } = computeLiveRank([{ stage: "adult", ageDays: 5 }, { stage: "child", ageDays: 999 }], [], ME, NOW);
    assert.equal(rank, 2);
  });

  it("does not extrapolate stale-ish live ages", () => {
    const old = { stage: "teen", ageDays: 27, spawnedAt: 9, updatedAt: NOW - 40 * HOUR };
    assert.equal(computeLiveRank([], [old], ME, NOW).rank, 1);
  });
});
