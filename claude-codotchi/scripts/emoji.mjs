/**
 * emoji.mjs — maps a PetState to a single emoji for the compact "moving
 * emoji" statusline mode, and renders that emoji bouncing back and forth
 * across a line of a given width.
 *
 * Kept separate from asciiArt.ts because it is Claude-Code-only: asciiArt.ts
 * is a literal copy shared with opencode-codotchi and claude-desktop-codotchi
 * (see .claude/skills/opencode-claude-parity/SKILL.md), and this feature does
 * not apply to either of those surfaces.
 */

/** spriteType -> emoji. Keys match SPRITE_HEAD in src/asciiArt.ts. */
const EMOJI_BY_SPRITE = {
  classic: "🐣",
  cat: "🐱",
  rat: "🐀",
  ox: "🐂",
  tiger: "🐯",
  rabbit: "🐰",
  dragon: "🐉",
  snake: "🐍",
  horse: "🐴",
  goat: "🐐",
  monkey: "🐵",
  rooster: "🐓",
  dog: "🐶",
  pig: "🐷",
};

const DEFAULT_EMOJI = "🐾";
const EGG_EMOJI = "🥚";
const DEAD_EMOJI = "💀";
const SLEEP_EMOJI = "💤";

/**
 * Pick the emoji to represent `state` in the statusline.
 * `override` (a user-chosen emoji from /codotchi emoji <emoji>) always wins.
 */
export function pickPetEmoji(state, override) {
  if (override) return override;
  if (!state) return DEFAULT_EMOJI;
  if (state.alive === false) return DEAD_EMOJI;
  if (state.stage === "egg") return EGG_EMOJI;
  if (state.sleeping || state.mood === "sleeping") return SLEEP_EMOJI;
  return EMOJI_BY_SPRITE[state.spriteType] ?? DEFAULT_EMOJI;
}

const DEFAULT_COLUMNS = 40;
const MIN_TRACK = 4;
// Reserve a small margin so the emoji (which renders ~2 columns wide) never
// touches the right edge of narrow terminals.
const RIGHT_MARGIN = 4;

/**
 * Render `emoji` at a horizontal position that bounces back and forth (a
 * ping-pong / bounce cycle) as `frameIndex` advances, within a line sized
 * from `columns`. `prefix` (e.g. an "[VS Code] " IDE label) is prepended
 * verbatim and its length is subtracted from the available track.
 *
 * Deterministic given (frameIndex, columns, prefix) — no persisted counter
 * is needed, since frameIndex is meant to be derived from the wall clock
 * (see currentFrameIndex), which is naturally continuous across the
 * statusline's one-shot process invocations.
 */
export function renderMovingEmojiLine(emoji, frameIndex, columns = DEFAULT_COLUMNS, prefix = "") {
  const cols = Number.isFinite(columns) && columns > 0 ? Math.floor(columns) : DEFAULT_COLUMNS;
  const track = Math.max(MIN_TRACK, cols - prefix.length - RIGHT_MARGIN);
  const period = track * 2;
  const idx = ((Math.floor(frameIndex) % period) + period) % period; // guard negative frameIndex
  const pos = idx <= track ? idx : period - idx; // ping-pong bounce
  return prefix + " ".repeat(pos) + emoji;
}

/** A frame index derived from the wall clock, advancing once per second. */
export function currentFrameIndex(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000);
}
