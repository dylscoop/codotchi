/**
 * emoji.test.mjs
 *
 * Unit tests for scripts/emoji.mjs — pickPetEmoji (spriteType/stage/mood/alive
 * -> emoji mapping) and renderMovingEmojiLine (bounce position over frameIndex).
 *
 * Run with:
 *   node --test tests/unit/emoji.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickPetEmoji, renderMovingEmojiLine, currentFrameIndex } from "../../scripts/emoji.mjs";

function petState(overrides = {}) {
  return { name: "Test", alive: true, stage: "adult", mood: "happy", spriteType: "cat", sleeping: false, ...overrides };
}

describe("pickPetEmoji", () => {
  it("returns the override verbatim when one is given, regardless of pet state", () => {
    assert.equal(pickPetEmoji(petState(), "🐸"), "🐸");
    assert.equal(pickPetEmoji(null, "🐸"), "🐸");
  });

  it("falls back to a default paw emoji when state is missing and no override", () => {
    assert.equal(pickPetEmoji(null, null), "🐾");
    assert.equal(pickPetEmoji(undefined, undefined), "🐾");
  });

  it("returns a skull for a dead pet, taking priority over stage/mood", () => {
    assert.equal(pickPetEmoji(petState({ alive: false, stage: "egg" })), "💀");
  });

  it("returns an egg for egg-stage pets regardless of spriteType", () => {
    assert.equal(pickPetEmoji(petState({ stage: "egg", spriteType: "dragon" })), "🥚");
  });

  it("returns a sleep emoji for a sleeping pet (via mood or the sleeping flag)", () => {
    assert.equal(pickPetEmoji(petState({ mood: "sleeping" })), "💤");
    assert.equal(pickPetEmoji(petState({ sleeping: true, mood: "happy" })), "💤");
  });

  it("maps each known spriteType to its own emoji", () => {
    const cases = {
      classic: "🐣", cat: "🐱", rat: "🐀", ox: "🐂", tiger: "🐯", rabbit: "🐰",
      dragon: "🐉", snake: "🐍", horse: "🐴", goat: "🐐", monkey: "🐵",
      rooster: "🐓", dog: "🐶", pig: "🐷",
    };
    for (const [spriteType, expected] of Object.entries(cases)) {
      assert.equal(pickPetEmoji(petState({ spriteType })), expected, `spriteType=${spriteType}`);
    }
  });

  it("falls back to a paw emoji for an unknown spriteType", () => {
    assert.equal(pickPetEmoji(petState({ spriteType: "totally-unknown" })), "🐾");
  });
});

describe("renderMovingEmojiLine", () => {
  it("places the emoji at column 0 when frameIndex is 0", () => {
    assert.equal(renderMovingEmojiLine("🐱", 0, 40), "🐱");
  });

  it("shifts the emoji right as frameIndex increases, before the bounce point", () => {
    assert.equal(renderMovingEmojiLine("🐱", 1, 40), " 🐱");
    assert.equal(renderMovingEmojiLine("🐱", 3, 40), "   🐱");
  });

  it("bounces back after reaching the track's far edge", () => {
    const cols = 20;
    const track = Math.max(4, cols - 4); // mirrors MIN_TRACK/RIGHT_MARGIN in emoji.mjs
    const atEdge = renderMovingEmojiLine("🐱", track, cols);
    const oneAfterEdge = renderMovingEmojiLine("🐱", track + 1, cols);
    assert.equal(atEdge, " ".repeat(track) + "🐱");
    assert.equal(oneAfterEdge, " ".repeat(track - 1) + "🐱", "should step back toward 0 after bouncing");
  });

  it("cycles back to position 0 after a full period", () => {
    const cols = 20;
    const track = Math.max(4, cols - 4);
    const period = track * 2;
    assert.equal(renderMovingEmojiLine("🐱", period, cols), renderMovingEmojiLine("🐱", 0, cols));
  });

  it("handles a negative frameIndex without throwing, wrapping into a valid position", () => {
    assert.doesNotThrow(() => renderMovingEmojiLine("🐱", -5, 40));
  });

  it("falls back to a default width when columns is missing/invalid", () => {
    assert.doesNotThrow(() => renderMovingEmojiLine("🐱", 0, undefined));
    assert.doesNotThrow(() => renderMovingEmojiLine("🐱", 0, NaN));
    assert.doesNotThrow(() => renderMovingEmojiLine("🐱", 0, -10));
  });

  it("prepends the prefix verbatim and accounts for its width in the track", () => {
    assert.equal(renderMovingEmojiLine("🐱", 0, 40, "[VS Code] "), "[VS Code] 🐱");
  });

  it("never lets the track collapse for very narrow columns", () => {
    assert.doesNotThrow(() => renderMovingEmojiLine("🐱", 5, 1));
  });
});

describe("currentFrameIndex", () => {
  it("derives whole seconds from a millisecond timestamp", () => {
    assert.equal(currentFrameIndex(2000), 2);
    assert.equal(currentFrameIndex(2999), 2);
    assert.equal(currentFrameIndex(3000), 3);
  });
});
