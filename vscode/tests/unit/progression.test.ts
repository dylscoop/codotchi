import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  ACHIEVEMENTS,
  BOSS_IDS,
  BOSS_QUEUE_MAX,
  bossAccessFor,
  bossIdForLevel,
  bossesUnlockedBetween,
  deserialisePendingBosses,
  isBossMilestone,
  DAILY_ALL_DONE_BONUS,
  DAILY_CHALLENGES,
  DAILY_CHALLENGE_XP,
  DailyChallenges,
  createDailies,
  currentStreak,
  dailiesView,
  isWeekendDay,
  pickDailyChallenges,
  previousWeekday,
  SCHEMA_VERSION,
  XP_ACHIEVEMENT_BONUS,
  XP_AMOUNTS,
  XP_DAILY_CAPS,
  XP_HOURLY_CAPS,
  achievementProgress,
  applyCodeActivity,
  applyCommitActivity,
  applyMinigameResult,
  clean,
  feedMeal,
  sleep,
  startSnack,
  awardXp,
  createPet,
  createTrainer,
  deserialiseState,
  levelProgress,
  localDayKey,
  localHourKey,
  praise,
  progressionMessage,
  serialiseState,
  xpToNextLevel,
  PetState,
} from "../../src/gameEngine";

// Today, so the pinned (empty) dailies in makePet() don't roll and pay out.
const TODAY = new Date();
const NOON = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 12, 0, 0).getTime();
const ONE_AM = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate(), 1, 0, 0).getTime();

/** A pet with no daily challenges today, so XP amounts are exact. */
function makePet(overrides: Partial<PetState> = {}): PetState {
  const dailies = { ...createDailies(), day: localDayKey(NOON) };
  return { ...createPet("Pixel", "codeling"), dailies, ...overrides };
}

describe("level curve", () => {
  it("needs round(50 × level^1.5) XP per level", () => {
    assert.equal(xpToNextLevel(1), 50);
    assert.equal(xpToNextLevel(2), 141);
    assert.equal(xpToNextLevel(4), 400);
  });

  it("maps total XP to a level and the progress into it", () => {
    assert.deepEqual(levelProgress(0), { level: 1, intoLevel: 0, needed: 50 });
    assert.deepEqual(levelProgress(49), { level: 1, intoLevel: 49, needed: 50 });
    assert.deepEqual(levelProgress(50), { level: 2, intoLevel: 0, needed: 141 });
    assert.equal(levelProgress(50 + 141 + 1).level, 3);
  });
});

describe("XP amounts and caps", () => {
  it("pays the agreed amounts", () => {
    assert.equal(XP_AMOUNTS.call, 10);
    assert.equal(XP_AMOUNTS.minigame, 10);
    assert.equal(XP_AMOUNTS.code, 2);
    assert.equal(XP_AMOUNTS.commit, 15);
    assert.equal(XP_AMOUNTS.evolve, 30);
    assert.equal(XP_ACHIEVEMENT_BONUS, 50);
    for (const src of ["care", "snack", "clean", "cure"] as const) { assert.equal(XP_AMOUNTS[src], 0); }
  });

  it("has the agreed hourly and daily caps", () => {
    assert.deepEqual(XP_HOURLY_CAPS, { code: 10, commit: 30, minigame: 20, boss_battle: 40 });
    assert.deepEqual(XP_DAILY_CAPS, { code: 40, commit: 90, call: 100, minigame: 50, boss_battle: 80 });
  });
});

