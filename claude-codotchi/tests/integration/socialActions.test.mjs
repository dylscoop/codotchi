/**
 * socialActions.test.mjs
 *
 * End-to-end test for the social commands (v2.36.0): spawns
 * `node scripts/action.mjs <action>` against a fake VS Code state file whose
 * pet has a visiting friend or a proposal, then reads the state file back.
 *
 * Requires the plugin to be built first (`npm run build`, from claude-codotchi/).
 *
 * Run with:
 *   node --test tests/integration/socialActions.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "..", "dist");
const actionScript = path.join(__dirname, "..", "..", "scripts", "action.mjs");

/** Where state.mjs looks for IDE pets: APPDATA on Windows, ~/.config elsewhere. */
function ideBase(tmpBase) {
  return process.platform === "win32" ? tmpBase : path.join(tmpBase, ".config");
}

function vsStatePath(tmpBase) {
  return path.join(ideBase(tmpBase), "codotchi", "vscode", "state.json");
}

async function withFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-social-test-"));
  try { await fn(tmpBase); } finally { fs.rmSync(tmpBase, { recursive: true, force: true }); }
}

async function writePet(tmpBase, overrides) {
  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  const pet = { ...ge.createPet("Socialite", "codeling"), stage: "adult", energy: 80, hunger: 60, happiness: 60, ...overrides };
  fs.mkdirSync(path.dirname(vsStatePath(tmpBase)), { recursive: true });
  fs.writeFileSync(vsStatePath(tmpBase), JSON.stringify({ state: ge.serialiseState(pet), savedAt: Date.now() }), "utf8");
}

function readPet(tmpBase) {
  return JSON.parse(fs.readFileSync(vsStatePath(tmpBase), "utf8")).state;
}

function run(tmpBase, action) {
  const env = {
    ...process.env, APPDATA: tmpBase, HOME: tmpBase, USERPROFILE: tmpBase,
    CLAUDE_PLUGIN_DATA: path.join(tmpBase, "claude-plugin-data"), CLAUDE_CODE_SESSION_ID: "",
    CODOTCHI_NO_RANK: "1",
  };
  return execFileSync("node", [actionScript, action], { env, encoding: "utf8" }).replace(/[\s\\/|]+/g, " ");
}

const FRIEND = { name: "Pixel", spriteType: "dog", petType: "bytebug", friendship: 40, visits: 3 };
const VISIT = { ticksLeft: 40, played: false, gifted: false };

describe("action.mjs social commands (integration)", () => {
  it("/codotchi playfriend plays with the visiting friend once", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { friend: FRIEND, visit: VISIT });
      const out = run(tmp, "playfriend");
      assert.ok(out.includes("played together"), out);
      const saved = readPet(tmp);
      assert.equal(saved.friend.friendship, 50);
      assert.equal(saved.visit.played, true);
      assert.ok(run(tmp, "playfriend").includes("already played"));
    });
  });

  it("/codotchi items lists the bag, and /codotchi use eats food", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { items: ["apple", "apple", "plant"], hunger: 40 });
      const list = run(tmp, "items");
      assert.ok(list.includes("apple ×2") && list.includes("potted plant"), list);
      const out = execFileSync("node", [actionScript, "use", "apple"], {
        env: { ...process.env, APPDATA: tmp, HOME: tmp, USERPROFILE: tmp, CLAUDE_PLUGIN_DATA: path.join(tmp, "claude-plugin-data"), CLAUDE_CODE_SESSION_ID: "", CODOTCHI_NO_RANK: "1" },
        encoding: "utf8",
      });
      assert.ok(out.includes("ate the apple"), out);
      const saved = readPet(tmp);
      assert.deepEqual(saved.items, ["apple", "plant"]);
      assert.equal(saved.hunger, 55);
    });
  });

  it("/codotchi gift hands the visiting friend the oldest item", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { friend: FRIEND, visit: VISIT, items: ["kite", "cake"] });
      const out = run(tmp, "gift");
      assert.ok(out.includes("gave Pixel a kite"), out);
      const saved = readPet(tmp);
      assert.deepEqual(saved.items, ["cake"]);
      assert.equal(saved.friend.friendship, 55);
    });
  });

  it("/codotchi goodbye ends the visit early", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { friend: FRIEND, visit: VISIT });
      const out = run(tmp, "goodbye");
      assert.ok(out.includes("waved goodbye to Pixel"), out);
      assert.equal(readPet(tmp).visit, null);
      assert.ok(run(tmp, "goodbye").includes("No friend is visiting"));
    });
  });

  it("/codotchi gift is refused with no visitor and saves nothing", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { friend: FRIEND });
      const out = run(tmp, "gift");
      assert.ok(out.includes("No friend is visiting"), out);
      assert.equal(readPet(tmp).friend.friendship, 40);
    });
  });

  it("/codotchi accept marries the pet", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { friend: { ...FRIEND, friendship: 95 }, proposal: { from: "friend", name: "Pixel", spriteType: "dog", petType: "bytebug" } });
      const out = run(tmp, "accept");
      assert.ok(out.includes("married Pixel"), out);
      const saved = readPet(tmp);
      assert.equal(saved.partner.name, "Pixel");
      assert.equal(saved.heirEgg, null);
      assert.equal(saved.proposal, null);
    });
  });

  it("/codotchi friend lists the friend and any proposal", async () => {
    await withFixture(async (tmp) => {
      await writePet(tmp, { friend: FRIEND, proposal: { from: "matchmaker", name: "Waffle", spriteType: "cat", petType: "codeling" } });
      const out = run(tmp, "friend");
      assert.ok(out.includes("Friend: Pixel"), out);
      assert.ok(out.includes("matchmaker brought Waffle"), out);
    });
  });
});
