/**
 * pluginContract.test.ts
 *
 * Regression tests for the OpenCode plugin loader contract.
 *
 * These tests reproduce the exact logic used by OpenCode's plugin loader
 * (packages/opencode/src/plugin/index.ts → getLegacyPlugins) and assert that:
 *
 *   1. Every exported value from the BUNDLED plugin is a callable plugin
 *      function — no "Plugin export is not a function" crash.
 *   2. Invoking all exported plugin functions produces ZERO undefined entries
 *      in the hooks list — no config-hook crash
 *      ("undefined is not an object (evaluating 'hook.config')").
 *   3. The config-hook loop (hook.config?.(cfg)) runs without throwing.
 *   4. All real OpenCode event types survive the event hook.
 *   5. experimental.text.complete and tool.execute.after run without throwing.
 *   6. The SOURCE index.ts exports only plugin-safe values
 *      (guards against future stray re-exports that would break on reload).
 *
 * Run with:
 *   bun test tests/unit/pluginContract.test.ts
 *   (from opencode-codotchi/)
 *
 * The bundle (dist-plugin/codotchi.js) must be built before running:
 *   node scripts/bundle-plugin.js
 */

import { describe, it, expect, beforeAll } from "bun:test";
import * as path from "path";

// ---------------------------------------------------------------------------
// Loader-contract helpers — exact copies from OpenCode's getLegacyPlugins
// ---------------------------------------------------------------------------

type PluginFn = (input: unknown) => Promise<unknown>;

function getServerPlugin(value: unknown): PluginFn | undefined {
  if (typeof value === "function") return value as PluginFn;
  if (!value || typeof value !== "object" || !("server" in value)) return undefined;
  if (typeof (value as { server: unknown }).server !== "function") return undefined;
  return (value as { server: PluginFn }).server;
}

/**
 * Replicate OpenCode's getLegacyPlugins: iterate every export of the module,
 * skip duplicates (same-reference dedup), and assert each unique value is
 * a plugin function.  Throws TypeError on the first non-function export —
 * same as the real loader.
 */
