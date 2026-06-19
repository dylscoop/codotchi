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
  costUSD: number;
  tokens:  number;
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
 */
export function sumCompletedAssistantUsage(messages: RawMessageEntry[]): UsageTotals {
  let costUSD = 0;
  let tokens  = 0;

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

    costUSD += cost;
    tokens  += t;
  }

  return { costUSD, tokens };
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
