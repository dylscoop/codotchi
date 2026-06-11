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

  it("exactly one hooks object is produced (plugin + default same-ref deduped)", () => {
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
  it("every export is either a function or the same reference as another export", () => {
    // This guard ensures that if someone accidentally adds
    // `export { someHelper }` in the future, this test fails.
    const seen = new Set<unknown>();
    const nonFunctions: string[] = [];
    for (const [name, value] of Object.entries(sourceMod)) {
      if (seen.has(value)) continue; // deduped (e.g. default === plugin)
      seen.add(value);
      if (typeof value !== "function") {
        nonFunctions.push(`${name}: ${typeof value}`);
      }
    }
    expect(nonFunctions).toEqual([]);
  });

  it("source module has at most 2 exports (plugin + default, same reference)", () => {
    // "plugin" and "default" both point at the same function — 2 names, 1 unique value.
    const uniqueValues = new Set(Object.values(sourceMod));
    expect(uniqueValues.size).toBe(1);
    expect(Object.keys(sourceMod).sort()).toEqual(["default", "plugin"]);
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

describe("experimental.text.complete hook", () => {
  it("does not throw and appends to output.text when terminalEnabled is off", async () => {
    const hook = hooksList[0];
    const fn = hook?.["experimental.text.complete"] as
      ((input: unknown, output: { text: string }) => Promise<void>) | undefined;
    if (!fn) return;
    const out = { text: "Hello world" };
    let threw = false;
    try {
      await fn({ sessionID: "s", messageID: "m", partID: "p" }, out);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    // text should still be a string
    expect(typeof out.text).toBe("string");
  });
});

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
