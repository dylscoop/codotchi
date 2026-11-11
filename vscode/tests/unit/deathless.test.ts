/**
 * Deathless mode (health floor 1, old-age death still possible, off the
 * leaderboard) and the local Afterlife (Bury / Cremate).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
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
  clearAfterlife,
  cremate,
  removeAfterlifeEntry,
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

  it("a deathless pet stays deathless for life, even with the setting off", () => {
    let s = markDeathless(dyingPet());
    for (let i = 0; i < 500; i++) { s = tick(s, false, false, NO_CALLS); }
    assert.equal(s.alive, true);
    assert.ok(s.health >= 1);
    assert.equal(s.sick, true);
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
      let s = markDeathless(makePet({ stage: "senior", ageDays: 400, dayTimer: 400.99 }));
      for (let i = 0; i < 20000 && s.alive; i++) { s = tick(s, false, false, NO_CALLS); }
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

  it("a dead pet is pending until cremated", () => {
    assert.equal(afterlifePending(EMPTY_AFTERLIFE, dead()), true);
  });

  it("cremating records name, age and time alive, newest first", () => {
    const a1 = cremate(EMPTY_AFTERLIFE, dead({ name: "One" }));
    const a2 = cremate(a1, dead({ name: "Two", spawnedAt: 2000, diedAt: 9000 }));
    assert.deepEqual(a2.cremated.map((e) => e.name), ["Two", "One"]);
    assert.equal(a2.cremated[0].ageDays, 12);
    assert.equal(a2.cremated[0].diedAt - a2.cremated[0].spawnedAt, 7000);
    assert.equal(a2.cremated[0].cause, "neglect");
    assert.equal(afterlifePending(a2, dead({ spawnedAt: 2000 })), false);
  });

  it("records old-age deaths and the deathless marker", () => {
    const a = cremate(EMPTY_AFTERLIFE, markDeathless(dead({ recentEventLog: ["died_of_old_age"] })));
    assert.equal(a.cremated[0].cause, "old_age");
    assert.equal(a.cremated[0].deathless, true);
  });

  it("a pet can't be cremated twice", () => {
    const a = cremate(EMPTY_AFTERLIFE, dead());
    assert.equal(cremate(a, dead()), a);
  });

  it("an uncremated pet is cremated when a new pet hatches", () => {
    const a = settleBeforeNewPet(EMPTY_AFTERLIFE, dead());
    assert.equal(a.cremated.length, 1);
    assert.equal(settleBeforeNewPet(a, dead()), a);
    assert.equal(settleBeforeNewPet(a, makePet({ spawnedAt: 9 })), a);
    assert.equal(settleBeforeNewPet(a, null), a);
  });

  it("removes one entry by spawnedAt", () => {
    const a = cremate(cremate(EMPTY_AFTERLIFE, dead({ name: "One" })), dead({ name: "Two", spawnedAt: 2000 }));
    assert.deepEqual(removeAfterlifeEntry(a, 1000).cremated.map((e) => e.name), ["Two"]);
    assert.equal(removeAfterlifeEntry(a, 42), a);
  });

  it("clearing empties the list but the last pet still can't be cremated again", () => {
    const a = clearAfterlife(cremate(EMPTY_AFTERLIFE, dead()));
    assert.equal(a.cremated.length, 0);
    assert.equal(cremate(a, dead()), a);
  });

  it("parseAfterlife tolerates missing, corrupt or old (2.35.0) data", () => {
    assert.deepEqual(parseAfterlife(undefined), EMPTY_AFTERLIFE);
    assert.deepEqual(parseAfterlife({ buried: [], cremated: 3 }), EMPTY_AFTERLIFE);
    const ok = cremate(EMPTY_AFTERLIFE, dead());
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

describe("deathless is a menu choice, not a setting", () => {
  const root = path.join(__dirname, "../../..");
  const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

  it("has no codotchi.deathless setting in VS Code or PyCharm", () => {
    const pkg = JSON.parse(read("package.json"));
    for (const section of pkg.contributes.configuration) {
      assert.ok(!("codotchi.deathless" in section.properties));
    }
    assert.ok(!/var deathless:/.test(read("../pycharm/src/main/kotlin/com/codotchi/CodotchiSettings.kt")));
    assert.ok(!/deathlessCheck/.test(read("../pycharm/src/main/kotlin/com/codotchi/CodotchiConfigurable.kt")));
  });

  it("Continue with Deathless ticked asks first, then sends make_deathless", () => {
    const html = read("media/sidebar.html");
    assert.ok(html.includes("id=\"deathless-confirm\"") && html.includes("id=\"btn-deathless-yes\""));
    const js = read("media/sidebar.js");
    const onContinue = js.slice(js.indexOf("btnContinue.addEventListener"), js.indexOf("if (btnDeathlessYes)"));
    assert.ok(onContinue.includes("setupDeathless.checked") && onContinue.includes("deathlessConfirm.classList.remove(\"hidden\")"));
    assert.ok(/btnDeathlessYes[\s\S]{0,300}command: "make_deathless"/.test(js));
  });

  it("both hosts mark the living pet on make_deathless and report the pet's own mark", () => {
    const ts = read("src/sidebarProvider.ts");
    assert.ok(/case "make_deathless":[\s\S]{0,200}markDeathless\(state\)/.test(ts));
    assert.ok(ts.includes("deathless: isDeathlessPet(state)"));
    const kt = read("../pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt");
    assert.ok(/"make_deathless" -> \{[\s\S]{0,200}markDeathless\(state\)/.test(kt));
    assert.ok(read("../pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt").includes("\"deathless\":${isDeathlessPet(state)}"));
  });
});
