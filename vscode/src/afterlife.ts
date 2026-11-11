/**
 * afterlife.ts — the user's local Afterlife: every pet they cremated, with its
 * name, age and real time alive. Stored in globalState, so it is local to this
 * IDE. The death screen offers a Cremate button; a pet left uncremated when a
 * new one hatches is cremated then. The user can remove entries or clear it.
 *
 * The pure functions here are mirrored in pycharm's Afterlife.kt.
 */

import { isDeathlessPet, type PetState } from "./gameEngine";

/** One cremated pet. */
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
  /** Family line (v2.36.0); absent on older entries, meaning 1. */
  readonly generation?: number;
  /** Who the pet married, if anyone (v2.36.0). */
  readonly partnerName?: string;
}

export interface Afterlife {
  /** Cremated pets, newest first. */
  readonly cremated: readonly AfterlifeEntry[];
  /** spawnedAt of the last pet cremated (0 = none); stops a pet being cremated twice. */
  readonly lastDecidedSpawnedAt: number;
}

export const EMPTY_AFTERLIFE: Afterlife = { cremated: [], lastDecidedSpawnedAt: 0 };

/** Oldest entries are dropped past this many. */
export const AFTERLIFE_MAX_ENTRIES = 100;

function isEntry(e: unknown): e is AfterlifeEntry {
  return e !== null && typeof e === "object" && typeof (e as AfterlifeEntry).name === "string";
}

/** Normalise a stored value (missing / partial / corrupt) into an Afterlife. */
export function parseAfterlife(raw: unknown): Afterlife {
  if (raw === null || typeof raw !== "object") { return EMPTY_AFTERLIFE; }
  const r = raw as Record<string, unknown>;
  const cremated = Array.isArray(r["cremated"]) ? (r["cremated"] as unknown[]).filter(isEntry) : [];
  const last = typeof r["lastDecidedSpawnedAt"] === "number" ? r["lastDecidedSpawnedAt"] : 0;
  return { cremated, lastDecidedSpawnedAt: last };
}

/** True when this dead pet is still waiting to be cremated. */
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
    generation: state.generation,
    ...(state.partner ? { partnerName: state.partner.name } : {}),
  };
}

/**
 * Cremate a dead pet into the Afterlife. No-op (same object) when the pet
 * isn't waiting, so a double click can't cremate it twice.
 */
export function cremate(afterlife: Afterlife, state: PetState): Afterlife {
  if (!afterlifePending(afterlife, state)) { return afterlife; }
  return {
    cremated: [afterlifeEntryFor(state), ...afterlife.cremated].slice(0, AFTERLIFE_MAX_ENTRIES),
    lastDecidedSpawnedAt: state.spawnedAt,
  };
}

/** A new pet is hatching: an uncremated dead pet is cremated now. */
export function settleBeforeNewPet(afterlife: Afterlife, previous: PetState | null): Afterlife {
  return previous === null ? afterlife : cremate(afterlife, previous);
}

/** Remove one entry (matched by spawnedAt). */
export function removeAfterlifeEntry(afterlife: Afterlife, spawnedAt: number): Afterlife {
  const cremated = afterlife.cremated.filter((e) => e.spawnedAt !== spawnedAt);
  return cremated.length === afterlife.cremated.length ? afterlife : { ...afterlife, cremated };
}

/** Empty the Afterlife. The cremated marker stays, so the current dead pet can't be cremated again. */
export function clearAfterlife(afterlife: Afterlife): Afterlife {
  return { cremated: [], lastDecidedSpawnedAt: afterlife.lastDecidedSpawnedAt };
}

/** The user's name for their Afterlife (setting), trimmed; blank falls back to "Afterlife". */
export function afterlifeDisplayName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim().slice(0, 32) : "";
  return name.length > 0 ? name : "Afterlife";
}

/** The slice sent to the webview with every stateUpdate. */
export function afterlifeView(afterlife: Afterlife, state: PetState | null, name: unknown = "Afterlife"): {
  name: string; cremated: readonly AfterlifeEntry[]; pending: boolean;
} {
  return {
    name: afterlifeDisplayName(name),
    cremated: afterlife.cremated,
    pending: afterlifePending(afterlife, state),
  };
}
