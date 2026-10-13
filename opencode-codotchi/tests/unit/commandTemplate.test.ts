/**
 * commandTemplate.test.ts
 *
 * Guards that the /codotchi command registered via the plugin config hook
 * (npm install path) stays identical to commands/codotchi.md (installer path).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs   from "fs";
import * as path from "path";
import { CODOTCHI_COMMAND_DESCRIPTION, CODOTCHI_COMMAND_TEMPLATE } from "../../src/commandTemplate";

const mdPath = path.resolve(__dirname, "..", "..", "..", "commands", "codotchi.md");

describe("commandTemplate", () => {
  it("matches commands/codotchi.md (run scripts/gen-command-template.js if this fails)", () => {
    const md = fs.readFileSync(mdPath, "utf8").replace(/\r\n/g, "\n");
    const parts = md.split(/^---\n/m);
    const desc = ((parts[1].match(/^description:\s*(.+)$/m) || [])[1] || "").trim();
    const body = parts.slice(2).join("---\n").trimEnd();
    assert.equal(CODOTCHI_COMMAND_DESCRIPTION, desc);
    assert.equal(CODOTCHI_COMMAND_TEMPLATE, body);
  });

  it("contains no $<digit> sequences (OpenCode substitutes them as positional arguments)", () => {
    assert.doesNotMatch(CODOTCHI_COMMAND_TEMPLATE, /\$\d/);
  });
});
