import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  ACHIEVEMENTS,
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

const NOON = new Date(2026, 9, 14, 12, 0, 0).getTime();
const ONE_AM = new Date(2026, 9, 14, 1, 0, 0).getTime();

function makePet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Pixel", "codeling"), ...overrides };
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
    assert.deepEqual(XP_HOURLY_CAPS, { code: 10, commit: 30, minigame: 20 });
    assert.deepEqual(XP_DAILY_CAPS, { code: 40, commit: 90, call: 100, minigame: 50 });
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

  it("praise without a call to answer earns nothing", () => {
    assert.equal(praise(makePet()).petXp, 0);
    assert.equal(praise(makePet({ activeAttentionCall: "gift" })).petXp, XP_AMOUNTS.call);
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
      ["detective", "first_blood", "exterminator", "champion"]);
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

  it("matches ACHIEVEMENTS in the Kotlin engine", () => {
    const kt = fs.readFileSync(path.join(__dirname, "../../../../pycharm/src/main/kotlin/com/codotchi/engine/Progression.kt"), "utf8");
    const rows = [...kt.matchAll(/Achievement\("(\w+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"(\w+)",\s*(\d+),\s*"(\w+)"(,\s*comingSoon = true)?\)/g)]
      .map((m) => ({ id: m[1], name: m[2], description: m[3], emoji: m[4], counter: m[5], threshold: Number(m[6]), path: m[7], comingSoon: !!m[8] }));
    assert.deepEqual(rows, ACHIEVEMENTS.map((a) => ({ ...a, comingSoon: !!a.comingSoon })));
  });
});
