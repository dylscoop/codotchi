/**
 * usageBackfill.test.ts
 *
 * Unit tests for src/usageBackfill.ts — the pure helper that sums cost and
 * token usage from raw OpenCode message arrays.
 *
 * Run with:
 *   bun test tests/unit/usageBackfill.test.ts
 *   (from opencode-codotchi/)
 */

import { describe, it, expect } from "bun:test";
import { sumCompletedAssistantUsage, type RawMessageEntry } from "../../src/usageBackfill";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAssistant(overrides: {
  cost?: number;
  tokens?: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } };
  completed?: number;
}): RawMessageEntry {
  return {
    info: {
      role: "assistant",
      cost: overrides.cost ?? 0,
      tokens: {
        input:     overrides.tokens?.input     ?? 0,
        output:    overrides.tokens?.output    ?? 0,
        reasoning: overrides.tokens?.reasoning ?? 0,
        cache: {
          read:  overrides.tokens?.cache?.read  ?? 0,
          write: overrides.tokens?.cache?.write ?? 0,
        },
      },
      time: { completed: overrides.completed ?? Date.now() },
    },
  };
}

function makeUser(): RawMessageEntry {
  return {
    info: {
      role: "user",
      time: { created: Date.now() } as RawMessageEntry["info"]["time"],
    },
  };
}

function makeIncomplete(): RawMessageEntry {
  // assistant message with no time.completed (in-progress / partial stream)
  return {
    info: {
      role: "assistant",
      cost: 5.00,
      tokens: { input: 1000, output: 500 },
      time: { completed: undefined },
    },
  };
}

// ---------------------------------------------------------------------------
// Suite 1 — Empty / trivial inputs
// ---------------------------------------------------------------------------

