import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

// Checks for the Boss Battle rules and art (vscode/media/bossArt.js) and how
// sidebar.js, sidebar.html and both hosts load them. PyCharm copies the same
// vscode/media files at build time.
const media = path.join(__dirname, "../../../media");
const repo = path.join(__dirname, "../../../..");
const artSource = fs.readFileSync(path.join(media, "bossArt.js"), "utf8");
const sidebarSource = fs.readFileSync(path.join(media, "sidebar.js"), "utf8");
const html = fs.readFileSync(path.join(media, "sidebar.html"), "utf8");

function loadBossArt(): Record<string, any> {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  vm.runInContext(artSource.replace(/^\uFEFF/, ""), context, { filename: "bossArt.js" });
  return window.bossArt as Record<string, any>;
}

function mockCtx(): { ctx: any; calls: Record<string, number>; styles: string[] } {
  const calls: Record<string, number> = {};
  const styles: string[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get(target, key: string) {
      if (key in target) { return target[key]; }
      return () => { calls[key] = (calls[key] ?? 0) + 1; };
    },
    set(target, key: string, value) {
      if (key === "fillStyle" || key === "strokeStyle") { styles.push(String(value)); }
      target[key] = value;
      return true;
    },
  });
  return { ctx, calls, styles };
}

const art = loadBossArt();
const pet = (over: Record<string, unknown> = {}) =>
  ({ name: "Pixel", petLevel: 1, health: 50, energy: 50, discipline: 50, happiness: 50, ...over });

/** Plays a whole battle with a fixed strategy; returns the final battle. */
function playOut(p: Record<string, unknown>, seed: number, pick: (b: any) => string): any {
  const rng = art.makeRng(seed);
  const level = typeof p.petLevel === "number" ? p.petLevel : 1;
  let b = art.createBattle(p, rng, art.bossForLevel(level).id);
  while (!b.result) { b = art.battleTurn(b, pick(b), rng); }
  return b;
}

describe("boss roster (bossArt.js)", () => {
  it("has the three tiers in level order", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(art.BOSSES.map((b: any) => [b.id, b.minLevel]))),
      [["syntax_wraith", 1], ["nullpointer_demon", 5], ["stackoverflow_behemoth", 10]]);
  });

  it("picks the boss by pet level", () => {
    assert.equal(art.bossForLevel(1).id, "syntax_wraith");
    assert.equal(art.bossForLevel(4).id, "syntax_wraith");
    assert.equal(art.bossForLevel(5).id, "nullpointer_demon");
    assert.equal(art.bossForLevel(9).id, "nullpointer_demon");
    assert.equal(art.bossForLevel(10).id, "stackoverflow_behemoth");
    assert.equal(art.bossForLevel(99).id, "stackoverflow_behemoth");
  });

  it("scales boss HP and attack with the pet's level", () => {
    const wraith = art.BOSSES[0];
    assert.equal(art.bossMaxHp(wraith, 1), wraith.hp);
    assert.ok(art.bossMaxHp(wraith, 11) > wraith.hp);
    assert.deepEqual([...art.bossAttack(wraith, 1)], [...wraith.attack]);
    assert.ok(art.bossAttack(wraith, 11)[0] > wraith.attack[0]);
  });

  it("every sprite is a 16 × 16 grid using only its own colours", () => {
    for (const b of art.BOSSES) {
      assert.equal(b.grid.length, art.BOSS_GRID, b.id);
      for (const row of b.grid) {
        assert.equal(row.length, art.BOSS_GRID, b.id);
        for (const ch of row) { assert.ok(ch === "." || ch in b.colours, `${b.id} uses ${ch}`); }
      }
      for (const c of Object.values(b.colours)) { assert.match(String(c), /^#[0-9a-f]{6}$/); }
    }
  });
});

