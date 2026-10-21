/**
 * ioThrottle.ts
 *
 * Keeps idle OpenCode windows cheap. Every OpenCode process loads the plugin,
 * so per-tick disk writes and sidebar refreshes multiply by the number of
 * open windows.
 */

/** Tick-driven saves of the OpenCode-local pet happen at most this often. */
export const LOCAL_TICK_SAVE_INTERVAL_MS = 30_000;

/**
 * Whether a tick should write the local pet file. Explicit actions still save
 * immediately; a crash loses at most one interval of companion-pet ageing,
 * which offline decay recovers from savedAt on the next load.
 */
export function shouldPersistTick(lastSavedAtMs: number, nowMs: number, intervalMs: number = LOCAL_TICK_SAVE_INTERVAL_MS): boolean {
  return nowMs - lastSavedAtMs >= intervalMs;
}

/**
 * Tracks the visible sidebar values so the 3 s pulse only asks the TUI to
 * re-render when something it shows has changed.
 */
export class PulseGate {
  private last: string | null = null;

  /** True when `parts` differs from the previous call (always true the first time). */
  changed(parts: unknown): boolean {
    const key = JSON.stringify(parts);
    if (key === this.last) { return false; }
    this.last = key;
    return true;
  }

  /** Forget the last value so the next pulse always emits. */
  reset(): void { this.last = null; }
}
