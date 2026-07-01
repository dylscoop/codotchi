/**
 * tools.ts — pure-ish handlers for each codotchi Desktop tool.
 *
 * Each handler loads the pet (with offline-decay catch-up), applies an action
 * from the shared game engine, persists, and returns a `ToolPayload`. server.ts
 * turns that into an MCP tool result (ASCII text fallback + structuredContent
 * for the MCP App widget).
 */

import {
  type PetState,
  type GameConfig,
  DEFAULT_GAME_CONFIG,
  CODE_ACTIVITY_THROTTLE_SECONDS,
  tick as engineTick,
  feedMeal,
  pat as enginePat,
  sleep as engineSleep,
  wake as engineWake,
  clean as engineClean,
  giveMedicine,
  applyCodeActivity,
} from "./gameEngine.js";
import { buildStatusBlock, stripAnsi } from "./asciiArt.js";
import {
  type DesktopConfig,
  SOURCE,
  loadPet,
  savePet,
  loadSession,
  saveSession,
} from "./state.js";

export interface ToolPayload {
  state: PetState;
  source: string;
  session: { interactionsToday: number; treatsToday: number };
  asciiArt: string;
}

function gameConfig(): GameConfig {
  return { ...DEFAULT_GAME_CONFIG };
}

/** Build the plain-text fallback shown in clients without MCP App support. */
function renderText(state: PetState, session: { interactionsToday: number; treatsToday: number }): string {
  if (!state.alive) {
    return `${state.name} is no longer with us. Start a new chat to hatch a fresh pet.`;
  }
  const block = stripAnsi(buildStatusBlock(state));
  const stats = `${session.interactionsToday} message${session.interactionsToday === 1 ? "" : "s"} today — ${session.treatsToday} treat${session.treatsToday === 1 ? "" : "s"} earned!`;
  return `${block}\n  ${stats}\n`;
}

function payload(state: PetState, session: { interactionsToday: number; treatsToday: number }): ToolPayload {
  return {
    state,
    source: SOURCE,
    session: { interactionsToday: session.interactionsToday, treatsToday: session.treatsToday },
    asciiArt: renderText(state, session),
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** Show the pet (also persists the offline-decay catch-up applied on load). */
export function show(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  savePet(state, mealsGivenThisCycle);
  return payload(state, loadSession());
}

/** Advance the simulation by one live tick — used by the widget's self-poll. */
export function tick(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = engineTick(state, false, false, gameConfig());
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

/**
 * Register chat/coding activity: bump the daily interaction counter and, when
 * off cooldown, grant the small code-activity reward (a "treat").
 */
export function activity(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const session = loadSession();
  session.interactionsToday += 1;

  const now = Date.now();
  let next = state;
  if (now - session.lastActivityRewardMs >= CODE_ACTIVITY_THROTTLE_SECONDS * 1000) {
    next = applyCodeActivity(state);
    session.lastActivityRewardMs = now;
    session.treatsToday += 1;
  }

  savePet(next, mealsGivenThisCycle);
  saveSession(session);
  return payload(next, session);
}

export function feed(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = feedMeal(state, mealsGivenThisCycle);
  const refused = next.events.includes("meal_refused");
  savePet(next, refused ? mealsGivenThisCycle : mealsGivenThisCycle + 1);
  return payload(next, loadSession());
}

export function petAction(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = enginePat(state);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

/** Toggle sleep: wake a sleeping pet, otherwise put it to sleep. */
export function sleepToggle(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = state.sleeping ? engineWake(state) : engineSleep(state);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

export function clean(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = engineClean(state);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

export function medicine(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = giveMedicine(state);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}
