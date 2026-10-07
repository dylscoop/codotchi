import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "url";
import {
  createPet, tick, serialiseState, deserialiseState, DEFAULT_GAME_CONFIG, PetState,
} from "../../src/gameEngine";
import {
  sealPayload, sealState, verifySeal, leaderboardBlockedReason, submissionPayload, signSubmission,
  SignedSubmission,
} from "../../src/integrity";

// Leaderboard integrity: the state seal catches hand-edited saves, the
// signature stops hand-written GitHub issues, and dev mode is sticky.
const root = path.join(__dirname, "../../../..");
const vector = JSON.parse(fs.readFileSync(path.join(root, "packages/core/fixtures/integrity-vector.json"), "utf8"));
const KEY = vector.key as string;

function vectorState(): PetState {
  return { ...createPet("x", "codeling"), ...vector.state } as PetState;
}

describe("integrity test vector (shared with Kotlin and the workflow)", () => {
  it("builds the same seal payload and seal", () => {
    assert.equal(sealPayload(vectorState()), vector.sealPayload);
    assert.equal(sealState(vectorState(), KEY), vector.seal);
  });

  it("builds the same submission payload and signature", () => {
    const sub = vector.submission as SignedSubmission;
    assert.equal(submissionPayload(sub), vector.submissionPayload);
    assert.equal(signSubmission(sub, KEY), vector.signature);
  });
});

describe("verifySeal", () => {
  const pet = createPet("Rex", "codeling");
  const roundTrip = (s: PetState): PetState => deserialiseState(serialiseState(s) as Record<string, unknown>);

  it("accepts an untouched save", () => {
    const loaded = verifySeal(roundTrip(pet), sealState(pet, KEY), KEY);
    assert.equal(loaded.leaderboardIneligible, "");
  });

  for (const [field, value] of [["ageDays", 300], ["spawnedAt", 1], ["health", 50], ["devModeEverUsed", false]] as const) {
    it(`marks a save with an edited ${field} as tampered`, () => {
      const base = { ...pet, devModeEverUsed: true };
      const seal = sealState(base, KEY);
      const edited = { ...base, [field]: value } as PetState;
      assert.equal(verifySeal(roundTrip(edited), seal, KEY).leaderboardIneligible, "tampered");
    });
  }

  it("marks a save from before seals existed as unverified", () => {
    assert.equal(verifySeal(pet, undefined, KEY).leaderboardIneligible, "unverified");
  });

  it("keeps tampered sticky even after re-sealing", () => {
    const tampered = { ...pet, leaderboardIneligible: "tampered" as const };
    assert.equal(verifySeal(tampered, sealState(tampered, KEY), KEY).leaderboardIneligible, "tampered");
  });

  it("survives a serialise / deserialise round trip of an evolved pet", () => {
    let s = pet;
    for (let i = 0; i < 500; i++) { s = tick(s); }
    assert.equal(verifySeal(roundTrip(s), sealState(roundTrip(s), KEY), KEY).leaderboardIneligible, "");
  });
});

describe("devModeEverUsed", () => {
  it("is set by a single dev-mode tick and stays set after dev mode is turned off", () => {
    let s = tick(createPet("Rex", "codeling"), false, false, { ...DEFAULT_GAME_CONFIG, devMode: true });
    assert.equal(s.devModeEverUsed, true);
    for (let i = 0; i < 10; i++) { s = tick(s); }
    assert.equal(s.devModeEverUsed, true);
    assert.equal(deserialiseState(serialiseState(s) as Record<string, unknown>).devModeEverUsed, true);
  });

  it("is set during a break nap too", () => {
    const napping = { ...createPet("Rex", "codeling"), sleeping: true, breakNapTicksRemaining: 10 };
    assert.equal(tick(napping, false, false, { ...DEFAULT_GAME_CONFIG, devMode: true }).devModeEverUsed, true);
  });

  it("stays false without dev mode", () => {
    assert.equal(tick(createPet("Rex", "codeling")).devModeEverUsed, false);
  });
});

describe("leaderboardBlockedReason", () => {
  const pet = createPet("Rex", "codeling");
  it("allows an eligible pet", () => { assert.equal(leaderboardBlockedReason(pet, false, KEY), null); });
  it("blocks a build without a key", () => { assert.match(leaderboardBlockedReason(pet, false, "")!, /build/); });
  it("blocks while dev mode is on", () => { assert.match(leaderboardBlockedReason(pet, true, KEY)!, /dev mode/); });
  it("blocks a pet that ever used dev mode", () => {
    assert.match(leaderboardBlockedReason({ ...pet, devModeEverUsed: true }, false, KEY)!, /dev mode/);
  });
  it("blocks tampered and unverified pets", () => {
    assert.match(leaderboardBlockedReason({ ...pet, leaderboardIneligible: "tampered" }, false, KEY)!, /edited/);
    assert.equal(leaderboardBlockedReason({ ...pet, leaderboardIneligible: "unverified" }, false, KEY), null);
  });
});

