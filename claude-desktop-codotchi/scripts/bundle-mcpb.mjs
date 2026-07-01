/**
 * bundle-mcpb.mjs — package the built server + UI into a one-click .mcpb bundle.
 *
 * A .mcpb is just a ZIP with manifest.json at the root. Because build.mjs
 * produces a self-contained dist/server.mjs (all deps inlined), the bundle only
 * needs: manifest.json, icon.png, and dist/.
 *
 * Uses adm-zip (not PowerShell Compress-Archive) so entry paths use forward
 * slashes as the ZIP spec requires — Compress-Archive on Windows PowerShell 5.1
 * emits backslashes that some extractors cannot resolve.
 *
 * Run `npm run build` first.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, "codotchi-desktop.mcpb");

const required = ["manifest.json", path.join("dist", "server.mjs"), path.join("dist", "ui", "index.html")];
for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error(`✗ missing ${rel} — run 'npm run build' first.`);
    process.exit(1);
  }
}

if (fs.existsSync(out)) { fs.rmSync(out); }

const zip = new AdmZip();
zip.addLocalFile(path.join(root, "manifest.json"));
if (fs.existsSync(path.join(root, "icon.png"))) {
  zip.addLocalFile(path.join(root, "icon.png"));
}
// addLocalFolder preserves the tree under dist/ with forward-slash separators.
zip.addLocalFolder(path.join(root, "dist"), "dist");
zip.writeZip(out);

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`✓ ${path.basename(out)} (${kb} KB)`);
