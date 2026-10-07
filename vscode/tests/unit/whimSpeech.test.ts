import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

// Source guards for the answered whim-call speech (play / pat / craving), which
// lives in four hosts that can't share a module.
const repo = path.join(__dirname, "../../../..");
const read = (p: string): string => fs.readFileSync(path.join(repo, p), "utf8").replace(/\r\n/g, "\n");

/** The `play:` / `pat:` / `craving:` pool lines of a WHIM_ANSWER_SPEECH block, whitespace-normalised. */
function poolLines(source: string): string[] {
  const block = source.slice(source.indexOf("WHIM_ANSWER_SPEECH = {"));
  return block.slice(0, block.indexOf("};")).split("\n")
    .filter((l) => /^\s*(play|pat|craving):/.test(l))
    .map((l) => l.trim().replace(/\s+/g, " "));
}

describe("answered whim-call speech", () => {
  const vscodeSidebar = read("vscode/media/sidebar.js");
  const pools = poolLines(vscodeSidebar);

  it("has four lines for each of play, pat and craving", () => {
    assert.equal(pools.length, 3);
    for (const l of pools) { assert.equal((l.match(/"/g) ?? []).length, 8, l); }
  });

  it("is identical in every host", () => {
    for (const p of [
      "opencode-codotchi/src/index.ts",
      "claude-codotchi/scripts/whimSpeech.mjs",
    ]) {
      assert.deepEqual(poolLines(read(p)), pools, p);
    }
  });

  // PyCharm copies vscode/media/sidebar.js at build time, so one file covers both IDEs.
  it("outranks the minigame result bubble in the IDE sidebar", () => {
    for (const p of ["vscode/media/sidebar.js"]) {
      const src = read(p);
      const whim = src.indexOf("// 1b. Answered whim calls");
      assert.ok(whim > 0, p);
      assert.ok(whim < src.indexOf("// 2. Minigame results"), p);
    }
  });
});
