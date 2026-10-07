/**
 * integrity.ts — leaderboard integrity: the state-file seal and signed submissions.
 *
 * Every writer of the shared pet state file seals the fields that decide a
 * leaderboard score (age, identity, life-critical stats). A file whose seal
 * doesn't match was edited by hand, so the pet is marked "tampered" and can no
 * longer be submitted. Leaderboard issues carry an HMAC signature the GitHub
 * workflow checks, so hand-written issues are rejected.
 *
 * The key is injected at build time into leaderboardKey.ts (gitignored) by
 * scripts/sync-core.mjs from CODOTCHI_LEADERBOARD_KEY or the repo-root
 * .leaderboard-key file. With no key, sealing still works (so play is
 * unaffected) but the build can't submit to the leaderboard.
 *
 * The canonical strings must stay byte-identical to pycharm's Integrity.kt and
 * the workflows in .github/workflows — tests/fixtures/integrity-vector.json
 * pins all of them.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { deserialiseState, type PetState } from "./gameEngine.js";
import { LEADERBOARD_KEY } from "./leaderboardKey.js";

/** Bumped whenever the sealed field list changes. */
export const SEAL_VERSION = "codotchi-seal-v1";
/** Bumped whenever the signed submission fields change (matches schemaVersion 2). */
export const SIGNATURE_VERSION = "codotchi-lb-v2";

/** True when this build has a leaderboard key and so can submit. */
export function leaderboardKeyAvailable(key: string = LEADERBOARD_KEY): boolean {
  return key.length > 0;
}

function hmacHex(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

/** Integer form of a stat, so JS and Kotlin print identical strings. */
function fixed(value: number, scale: number): string {
  return String(Math.round((Number.isFinite(value) ? value : 0) * scale));
}

/**
 * The canonical text covered by the state seal: identity, age and the stats
 * that keep a pet alive. One field per line, integers only.
 */
export function sealPayload(state: PetState): string {
  return [
    SEAL_VERSION,
    fixed(state.spawnedAt, 1),
    state.name,
    state.petType,
    state.stage,
    state.alive ? "1" : "0",
    fixed(state.ticksAlive, 1),
    fixed(state.dayTimer, 1_000_000),
    fixed(state.hunger, 1000),
    fixed(state.happiness, 1000),
    fixed(state.energy, 1000),
    fixed(state.health, 1000),
    fixed(state.weight, 1000),
    state.sick ? "1" : "0",
    fixed(state.careMistakes, 1),
    fixed(state.lifetimeCareMistakes, 1),
    state.devModeEverUsed ? "1" : "0",
    state.leaderboardIneligible,
  ].join("\n");
}

/** Seal for a pet state (hex HMAC-SHA256). */
export function sealState(state: PetState, key: string = LEADERBOARD_KEY): string {
  return hmacHex(key, sealPayload(state));
}

/** Constant-time compare of two hex strings. */
function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length) { return false; }
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * Seal a serialised state exactly as a reader will see it after
 * deserialising, so load-time defaults and migrations never break the seal.
 * Every writer of the shared state file stores this as the top-level `seal`.
 */
export function sealSerialisedState(serialised: Record<string, unknown>, key: string = LEADERBOARD_KEY): string {
  return sealState(deserialiseState(serialised), key);
}

/**
 * Check a loaded state against its stored seal and return the state to use.
 * A missing seal (save from before seals existed) marks the pet "unverified";
 * a wrong seal marks it "tampered". Either mark is permanent. The pet keeps
 * playing — it just can't be submitted.
 *
 * @param state - The deserialised state.
 * @param seal  - The `seal` field read from the file, if any.
 */
export function verifySeal(state: PetState, seal: unknown, key: string = LEADERBOARD_KEY): PetState {
  if (state.leaderboardIneligible === "tampered") { return state; }
  if (typeof seal !== "string" || seal.length === 0) {
    return state.leaderboardIneligible === "" ? { ...state, leaderboardIneligible: "unverified" } : state;
  }
  if (hexEquals(seal, sealState(state, key))) { return state; }
  return { ...state, leaderboardIneligible: "tampered" };
}

/** Why this pet can't be submitted right now, or null when it can. */
export function leaderboardBlockedReason(state: PetState, devModeActive: boolean,
                                         key: string = LEADERBOARD_KEY): string | null {
  if (!leaderboardKeyAvailable(key)) {
    return "This build of Codotchi can't submit to the leaderboard.";
  }
  if (devModeActive || state.devModeEverUsed) {
    return "This pet has lived in dev mode, so it can't go on the leaderboard.";
  }
  if (state.leaderboardIneligible === "tampered") {
    return "This pet's save file was edited outside Codotchi, so it can't go on the leaderboard.";
  }
  if (state.leaderboardIneligible === "unverified") {
    return "This pet was hatched before leaderboard verification, so it can't go on the leaderboard. Your next pet can.";
  }
  return null;
}

/** Fields covered by a leaderboard submission signature. */
export interface SignedSubmission {
  /** "score" for a death submission, "live" for a live update. */
  readonly kind: "score" | "live";
  readonly githubUsername: string;
  readonly petName: string;
  readonly ageDays: number;
  readonly stage: string;
  readonly petType: string;
  readonly spawnedAt: number;
  /** diedAt for "score", updatedAt for "live". */
  readonly at: number;
  readonly petRunId: string;
  readonly clientVersion: string;
}

/** Canonical text covered by a submission signature. The username is lower-cased. */
export function submissionPayload(s: SignedSubmission): string {
  return [
    SIGNATURE_VERSION,
    s.kind,
    s.githubUsername.toLowerCase(),
    s.petName,
    fixed(s.ageDays, 1),
    s.stage,
    s.petType,
    fixed(s.spawnedAt, 1),
    fixed(s.at, 1),
    s.petRunId,
    s.clientVersion,
  ].join("\n");
}

/** Signature (hex HMAC-SHA256) for a leaderboard submission. */
export function signSubmission(s: SignedSubmission, key: string = LEADERBOARD_KEY): string {
  return hmacHex(key, submissionPayload(s));
}
