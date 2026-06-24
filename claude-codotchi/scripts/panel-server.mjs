/**
 * panel-server.mjs — local HTTP + SSE server for the Claude Code desktop panel.
 *
 * Serves the static panel/ directory and pushes pet state updates to connected
 * browsers via Server-Sent Events (SSE). Designed to run as a detached daemon
 * spawned by hook-panel-start.mjs on SessionStart.
 *
 * Port: CODOTCHI_PANEL_PORT env (default 39847).
 * Lock: $CLAUDE_PLUGIN_DATA/panel-lock.json  { pid, port }
 */

import http from "http";
import fs   from "fs";
import path from "path";
import os   from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = path.join(__dirname, "..", "panel");

const BASE_PORT = parseInt(process.env.CODOTCHI_PANEL_PORT || "39847", 10);

function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), ".codotchi", "claude");
}

const STATE_FILE = path.join(dataDir(), "codotchi-state.json");
const LOCK_FILE  = path.join(dataDir(), "panel-lock.json");

// ── SSE client registry ───────────────────────────────────────────────────
const clients = new Set();

function broadcast(payload) {
  const data = "data: " + JSON.stringify(payload) + "\n\n";
  for (const res of clients) {
    try { res.write(data); }
    catch { clients.delete(res); }
  }
}

// ── State watching ─────────────────────────────────────────────────────────
function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const file = JSON.parse(raw);
    return file && file.state ? { source: "claude", state: file.state } : null;
  } catch {
    return null;
  }
}

let debounce = null;
function onStateChange() {
  if (debounce !== null) clearTimeout(debounce);
  debounce = setTimeout(() => {
    debounce = null;
    const payload = readState();
    if (payload) broadcast(payload);
  }, 150);
}

// Watch the data directory so we catch the file appearing for the first time
try {
  fs.watch(dataDir(), { persistent: true }, (event, filename) => {
    if (filename && filename.includes("codotchi-state")) onStateChange();
  });
} catch {
  // dataDir might not exist yet — we'll catch writes via poll fallback
}

// Fallback poll every 15s for environments where fs.watch is unreliable
setInterval(() => { const p = readState(); if (p) broadcast(p); }, 15_000).unref();

// ── MIME map ───────────────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".png":  "image/png",
  ".ico":  "image/x-icon",
  ".map":  "application/json",
};

// ── HTTP request handler ───────────────────────────────────────────────────
function handleRequest(req, res) {
  // CORS for local loads
  res.setHeader("Access-Control-Allow-Origin", "*");

  // SSE stream
  if (req.url === "/sse" || req.url === "/events") {
    res.writeHead(200, {
      "Content-Type":  "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    });
    res.write("retry: 3000\n\n");
    clients.add(res);

    // Flush current state immediately so the pane doesn't stay blank
    const payload = readState();
    if (payload) res.write("data: " + JSON.stringify(payload) + "\n\n");

    req.on("close", () => clients.delete(res));
    return;
  }

  // Graceful shutdown (used by hook-panel-stop)
  if (req.url === "/shutdown" && req.method === "POST") {
    res.writeHead(200); res.end("ok");
    cleanup(); setTimeout(() => process.exit(0), 200);
    return;
  }

  // Static file serving
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  // Sanitise: no path traversal
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PANEL_DIR, safe);

  // Ensure the resolved path is still inside PANEL_DIR
  if (!filePath.startsWith(PANEL_DIR + path.sep) && filePath !== PANEL_DIR) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext  = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

// ── Server startup with port fallback ─────────────────────────────────────
function startServer(port, attemptsLeft) {
  const server = http.createServer(handleRequest);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      startServer(port + 1, attemptsLeft - 1);
    } else {
      process.stderr.write("panel-server: " + err.message + "\n");
      process.exit(1);
    }
  });

  server.listen(port, "127.0.0.1", () => {
    const actualPort = server.address().port;

    // Write lock file
    try {
      const dir = dataDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, port: actualPort }), "utf8");
    } catch { /* non-fatal */ }

    // Tell the parent hook what port was chosen (read from stdout in tests)
    process.stdout.write(JSON.stringify({ port: actualPort }) + "\n");
  });

  return server;
}

startServer(BASE_PORT, 5);

// ── Cleanup ────────────────────────────────────────────────────────────────
function cleanup() {
  for (const res of clients) { try { res.end(); } catch {} }
  clients.clear();
  try { fs.unlinkSync(LOCK_FILE); } catch {}
}

process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("SIGINT",  () => { cleanup(); process.exit(0); });
