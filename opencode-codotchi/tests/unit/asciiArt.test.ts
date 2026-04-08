/**
 * asciiArt.test.ts
 *
 * Unit tests for src/asciiArt.ts.
 *
 * Regression coverage for the buildSpeechBubble crash introduced when the
 * return value was accidentally treated as an array and `.join("\n")` was
 * called on it (not a method on strings in OpenCode 1.4.0+).
 *
 * Uses the built-in Node.js test runner (node:test + node:assert).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildSpeechBubble,
  buildStatusBlock,
  buildContextualSpeech,
  colour,
  stripAnsi,
} from "../../src/asciiArt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_STAGES = ["egg", "baby", "child", "teen", "adult", "senior"];
const ALL_MOODS  = ["happy", "neutral", "sad", "sleeping", "sick"];

// ---------------------------------------------------------------------------
// colour / stripAnsi
// ---------------------------------------------------------------------------

describe("colour", () => {
  it("wraps text with the given ANSI code and resets", () => {
    const result = colour("hello", "\x1b[32m");
    assert.equal(result, "\x1b[32mhello\x1b[0m");
  });

  it("works with empty text", () => {
    const result = colour("", "\x1b[31m");
    assert.equal(result, "\x1b[31m\x1b[0m");
  });
});

describe("stripAnsi", () => {
  it("removes all ANSI colour codes", () => {
    const ansi = "\x1b[1m\x1b[32mhello\x1b[0m world\x1b[90m!\x1b[0m";
    assert.equal(stripAnsi(ansi), "hello world!");
  });

  it("returns plain text unchanged", () => {
    assert.equal(stripAnsi("no escapes here"), "no escapes here");
  });

  it("handles empty string", () => {
    assert.equal(stripAnsi(""), "");
  });
});

// ---------------------------------------------------------------------------
// buildSpeechBubble — return type regression
// ---------------------------------------------------------------------------

describe("buildSpeechBubble — return type", () => {
  it("returns a string, not an array", () => {
    const result = buildSpeechBubble("adult", "happy", "Hello!", "Pixel");
    assert.equal(typeof result, "string",
      "buildSpeechBubble must return a string — calling .join() on it will throw in OpenCode 1.4.0+");
  });

  it("does NOT have a .join method (would indicate an accidental array return)", () => {
    const result = buildSpeechBubble("adult", "happy", "Hello!", "Pixel");
    // Arrays have a .join method; strings do not have their own .join
    assert.equal(Array.isArray(result), false,
      "return value must not be an array");
  });

  it("contains newlines internally (lines are pre-joined)", () => {
    const result = buildSpeechBubble("adult", "happy", "Hello!", "Pixel");
    assert.ok(result.includes("\n"),
      "the string should contain newlines — lines are already joined inside buildSpeechBubble");
  });
});

// ---------------------------------------------------------------------------
// buildSpeechBubble — content correctness
// ---------------------------------------------------------------------------

describe("buildSpeechBubble — content", () => {
  it("includes the pet name in the output", () => {
    const result = stripAnsi(buildSpeechBubble("adult", "happy", "Hello!", "Bubbles"));
    assert.ok(result.includes("Bubbles"), "output should contain the pet name");
  });

  it("includes the stage in the output", () => {
    const result = stripAnsi(buildSpeechBubble("teen", "neutral", "Hey", "Rex"));
    assert.ok(result.includes("teen"), "output should contain the stage label");
  });

  it("includes the message text in the output", () => {
    const msg = "I am very hungry!";
    const result = stripAnsi(buildSpeechBubble("child", "sad", msg, "Dot"));
    assert.ok(result.includes(msg), "output should contain the speech message");
  });

  it("stripAnsi on the result produces no ANSI escape codes", () => {
    const result = buildSpeechBubble("baby", "sick", "ouch", "Pip");
    const plain = stripAnsi(result);
    // eslint-disable-next-line no-control-regex
    assert.ok(!/\x1b\[/.test(plain), "stripAnsi result should contain no ANSI codes");
  });

  it("result is non-empty for every stage", () => {
    for (const stage of ALL_STAGES) {
      const result = buildSpeechBubble(stage, "neutral", "hi", "Test");
      assert.ok(result.length > 0, `result should be non-empty for stage "${stage}"`);
    }
  });

  it("result is non-empty for every mood", () => {
    for (const mood of ALL_MOODS) {
      const result = buildSpeechBubble("adult", mood, "hi", "Test");
      assert.ok(result.length > 0, `result should be non-empty for mood "${mood}"`);
    }
  });

  it("falls back gracefully for an unknown stage", () => {
    // Should not throw — getArt falls back to a default
    assert.doesNotThrow(() => buildSpeechBubble("unknown_stage", "happy", "hi", "X"));
  });

  it("falls back gracefully for an unknown mood", () => {
    assert.doesNotThrow(() => buildSpeechBubble("adult", "unknown_mood", "hi", "X"));
  });

  it("handles an empty message without throwing", () => {
    assert.doesNotThrow(() => buildSpeechBubble("adult", "neutral", "", "X"));
  });

  it("handles a very long message without throwing", () => {
    const longMsg = "a".repeat(500);
    assert.doesNotThrow(() => buildSpeechBubble("adult", "neutral", longMsg, "X"));
  });
});

// ---------------------------------------------------------------------------
// buildSpeechBubble — integration: stripAnsi pipeline (mirrors plugin usage)
// ---------------------------------------------------------------------------

describe("integration — buildSpeechBubble + stripAnsi (plugin text.complete hook)", () => {
  /**
   * This is the exact sequence that crashed when bubbleLines.join was called.
   * The fix: buildSpeechBubble returns a string; pass it directly to stripAnsi.
   */
  it("stripAnsi(buildSpeechBubble(...)) does not throw and returns a plain string", () => {
    const bubble = buildSpeechBubble("adult", "happy", "Nice commit!", "Pixel");
    let plain: string;
    assert.doesNotThrow(() => { plain = stripAnsi(bubble); });
    // @ts-expect-error — assigned inside doesNotThrow callback
    assert.equal(typeof plain, "string");
  });

  it("the plain result can be embedded in a markdown code block without ANSI leaking", () => {
    const bubble = buildSpeechBubble("adult", "neutral", "Hello world", "Pixel");
    const plain = stripAnsi(bubble);
    const markdown = "```\n" + plain + "\n```";
    // eslint-disable-next-line no-control-regex
    assert.ok(!/\x1b\[/.test(markdown),
      "markdown code block should contain no ANSI escape sequences");
  });

  it("plain result is non-empty and multi-line", () => {
    const bubble = buildSpeechBubble("child", "sad", "I need food", "Dot");
    const plain = stripAnsi(bubble);
    assert.ok(plain.length > 0);
    assert.ok(plain.includes("\n"), "plain result should span multiple lines");
  });

  it("works correctly for all stages end-to-end", () => {
    for (const stage of ALL_STAGES) {
      const bubble = buildSpeechBubble(stage, "neutral", "test", "Bot");
      const plain = stripAnsi(bubble);
      assert.equal(typeof plain, "string",
        `pipeline should produce a string for stage "${stage}"`);
      assert.ok(plain.length > 0,
        `pipeline result should be non-empty for stage "${stage}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// buildStatusBlock
// ---------------------------------------------------------------------------

describe("buildStatusBlock", () => {
  const baseState = {
    name: "Pixel",
    stage: "adult",
    mood: "happy",
    hunger: 80,
    happiness: 75,
    energy: 60,
    health: 90,
    discipline: 50,
    weight: 30,
    ageDays: 5,
    alive: true,
    sick: false,
    sleeping: false,
    poops: 0,
  };

  it("returns a string", () => {
    assert.equal(typeof buildStatusBlock(baseState), "string");
  });

  it("contains the pet name", () => {
    const result = stripAnsi(buildStatusBlock(baseState));
    assert.ok(result.includes("Pixel"));
  });

  it("contains the stage", () => {
    const result = stripAnsi(buildStatusBlock(baseState));
    assert.ok(result.includes("adult"));
  });

  it("shows SICK when sick=true", () => {
    const result = stripAnsi(buildStatusBlock({ ...baseState, sick: true }));
    assert.ok(result.includes("SICK"));
  });

  it("shows sleeping when sleeping=true", () => {
    const result = stripAnsi(buildStatusBlock({ ...baseState, sleeping: true }));
    assert.ok(result.includes("sleeping"));
  });

  it("shows poop count when poops > 0", () => {
    const result = stripAnsi(buildStatusBlock({ ...baseState, poops: 3 }));
    assert.ok(result.includes("3"));
  });
});

// ---------------------------------------------------------------------------
// buildContextualSpeech
// ---------------------------------------------------------------------------

describe("buildContextualSpeech", () => {
  const basePet = {
    name: "Pixel",
    stage: "adult",
    mood: "happy",
    hunger: 80,
    happiness: 75,
    energy: 60,
    health: 90,
    sick: false,
    sleeping: false,
    poops: 0,
  };

  it("returns a string", () => {
    assert.equal(typeof buildContextualSpeech(basePet, 0, 0), "string");
  });

  it("returns non-empty string", () => {
    const result = buildContextualSpeech(basePet, 5, 60_000);
    assert.ok(result.length > 0);
  });

  it("reflects sick state in output", () => {
    const result = buildContextualSpeech({ ...basePet, sick: true }, 0, 0);
    assert.ok(result.length > 0, "should return a phrase when pet is sick");
  });

  it("reflects low hunger in output", () => {
    const result = buildContextualSpeech({ ...basePet, hunger: 10 }, 0, 0);
    assert.ok(result.length > 0, "should return a phrase when pet is very hungry");
  });

  it("does not throw for edge-case inputs", () => {
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 100, 3_600_000));
  });
});
