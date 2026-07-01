/**
 * server.ts — MCP server entry point for Codotchi on Claude Desktop.
 *
 * Runs over stdio (the transport Claude Desktop uses for bundled `.mcpb` node
 * servers). Registers one MCP App resource (`ui://codotchi/pet`) that renders
 * the animated pixel pet, and a set of tools that mutate/read the pet and
 * return both an ASCII text fallback and structured data for the widget.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

import { readConfig } from "./state.js";
import * as tools from "./tools.js";
import type { ToolPayload } from "./tools.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_HTML_PATH = path.join(__dirname, "ui", "index.html");
const RESOURCE_URI = "ui://codotchi/pet";

const cfg = readConfig();

const INSTRUCTIONS = [
  "This server hosts 'codotchi', a Tamagotchi-style virtual pet that lives in the chat.",
  "Call the `codotchi` tool whenever the user asks to see, check on, or interact with their pet — it renders an interactive pet widget.",
  "To keep the pet happy while you work, call `codotchi_activity` roughly once per turn as you help the user (it is cheap and grants the pet a small reward).",
  "Use `codotchi_feed`, `codotchi_pat`, `codotchi_sleep`, `codotchi_clean`, and `codotchi_medicine` when the user asks to care for the pet.",
].join(" ");

const server = new McpServer(
  { name: "codotchi-desktop", version: "2.15.1" },
  { instructions: INSTRUCTIONS },
);

// ── UI resource ─────────────────────────────────────────────────────────────
registerAppResource(
  server,
  "Codotchi pet",
  RESOURCE_URI,
  { description: "Your codotchi virtual pet, rendered as an animated pixel companion." },
  async () => ({
    contents: [
      {
        uri: RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        text: fs.readFileSync(UI_HTML_PATH, "utf8"),
      },
    ],
  }),
);

// ── Tools ───────────────────────────────────────────────────────────────────
function toResult(p: ToolPayload) {
  return {
    content: [{ type: "text" as const, text: p.asciiArt }],
    structuredContent: p as unknown as Record<string, unknown>,
  };
}

function registerPetTool(
  name: string,
  title: string,
  description: string,
  handler: () => ToolPayload,
): void {
  registerAppTool(
    server,
    name,
    { title, description, _meta: { ui: { resourceUri: RESOURCE_URI } } },
    async () => toResult(handler()),
  );
}

registerPetTool("codotchi", "Show codotchi", "Show your codotchi pet in an interactive widget.", () => tools.show(cfg));
registerPetTool("codotchi_feed", "Feed codotchi", "Feed your codotchi a meal.", () => tools.feed(cfg));
registerPetTool("codotchi_pat", "Pat codotchi", "Pat your codotchi to raise happiness and discipline.", () => tools.petAction(cfg));
registerPetTool("codotchi_sleep", "Toggle sleep", "Put your codotchi to sleep, or wake it if it is already sleeping.", () => tools.sleepToggle(cfg));
registerPetTool("codotchi_clean", "Clean up", "Clean up after your codotchi.", () => tools.clean(cfg));
registerPetTool("codotchi_medicine", "Give medicine", "Give your codotchi medicine when it is sick.", () => tools.medicine(cfg));
registerPetTool("codotchi_tick", "Advance pet", "Advance the pet simulation by one tick (used by the widget to stay live).", () => tools.tick(cfg));
registerPetTool("codotchi_activity", "Register activity", "Register chat/coding activity so the pet stays happy. Call this ~once per turn while working.", () => tools.activity(cfg));

// ── Connect ─────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // stdout is reserved for the JSON-RPC transport — log to stderr only.
  console.error("[codotchi-desktop] fatal:", err);
  process.exit(1);
});
