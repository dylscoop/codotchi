/**
 * build.mjs — compile the server.
 *
 * Steps:
 *   1. tsc --noEmit  (typecheck the server sources)
 *   2. esbuild-bundle src/server.ts → dist/server.mjs (self-contained ESM, all
 *      deps inlined, so the .mcpb needs no node_modules).
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const distDir = path.join(root, "dist");

async function main() {
  // 0. Clean.
  fs.rmSync(distDir, { recursive: true, force: true });

  // 1. Typecheck.
  console.log("• tsc --noEmit");
  execSync("npx tsc --noEmit", { cwd: root, stdio: "inherit" });

  // 2. Bundle the server (ESM sources + deps → self-contained ESM).
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

  console.log("✓ build complete — dist/server.mjs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
