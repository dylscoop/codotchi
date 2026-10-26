import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createPet, PetState } from "../../src/gameEngine";
import { attentionCallLine, formatStatusBar } from "../../src/statusBarText";
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

describe("character label (info line and status bar tooltip)", () => {
  it("Tim and Stu are shown as Timagotchi and Stugotchi, not their sprite keys", () => {
    assert.ok(formatStatusBar(makePet("tim")).tooltip.includes("Sprite: Timagotchi"));
    assert.ok(formatStatusBar(makePet("stu")).tooltip.includes("Sprite: Stugotchi"));
  });

  it("other sprites keep the capitalised sprite key", () => {
    assert.ok(formatStatusBar(makePet("cat")).tooltip.includes("Sprite: Cat"));
  });

  it("the webview info line uses characterLabel, and every registry has it", () => {
    assert.match(read("vscode/media/sidebar.js"), /const spriteLabel = \(_infoCC && _infoCC\.characterLabel\) \? _infoCC\.characterLabel/);
    for (const label of ["Timagotchi", "Stugotchi"]) {
      assert.match(read("vscode/media/customCharacters.js"), new RegExp(`characterLabel: "${label}"`));
      assert.match(read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt"), new RegExp(`characterLabel = "${label}"`));
    }
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

describe("floor snack cap (Stu's cycle cap is 10, so only the floor cap stops him)", () => {
  it("the engine refuses a 4th floor snack even under a 10-snack cycle cap", async () => {
    const { startSnack } = await import("../../src/gameEngine");
    const pet = { ...makePet("stu"), snacksOnFloor: 3, snacksGivenThisCycle: 3 };
    assert.deepEqual(startSnack(pet, { maxPerCycle: 10 }).events, ["snack_refused"]);
  });

  it("every host takes the floor count from the webview, so a stale counter can't let one through", () => {
    assert.match(read("vscode/media/sidebar.js"), /feedType: "snack", floorSnacks: snackItems\.length/);
    assert.match(read("vscode/src/sidebarProvider.ts"), /startSnack\(\{ \.\.\.state, snacksOnFloor: floor \}/);
    assert.match(read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt"), /startSnack\(state\.copy\(snacksOnFloor = floor\)/);
  });
});

describe("dog voice, snacks and break bone", () => {
  const dog = CUSTOM_CHARACTERS.find((c) => c.spriteType === "dog")!;

  it("brings a ball for fetch, has pat bubbles and whimpers when ignored", () => {
    assert.equal(dog.giftMessage, "__Name__ brought you a ball and wants to play fetch! 🎾");
    assert.deepEqual(dog.patBubbles, ["*tail wags intensify*", "Much code. Very wow.", "Who's a good boy?"]);
    assert.equal(dog.ignoredBubble, "*sad whimper*… fine.");
  });

  it("chews a bone through its break instead of napping", () => {
    assert.deepEqual(dog.breakNap, {
      started: "__Name__ is busy with a big bone 🦴",
      noWake:  "__Name__ won't give up the bone yet!",
      over:    "__Name__ finished the bone. Back to work!",
      button:  "Chewing",
    });
  });

  it("uses the same text in the webview and PyCharm registries", () => {
    const js = read("vscode/media/customCharacters.js");
    const kt = read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt");
    for (const s of ["*tail wags intensify*", "Much code. Very wow.", "Who's a good boy?",
                     "won't give up the bone yet!", "finished the bone. Back to work!", "Chewing"]) {
      assert.ok(js.includes(s), `customCharacters.js lacks ${s}`);
      assert.ok(kt.includes(s), `CustomCharacters.kt lacks ${s}`);
    }
    assert.ok(js.includes("brought you a ball and wants to play fetch!"));
    assert.ok(kt.includes("brought you a ball and wants to play fetch!"));
  });

  it("shows the break bone text in the IDE notifications", () => {
    assert.ok(read("vscode/src/extension.ts").includes("customChar?.breakNap?.over"));
    assert.ok(read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt").includes("customChar?.breakNap?.over"));
  });

  it("draws biscuit bone snacks, a meaty bone meal and a shrinking break bone in the webview", () => {
    const sidebar = read("vscode/media/sidebar.js");
    assert.ok(sidebar.includes('state.spriteType === "dog" ? "biscuit"'));
    assert.ok(sidebar.includes("drawBoneItem(MEATY_BONE_PIXELS"));
    assert.ok(sidebar.includes("if (chewing) { drawBreakBone("));
    assert.ok(sidebar.includes("_ignChar.ignoredBubble"));
    assert.ok(sidebar.includes('} else if (state && state.spriteType === "dog") {\n        // The dog\'s gift is a tennis ball'));
    assert.ok(sidebar.includes('events.indexOf("attention_call_answered_gift") !== -1 && playsDogGames(state)'));
  });

  it("wags when happy and chases its tail when energetic, but not asleep, sick or with reduced motion", () => {
    const sidebar = read("vscode/media/sidebar.js");
    assert.match(sidebar, /function isWagging\(state\) \{\n\s*return isAwakeDog\(state\) && state\.mood === "happy" && !REDUCED_MOTION;/);
    assert.match(sidebar, /function wantsToChaseTail\(state\) \{\n\s*return isAwakeDog\(state\) && \(state\.energy \|\| 0\) >= TAIL_CHASE_MIN_ENERGY && !REDUCED_MOTION;/);
    assert.match(sidebar, /function isAwakeDog\(state\) \{[\s\S]*?!state\.sleeping && !state\.sick/);
    assert.ok(sidebar.includes('pushReaction("tail_chase", nowMs, TAIL_CHASE_MS)'));
    assert.ok(sidebar.includes('case "tail_chase": {'));
  });
});

describe("break reminder text", () => {
  it("just says it's time for a break — no praise instructions", () => {
    for (const p of ["vscode/src/extension.ts", "vscode/media/sidebar.js", "pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt"]) {
      const src = read(p);
      assert.ok(src.includes("Time for a break! You've been coding for 30 minutes."), p);
      assert.ok(!/praise[^\n]*nap for 5 minutes/.test(src), p);
    }
    assert.equal(attentionCallLine(makePet("dog", { activeAttentionCall: "break" })), "⚠ Pixel says it's time for a break!");
  });
});