describe("awardXp", () => {
  it("gives the same XP to the trainer and the pet", () => {
    const s = awardXp(makePet(), "commit", NOON);
    assert.equal(s.petXp, XP_AMOUNTS.commit);
    // first_commit unlocks too
    assert.equal(s.trainer.xp, XP_AMOUNTS.commit + XP_ACHIEVEMENT_BONUS);
    assert.ok(s.trainer.achievements.includes("first_commit"));
    assert.ok(s.events.includes("achievement_unlocked_first_commit"));
  });

  it("emits pet_level_up and trainer_level_up when a level is crossed", () => {
    const s = awardXp(makePet({ petXp: 49 }), "call", NOON);
    assert.equal(s.petLevel, 2);
    assert.ok(s.events.includes("pet_level_up"));
    const t = awardXp(makePet({ trainer: { ...createTrainer(), xp: 49 } }), "call", NOON);
    assert.equal(t.trainer.level, 2);
    assert.ok(t.events.includes("trainer_level_up"));
  });

  it("caps code-activity XP per hour but keeps counting", () => {
    let s = makePet();
    for (let i = 0; i < 20; i++) { s = awardXp(s, "code", NOON); }
    assert.equal(s.trainer.xpThisHour.code, XP_HOURLY_CAPS.code);
    assert.equal(s.petXp, XP_HOURLY_CAPS.code);
    assert.equal(s.trainer.counters.codeActivity, 20);
  });

  it("caps code-activity XP per day across hours", () => {
    let s = makePet();
    for (let h = 0; h < 10; h++) {
      for (let i = 0; i < 10; i++) { s = awardXp(s, "code", NOON - 6 * 3600_000 + h * 3600_000); }
    }
    assert.equal(s.trainer.xpToday.code, XP_DAILY_CAPS.code);
    assert.equal(s.petXp, XP_DAILY_CAPS.code);
  });

  it("caps answered calls per day only", () => {
    let s = makePet();
    for (let i = 0; i < 15; i++) { s = awardXp(s, "call", NOON); }
    assert.equal(s.trainer.xpToday.call, XP_DAILY_CAPS.call);
    assert.equal(s.trainer.counters.callsAnswered, 15);
  });

  it("resets the hourly buckets on a new hour", () => {
    let s = makePet();
    for (let i = 0; i < 20; i++) { s = awardXp(s, "code", NOON); }
    s = awardXp(s, "code", NOON + 3600_000);
    assert.equal(s.trainer.xpHour, localHourKey(NOON + 3600_000));
    assert.equal(s.trainer.xpThisHour.code, XP_AMOUNTS.code);
  });

  it("leaves evolution XP uncapped", () => {
    let s = makePet();
    for (let i = 0; i < 10; i++) { s = awardXp(s, "evolve", NOON); }
    assert.equal(s.petXp, 10 * XP_AMOUNTS.evolve);
  });

  it("resets the daily buckets on a new day", () => {
    let s = makePet();
    for (let i = 0; i < 200; i++) { s = awardXp(s, "code", NOON); }
    const tomorrow = NOON + 24 * 3600 * 1000;
    s = awardXp(s, "code", tomorrow);
    assert.equal(s.trainer.xpDay, localDayKey(tomorrow));
    assert.equal(s.trainer.xpToday.code, XP_AMOUNTS.code);
  });

  it("counts a commit after midnight towards Night Owl", () => {
    const s = awardXp(makePet(), "commit", ONE_AM);
    assert.ok(s.trainer.achievements.includes("night_owl"));
    assert.ok(!awardXp(makePet(), "commit", NOON).trainer.achievements.includes("night_owl"));
  });

  it("counts reaching senior towards Survivor", () => {
    const s = awardXp(makePet({ stage: "senior" }), "evolve", NOON);
    assert.ok(s.trainer.achievements.includes("survivor"));
  });

  it("unlocks a level achievement reached through unlock bonuses", () => {
    const xp = [1, 2, 3, 4].reduce((sum, l) => sum + xpToNextLevel(l), 0) - XP_ACHIEVEMENT_BONUS;
    const s = awardXp(makePet({ trainer: { ...createTrainer(), xp } }), "commit", NOON);
    assert.ok(s.trainer.achievements.includes("level_5"));
  });

  it("never unlocks the same achievement twice", () => {
    let s = awardXp(makePet(), "commit", NOON);
    s = awardXp(s, "commit", NOON);
    assert.equal(s.trainer.achievements.filter((a) => a === "first_commit").length, 1);
  });
});

