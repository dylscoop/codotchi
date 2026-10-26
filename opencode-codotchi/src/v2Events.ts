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
      // V1 only emitted session.status while work was running; V2 reports idle
      // here too, which is V1's session.idle.
      return data.status?.type === "idle"
        ? [{ type: "session.idle", properties: { sessionID: data.sessionID } }]
        : [{ type: "session.status", properties: data }];
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
            providerID: data.model?.providerID ?? data.providerID,
            modelID: data.model?.id ?? data.modelID,
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

const ANSI = /\x1b\[[0-9;]*m/g;
const PET_HEADER = /^\s*(?:[^\x00-\x7F]+\s)?(.+?) \[[a-z]+\] \[(VS Code|PyCharm|OpenCode)\]\s*$/;

/**
 * Reduce a queued V1 notification (speech-bubble art or a plain "[IDE] Name: text"
 * line) to a short toast: the pet as title and the bubble text as message.
 */
export function summariseNotification(raw: string): { title?: string; message: string } {
  const lines = raw.replace(ANSI, "").split(/\r?\n/);
  let title: string | undefined;
  const parts: string[] = [];
  let col = -1;
  for (const line of lines) {
    const header = line.match(PET_HEADER);
    if (header && title === undefined) { title = `${header[1].trim()} [${header[2]}]`; continue; }
    if (col < 0) {
      const top = line.search(/_{3,}\s*$/);
      if (top >= 0) { col = top; }
      continue;
    }
    if (line.includes("\u203e")) { col = -1; continue; }
    const seg = line.slice(Math.max(0, col - 1)).trim();
    const inner = seg.replace(/^[<\/|\\]\s?/, "").replace(/\s?[>\/|\\]$/, "").trim();
    if (inner) { parts.push(inner); }
  }
  if (parts.length > 0) { return { title, message: parts.join(" ") }; }
  const plain = lines.map(l => l.trim()).filter(Boolean);
  const last = plain[plain.length - 1] ?? "";
  const m = last.match(/^\[(VS Code|PyCharm|OpenCode)\] ([^:]+): (.+)$/);
  if (m) { return { title: title ?? `${m[2]} [${m[1]}]`, message: m[3] }; }
  return { title, message: last.replace(/^\[codotchi\]\s*/, "") };
}
