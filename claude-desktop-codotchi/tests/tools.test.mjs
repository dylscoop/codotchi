/**
 * tools.test.mjs — smoke tests for the Claude Desktop MCP tool handlers.
 *
 * Runs against src/ compiled by tsconfig.test.json into out-test/, with
 * APPDATA / HOME pointed at a temp folder so the real IDE state is never
 * touched.
 *
 * Run with: npm test (from claude-desktop-codotchi/)
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ge = await import("../out-test/gameEngine.js");
const tools = await import("../out-test/tools.js");
const { resolveIDEStatePath, readConfig, SOURCE } = await import("../out-test/state.js");

const saved = {};
let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-desktop-test-"));
  for (const k of ["APPDATA", "HOME", "USERPROFILE", "CODOTCHI_PET_NAME", "CODOTCHI_PET_TYPE", "CODOTCHI_DEV_MODE"]) {
    saved[k] = process.env[k];
  }
  process.env.APPDATA = tmp;
  process.env.HOME = tmp;
  process.env.USERPROFILE = tmp;
  process.env.CODOTCHI_PET_NAME = "Desky";
  delete process.env.CODOTCHI_PET_TYPE;
  delete process.env.CODOTCHI_DEV_MODE;
});

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Write an IDE state file (the shared { state, savedAt } format). */
function writeState(relPath, state, savedAt = Date.now()) {
  const base = process.platform === "win32" ? tmp : path.join(tmp, ".config");
  const p = path.join(base, "codotchi", ...relPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({ state: ge.serialiseState(state), savedAt }));
  return p;
}

function adultPet(overrides = {}) {
  return { ...ge.createPet("Desky", "codeling"), stage: "adult", ...overrides };
}

describe("claude-desktop tools", () => {
  it("show() hatches a fresh pet on first run and writes it to the VS Code path", () => {
    const out = tools.show(readConfig());
    assert.equal(out.source, SOURCE);
    assert.equal(out.state.name, "Desky");
    assert.ok(out.asciiArt.includes("Desky"), out.asciiArt);
    assert.ok(out.asciiArt.includes("Claude Desktop"), out.asciiArt);
    assert.ok(!/\x1b\[/.test(out.asciiArt), "asciiArt must have no ANSI codes");
    assert.ok(fs.existsSync(resolveIDEStatePath()));
  });

  it("feed() raises hunger and saves the pet back", () => {
    writeState(["vscode", "state.json"], adultPet({ hunger: 10 }));
    const out = tools.feed(readConfig());
    assert.ok(out.state.hunger > 10, `hunger ${out.state.hunger}`);
    const stored = JSON.parse(fs.readFileSync(resolveIDEStatePath(), "utf8"));
    assert.equal(stored.state.hunger, out.state.hunger);
  });

  it("feed(), snack() and play() are refused while sick (BUG-S04)", () => {
    for (const [fn, phrase] of [["feed", "Too sick to eat"], ["snack", "Too sick for a snack"], ["playAction", "Too sick to play"]]) {
      writeState(["vscode", "state.json"], adultPet({ sick: true, hunger: 20, happiness: 40 }));
      const out = tools[fn](readConfig());
      assert.equal(Math.round(out.state.hunger), 20, fn);
      assert.equal(Math.round(out.state.happiness), 40, fn);
      assert.ok(out.asciiArt.replace(/[\s\\/]+/g, " ").includes(phrase), `${fn}: ${out.asciiArt}`);
    }
  });

  it("sleepToggle() can't wake the pet during a break nap", () => {
    writeState(["vscode", "state.json"], adultPet({ sleeping: true, breakNapTicksRemaining: 50 }));
    const out = tools.sleepToggle(readConfig());
    assert.equal(out.state.sleeping, true);
    assert.equal(out.state.breakNapTicksRemaining, 50);
    assert.ok(out.asciiArt.replace(/[\s\\/]+/g, " ").includes("break nap"), out.asciiArt);
  });

  it("clean() removes droppings", () => {
    writeState(["vscode", "state.json"], adultPet({ poops: 3 }));
    assert.equal(tools.clean(readConfig()).state.poops, 0);
  });

  it("uses the most recently saved pet across VS Code and PyCharm", () => {
    const older = writeState(["vscode", "state.json"], adultPet({ name: "Old" }));
    const newer = writeState(["pycharm", "state.json"], adultPet({ name: "New" }));
    const t = Date.now() / 1000;
    fs.utimesSync(older, t - 60, t - 60);
    fs.utimesSync(newer, t, t);
    assert.equal(resolveIDEStatePath(), newer);
    assert.equal(tools.show(readConfig()).state.name, "New");
  });
});
