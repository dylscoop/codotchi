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
  let b = art.createBattle(p);
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
    assert.equal(art.createBattle(null).bossId, "syntax_wraith");
  });
});

describe("battle turns (bossArt.js)", () => {
  it("the seeded RNG is repeatable", () => {
    const a = art.makeRng(42), b = art.makeRng(42);
    for (let i = 0; i < 5; i++) { assert.equal(a(), b()); }
  });

  it("Attack damages the boss and the boss hits back", () => {
    const b0 = art.createBattle(pet());
    const b1 = art.battleTurn(b0, "attack", art.makeRng(1));
    assert.ok(b1.bossHp < b0.bossHp);
    assert.ok(b1.petHp < b0.petHp);
    assert.equal(b1.turn, 1);
    assert.equal(b0.turn, 0, "the old battle object is not changed");
  });

  it("Defend blocks part of the boss's hit", () => {
    const b = art.battleTurn(art.createBattle(pet()), "defend", art.makeRng(3));
    assert.ok(b.lastBoss.blocked > 0);
    assert.equal(b.bossHp, b.bossMaxHp);
  });

  it("Debug heals and then cools down", () => {
    const hurt = { ...art.createBattle(pet()), petHp: 5 };
    const b = art.battleTurn(hurt, "debug", art.makeRng(4));
    assert.equal(b.lastPet.action, "debug");
    assert.ok(b.lastPet.heal > 0);
    assert.equal(b.debugCooldown, art.DEBUG_COOLDOWN);
    assert.equal(art.canDebug(b), false);
    const again = art.battleTurn(b, "debug", art.makeRng(5));
    assert.equal(again.lastPet.action, "defend", "Debug on cooldown falls back to Defend");
  });

  it("the boss does not strike once it is defeated", () => {
    const nearlyDead = { ...art.createBattle(pet()), bossHp: 1 };
    const b = art.battleTurn(nearlyDead, "attack", art.makeRng(6));
    assert.equal(b.result, "win");
    assert.equal(b.lastBoss, null);
    assert.equal(b.petHp, nearlyDead.petHp);
  });

  it("finished battles ignore further turns", () => {
    const done = { ...art.createBattle(pet()), result: "lose" };
    assert.equal(art.battleTurn(done, "attack", art.makeRng(7)), done);
  });

  it("every battle ends within the turn limit", () => {
    for (let seed = 0; seed < 50; seed++) {
      const b = playOut(pet(), seed, () => "defend");
      assert.ok(b.turn <= art.MAX_TURNS);
      assert.equal(b.result, "lose", "only defending never wins");
    }
  });

  it("is winnable but not a sure thing for an average level-1 pet", () => {
    let wins = 0, turns = 0;
    const smart = (b: any) => (b.petHp < b.pet.maxHp * 0.35 && art.canDebug(b) ? "debug" : "attack");
    for (let seed = 0; seed < 200; seed++) {
      const b = playOut(pet(), seed, smart);
      if (b.result === "win") { wins++; }
      turns += b.turn;
    }
    assert.ok(wins > 100 && wins < 200, `won ${wins}/200`);
    const avg = turns / 200;
    assert.ok(avg >= 3 && avg <= 7, `average ${avg} turns`);
  });

  it("a well cared-for pet wins more often than a neglected one", () => {
    const smart = (b: any) => (b.petHp < b.pet.maxHp * 0.35 && art.canDebug(b) ? "debug" : "attack");
    const winsFor = (p: Record<string, unknown>) => {
      let w = 0;
      for (let seed = 0; seed < 200; seed++) { if (playOut(p, seed, smart).result === "win") { w++; } }
      return w;
    };
    const cared = winsFor(pet({ health: 100, energy: 100, discipline: 100, happiness: 100 }));
    const neglected = winsFor(pet({ health: 10, energy: 30, discipline: 10, happiness: 10 }));
    assert.ok(cared > neglected, `cared ${cared} vs neglected ${neglected}`);
  });

  it("higher tiers stay winnable for pets at that level", () => {
    const smart = (b: any) => (b.petHp < b.pet.maxHp * 0.35 && art.canDebug(b) ? "debug" : "attack");
    for (const level of [5, 10, 20]) {
      let wins = 0;
      for (let seed = 0; seed < 200; seed++) { if (playOut(pet({ petLevel: level }), seed, smart).result === "win") { wins++; } }
      assert.ok(wins > 60 && wins < 200, `level ${level}: won ${wins}/200`);
    }
  });

  it("describes each turn in plain text", () => {
    const b = art.battleTurn(art.createBattle(pet()), "attack", art.makeRng(8));
    const text = art.describeTurn(b, "Pixel");
    assert.match(text, /^Pixel hits for \d+/);
    assert.match(text, /Syntax Wraith strikes for \d+/);
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
    for (const id of ["btn-mg-boss", "mg-boss", "boss-title", "boss-hp", "boss-log", "btn-boss-attack", "btn-boss-defend", "btn-boss-debug"]) {
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

  it("both hosts load bossArt.js", () => {
    const provider = fs.readFileSync(path.join(repo, "vscode/src/sidebarProvider.ts"), "utf8");
    assert.ok(provider.includes('"bossArt.js"') && provider.includes("{{bossArtUri}}"));
    const gradle = fs.readFileSync(path.join(repo, "pycharm/build.gradle.kts"), "utf8");
    assert.ok(gradle.includes('"bossArt.js"'));
    const panel = fs.readFileSync(path.join(repo, "pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt"), "utf8");
    assert.ok(panel.includes('loadResource("/webview/bossArt.js")') && panel.includes("{{bossArtUri}}"));
  });
});
