/**
 * afterlife.ts — the user's local Afterlife: pets they chose to bury, plus a
 * count of cremated pets (an urn count). Stored in globalState, so it is local
 * to this IDE. Every pet that dies gets a Bury / Cremate choice on the death
 * screen; a pet left undecided when a new one hatches is cremated.
 *
 * The pure functions here are mirrored in pycharm's Afterlife.kt.
 */

import { isDeathlessPet, type PetState } from "./gameEngine";

/** One buried pet. */
export interface AfterlifeEntry {
  readonly name: string;
  readonly petType: string;
  readonly spriteType: string;
  readonly stage: string;
  readonly ageDays: number;
  /** "old_age" or "neglect". */
  readonly cause: "old_age" | "neglect";
  readonly deathless: boolean;
  readonly spawnedAt: number;
  readonly diedAt: number;
}

export interface Afterlife {
  /** Buried pets, newest first. */
  readonly buried: readonly AfterlifeEntry[];
  /** Number of cremated pets. */
  readonly cremated: number;
  /** spawnedAt of the last pet whose fate was decided (0 = none). */
  readonly lastDecidedSpawnedAt: number;
}

export type AfterlifeChoice = "bury" | "cremate";

export const EMPTY_AFTERLIFE: Afterlife = { buried: [], cremated: 0, lastDecidedSpawnedAt: 0 };

/** Oldest buried pets are dropped past this many. */
export const AFTERLIFE_MAX_ENTRIES = 100;

/** Normalise a stored value (missing / partial / corrupt) into an Afterlife. */
export function parseAfterlife(raw: unknown): Afterlife {
  if (raw === null || typeof raw !== "object") { return EMPTY_AFTERLIFE; }
  const r = raw as Record<string, unknown>;
  const buried = Array.isArray(r["buried"])
    ? (r["buried"] as unknown[]).filter((e): e is AfterlifeEntry =>
        e !== null && typeof e === "object" && typeof (e as AfterlifeEntry).name === "string")
    : [];
  const cremated = typeof r["cremated"] === "number" && r["cremated"] >= 0 ? Math.floor(r["cremated"]) : 0;
  const last = typeof r["lastDecidedSpawnedAt"] === "number" ? r["lastDecidedSpawnedAt"] : 0;
  return { buried, cremated, lastDecidedSpawnedAt: last };
}

/** True when this dead pet still needs a Bury / Cremate choice. */
export function afterlifePending(afterlife: Afterlife, state: PetState | null): boolean {
  return state !== null && !state.alive && state.spawnedAt > 0
    && state.spawnedAt !== afterlife.lastDecidedSpawnedAt;
}

/** Build the record for a dead pet. */
export function afterlifeEntryFor(state: PetState): AfterlifeEntry {
  return {
    name:       state.name,
    petType:    state.petType,
    spriteType: state.spriteType,
    stage:      state.stage,
    ageDays:    state.ageDays,
    cause:      state.recentEventLog.includes("died_of_old_age") ? "old_age" : "neglect",
    deathless:  isDeathlessPet(state),
    spawnedAt:  state.spawnedAt,
    diedAt:     state.diedAt || Date.now(),
  };
}

/**
 * Apply the user's choice for a dead pet. No-op (same object) when the pet
 * isn't awaiting a choice, so a double click can't bury it twice.
 */
export function decideAfterlife(afterlife: Afterlife, state: PetState, choice: AfterlifeChoice): Afterlife {
  if (!afterlifePending(afterlife, state)) { return afterlife; }
  if (choice === "bury") {
    return {
      buried: [afterlifeEntryFor(state), ...afterlife.buried].slice(0, AFTERLIFE_MAX_ENTRIES),
      cremated: afterlife.cremated,
      lastDecidedSpawnedAt: state.spawnedAt,
    };
  }
  return { buried: afterlife.buried, cremated: afterlife.cremated + 1, lastDecidedSpawnedAt: state.spawnedAt };
}

/** A new pet is hatching: an undecided dead pet is cremated. */
export function settleBeforeNewPet(afterlife: Afterlife, previous: PetState | null): Afterlife {
  return previous === null ? afterlife : decideAfterlife(afterlife, previous, "cremate");
}

/** The user's name for their Afterlife (setting), trimmed; blank falls back to "Afterlife". */
export function afterlifeDisplayName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, 32) : "";
  return name.length > 0 ? name : "Afterlife";
}

/** The slice sent to the webview with every stateUpdate. */
export function afterlifeView(afterlife: Afterlife, state: PetState | null, name: unknown = "Afterlife"): {
  name: string; buried: readonly AfterlifeEntry[]; cremated: number; pending: boolean;
} {
  return {
    name: afterlifeDisplayName(name),
    buried: afterlife.buried,
    cremated: afterlife.cremated,
    pending: afterlifePending(afterlife, state),
  };
}
