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
  applyCodeActivity,
  applyCommitActivity,
  applyMinigameResult,
  awardXp,
  createPet,
  createTrainer,
  deserialiseState,
  levelProgress,
  localDayKey,
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
  it("needs round(100 × level^1.5) XP per level", () => {
    assert.equal(xpToNextLevel(1), 100);
    assert.equal(xpToNextLevel(2), 283);
    assert.equal(xpToNextLevel(4), 800);
  });

  it("maps total XP to a level and the progress into it", () => {
    assert.deepEqual(levelProgress(0), { level: 1, intoLevel: 0, needed: 100 });
    assert.deepEqual(levelProgress(99), { level: 1, intoLevel: 99, needed: 100 });
    assert.deepEqual(levelProgress(100), { level: 2, intoLevel: 0, needed: 283 });
    assert.equal(levelProgress(100 + 283 + 1).level, 3);
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
    const s = awardXp(makePet({ petXp: 99 }), "care", NOON);
    assert.equal(s.petLevel, 2);
    assert.ok(s.events.includes("pet_level_up"));
    const t = awardXp(makePet({ trainer: { ...createTrainer(), xp: 99 } }), "care", NOON);
    assert.equal(t.trainer.level, 2);
    assert.ok(t.events.includes("trainer_level_up"));
  });

  it("caps code-activity XP per day but keeps counting", () => {
    let s = makePet();
    for (let i = 0; i < 200; i++) { s = awardXp(s, "code", NOON); }
    assert.equal(s.trainer.xpToday.code, XP_DAILY_CAPS.code);
    assert.equal(s.petXp, XP_DAILY_CAPS.code);
    assert.equal(s.trainer.counters.codeActivity, 200);
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
    assert.equal(praise(makePet({ activeAttentionCall: "gift" })).petXp, XP_AMOUNTS.care);
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

  it("matches ACHIEVEMENT_INFO in the webview", () => {
    const js = fs.readFileSync(path.join(__dirname, "..", "..", "..", "media", "sidebar.js"), "utf8");
    const block = js.slice(js.indexOf("const ACHIEVEMENT_INFO = {"), js.indexOf("};", js.indexOf("const ACHIEVEMENT_INFO = {")));
    const rows = [...block.matchAll(/^\s+(\w+):\s+\["([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\]/gm)]
      .map((m) => ({ id: m[1], emoji: m[2], name: m[3], description: m[4] }));
    assert.deepEqual(rows, ACHIEVEMENTS.map(({ id, emoji, name, description }) => ({ id, emoji, name, description })));
  });

  it("matches ACHIEVEMENTS in the Kotlin engine", () => {
    const kt = fs.readFileSync(path.join(__dirname, "../../../../pycharm/src/main/kotlin/com/codotchi/engine/Progression.kt"), "utf8");
    const rows = [...kt.matchAll(/Achievement\("(\w+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"(\w+)",\s*(\d+)\)/g)]
      .map((m) => ({ id: m[1], name: m[2], description: m[3], emoji: m[4], counter: m[5], threshold: Number(m[6]) }));
    assert.deepEqual(rows, ACHIEVEMENTS.map((a) => ({ ...a })));
  });
});
