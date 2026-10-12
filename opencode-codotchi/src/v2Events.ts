/**
 * v2Events.ts
 *
 * Translates OpenCode V2 server events (ctx.event.subscribe) into the V1
 * plugin event shapes ({ type, properties }) that the shared event handler in
 * index.ts understands.
 *
 * V2 has no equivalent for todo.updated, so todo celebrations are V1-only.
 */

export type LegacyEvent = { type: string; properties: Record<string, unknown> };

export type V2EventLike = { type: string; id?: string; created?: number; data?: any };

const IGNORED_FS_PATH = /(^|[\\/])(\.git|node_modules|\.opencode)([\\/]|$)/;

export function translateV2Event(event: V2EventLike): LegacyEvent[] {
  const data = event.data ?? {};
  switch (event.type) {
    case "server.connected":
    case "session.idle":
      return [{ type: event.type, properties: data }];
    case "session.created":
      return [{ type: "session.created", properties: { info: data } }];
    case "session.status":
      // V1 only emitted session.status while work was running; V2 also reports idle.
      return data.status?.type === "idle" ? [] : [{ type: "session.status", properties: data }];
    case "vcs.branch.updated":
      return [{ type: "vcs.branch.updated", properties: { branch: data.branch } }];
    case "filesystem.changed":
      if (data.event === "unlink" || typeof data.file !== "string" || IGNORED_FS_PATH.test(data.file)) { return []; }
      return [{ type: "file.edited", properties: { file: data.file } }];
    case "session.inbox.enqueued":
      return data.item?.type === "user"
        ? [{ type: "message.updated", properties: { info: { role: "user", id: data.inboxID } } }]
        : [];
    case "session.step.ended": {
      // One V2 step corresponds to one V1 assistant message (one model call).
      const out: LegacyEvent[] = [];
      if (Array.isArray(data.files) && data.files.length > 0) {
        out.push({ type: "session.diff", properties: { diff: data.files } });
      }
      out.push({
        type: "message.updated",
        properties: {
          info: {
            role: "assistant",
            id: event.id ?? `${data.assistantMessageID}:${event.created}`,
            cost: data.cost,
            tokens: data.tokens,
            time: { completed: typeof event.created === "number" && event.created > 1e12 ? event.created : Date.now() },
          },
        },
      });
      return out;
    }
    default:
      return [];
  }
}