describe("battle stats (bossArt.js)", () => {
  it("care modifiers run from ×0.8 to ×1.2 and default to ×1.0", () => {
    assert.equal(art.careMod(0), 0.8);
    assert.equal(art.careMod(100), 1.2);
    assert.equal(art.careMod(50), 1);
    assert.equal(art.careMod(undefined), 1);
    assert.equal(art.careMod(500), 1.2);
  });

  it("level raises HP and attack", () => {
    const lo = art.petBattleStats(pet({ petLevel: 1 }));
    const hi = art.petBattleStats(pet({ petLevel: 11 }));
    assert.ok(hi.maxHp > lo.maxHp);
    assert.ok(hi.attack[0] > lo.attack[0] && hi.attack[1] > lo.attack[1]);
  });

  it("health scales HP, energy Attack, discipline Guard's reflect and happiness Patch", () => {
    const low = art.petBattleStats(pet({ health: 0, energy: 0, discipline: 0, happiness: 0 }));
    const high = art.petBattleStats(pet({ health: 100, energy: 100, discipline: 100, happiness: 100 }));
    assert.ok(high.maxHp > low.maxHp);
    assert.ok(high.attack[1] > low.attack[1]);
    assert.ok(high.reflect > low.reflect);
    assert.ok(high.heal > low.heal);
  });

  it("treats a missing level as level 1", () => {
    assert.equal(art.petBattleStats({}).level, 1);
    assert.equal(art.createBattle(null, art.makeRng(1)).bossId, "syntax_wraith");
  });
});

