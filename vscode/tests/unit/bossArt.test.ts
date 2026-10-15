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

  it("health scales HP, energy attack, discipline Defend and happiness Debug", () => {
    const low = art.petBattleStats(pet({ health: 0, energy: 0, discipline: 0, happiness: 0 }));
    const high = art.petBattleStats(pet({ health: 100, energy: 100, discipline: 100, happiness: 100 }));
    assert.ok(high.maxHp > low.maxHp);
    assert.ok(high.attack[1] > low.attack[1]);
    assert.ok(high.block > low.block);
    assert.ok(high.heal > low.heal);
  });

  it("treats a missing level as level 1", () => {
    assert.equal(art.petBattleStats({}).level, 1);
    assert.equal(art.createBattle(null, art.makeRng(1)).bossId, "syntax_wraith");
  });
});

describe("battle turns (bossArt.js)", () => {
  /** A fresh battle with the boss's next move fixed. */
  const battle = (intent: string, over: Record<string, unknown> = {}, p = pet()) =>
    ({ ...art.createBattle(p, art.makeRng(0)), intent, ...over });

  it("the seeded RNG is repeatable", () => {
    const a = art.makeRng(42), b = art.makeRng(42);
    for (let i = 0; i < 5; i++) { assert.equal(a(), b()); }
  });

  it("fights the unlocked boss, scaled to the pet's level", () => {
    const b = art.createBattle(pet({ petLevel: 12 }), art.makeRng(1), "syntax_wraith");
    assert.equal(b.bossId, "syntax_wraith");
    assert.equal(b.bossMaxHp, art.bossMaxHp(art.BOSSES[0], 12));
    assert.equal(art.createBattle(pet({ petLevel: 12 }), art.makeRng(1)).bossId, "stackoverflow_behemoth");
    assert.ok(art.MOVES[b.intent], "a battle starts with a shown move");
  });

  it("Attack damages the boss and a Strike hits back", () => {
    const b0 = battle("strike");
    const b1 = art.battleTurn(b0, "attack", art.makeRng(1));
    assert.ok(b1.bossHp < b0.bossHp);
    assert.ok(b1.petHp < b0.petHp);
    assert.equal(b1.lastBoss.move, "strike");
    assert.equal(b1.turn, 1);
    assert.equal(b0.turn, 0, "the old battle object is not changed");
    assert.ok(art.MOVES[b1.intent], "the boss shows its next move");
  });

  it("Defend blocks part of a Strike and builds Focus", () => {
    const b = art.battleTurn(battle("strike"), "defend", art.makeRng(3));
    assert.ok(b.lastBoss.blocked > 0);
    assert.equal(b.bossHp, b.bossMaxHp);
    assert.equal(b.focus, true);
  });

  it("a Focus attack does double damage and breaks the Shield", () => {
    const plain = art.battleTurn(battle("strike"), "attack", art.makeRng(9));
    const focused = art.battleTurn(battle("strike", { focus: true, shield: true }), "attack", art.makeRng(9));
    assert.equal(focused.lastPet.damage, plain.lastPet.damage * 2);
    assert.equal(focused.shield, false);
    assert.equal(focused.focus, false);
    assert.ok(focused.lastPet.brokeShield);
  });

  it("a Shield halves normal attacks; Debug strips it", () => {
    const raised = art.battleTurn(battle("shield"), "defend", art.makeRng(2));
    assert.equal(raised.shield, true);
    assert.equal(raised.focus, false, "nothing to block, so no Focus");
    const plain = art.battleTurn(battle("strike"), "attack", art.makeRng(9));
    const shielded = art.battleTurn(battle("strike", { shield: true }), "attack", art.makeRng(9));
    assert.equal(shielded.lastPet.damage, Math.round(plain.lastPet.damage / 2));
    const stripped = art.battleTurn(battle("strike", { shield: true }), "debug", art.makeRng(4));
    assert.equal(stripped.shield, false);
  });

  it("Defend blocks most of a Charge; ignoring it hurts", () => {
    const guarded = art.battleTurn(battle("charge"), "defend", art.makeRng(5));
    const hit = art.battleTurn(battle("charge"), "attack", art.makeRng(5));
    assert.ok(guarded.lastBoss.blocked > guarded.lastBoss.damage);
    assert.ok(hit.lastBoss.damage > 2 * guarded.lastBoss.damage);
  });

  it("Corrupt plants a bug that drains HP for a few turns; Debug clears it", () => {
    let b = art.battleTurn(battle("corrupt"), "attack", art.makeRng(6));
    assert.equal(b.corrupt, art.CORRUPT_TURNS);
    assert.equal(b.lastBug, 0, "no drain on the turn it lands");
    b = art.battleTurn({ ...b, intent: "shield" }, "defend", art.makeRng(7));
    assert.ok(b.lastBug > 0);
    assert.equal(b.corrupt, art.CORRUPT_TURNS - 1);
    const cleaned = art.battleTurn({ ...b, intent: "shield" }, "debug", art.makeRng(8));
    assert.equal(cleaned.corrupt, 0);
    assert.equal(cleaned.lastBug, 0);
    assert.ok(cleaned.lastPet.cleansed);
  });

  it("the bug wears off", () => {
    let b = battle("shield", { corrupt: 1 });
    b = art.battleTurn(b, "defend", art.makeRng(1));
    assert.equal(b.corrupt, 0);
  });

  it("Debug heals and then cools down", () => {
    const hurt = battle("shield", { petHp: 5 });
    const b = art.battleTurn(hurt, "debug", art.makeRng(4));
    assert.equal(b.lastPet.action, "debug");
    assert.ok(b.lastPet.heal > 0);
    assert.equal(b.debugCooldown, art.DEBUG_COOLDOWN);
    assert.equal(art.canDebug(b), false);
    const again = art.battleTurn(b, "debug", art.makeRng(5));
    assert.equal(again.lastPet.action, "defend", "Debug on cooldown falls back to Defend");
  });

  it("the boss does not strike once it is defeated", () => {
    const nearlyDead = battle("charge", { bossHp: 1 });
    const b = art.battleTurn(nearlyDead, "attack", art.makeRng(6));
    assert.equal(b.result, "win");
    assert.equal(b.lastBoss, null);
    assert.equal(b.petHp, nearlyDead.petHp);
  });

  it("finished battles ignore further turns", () => {
    const done = { ...battle("strike"), result: "lose" };
    assert.equal(art.battleTurn(done, "attack", art.makeRng(7)), done);
  });

  it("a shielded boss never shields again", () => {
    const rng = art.makeRng(3);
    for (let i = 0; i < 200; i++) { assert.notEqual(art.pickIntent(art.BOSSES[2], true, rng), "shield"); }
  });

  it("every battle ends within the turn limit", () => {
    for (let seed = 0; seed < 50; seed++) {
      const b = playOut(pet(), seed, () => "defend");
      assert.ok(b.turn <= art.MAX_TURNS);
      assert.equal(b.result, "lose", "only defending never wins");
    }
  });

  /** Reads the boss's shown move. */
  const smart = (b: any) => {
    if (b.intent === "charge") { return "defend"; }
    if ((b.corrupt > 0 || b.shield) && art.canDebug(b) && !b.focus) { return "debug"; }
    if (b.petHp < b.pet.maxHp * 0.35 && art.canDebug(b)) { return "debug"; }
    if (b.focus) { return "attack"; }
    if (b.intent === "strike" || b.intent === "corrupt") { return "defend"; }
    return "attack";
  };
  const winsAt = (level: number, pick: (b: any) => string, p: Record<string, unknown> = {}) => {
    let w = 0;
    for (let seed = 0; seed < 300; seed++) { if (playOut(pet({ petLevel: level, ...p }), seed, pick).result === "win") { w++; } }
    return w / 300;
  };

  it("reading the boss's moves beats spamming Attack at every milestone", () => {
    for (const level of [3, 5, 10, 15, 25]) {
      const spam = winsAt(level, () => "attack");
      const read = winsAt(level, smart);
      assert.ok(spam <= 0.3, `level ${level}: attack-only won ${spam}`);
      assert.ok(read >= 0.65 && read <= 0.95, `level ${level}: smart play won ${read}`);
      assert.ok(read - spam >= 0.45, `level ${level}: gap ${read - spam}`);
    }
  });

  it("a well cared-for pet wins more often than a neglected one", () => {
    const cared = winsAt(5, smart, { health: 100, energy: 100, discipline: 100, happiness: 100 });
    const neglected = winsAt(5, smart, { health: 10, energy: 30, discipline: 10, happiness: 10 });
    assert.ok(cared > neglected, `cared ${cared} vs neglected ${neglected}`);
  });

  it("describes each turn and the next move in plain text", () => {
    const b = art.battleTurn(battle("strike"), "attack", art.makeRng(8));
    const text = art.describeTurn(b, "Pixel");
    assert.match(text, /^Pixel hits for \d+/);
    assert.match(text, /Syntax Wraith strikes for \d+/);
    assert.match(art.describeIntent(battle("charge")), /^Next: Charge - .*Defend/);
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

  it("draws the shield ring, the next-move icon and the bug / focus markers", () => {
    const base = art.createBattle(pet(), art.makeRng(1), "syntax_wraith");
    const { ctx, styles } = mockCtx();
    art.drawBattleScene(ctx, 200, 240, { ...base, intent: "charge", shield: true, corrupt: 2, focus: true }, {});
    assert.ok(styles.includes(art.INTENT_ICONS.charge.colour));
    assert.ok(styles.includes(art.INTENT_ICONS.shield.colour));
    assert.ok(styles.includes(art.INTENT_ICONS.corrupt.colour));
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
    for (const id of ["btn-mg-boss", "mg-boss", "boss-title", "boss-hp", "boss-intent", "boss-log", "btn-boss-attack", "btn-boss-defend", "btn-boss-debug"]) {
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

  it("only starts a battle against an unlocked boss and locks the button otherwise", () => {
    assert.ok(sidebarSource.includes("bossArt.createBattle(lastState, bossRng, pending[0])"));
    assert.match(sidebarSource, /function startBossBattle\(\) \{[\s\S]*?if \(pending\.length === 0\) \{ return; \}/);
    assert.match(sidebarSource, /function updateBossButton[\s\S]*?btn\.disabled = pending === 0/);
    // The webview's milestone rule must match isBossMilestone() in gameEngine.ts
    const core = fs.readFileSync(path.join(repo, "packages/core/src/gameEngine.ts"), "utf8");
    const rule = "level === 3 || level === 5 || (level >= 10 && level % 5 === 0)";
    assert.ok(core.includes(rule) && sidebarSource.includes(rule));
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
