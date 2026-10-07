/**
 * asciiArt.test.mjs
 *
 * Unit tests for dist/asciiArt.js — focused on the tokens-per-message
 * averaging behaviour added to buildContextualSpeech() (the dailyMessages
 * parameter) and the Claude Code "hourlyRate" cost wording. Mirrors the
 * equivalent coverage in opencode-codotchi's
 * asciiArt.test.ts; both plugins build asciiArt.ts from packages/core.
 *
 * Imports from dist/ (compiled output) rather than src/ because the plugin's
 * own hook scripts (hook-session-start.mjs, statusline.mjs, etc.) also import
 * from dist/ at runtime — testing the same artifact that actually ships.
 * Run `npm run build` first if dist/asciiArt.js is stale.
 *
 * Run with:
 *   node --test tests/unit/asciiArt.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildContextualSpeech, formatTokens, attentionCallKey, attentionCallSpeech, ATTENTION_CALL_TEXT } from "../../dist/asciiArt.js";
import { ATTENTION_CALL_TYPES } from "../../dist/gameEngine.js";

/** claude-codotchi always asks for the Claude Code cost wording. */
const HOURLY = { costStyle: "hourlyRate" };

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

describe("buildContextualSpeech — tokens-per-message averaging", () => {
  it("shows the averaged tokens/message value, not the raw daily total (normal tier)", () => {
    // dailyTokens=10_000 over dailyMessages=4 -> average = 2_500
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 4, HOURLY);
    const expected = formatTokens(2_500);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(!message.includes(formatTokens(10_000)), `raw total should not appear in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in warn tier", () => {
    // dailyTokens=50_000 over dailyMessages=5 -> average = 10_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 35, 50_000, 30, 50, 0, 0, 5, HOURLY);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in shout tier (uppercased)", () => {
    // dailyTokens=1_000_000 over dailyMessages=10 -> average = 100_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 60, 1_000_000, 30, 50, 0, 0, 10, HOURLY);
    const expected = formatTokens(100_000).toUpperCase();
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("PER MESSAGE"), `expected "PER MESSAGE" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in token-only tier (no cost)", () => {
    // dailyTokens=8_000 over dailyMessages=4 -> average = 2_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 0, 8_000, 30, 50, 0, 0, 4, HOURLY);
    const expected = formatTokens(2_000);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("falls back to the raw daily total when dailyMessages is 0 (default)", () => {
    // No dailyMessages arg passed at all -> defaults to 0 -> falls back to the raw total.
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected raw total "${expected}" fallback in: ${message}`);
  });

  it("does not divide by zero / produce NaN or Infinity when dailyMessages is 0", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 0, HOURLY);
    assert.ok(!message.includes("NaN"), `message should never contain NaN: ${message}`);
    assert.ok(!message.includes("Infinity"), `message should never contain Infinity: ${message}`);
  });

  it("single message (dailyMessages=1) shows the same value as the raw total", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 1, HOURLY);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected "${expected}" in: ${message}`);
  });

  it("hourlyRate style shows the $X/hr rate and a tier light, not the 'last 1h' wording", () => {
    const { message, tierEmoji } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 1.5, 0, 4, HOURLY);
    assert.ok(message.includes("$1.50/hr"), `expected "$1.50/hr" in: ${message}`);
    assert.ok(message.includes("🟢"), `expected the green light in: ${message}`);
    assert.ok(!message.includes("last 1h"), `"last 1h" is OpenCode wording: ${message}`);
    assert.equal(tierEmoji, "🟢");
  });

  it("hourlyRate style shows no usage light when there is no cost or token data", () => {
    const { tierEmoji } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 0, 0, 30, 50, 0, 0, 0, HOURLY);
    assert.equal(tierEmoji, "");
  });

  it("does not throw for edge-case dailyMessages inputs", () => {
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 0, HOURLY));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 1, HOURLY));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0, 1_000, HOURLY));
  });
});

describe("attentionCallSpeech()", () => {
  it("has text for every attention call type (both craving foods)", () => {
    for (const call of ATTENTION_CALL_TYPES) {
      for (const food of call === "craving" ? ["meal", "snack"] : [null]) {
        const speech = attentionCallSpeech(attentionCallKey(call, food), 0);
        assert.ok(speech, `no speech for ${call}${food ? `/${food}` : ""}`);
        assert.ok(speech.message.length > 0);
        assert.ok(speech.label.length > 0);
      }
    }
  });

  it("maps a craving to the food it asks for, defaulting to meal", () => {
    assert.equal(attentionCallKey("craving", "snack"), "craving_snack");
    assert.equal(attentionCallKey("craving", "meal"), "craving_meal");
    assert.equal(attentionCallKey("craving", null), "craving_meal");
    assert.equal(attentionCallKey("pat"), "pat");
  });

  it("picks a stable phrase for a given index, wrapping round", () => {
    const phrases = ATTENTION_CALL_TEXT.pat.phrases;
    assert.equal(attentionCallSpeech("pat", 0).message, phrases[0]);
    assert.equal(attentionCallSpeech("pat", phrases.length + 1).message, phrases[1]);
  });

  it("returns null for an unknown key", () => {
    assert.equal(attentionCallSpeech("nope"), null);
  });
});
