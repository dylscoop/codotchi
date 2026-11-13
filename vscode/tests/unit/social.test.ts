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
  sayGoodbyeToFriend,
  socialActionMessage,
  socialSummaryLines,
  pickVisitor,
  startFriendGame,
  FRIENDSHIP_PER_PLAY_RESULT,
  FRIEND_GAME_PAUSE_TICKS,
  useItem,
  itemActionMessage,
  itemListLines,
  applyMinigameResult,
  ITEM_CATALOG,
  ITEM_FOOD_HUNGER,
  ITEM_TOY_HAPPINESS,
  MAX_ITEMS,
  MINIGAME_WINS_PER_ITEM,
  FRIENDSHIP_PER_GIFT_KIND,
  MAX_FRIENDS,
  NEW_FRIEND_CHANCE,
  FRIEND_DRIFT_DAYS,
  acceptProposal,
  declineProposal,
  hatchHeir,
  DEFAULT_GAME_CONFIG,
  SCHEMA_VERSION,
  VISIT_TICKS,
  VISIT_MIN_GAP_TICKS,
  visitPacing,
  PARTNER_FRIENDSHIP,
  MATCHMAKER_SENIOR_DAYS,
  PROPOSAL_DECLINE_COOLDOWN_TICKS,
  FRIENDSHIP_DECAY_PER_DAY,
  GameConfig,
  PetState,
  FriendPet,
} from "../../src/gameEngine";

const NO_CALLS: GameConfig = { ...DEFAULT_GAME_CONFIG, attentionCallsEnabled: false, socialEnabled: true };
/** Dev-mode pacing at x1000: once the gap is over, a visit starts on any random number below 1. */
const ALWAYS_VISIT: GameConfig = { ...NO_CALLS, devMode: true, devModeAgingMultiplier: 1000 };

function makePet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Mittens", "codeling"), stage: "adult", dayTimer: 100.5, ageDays: 100, ...overrides };
}

function friend(friendship: number, name: string = "Pixel"): FriendPet {
  return { name, spriteType: "dog", petType: "bytebug", friendship, visits: 3, lastVisitDay: 100 };
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
      otherFriends: [friend(10, "Mochi"), friend(0, "Byte")],
      visit: { ticksLeft: 10, played: true, gifted: false },
      ticksSinceLastVisit: 7,
      partner: { name: "Byte", spriteType: "cat", petType: "pixelpup" },
      heirEgg: { spriteType: "cat", petType: "codeling" },
      seniorSinceDay: 290.25,
      proposal: { from: "matchmaker", name: "Waffle", spriteType: "dragon", petType: "shellscript" },
      proposalCooldownTicks: 12,
    });
    const r = roundTrip(s);
    for (const k of ["generation", "friend", "otherFriends", "visit", "ticksSinceLastVisit", "partner", "heirEgg",
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

  it("loads a single-friend save: no other friends, lastVisitDay counts from today", () => {
    const raw = serialiseState(makePet({ friend: { name: "Pixel", spriteType: "dog", petType: "bytebug", friendship: 5, visits: 1 } })) as Record<string, unknown>;
    delete raw.otherFriends;
    const r = deserialiseState(raw);
    assert.deepEqual(r.otherFriends, []);
    assert.equal(r.friend!.lastVisitDay, r.dayTimer);
  });

  it("keeps at most MAX_FRIENDS - 1 other friends, with no duplicates", () => {
    const raw = serialiseState(makePet({ friend: friend(5) })) as Record<string, unknown>;
    raw.otherFriends = [friend(1, "Pixel"), friend(2, "Mochi"), friend(3, "Mochi"), friend(4, "Byte"), friend(5, "Waffle")];
    assert.deepEqual(deserialiseState(raw).otherFriends.map((f) => f.name), ["Mochi", "Byte"]);
  });
});

