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
  formatTokens,
  spriteLabel,
  situationalLines,
  SITUATION_LINES,
  SPEND_REMARKS,
} from "../../src/asciiArt";

describe("buildStatusBlock display", () => {
  const base = {
    name: "Wee Stu", stage: "baby", mood: "happy",
    hunger: 67.84166666666665, happiness: 81.84166666666665, energy: 74,
    health: 100, discipline: 100, weight: 12, ageDays: 9,
    alive: true, sick: false, sleeping: false, poops: 0,
  };

  it("rounds stat values to whole numbers", () => {
    const out = stripAnsi(buildStatusBlock({ ...base, spriteType: "cat" }));
    assert.match(out, /Hunger\s+\[[█░]+\] 68\b/);
    assert.match(out, /Happiness\s+\[[█░]+\] 82\b/);
    assert.doesNotMatch(out, /\d+\.\d+/);
  });

  it("shows the character name for the stu sprite", () => {
    const out = stripAnsi(buildStatusBlock({ ...base, spriteType: "stu" }));
    assert.match(out, /Sprite\s+: Stugotchi/);
  });
});

describe("spriteLabel", () => {
  it("maps stu to Stugotchi and capitalises other IDs", () => {
    assert.equal(spriteLabel("stu"), "Stugotchi");
    assert.equal(spriteLabel("cat"), "Cat");
  });
});

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

  it("shows levels, trainer XP and the latest achievements when given progression", () => {
    const result = stripAnsi(buildStatusBlock({
      ...baseState, levels: true, petLevel: 3, trainer: { xp: 150, achievements: ["hello_world", "first_commit"] },
    }));
    assert.ok(result.includes("Level   : Pet 3 · Trainer 2"));
    assert.ok(result.includes("100/141"));
    assert.ok(result.includes("Achievements  2/17"));
    assert.ok(result.includes("📌 First Commit, 👋 Hello World"));
  });

  it("lists today's challenges and the streak when given dailies", () => {
    const now = new Date();
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const result = stripAnsi(buildStatusBlock({
      ...baseState,
      spawnedAt: 1,
      levels: true,
      trainer: { xp: 0, achievements: [], counters: { commits: 2 } },
      dailies: { day, picks: ["commit_3", "calls_3", "win_1"], baseline: { commits: 1 }, done: [], streak: 4, streakDay: day },
    }));
    assert.ok(result.includes("streak 4"));
    assert.ok(result.includes("· Make 3 commits 1/3"));
    assert.ok(result.includes("Win a mini-game 0/1"));
  });

  it("leaves progression out unless levels are enabled", () => {
    const result = stripAnsi(buildStatusBlock({ ...baseState, petLevel: 3, trainer: { xp: 150, achievements: ["hello_world"] } }));
    assert.ok(!result.includes("Trainer"));
    assert.ok(!result.includes("Achievements"));
  });

  it("leaves progression out for states without it", () => {
    const result = stripAnsi(buildStatusBlock(baseState));
    assert.ok(!result.includes("Trainer"));
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
    const { message } = buildContextualSpeech(basePet, 0, 0);
    assert.equal(typeof message, "string");
  });

  it("returns non-empty string", () => {
    const { message } = buildContextualSpeech(basePet, 5, 60_000);
    assert.ok(message.length > 0);
  });

  it("reflects sick state in output", () => {
    const { message } = buildContextualSpeech({ ...basePet, sick: true }, 0, 0);
    assert.ok(message.length > 0, "should return a phrase when pet is sick");
  });

  it("reflects low hunger in output", () => {
    const { message } = buildContextualSpeech({ ...basePet, hunger: 10 }, 0, 0);
    assert.ok(message.length > 0, "should return a phrase when pet is very hungry");
  });

  it("does not throw for edge-case inputs", () => {
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 100, 3_600_000));
  });

  it("includes token text when tokens > 0 and cost is zero", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 0, 1500);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("includes cost and token text in normal tier (cost > 0, below warn threshold)", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("includes warn-tone text when cost >= warn threshold", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 35, 50_000, 30, 50);
    assert.ok(message.includes("$35.00"), `expected cost string in: ${message}`);
  });

  it("returns ALL CAPS output when cost >= shout threshold", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 60, 100_000, 30, 50);
    const plain = stripAnsi(message);
    assert.equal(plain, plain.toUpperCase(), "expected ALL CAPS output at shout threshold");
  });

  // --- Cost suffix always appended — even when a contextual override phrase is chosen ---

  it("appends cost suffix when sessionUserMessages >= 5 (override branch)", () => {
    // 8 messages → picks the >= 5 override phrase, but cost suffix must still appear
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 8, false, 5, 10_000, 30, 50);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("appends cost suffix when sessionUserMessages >= 10 (override branch)", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 12, false, 5, 10_000, 30, 50);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("appends cost suffix when sessionUserMessages >= 20 (override branch)", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 25, false, 5, 10_000, 30, 50);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("appends warn-tier cost suffix on high message count override", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 15, false, 35, 50_000, 30, 50);
    assert.ok(message.includes("$35.00"), `expected cost string in: ${message}`);
  });

  it("returns ALL CAPS on high message count override when cost >= shout threshold", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 15, false, 60, 100_000, 30, 50);
    const plain = stripAnsi(message);
    assert.equal(plain, plain.toUpperCase(), "expected ALL CAPS even on message-count override branch");
  });

  it("remarksOnly keeps tier remarks but drops $ / token figures", () => {
    const green = buildContextualSpeech(basePet, 3, 0, 0, 0, false, 5, 10_000, 30, 50, 1, 0, 2, { remarksOnly: true });
    const yellow = buildContextualSpeech(basePet, 3, 0, 0, 0, false, 35, 10_000, 30, 50, 1, 0, 2, { remarksOnly: true });
    const red = buildContextualSpeech(basePet, 3, 0, 0, 0, false, 60, 10_000, 30, 50, 1, 0, 2, { remarksOnly: true });
    for (const s of [green, yellow, red]) {
      assert.ok(!/\$|tokens per message|last 1h/.test(s.message), `unexpected figures in: ${s.message}`);
    }
    assert.equal(green.tierEmoji, "🟢");
    assert.equal(yellow.tierEmoji, "🟡");
    assert.equal(red.tierEmoji, "🔴");
    const redText = red.message.replace(/\x1b\[[0-9;]*m/g, "");
    assert.equal(redText, redText.toUpperCase());
  });

  it("appends cost suffix on prod branch override", () => {
    const { message } = buildContextualSpeech(basePet, 3, 0, 0, 0, true, 5, 10_000, 30, 50);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("appends cost suffix on long-idle override (>= 60 min)", () => {
    // timeSinceLastEditMs = 65 minutes
    const { message } = buildContextualSpeech(basePet, 1, 0, 65 * 60_000, 0, false, 5, 10_000, 30, 50);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("appends cost suffix on idle override (>= 30 min)", () => {
    // timeSinceLastEditMs = 35 minutes
    const { message } = buildContextualSpeech(basePet, 1, 0, 35 * 60_000, 0, false, 5, 10_000, 30, 50);
    assert.ok(message.includes("$"), `expected "$" in: ${message}`);
    assert.ok(message.includes("tokens"), `expected "tokens" in: ${message}`);
  });

  it("includes last-1h cost in suffix when lastHourCostUSD > 0", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 1.23, 500);
    assert.ok(message.includes("last 1h"), `expected "last 1h" in: ${message}`);
    assert.ok(message.includes("$1.23"), `expected 1h cost in: ${message}`);
  });

  it("omits last-1h fragment when lastHourCostUSD is 0", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0);
    assert.ok(!message.includes("last 1h"), `expected no "last 1h" in: ${message}`);
  });

  it("includes last-1h cost in warn tier", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 35, 50_000, 30, 50, 2.50, 1000);
    assert.ok(message.includes("last 1h"), `expected "last 1h" in warn tier: ${message}`);
  });

  it("includes last-1h cost in shout tier (uppercased)", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 60, 100_000, 30, 50, 3.00, 2000);
    assert.ok(message.includes("LAST 1H"), `expected "LAST 1H" in shout tier: ${message}`);
  });
});