describe("clashes (bossArt.js)", () => {
  const fresh = (over: Record<string, unknown> = {}, p = pet()) => ({ ...art.createBattle(p, art.makeRng(0)), ...over });
  const clash = (mine: string, theirs: string, over: Record<string, unknown> = {}) =>
    art.resolveClash(fresh(over), mine, theirs, art.makeRng(5));

  it("the seeded RNG is repeatable", () => {
    const a = art.makeRng(42), b = art.makeRng(42);
    for (let i = 0; i < 5; i++) { assert.equal(a(), b()); }
  });

  it("Attack beats Patch, Patch beats Guard, Guard beats Attack", () => {
    assert.equal(art.clashOutcome("attack", "patch"), "win");
    assert.equal(art.clashOutcome("patch", "guard"), "win");
    assert.equal(art.clashOutcome("guard", "attack"), "win");
    assert.equal(art.clashOutcome("patch", "attack"), "lose");
    assert.equal(art.clashOutcome("guard", "guard"), "tie");
    for (const s of art.STANCES) { assert.equal(art.clashOutcome(art.counterOf(s), s), "win"); }
  });

  it("fights the unlocked boss, scaled to the pet's level", () => {
    const b = art.createBattle(pet({ petLevel: 12 }), art.makeRng(1), "syntax_wraith");
    assert.equal(b.bossId, "syntax_wraith");
    assert.equal(b.bossMaxHp, art.bossMaxHp(art.BOSSES[0], 12));
    assert.equal(art.createBattle(pet({ petLevel: 12 }), art.makeRng(1)).bossId, "stackoverflow_behemoth");
    assert.equal(b.last, null, "nothing about the boss's stance is known before the clash");
  });

  it("a winning Attack hits hard and cancels the boss's Patch", () => {
    const b0 = fresh({ bossHp: 20 });
    const b = art.resolveClash(b0, "attack", "patch", art.makeRng(5));
    assert.equal(b.last.outcome, "win");
    assert.ok(b.last.toBoss >= Math.round(b.pet.attack[0] * 1.5));
    assert.equal(b.last.bossHeal, 0);
    assert.equal(b.bossHp, 20 - b.last.toBoss);
    assert.equal(b0.round, 0, "the old battle object is not changed");
    assert.equal(b.round, 1);
  });

  it("a winning Guard blocks and reflects; a losing Attack is reflected back", () => {
    const g = clash("guard", "attack");
    assert.equal(g.last.toPet, 0);
    assert.ok(g.last.toBoss > 0);
    const a = clash("attack", "guard");
    assert.equal(a.last.toBoss, 0);
    assert.ok(a.last.toPet > 0);
  });

  it("a winning Patch heals without fatigue; a losing Patch is smashed", () => {
    const p = clash("patch", "guard", { petHp: 5 });
    assert.ok(p.last.petHeal > 0);
    assert.equal(p.petFatigue, 0);
    const l = clash("patch", "attack");
    assert.equal(l.last.petHeal, 0);
    assert.ok(l.last.toPet > 0);
  });

  it("Guard into Patch lets the boss heal", () => {
    const b = clash("guard", "patch", { bossHp: 10 });
    assert.equal(b.last.outcome, "lose");
    assert.ok(b.last.bossHeal > 0);
    assert.equal(b.bossHp, 10 + b.last.bossHeal);
  });

  it("ties: Attack trades small hits, Guard does nothing, Patch heals both a little", () => {
    const a = clash("attack", "attack");
    assert.ok(a.last.toBoss > 0 && a.last.toPet > 0);
    const g = clash("guard", "guard", { petHp: 10, bossHp: 10 });
    assert.equal(g.petHp, 10);
    assert.equal(g.bossHp, 10);
    const p = clash("patch", "patch", { petHp: 10, bossHp: 10 });
    assert.ok(p.last.petHeal > 0 && p.last.bossHeal > 0);
    assert.equal(p.petFatigue, 1);
  });

  it("each Patch heals less than the last (fatigue)", () => {
    const first = clash("patch", "guard", { petHp: 1 }).last.petHeal;
    const tired = clash("patch", "guard", { petHp: 1, petFatigue: 2 }).last.petHeal;
    assert.equal(tired, Math.max(1, Math.round(first * art.FATIGUE_STEP ** 2)));
  });

  it("two wins in a row power up the next win (combo)", () => {
    const plain = clash("patch", "guard", { petHp: 1 });
    const combo = clash("patch", "guard", { petHp: 1, petStreak: art.COMBO_AT });
    assert.equal(combo.last.combo, true);
    assert.ok(combo.last.petHeal > plain.last.petHeal);
    assert.equal(combo.petStreak, art.COMBO_AT + 1);
    assert.equal(clash("attack", "guard", { petStreak: 3 }).petStreak, 0, "a loss resets it");
  });

  it("overtime chips both sides from round 12", () => {
    const early = clash("guard", "guard", { round: 5 });
    assert.equal(early.last.overtime, 0);
    const late = clash("guard", "guard", { round: art.OVERTIME_ROUND - 1 + 2, petHp: 30, bossHp: 30 });
    assert.ok(late.last.overtime > 0);
    assert.equal(late.petHp, 30 - late.last.overtime);
    assert.equal(late.bossHp, 30 - late.last.overtime);
  });

  it("both falling at once is a loss; finished battles ignore further clashes", () => {
    const b = clash("guard", "guard", { round: 20, petHp: 1, bossHp: 1 });
    assert.equal(b.result, "lose");
    assert.equal(art.battleTurn(b, "attack", art.makeRng(1)), b);
  });

  it("the boss gets enraged below 40% HP", () => {
    const b = clash("guard", "guard", { bossHp: 10 });
    assert.equal(b.enraged, true);
    assert.equal(clash("guard", "guard").enraged, false);
  });

  it("each boss has its own habits and rage tables", () => {
    const w = (bossId: string, over: Record<string, unknown> = {}) => ({ ...art.bossWeights({ ...art.createBattle(pet(), art.makeRng(1), bossId), ...over }) });
    const wraith = w("syntax_wraith", { petStances: ["guard", "attack"], bossStances: ["guard", "guard"] });
    assert.ok(wraith.patch > wraith.attack, "the Wraith Patches after you Attack");
    const demon = w("nullpointer_demon");
    assert.ok(demon.attack > demon.guard && demon.attack > demon.patch, "the Demon is aggressive");
    assert.equal(w("nullpointer_demon", { bossHp: 1 }).patch, 0, "an enraged Demon never Patches");
    const behemoth = w("stackoverflow_behemoth");
    assert.ok(behemoth.guard > behemoth.attack, "the Behemoth turtles");
  });

  it("the boss leans towards countering a stance you keep using", () => {
    const base = art.createBattle(pet(), art.makeRng(1), "nullpointer_demon");
    const once = { ...art.bossWeights({ ...base, petStances: ["patch", "attack"], bossStances: ["guard", "guard"] }) };
    const spam = { ...art.bossWeights({ ...base, petStances: ["attack", "attack", "attack", "attack"], bossStances: ["guard", "guard", "guard", "guard"] }) };
    assert.ok(spam.guard > once.guard);
  });

  it("every fight ends (fatigue and overtime)", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const s of art.STANCES) {
        const b = playOut(pet({ petLevel: 15 }), seed, () => s);
        assert.ok(b.result && b.round <= 25, `${s} seed ${seed}: round ${b.round}`);
      }
    }
  });

  /** Plays the boss's habits: the stance with the best expected result against its weights. */
  const reader = (b: any) => {
    const w = art.bossWeights(b);
    const score = (s: string) => art.STANCES.reduce((sum: number, q: string) =>
      sum + w[q] * ({ win: 1, tie: 0, lose: -1 } as Record<string, number>)[art.clashOutcome(s, q)], 0);
    return [...art.STANCES].sort((x: string, y: string) => score(y) - score(x))[0];
  };
  const winsAt = (level: number, mk: (rng: () => number) => (b: any) => string, p: Record<string, unknown> = {}) => {
    let w = 0;
    for (let seed = 0; seed < 300; seed++) {
      if (playOut(pet({ petLevel: level, ...p }), seed, mk(art.makeRng(seed + 99999))).result === "win") { w++; }
    }
    return w / 300;
  };

  it("learning the habits beats random picks, which beat spamming one stance, at every milestone", () => {
    for (const level of [3, 5, 10, 15, 25]) {
      const read = winsAt(level, () => reader);
      const random = winsAt(level, (rng) => () => art.STANCES[Math.floor(rng() * 3)]);
      const spam = Math.max(...art.STANCES.map((s: string) => winsAt(level, () => () => s)));
      assert.ok(read >= 0.65 && read <= 0.95, `level ${level}: habit play won ${read}`);
      assert.ok(random >= 0.15 && random <= 0.5, `level ${level}: random won ${random}`);
      assert.ok(spam <= 0.35, `level ${level}: spamming won ${spam}`);
      assert.ok(read - random >= 0.25 && random >= spam - 0.15, `level ${level}: ${read} / ${random} / ${spam}`);
    }
  });

  it("a well cared-for pet wins more often than a neglected one", () => {
    const cared = winsAt(10, () => reader, { health: 100, energy: 100, discipline: 100, happiness: 100 });
    const neglected = winsAt(10, () => reader, { health: 10, energy: 10, discipline: 10, happiness: 10 });
    assert.ok(cared - neglected >= 0.1, `cared ${cared} vs neglected ${neglected}`);
  });

  it("describes each clash in plain text", () => {
    assert.match(art.describeTurn(clash("attack", "patch"), "Pixel"), /^Wraith Patched - your Attack broke through! \(-\d+\)/);
    assert.match(art.describeTurn(clash("guard", "guard"), "Pixel"), /^Both Guarded/);
    assert.match(art.describeTurn(clash("patch", "attack"), "Pixel"), /smashed through Pixel's Patch/);
    assert.deepEqual([...art.bossHistory({ bossStances: ["attack", "guard", "patch", "guard", "attack", "patch"] })],
      ["guard", "patch", "guard", "attack", "patch"]);
  });
});

