/**
 * claudeUsage.ts
 *
 * Scans Claude Code transcripts (~/.claude/projects) and sums today's token
 * usage and cost for the "Today's Token Cost" bubble. Mirrors
 * claude-codotchi/scripts/state.mjs scanClaudeUsage() and the PyCharm
 * ClaudeUsageScanner.kt — keep all three in sync.
 */

import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// Pricing per million tokens (USD) — mirrors state.mjs MODEL_PRICING table.
// Ordered most-specific first — checked with startsWith(), so longer/pricier
// sub-prefixes (e.g. claude-opus-4-8) must precede their shorter generic
// parent (claude-opus-4). Covers both real model-ID orderings: Claude 3.x
// puts the generation digit before the family name (claude-3-opus-...),
// while 4.x+ puts the family name first (claude-opus-4-...).
const MODEL_PRICING: Array<[string, { input: number; output: number; cacheRead: number; cacheWrite: number }]> = [
  ["claude-opus-4-8",   { input: 5,    output: 25,   cacheRead: 0.50,  cacheWrite: 6.25  }],
  ["claude-opus-4-1",   { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-3-5-sonnet", { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-3-5-haiku",  { input: 0.80, output: 4,    cacheRead: 0.08,  cacheWrite: 1.00  }],
  ["claude-3-opus",     { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-3-sonnet",   { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-3-haiku",    { input: 0.25, output: 1.25, cacheRead: 0.03,  cacheWrite: 0.30  }],
  ["claude-opus-4",     { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-sonnet-5",   { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-sonnet-4",   { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-haiku-4-5",  { input: 1,    output: 5,    cacheRead: 0.10,  cacheWrite: 1.25  }],
  ["claude-fable-5",    { input: 10,   output: 50,   cacheRead: 1.00,  cacheWrite: 12.50 }],
];
const DEFAULT_PRICING = { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 };

function pricingForModel(model: string = "") {
  for (const [prefix, p] of MODEL_PRICING) {
    if (model.startsWith(prefix)) { return p; }
  }
  return DEFAULT_PRICING;
}

/** Today's usage totals for a single source. */
export interface DailyUsage {
  costUsd: number;
  hourlyCostUsd: number;
  tokens: number;
  messageCount: number;
}

/** Epoch ms of local midnight at the start of the day containing `nowMs`. */
export function localDayStartMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Local calendar date ("YYYY-MM-DD") for `nowMs` — the key "today" is measured by. */
export function localDateKey(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Transcript files under one project dir: top-level *.jsonl plus <session>/subagents/*.jsonl. */
function listTranscripts(projPath: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(projPath, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(projPath, e.name);
    if (e.isFile() && e.name.endsWith(".jsonl")) {
      out.push(p);
    } else if (e.isDirectory()) {
      const subDir = path.join(p, "subagents");
      try {
        for (const f of fs.readdirSync(subDir)) {
          if (f.endsWith(".jsonl")) { out.push(path.join(subDir, f)); }
        }
      } catch { /* no subagents dir */ }
    }
  }
  return out;
}

interface UsageEntry {
  usage: Record<string, number | undefined>;
  model: string;
  tsMs: number | null;
}

/**
 * Scan Claude Code transcripts and return today's usage totals (local calendar day).
 *
 * - "Today" starts at local midnight, compared against each message's parsed
 *   timestamp, so a session running across midnight is split at the user's
 *   midnight rather than UTC's.
 * - Claude Code writes one JSONL line per content block, each repeating the
 *   message's usage (earlier lines may carry partial output_tokens). Lines are
 *   deduplicated by message.id + requestId; the last line seen wins.
 * - Subagent (Task) transcripts under <session>/subagents/ are included.
 */
export function scanClaudeCodeDailyUsage(
  projsDir: string = path.join(os.homedir(), ".claude", "projects"),
  nowMs: number = Date.now()
): DailyUsage {
  const dayStartMs = localDayStartMs(nowMs);
  const oneHourAgoMs = nowMs - 3_600_000;
  const byId = new Map<string, UsageEntry>();   // "msgId:requestId" -> entry (last line wins)
  const anonymous: UsageEntry[] = [];           // lines without a message id — counted as-is

  let projects: string[];
  try { projects = fs.readdirSync(projsDir); } catch { projects = []; }
  for (const proj of projects) {
    for (const fp of listTranscripts(path.join(projsDir, proj))) {
      try {
        if (fs.statSync(fp).mtimeMs < dayStartMs) { continue; }
      } catch { continue; }
      let lines: string[];
      try { lines = fs.readFileSync(fp, "utf8").trim().split("\n"); } catch { continue; }
      for (const line of lines) {
        try {
          const d = JSON.parse(line);
          if (d.type !== "assistant" || !d.message?.usage) { continue; }
          let tsMs: number | null = null;
          if (d.timestamp) {
            tsMs = Date.parse(d.timestamp);
            if (Number.isNaN(tsMs) || tsMs < dayStartMs) { continue; }
          }
          const entry: UsageEntry = { usage: d.message.usage, model: d.message.model ?? "", tsMs };
          if (d.message.id) { byId.set(`${d.message.id}:${d.requestId ?? ""}`, entry); }
          else { anonymous.push(entry); }
        } catch { /* skip malformed lines */ }
      }
    }
  }

  let costUsd = 0, hourlyCostUsd = 0, tokens = 0, messageCount = 0;
  for (const { usage: u, model, tsMs } of [...byId.values(), ...anonymous]) {
    const p = pricingForModel(model);
    const inp = u.input_tokens ?? 0;
    const out = u.output_tokens ?? 0;
    const cr  = u.cache_read_input_tokens ?? 0;
    const cc  = u.cache_creation_input_tokens ?? 0;
    const entryCost = (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000;
    costUsd      += entryCost;
    tokens       += inp + out + cr + cc;
    messageCount += 1;
    if (tsMs !== null && tsMs >= oneHourAgoMs) { hourlyCostUsd += entryCost; }
  }

  return { costUsd, hourlyCostUsd, tokens, messageCount };
}