function getLegacyPlugins(mod: Record<string, unknown>): PluginFn[] {
  const seen = new Set<unknown>();
  const result: PluginFn[] = [];
  for (const entry of Object.values(mod)) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    const plugin = getServerPlugin(entry);
    if (!plugin) throw new TypeError("Plugin export is not a function");
    result.push(plugin);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shared plugin fixtures loaded once for all tests
// ---------------------------------------------------------------------------

const BUNDLE_PATH = path.resolve(import.meta.dir, "../../dist-plugin/codotchi.js");
const SOURCE_PATH = path.resolve(import.meta.dir, "../../src/index.ts");

type Hooks = Record<string, unknown>;

/** Minimal PluginInput stub — enough for the plugin initialiser to run. */
const pluginInput = {
  client:    {},
  project:   { id: "test-project" },
  worktree:  process.cwd(),
  directory: process.cwd(),
  serverUrl: new URL("http://localhost:4096"),
  $:         undefined,
};

let bundleMod: Record<string, unknown>;
let sourceMod: Record<string, unknown>;
let hooksList: Hooks[];

beforeAll(async () => {
  // Load both the bundle and the source module once.
  // The bundle import uses a file:// URL to force ESM resolution from the path.
  bundleMod = await import(`file://${BUNDLE_PATH.replace(/\\/g, "/")}`);
  sourceMod = await import(SOURCE_PATH);

  // Invoke the plugin(s) to obtain the hooks list (same flow as the real loader).
  const plugins = getLegacyPlugins(bundleMod);
  hooksList = [];
  for (const p of plugins) {
    hooksList.push(await p(pluginInput) as Hooks);
  }
});

// ---------------------------------------------------------------------------
// Suite 1 — Bundled plugin: loader contract
// ---------------------------------------------------------------------------

describe("bundled plugin — loader contract (BUGFIX-119)", () => {
  it("every exported value is a plugin function (no 'Plugin export is not a function')", () => {
    // getLegacyPlugins throws if any export is not a function — calling it here
    // is the assertion itself.
    expect(() => getLegacyPlugins(bundleMod)).not.toThrow();
  });

  it("invoking all exports produces zero undefined hook entries", async () => {
    const undefinedCount = hooksList.filter(h => h === undefined || h === null).length;
    expect(undefinedCount).toBe(0);
  });

  it("config-hook loop does not throw (exact OpenCode crash site)", async () => {
    const cfg = {};
    let threw = false;
    for (const hook of hooksList) {
      try {
        await Promise.resolve((hook as any).config?.(cfg));
      } catch {
        threw = true;
      }
    }
    expect(threw).toBe(false);
  });

  it("exactly one hooks object is produced", () => {
    expect(hooksList.length).toBe(1);
  });

  it("hooks object has an event handler", () => {
    expect(typeof hooksList[0]?.["event"]).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Source index.ts: no non-plugin exports
// ---------------------------------------------------------------------------

describe("source index.ts — export safety guard (BUGFIX-119A)", () => {
  it("exports only a default definition (no stray helper exports)", () => {
    // V1 loaders treat every named export as a plugin, so helpers must stay private.
    expect(Object.keys(sourceMod)).toEqual(["default"]);
  });

  it("default export satisfies both the V1 and V2 loader contracts", () => {
    const def = sourceMod.default as { id?: unknown; setup?: unknown; server?: unknown };
    expect(typeof def).toBe("object");
    expect(def.id).toBe("codotchi");
    expect(typeof def.setup).toBe("function");
    expect(typeof def.server).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — All real OpenCode event types run without throwing
// ---------------------------------------------------------------------------

describe("event hook — all OpenCode event types (BUGFIX-119)", () => {
  const realEvents = [
    { type: "server.connected",    properties: {} },
    { type: "session.created",     properties: { info: {} } },
    { type: "session.updated",     properties: { info: {} } },
    { type: "session.deleted",     properties: { info: {} } },
    { type: "session.idle",        properties: { sessionID: "s1" } },
    { type: "session.status",      properties: { sessionID: "s1", status: "idle" } },
    { type: "session.diff",        properties: { sessionID: "s1", diff: [] } },
    { type: "session.diff",        properties: { sessionID: "s1", diff: [{}] } },
    { type: "session.error",       properties: { sessionID: "s1" } },
    { type: "session.compacted",   properties: { sessionID: "s1" } },
    { type: "file.edited",         properties: { file: "src/foo.ts" } },
    { type: "file.watcher.updated",properties: { file: "x.ts", event: "change" } },
    { type: "todo.updated",        properties: { sessionID: "s1", todos: [] } },
    { type: "todo.updated",        properties: { sessionID: "s1", todos: [
        { id: "1", status: "completed",  content: "fix bug", priority: "high" },
        { id: "2", status: "in_progress",content: "add feat",priority: "medium" },
        { id: "3", status: "cancelled",  content: "skip",    priority: "low" },
    ]}},
    { type: "vcs.branch.updated",  properties: { branch: "main" } },
    { type: "vcs.branch.updated",  properties: { branch: "feat/cool" } },
    { type: "vcs.branch.updated",  properties: {} },
    { type: "message.updated",     properties: { info: { role: "user" } } },
    { type: "message.updated",     properties: { info: { role: "assistant" } } },
    { type: "message.removed",     properties: { sessionID: "s1", messageID: "m1" } },
    { type: "message.part.updated",properties: {} },
    { type: "message.part.removed",properties: {} },
    { type: "permission.asked",    properties: {} },
    { type: "permission.replied",  properties: {} },
    { type: "command.executed",    properties: {} },
    { type: "tui.prompt.append",   properties: { text: "hi" } },
    { type: "tui.command.execute", properties: { command: "session.list" } },
    { type: "tui.toast.show",      properties: { message: "hi", variant: "info" } },
    { type: "pty.created",         properties: { info: {} } },
    { type: "pty.updated",         properties: { info: {} } },
    { type: "pty.exited",          properties: { id: "p1", exitCode: 0 } },
    { type: "pty.deleted",         properties: { id: "p1" } },
    { type: "installation.updated",properties: {} },
    { type: "unknown.future.event",properties: {} },
  ];

  for (const event of realEvents) {
    it(`does not throw for event type "${event.type}"`, async () => {
      const hook = hooksList[0];
      const eventHandler = hook?.["event"] as ((input: { event: unknown }) => Promise<void>) | undefined;
      if (!eventHandler) return; // no event hook is also fine
      let threw = false;
      try {
        await eventHandler({ event });
      } catch {
        threw = true;
      }
      expect(threw).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 4 — Hook-specific smoke tests
// ---------------------------------------------------------------------------

describe("tool.execute.after hook", () => {
  it("does not throw for tool='codotchi'", async () => {
    const hook = hooksList[0];
    const fn = hook?.["tool.execute.after"] as
      ((input: unknown, output: { title: string; output: string; metadata: unknown }) => Promise<void>) | undefined;
    if (!fn) return;
    const out = { title: "", output: "", metadata: {} };
    let threw = false;
    try {
      await fn({ tool: "codotchi", sessionID: "s", callID: "c", args: {} }, out);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(typeof out.output).toBe("string");
  });

  it("does not throw for an unrelated tool", async () => {
    const hook = hooksList[0];
    const fn = hook?.["tool.execute.after"] as
      ((input: unknown, output: { title: string; output: string; metadata: unknown }) => Promise<void>) | undefined;
    if (!fn) return;
    const out = { title: "", output: "some output", metadata: {} };
    let threw = false;
    try {
      await fn({ tool: "read", sessionID: "s", callID: "c", args: {} }, out);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    // output unchanged for non-codotchi tools
    expect(out.output).toBe("some output");
  });
});

describe("codotchi tool execute", () => {
  it("status action returns a non-empty string without throwing", async () => {
    const hook = hooksList[0];
    const toolDef = (hook?.["tool"] as Record<string, unknown>)?.["codotchi"] as
      { execute: (args: { action: string }, ctx: unknown) => Promise<string> } | undefined;
    if (!toolDef) return;
    const ctx = {
      sessionID: "s", messageID: "m", agent: "a",
      directory: process.cwd(), worktree: process.cwd(),
      abort: new AbortController().signal,
      metadata: () => {},
      ask: async () => {},
    };
    const result = await toolDef.execute({ action: "status" }, ctx);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 � OpenCode V2 loader contract (Plugin.define shape + setup)
// ---------------------------------------------------------------------------

type V2Tool = { name: string; input: unknown; execute: (input: unknown, ctx: unknown) => Promise<{ content: string }> };

function makeV2Context(events: unknown[]) {
  const tools: V2Tool[] = [];
  let subscribed = false;
  const rpc: { handlers?: Record<string, () => Promise<any>>; emitted: Array<{ name: string; data: any }> } = { emitted: [] };
  const ctx = {
    app: { version: "2.0.0-test" },
    location: { directory: process.cwd(), project: { id: "test", directory: process.cwd(), canonical: process.cwd() } },
    options: {},
    rpc: {
      register: async (def: { id: string }, handlers: Record<string, () => Promise<any>>) => {
        expect(def.id).toBe("codotchi");
        rpc.handlers = handlers;
        return {
          events: { emit: async (name: string, data: any) => { rpc.emitted.push({ name, data }); } },
          dispose: async () => {},
        };
      },
    },
    tool: {
      transform: async (cb: (editor: { add: (t: V2Tool) => void }) => void) => {
        cb({ add: (t) => tools.push(t) });
        return { dispose: async () => {} };
      },
    },
    event: {
      subscribe: ({ signal }: { signal?: AbortSignal } = {}) => {
        subscribed = true;
        return (async function* () {
          for (const e of events) {
            if (signal?.aborted) return;
            yield e;
          }
        })();
      },
    },
  };
  return { ctx, tools, rpc, isSubscribed: () => subscribed };
}

describe("bundled plugin � OpenCode V2 loader contract", () => {
  it("default export is an object with id and setup (fixes 'Expected object at [\"default\"]')", () => {
    const def = bundleMod.default as { id?: unknown; setup?: unknown };
    expect(typeof def).toBe("object");
    expect(def.id).toBe("codotchi");
    expect(typeof def.setup).toBe("function");
  });

  it("setup registers the codotchi tool, consumes events, and returns cleanup", async () => {
    const v2Events = [
      { type: "server.connected", data: {} },
      { type: "session.created", id: "e1", created: Date.now(), data: { sessionID: "s1" } },
      { type: "session.inbox.enqueued", data: { sessionID: "s1", inboxID: "m1", item: { type: "user" } } },
      { type: "filesystem.changed", data: { file: "src/foo.ts", event: "change" } },
      { type: "session.step.ended", id: "e2", created: Date.now(), data: {
          sessionID: "s1", assistantMessageID: "a1", finish: "stop", cost: 0,
          tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } }, files: ["src/foo.ts"] } },
      { type: "session.status", data: { sessionID: "s1", status: { type: "busy" } } },
      { type: "session.idle", data: { sessionID: "s1" } },
      { type: "vcs.branch.updated", data: { branch: "feat/x" } },
      { type: "some.future.event", data: {} },
    ];
    const { ctx, tools, rpc, isSubscribed } = makeV2Context(v2Events);
    const def = bundleMod.default as { setup: (ctx: unknown) => Promise<(() => void) | void> };
    const cleanup = await def.setup(ctx);
    expect(typeof cleanup).toBe("function");
    expect(isSubscribed()).toBe(true);

    expect(tools.map(t => t.name)).toEqual(["codotchi"]);
    const result = await tools[0].execute({ action: "status" }, { signal: new AbortController().signal, progress: async () => {} });
    expect(typeof result.content).toBe("string");
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content).not.toMatch(/\x1b\[/);
    // Each pet is printed once, with whole-number stats
    expect(result.content).not.toMatch(/(Hunger|Happiness|Energy)\s*(\[[^\]]*\]\s*|:\s*)\d+\.\d/);

    await new Promise(r => setTimeout(r, 400));

    // Composer snapshot: one pet's V1 bubble (ANSI lines) + cost totals
    expect(typeof rpc.handlers?.snapshot).toBe("function");
    const snap = await rpc.handlers!.snapshot();
    expect(Array.isArray(snap.pets)).toBe(true);
    expect(snap.pets.length).toBeLessThanOrEqual(1);
    for (const pet of snap.pets) {
      expect(Array.isArray(pet.lines)).toBe(true);
      expect(pet.lines.join("\n")).toContain(pet.name);
      expect(typeof pet.message).toBe("string");
      // No blank padding rows, and the tier emoji lives on the cost line, not the art
      for (const line of pet.lines) { expect(line.replace(/\x1b\[[0-9;]*m/g, "").trim().length).toBeGreaterThan(0); }
      expect(pet.lines.join("\n")).not.toMatch(/🟢|🟡|🔴/);
      // Costs live on the line under the pet, not in the bubble
      expect(pet.message).not.toMatch(/\$\d|tokens per message/);
    }
    // The shown pet and its speech stay stable until a reply finishes
    const again = await rpc.handlers!.snapshot();
    expect(JSON.stringify(again.pets)).toBe(JSON.stringify(snap.pets));
    expect(["green", "yellow", "red"]).toContain(snap.tier);
    expect(typeof snap.today.costUSD).toBe("number");
    expect(typeof snap.lastHour.costUSD).toBe("number");
    expect(typeof snap.session.costUSD).toBe("number");
    expect(typeof snap.thresholds.warn).toBe("number");
    // Events processed → an "updated" push with the same shape
    expect(rpc.emitted.some(e => e.name === "updated" && Array.isArray(e.data.pets))).toBe(true);

    (cleanup as () => void)();
  });
});

describe("translateV2Event", () => {
  let translate: (e: unknown) => Array<{ type: string; properties: any }>;
  beforeAll(async () => {
    translate = (await import(path.resolve(import.meta.dir, "../../src/v2Events.ts"))).translateV2Event;
  });

  it("maps step.ended to an assistant message.updated with cost and tokens", () => {
    const now = Date.now();
    const out = translate({ type: "session.step.ended", id: "e9", created: now, data: {
      assistantMessageID: "a", cost: 0.5, tokens: { input: 1, output: 2, reasoning: 0, cache: { read: 0, write: 0 } } } });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("message.updated");
    expect(out[0].properties.info).toMatchObject({ role: "assistant", id: "e9", cost: 0.5, time: { completed: now } });
  });

  it("emits session.diff when a step changed files", () => {
    const out = translate({ type: "session.step.ended", data: { files: ["a.ts"], cost: 0, tokens: {} } });
    expect(out.map(e => e.type)).toEqual(["session.diff", "message.updated"]);
  });

  it("maps user inbox items to user message.updated and ignores synthetic ones", () => {
    expect(translate({ type: "session.inbox.enqueued", data: { item: { type: "user" } } })[0].properties.info.role).toBe("user");
    expect(translate({ type: "session.inbox.enqueued", data: { item: { type: "synthetic" } } })).toEqual([]);
  });

  it("maps filesystem changes to file.edited but ignores .git, node_modules and deletions", () => {
    expect(translate({ type: "filesystem.changed", data: { file: "src/a.ts", event: "change" } })[0].type).toBe("file.edited");
    expect(translate({ type: "filesystem.changed", data: { file: ".git/HEAD", event: "change" } })).toEqual([]);
    expect(translate({ type: "filesystem.changed", data: { file: "node_modules/x/y.js", event: "add" } })).toEqual([]);
    expect(translate({ type: "filesystem.changed", data: { file: "src/a.ts", event: "unlink" } })).toEqual([]);
  });

  it("drops idle session.status and unknown events", () => {
    expect(translate({ type: "session.status", data: { status: { type: "idle" } } })).toEqual([]);
    expect(translate({ type: "session.status", data: { status: { type: "busy" } } })[0].type).toBe("session.status");
    expect(translate({ type: "nope", data: {} })).toEqual([]);
  });
});

describe("summariseNotification (toasts)", () => {
  let summarise: (raw: string) => { title?: string; message: string };
  beforeAll(async () => {
    summarise = (await import(path.resolve(import.meta.dir, "../../src/v2Events.ts"))).summariseNotification;
  });

  it("extracts pet and text from a single-line speech bubble", () => {
    const raw = [
      "",
      " Mind Goblin Jr [teen] [PyCharm]",
      "  #(-_-)#          ______________________________ ",
      "  o-| |-o    -->  < I feel rested! Time to code! >",
      "    | |            \u203e\u203e\u203e\u203e\u203e\u203e\u203e\u203e\u203e\u203e ",
      "   /   \\          ",
    ].join("\n");
    expect(summarise(raw)).toEqual({ title: "Mind Goblin Jr [PyCharm]", message: "I feel rested! Time to code!" });
  });

  it("joins multi-line bubbles and ignores emoji prefixes", () => {
    const raw = [
      " \u{1F7E1} Copilot [senior] [OpenCode]",
      " U(-_-)U           __________________________________________ ",
      "  ~| | |~    -->  / Hi! I'm Copilot. I live in OpenCode \u2014 no \\",
      " ~ | | | ~        \\ IDE needed.                              /",
      "   |___|           \u203e\u203e\u203e\u203e\u203e ",
    ].join("\n");
    expect(summarise(raw)).toEqual({ title: "Copilot [OpenCode]", message: "Hi! I'm Copilot. I live in OpenCode \u2014 no IDE needed." });
  });

  it("handles plain-text notifications", () => {
    expect(summarise("[VS Code] Wee Stu: Let's build something.")).toEqual({ title: "Wee Stu [VS Code]", message: "Let's build something." });
    expect(summarise("[codotchi] [PyCharm] Mind Goblin Jr made a mess! (use /codotchi clean)").message)
      .toBe("[PyCharm] Mind Goblin Jr made a mess! (use /codotchi clean)");
  });

  it("strips ANSI colour codes", () => {
    expect(summarise("\x1b[33m[VS Code] Wee Stu: Hungry.\x1b[0m").message).toBe("Hungry.");
  });
});