describe("XP from actions", () => {
  it("care actions earn XP only when they answer a call", () => {
    assert.equal(feedMeal(makePet(), 0).petXp, 0);
    const fed = feedMeal(makePet({ activeAttentionCall: "hunger" }), 0);
    assert.equal(fed.petXp, XP_AMOUNTS.call);
    assert.equal(fed.trainer.counters.callsAnswered, 1);
    assert.equal(fed.trainer.counters.care, 1);
    assert.equal(clean(makePet({ poops: 1 })).petXp, 0);
    assert.equal(clean(makePet({ poops: 1, activeAttentionCall: "poop" })).petXp, XP_AMOUNTS.call);
    assert.equal(startSnack(makePet()).petXp, 0);
    assert.equal(startSnack(makePet({ activeAttentionCall: "hunger" })).petXp, XP_AMOUNTS.call);
    assert.equal(sleep(makePet()).petXp, 0);
    assert.equal(sleep(makePet({ activeAttentionCall: "low_energy" })).petXp, XP_AMOUNTS.call);
  });

  it("break calls pay the same as any other call", () => {
    assert.equal(praise(makePet({ activeAttentionCall: "break" })).petXp, XP_AMOUNTS.call);
  });

  it("code activity earns code XP", () => {
    assert.equal(applyCodeActivity(makePet()).petXp, XP_AMOUNTS.code);
  });

  it("commits earn commit XP", () => {
    assert.equal(applyCommitActivity(makePet()).petXp, XP_AMOUNTS.commit);
  });

  it("only mini-game wins earn XP", () => {
    assert.equal(applyMinigameResult(makePet(), "left_right", "win").petXp, XP_AMOUNTS.minigame);
    assert.equal(applyMinigameResult(makePet(), "left_right", "lose").petXp, 0);
  });

  it("a Boss Battle win earns boss_battle XP, counts as a mini-game win and unlocks Champion", () => {
    const won = applyMinigameResult(makePet({ pendingBosses: ["syntax_wraith"] }), "boss_battle", "win");
    assert.equal(won.trainer.counters.bossBattleWins, 1);
    assert.equal(won.trainer.counters.minigameWins, 1);
    assert.ok(won.trainer.achievements.includes("champion"));
    assert.ok(won.events.includes("achievement_unlocked_champion"));
    const lost = applyMinigameResult(makePet({ pendingBosses: ["syntax_wraith"] }), "boss_battle", "lose");
    assert.equal(lost.petXp, 0);
    assert.equal(lost.trainer.counters.bossBattleWins, undefined);
  });

  it("boss_battle XP is capped per hour and per day", () => {
    let s = makePet();
    for (let i = 0; i < 3; i++) { s = awardXp(s, "boss_battle", NOON); }
    assert.equal(s.trainer.xpThisHour.boss_battle, XP_HOURLY_CAPS.boss_battle);
    assert.equal(s.trainer.counters.bossBattleWins, 3);
    for (let h = 1; h <= 4; h++) { s = awardXp(s, "boss_battle", NOON + h * 3_600_000); }
    assert.equal(s.trainer.xpToday.boss_battle, XP_DAILY_CAPS.boss_battle);
  });

  it("praise without a call to answer earns nothing", () => {
    assert.equal(praise(makePet()).petXp, 0);
    assert.equal(praise(makePet({ activeAttentionCall: "gift" })).petXp, XP_AMOUNTS.call);
  });
});