// ---------------------------------------------------------------------------
// buildContextualSpeech — tokens-per-message averaging (dailyMessages param)
// ---------------------------------------------------------------------------

describe("buildContextualSpeech — tokens-per-message averaging", () => {
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

  it("shows the averaged tokens/message value, not the raw daily total (normal tier)", () => {
    // dailyTokens=10_000 over dailyMessages=4 → average = 2_500
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 4);
    const expected = formatTokens(2_500);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(!message.includes(formatTokens(10_000)), `raw total should not appear in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in warn tier", () => {
    // dailyTokens=50_000 over dailyMessages=5 → average = 10_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 35, 50_000, 30, 50, 0, 0, 5);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in shout tier (uppercased)", () => {
    // dailyTokens=1_000_000 over dailyMessages=10 → average = 100_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 60, 1_000_000, 30, 50, 0, 0, 10);
    const expected = formatTokens(100_000).toUpperCase();
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("PER MESSAGE"), `expected "PER MESSAGE" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in token-only tier (no cost)", () => {
    // dailyTokens=8_000 over dailyMessages=4 → average = 2_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 0, 8_000, 30, 50, 0, 0, 4);
    const expected = formatTokens(2_000);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("falls back to the raw daily total when dailyMessages is 0 (default)", () => {
    // No dailyMessages arg passed — defaults to 0 — should fall back to the raw total.
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected raw total "${expected}" fallback in: ${message}`);
  });

  it("falls back to the raw daily total when dailyMessages is explicitly 0", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 0);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected raw total "${expected}" fallback in: ${message}`);
  });

  it("does not divide by zero / produce NaN or Infinity when dailyMessages is 0", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 0);
    assert.ok(!message.includes("NaN"), `message should never contain NaN: ${message}`);
    assert.ok(!message.includes("Infinity"), `message should never contain Infinity: ${message}`);
  });

  it("single message (dailyMessages=1) shows the same value as the raw total", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 1);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected "${expected}" in: ${message}`);
  });

  it("does not throw for edge-case dailyMessages inputs", () => {
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 0));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 1));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 1_000));
  });
});

describe("situationalLines � remarksOnly extra lines", () => {
  const at = (h: number) => new Date(2026, 9, 13, h, 0, 0);
  it("always includes the any-time lines", () => {
    const lines = situationalLines(0, 0, at(10));
    for (const l of SITUATION_LINES.general) { assert.ok(lines.includes(l)); }
  });
  it("adds file-count lines at 15+ and 30+", () => {
    assert.ok(situationalLines(15, 0, at(10)).includes(SITUATION_LINES.files15[0]));
    const big = situationalLines(30, 0, at(10));
    assert.ok(big.includes(SITUATION_LINES.files30[0]));
    assert.ok(!big.includes(SITUATION_LINES.files15[0]));
  });
  it("adds session-length lines at 1h / 3h / 5h", () => {
    assert.ok(situationalLines(0, 3_600_000, at(10)).includes(SITUATION_LINES.session1h[0]));
    assert.ok(situationalLines(0, 3 * 3_600_000, at(10)).includes(SITUATION_LINES.session3h[0]));
    assert.ok(situationalLines(0, 5 * 3_600_000, at(10)).includes(SITUATION_LINES.session5h[0]));
  });
  it("adds time-of-day lines: before 9am, 12�2pm, after 5pm, none mid-morning", () => {
    assert.ok(situationalLines(0, 0, at(8)).includes(SITUATION_LINES.morning[0]));
    assert.ok(situationalLines(0, 0, at(13)).includes(SITUATION_LINES.midday[0]));
    assert.ok(situationalLines(0, 0, at(18)).includes(SITUATION_LINES.evening[0]));
    assert.equal(situationalLines(0, 0, at(10)).length, SITUATION_LINES.general.length);
  });
  it("spend remarks contain no figures", () => {
    for (const l of [...SPEND_REMARKS.green, ...SPEND_REMARKS.yellow, ...SPEND_REMARKS.red]) { assert.doesNotMatch(l, /\$|\d/); }
  });
});
