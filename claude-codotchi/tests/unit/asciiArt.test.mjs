/**
 * asciiArt.test.mjs
 *
 * Unit tests for dist/asciiArt.js — focused on the tokens-per-message
 * averaging behaviour added to buildContextualSpeech() (the dailyMessages
 * parameter). Mirrors the equivalent coverage added to opencode-codotchi's
 * asciiArt.test.ts, since both plugins share the same buildContextualSpeech
 * logic (kept in sync per the opencode-claude-parity project convention).
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
import { buildContextualSpeech, formatTokens } from "../../dist/asciiArt.js";

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
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 4);
    const expected = formatTokens(2_500);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(!message.includes(formatTokens(10_000)), `raw total should not appear in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in warn tier", () => {
    // dailyTokens=50_000 over dailyMessages=5 -> average = 10_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 35, 50_000, 30, 50, 0, 5);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("per message"), `expected "per message" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in shout tier (uppercased)", () => {
    // dailyTokens=1_000_000 over dailyMessages=10 -> average = 100_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 60, 1_000_000, 30, 50, 0, 10);
    const expected = formatTokens(100_000).toUpperCase();
    assert.ok(message.includes(expected), `expected averaged "${expected}" in: ${message}`);
    assert.ok(message.includes("PER MESSAGE"), `expected "PER MESSAGE" wording in: ${message}`);
  });

  it("shows the averaged tokens/message value in token-only tier (no cost)", () => {
    // dailyTokens=8_000 over dailyMessages=4 -> average = 2_000
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 0, 8_000, 30, 50, 0, 4);
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
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0);
    assert.ok(!message.includes("NaN"), `message should never contain NaN: ${message}`);
    assert.ok(!message.includes("Infinity"), `message should never contain Infinity: ${message}`);
  });

  it("single message (dailyMessages=1) shows the same value as the raw total", () => {
    const { message } = buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 1);
    const expected = formatTokens(10_000);
    assert.ok(message.includes(expected), `expected "${expected}" in: ${message}`);
  });

  it("does not throw for edge-case dailyMessages inputs", () => {
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 0));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 1));
    assert.doesNotThrow(() => buildContextualSpeech(basePet, 0, 0, 0, 0, false, 5, 10_000, 30, 50, 0, 1_000));
  });
});
