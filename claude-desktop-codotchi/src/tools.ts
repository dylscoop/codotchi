/**
 * tools.ts — pure-ish handlers for each codotchi Desktop tool.
 *
 * Each handler loads the pet (with offline-decay catch-up), applies an action
 * from the shared game engine, persists, and returns a `ToolPayload`. server.ts
 * turns that into an MCP tool result rendered as ASCII art text.
 */

import {
  type PetState,
  CODE_ACTIVITY_THROTTLE_SECONDS,
  feedMeal,
  pat as enginePat,
  sleep as engineSleep,
  wake as engineWake,
  clean as engineClean,
  giveMedicine,
  applyCodeActivity,
} from "./gameEngine.js";
import { buildSpeechBubble, stripAnsi } from "./asciiArt.js";
import {
  type DesktopConfig,
  SOURCE,
  loadPet,
  savePet,
  loadSession,
  saveSession,
} from "./state.js";

/** When devMode is on, prevent the pet from dying: revive it and floor health at 1. */
function applyDevMode(state: PetState, cfg: DesktopConfig): PetState {
  if (!cfg.devMode) return state;
  if (state.alive && state.health >= 1) return state;
  return { ...state, alive: true, health: Math.max(1, state.health), sick: false } as PetState;
}

export interface ToolPayload {
  state: PetState;
  source: string;
  session: { interactionsToday: number; treatsToday: number };
  asciiArt: string;
}

const MOOD_MESSAGES: Record<string, string> = {
  happy:   "Feeling great! Keep it up!",
  neutral: "Ticking along nicely.",
  sad:     "Feeling a bit down...",
  sick:    "I don't feel so good...",
  sleeping:"Zzz...",
};

/** Build the plain-text pet display returned by every tool. */
function renderText(state: PetState, _session: { interactionsToday: number; treatsToday: number }): string {
  if (!state.alive) {
    return `${state.name} is no longer with us. Start a new chat to hatch a fresh pet.`;
  }
  const message = MOOD_MESSAGES[state.mood] ?? "Hello!";
  return stripAnsi(buildSpeechBubble(state.stage, state.mood, message, state.name, state.spriteType, "Claude Desktop"));
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
  const next = applyDevMode(state, cfg);
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
  const next = applyDevMode(feedMeal(state, mealsGivenThisCycle), cfg);
  const refused = next.events.includes("meal_refused");
  savePet(next, refused ? mealsGivenThisCycle : mealsGivenThisCycle + 1);
  return payload(next, loadSession());
}

export function petAction(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = applyDevMode(enginePat(state), cfg);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

/** Toggle sleep: wake a sleeping pet, otherwise put it to sleep. */
export function sleepToggle(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = applyDevMode(state.sleeping ? engineWake(state) : engineSleep(state), cfg);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

export function clean(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = applyDevMode(engineClean(state), cfg);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}

export function medicine(cfg: DesktopConfig): ToolPayload {
  const { state, mealsGivenThisCycle } = loadPet(cfg);
  const next = applyDevMode(giveMedicine(state), cfg);
  savePet(next, mealsGivenThisCycle);
  return payload(next, loadSession());
}
