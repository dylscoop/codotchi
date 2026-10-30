import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createPet, PetState } from "../../src/gameEngine";
import { attentionCallLine, formatStatusBar } from "../../src/statusBarText";
import { cravingItemFor } from "../../src/cravingItem";
import { giftFor } from "../../src/giftItem";
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

describe("kangaroo (Skippy) Aussie voice", () => {
  const roo = CUSTOM_CHARACTERS.find((c) => c.spriteType === "kangaroo")!;

  it("keeps Bounce and speaks in Aussie slang", () => {
    assert.equal(roo.patLabel, "Bounce");
    assert.deepEqual(roo.patToasts, { patted: "__Name__: Cya later!", pat_refused: "__Name__: I'm exhausted, mate." });
    assert.deepEqual(roo.patBubbles, ["Good on ya, mate!", "She'll be right.", "Fair dinkum, what a bounce!"]);
    assert.deepEqual(roo.patCall, {
      call:     "__Name__'s keen as for a bounce!",
      answered: "You took __Name__ for a bounce.",
      expired:  "__Name__ wanted a bounce. Thanks for that, champ.",
      status:   "is keen as for a bounce!",
    });
    assert.equal(roo.ignoredBubble, "Yeah, nah… fair enough.");
  });

  it("brings a beer or some Tim Tams, and only the Tim Tams get their own praise reply", () => {
    assert.deepEqual(roo.gifts, [
      { message: "__Name__ found a beer in its pouch!" },
      { message: "__Name__ brought you some Tim Tams!", praiseBubble: "These are better than Penguins!" },
    ]);
  });

  it("goes on smoko for its break", () => {
    assert.deepEqual(roo.breakNap, {
      call:    "__Name__ wants smoko! You've been coding for 30 minutes.",
      started: "__Name__ needs to get a Bunnings snag 🌭",
      noWake:  "Oi! __Name__'s on smoko!",
      over:    "Smoko's over. Back to it, __Name__!",
      button:  "Smoko",
      bubbles: ["Gone for smoko 🚬", "Off to Bunnings for a snag 🌭"],
    });
  });

  it("hops off the stage for smoko, keeping its bubble, and hops back in", () => {
    const js = read("vscode/media/customCharacters.js");
    const kt = read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt");
    assert.ok(js.includes('bubbles: ["Gone for smoko \\uD83D\\uDEAC", "Off to Bunnings for a snag \\uD83C\\uDF2D"]'));
    assert.ok(kt.includes('bubbles = listOf("Gone for smoko 🚬", "Off to Bunnings for a snag 🌭")'));
    const sidebar = read("vscode/media/sidebar.js");
    assert.match(sidebar, /function isOnSmoko\(state\) \{\n\s*return !!\(state && state\.spriteType === "kangaroo" && state\.sleeping && \(state\.breakNapTicksRemaining \|\| 0\) > 0\);/);
    assert.ok(sidebar.indexOf("} else if (isOnSmoko(lastState) || smokoSide !== 0) {") <
              sidebar.indexOf("} else if (lastState.sleeping) {"), "the smoko hop runs before the frozen sleep branch");
    assert.ok(sidebar.includes('if (!isOnSmoko(state)) { pushReaction("fell_asleep", nowMs); }'), "no lie-down before smoko");
    assert.ok(sidebar.includes("_napCc.breakNap.bubbles"), "the bubble uses breakNap.bubbles");
    assert.ok(sidebar.includes("(chewing || isOnSmoko(lastState)) ? Object.assign({}, lastState, { sleeping: false })"), "drawn awake, no z's");
    assert.ok(sidebar.includes('if (isOnSmoko(state))     { return "On smoko"; }'));
    assert.ok(sidebar.includes('localStorage.setItem("codotchi_smokoSide"'), "a reload keeps it off stage");
    assert.match(sidebar, /function drawStaticPet[\s\S]*?if \(isOnSmoko\(state\)\) \{[\s\S]*?return;/, "reduced motion: empty stage");
  });

  it("uses the same text in the webview and PyCharm registries", () => {
    const js = read("vscode/media/customCharacters.js");
    const kt = read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt");
    const strings = [...roo.patBubbles, ...Object.values(roo.patToasts), ...Object.values(roo.patCall!),
                     ...roo.gifts!.flatMap((g) => [g.message, g.praiseBubble].filter((s): s is string => !!s)),
                     roo.breakNap!.call!, roo.breakNap!.noWake, roo.breakNap!.over];
    for (const s of strings) {
      assert.ok(js.includes(`"${s}"`), `customCharacters.js lacks ${s}`);
      assert.ok(kt.includes(`"${s}"`), `CustomCharacters.kt lacks ${s}`);
    }
    assert.ok(js.includes('"Yeah, nah\\u2026 fair enough."') && kt.includes('"Yeah, nah… fair enough."'));
    assert.ok(js.includes('"__Name__ needs to get a Bunnings snag \\uD83C\\uDF2D"') && kt.includes('"__Name__ needs to get a Bunnings snag 🌭"'));
    assert.ok(js.includes('button:  "Smoko"') && kt.includes('button  = "Smoko"'));
  });

  it("every host names the picked gift, replies to it on praise and uses the smoko call", () => {
    const ext = read("vscode/src/extension.ts");
    assert.ok(ext.includes("giftFor(state)?.message ?? customChar?.giftMessage"));
    assert.ok(ext.includes('customChar?.breakNap?.call?.replace("__Name__", state.name)'));
    assert.ok(read("vscode/src/sidebarProvider.ts").includes("gift: giftFor(state),"));
    const plugin = read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt");
    assert.ok(plugin.includes("giftFor(state)?.message"));
    assert.ok(plugin.includes('customChar?.breakNap?.call?.replace("__Name__", petName)'));
    assert.ok(read("pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt").includes('"gift":${giftJson(giftFor(state))}'));
    const sidebar = read("vscode/media/sidebar.js");
    assert.ok(sidebar.includes("currentGift = message.gift || null;"));
    assert.ok(sidebar.includes("showBubble(currentGift.praiseBubble.replace"));
    assert.ok(sidebar.includes('if (_bn.call) { labels["attention_call_break"] = _bn.call.replace("__Name__", n); }'));
  });
});

describe("giftFor", () => {
  const gift = (spriteType: string, overrides: Partial<PetState> = {}): PetState =>
    makePet(spriteType, { activeAttentionCall: "gift", ...overrides });

  it("is null for characters without gifts or when no gift call is active", () => {
    assert.equal(giftFor(gift("dog")), null);
    assert.equal(giftFor(makePet("kangaroo")), null);
  });

  it("picks the beer or the Tim Tams at random", () => {
    giftFor(makePet("kangaroo"));
    assert.equal(giftFor(gift("kangaroo"), () => 0)?.message, "__Name__ found a beer in its pouch!");
    giftFor(makePet("kangaroo"));
    assert.equal(giftFor(gift("kangaroo"), () => 0.99)?.praiseBubble, "These are better than Penguins!");
  });

  it("keeps the pick for the whole call and the update that answers it, then clears", () => {
    giftFor(makePet("kangaroo"));
    const picked = giftFor(gift("kangaroo"), () => 0.99);
    assert.equal(giftFor(gift("kangaroo"), () => 0), picked);
    const answered = makePet("kangaroo", { events: ["praised", "attention_call_answered_gift"] });
    assert.equal(giftFor(answered), picked);
    assert.equal(giftFor(makePet("kangaroo")), null);
    assert.equal(giftFor(gift("kangaroo"), () => 0)?.message, "__Name__ found a beer in its pouch!");
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
      weightGain: 5,
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
    assert.ok(read("vscode/src/sidebarProvider.ts").includes("praise(state, { breakWeightGain: getCustomCharacterBySpriteType(state.spriteType)?.breakNap?.weightGain })"));
    assert.ok(read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt").includes("breakWeightGain = getCustomCharacterBySpriteType(state.spriteType)?.breakNap?.weightGain ?: 0"));
    assert.ok(read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt").includes("weightGain = 5,"));
    const sidebar = read("vscode/media/sidebar.js");
    assert.ok(sidebar.includes('if (code === "fell_asleep" && (state.breakNapTicksRemaining || 0) > 0) { return null; }'),
      "the log must not say the dog fell asleep on its break");
    assert.ok(sidebar.includes("if (!state.activeAttentionCall) { bubbleQueue = []; }"), "stale call bubbles are dropped");
    assert.match(sidebar, /function startFetchGame\(\) \{[\s\S]*?clearStageBubbles\(\);/);
    assert.match(sidebar, /function startTugGame\(\) \{[\s\S]*?clearStageBubbles\(\);/);
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

describe("cat voice and gifts", () => {
  const cat = CUSTOM_CHARACTERS.find((c) => c.spriteType === "cat")!;

  it("brings a mouse or a bird, each with a smug and a proud-hunter line", () => {
    assert.equal(cat.giftMessage, undefined);
    assert.deepEqual([...new Set(cat.gifts!.map((g) => g.kind))], ["mouse", "bird"]);
    assert.equal(cat.gifts!.length, 4);
    assert.ok(cat.gifts!.every((g) => !!g.praiseBubble), "every gift has its own praise reply");
  });

  it("demands chin scratches, sulks when ignored, craves tuna or milk and takes a catnap", () => {
    assert.equal(attentionCallLine(makePet("cat", { activeAttentionCall: "pat" })), "⚠ Pixel demands chin scratches.");
    assert.equal(cat.ignoredBubble, "Hmph. Fine.");
    assert.deepEqual(cat.snackCravings, ["some tuna", "a saucer of milk"]);
    assert.equal(cat.breakNap!.button, "Catnap");
    assert.equal(cat.breakNap!.call, "__Name__ wants a catnap! You've been coding for 30 minutes.");
  });

  it("picks one of its gifts per call and sends the kind to the webview", () => {
    giftFor(makePet("cat"));
    assert.equal(giftFor(makePet("cat", { activeAttentionCall: "gift" }), () => 0.99)?.kind, "bird");
    giftFor(makePet("cat"));
    assert.equal(giftFor(makePet("cat", { activeAttentionCall: "gift" }), () => 0)?.kind, "mouse");
    assert.ok(read("pycharm/src/main/kotlin/com/codotchi/GiftItem.kt").includes('"kind":${jsonStringOrNull(gift.kind)}'));
  });

  it("uses the same text in the webview and PyCharm registries", () => {
    const js = read("vscode/media/customCharacters.js");
    const kt = read("pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt");
    const strings = [...cat.patBubbles, ...Object.values(cat.patCall!), ...cat.snackCravings!,
                     ...cat.gifts!.flatMap((g) => [g.message, g.praiseBubble!]),
                     cat.ignoredBubble!, cat.breakNap!.call!, cat.breakNap!.noWake, cat.breakNap!.over];
    for (const s of strings) {
      assert.ok(js.includes(`"${s}"`), `customCharacters.js lacks ${s}`);
      assert.ok(kt.includes(`"${s}"`), `CustomCharacters.kt lacks ${s}`);
    }
    for (const g of cat.gifts!) {
      assert.ok(js.includes(`kind: "${g.kind}",`) && kt.includes(`kind = "${g.kind}"`));
    }
    assert.ok(js.includes('{ label: "some tuna",        item: "tuna" }'));
    assert.ok(js.includes('{ label: "a saucer of milk", item: "milk" }'));
    assert.ok(js.includes('button:  "Catnap"') && kt.includes('button  = "Catnap"'));
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