describe("sumCompletedAssistantUsage — empty / trivial", () => {
  it("returns zeros for an empty array", () => {
    const result = sumCompletedAssistantUsage([]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(0);
  });

  it("returns zeros when only user messages are present", () => {
    const result = sumCompletedAssistantUsage([makeUser(), makeUser()]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(0);
  });

  it("returns zeros when only incomplete assistant messages are present", () => {
    const result = sumCompletedAssistantUsage([makeIncomplete()]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Cost accumulation
// ---------------------------------------------------------------------------

describe("sumCompletedAssistantUsage — cost accumulation", () => {
  it("counts cost from a single completed assistant message", () => {
    const result = sumCompletedAssistantUsage([makeAssistant({ cost: 1.23 })]);
    expect(result.costUSD).toBeCloseTo(1.23, 6);
  });

  it("sums cost across multiple completed assistant messages", () => {
    const result = sumCompletedAssistantUsage([
      makeAssistant({ cost: 1.00 }),
      makeAssistant({ cost: 0.50 }),
      makeAssistant({ cost: 2.25 }),
    ]);
    expect(result.costUSD).toBeCloseTo(3.75, 6);
  });

  it("treats missing cost as 0 (GitHub Copilot free tier)", () => {
    const msg: RawMessageEntry = {
      info: {
        role: "assistant",
        // cost field absent
        tokens: { input: 500, output: 200 },
        time: { completed: Date.now() },
      },
    };
    const result = sumCompletedAssistantUsage([msg]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(700);
  });

  it("treats NaN cost as 0", () => {
    const msg: RawMessageEntry = {
      info: {
        role: "assistant",
        cost: NaN,
        tokens: { input: 100 },
        time: { completed: Date.now() },
      },
    };
    const result = sumCompletedAssistantUsage([msg]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(100);
  });

  it("handles cost=0 explicitly (subscription / free model)", () => {
    const result = sumCompletedAssistantUsage([makeAssistant({ cost: 0, tokens: { input: 300, output: 150 } })]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(450);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Token accumulation
// ---------------------------------------------------------------------------

describe("sumCompletedAssistantUsage — token accumulation", () => {
  it("sums input + output tokens", () => {
    const result = sumCompletedAssistantUsage([makeAssistant({ tokens: { input: 1000, output: 500 } })]);
    expect(result.tokens).toBe(1500);
  });

  it("includes reasoning tokens", () => {
    const result = sumCompletedAssistantUsage([makeAssistant({ tokens: { input: 100, output: 50, reasoning: 200 } })]);
    expect(result.tokens).toBe(350);
  });

  it("includes cache read and write tokens", () => {
    const result = sumCompletedAssistantUsage([
      makeAssistant({ tokens: { input: 0, output: 0, cache: { read: 400, write: 100 } } }),
    ]);
    expect(result.tokens).toBe(500);
  });

  it("sums all five token fields together", () => {
    const result = sumCompletedAssistantUsage([
      makeAssistant({ tokens: { input: 100, output: 200, reasoning: 50, cache: { read: 30, write: 20 } } }),
    ]);
    expect(result.tokens).toBe(400);
  });

  it("treats missing token fields as 0", () => {
    const msg: RawMessageEntry = {
      info: {
        role: "assistant",
        cost: 0,
        // tokens field absent
        time: { completed: Date.now() },
      },
    };
    const result = sumCompletedAssistantUsage([msg]);
    expect(result.tokens).toBe(0);
  });

  it("accumulates tokens across multiple messages", () => {
    const result = sumCompletedAssistantUsage([
      makeAssistant({ tokens: { input: 100, output: 200 } }),
      makeAssistant({ tokens: { input: 300, output: 100, reasoning: 50 } }),
    ]);
    expect(result.tokens).toBe(750);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Filtering rules
// ---------------------------------------------------------------------------

describe("sumCompletedAssistantUsage — filtering rules", () => {
  it("excludes incomplete assistant messages (no time.completed)", () => {
    const result = sumCompletedAssistantUsage([makeIncomplete()]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(0);
  });

  it("excludes assistant messages with time.completed = 0 (falsy)", () => {
    const msg: RawMessageEntry = {
      info: {
        role: "assistant",
        cost: 2.00,
        tokens: { input: 500 },
        time: { completed: 0 },
      },
    };
    const result = sumCompletedAssistantUsage([msg]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(0);
  });

  it("excludes messages with role='user' even when cost is present", () => {
    const msg: RawMessageEntry = {
      info: {
        role: "user",
        cost: 99,
        tokens: { input: 999 },
        time: { completed: Date.now() },
      },
    };
    const result = sumCompletedAssistantUsage([msg]);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(0);
  });

  it("handles mixed message types — only counts completed assistant messages", () => {
    const result = sumCompletedAssistantUsage([
      makeUser(),
      makeIncomplete(),
      makeAssistant({ cost: 1.00, tokens: { input: 200, output: 100 } }),
      makeUser(),
      makeAssistant({ cost: 0.50, tokens: { input: 50, output: 25 } }),
    ]);
    expect(result.costUSD).toBeCloseTo(1.50, 6);
    expect(result.tokens).toBe(375);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Integration: backfill guard logic
// ---------------------------------------------------------------------------

describe("sumCompletedAssistantUsage — backfill guard integration", () => {
  it("produces more tokens than the sidecar when historical sessions exist", () => {
    const sidecarsTokens = 500; // what the sidecar had from previous run
    const historicalMessages = [
      makeAssistant({ tokens: { input: 300, output: 200 } }),  // 500
      makeAssistant({ tokens: { input: 100, output: 100 } }),  // 200 — total 700
    ];
    const backfilled = sumCompletedAssistantUsage(historicalMessages);
    // Guard: only overwrite if backfilled > sidecar
    const finalTokens = backfilled.tokens > sidecarsTokens ? backfilled.tokens : sidecarsTokens;
    expect(finalTokens).toBe(700);
  });

  it("keeps sidecar value when live events already exceed the API total", () => {
    // This simulates the race where live events have already accumulated more
    // than what the API returns (e.g. current message is mid-flight).
    const liveAccumulatedTokens = 1000;
    const historicalMessages = [
      makeAssistant({ tokens: { input: 300, output: 200 } }),  // 500 — less than live
    ];
    const backfilled = sumCompletedAssistantUsage(historicalMessages);
    const finalTokens = backfilled.tokens > liveAccumulatedTokens ? backfilled.tokens : liveAccumulatedTokens;
    expect(finalTokens).toBe(1000); // sidecar wins
  });

  it("real-world GitHub Copilot scenario: cost=0 but tokens accumulate", () => {
    // Copilot is subscription-based — cost is always 0, but tokens are real
    const messages = [
      makeAssistant({ cost: 0, tokens: { input: 1200, output: 800 } }),
      makeAssistant({ cost: 0, tokens: { input: 900,  output: 600, reasoning: 100 } }),
      makeUser(),
      makeIncomplete(), // should not be counted
    ];
    const result = sumCompletedAssistantUsage(messages);
    expect(result.costUSD).toBe(0);
    expect(result.tokens).toBe(3600); // 2000 + 1600
  });
});
