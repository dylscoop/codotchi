#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DESIGNS_DIR = path.join(ROOT, "sprite_designs");
const STAGES = ["baby", "child", "teen", "adult", "senior"];

for (const file of fs.readdirSync(DESIGNS_DIR).filter((entry) => entry.endsWith(".json"))) {
  const filePath = path.join(DESIGNS_DIR, file);
  const design = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const tileSize = design.tileSize || 160;
  const blankRow = ".".repeat(tileSize);

  for (const stage of STAGES) {
    const rows = Array.isArray(design.stages?.[stage]) ? design.stages[stage].slice() : [];
    if (rows.length > tileSize) {
      design.stages[stage] = rows.slice(rows.length - tileSize);
    } else if (rows.length < tileSize) {
      design.stages[stage] = Array(tileSize - rows.length).fill(blankRow).concat(rows);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(design, null, 2) + "\n");
}