describe("boss unlocks", () => {
  it("milestones are levels 3, 5, 10 and then every 5", () => {
    const hits = Array.from({ length: 30 }, (_, i) => i + 1).filter(isBossMilestone);
    assert.deepEqual(hits, [3, 5, 10, 15, 20, 25, 30]);
    assert.equal(bossIdForLevel(3), "syntax_wraith");
    assert.equal(bossIdForLevel(5), "nullpointer_demon");
    assert.equal(bossIdForLevel(15), "stackoverflow_behemoth");
    assert.deepEqual(bossesUnlockedBetween(2, 10), ["syntax_wraith", "nullpointer_demon", "stackoverflow_behemoth"]);
    assert.deepEqual(bossesUnlockedBetween(5, 9), []);
  });

  it("levelling past a milestone queues a boss and emits boss_unlocked", () => {
    const s = awardXp(makePet({ petXp: 190, petLevel: 2, pendingBosses: [] }), "commit", NOON);
    assert.equal(s.petLevel, 3);
    assert.deepEqual(s.pendingBosses, ["syntax_wraith"]);
    assert.ok(s.events.includes("boss_unlocked"));
    const again = awardXp(s, "commit", NOON);
    assert.deepEqual(again.pendingBosses, ["syntax_wraith"], "no new boss without a new milestone");
  });

  it("the queue holds at most BOSS_QUEUE_MAX bosses", () => {
    const s = awardXp(makePet({ petXp: 0, petLevel: 1, pendingBosses: ["syntax_wraith", "syntax_wraith"] }), "evolve", NOON);
    const big = awardXp({ ...s, petXp: 100_000 - XP_AMOUNTS.evolve, petLevel: 1 }, "evolve", NOON);
    assert.equal(big.pendingBosses.length, BOSS_QUEUE_MAX);
  });

  it("old saves past level 3 get one boss of their tier; new saves keep their queue", () => {
    assert.deepEqual(deserialisePendingBosses(undefined, 2), []);
    assert.deepEqual(deserialisePendingBosses(undefined, 7), ["nullpointer_demon"]);
    assert.deepEqual(deserialisePendingBosses([], 12), []);
    assert.deepEqual(deserialisePendingBosses(["syntax_wraith", "bogus", 3], 12), ["syntax_wraith"]);
    const s = makePet({ pendingBosses: ["nullpointer_demon"] });
    assert.deepEqual(deserialiseState(JSON.parse(JSON.stringify(serialiseState(s)))).pendingBosses, ["nullpointer_demon"]);
  });

  it("Boss Battle is a dev-mode preview: off, queued, or always available", () => {
    assert.equal(bossAccessFor(false, true, true), "off");
    assert.equal(bossAccessFor(true, false, true), "off");
    assert.equal(bossAccessFor(true, true, false), "queue");
    assert.equal(bossAccessFor(true, true, true), "always");
    const queued = makePet({ pendingBosses: ["syntax_wraith"] });
    assert.ok(applyMinigameResult(queued, "boss_battle", "win", "off").events.includes("boss_battle_no_boss"));
    const empty = makePet({ petLevel: 7, pendingBosses: [] });
    assert.ok(applyMinigameResult(empty, "boss_battle", "win", "queue").events.includes("boss_battle_no_boss"));
    const won = applyMinigameResult(empty, "boss_battle", "win", "always");
    assert.equal(won.trainer.counters.bossBattleWins, 1);
    assert.deepEqual([...won.pendingBosses], []);
    assert.deepEqual([...applyMinigameResult(empty, "boss_battle", "lose", "always").pendingBosses], [], "the stand-in boss is never stored");
    const real = applyMinigameResult({ ...queued, petLevel: 7 }, "boss_battle", "lose", "always");
    assert.deepEqual([...real.pendingBosses], ["syntax_wraith"], "a queued boss is fought first");
  });

  it("matches the Kotlin boss ids and queue size", () => {
    const kt = fs.readFileSync(path.join(__dirname, "../../../../pycharm/src/main/kotlin/com/codotchi/engine/Progression.kt"), "utf8");
    assert.ok(kt.includes(`val BOSS_IDS: List<String> = listOf(${BOSS_IDS.map((id) => `"${id}"`).join(", ")})`));
    assert.ok(kt.includes(`const val BOSS_QUEUE_MAX: Int = ${BOSS_QUEUE_MAX}`));
  });
});

describe("persistence", () => {
  it("round-trips progression and survives into the next pet", () => {
    const s = awardXp(awardXp(makePet(), "commit", NOON), "code", NOON);
    const loaded = deserialiseState(JSON.parse(JSON.stringify(serialiseState(s))));
    assert.deepEqual(loaded.trainer, s.trainer);
    assert.equal(loaded.petXp, s.petXp);
    const next = createPet("Egg", "codeling", null, loaded.trainer);
    assert.equal(next.petXp, 0);
    assert.equal(next.petLevel, 1);
    assert.deepEqual(next.trainer, s.trainer);
  });

  it("migrates a save from before schemaVersion", () => {
    const old = serialiseState(makePet()) as Record<string, unknown>;
    delete old.schemaVersion; delete old.petXp; delete old.petLevel; delete old.trainer;
    const loaded = deserialiseState(old);
    assert.equal(loaded.schemaVersion, SCHEMA_VERSION);
    assert.equal(loaded.petXp, 0);
    assert.deepEqual(loaded.trainer, createTrainer());
  });

  it("drops retired achievement ids and old-rules daily buckets", () => {
    const raw = serialiseState(makePet()) as Record<string, unknown>;
    raw.trainer = { xp: 10, achievements: ["hello_world", "caretaker"], xpDay: "2026-10-14", xpToday: { code: 200, care: 100 } };
    const t = deserialiseState(raw).trainer;
    assert.deepEqual(t.achievements, ["hello_world"]);
    assert.deepEqual(t.xpToday, {});
    raw.trainer = { xp: 10, xpDay: "2026-10-14", xpToday: { code: 200, care: 100, commit: 15 }, xpHour: "2026-10-14T12", xpThisHour: { code: 4 } };
    const t2 = deserialiseState(raw).trainer;
    assert.deepEqual(t2.xpToday, { commit: 15 });
    assert.deepEqual(t2.xpThisHour, { code: 4 });
  });

  it("ignores junk in the saved trainer", () => {
    const raw = serialiseState(makePet()) as Record<string, unknown>;
    raw.trainer = { xp: "lots", achievements: [1, "gamer"], counters: { commits: 3, bad: "x" } };
    const t = deserialiseState(raw).trainer;
    assert.equal(t.xp, 0);
    assert.deepEqual(t.achievements, ["gamer"]);
    assert.deepEqual(t.counters, { commits: 3 });
  });
});

