/**
 * bossArt.js - Boss Battle rules and boss pixel art
 *
 * The turn-based Boss Battle mini-game: the three coding bosses, how the
 * pet's level and care stats turn into battle stats, one battle turn, and
 * the pixel art (boss sprites, HP bars, hit flash). The rules are pure
 * functions that take a random source, so they can be unit-tested with a
 * seeded RNG. No DOM access and no CSS variables (canvas ignores them).
 *
 * The sprites are placeholders until imported art replaces them; the Live
 * Bug Boss (FEATURES §2.8) is meant to reuse them.
 *
 * Exposes window.bossArt. Loaded before sidebar.js in VS Code and inlined by
 * CodotchiBrowserPanel.kt in PyCharm.
 */
(function () {
  "use strict";

  // =========================================================================
  // Bosses
  // =========================================================================

  /** Index 1 = body, 2 = dark detail, 3 = glow. */
  var BOSSES = [
    {
      id: "syntax_wraith", name: "Syntax Wraith", minLevel: 1,
      hp: 36, attack: [5, 9],
      colours: { 1: "#c9b8f0", 2: "#3a2a5e", 3: "#7fe0ff" },
      grid: [
        "................",
        ".....111111.....",
        "....11111111....",
        "...1111111111...",
        ".33112211221133.",
        ".3.1122112211.3.",
        "3..1111111111..3",
        ".3.1111221111.3.",
        ".33111111111133.",
        "...1111111111...",
        "...1111111111...",
        "...1111111111...",
        "...1111111111...",
        "...1.11..11.1...",
        "...1..1..1..1...",
        "................",
      ],
    },
    {
      id: "nullpointer_demon", name: "NullPointer Demon", minLevel: 5,
      hp: 36, attack: [5, 10],
      colours: { 1: "#d9413c", 2: "#2b0f12", 3: "#ffd23f" },
      grid: [
        "..2..........2..",
        "..22........22..",
        "...2211111122...",
        "....11111111....",
        "...1133113311...",
        "...1132112311...",
        "...1111111111...",
        "...1121221211...",
        "..111111111111..",
        ".11.11111111.11.",
        ".1..11111111..1.",
        "....11111111..22",
        "....111..111.22.",
        "....11....11....",
        "...111....111...",
        "................",
      ],
    },
    {
      id: "stackoverflow_behemoth", name: "StackOverflow Behemoth", minLevel: 10,
      hp: 38, attack: [5, 10],
      colours: { 1: "#6f7d8c", 2: "#2a3138", 3: "#ff9a3c" },
      grid: [
        ".....111111.....",
        ".....131131.....",
        ".....111111.....",
        "....11111111....",
        "....12222221....",
        "....11111111....",
        "...1111111111...",
        "...1222222221...",
        "...1111111111...",
        "..111111111111..",
        "..122222222221..",
        "..1111111111113.",
        ".111111111111113",
        ".122222222222213",
        ".11111111111111.",
        "..111......111..",
      ],
    },
  ];

  var BOSS_GRID = 16;

  /** Battle tuning. */
  var PET_BASE_HP = 30;
  var PET_HP_PER_LEVEL = 2;
  var PET_ATTACK = [6, 10];
  var PET_ATTACK_PER_LEVEL = 0.5;
  var CRIT_CHANCE = 0.15;
  var CRIT_MULT = 1.5;
  var DEFEND_BLOCK = 0.5;          // share of the next hit blocked, before discipline
  var DEBUG_HEAL_SHARE = 0.3;      // share of max HP healed by Debug
  var DEBUG_COOLDOWN = 2;          // turns before Debug can be used again
  var MAX_TURNS = 10;              // the boss wins if it is still standing after this
  var BOSS_HP_PER_LEVEL = 2.5;     // bosses grow with the pet so every tier stays a fight
  var BOSS_ATTACK_PER_LEVEL = 0.4;

  // =========================================================================
  // Rules
  // =========================================================================

  /** Seeded random source in [0, 1) (mulberry32), for tests and replays. */
  function makeRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /** Care modifier: a 0–100 stat maps to ×0.8 – ×1.2 (missing stats count as 50). */
  function careMod(stat) {
    var s = typeof stat === "number" && isFinite(stat) ? clamp(stat, 0, 100) : 50;
    return Math.round((0.8 + 0.4 * (s / 100)) * 1000) / 1000;
  }

  function petLevelOf(pet) {
    var lv = pet && typeof pet.petLevel === "number" ? Math.floor(pet.petLevel) : 1;
    return Math.max(1, lv);
  }

  /** The strongest boss whose tier the pet's level has reached. */
  function bossForLevel(level) {
    var pick = BOSSES[0];
    for (var i = 0; i < BOSSES.length; i++) {
      if (level >= BOSSES[i].minLevel) { pick = BOSSES[i]; }
    }
    return pick;
  }

  /** Boss max HP: the tier's base plus a share per pet level. */
  function bossMaxHp(boss, level) {
    return Math.round(boss.hp + (Math.max(1, level) - 1) * BOSS_HP_PER_LEVEL);
  }

  /** Boss attack range at this pet level. */
  function bossAttack(boss, level) {
    var bonus = Math.round((Math.max(1, level) - 1) * BOSS_ATTACK_PER_LEVEL);
    return [boss.attack[0] + bonus, boss.attack[1] + bonus];
  }

  /**
   * Pet battle stats. Level sets the base; health scales max HP, energy
   * scales attack, discipline scales Defend and happiness scales Debug
   * (each ×0.8 – ×1.2).
   */
  function petBattleStats(pet) {
    var level = petLevelOf(pet);
    var p = pet || {};
    var atkMod = careMod(p.energy);
    var bonus = (level - 1) * PET_ATTACK_PER_LEVEL;
    var maxHp = Math.round((PET_BASE_HP + (level - 1) * PET_HP_PER_LEVEL) * careMod(p.health));
    return {
      level: level,
      maxHp: maxHp,
      attack: [Math.max(1, Math.round((PET_ATTACK[0] + bonus) * atkMod)), Math.max(1, Math.round((PET_ATTACK[1] + bonus) * atkMod))],
      block: clamp(DEFEND_BLOCK * careMod(p.discipline), 0, 0.9),
      heal: Math.max(1, Math.round(maxHp * DEBUG_HEAL_SHARE * careMod(p.happiness))),
    };
  }

  /** A fresh battle for this pet. */
  function createBattle(pet) {
    var stats = petBattleStats(pet);
    var boss = bossForLevel(stats.level);
    var bossHp = bossMaxHp(boss, stats.level);
    return {
      bossId: boss.id,
      bossName: boss.name,
      bossHp: bossHp,
      bossMaxHp: bossHp,
      bossAttack: bossAttack(boss, stats.level),
      pet: stats,
      petHp: stats.maxHp,
      turn: 0,
      debugCooldown: 0,
      result: null,       // null while fighting, then "win" | "lose"
      lastPet: null,      // { action, damage?, heal?, crit? }
      lastBoss: null,     // { damage, blocked }
    };
  }

  function canDebug(battle) { return !battle.result && battle.debugCooldown === 0; }

  /**
   * Play one turn: the pet acts ("attack" | "defend" | "debug"), then the boss
   * hits back if it is still standing. Returns a new battle object.
   */
  function battleTurn(battle, action, rng) {
    if (battle.result) { return battle; }
    if (action === "debug" && !canDebug(battle)) { action = "defend"; }
    var b = {};
    for (var k in battle) { b[k] = battle[k]; }
    b.turn = battle.turn + 1;
    b.debugCooldown = Math.max(0, battle.debugCooldown - 1);
    b.lastBoss = null;

    var defending = false;
    if (action === "attack") {
      var dmg = randInt(rng, b.pet.attack[0], b.pet.attack[1]);
      var crit = rng() < CRIT_CHANCE;
      if (crit) { dmg = Math.round(dmg * CRIT_MULT); }
      b.bossHp = Math.max(0, b.bossHp - dmg);
      b.lastPet = { action: "attack", damage: dmg, crit: crit };
    } else if (action === "debug") {
      var healed = Math.min(b.pet.heal, b.pet.maxHp - b.petHp);
      b.petHp += healed;
      b.debugCooldown = DEBUG_COOLDOWN;
      b.lastPet = { action: "debug", heal: healed };
    } else {
      defending = true;
      b.lastPet = { action: "defend" };
    }

    if (b.bossHp <= 0) { b.result = "win"; return b; }

    var hit = randInt(rng, b.bossAttack[0], b.bossAttack[1]);
    var blocked = defending ? Math.round(hit * b.pet.block) : 0;
    var taken = hit - blocked;
    b.petHp = Math.max(0, b.petHp - taken);
    b.lastBoss = { damage: taken, blocked: blocked };

    if (b.petHp <= 0 || b.turn >= MAX_TURNS) { b.result = "lose"; }
    return b;
  }

  /** One line of battle text for the last turn. */
  function describeTurn(battle, petName) {
    var n = petName || "Your pet";
    var parts = [];
    var p = battle.lastPet;
    if (p) {
      if (p.action === "attack") { parts.push(n + " hits for " + p.damage + (p.crit ? " (critical!)" : "") + "."); }
      else if (p.action === "debug") { parts.push(n + " debugs and heals " + p.heal + " HP."); }
      else { parts.push(n + " braces for impact."); }
    }
    var h = battle.lastBoss;
    if (h) {
      parts.push(battle.bossName + " strikes for " + h.damage + (h.blocked ? " (" + h.blocked + " blocked)" : "") + ".");
    }
    if (battle.result === "win") { parts.push(battle.bossName + " is defeated!"); }
    else if (battle.result === "lose") {
      parts.push(battle.petHp <= 0 ? n + " is knocked out." : battle.bossName + " outlasts " + n + ".");
    }
    return parts.join(" ");
  }

  // =========================================================================
  // Drawing
  // =========================================================================

  var C = {
    bg:      "#1a1a2e",
    floor:   "#2e2e4a",
    barBack: "#2b2b3a",
    barEdge: "#0e0e18",
    good:    "#4caf50",
    warn:    "#e8c547",
    bad:     "#e05252",
    flash:   "#ffffff",
  };

  function bossById(id) {
    for (var i = 0; i < BOSSES.length; i++) { if (BOSSES[i].id === id) { return BOSSES[i]; } }
    return BOSSES[0];
  }

  /** Pixel unit for the boss sprite on a canvas of height H. */
  function bossPx(H) { return Math.max(1, Math.floor(H * 0.55 / BOSS_GRID)); }

  /**
   * Draw a boss sprite with its top-left at (x, y). flash paints every
   * pixel white (the hit frame).
   */
  function drawBoss(ctx, boss, x, y, px, flash) {
    ctx.save();
    for (var r = 0; r < boss.grid.length; r++) {
      var row = boss.grid[r];
      for (var c = 0; c < row.length; c++) {
        var idx = row.charAt(c);
        if (idx === ".") { continue; }
        ctx.fillStyle = flash ? C.flash : boss.colours[idx];
        ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
    ctx.restore();
    return { x: x, y: y, w: BOSS_GRID * px, h: BOSS_GRID * px };
  }

  function hpColour(share) { return share > 0.5 ? C.good : share > 0.25 ? C.warn : C.bad; }

  /** A pixel HP bar; fills hp / max of the inner width. */
  function drawHpBar(ctx, x, y, w, h, hp, max) {
    var share = max > 0 ? clamp(hp / max, 0, 1) : 0;
    ctx.save();
    ctx.fillStyle = C.barEdge;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.barBack;
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = hpColour(share);
    ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * share), h - 2);
    ctx.restore();
    return share;
  }

  /**
   * The battle scene on a W × H canvas: the boss centred above the floor,
   * its HP bar on top and the pet's HP bar at the bottom. opts.frame (0/1)
   * bobs the boss; opts.flash ("boss" | "pet") flashes whoever was just hit.
   */
  function drawBattleScene(ctx, W, H, battle, opts) {
    var o = opts || {};
    var boss = bossById(battle.bossId);
    var px = bossPx(H);
    var barH = Math.max(4, Math.floor(H * 0.06));
    var margin = Math.max(2, Math.floor(H * 0.04));
    ctx.save();
    ctx.fillStyle = o.flash === "pet" ? C.bad : C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, Math.floor(H * 0.78), W, H - Math.floor(H * 0.78));
    ctx.restore();

    drawHpBar(ctx, margin, margin, W - 2 * margin, barH, battle.bossHp, battle.bossMaxHp);
    var size = BOSS_GRID * px;
    var bx = Math.round((W - size) / 2);
    var by = Math.floor(H * 0.78) - size + (o.frame ? -px : 0);
    var sprite = battle.result === "win" ? null : drawBoss(ctx, boss, bx, by, px, o.flash === "boss");
    drawHpBar(ctx, margin, H - margin - barH, W - 2 * margin, barH, battle.petHp, battle.pet.maxHp);
    return { px: px, boss: sprite };
  }

  // =========================================================================
  // Exports
  // =========================================================================

  window.bossArt = {
    BOSSES:          BOSSES,
    BOSS_GRID:       BOSS_GRID,
    MAX_TURNS:       MAX_TURNS,
    DEBUG_COOLDOWN:  DEBUG_COOLDOWN,
    COLOURS:         C,
    makeRng:         makeRng,
    careMod:         careMod,
    bossForLevel:    bossForLevel,
    bossMaxHp:       bossMaxHp,
    bossAttack:      bossAttack,
    petBattleStats:  petBattleStats,
    createBattle:    createBattle,
    canDebug:        canDebug,
    battleTurn:      battleTurn,
    describeTurn:    describeTurn,
    bossPx:          bossPx,
    drawBoss:        drawBoss,
    drawHpBar:       drawHpBar,
    drawBattleScene: drawBattleScene,
  };
})();