describe("leaderboard-validate.mjs (GitHub workflow)", () => {
  type Validator = {
    runValidation: (kind: string, env: Record<string, string>, readScores: () => unknown[]) =>
      { valid: boolean; reason?: string; entry?: Record<string, unknown> };
  };
  // A real dynamic import: tsc's commonjs output would turn import() into require(), which can't load .mjs.
  const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<Validator>;
  const load = (): Promise<Validator> =>
    dynamicImport(pathToFileURL(path.join(root, ".github/scripts/leaderboard-validate.mjs")).href);

  const sub = vector.submission as SignedSubmission;
  const author = sub.githubUsername;
  const scoreBody = (data: Record<string, unknown>): string =>
    "Leaderboard submission.\n\n```json\n" + JSON.stringify(data, null, 2) + "\n```";
  const signedScore = (): Record<string, unknown> => ({
    schemaVersion: 2, githubUsername: author, petName: sub.petName, ageDays: sub.ageDays, stage: sub.stage,
    petType: sub.petType, spawnedAt: sub.spawnedAt, diedAt: sub.at, clientVersion: sub.clientVersion,
    sig: vector.signature,
  });
  const run = async (body: string, issueAuthor = author, key = KEY) =>
    (await load()).runValidation("score", { ISSUE_BODY: body, ISSUE_AUTHOR: issueAuthor, LEADERBOARD_HMAC_KEY: key }, () => []);

  it("accepts a plugin-signed score and records it as verified", async () => {
    const r = await run(scoreBody(signedScore()));
    assert.equal(r.valid, true, r.reason);
    assert.equal(r.entry!.verified, true);
    assert.equal(r.entry!.githubUsername, author);
  });

  it("rejects a hand-written issue with no signature", async () => {
    const { sig: _sig, ...unsigned } = signedScore();
    assert.match((await run(scoreBody(unsigned))).reason!, /Codotchi client/);
  });

  it("rejects a signed score with an edited age", async () => {
    assert.match((await run(scoreBody({ ...signedScore(), ageDays: 200 }))).reason!, /Codotchi client/);
  });

  it("rejects another user re-posting someone else's signed score", async () => {
    assert.match((await run(scoreBody(signedScore()), "someone-else")).reason!, /Codotchi client/);
  });

  // Unsigned body as sent by pre-2.27.2 clients.
  const legacyScore = (): Record<string, unknown> => {
    const { schemaVersion: _v, clientVersion: _c, sig: _s, ...rest } = signedScore();
    return rest;
  };
  const legacyLive = (): Record<string, unknown> => ({
    username: author, petName: sub.petName, petRunId: "run-1", spawnedAt: sub.spawnedAt, ageDays: sub.ageDays,
    stage: sub.stage, petType: sub.petType, updatedAt: sub.at,
  });
  const runLive = async (data: Record<string, unknown>, issueAuthor = author, key = KEY) =>
    (await load()).runValidation("live",
      { ISSUE_BODY: JSON.stringify(data), ISSUE_AUTHOR: issueAuthor, LEADERBOARD_HMAC_KEY: key }, () => []);

  it("accepts unsigned v1 scores from older clients as legacy", async () => {
    for (const data of [legacyScore(), { ...legacyScore(), schemaVersion: 1 }]) {
      const r = await run(scoreBody(data));
      assert.equal(r.valid, true, r.reason);
      assert.equal(r.entry!.verified, false);
      assert.equal(r.entry!.legacy, true);
      assert.equal(r.entry!.clientVersion, undefined);
    }
  });

  it("accepts unsigned v1 live updates as legacy, even without the server key", async () => {
    const r = await runLive(legacyLive(), author, "");
    assert.equal(r.valid, true, r.reason);
    assert.equal(r.entry!.verified, false);
    assert.equal(r.entry!.legacy, true);
  });

  it("rejects a legacy live update posted by someone else", async () => {
    assert.match((await runLive(legacyLive(), "someone-else")).reason!, /Username/);
  });

  it("still applies the age and timing checks to legacy submissions", async () => {
    const tooFast = { ...legacyScore(), ageDays: 157, stage: "adult", petType: "bytebug", diedAt: sub.spawnedAt + 157 * 200_000 };
    assert.match((await run(scoreBody(tooFast))).reason!, /real time/);
    assert.match((await run(scoreBody({ ...legacyScore(), ageDays: 2, stage: "adult" }))).reason!, /doesn't match stage/);
  });

  it("never treats a signed-format body with a bad sig as legacy", async () => {
    assert.match((await run(scoreBody({ ...legacyScore(), schemaVersion: 1, sig: "00" }))).reason!, /format/);
    assert.match((await run(scoreBody({ ...signedScore(), sig: "0".repeat(64) }))).reason!, /Codotchi client/);
  });

  it("fails closed for signed submissions when the server key isn't configured", async () => {
    assert.match((await run(scoreBody(signedScore()), author, "")).reason!, /server key/);
  });

  it("rejects an age faster than the pet type can physically live", async () => {
    const tooFast = {
      kind: "score" as const, githubUsername: author, petName: "Zoom", ageDays: 157, stage: "adult",
      petType: "bytebug", spawnedAt: sub.spawnedAt, at: sub.spawnedAt + 157 * 200_000, petRunId: "",
      clientVersion: "2.27.0",
    };
    const data = {
      schemaVersion: 2, githubUsername: author, petName: tooFast.petName, ageDays: tooFast.ageDays,
      stage: tooFast.stage, petType: tooFast.petType, spawnedAt: tooFast.spawnedAt, diedAt: tooFast.at,
      clientVersion: tooFast.clientVersion, sig: signSubmission(tooFast, KEY),
    };
    assert.match((await run(scoreBody(data))).reason!, /real time/);
  });

  it("never echoes raw issue text containing newlines into the reason", async () => {
    const r = await run(scoreBody({ ...signedScore(), stage: "adult\nvalid=true" }));
    assert.equal(r.valid, false);
    assert.ok(!r.reason!.includes("\n"));
  });
});
