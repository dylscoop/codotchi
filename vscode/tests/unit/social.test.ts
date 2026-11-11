/**
 * Social features (v2.36.0): CPU friend visits, friendship, gifts, marriage,
 * the heir egg, the matchmaker and the generation counter.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createPet,
  tick,
  deserialiseState,
  serialiseState,
  friendshipLevel,
  playWithFriend,
  giveFriendGift,
  acceptProposal,
  declineProposal,
  hatchHeir,
  DEFAULT_GAME_CONFIG,
  SCHEMA_VERSION,
  VISIT_TICKS,
  VISIT_MIN_GAP_TICKS,
  PARTNER_FRIENDSHIP,
  MATCHMAKER_SENIOR_DAYS,
  PROPOSAL_DECLINE_COOLDOWN_TICKS,
  FRIENDSHIP_DECAY_PER_DAY,
  GameConfig,
  PetState,
  FriendPet,
} from "../../src/gameEngine";

const NO_CALLS: GameConfig = { ...DEFAULT_GAME_CONFIG, attentionCallsEnabled: false };

function makePet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Mittens", "codeling"), stage: "adult", dayTimer: 100.5, ageDays: 100, ...overrides };
}

function friend(friendship: number): FriendPet {
  return { name: "Pixel", spriteType: "dog", petType: "bytebug", friendship, visits: 3 };
}

function withRandom<T>(value: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = orig; }
}

function roundTrip(s: PetState): PetState {
  return deserialiseState(JSON.parse(JSON.stringify(serialiseState(s))));
}

describe("social: save format", () => {
  it("loads a schemaVersion 1 save with empty social fields", () => {
    const old = serialiseState(makePet()) as Record<string, unknown>;
    for (const k of ["generation", "friend", "visit", "ticksSinceLastVisit", "partner", "heirEgg",
                     "seniorSinceDay", "proposal", "proposalCooldownTicks"]) { delete old[k]; }
    old.schemaVersion = 1;
    const loaded = deserialiseState(old);
    assert.equal(loaded.schemaVersion, SCHEMA_VERSION);
    assert.equal(SCHEMA_VERSION, 2);
    assert.equal(loaded.generation, 1);
    assert.equal(loaded.friend, null);
    assert.equal(loaded.visit, null);
    assert.equal(loaded.partner, null);
    assert.equal(loaded.heirEgg, null);
    assert.equal(loaded.seniorSinceDay, null);
    assert.equal(loaded.proposal, null);
  });

  it("round-trips every social field", () => {
    const s = makePet({
      generation: 3,
      friend: friend(42),
      visit: { ticksLeft: 10, played: true, gifted: false },
      ticksSinceLastVisit: 7,
      partner: { name: "Byte", spriteType: "cat", petType: "pixelpup" },
      heirEgg: { spriteType: "cat", petType: "codeling" },
      seniorSinceDay: 290.25,
      proposal: { from: "matchmaker", name: "Waffle", spriteType: "dragon", petType: "shellscript" },
      proposalCooldownTicks: 12,
    });
    const r = roundTrip(s);
    for (const k of ["generation", "friend", "visit", "ticksSinceLastVisit", "partner", "heirEgg",
                     "seniorSinceDay", "proposal", "proposalCooldownTicks"] as const) {
      assert.deepEqual(r[k], s[k], k);
    }
  });

  it("drops malformed social data instead of crashing", () => {
    const raw = serialiseState(makePet()) as Record<string, unknown>;
    raw.friend = { name: 5 };
    raw.visit = { ticksLeft: 5 };
    raw.proposal = { from: "stranger", name: "X", spriteType: "cat", petType: "codeling" };
    raw.generation = -4;
    const r = deserialiseState(raw);
    assert.equal(r.friend, null);
    assert.equal(r.visit, null, "a visit without a friend is dropped");
    assert.equal(r.proposal, null);
    assert.equal(r.generation, 1);
  });
});

describe("social: friendship levels", () => {
  it("maps scores to the six levels", () => {
    assert.equal(friendshipLevel(0), "Acquaintance");
    assert.equal(friendshipLevel(15), "Buddy");
    assert.equal(friendshipLevel(54), "Friend");
    assert.equal(friendshipLevel(55), "Good Friend");
    assert.equal(friendshipLevel(75), "Best Friend");
    assert.equal(friendshipLevel(PARTNER_FRIENDSHIP), "Partner");
  });
});

describe("social: visits", () => {
  it("a first visit makes a friend and unlocks First Friend", () => {
    const s = makePet({ ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    const next = withRandom(0, () => tick(s, false, false, NO_CALLS));
    assert.ok(next.friend, "friend created");
    assert.notEqual(next.friend!.name, s.name);
    assert.ok(next.visit);
    assert.equal(next.visit!.ticksLeft, VISIT_TICKS);
    assert.ok(next.events.includes("friend_made"));
    assert.ok(next.events.includes("friend_visit_started"));
    assert.ok(next.trainer.achievements.includes("first_friend"));
    assert.equal(next.ticksSinceLastVisit, 0);
  });

  it("no visit before the gap, while idle, for babies, or with social off", () => {
    const ready = makePet({ ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    withRandom(0, () => {
      assert.equal(tick(makePet({ ticksSinceLastVisit: 10 }), false, false, NO_CALLS).visit, null);
      assert.equal(tick(ready, true, false, NO_CALLS).visit, null);
      assert.equal(tick({ ...ready, stage: "baby", dayTimer: 3.5, ageDays: 3 }, false, false, NO_CALLS).visit, null);
      assert.equal(tick(ready, false, false, { ...NO_CALLS, socialEnabled: false }).visit, null);
    });
  });

  it("a visit ends after VISIT_TICKS, or at once when the pet falls asleep", () => {
    let s = makePet({ friend: friend(10), visit: { ticksLeft: 2, played: false, gifted: false } });
    s = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.equal(s.visit!.ticksLeft, 1);
    s = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.equal(s.visit, null);
    assert.ok(s.events.includes("friend_visit_ended"));

    const asleep = makePet({ friend: friend(10), visit: { ticksLeft: 30, played: false, gifted: false }, sleeping: true, energy: 10 });
    assert.equal(withRandom(0.5, () => tick(asleep, false, false, NO_CALLS)).visit, null);
  });

  it("turning social off ends an ongoing visit", () => {
    const s = makePet({ friend: friend(10), visit: { ticksLeft: 30, played: false, gifted: false } });
    const next = tick(s, false, false, { ...NO_CALLS, socialEnabled: false });
    assert.equal(next.visit, null);
    assert.ok(next.events.includes("friend_visit_ended"));
  });

  it("friendship decays on a game-day boundary without a visit", () => {
    const s = makePet({ friend: friend(30), dayTimer: 100.99999, ageDays: 100, ticksAlive: 2 });
    const next = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.ok(Math.floor(next.dayTimer) > 100, "crossed a day");
    assert.equal(next.friend!.friendship, 30 - FRIENDSHIP_DECAY_PER_DAY);
  });
});

describe("social: playing and gifts", () => {
  const visiting = (friendship: number) =>
    makePet({ friend: friend(friendship), visit: { ticksLeft: 30, played: false, gifted: false } });

  it("play together raises friendship once per visit", () => {
    const s = playWithFriend(visiting(20));
    assert.ok(s.events.includes("friend_played"));
    assert.equal(s.friend!.friendship, 30);
    assert.equal(s.visit!.played, true);
    assert.equal(s.trainer.counters.friendPlays, 1);
    const again = playWithFriend(s);
    assert.deepEqual(again.events, ["friend_play_refused"]);
    assert.equal(again.friend!.friendship, 30);
  });

  it("gift and play are refused with no visit", () => {
    assert.deepEqual(playWithFriend(makePet()).events, ["friend_play_refused"]);
    assert.deepEqual(giveFriendGift(makePet({ friend: friend(5) })).events, ["friend_gift_refused"]);
  });

  it("a gift that reaches Best Friend unlocks Best Buds", () => {
    const s = giveFriendGift(visiting(70));
    assert.equal(s.friend!.friendship, 85);
    assert.ok(s.events.includes("best_friends"));
    assert.ok(s.trainer.achievements.includes("best_buds"));
    assert.equal(s.trainer.counters.giftsGiven, 1);
    assert.deepEqual(giveFriendGift(s).events, ["friend_gift_refused"]);
  });
});

describe("social: marriage, heir egg and generations", () => {
  it("the friend proposes at Partner level to an adult", () => {
    const s = makePet({ friend: friend(PARTNER_FRIENDSHIP), ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    const next = withRandom(0, () => tick(s, false, false, NO_CALLS));
    assert.ok(next.events.includes("proposal_received"));
    assert.equal(next.proposal!.from, "friend");
    assert.equal(next.proposal!.name, "Pixel");
  });

  it("no proposal for a teen, even at Partner level", () => {
    const s = makePet({ stage: "teen", dayTimer: 50.5, ageDays: 50, friend: friend(PARTNER_FRIENDSHIP), ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    assert.equal(withRandom(0, () => tick(s, false, false, NO_CALLS)).proposal, null);
  });

  it("accepting marries the pet and leaves an heir egg", () => {
    const s = makePet({ friend: friend(95), proposal: { from: "friend", name: "Pixel", spriteType: "dog", petType: "bytebug" } });
    const m = acceptProposal(s, () => 0.9);
    assert.ok(m.events.includes("married"));
    assert.deepEqual(m.partner, { name: "Pixel", spriteType: "dog", petType: "bytebug" });
    assert.deepEqual(m.heirEgg, { spriteType: "dog", petType: "bytebug" });
    assert.equal(m.proposal, null);
    assert.ok(m.trainer.achievements.includes("tied_the_knot"));
    assert.deepEqual(acceptProposal(m).events, ["proposal_refused"]);
  });

  it("a custom character's egg never inherits its one-off sprite", () => {
    const s = makePet({ spriteType: "tim", proposal: { from: "matchmaker", name: "Byte", spriteType: "cat", petType: "codeling" } });
    assert.equal(acceptProposal(s, () => 0).heirEgg!.spriteType, "cat");
  });

  it("declining sets a cooldown that blocks the next offer", () => {
    const s = declineProposal(makePet({ proposal: { from: "friend", name: "Pixel", spriteType: "dog", petType: "bytebug" } }));
    assert.equal(s.proposal, null);
    assert.equal(s.proposalCooldownTicks, PROPOSAL_DECLINE_COOLDOWN_TICKS);
    const t = withRandom(0, () => tick({ ...s, friend: friend(95), ticksSinceLastVisit: VISIT_MIN_GAP_TICKS }, false, false, NO_CALLS));
    assert.equal(t.proposal, null);
  });

  it("the matchmaker arrives after MATCHMAKER_SENIOR_DAYS single senior days", () => {
    const base = makePet({ stage: "senior", dayTimer: 300.5, ageDays: 300 });
    const early = withRandom(0.5, () => tick({ ...base, seniorSinceDay: 299 }, false, false, NO_CALLS));
    assert.equal(early.proposal, null);
    const due = withRandom(0.5, () => tick({ ...base, seniorSinceDay: 300.5 - MATCHMAKER_SENIOR_DAYS }, false, false, NO_CALLS));
    assert.ok(due.events.includes("matchmaker_arrived"));
    assert.equal(due.proposal!.from, "matchmaker");
    const married = withRandom(0.5, () => tick({ ...base, seniorSinceDay: 0, partner: { name: "B", spriteType: "cat", petType: "codeling" } }, false, false, NO_CALLS));
    assert.equal(married.proposal, null);
  });

  it("records when the pet became a senior", () => {
    const s = withRandom(0.5, () => tick(makePet({ stage: "senior", dayTimer: 300.5, ageDays: 300 }), false, false, NO_CALLS));
    assert.ok(s.seniorSinceDay !== null && s.seniorSinceDay >= 300.5);
  });

  it("hatching the heir starts the next generation", () => {
    const parent = { ...makePet({ generation: 2, heirEgg: { spriteType: "dragon", petType: "pixelpup" } }), alive: false };
    const heir = hatchHeir(parent, "Mittens II")!;
    assert.equal(heir.generation, 3);
    assert.equal(heir.stage, "egg");
    assert.equal(heir.spriteType, "dragon");
    assert.equal(heir.petType, "pixelpup");
    assert.equal(heir.name, "Mittens II");
    assert.equal(heir.heirEgg, null);
    assert.equal(heir.trainer.counters.heirs, 1);
    assert.equal(hatchHeir(makePet(), "X"), null, "no egg, no heir");
  });

  it("a fresh egg is generation 1", () => {
    assert.equal(createPet("A", "codeling").generation, 1);
  });
});

describe("social: afterlife memorial", () => {
  it("records the generation and partner of a cremated pet", async () => {
    const { afterlifeEntryFor } = await import("../../src/afterlife");
    const dead = { ...makePet({ generation: 2, partner: { name: "Byte", spriteType: "cat", petType: "codeling" } }), alive: false, diedAt: 5 };
    const e = afterlifeEntryFor(dead);
    assert.equal(e.generation, 2);
    assert.equal(e.partnerName, "Byte");
    assert.equal(afterlifeEntryFor({ ...dead, partner: null }).partnerName, undefined);
  });
});

describe("social: webview parity", () => {
  it("FRIENDSHIP_LEVEL_NAMES in sidebar.js matches FRIENDSHIP_LEVELS", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const { FRIENDSHIP_LEVELS } = await import("../../src/gameEngine");
    const js = fs.readFileSync(path.join(__dirname, "../../../media/sidebar.js"), "utf8");
    const line = js.split("\n").find((l) => l.includes("var FRIENDSHIP_LEVEL_NAMES ="))!;
    const parsed = JSON.parse(line.slice(line.indexOf("=") + 1).trim().replace(/;$/, "")) as [number, string][];
    const fromWebview = parsed.map(([min, name]) => ({ name, min })).reverse();
    assert.deepEqual(fromWebview, FRIENDSHIP_LEVELS.map((l) => ({ name: l.name, min: l.min })));
  });

  it("every social event the webview bubbles has text in humaniseEvent", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const js = fs.readFileSync(path.join(__dirname, "../../../media/sidebar.js"), "utf8");
    const line = js.slice(js.indexOf("var SOCIAL_BUBBLE_EVENTS = "), js.indexOf("];", js.indexOf("var SOCIAL_BUBBLE_EVENTS = ")) + 1);
    const events = JSON.parse(line.slice(line.indexOf("["))) as string[];
    for (const e of events) { assert.ok(js.includes(`"${e}":`), `missing label for ${e}`); }
  });
});
