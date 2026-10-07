/**
 * claudeUsage.test.ts
 *
 * Unit tests for src/claudeUsage.ts — the Claude Code transcript scanner
 * behind "Today's Token Cost" (BUGFIX-161): local-day boundary, dedupe of
 * repeated content-block lines, subagent transcripts and hourly cost.
 * Uses the built-in Node.js test runner (node:test + node:assert).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { scanClaudeCodeDailyUsage, localDayStartMs, localDateKey } from "../../src/claudeUsage";

/** Local-time instant helper: new Date(y, m, d, h, min) as ISO. */
function localIso(y: number, m: number, d: number, h: number, min = 0): string {
  return new Date(y, m, d, h, min).toISOString();
}

function line(id: string, requestId: string, timestamp: string, outputTokens = 50): object {
  return {
    type: "assistant",
    timestamp,
    requestId,
    message: {
      id,
      model: "claude-sonnet-4-x",
      usage: { input_tokens: 100, output_tokens: outputTokens, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    },
  };
}

/** Write a transcript tree under a fresh temp projects dir, run fn, then clean up. */
function withProjsDir(files: Record<string, object[]>, fn: (projsDir: string) => void): void {
  const projsDir = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-vscode-scan-"));
  try {
    for (const [rel, lines] of Object.entries(files)) {
      const fp = path.join(projsDir, rel);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, lines.map((l) => JSON.stringify(l)).join("\n") + "\n", "utf8");
    }
    fn(projsDir);
  } finally {
    fs.rmSync(projsDir, { recursive: true, force: true });
  }
}

describe("scanClaudeCodeDailyUsage", () => {
  // 00:30 local on 2026-09-24 — just after the user's midnight.
  const nowMs = new Date(2026, 8, 24, 0, 30).getTime();

  it("localDayStartMs / localDateKey use the local calendar day", () => {
    assert.equal(localDayStartMs(nowMs), new Date(2026, 8, 24).getTime());
    assert.equal(localDateKey(nowMs), "2026-09-24");
  });

  it("splits a session that crosses midnight at local midnight", () => {
    withProjsDir({
      "proj/sess.jsonl": [
        line("m1", "r1", localIso(2026, 8, 23, 23, 59)),
        line("m2", "r2", localIso(2026, 8, 24, 0, 1)),
      ],
    }, (projsDir) => {
      const r = scanClaudeCodeDailyUsage(projsDir, nowMs);
      assert.equal(r.messageCount, 1);
      assert.equal(r.tokens, 150);
    });
  });

  it("counts repeated content-block lines once, keeping the last line's usage", () => {
    const ts = localIso(2026, 8, 24, 0, 10);
    withProjsDir({
      "proj/sess.jsonl": [line("m1", "r1", ts, 5), line("m1", "r1", ts, 50), line("m2", "r2", ts, 50)],
    }, (projsDir) => {
      const r = scanClaudeCodeDailyUsage(projsDir, nowMs);
      assert.equal(r.messageCount, 2);
      assert.equal(r.tokens, 300);
    });
  });

  it("includes subagent transcripts under <session>/subagents/", () => {
    const ts = localIso(2026, 8, 24, 0, 10);
    withProjsDir({
      "proj/sess.jsonl": [line("m1", "r1", ts)],
      "proj/sess/subagents/agent-a.jsonl": [line("s1", "rs1", ts), line("s2", "rs2", ts)],
    }, (projsDir) => {
      assert.equal(scanClaudeCodeDailyUsage(projsDir, nowMs).messageCount, 3);
    });
  });

  it("hourly cost covers only the last hour", () => {
    withProjsDir({
      "proj/sess.jsonl": [
        line("old", "r1", localIso(2026, 8, 23, 23, 0)),
        line("new", "r2", localIso(2026, 8, 24, 0, 20)),
      ],
    }, (projsDir) => {
      const r = scanClaudeCodeDailyUsage(projsDir, nowMs);
      assert.equal(r.messageCount, 1);
      assert.ok(r.hourlyCostUsd > 0);
      assert.equal(r.hourlyCostUsd, r.costUsd);
    });
  });

  it("returns zeros when the projects dir does not exist", () => {
    const r = scanClaudeCodeDailyUsage(path.join(os.tmpdir(), "codotchi-missing-dir-xyz"), nowMs);
    assert.deepEqual(r, { costUsd: 0, hourlyCostUsd: 0, tokens: 0, messageCount: 0 });
  });
});
