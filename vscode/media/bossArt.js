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
      hp: 42, attack: [5, 9],
      moves: { strike: 4, corrupt: 3, charge: 1, shield: 1 },
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
      hp: 46, attack: [5, 9],
      moves: { strike: 4, charge: 2, corrupt: 1, shield: 1 },
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
      hp: 54, attack: [5, 9],
      moves: { strike: 4, shield: 2, charge: 1, corrupt: 1 },
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
  var MAX_TURNS = 11;              // the boss wins if it is still standing after this
  var BOSS_HP_PER_LEVEL = 4;       // bosses grow with the pet so every tier stays a fight
  var BOSS_ATTACK_PER_LEVEL = 0.2;
  var CHARGE_MULT = 2;             // a Charge hit, telegraphed a turn ahead
  var CHARGE_GUARD = 0.35;         // extra share Defend blocks against a Charge
  var CORRUPT_HIT_SHARE = 0.5;     // Corrupt's own hit, as a share of a Strike
  var CORRUPT_TURNS = 3;           // turns the Corrupt bug keeps draining HP
  var CORRUPT_TICK = 3;            // HP drained per turn by the bug (+ 0.2 per pet level)
  var SHIELD_SHARE = 0.5;          // share of attack damage that gets through a Shield
  var FOCUS_MULT = 2;              // a Focus attack after a successful Defend

  /** What each boss move does, for the intent hint shown before the player acts. */
  var MOVES = {
    strike:  { label: "Strike",  hint: "attacks normally" },
    charge:  { label: "Charge",  hint: "winds up a huge hit (Defend!)" },
    corrupt: { label: "Corrupt", hint: "plants a bug that drains HP (Debug clears it)" },
    shield:  { label: "Shield",  hint: "raises a shield that halves your attacks (Debug or a Focus attack breaks it)" },
  };

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

  function bossById(id) {
    for (var i = 0; i < BOSSES.length; i++) { if (BOSSES[i].id === id) { return BOSSES[i]; } }
    return null;
  }

  /** Weighted pick of the boss's next move. A boss that is already shielded doesn't shield again. */
  function pickIntent(boss, shielded, rng) {
    var weights = boss.moves;
    var total = 0, k;
    for (k in weights) { if (!(shielded && k === "shield")) { total += weights[k]; } }
    var r = rng() * total;
    for (k in weights) {
      if (shielded && k === "shield") { continue; }
      r -= weights[k];
      if (r < 0) { return k; }
    }
    return "strike";
  }

  /**
   * A fresh battle for this pet. bossId picks the unlocked boss (defaults to
   * the tier for the pet's level); its stats still scale with the pet's level.
   */
  function createBattle(pet, rng, bossId) {
    var stats = petBattleStats(pet);
    var boss = bossById(bossId) || bossForLevel(stats.level);
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
      intent: pickIntent(boss, false, rng || Math.random),  // the boss's next move, shown to the player
      focus: false,       // set by a Defend that blocked a hit; doubles the next Attack
      shield: false,      // the boss's Shield is up
      corrupt: 0,         // turns left on the Corrupt bug
      result: null,       // null while fighting, then "win" | "lose"
      lastPet: null,      // { action, damage?, heal?, crit?, focus?, shielded?, cleansed? }
      lastBoss: null,     // { move, damage, blocked }
      lastBug: 0,         // HP the bug drained this turn
    };
  }

  function canDebug(battle) { return !battle.result && battle.debugCooldown === 0; }

  /**
   * Play one turn: the pet acts ("attack" | "defend" | "debug"), then the boss
   * carries out the move it showed (if it is still standing), the Corrupt bug
   * drains HP, and the boss picks its next move. Returns a new battle object.
   */
  function battleTurn(battle, action, rng) {
    if (battle.result) { return battle; }
    if (action === "debug" && !canDebug(battle)) { action = "defend"; }
    var boss = bossById(battle.bossId) || BOSSES[0];
    var b = {};
    for (var k in battle) { b[k] = battle[k]; }
    b.turn = battle.turn + 1;
    b.debugCooldown = Math.max(0, battle.debugCooldown - 1);
    b.lastBoss = null;
    b.lastBug = 0;

    var defending = false;
    if (action === "attack") {
      var dmg = randInt(rng, b.pet.attack[0], b.pet.attack[1]);
      var crit = rng() < CRIT_CHANCE;
      if (crit) { dmg = Math.round(dmg * CRIT_MULT); }
      var focused = b.focus;
      var shielded = b.shield && !focused;
      if (focused) { dmg = Math.round(dmg * FOCUS_MULT); b.focus = false; b.shield = false; }
      if (shielded) { dmg = Math.max(1, Math.round(dmg * SHIELD_SHARE)); }
      b.bossHp = Math.max(0, b.bossHp - dmg);
      b.lastPet = { action: "attack", damage: dmg, crit: crit, focus: focused, shielded: shielded, brokeShield: focused && battle.shield };
    } else if (action === "debug") {
      var healed = Math.min(b.pet.heal, b.pet.maxHp - b.petHp);
      b.petHp += healed;
      b.debugCooldown = DEBUG_COOLDOWN;
      b.lastPet = { action: "debug", heal: healed, cleansed: b.corrupt > 0, unshielded: b.shield };
      b.corrupt = 0;
      b.shield = false;
    } else {
      defending = true;
      b.lastPet = { action: "defend" };
    }

    if (b.bossHp <= 0) { b.result = "win"; return b; }

    var move = b.intent;
    var strike = randInt(rng, b.bossAttack[0], b.bossAttack[1]);
    var hit = 0;
    if (move === "strike") { hit = strike; }
    else if (move === "charge") { hit = Math.round(strike * CHARGE_MULT); }
    else if (move === "corrupt") { hit = Math.round(strike * CORRUPT_HIT_SHARE); b.corrupt = CORRUPT_TURNS; }
    else if (move === "shield") { b.shield = true; }
    var share = defending ? (move === "charge" ? Math.min(0.95, b.pet.block + CHARGE_GUARD) : b.pet.block) : 0;
    var blocked = Math.round(hit * share);
    if (defending && hit > 0) { b.focus = true; }
    b.petHp = Math.max(0, b.petHp - (hit - blocked));
    b.lastBoss = { move: move, damage: hit - blocked, blocked: blocked };

    // The bug drains HP on the turns after it lands.
    if (battle.corrupt > 0 && b.corrupt > 0 && b.petHp > 0) {
      b.lastBug = Math.min(b.petHp, CORRUPT_TICK + Math.round(b.pet.level * 0.2));
      b.petHp -= b.lastBug;
      b.corrupt = move === "corrupt" ? CORRUPT_TURNS : battle.corrupt - 1;
    }

    if (b.petHp <= 0 || b.turn >= MAX_TURNS) { b.result = "lose"; return b; }
    b.intent = pickIntent(boss, b.shield, rng);
    return b;
  }

  /** One line of battle text for the last turn. */
  function describeTurn(battle, petName) {
    var n = petName || "Your pet";
    var parts = [];
    var p = battle.lastPet;
    if (p) {
      if (p.action === "attack") {
        parts.push(n + (p.focus ? " lands a focused hit for " : " hits for ") + p.damage +
          (p.crit ? " (critical!)" : "") + (p.shielded ? " through the shield" : "") + "." +
          (p.brokeShield ? " The shield shatters!" : ""));
      } else if (p.action === "debug") {
        parts.push(n + " debugs and heals " + p.heal + " HP" +
          (p.cleansed ? ", clearing the bug" : "") + (p.unshielded ? ", and strips the shield" : "") + ".");
      } else { parts.push(n + " braces for impact."); }
    }
    var h = battle.lastBoss;
    if (h) {
      if (h.move === "shield") { parts.push(battle.bossName + " raises a shield."); }
      else {
        parts.push(battle.bossName + (h.move === "charge" ? " unleashes a charged hit for " : h.move === "corrupt" ? " corrupts " + n + " for " : " strikes for ") +
          h.damage + (h.blocked ? " (" + h.blocked + " blocked)" : "") + ".");
      }
      if (p && p.action === "defend" && battle.focus && h.damage + h.blocked > 0) { parts.push(n + " is focused!"); }
    }
    if (battle.lastBug) { parts.push("The bug drains " + battle.lastBug + " HP."); }
    if (battle.result === "win") { parts.push(battle.bossName + " is defeated!"); }
    else if (battle.result === "lose") {
      parts.push(battle.petHp <= 0 ? n + " is knocked out." : battle.bossName + " outlasts " + n + ".");
    }
    return parts.join(" ");
  }

  /** The intent hint, e.g. "Next: Charge - winds up a huge hit (Defend!)". */
  function describeIntent(battle) {
    var m = MOVES[battle.intent];
    return m ? "Next: " + m.label + " - " + m.hint : "";
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
    var boss = bossById(battle.bossId) || BOSSES[0];
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
    if (sprite && battle.shield) { drawShieldRing(ctx, bx, by, size, px); }
    if (sprite && !battle.result && INTENT_ICONS[battle.intent]) {
      var ipx = Math.max(1, Math.floor(px * 0.75));
      drawIcon(ctx, INTENT_ICONS[battle.intent], bx + size + px, by, ipx);
    }
    var petBarY = H - margin - barH;
    drawHpBar(ctx, margin, petBarY, W - 2 * margin, barH, battle.petHp, battle.pet.maxHp);
    var spx = Math.max(1, Math.floor(barH / 4));
    var sx = margin;
    if (battle.corrupt > 0) { drawIcon(ctx, STATUS_ICONS.bug, sx, petBarY - 6 * spx, spx); sx += 6 * spx; }
    if (battle.focus) { drawIcon(ctx, STATUS_ICONS.focus, sx, petBarY - 6 * spx, spx); }
    return { px: px, boss: sprite };
  }

  /** 5×5 icons: "1" = ink in the icon's colour. */
  var INTENT_ICONS = {
    strike:  { colour: "#e05252", rows: ["00011", "00110", "01100", "11000", "10000"] },   // blade
    charge:  { colour: "#ff9a3c", rows: ["00110", "01100", "11111", "00110", "01100"] },   // bolt
    corrupt: { colour: "#a0e060", rows: ["10101", "01110", "11111", "01110", "10101"] },   // bug
    shield:  { colour: "#5b8bd6", rows: ["11111", "11111", "11111", "01110", "00100"] },   // shield
  };
  var STATUS_ICONS = {
    bug:   INTENT_ICONS.corrupt,
    focus: { colour: "#e8c547", rows: ["00100", "01110", "11111", "01110", "00100"] },
  };

  function drawIcon(ctx, icon, x, y, px) {
    ctx.save();
    ctx.fillStyle = icon.colour;
    for (var r = 0; r < icon.rows.length; r++) {
      for (var c = 0; c < icon.rows[r].length; c++) {
        if (icon.rows[r].charAt(c) === "1") { ctx.fillRect(x + c * px, y + r * px, px, px); }
      }
    }
    ctx.restore();
  }

  /** A pixel ring round the boss while its Shield is up. */
  function drawShieldRing(ctx, x, y, size, px) {
    ctx.save();
    ctx.fillStyle = INTENT_ICONS.shield.colour;
    ctx.fillRect(x - px, y - px, size + 2 * px, px);
    ctx.fillRect(x - px, y + size, size + 2 * px, px);
    ctx.fillRect(x - px, y, px, size);
    ctx.fillRect(x + size, y, px, size);
    ctx.restore();
  }

  // =========================================================================
  // Exports
  // =========================================================================

  window.bossArt = {
    BOSSES:          BOSSES,
    BOSS_GRID:       BOSS_GRID,
    MAX_TURNS:       MAX_TURNS,
    DEBUG_COOLDOWN:  DEBUG_COOLDOWN,
    CORRUPT_TURNS:   CORRUPT_TURNS,
    MOVES:           MOVES,
    INTENT_ICONS:    INTENT_ICONS,
    bossById:        bossById,
    pickIntent:      pickIntent,
    describeIntent:  describeIntent,
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
