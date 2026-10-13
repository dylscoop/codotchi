/**
 * usageBackfill.ts
 *
 * Pure helper for computing accumulated cost + token usage from a list of
 * raw OpenCode message objects. Extracted from index.ts so that it can be
 * unit-tested without mocking the full plugin client.
 */

/** Minimal shape of a message entry as returned by client.session.messages() */
export interface RawMessageEntry {
  info: {
    role: string;
    cost?: number;
    tokens?: {
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: { read?: number; write?: number };
    };
    // UserMessage has time: { created: number } with no completed field;
    // AssistantMessage has time: { created: number; completed?: number }.
    // We accept both via an index signature.
    time?: { completed?: number; [key: string]: unknown };
  };
}

export interface UsageTotals {
  costUSD:  number;
  tokens:   number;
  /** Count of completed assistant messages included in this total (used to compute tokens/message averages). */
  messages: number;
}

/** A single completed assistant message's cost + tokens, with its completion timestamp. */
export interface TimestampedUsageEntry {
  completedAt: number;
  costUSD:     number;
  tokens:      number;
}


/**
 * Sum cost and tokens across all completed assistant messages in `messages`.
 *
 * Rules:
 *  - Only messages with role === "assistant" are counted.
 *  - Only messages where info.time.completed is set (non-zero truthy) are
 *    counted — this filters out partially-streamed in-progress messages.
 *  - cost defaults to 0 if missing or NaN (covers GitHub Copilot which bills
 *    $0 per-token).
 *  - token fields default to 0 if missing.
 *  - `messages` counts how many entries were included in the totals above —
 *    used by callers to compute a tokens-per-message average.
 *  - When `sinceMs` is given, only messages with time.completed >= sinceMs are
 *    counted — so a session that spans midnight contributes only today's
 *    messages to today's total.
 */
export function sumCompletedAssistantUsage(messages: RawMessageEntry[], sinceMs?: number): UsageTotals {
  let costUSD  = 0;
  let tokens   = 0;
  let msgCount = 0;

  for (const m of messages) {
    const info = m.info;
    if (info.role !== "assistant")  { continue; }
    if (!info.time?.completed)      { continue; }
    if (sinceMs !== undefined && info.time.completed < sinceMs) { continue; }

    const cost = typeof info.cost === "number" && !isNaN(info.cost) ? info.cost : 0;
    const t    = (info.tokens?.input          ?? 0)
               + (info.tokens?.output         ?? 0)
               + (info.tokens?.reasoning      ?? 0)
               + (info.tokens?.cache?.read    ?? 0)
               + (info.tokens?.cache?.write   ?? 0);

    costUSD  += cost;
    tokens   += t;
    msgCount += 1;
  }

  return { costUSD, tokens, messages: msgCount };
}

/**
 * Extract per-message timestamped cost + token data from a list of raw messages.
 *
 * Returns one entry per completed assistant message, carrying its `completedAt`
 * Unix-ms timestamp. Used to populate the rolling last-1h cost buffer.
 */
export function extractTimestampedUsage(messages: RawMessageEntry[]): TimestampedUsageEntry[] {
  const entries: TimestampedUsageEntry[] = [];

  for (const m of messages) {
    const info = m.info;
    if (info.role !== "assistant")  { continue; }
    if (!info.time?.completed)      { continue; }

    const cost = typeof info.cost === "number" && !isNaN(info.cost) ? info.cost : 0;
    const t    = (info.tokens?.input          ?? 0)
               + (info.tokens?.output         ?? 0)
               + (info.tokens?.reasoning      ?? 0)
               + (info.tokens?.cache?.read    ?? 0)
               + (info.tokens?.cache?.write   ?? 0);

    entries.push({ completedAt: info.time.completed as number, costUSD: cost, tokens: t });
  }

  return entries;
}

/** SQL columns summing today's assistant usage from a row set exposing `data` JSON. */
const USAGE_COLUMNS = `
    CAST(json_extract(data,'$.cost') AS REAL) AS cost,
    COALESCE(json_extract(data,'$.tokens.input'),0) +
    COALESCE(json_extract(data,'$.tokens.output'),0) +
    COALESCE(json_extract(data,'$.tokens.reasoning'),0) +
    COALESCE(json_extract(data,'$.tokens.cache.read'),0) +
    COALESCE(json_extract(data,'$.tokens.cache.write'),0) AS tokens`;

/**
 * Queries for today's cross-project assistant usage, most complete first.
 * OpenCode 2 stores messages in `session_message` (type column, no role in data);
 * OpenCode 1 used `message`. The first query sums both; the second is the
 * fallback for databases that have no `session_message` table yet.
 * Filters on message-level time.completed so cross-day sessions only count
 * their today-messages.
 */
export function buildDailyUsageQueries(todayStartMs: number): string[] {
  const done = `json_extract(data,'$.time.completed') IS NOT NULL
      AND CAST(json_extract(data,'$.time.completed') AS INTEGER) >= ${Math.floor(todayStartMs)}`;
  const v1 = `SELECT ${USAGE_COLUMNS} FROM message WHERE json_extract(data,'$.role') = 'assistant' AND ${done}`;
  const v2 = `SELECT ${USAGE_COLUMNS} FROM session_message WHERE type = 'assistant' AND ${done}`;
  const total = (rows: string) =>
    `SELECT ROUND(SUM(cost), 6) AS costUSD, SUM(tokens) AS tokens, COUNT(*) AS messages FROM (${rows})`;
  return [total(`${v1} UNION ALL ${v2}`), total(v1)];
}