describe("progressionMessage", () => {
  it("describes unlocks and trainer level-ups only", () => {
    const s = awardXp(makePet(), "commit", NOON);
    assert.equal(progressionMessage("achievement_unlocked_first_commit", s), "Achievement unlocked: 📌 First Commit — Make a commit");
    assert.equal(progressionMessage("trainer_level_up", s), `Level up! You're now trainer level ${s.trainer.level}.`);
    assert.equal(progressionMessage("pet_level_up", s), null);
    assert.equal(progressionMessage("fed_meal", s), null);
  });
});

describe("ACHIEVEMENTS", () => {
  it("has unique ids", () => {
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  });

  it("splits into the Coder and Keeper paths plus shared trainer milestones", () => {
    const ids = (path: string) => ACHIEVEMENTS.filter((a) => a.path === path).map((a) => a.id);
    assert.ok(ids("coder").includes("first_commit"));
    assert.ok(ids("keeper").includes("on_call"));
    assert.deepEqual(ids("trainer"), ["level_5", "level_10", "level_25"]);
    assert.deepEqual(ACHIEVEMENTS.filter((a) => a.comingSoon).map((a) => a.id),
      ["detective", "first_blood", "exterminator"]);
  });

  it("never unlocks coming-soon achievements", () => {
    const s = awardXp(makePet({ trainer: { ...createTrainer(), counters: { bossKills: 99 } } }), "code", NOON);
    assert.ok(!s.trainer.achievements.includes("first_blood"));
  });

  it("reports progress capped at the threshold", () => {
    const on = ACHIEVEMENTS.find((a) => a.id === "on_call")!;
    assert.deepEqual(achievementProgress(on, { ...createTrainer(), counters: { callsAnswered: 42 } }), { value: 42, threshold: 100 });
    assert.deepEqual(achievementProgress(on, { ...createTrainer(), counters: { callsAnswered: 420 } }), { value: 100, threshold: 100 });
  });

  it("matches ACHIEVEMENT_INFO in the webview", () => {
    const js = fs.readFileSync(path.join(__dirname, "..", "..", "..", "media", "sidebar.js"), "utf8");
    const block = js.slice(js.indexOf("const ACHIEVEMENT_INFO = {"), js.indexOf("};", js.indexOf("const ACHIEVEMENT_INFO = {")));
    const rows = [...block.matchAll(/^\s+(\w+):\s+\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"(\w+)",\s*(\d+),\s*"(\w+)"(,\s*true)?\]/gm)]
      .map((m) => ({ id: m[1], emoji: m[2], name: m[3], description: m[4], counter: m[5], threshold: Number(m[6]), path: m[7], comingSoon: !!m[8] }));
    assert.deepEqual(rows, ACHIEVEMENTS.map(({ id, emoji, name, description, counter, threshold, path, comingSoon }) =>
      ({ id, emoji, name, description, counter, threshold, path, comingSoon: !!comingSoon })));
  });

  it("has an unlock hint for every achievement counter and daily challenge in the webview", () => {
    const js = fs.readFileSync(path.join(__dirname, "..", "..", "..", "media", "sidebar.js"), "utf8");
    const keys = (name: string): string[] => {
      const start = js.indexOf(`const ${name} = {`);
      const block = js.slice(start, js.indexOf("};", start));
      return [...block.matchAll(/^\s+(\w+):\s+"/gm)].map((m) => m[1]).sort();
    };
    assert.deepEqual(keys("UNLOCK_HINTS"), [...new Set(ACHIEVEMENTS.map((a) => a.counter))].sort());
    assert.deepEqual(keys("DAILY_HINTS"), DAILY_CHALLENGES.map((c) => c.id).sort());
  });

  it("matches ACHIEVEMENTS in the Kotlin engine", () => {
    const kt = fs.readFileSync(path.join(__dirname, "../../../../pycharm/src/main/kotlin/com/codotchi/engine/Progression.kt"), "utf8");
    const rows = [...kt.matchAll(/Achievement\("(\w+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"(\w+)",\s*(\d+),\s*"(\w+)"(,\s*comingSoon = true)?\)/g)]
      .map((m) => ({ id: m[1], name: m[2], description: m[3], emoji: m[4], counter: m[5], threshold: Number(m[6]), path: m[7], comingSoon: !!m[8] }));
    assert.deepEqual(rows, ACHIEVEMENTS.map((a) => ({ ...a, comingSoon: !!a.comingSoon })));
  });
});

/** Seeded picks for 2026-10-14 / "Pixel" / spawnedAt 1760000000000 (shared with ProgressionTest.kt). */
const PICKS_FIXTURE = ["code_10", "care_10", "snack_and_commit"];

/** Local noon on 2026-10-<day> (the 12th is a Monday). */
const oct = (day: number, hour = 12): number => new Date(2026, 9, day, hour, 0, 0).getTime();

/** A pet whose dailies for `day` are all set up and nearly done: one more award of each kind finishes them. */
function petWithPicks(now: number, dailies: Partial<DailyChallenges> = {}): PetState {
  const pet = makePet({ spawnedAt: 1 });
  const day = localDayKey(now);
  return { ...pet, dailies: { ...createDailies(), ...dailies, day, picks: ["commit_1", "calls_3", "win_1"], baseline: {}, done: [] } };
}

function finishAll(s: PetState, now: number): PetState {
  s = awardXp(s, "commit", now);
  for (let i = 0; i < 3; i++) { s = awardXp(s, "call", now); }
  return awardXp(s, "minigame", now);
}

describe("daily challenges", () => {
  it("picks one coder, one keeper and one wildcard", () => {
    const picks = pickDailyChallenges("2026-10-14", { name: "Pixel", spawnedAt: 123 });
    assert.deepEqual(picks.map((id) => DAILY_CHALLENGES.find((c) => c.id === id)!.path), ["coder", "keeper", "wild"]);
  });

  it("is seeded from the date and the pet", () => {
    const pet = { name: "Pixel", spawnedAt: 123 };
    assert.deepEqual(pickDailyChallenges("2026-10-14", pet), pickDailyChallenges("2026-10-14", pet));
    const days = new Set(Array.from({ length: 20 }, (_, i) => pickDailyChallenges(`2026-10-${String(i + 1).padStart(2, "0")}`, pet).join()));
    assert.ok(days.size > 1);
  });

  it("matches the Kotlin seeded picks", () => {
    // Same fixture as ProgressionTest.kt.
    assert.deepEqual(pickDailyChallenges("2026-10-14", { name: "Pixel", spawnedAt: 1760000000000 }), PICKS_FIXTURE);
  });

  it("rolls the day on the first award and measures progress from then", () => {
    const pet = makePet({ dailies: createDailies(), trainer: { ...createTrainer(), counters: { commits: 50 } } });
    const s = awardXp(pet, "code", NOON);
    assert.equal(s.dailies.day, localDayKey(NOON));
    assert.equal(s.dailies.picks.length, 3);
    assert.equal(s.dailies.baseline.commits, 50);
  });

  it("pays 25 XP per challenge and 25 more for all three, once", () => {
    let s = petWithPicks(NOON);
    s = finishAll(s, NOON);
    assert.deepEqual([...s.dailies.done].sort(), ["calls_3", "commit_1", "win_1"]);
    assert.ok(s.recentEventLog.includes("daily_challenges_all_done"));
    const plain = finishAll(makePet({ dailies: { ...createDailies(), day: localDayKey(NOON), picks: [], baseline: {}, done: [] } }), NOON);
    assert.equal(s.petXp - plain.petXp, 3 * DAILY_CHALLENGE_XP + DAILY_ALL_DONE_BONUS);
    const again = finishAll(s, NOON);
    assert.equal(again.petXp - s.petXp, plain.petXp);
  });

  it("resets at local midnight", () => {
    let s = finishAll(petWithPicks(NOON), NOON);
    const tomorrow = NOON + 24 * 3600_000;
    s = awardXp(s, "code", tomorrow);
    assert.equal(s.dailies.day, localDayKey(tomorrow));
    assert.ok(s.dailies.done.length < 3);
  });

  it("shows today's challenges before the first award", () => {
    const v = dailiesView(makePet({ dailies: createDailies() }), NOON);
    assert.equal(v.challenges.length, 3);
    assert.ok(v.challenges.every((c) => c.value === 0 && !c.done));
    assert.equal(v.streak, 0);
  });

  it("starts afresh for a new pet", () => {
    const s = finishAll(petWithPicks(NOON), NOON);
    const next = createPet("Egg", "codeling", null, s.trainer);
    assert.deepEqual(next.dailies, createDailies());
  });

  it("round-trips through a save", () => {
    const s = finishAll(petWithPicks(NOON), NOON);
    assert.deepEqual(deserialiseState(JSON.parse(JSON.stringify(serialiseState(s)))).dailies, s.dailies);
    const old = serialiseState(makePet()) as Record<string, unknown>;
    delete old.dailies;
    assert.equal(old.dailies, undefined);
    assert.deepEqual(deserialiseState(old).dailies, createDailies());
  });
});

describe("streak", () => {
  it("knows weekends and the previous weekday", () => {
    assert.ok(isWeekendDay("2026-10-17"));
    assert.ok(isWeekendDay("2026-10-18"));
    assert.ok(!isWeekendDay("2026-10-19"));
    assert.equal(previousWeekday("2026-10-19"), "2026-10-16");
    assert.equal(previousWeekday("2026-10-14"), "2026-10-13");
  });

  it("grows on consecutive weekdays", () => {
    const tue = finishAll(petWithPicks(oct(13), { streak: 1, streakDay: "2026-10-12" }), oct(13));
    assert.equal(tue.dailies.streak, 2);
    assert.equal(tue.dailies.streakDay, "2026-10-13");
  });

  it("restarts after a missed weekday", () => {
    const thu = finishAll(petWithPicks(oct(15), { streak: 4, streakDay: "2026-10-13" }), oct(15));
    assert.equal(thu.dailies.streak, 1);
    assert.equal(currentStreak({ ...createDailies(), streak: 4, streakDay: "2026-10-13" }, oct(15)), 0);
  });

  it("isn't broken by a skipped weekend", () => {
    const mon = finishAll(petWithPicks(oct(19), { streak: 5, streakDay: "2026-10-16" }), oct(19));
    assert.equal(mon.dailies.streak, 6);
    assert.equal(currentStreak({ ...createDailies(), streak: 5, streakDay: "2026-10-16" }, oct(18)), 5);
  });

  it("isn't extended by finishing on a weekend", () => {
    const sat = finishAll(petWithPicks(oct(17), { streak: 5, streakDay: "2026-10-16" }), oct(17));
    assert.equal(sat.dailies.streak, 5);
    assert.equal(sat.dailies.streakDay, "2026-10-16");
    assert.ok(sat.recentEventLog.includes("daily_challenges_all_done"));
  });

  it("is lost when the pet dies", () => {
    const s = finishAll(petWithPicks(oct(13), { streak: 1, streakDay: "2026-10-12" }), oct(13));
    assert.equal(createPet("Egg", "codeling", null, s.trainer).dailies.streak, 0);
  });
});

describe("daily challenge messages", () => {
  it("describes completions", () => {
    const s = finishAll(petWithPicks(oct(13), { streak: 1, streakDay: "2026-10-12" }), oct(13));
    assert.equal(progressionMessage("daily_challenge_done_commit_1", s), `Daily challenge done: Make a commit (+${DAILY_CHALLENGE_XP} XP)`);
    assert.equal(progressionMessage("daily_challenges_all_done", s), `All of today's challenges done! +${DAILY_ALL_DONE_BONUS} bonus XP. Streak: 2 days.`);
  });

  it("match the Kotlin daily challenges", () => {
    const kt = fs.readFileSync(path.join(__dirname, "../../../../pycharm/src/main/kotlin/com/codotchi/engine/Progression.kt"), "utf8");
    const rows = [...kt.matchAll(/DailyChallenge\("(\w+)",\s*"(\w+)",\s*"([^"]+)",\s*listOf\(([^)]*)\)\)/g)].map((m) => ({
      id: m[1], path: m[2], text: m[3],
      reqs: [...m[4].matchAll(/"(\w+)" to (\d+)/g)].map((r) => [r[1], Number(r[2])]),
    }));
    assert.deepEqual(rows, DAILY_CHALLENGES.map((c) => ({ ...c, reqs: c.reqs.map(([k, n]) => [k, n]) })));
  });
});
