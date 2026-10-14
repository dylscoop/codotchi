/**
 * pricing.test.ts
 *
 * Unit tests for src/pricing.ts — recomputing message cost from token counts
 * at GitHub Copilot's published rates.
 *
 * Run with:
 *   npm run test:node
 *   (from opencode-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRICING, buildPricingTable, computeCost, messageCost, ratesFor } from "../../src/pricing";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `expected ${a} to be close to ${b}`);

describe("computeCost", () => {
  const opus = DEFAULT_PRICING["github-copilot/claude-opus-5.5"];

  it("uses GitHub's Opus 5.5 rates including $5/M cache writes", () => {
    assert.deepEqual(opus, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
  });

  it("charges cache writes that OpenCode's stored cost leaves out", () => {
    // Real message: OpenCode stored 0.0134352 (cache write priced at $0).
    const tokens = { input: 2, output: 234, reasoning: 0, cache: { read: 43736, write: 2496 } };
    close(computeCost({ ...tokens, cache: { read: 43736, write: 0 } }, opus), 0.0134352);
    close(computeCost(tokens, opus), 0.0134352 + 2496 * 5 / 1e6);
  });

  it("bills reasoning tokens at the output rate", () => {
    close(computeCost({ reasoning: 1_000_000 }, opus), 20);
  });

  it("treats missing tokens as zero", () => {
    assert.equal(computeCost(undefined, opus), 0);
  });
});

describe("messageCost", () => {
  it("recomputes cost for a priced model (V1 providerID/modelID fields)", () => {
    const cost = messageCost(DEFAULT_PRICING, { cost: 0, providerID: "github-copilot", modelID: "claude-opus-5.5", tokens: { cache: { write: 1_000_000 } } });
    close(cost, 5);
  });

  it("recomputes cost for a priced model (V2 model object)", () => {
    const cost = messageCost(DEFAULT_PRICING, { cost: 0, model: { providerID: "github-copilot", id: "claude-opus-5.5" }, tokens: { output: 1_000_000 } });
    close(cost, 20);
  });

  it("falls back to OpenCode's stored cost for unknown models", () => {
    assert.equal(messageCost(DEFAULT_PRICING, { cost: 1.5, providerID: "openai", modelID: "gpt-x", tokens: { input: 99 } }), 1.5);
    assert.equal(messageCost(DEFAULT_PRICING, { cost: 0.75, tokens: { input: 99 } }), 0.75);
    assert.equal(messageCost(DEFAULT_PRICING, { cost: NaN }), 0);
  });
});

describe("buildPricingTable", () => {
  it("returns the defaults when there are no overrides", () => {
    assert.deepEqual(buildPricingTable(undefined), DEFAULT_PRICING);
  });

  it("merges partial overrides over a default model", () => {
    const t = buildPricingTable({ "github-copilot/claude-opus-5.5": { cacheWrite: 1.85 } });
    assert.deepEqual(ratesFor(t, "github-copilot", "claude-opus-5.5"), { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 1.85 });
    assert.equal(DEFAULT_PRICING["github-copilot/claude-opus-5.5"].cacheWrite, 5);
  });

  it("adds new models and ignores invalid values", () => {
    const t = buildPricingTable({ "acme/m1": { input: 1, output: -3, cacheRead: "x" }, "bad": 5 });
    assert.deepEqual(t["acme/m1"], { input: 1, output: 0, cacheRead: 0, cacheWrite: 0 });
    assert.equal(t["bad"], undefined);
  });
});