describe("social: several friends", () => {
  it("pickVisitor: a free slot leaves room for someone new; otherwise weighted by friendship", () => {
    assert.equal(pickVisitor([], 0), null);
    const two = [friend(0, "A"), friend(90, "B")];
    assert.equal(pickVisitor(two, 1 - NEW_FRIEND_CHANCE), null, "top of the range is someone new");
    assert.equal(pickVisitor(two, 0)!.name, "A");
    assert.equal(pickVisitor(two, 0.5)!.name, "B", "the closer friend has the bigger share");
    const full = [friend(0, "A"), friend(0, "B"), friend(0, "C")];
    assert.equal(full.length, MAX_FRIENDS);
    assert.equal(pickVisitor(full, 0.99)!.name, "C", "with every slot full, no one new comes");
  });

  it("a new friend visits: the old friend moves to otherFriends", () => {
    const s = makePet({ friend: friend(40), ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    const next = withRandom(0.99, () => tick(s, false, false, ALWAYS_VISIT));
    assert.ok(next.visit);
    assert.ok(next.events.includes("friend_made"));
    assert.notEqual(next.friend!.name, "Pixel");
    assert.equal(next.friend!.lastVisitDay, next.dayTimer);
    assert.deepEqual(next.otherFriends.map((f) => f.name), ["Pixel"]);
  });

  it("an old friend visits again and becomes the current friend", () => {
    const s = makePet({ friend: friend(10), otherFriends: [friend(60, "Mochi")], ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    // r = 0.5 of 0.75 → past Pixel's share (20 of 90), into Mochi's
    const next = withRandom(0.5, () => tick(s, false, false, ALWAYS_VISIT));
    assert.equal(next.friend!.name, "Mochi");
    assert.equal(next.friend!.visits, 4);
    assert.deepEqual(next.otherFriends.map((f) => f.name), ["Pixel"]);
    assert.ok(!next.events.includes("friend_made"));
  });

  it("other friends lose friendship each game day, and drift away at 0 after FRIEND_DRIFT_DAYS", () => {
    const keep = friend(5, "Mochi");
    const gone = { ...friend(1, "Byte"), lastVisitDay: 100.5 - FRIEND_DRIFT_DAYS };
    const s = makePet({ friend: friend(30), otherFriends: [keep, gone], dayTimer: 100.99999, ageDays: 100, ticksAlive: 2 });
    const next = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.ok(Math.floor(next.dayTimer) > Math.floor(s.dayTimer), "crossed a game day");
    assert.deepEqual(next.otherFriends.map((f) => [f.name, f.friendship]), [["Mochi", 4]]);
    assert.ok(next.events.includes("friend_drifted_away"));
  });

  it("the current friend drifts away too, and the next friend takes its place", () => {
    const s = makePet({
      friend: { ...friend(1), lastVisitDay: 90 }, otherFriends: [friend(20, "Mochi")], dayTimer: 100.99999, ageDays: 100, ticksAlive: 2,
    });
    const next = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.equal(next.friend!.name, "Mochi");
    assert.deepEqual(next.otherFriends, []);
  });

  it("a partner never drifts away", () => {
    const s = makePet({
      friend: friend(30), otherFriends: [{ ...friend(0, "Byte"), lastVisitDay: 0 }], dayTimer: 100.99999, ageDays: 100, ticksAlive: 2,
      partner: { name: "Byte", spriteType: "dog", petType: "bytebug" },
    });
    const next = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.deepEqual(next.otherFriends.map((f) => f.name), ["Byte"]);
  });

  it("the status lines list the other friends", () => {
    const lines = socialSummaryLines(makePet({ friend: friend(30), otherFriends: [friend(20, "Mochi")] }));
    assert.ok(lines.some((l) => l.includes("Other friends: Mochi — Buddy")), lines.join("\n"));
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

  it("dev mode brings the friend devModeAgingMultiplier times faster", () => {
    assert.deepEqual(visitPacing(NO_CALLS), { minGapTicks: 1200, chancePerTick: 0.001 });
    const dev = { ...NO_CALLS, devMode: true, devModeAgingMultiplier: 10 };
    assert.deepEqual(visitPacing(dev), { minGapTicks: 120, chancePerTick: 0.01 });
    assert.equal(visitPacing({ ...dev, devModeAgingMultiplier: 5000 }).chancePerTick, 1);
    const at = (gap: number) => makePet({ ticksSinceLastVisit: gap });
    withRandom(0.005, () => {
      assert.ok(tick(at(120), false, false, dev).visit, "visits after the shortened gap");
      assert.equal(tick(at(118), false, false, dev).visit, null);
      assert.equal(tick(at(VISIT_MIN_GAP_TICKS), false, false, NO_CALLS).visit, null, "0.005 misses the normal chance");
    });
  });

  it("social is a dev-mode preview: the default config starts no visits", () => {
    const ready = makePet({ ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    const { socialEnabled: _omit, ...withoutFlag } = NO_CALLS;
    withRandom(0, () => {
      assert.equal(tick(ready, false, false, { ...DEFAULT_GAME_CONFIG, attentionCallsEnabled: false }).visit, null);
      assert.equal(tick(ready, false, false, withoutFlag).visit, null);
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
    makePet({ friend: friend(friendship), visit: { ticksLeft: 30, played: false, gifted: false }, items: ["ball"] });

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

describe("items", () => {
  const visiting = (items: string[]) =>
    makePet({ friend: friend(20), visit: { ticksLeft: 30, played: false, gifted: false }, items });

  it("giving an item removes it, and friendship depends on its kind", () => {
    const food = giveFriendGift(visiting(["apple", "plant"]), "apple");
    assert.equal(food.friend!.friendship, 20 + FRIENDSHIP_PER_GIFT_KIND.food);
    assert.deepEqual(food.items, ["plant"]);
    assert.ok(food.events.includes("friend_gift_item_apple"));
    assert.match(socialActionMessage(food), /gave Pixel an apple 🍎/);
    const decor = giveFriendGift(visiting(["apple", "plant"]), "plant");
    assert.equal(decor.friend!.friendship, 20 + FRIENDSHIP_PER_GIFT_KIND.decor);
    assert.equal(decor.hunger, visiting([]).hunger, "giving no longer costs hunger");
  });

  it("with no item named, the oldest item is given", () => {
    assert.deepEqual(giveFriendGift(visiting(["kite", "cake"])).items, ["cake"]);
  });

  it("a gift is refused with no items, or an item the pet doesn't own", () => {
    const none = giveFriendGift(visiting([]));
    assert.deepEqual(none.events, ["friend_gift_refused"]);
    assert.match(socialActionMessage(none), /no items to give/);
    const notOwned = giveFriendGift(visiting(["apple"]), "kite");
    assert.deepEqual(notOwned.events, ["friend_gift_refused"]);
    assert.match(socialActionMessage(notOwned), /doesn't have that item/);
  });

  it("a visiting friend can bring an item, added to the bag", () => {
    const s = makePet({ friend: friend(20), ticksSinceLastVisit: VISIT_MIN_GAP_TICKS });
    const next = withRandom(0, () => tick(s, false, false, NO_CALLS));
    assert.ok(next.events.includes("friend_gift_received"));
    assert.deepEqual(next.items, [ITEM_CATALOG[0].id]);
    assert.equal(next.visit!.broughtItem, ITEM_CATALOG[0].id);
    assert.ok(next.events.includes(`friend_gift_item_${ITEM_CATALOG[0].id}`));
  });

  it("useItem: food feeds, a toy cheers up, decor goes on the floor", () => {
    const base = makePet({ hunger: 50, happiness: 50, items: ["fish", "yarn", "plant", "flower", "lantern", "star"] });
    const ate = useItem(base, "fish");
    assert.equal(ate.hunger, 50 + ITEM_FOOD_HUNGER);
    assert.ok(!ate.items.includes("fish"));
    assert.ok(ate.events.includes("item_used_fish"));
    assert.equal(useItem(base, "yarn").happiness, 50 + ITEM_TOY_HAPPINESS);
    let s = base;
    for (const d of ["plant", "flower", "lantern", "star"]) { s = useItem(s, d); }
    assert.deepEqual(s.decor, ["flower", "lantern", "star"], "only MAX_DECOR stay; the oldest goes");
    assert.deepEqual(useItem(base, "apple").events, ["item_refused"]);
    assert.deepEqual(useItem({ ...base, sleeping: true }, "fish").events, ["item_refused"]);
    assert.match(itemActionMessage(ate, "fish"), /ate the fish/);
  });

  it("every MINIGAME_WINS_PER_ITEM minigame wins finds an item", () => {
    let s = makePet();
    const found: string[] = [];
    for (let i = 0; i < MINIGAME_WINS_PER_ITEM * 2; i++) {
      s = applyMinigameResult(s, "left_right", "win");
      found.push(...s.events.filter((e) => e.startsWith("item_found_")));
    }
    assert.ok(found.length >= 2, found.join());
    assert.ok(s.items.length >= 2);
  });

  it("the bag holds MAX_ITEMS; extra finds are lost", () => {
    const full = Array.from({ length: MAX_ITEMS }, () => "apple");
    const s = makePet({ friend: friend(20), ticksSinceLastVisit: VISIT_MIN_GAP_TICKS, items: full });
    assert.equal(withRandom(0, () => tick(s, false, false, NO_CALLS)).items.length, MAX_ITEMS);
  });

  it("items and decor survive a save; unknown ids are dropped", () => {
    const s = makePet({ items: ["apple", "teddy"], decor: ["plant"] });
    const r = roundTrip(s);
    assert.deepEqual(r.items, ["apple", "teddy"]);
    assert.deepEqual(r.decor, ["plant"]);
    const raw = serialiseState(s) as Record<string, unknown>;
    raw.items = ["apple", "laser-sword", 7];
    raw.decor = ["apple", "plant"];
    const loaded = deserialiseState(raw);
    assert.deepEqual(loaded.items, ["apple"]);
    assert.deepEqual(loaded.decor, ["plant"], "only decorations go on the floor");
  });

  it("itemListLines lists the bag with counts and the floor", () => {
    const lines = itemListLines({ name: "Mittens", items: ["apple", "apple", "ball"], decor: ["plant"] });
    assert.ok(lines[0].includes("(3/12)"));
    assert.ok(lines.some((l) => l.includes("🍎 apple ×2") && l.includes("/codotchi use apple")));
    assert.ok(lines.some((l) => l.includes("On the floor: 🪴")));
    assert.match(itemListLines({ name: "Mittens", items: [], decor: [] })[0], /no items yet/);
  });
});

describe("social: play together is a minigame", () => {
  const visiting = () =>
    makePet({ friend: friend(20), visit: { ticksLeft: 30, played: false, gifted: false }, happiness: 50 });

  it("friendship follows the result; a loss gives half the happiness", () => {
    const win = playWithFriend(visiting(), "win");
    assert.equal(win.friend!.friendship, 20 + FRIENDSHIP_PER_PLAY_RESULT.win);
    assert.ok(win.events.includes("friend_game_win"));
    assert.match(socialActionMessage(win), /Mittens won the game/);
    const lose = playWithFriend(visiting(), "lose");
    assert.equal(lose.friend!.friendship, 20 + FRIENDSHIP_PER_PLAY_RESULT.lose);
    assert.equal(lose.happiness, 55);
    assert.match(socialActionMessage(lose), /Pixel won this time/);
    const push = playWithFriend(visiting(), "push");
    assert.equal(push.friend!.friendship, 20 + FRIENDSHIP_PER_PLAY_RESULT.draw);
    assert.ok(push.events.includes("friend_game_draw"));
    assert.equal(playWithFriend(visiting()).friend!.friendship, 20 + FRIENDSHIP_PER_PLAY_RESULT.draw, "no game = a draw");
  });

  it("a game pauses the visit timer for up to FRIEND_GAME_PAUSE_TICKS; playing clears it", () => {
    let s = startFriendGame(visiting());
    assert.equal(s.visit!.gameTicks, FRIEND_GAME_PAUSE_TICKS);
    s = withRandom(0.5, () => tick(s, false, false, NO_CALLS));
    assert.equal(s.visit!.ticksLeft, 30, "the timer is paused");
    assert.equal(s.visit!.gameTicks, FRIEND_GAME_PAUSE_TICKS - 1);
    const roundTripped = roundTrip(s);
    assert.equal(roundTripped.visit!.gameTicks, FRIEND_GAME_PAUSE_TICKS - 1);
    const played = playWithFriend(s, "win");
    assert.equal(played.visit!.gameTicks, undefined);
    const after = withRandom(0.5, () => tick(played, false, false, NO_CALLS));
    assert.equal(after.visit!.ticksLeft, 29, "the timer runs again");
  });

  it("an abandoned game stops pausing after FRIEND_GAME_PAUSE_TICKS", () => {
    let s = startFriendGame(visiting());
    for (let i = 0; i < FRIEND_GAME_PAUSE_TICKS + 1; i++) { s = withRandom(0.5, () => tick(s, false, false, NO_CALLS)); }
    assert.equal(s.visit!.ticksLeft, 29);
  });

  it("startFriendGame does nothing without a visit or after playing", () => {
    const none = makePet();
    assert.equal(startFriendGame(none), none);
    const played = { ...visiting(), visit: { ticksLeft: 30, played: true, gifted: false } };
    assert.equal(startFriendGame(played), played);
  });
});

describe("social: goodbye", () => {
  const visiting = (friendship: number) =>
    makePet({ friend: friend(friendship), visit: { ticksLeft: 30, played: false, gifted: false } });

  it("goodbye ends the visit early, and is refused with no visit", () => {
    const s = sayGoodbyeToFriend(visiting(20));
    assert.equal(s.visit, null);
    assert.deepEqual(s.events, ["friend_waved_goodbye", "friend_visit_ended"]);
    assert.equal(s.friend!.friendship, 20);
    assert.match(socialActionMessage(s), /waved goodbye/);
    const refused = sayGoodbyeToFriend(makePet());
    assert.deepEqual(refused.events, ["friend_goodbye_refused"]);
    assert.equal(socialActionMessage(refused), "No friend is visiting right now.");
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

  it("accepting marries the pet without an heir egg (offspring on the backlog)", () => {
    const s = makePet({ friend: friend(95), proposal: { from: "friend", name: "Pixel", spriteType: "dog", petType: "bytebug" } });
    const m = acceptProposal(s, () => 0.9);
    assert.ok(m.events.includes("married"));
    assert.deepEqual(m.partner, { name: "Pixel", spriteType: "dog", petType: "bytebug" });
    assert.equal(m.heirEgg, null);
    assert.equal(m.proposal, null);
    assert.ok(m.trainer.achievements.includes("tied_the_knot"));
    assert.deepEqual(acceptProposal(m).events, ["proposal_refused"]);
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

  it("offspring is off in the webview: no heir option, no egg, no Dynasty row", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const js = fs.readFileSync(path.join(__dirname, "../../../media/sidebar.js"), "utf8");
    assert.ok(js.includes("var HEIRS_ENABLED = false;"));
    assert.ok(js.includes("return !!(HEIRS_ENABLED && socialEnabled"), "heirAvailable is gated");
    assert.ok(js.includes("if (!HEIRS_ENABLED || !socialEnabled"), "drawHeirEgg is gated");
    assert.ok(js.includes("if (id === \"dynasty\" && !HEIRS_ENABLED) { return false; }"), "Dynasty is hidden");
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
