import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createPet, PetState } from "../../src/gameEngine";
import { attentionCallLine } from "../../src/statusBarText";
import { cravingItemFor } from "../../src/cravingItem";
import { CUSTOM_CHARACTERS } from "../../src/customCharacters";

// Tim asks for a run and a tea; Stu asks for stickers and a pint or salmon.
const repo = path.join(__dirname, "../../../..");
const read = (p: string): string => fs.readFileSync(path.join(repo, p), "utf8").replace(/\r\n/g, "\n");

function makePet(spriteType: string, overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Pixel", "codeling"), spriteType, ...overrides };
}

describe("custom character attention-call text", () => {
  it("Tim wants a run instead of a pat", () => {
    assert.equal(attentionCallLine(makePet("tim", { activeAttentionCall: "pat" })), "⚠ Pixel wants to go for a run!");
  });

  it("Stu wants to collect stickers instead of a pat", () => {
    assert.equal(attentionCallLine(makePet("stu", { activeAttentionCall: "pat" })), "⚠ Pixel wants to collect stickers!");
  });

  it("other pets still want a pat", () => {
    assert.equal(attentionCallLine(makePet("dog", { activeAttentionCall: "pat" })), "⚠ Pixel wants a pat!");
  });

  it("Tim craves a tea", () => {
    const pet = makePet("tim", { activeAttentionCall: "craving", cravingFood: "snack" });
    assert.equal(attentionCallLine(pet), "⚠ Pixel is craving a tea!");
  });

  it("a meal craving is unchanged for Tim", () => {
    const pet = makePet("tim", { activeAttentionCall: "craving", cravingFood: "meal" });
    assert.equal(attentionCallLine(pet), "⚠ Pixel is craving a meal!");
  });
});

describe("cravingItemFor", () => {
  const craving = (spriteType: string): PetState =>
    makePet(spriteType, { activeAttentionCall: "craving", cravingFood: "snack" });

  it("is null when no snack craving is active", () => {
    assert.equal(cravingItemFor(makePet("stu")), null);
    assert.equal(cravingItemFor(makePet("stu", { activeAttentionCall: "craving", cravingFood: "meal" })), null);
    assert.equal(cravingItemFor(craving("dog")), null);
  });

  it("picks Stu's pint or salmon at random", () => {
    cravingItemFor(makePet("stu"));
    assert.equal(cravingItemFor(craving("stu"), () => 0), "a pint");
    cravingItemFor(makePet("stu"));
    assert.equal(cravingItemFor(craving("stu"), () => 0.99), "some salmon");
  });

  it("keeps the same pick for the whole craving, then re-rolls", () => {
    cravingItemFor(makePet("stu"));
    assert.equal(cravingItemFor(craving("stu"), () => 0), "a pint");
    assert.equal(cravingItemFor(craving("stu"), () => 0.99), "a pint");
    cravingItemFor(makePet("stu"));  // craving answered
    assert.equal(cravingItemFor(craving("stu"), () => 0.99), "some salmon");
  });
});

describe("custom character text parity", () => {
  const webview = read("vscode/media/customCharacters.js");
  const kotlin  = read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt");

  it("patCall and snackCravings match in the webview and PyCharm registries", () => {
    for (const c of CUSTOM_CHARACTERS.filter((c) => c.patCall)) {
      for (const s of Object.values(c.patCall!)) {
        assert.ok(webview.includes(`"${s}"`), `${c.spriteType} webview: ${s}`);
        assert.ok(kotlin.includes(`"${s}"`), `${c.spriteType} kotlin: ${s}`);
      }
      for (const item of c.snackCravings ?? []) {
        assert.ok(webview.includes(`label: "${item}"`), `${c.spriteType} webview: ${item}`);
        assert.ok(kotlin.includes(`"${item}"`), `${c.spriteType} kotlin: ${item}`);
      }
    }
  });

  it("every host uses patCall and the craving item", () => {
    const ext = read("vscode/src/extension.ts");
    assert.match(ext, /patCall\.call\.replace/);
    assert.match(ext, /cravingItemFor\(state\)/);
    assert.match(read("vscode/src/sidebarProvider.ts"), /cravingItem: cravingItemFor\(state\)/);
    const plugin = read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt");
    assert.match(plugin, /patCall\?\.call/);
    assert.match(plugin, /cravingItemFor\(state\)/);
    assert.match(read("pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt"), /"cravingItem":\$\{jsonStringOrNull\(cravingItemFor\(state\)\)\}/);
    const sidebar = read("vscode/media/sidebar.js");
    assert.match(sidebar, /currentCravingItem = message\.cravingItem/);
    assert.match(sidebar, /labels\["attention_call_pat"\]\s*= _pc\.call/);
  });

  it("Tim and Stu answer their call with patBubbles, not the generic pat speech", () => {
    assert.match(read("vscode/media/sidebar.js"), /_wk === "pat" && _whimChar && _whimChar\.patCall\) \{ continue; \}/);
  });
});
