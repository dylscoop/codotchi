/**
 * tickLease.ts
 *
 * In AI mode every window keeps its ticker running, even unfocused. Without a
 * lease, two windows (or VS Code and VSCodium) each tick their own copy of the
 * pet and overwrite each other's saves, so a call answered in one window comes
 * back from the other and its status bar ⚠ never clears.
 *
 * The state file records which window wrote it. A window skips its tick and
 * follows the file instead while another window has written it within the lease.
 * Acting on the pet saves it, so the window you use takes over the ticking.
 *
 * Pure (no vscode import) so it can be unit-tested.
 */

/** How long another window's save holds the tick: 2.5 ticks at 3 s. */
export const TICK_LEASE_MS = 7_500;

/**
 * The writer stamp on the state file. There is no writerId from older builds or
 * from the terminal plugins' write-backs (Claude Code, OpenCode, Claude Desktop).
 */
export interface StateFileStamp {
  writerId?: string;
  savedAt: number;
}

/**
 * True when a different window saved the state file within the lease, so this
 * window should follow the file instead of ticking. Writes with no writerId never
 * take the tick: the Claude Code statusline writes every few seconds, so
 * yielding to it would stop the IDE ticking.
 */
export function anotherWindowOwnsTick(
  stamp: StateFileStamp | null,
  myWriterId: string,
  nowMs: number,
  leaseMs: number = TICK_LEASE_MS,
): boolean {
  if (stamp === null || !stamp.writerId) { return false; }
  if (stamp.writerId === myWriterId) { return false; }
  return nowMs - stamp.savedAt < leaseMs;
}