describe("boss drawing (bossArt.js)", () => {
  it("draws the scene with boss, both HP bars and no CSS variables", () => {
    const { ctx, calls, styles } = mockCtx();
    const out = art.drawBattleScene(ctx, 200, 240, art.createBattle(pet()), { frame: 1 });
    assert.ok(out.boss);
    assert.ok(calls.fillRect > 50);
    assert.ok(styles.includes(art.BOSSES[0].colours[1]));
    assert.ok(styles.every((s) => !s.includes("var(")));
  });

  it("draws the stance history, the clash reveal, the rage tint and heal sparkles", () => {
    const base = art.createBattle(pet(), art.makeRng(1), "syntax_wraith");
    const b = art.resolveClash({ ...base, bossHp: 3, petHp: 5, bossStances: ["guard"] }, "patch", "attack", art.makeRng(2));
    const { ctx, styles } = mockCtx();
    art.drawBattleScene(ctx, 200, 240, { ...b, enraged: true }, { reveal: true, sparkle: "pet" });
    assert.ok(styles.includes(art.STANCE_ICONS.guard.colour), "history strip");
    assert.ok(styles.includes(art.STANCE_ICONS.patch.colour) && styles.includes(art.STANCE_ICONS.attack.colour), "reveal");
    assert.ok(styles.includes(art.COLOURS.rage));
    assert.ok(styles.includes(art.COLOURS.heal));
  });

  it("paints the boss white when it is hit", () => {
    const { ctx, styles } = mockCtx();
    art.drawBoss(ctx, art.BOSSES[1], 0, 0, 2, true);
    assert.ok(styles.length > 0 && styles.every((s) => s === art.COLOURS.flash));
  });

  it("HP bars change colour as HP drops", () => {
    for (const [hp, colour] of [[10, "good"], [4, "warn"], [1, "bad"]] as const) {
      const { ctx, styles } = mockCtx();
      art.drawHpBar(ctx, 0, 0, 50, 6, hp, 10);
      assert.equal(styles[styles.length - 1], art.COLOURS[colour]);
    }
  });

  it("hides the boss once it is defeated", () => {
    const { ctx } = mockCtx();
    const out = art.drawBattleScene(ctx, 200, 240, { ...art.createBattle(pet()), bossHp: 0, result: "win" }, {});
    assert.equal(out.boss, null);
  });
});

