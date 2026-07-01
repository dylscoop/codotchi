/**
 * mcp-bridge.js — MCP App transport for the codotchi widget.
 *
 * Bundled by scripts/build.mjs (esbuild) into an inline <script> in the final
 * MCP App resource. Wraps @modelcontextprotocol/ext-apps `App` and exposes a
 * tiny `window.__codotchiBridge` that companion.js consumes in place of the
 * Server-Sent Events transport used by the Claude Code panel.
 */

import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({ name: "codotchi", version: "2.15.1" });
const dataListeners = [];
let lastPayload = null;

function emit(payload) {
  if (!payload) { return; }
  lastPayload = payload;
  for (const fn of dataListeners) {
    try { fn(payload); } catch { /* ignore listener errors */ }
  }
}

// Initial render + any model-triggered tool results the host pushes to us.
app.ontoolresult = (result) => {
  emit(result && result.structuredContent);
};

async function callTool(name) {
  try {
    const result = await app.callServerTool({ name, arguments: {} });
    const payload = result && result.structuredContent;
    emit(payload);
    return payload;
  } catch {
    return null;
  }
}

window.__codotchiBridge = {
  onData(fn) {
    dataListeners.push(fn);
    // Deliver any payload that arrived before this listener subscribed.
    if (lastPayload) { try { fn(lastPayload); } catch { /* ignore */ } }
  },
  tick() { return callTool("codotchi_tick"); },
  activity() { return callTool("codotchi_activity"); },
  action(name) { return callTool(name); },
};

app.connect();
