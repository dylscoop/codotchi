// GENERATED from packages/core/src/safeStateFile.ts by scripts/sync-core.mjs — do not edit here.
// Edit packages/core/src/safeStateFile.ts, then run: node scripts/sync-core.mjs
/**
 * safeStateFile.ts
 *
 * Crash- and race-safe helpers for the on-disk state.json:
 *  - writeAtomically: write to a temp file, then rename over the target, so a
 *    crash mid-write never leaves a truncated file.
 *  - rotateBackups: keep the last BACKUP_COUNT good saves as state.json.bak1..N.
 *  - readWithBackups: fall back to the newest readable backup when the main
 *    file is missing or corrupt.
 *  - isStaleAgainst: true when writing would roll the same pet back in age
 *    (e.g. two IDE instances, one holding an older copy).
 *
 * Mirrors CodotchiPersistence.kt (PyCharm).
 */

import * as fs from "fs";
import * as path from "path";

export const STALE_AGE_MARGIN_DAYS = 1;
export const BACKUP_COUNT = 3;
export const BACKUP_INTERVAL_MS = 10 * 60 * 1000;

interface PetIdentity {
  alive?: unknown;
  spawnedAt?: unknown;
  dayTimer?: unknown;
}

export function writeAtomically(filePath: string, text: string): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, filePath);
}

export function backupPath(filePath: string, n: number): string {
  return `${filePath}.bak${n}`;
}

/** Parse a state file, returning null when missing or not valid JSON with a state object. */
export function readStateJson(filePath: string): Record<string, unknown> | null {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    if (!raw || typeof raw.state !== "object" || raw.state === null || typeof raw.savedAt !== "number") {
      return null;
    }
    return raw;
  } catch {
    return null;
  }
}

/** Main file if readable, otherwise the newest readable backup. */
export function readWithBackups(filePath: string): Record<string, unknown> | null {
  const main = readStateJson(filePath);
  if (main !== null) { return main; }
  for (let n = 1; n <= BACKUP_COUNT; n++) {
    const b = readStateJson(backupPath(filePath, n));
    if (b !== null) { return b; }
  }
  return null;
}

export function rotateBackups(filePath: string, nowMs: number = Date.now()): void {
  try {
    if (readStateJson(filePath) === null) { return; }
    const newest = backupPath(filePath, 1);
    if (fs.existsSync(newest) && nowMs - fs.statSync(newest).mtimeMs < BACKUP_INTERVAL_MS) { return; }
    for (let n = BACKUP_COUNT; n >= 2; n--) {
      const prev = backupPath(filePath, n - 1);
      if (fs.existsSync(prev)) { fs.copyFileSync(prev, backupPath(filePath, n)); }
    }
    fs.copyFileSync(filePath, newest);
    const now = new Date(nowMs);
    fs.utimesSync(newest, now, now);
  } catch {
    // Best-effort.
  }
}

/** True when `disk` is the same living pet at least STALE_AGE_MARGIN_DAYS further along than `next`. */
export function isStaleAgainst(next: PetIdentity, disk: PetIdentity | null | undefined): boolean {
  if (!disk || next.alive === false || disk.alive === false) { return false; }
  if (typeof disk.spawnedAt !== "number" || disk.spawnedAt !== next.spawnedAt) { return false; }
  return typeof disk.dayTimer === "number" && typeof next.dayTimer === "number" &&
    disk.dayTimer > next.dayTimer + STALE_AGE_MARGIN_DAYS;
}

/**
 * Safely write `payload` (an object with a `state` field) to `filePath`:
 * refuses (returns false) if the file on disk is a newer copy of the same pet,
 * otherwise rotates backups and writes atomically.
 */
export function safeWriteStateFile(filePath: string, payload: { state: PetIdentity } & Record<string, unknown>): boolean {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  const disk = readStateJson(filePath);
  if (isStaleAgainst(payload.state, disk?.state as PetIdentity | undefined)) { return false; }
  rotateBackups(filePath);
  writeAtomically(filePath, JSON.stringify(payload));
  return true;
}
