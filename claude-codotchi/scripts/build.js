#!/usr/bin/env node
// Compiles src/gameEngine.ts and src/asciiArt.ts to dist/ using tsc.
// Run from claude-codotchi/: node scripts/build.js

import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

console.log("Building claude-codotchi shared modules...");
execSync("npx tsc", { cwd: root, stdio: "inherit" });
console.log("Done. Output in dist/");