describe("Boss Battle wiring", () => {
  it("sidebar.html has the picker button, panel and script after minigameArt", () => {
    for (const id of ["btn-mg-boss", "mg-boss", "boss-title", "boss-hp", "boss-history", "boss-log", "btn-boss-attack", "btn-boss-guard", "btn-boss-patch"]) {
      assert.ok(html.includes(`id="${id}"`), `sidebar.html lacks #${id}`);
    }
    const mg = html.indexOf("{{minigameArtUri}}"), boss = html.indexOf("{{bossArtUri}}"), js = html.indexOf("{{jsUri}}");
    assert.ok(mg >= 0 && mg < boss && boss < js);
  });

  it("sidebar.js runs the battle through bossArt and reports boss_battle", () => {
    for (const s of ["bossArt.createBattle(", "bossArt.battleTurn(", "bossArt.drawBattleScene(", 'sendPlayResult("boss_battle", result)']) {
      assert.ok(sidebarSource.includes(s), `${s} not used`);
    }
    const end = /function endBossBattle\([^)]*\) \{([\s\S]*?)\n  \}/.exec(sidebarSource);
    assert.ok(end && end[1].includes("mgClear()"));
    assert.match(sidebarSource, /function mgClear\(\) \{[\s\S]*?clearTimeout\(bossTimer\)/);
    assert.match(sidebarSource, /function playBossSteps[\s\S]*?if \(REDUCED_MOTION/);
  });

  it("only starts a battle against an unlocked boss and hides the button otherwise", () => {
    assert.ok(sidebarSource.includes("bossArt.createBattle(lastState, bossRng, pending[0])"));
    assert.match(sidebarSource, /function startBossBattle\(\) \{[\s\S]*?if \(pending\.length === 0\) \{ return; \}/);
    assert.match(sidebarSource, /function updateBossButton[\s\S]*?btn\.classList\.toggle\("hidden", pending === 0\)/);
    assert.match(html, /class="[^"]*\bhidden\b[^"]*" id="btn-mg-boss"/, "hidden until the first state arrives");
  });

  it("both hosts load bossArt.js", () => {
    const provider = fs.readFileSync(path.join(repo, "vscode/src/sidebarProvider.ts"), "utf8");
    assert.ok(provider.includes('"bossArt.js"') && provider.includes("{{bossArtUri}}"));
    const gradle = fs.readFileSync(path.join(repo, "pycharm/build.gradle.kts"), "utf8");
    assert.ok(gradle.includes('"bossArt.js"'));
    const panel = fs.readFileSync(path.join(repo, "pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt"), "utf8");
    assert.ok(panel.includes('loadResource("/webview/bossArt.js")') && panel.includes("{{bossArtUri}}"));
  });
});
