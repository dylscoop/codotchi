/**
 * build.mjs — compile the server and assemble the MCP App resource.
 *
 * Steps:
 *   1. tsc --noEmit  (typecheck the server sources)
 *   2. esbuild-bundle src/server.ts → dist/server.js (self-contained CJS, all
 *      deps inlined, so the .mcpb needs no node_modules).
 *   3. esbuild-bundle ui/mcp-bridge.js (imports @modelcontextprotocol/ext-apps)
 *      into a browser IIFE.
 *   4. Inline companion.css + vendor sprites + the bridge bundle + companion.js
 *      into a single self-contained dist/ui/index.html (the ui:// resource).
 *
 * Everything is inlined because an MCP App resource is a single HTML document —
 * the sandboxed iframe cannot fetch sibling files.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const uiDir = path.join(root, "ui");
const distDir = path.join(root, "dist");
const distUiDir = path.join(distDir, "ui");

function read(p) {
  return fs.readFileSync(p, "utf8");
}

/** Neutralise any literal </script> in inlined JS so it can't close the tag. */
function safeScript(js) {
  return js.replace(/<\/script/gi, "<\\/script");
}

async function main() {
  // 0. Clean.
  fs.rmSync(distDir, { recursive: true, force: true });

  // 1. Typecheck.
  console.log("• tsc --noEmit");
  execSync("npx tsc --noEmit", { cwd: root, stdio: "inherit" });

  // 2. Bundle the server (ESM sources + deps → self-contained CJS).
  console.log("• esbuild server");
  fs.mkdirSync(distDir, { recursive: true });
  await esbuild({
    entryPoints: [path.join(root, "src", "server.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    outfile: path.join(distDir, "server.mjs"),
    banner: {
      // Some CJS deps bundled into ESM expect a `require` — provide one.
      js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);",
    },
    logLevel: "warning",
  });

  // 3. Bundle the MCP App bridge (ESM → browser IIFE).
  console.log("• esbuild mcp-bridge");
  const bridge = await esbuild({
    entryPoints: [path.join(uiDir, "mcp-bridge.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    write: false,
    logLevel: "warning",
  });
  const bridgeJs = bridge.outputFiles[0].text;

  // 4. Inline everything into a single HTML document.
  console.log("• assemble dist/ui/index.html");
  let html = read(path.join(uiDir, "index.html"));

  // Use replacement FUNCTIONS so `$` sequences in the inlined JS/CSS are not
  // interpreted as String.replace special patterns.
  const inject = (tag, content) => {
    if (!html.includes(tag)) { throw new Error(`build: tag not found: ${tag}`); }
    html = html.replace(tag, () => content);
  };

  const css = read(path.join(uiDir, "companion.css"));
  inject('<link rel="stylesheet" href="companion.css" />', `<style>\n${css}\n</style>`);

  const inlineScript = (tag, filePath) => {
    inject(tag, `<script>\n${safeScript(read(filePath))}\n</script>`);
  };

  inlineScript('<script src="vendor/spriteConstants.js"></script>', path.join(uiDir, "vendor", "spriteConstants.js"));
  inlineScript('<script src="vendor/sprites.js"></script>', path.join(uiDir, "vendor", "sprites.js"));
  inlineScript('<script src="vendor/customCharacters.js"></script>', path.join(uiDir, "vendor", "customCharacters.js"));
  inject('<script src="mcp-bridge.js"></script>', `<script>\n${safeScript(bridgeJs)}\n</script>`);
  inlineScript('<script src="companion.js"></script>', path.join(uiDir, "companion.js"));

  // Sanity: no external references should remain.
  if (/src="|href="/.test(html.replace(/https?:\/\//g, ""))) {
    const leftover = html.match(/(src|href)="[^"]*"/g);
    console.warn("⚠ leftover external references:", leftover);
  }

  fs.mkdirSync(distUiDir, { recursive: true });
  fs.writeFileSync(path.join(distUiDir, "index.html"), html, "utf8");

  const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(0);
  console.log(`✓ build complete — dist/ui/index.html (${kb} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
