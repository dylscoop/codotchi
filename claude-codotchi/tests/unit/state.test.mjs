/**
 * state.test.mjs
 *
 * Unit tests for scripts/state.mjs — focused on the `messageCount` field added
 * to the daily usage accumulator (accumulateDailyUsage / scanAllDailyUsage).
 * messageCount is the denominator used to compute a tokens-per-message average
 * shown in the pet's speech bubble, replacing the previous unbounded
 * cumulative daily token total.
 *
 * scanAllDailyUsage() reads directly from ~/.claude/projects/**\/*.jsonl, so
 * these tests point HOME/USERPROFILE at a temporary directory containing a
 * fake transcript tree instead of touching the real user's Claude Code data.
 * os.homedir() re-reads the HOME/USERPROFILE env vars on every call (verified
 * on this project's target platforms), so redirecting them before each test
 * is sufficient — no filesystem mocking library is required.
 *
 * Run with:
 *   node --test tests/unit/state.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { accumulateDailyUsage } from "../../scripts/state.mjs";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Today's date as an ISO instant (UTC), used to build timestamps scanAllDailyUsage will count. */
function todayIso(hour = 12) {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Yesterday's date as an ISO instant — used to build timestamps that must be excluded. */
function yesterdayIso(hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function assistantLine({ timestamp, inputTokens = 100, outputTokens = 50, cacheRead = 0, cacheCreate = 0, model = "claude-sonnet-4-x" } = {}) {
  return {
    type: "assistant",
    timestamp,
    message: {
      model,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheCreate,
      },
    },
  };
}

function userLine({ timestamp } = {}) {
  return { type: "user", timestamp, message: { content: "hello" } };
}

/**
 * Run `fn` with HOME/USERPROFILE redirected to a fresh temp directory
 * containing the given transcript fixtures, then clean up afterwards.
 *
 * @param transcripts - Array of { project: string, session: string, lines: object[] | string[] }.
 *                      `lines` entries that are strings are written verbatim (for malformed-JSON tests);
 *                      object entries are JSON.stringify'd.
 * @param fn          - async callback invoked once the fixture is in place.
 */
async function withFixture(transcripts, fn) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-state-test-"));
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;

  for (const t of transcripts) {
    const dir = path.join(tmpHome, ".claude", "projects", t.project);
    fs.mkdirSync(dir, { recursive: true });
    const content = t.lines
      .map((l) => (typeof l === "string" ? l : JSON.stringify(l)))
      .join("\n") + "\n";
    fs.writeFileSync(path.join(dir, `${t.session}.jsonl`), content, "utf8");
  }

  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;

  try {
    await fn();
  } finally {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origUserProfile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Suite 1 — Empty / trivial
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — empty / trivial", () => {
  it("returns messageCount=0 when ~/.claude/projects has no transcripts at all", async () => {
    await withFixture([], async () => {
      const result = accumulateDailyUsage();
      assert.equal(result.messageCount, 0);
      assert.equal(result.costUsd, 0);
      assert.equal(result.tokens, 0);
    });
  });

  it("returns messageCount=0 when the only transcript has no assistant lines", async () => {
    await withFixture(
      [{ project: "proj1", session: "sess1", lines: [userLine({ timestamp: todayIso() }), userLine({ timestamp: todayIso() })] }],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 0);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Counting
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — counting", () => {
  it("counts a single completed assistant message", async () => {
    await withFixture(
      [{ project: "proj1", session: "sess1", lines: [assistantLine({ timestamp: todayIso(), inputTokens: 1000, outputTokens: 500 })] }],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
        assert.equal(result.tokens, 1500);
      }
    );
  });

  it("counts multiple assistant messages within a single transcript", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: todayIso(), inputTokens: 100, outputTokens: 50 }),
            assistantLine({ timestamp: todayIso(), inputTokens: 200, outputTokens: 100 }),
            assistantLine({ timestamp: todayIso(), inputTokens: 300, outputTokens: 150 }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 3);
        assert.equal(result.tokens, 900);
      }
    );
  });

  it("sums messageCount across multiple projects and multiple transcript files", async () => {
    await withFixture(
      [
        { project: "proj1", session: "sess1", lines: [assistantLine({ timestamp: todayIso() })] },
        { project: "proj1", session: "sess2", lines: [assistantLine({ timestamp: todayIso() }), assistantLine({ timestamp: todayIso() })] },
        { project: "proj2", session: "sess3", lines: [assistantLine({ timestamp: todayIso() })] },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 4);
      }
    );
  });

  it("does not count user messages toward messageCount", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            userLine({ timestamp: todayIso() }),
            assistantLine({ timestamp: todayIso() }),
            userLine({ timestamp: todayIso() }),
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 2);
      }
    );
  });

  it("does not count assistant lines missing a usage field", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            { type: "assistant", timestamp: todayIso(), message: { model: "claude-sonnet-4-x" } }, // no usage
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Date filtering
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — date filtering", () => {
  it("excludes assistant messages timestamped yesterday", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: yesterdayIso() }),
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
      }
    );
  });

  it("counts messages from multiple times today", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: todayIso(0) }),
            assistantLine({ timestamp: todayIso(12) }),
            assistantLine({ timestamp: todayIso(23) }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 3);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Robustness
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — robustness", () => {
  it("skips malformed JSON lines without throwing", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            "{ not valid json !!",
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        let result;
        assert.doesNotThrow(() => { result = accumulateDailyUsage(); });
        assert.equal(result.messageCount, 1);
      }
    );
  });

  it("ignores non-.jsonl files in the project directory", async () => {
    await withFixture(
      [{ project: "proj1", session: "sess1", lines: [assistantLine({ timestamp: todayIso() })] }],
      async () => {
        // Write a stray non-jsonl file alongside the transcript.
        const dir = path.join(process.env.HOME, ".claude", "projects", "proj1");
        fs.writeFileSync(path.join(dir, "notes.txt"), "not a transcript", "utf8");
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Integration: tokens-per-message averaging
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — integration: tokens-per-message averaging", () => {
  it("messageCount stays in lockstep with tokens — enables a sane average", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: todayIso(), inputTokens: 1000, outputTokens: 500 }), // 1500
            assistantLine({ timestamp: todayIso(), inputTokens: 2000, outputTokens: 1000 }), // 3000
            assistantLine({ timestamp: todayIso(), inputTokens: 500, outputTokens: 500 }), // 1000
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.tokens, 5500);
        assert.equal(result.messageCount, 3);
        assert.ok(result.tokens / result.messageCount > 0);
        assert.equal(Math.round(result.tokens / result.messageCount), 1833);
      }
    );
  });
});
