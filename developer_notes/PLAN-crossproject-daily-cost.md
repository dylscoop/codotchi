# Plan: Cross-Project Daily Cost via Direct SQLite Query

**Status:** Planned — not yet implemented  
**Branch:** will continue on `main` (hotfix, no new branch needed)  
**Relates to:** BUGFIX-132, BUGFIX-133

---

## Problem

`backfillDailyUsage()` calls `client.session.list()` which the OpenCode plugin API
scopes to the **current project directory only**. If the user worked in multiple
OpenCode windows across different projects today, the spend from all other projects
is invisible to the backfill — causing the displayed daily total to be far lower
than the actual total.

### Confirmed example (2026-06-22)

| Directory | Cost |
|---|---|
| `C:/Repositories/chronos_extra` | $23.27 |
| `C:/personal_repos/codotchi` | $22.83 |
| `C:/Repositories/chronos_local_runs` | $1.35 |
| `C:/personal_repos/ai_usage_codotchi` | $0.46 |
| **True total (from DB)** | **~$47.91** |
| **Plugin displayed** | ~$32 (codotchi project only) |

The `opencode stats` command and `agentsview` both show the correct total because
they query the OpenCode SQLite database directly — which stores all sessions across
all projects.

---

## Root Cause

```typescript
// src/index.ts — backfillDailyUsage()
const listResult = await client.session.list();   // <- returns current project only
```

The `GET /session` API endpoint filters by directory when called from inside a
plugin. There is no API parameter to request cross-project sessions.

---

## Solution

Replace the cost-total computation inside `backfillDailyUsage()` with a **direct
SQLite query** against the OpenCode database. The `costEvents` rolling 1h buffer
continues to use the existing `client.session.list()` API (it only needs the
current project's per-message timestamps for the "last 1h" display).

---

## Implementation Plan

### File changed

`opencode-codotchi/src/index.ts` — `backfillDailyUsage()` only.  
No new npm dependencies. No new files.

---

### Step 1 — Find the `opencode-cli` binary

Try these paths in order, stop at the first hit:

```typescript
function findOpencodeCli(): string | null {
  const candidates = [
    // Windows
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "opencode", "opencode-cli.exe")
      : null,
    // Linux / Mac
    path.join(os.homedir(), ".local", "share", "opencode", "opencode-cli"),
    // Generic PATH fallback (opencode main binary also has `db` subcommand)
    "opencode",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      if (c !== "opencode" && !fs.existsSync(c)) { continue; }
      const result = spawnSync(c, ["--version"], { timeout: 2000, encoding: "utf8" });
      if (result.status === 0) { return c; }
    } catch { /* try next */ }
  }
  return null;
}
```

---

### Step 2 — Get the DB path

```typescript
const pathResult = spawnSync(cli, ["db", "path"], { timeout: 3000, encoding: "utf8" });
const dbPath = pathResult.stdout?.trim();
if (!dbPath || !fs.existsSync(dbPath)) { /* skip to Track B fallback */ }
```

If the binary isn't found, the `db path` call fails, or the DB file doesn't exist
-> **silently skip Track A** and fall back to the existing API-only approach for
both cost totals and `costEvents`.

No `uvx agentsview` bootstrap — if the DB isn't there, skip gracefully.

---

### Step 3 — Query the DB for today's total (Track A)

```typescript
const todayStartMs = new Date(today + "T00:00:00.000Z").getTime();

const sql = `
  SELECT
    ROUND(SUM(CAST(json_extract(data,'$.cost') AS REAL)), 6) AS costUSD,
    SUM(
      COALESCE(json_extract(data,'$.tokens.input'),0) +
      COALESCE(json_extract(data,'$.tokens.output'),0) +
      COALESCE(json_extract(data,'$.tokens.reasoning'),0) +
      COALESCE(json_extract(data,'$.tokens.cache.read'),0) +
      COALESCE(json_extract(data,'$.tokens.cache.write'),0)
    ) AS tokens
  FROM message m
  JOIN session s ON m.session_id = s.id
  WHERE s.time_updated >= ${todayStartMs}
    AND json_extract(m.data,'$.role') = 'assistant'
    AND json_extract(m.data,'$.time.completed') IS NOT NULL
`;

const result = spawnSync(cli, ["db", "--format", "json", sql], {
  timeout: 3000,
  encoding: "utf8",
});

if (result.status === 0 && result.stdout) {
  const rows = JSON.parse(result.stdout.trim());
  const dbCostUSD = typeof rows[0]?.costUSD === "number" ? rows[0].costUSD : 0;
  const dbTokens  = typeof rows[0]?.tokens  === "number" ? rows[0].tokens  : 0;
  dailyCostUSD = Math.max(dailyCostUSD, dbCostUSD);
  dailyTokens  = Math.max(dailyTokens,  dbTokens);
}
```

**Timeout: 3 seconds.** SQLite is local disk — typical query time < 50 ms even with
700+ messages. `spawnSync` blocks the async function until done, but since
`backfillDailyUsage` itself is fire-and-forget from the plugin entry point, this is
fine — it does not block startup.

---

### Step 4 — Keep existing API loop for `costEvents` only (Track B)

The `client.session.list()` loop is **unchanged** but its result no longer sets
`dailyCostUSD` / `dailyTokens`. It only populates:
- `backfilledEvents` — messages from last 1h for the rolling buffer
- `latestBackfillTsAll` — deduplication boundary for `pendingLiveEvents` replay

```typescript
// Track B — current-project messages for last-1h costEvents buffer only
for (const s of todaySessions) {
  const messages = (await client.session.messages({ path: { id: s.id } })).data ?? [];
  const timestamped = extractTimestampedUsage(messages);
  for (const e of timestamped) {
    if (e.completedAt > latestBackfillTsAll) { latestBackfillTsAll = e.completedAt; }
    if (e.completedAt >= oneHourAgo)         { backfilledEvents.push(e); }
  }
}
// NOTE: sumCompletedAssistantUsage() is no longer called here — cost comes from DB
```

---

### Step 5 — `pendingLiveEvents` replay (unchanged)

Same as BUGFIX-133 — replay only events newer than `latestBackfillTsAll`.

---

### Step 6 — Import `spawnSync`

Add to the top of `index.ts`:

```typescript
import { spawnSync } from "child_process";
```

`child_process` is a built-in Node module — no install needed.

---

## Fallback chain (summary)

```
DB query (Track A) succeeds
  -> dailyCostUSD = Math.max(dailyCostUSD, dbTotal)   cross-project accurate

DB query fails (binary missing / DB absent / query error)
  -> dailyCostUSD = Math.max(dailyCostUSD, apiTotal)  current-project only (BUGFIX-133 behaviour)

Both fail entirely (catch block)
  -> backfillComplete = true, pendingLiveEvents drained  (unchanged emergency fallback)
```

---

## What does NOT change

- `loadDailyUsage()` / `saveDailyUsage()` — unchanged
- `checkDayRollover()` — unchanged
- `pendingLiveEvents` queueing in `message.updated` handler — unchanged
- `fs.watch` cross-window sync — unchanged
- `costEvents` / `lastHourUsage()` — unchanged
- Claude Code `state.mjs` — unchanged (reads JSONL directly; cross-project not an issue)

---

## Testing

After implementation, restart OpenCode in any project and run `/codotchi status`.
The displayed daily total should match `opencode stats` and `uvx agentsview usage statusline`
(within the cost of the current in-flight message, which completes after the backfill runs).
