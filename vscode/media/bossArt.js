/**
 * bossArt.js - Boss Battle rules and boss pixel art
 *
 * The Boss Battle mini-game, a mind-game of hidden clashes: each round the
 * pet and the boss secretly pick Attack, Guard or Patch (Attack beats Patch,
 * Patch beats Guard, Guard beats Attack). Each boss picks from its own habit
 * table (and a rage table below 40% HP), never shown to the player. Also the
 * pixel art (boss sprites, HP bars, hit flash, stance icons). The rules are pure
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
      hp: 44, attack: [8, 12], reflect: 0.8,
      // Sneaky healer: Patches after you Attack, Guards after two Attacks, repeats a stance that lost.
      habits: function (c) {
        var w = c.lastPet === "attack" && c.prevPet === "attack" ? { attack: 15, guard: 65, patch: 20 }
          : c.lastPet === "attack" ? { attack: 20, guard: 30, patch: 50 } : { attack: 30, guard: 35, patch: 35 };
        if (c.lastOutcome === "win" && c.lastBoss) { w[c.lastBoss] += 20; }
        return w;
      },
      rage: function (c) { return c.lastPet === "attack" ? { attack: 15, guard: 45, patch: 40 } : { attack: 15, guard: 25, patch: 60 }; },
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
      hp: 50, attack: [7, 11], reflect: 0.7,
      // Aggressive: Attack-heavy, Patches after you Guard; never Patches when enraged.
      habits: function (c) {
        return c.lastPet === "guard" ? { attack: 30, guard: 20, patch: 50 } : { attack: 50, guard: 25, patch: 25 };
      },
      rage: function () { return { attack: 60, guard: 40, patch: 0 }; },
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
      hp: 48, attack: [7, 11], reflect: 0.8,
      // Turtle: Guard-heavy, Attacks after it Guards; enraged it alternates Guard and Patch.
      habits: function (c) {
        return c.lastBoss === "guard" ? { attack: 45, guard: 30, patch: 25 } : { attack: 35, guard: 40, patch: 25 };
      },
      rage: function (c) {
        return c.lastBoss === "guard" ? { attack: 15, guard: 15, patch: 70 } : { attack: 15, guard: 70, patch: 15 };
      },
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

  /** The three stances. Each beats the next one round: Attack > Patch > Guard > Attack. */
  var STANCES = ["attack", "guard", "patch"];
  var BEATS = { attack: "patch", patch: "guard", guard: "attack" };
  /** The stance that beats s. */
  function counterOf(s) { return s === "attack" ? "guard" : s === "guard" ? "patch" : "attack"; }

  /** Battle tuning. */
  var PET_BASE_HP = 32;
  var PET_HP_PER_LEVEL = 2;
  var PET_ATTACK = [8, 12];
  var PET_ATTACK_PER_LEVEL = 0.5;
  var REFLECT = 0.6;               // share of a blocked Attack a winning Guard sends back
  var PATCH_SHARE = 0.25;          // share of max HP a Patch heals (pet), before fatigue
  var BOSS_PATCH_SHARE = 0.12;     // share of max HP a Patch heals (boss), before fatigue
  var WIN_ATTACK_MULT = 1.8;       // Attack that wins (or lands on a Patch)
  var TIE_SHARE = 0.5;             // Attack/Attack and Patch/Patch ties
  var COMBO_AT = 2;                // wins in a row before the combo bonus kicks in
  var COMBO_MULT = 1.25;
  var FATIGUE_STEP = 0.75;         // each Patch heals this share of the one before
  var OVERTIME_ROUND = 12;         // from this round both sides take chip damage
  var OVERTIME_BASE = 3;           // overtime chip, +1 each later round
  var RAGE_SHARE = 0.4;            // a boss below this share of HP is enraged
  var SPAM_BONUS = 35;             // extra weight on the counter to your most-used recent stance
  var SPAM_WINDOW = 4;             // rounds looked back for that
  var HISTORY_SHOWN = 5;           // boss stances shown in the history strip
  var BOSS_HP_PER_LEVEL = 3;
  var BOSS_ATTACK_PER_LEVEL = 0.2;

  /** Stance labels for text. */
  var STANCE_LABELS = { attack: "Attack", guard: "Guard", patch: "Patch" };

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

  function bossById(id) {
    for (var i = 0; i < BOSSES.length; i++) { if (BOSSES[i].id === id) { return BOSSES[i]; } }
    return null;
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
   * scales Attack, discipline scales Guard's reflect and happiness scales
   * Patch (each ×0.8 – ×1.2). Care never decides who wins a clash.
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
      reflect: clamp(REFLECT * careMod(p.discipline), 0, 0.9),
      heal: Math.max(1, Math.round(maxHp * PATCH_SHARE * careMod(p.happiness))),
    };
  }

  /** A fresh battle against the unlocked boss (defaults to the pet's tier); its stats scale with the pet's level. */
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
      bossReflect: boss.reflect,
      bossHeal: Math.max(1, Math.round(bossHp * BOSS_PATCH_SHARE)),
      pet: stats,
      petHp: stats.maxHp,
      round: 0,
      petFatigue: 0,      // Patches used; each heals FATIGUE_STEP × the last
      bossFatigue: 0,
      petStreak: 0,       // clash wins in a row
      bossStreak: 0,
      petStances: [],     // every stance so far, oldest first
      bossStances: [],
      enraged: false,
      result: null,       // null while fighting, then "win" | "lose"
      last: null,         // the last clash, see battleTurn
    };
  }

  function isEnraged(b) { return b.bossHp < b.bossMaxHp * RAGE_SHARE; }

  /**
   * The boss's stance weights for the next clash, from its habit table, its
   * rage table below 40% HP, and a nudge towards countering the stance the
   * player has used most in the last few rounds. Never shown to the player.
   */
  function bossWeights(b) {
    var boss = bossById(b.bossId) || BOSSES[0];
    var ctx = {
      round: b.round,
      lastPet: b.petStances.length ? b.petStances[b.petStances.length - 1] : null,
      prevPet: b.petStances.length > 1 ? b.petStances[b.petStances.length - 2] : null,
      lastBoss: b.bossStances.length ? b.bossStances[b.bossStances.length - 1] : null,
      lastOutcome: b.last ? b.last.outcome : null,   // from the pet's side
    };
    var raw = isEnraged(b) ? boss.rage(ctx) : boss.habits(ctx);
    var w = {}, total = 0, i;
    for (i = 0; i < STANCES.length; i++) { total += raw[STANCES[i]] || 0; }
    for (i = 0; i < STANCES.length; i++) { w[STANCES[i]] = total > 0 ? 100 * (raw[STANCES[i]] || 0) / total : 100 / 3; }
    var recent = b.petStances.slice(-SPAM_WINDOW);
    if (recent.length >= 2) {
      var counts = { attack: 0, guard: 0, patch: 0 }, top = null;
      for (i = 0; i < recent.length; i++) { counts[recent[i]]++; }
      for (i = 0; i < STANCES.length; i++) { if (!top || counts[STANCES[i]] > counts[top]) { top = STANCES[i]; } }
      if (counts[top] >= 2) { w[counterOf(top)] += SPAM_BONUS * (counts[top] - 1); }
    }
    return w;
  }

  function pickStance(weights, rng) {
    var total = 0, i;
    for (i = 0; i < STANCES.length; i++) { total += weights[STANCES[i]]; }
    var r = rng() * total;
    for (i = 0; i < STANCES.length; i++) {
      r -= weights[STANCES[i]];
      if (r < 0) { return STANCES[i]; }
    }
    return STANCES[STANCES.length - 1];
  }

  /** "win" | "lose" | "tie", from the pet's side. */
  function clashOutcome(pet, boss) {
    return pet === boss ? "tie" : BEATS[pet] === boss ? "win" : "lose";
  }

  /**
   * Play one clash: the pet's stance against the boss's secret stance, then
   * overtime chip damage from round 12. Returns a new battle object; last
   * holds { pet, boss, outcome, toBoss, toPet, petHeal, bossHeal, overtime, combo }.
   */
  function battleTurn(battle, stance, rng) {
    if (battle.result) { return battle; }
    return resolveClash(battle, stance, pickStance(bossWeights(battle), rng), rng);
  }

  /** Resolve one clash with both stances known (battleTurn picks the boss's in secret). */
  function resolveClash(battle, stance, bossStance, rng) {
    if (battle.result) { return battle; }
    if (!BEATS[stance]) { stance = "guard"; }
    var b = {};
    for (var k in battle) { b[k] = battle[k]; }
    var outcome = clashOutcome(stance, bossStance);
    b.round = battle.round + 1;
    b.petStances = battle.petStances.concat([stance]);
    b.bossStances = battle.bossStances.concat([bossStance]);

    var petCombo = outcome === "win" && battle.petStreak >= COMBO_AT;
    var bossCombo = outcome === "lose" && battle.bossStreak >= COMBO_AT;
    var pMult = petCombo ? COMBO_MULT : 1;
    var bMult = bossCombo ? COMBO_MULT : 1;
    var petRoll = function () { return randInt(rng, b.pet.attack[0], b.pet.attack[1]); };
    var bossRoll = function () { return randInt(rng, b.bossAttack[0], b.bossAttack[1]); };
    var petPatch = function () { return Math.max(1, Math.round(b.pet.heal * Math.pow(FATIGUE_STEP, b.petFatigue))); };
    var bossPatch = function () { return Math.max(1, Math.round(b.bossHeal * Math.pow(FATIGUE_STEP, b.bossFatigue))); };
    var toBoss = 0, toPet = 0, petHeal = 0, bossHeal = 0;

    if (outcome === "tie") {
      if (stance === "attack") {
        toBoss = Math.round(petRoll() * TIE_SHARE);
        toPet = Math.round(bossRoll() * TIE_SHARE);
      } else if (stance === "patch") {
        petHeal = Math.round(petPatch() * TIE_SHARE);
        bossHeal = Math.round(bossPatch() * TIE_SHARE);
        b.petFatigue++;
        b.bossFatigue++;
      }
    } else if (outcome === "win") {
      if (stance === "attack") { toBoss = Math.round(petRoll() * WIN_ATTACK_MULT * pMult); }       // vs Patch: its heal is cancelled
      else if (stance === "guard") { toBoss = Math.round(bossRoll() * b.pet.reflect * pMult); }   // vs Attack: blocked and reflected
      else { petHeal = Math.round(petPatch() * pMult); }                                          // vs Guard: a free heal, no fatigue
    } else {
      if (bossStance === "attack") { toPet = Math.round(bossRoll() * WIN_ATTACK_MULT * bMult); }
      else if (bossStance === "guard") { toPet = Math.round(petRoll() * b.bossReflect * bMult); }
      else { bossHeal = Math.round(bossPatch() * bMult); }
    }

    b.petStreak = outcome === "win" ? battle.petStreak + 1 : 0;
    b.bossStreak = outcome === "lose" ? battle.bossStreak + 1 : 0;
    b.bossHp = clamp(b.bossHp - toBoss, 0, b.bossMaxHp);
    b.petHp = clamp(b.petHp - toPet, 0, b.pet.maxHp);
    petHeal = Math.min(petHeal, b.pet.maxHp - b.petHp);
    bossHeal = Math.min(bossHeal, b.bossMaxHp - b.bossHp);
    if (b.petHp > 0) { b.petHp += petHeal; } else { petHeal = 0; }
    if (b.bossHp > 0) { b.bossHp += bossHeal; } else { bossHeal = 0; }

    var overtime = 0;
    if (b.round >= OVERTIME_ROUND && b.petHp > 0 && b.bossHp > 0) {
      overtime = OVERTIME_BASE + (b.round - OVERTIME_ROUND);
      b.petHp = Math.max(0, b.petHp - overtime);
      b.bossHp = Math.max(0, b.bossHp - overtime);
    }

    b.enraged = isEnraged(b);
    b.last = {
      pet: stance, boss: bossStance, outcome: outcome,
      toBoss: toBoss, toPet: toPet, petHeal: petHeal, bossHeal: bossHeal,
      overtime: overtime, combo: petCombo || bossCombo,
    };
    // Both down at once counts as a loss.
    if (b.petHp <= 0) { b.result = "lose"; }
    else if (b.bossHp <= 0) { b.result = "win"; }
    return b;
  }

  /** The boss's last few stances, oldest first, for the history strip. */
  function bossHistory(battle) { return battle.bossStances.slice(-HISTORY_SHOWN); }

  function shortName(battle) { return battle.bossName.split(" ").slice(-1)[0]; }

  /** One line for the last clash, e.g. "Wraith Patched - your Attack broke through! (-14)". */
  function describeTurn(battle, petName) {
    var n = petName || "Your pet";
    var c = battle.last;
    if (!c) { return ""; }
    var boss = shortName(battle);
    var did = { attack: " Attacked", guard: " Guarded", patch: " Patched" }[c.boss];
    var line;
    if (c.outcome === "tie") {
      line = c.pet === "attack" ? "Both Attacked - " + n + " -" + c.toPet + ", " + boss + " -" + c.toBoss + "."
        : c.pet === "patch" ? "Both Patched - " + n + " +" + c.petHeal + ", " + boss + " +" + c.bossHeal + "."
        : "Both Guarded - nothing happens.";
    } else if (c.outcome === "win") {
      line = boss + did + " - " + (
        c.pet === "attack" ? "your Attack broke through! (-" + c.toBoss + ")"
        : c.pet === "guard" ? n + " blocked and reflected it! (-" + c.toBoss + ")"
        : n + " Patched behind its Guard! (+" + c.petHeal + ")");
    } else {
      line = boss + did + " - " + (
        c.boss === "attack" ? "it smashed through " + n + "'s Patch! (-" + c.toPet + ")"
        : c.boss === "guard" ? "it blocked and reflected " + n + "'s Attack! (-" + c.toPet + ")"
        : "it Patched while " + n + " Guarded. (+" + c.bossHeal + ")");
    }
    if (c.combo) { line += " Combo!"; }
    if (c.overtime) { line += " Overtime: both take " + c.overtime + "."; }
    if (battle.result === "win") { line += " You defeated " + battle.bossName + "!"; }
    else if (battle.result === "lose") { line += " " + battle.bossName + " won this time - it'll be waiting."; }
    return line;
  }

  // =========================================================================
  // Drawing
  // =========================================================================

  var C = {
    bg:      "#1a1a2e",
    rage:    "#3a1420",
    floor:   "#2e2e4a",
    barBack: "#2b2b3a",
    barEdge: "#0e0e18",
    good:    "#4caf50",
    warn:    "#e8c547",
    bad:     "#e05252",
    flash:   "#ffffff",
    heal:    "#7dffa0",
  };

  /** Pixel unit for the boss sprite on a canvas of height H. */
  function bossPx(H) { return Math.max(1, Math.floor(H * 0.55 / BOSS_GRID)); }

  /** Draw a boss sprite with its top-left at (x, y). flash paints every pixel white (the hit frame). */
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

  /** 5×5 stance icons: "1" = ink in the icon's colour. */
  var STANCE_ICONS = {
    attack: { colour: "#e05252", rows: ["00011", "00110", "01100", "11000", "10000"] },   // blade
    guard:  { colour: "#5b8bd6", rows: ["11111", "11111", "11111", "01110", "00100"] },   // shield
    patch:  { colour: "#7dffa0", rows: ["00100", "00100", "11111", "00100", "00100"] },   // plus
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

  /** A few green pixels round a point: the heal sparkle. */
  function drawSparkle(ctx, x, y, px) {
    ctx.save();
    ctx.fillStyle = C.heal;
    var dots = [[0, -3], [-3, 0], [3, 0], [0, 3], [-2, -2], [2, 2]];
    for (var i = 0; i < dots.length; i++) { ctx.fillRect(x + dots[i][0] * px, y + dots[i][1] * px, px, px); }
    ctx.restore();
  }

  /**
   * The battle scene on a W × H canvas: the boss centred above the floor
   * (red-tinted while enraged), its HP bar and stance history on top, the
   * pet's HP bar at the bottom, and after a clash both stances side by side
   * (pet left, boss right). opts.frame (0/1) bobs the boss; opts.flash
   * ("boss" | "pet") flashes whoever was just hit; opts.reveal shows the
   * last clash's stances; opts.sparkle ("boss" | "pet") draws a heal sparkle.
   */
  function drawBattleScene(ctx, W, H, battle, opts) {
    var o = opts || {};
    var boss = bossById(battle.bossId) || BOSSES[0];
    var px = bossPx(H);
    var barH = Math.max(4, Math.floor(H * 0.06));
    var margin = Math.max(2, Math.floor(H * 0.04));
    var floorY = Math.floor(H * 0.78);
    ctx.save();
    ctx.fillStyle = o.flash === "pet" ? C.bad : battle.enraged ? C.rage : C.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.restore();

    drawHpBar(ctx, margin, margin, W - 2 * margin, barH, battle.bossHp, battle.bossMaxHp);
    var ipx = Math.max(1, Math.floor(barH / 3));
    var hist = bossHistory(battle);
    for (var i = 0; i < hist.length; i++) {
      drawIcon(ctx, STANCE_ICONS[hist[i]], margin + i * 6 * ipx, margin + barH + ipx, ipx);
    }

    var size = BOSS_GRID * px;
    var bx = Math.round((W - size) / 2);
    var by = floorY - size + (o.frame ? -px : 0);
    var sprite = battle.result === "win" ? null : drawBoss(ctx, boss, bx, by, px, o.flash === "boss");
    if (o.sparkle === "boss" && sprite) { drawSparkle(ctx, bx + size, by + px * 3, px); }

    var petBarY = H - margin - barH;
    drawHpBar(ctx, margin, petBarY, W - 2 * margin, barH, battle.petHp, battle.pet.maxHp);
    if (o.sparkle === "pet") { drawSparkle(ctx, margin + 4 * px, petBarY - 4 * px, px); }

    if (o.reveal && battle.last) {
      var rpx = Math.max(1, Math.floor(px * 0.9));
      var ry = floorY - 6 * rpx;
      drawIcon(ctx, STANCE_ICONS[battle.last.pet], margin, ry, rpx);
      drawIcon(ctx, STANCE_ICONS[battle.last.boss], W - margin - 5 * rpx, ry, rpx);
    }
    return { px: px, boss: sprite };
  }

  // =========================================================================
  // Exports
  // =========================================================================

  window.bossArt = {
    BOSSES:          BOSSES,
    BOSS_GRID:       BOSS_GRID,
    STANCES:         STANCES,
    STANCE_LABELS:   STANCE_LABELS,
    STANCE_ICONS:    STANCE_ICONS,
    OVERTIME_ROUND:  OVERTIME_ROUND,
    RAGE_SHARE:      RAGE_SHARE,
    COMBO_AT:        COMBO_AT,
    COMBO_MULT:      COMBO_MULT,
    FATIGUE_STEP:    FATIGUE_STEP,
    COLOURS:         C,
    makeRng:         makeRng,
    careMod:         careMod,
    counterOf:       counterOf,
    clashOutcome:    clashOutcome,
    bossById:        bossById,
    bossForLevel:    bossForLevel,
    bossMaxHp:       bossMaxHp,
    bossAttack:      bossAttack,
    petBattleStats:  petBattleStats,
    createBattle:    createBattle,
    bossWeights:     bossWeights,
    battleTurn:      battleTurn,
    resolveClash:    resolveClash,
    bossHistory:     bossHistory,
    describeTurn:    describeTurn,
    bossPx:          bossPx,
    drawBoss:        drawBoss,
    drawHpBar:       drawHpBar,
    drawBattleScene: drawBattleScene,
  };
})();
