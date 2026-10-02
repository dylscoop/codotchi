/**
 * backgroundArt.js - pixel-art sky, scenery, ground and weather for the pet canvas
 *
 * Draws the codotchi.background modes: plain, ordered (real month) and the
 * four fixed seasons. The sky blends between hourly keyframes, the sun follows
 * an arc, and each season has its own trees, ground, props and rare events
 * (critters, spring showers with a rainbow, winter snow spells). Everything is
 * drawn with fillRect on a whole-pixel unit, the same style as minigameArt.js.
 * No DOM access, and every function takes the date as a parameter, so the
 * module can be unit-tested against a mock context.
 *
 * Exposes window.backgroundArt. Loaded before sidebar.js in VS Code and
 * inlined by CodotchiBrowserPanel.kt in PyCharm.
 */
(function () {
  "use strict";

  // =========================================================================
  // Timing and chances
  // =========================================================================

  var RAIN_MS       = 3 * 60 * 1000;   // spring weather window
  var RAIN_CHANCE   = 0.18;            // chance a spring window is a shower
  var RAINBOW_MS    = 75 * 1000;       // rainbow length after a shower ends
  var SNOW_MS       = 4 * 60 * 1000;   // winter weather window
  var SNOW_CHANCE   = 0.4;             // chance a winter window has snowfall
  var NIGHT_INK     = "#0c1230";       // scenery is blended toward this at night
  var NIGHT_SHADE   = 0.55;            // how far scenery is blended at full darkness

  // codotchi.backgroundOpacity: how much of the pet's backdrop colour is laid
  // over the finished scene, as [full daylight, full night]. Night is already
  // dark, so it gets a lighter veil. Vivid is the scene at full strength.
  var VEIL = {
    vivid:  [0, 0],
    medium: [0.10, 0.05],
    subtle: [0.45, 0.15],
  };

  // Rare critters: one fly-past at most per window, only in a few windows.
  var CRITTERS = {
    bird:      { salt: 1, windowMs: 120000, chance: 0.20, durMs: 10000 },
    butterfly: { salt: 2, windowMs: 150000, chance: 0.20, durMs: 14000 },
    bee:       { salt: 3, windowMs: 120000, chance: 0.25, durMs: 12000 },
    fireflies: { salt: 4, windowMs:  90000, chance: 0.35, durMs: 30000 },
  };

  // =========================================================================
  // Sky keyframes: [hour, top colour, horizon colour]
  // =========================================================================

  // The sunrise uses the sunset colours and lasts the whole legacy dawn bucket (ends at 10:00).
  // Buckets: dawn 7–10 | morning 10–13 | afternoon 13–16 | sunset 16–19 | dusk 19–22 | night 22–7.
  var SKY_KEYS = [
    [0,    "#0b1030", "#1e2a58"],   // night
    [6,    "#0b1030", "#1e2a58"],
    [7,    "#26204e", "#8a4a78"],   // first light (mirrors dusk): the dawn bucket starts here
    [7.5,  "#4a4a8c", "#f08a48"],   // sunrise (mirrors sunset)
    [9,    "#4a4a8c", "#f08a48"],   // sunrise held
    [9.5,  "#6a86c4", "#e8a87a"],   // golden morning (mirrors golden hour)
    [10,   "#a9cdea", "#c4d4de"],   // soft pastel morning: the sunrise is over (horizon kept off-white so the pet reads)
    [12.5, "#8cc4ee", "#abd4f2"],   // midday
    [14.5, "#7ab4e6", "#9ac7eb"],   // afternoon
    [16,   "#6a86c4", "#e8a87a"],   // golden hour: the sunset bucket starts here
    [17.5, "#4a4a8c", "#f08a48"],   // sunset
    [19,   "#26204e", "#8a4a78"],   // dusk
    [22,   "#0b1030", "#1e2a58"],   // night
    [24,   "#0b1030", "#1e2a58"],
  ];

  // How dark the scene is (0 day … 1 night): brightens through the sunrise, darkens through dusk.
  var DARK_KEYS = [[0, 1], [6, 1], [8.5, 0], [16.5, 0], [21.5, 1], [24, 1]];

  var SKY_BANDS = 8;

  // =========================================================================
  // Grids (one character per pixel; "." is empty)
  // =========================================================================

  var SUN = [
    "..111..",
    ".12211.",
    "1221111",
    "1211111",
    "1111111",
    ".11111.",
    "..111..",
  ];

  var MOON = [
    "..1111.",
    ".111...",
    "111....",
    "111....",
    "111....",
    ".111...",
    "..1111.",
  ];

  var CLOUD_BIG = [
    ".....2222.....",
    "...22111122...",
    "..2111111112..",
    ".211111111111.",
    "21111111111112",
    "33333333333333",
  ];

  var CLOUD_SMALL = [
    "..2222..",
    ".211112.",
    "21111112",
    "33333333",
  ];

  // Leafy canopy (blossom, summer and autumn trees): 1 main, 2 shade, 3 light, 4 accent
  var CANOPY = [
    "...33311...",
    "..3311111..",
    ".331141111.",
    "31111111142",
    "11411111122",
    "11111141122",
    ".111111122.",
    "..2112222..",
    "...22222...",
  ];

  // Bare branches (winter snowy tree, autumn half-bare tree): b branch, 4 tip
  var BARE = [
    ".4.......4.",
    ".b..4..4.b.",
    "..b.b..b.b.",
    "..b..b.b...",
    "...b.b.b...",
    "....bbb....",
    "....bbb....",
    "....bbb....",
    "....bbb....",
  ];

  var TRUNK_ROWS = 5;   // trunk height below a CANOPY / BARE grid, in tree pixels

  // Snowy pine: 1 needles, 2 shade, s snow, L fairy light, t trunk
  var PINE = [
    "....s....",
    "...s1s...",
    "...1L2...",
    "..s111s..",
    "..L1122..",
    ".ss11Lss.",
    ".1L11122.",
    "s1s1L1s1s",
    "1L1111L22",
    "....t....",
    "....t....",
  ];

  // w snow, s shadow, k coal / hat, o carrot, r scarf, b stick arms
  var SNOWMAN = [
    "...kkk...",
    "..kkkkk..",
    "..wwwww..",
    "..wkwkw..",
    "..wwoww..",
    "..rrrrr..",
    "b.wwwrw.b",
    ".bwwkwwb.",
    "..wwwww..",
    ".wwwkwww.",
    ".wwwwwws.",
    ".wwwwwws.",
    "..wwwss..",
  ];

  var TULIP = ["a.a", "aaa", ".g.", "gg.", ".g."];
  var DAISY = [".w.", "wyw", ".w.", ".g.", ".g."];
  var SUNFLOWER = [
    ".yyy.",
    "yybyy",
    "ybbby",
    "yybyy",
    ".yyy.",
    "..g..",
    "lgg..",
    "..gl.",
    "..g..",
  ];
  var PUMPKIN = ["..s..", ".ooo.", "oOoOo", "oOoOo", ".ooo."];
  var TOADSTOOL = ["rwr", "rrr", ".w."];
  var BALL = [".rrw.", "rrwwb", "ywwbb", "yywbb", ".yyb."];

  var BIRD      = [["k...k", ".k.k.", "..k.."], [".....", "kk.kk", "..k.."]];
  var BUTTERFLY = [["aa.aa", "aabaa", ".a.a."], [".a.a.", ".aba.", "....."]];
  var BEE       = [[".ww.", "ykyk", "...."], ["....", "ykyk", ".ww."]];

  // =========================================================================
  // Palettes
  // =========================================================================

  var TREE_COLOURS = {
    blossom: { "1": "#f2b6cb", "2": "#d68aa8", "3": "#fde2ec", "4": "#ffffff" },
    leafy:   { "1": "#3a9a3e", "2": "#24702c", "3": "#64c052", "4": "#c83030" },
    autumn:  { "1": "#e0782a", "2": "#b2481c", "3": "#f2b444", "4": "#c4301e" },
  };
  var TRUNK      = "#6a4424";
  var TRUNK_DARK = "#4a2c18";
  var SNOW       = "#f4f8ff";

  var GROUND = {
    spring: { base: "#3f7a34", top: "#64c04a", fringe: "#7ad85a" },
    summer: { base: "#357a28", top: "#56b236", fringe: "#6cc844" },
    autumn: { base: "#5e5a2c", top: "#7e7a3a", fringe: "#8e8842" },
    winter: { base: "#a4b4ca", top: "#d6e2f0", fringe: "#eef4fc" },
  };
  var AUTUMN_LEAVES = ["#e07a28", "#c04020", "#e8b030", "#a85a20"];
  var TULIP_COLOURS = ["#e84a5a", "#f0a030", "#b060d0"];
  var FAIRY_LIGHTS  = ["#ff5050", "#ffd040", "#50a0ff", "#60e070"];
  var RAINBOW       = ["#e84040", "#f09030", "#f0d840", "#60c050", "#4080e0", "#8050c0"];

  // =========================================================================
  // Small helpers
  // =========================================================================

  var mixCache = {};
  var mixCount = 0;

  /** Blend two #rrggbb colours; t is rounded to 1/100 so results can be cached. */
  function mix(a, b, t) {
    if (t <= 0) { return a; }
    if (t >= 1) { return b; }
    var tr = Math.round(t * 100) / 100;
    var key = a + b + tr;
    var hit = mixCache[key];
    if (hit) { return hit; }
    var x = parseInt(a.slice(1), 16);
    var y = parseInt(b.slice(1), 16);
    var r  = Math.round(((x >> 16) & 255) + ((((y >> 16) & 255) - ((x >> 16) & 255)) * tr));
    var g  = Math.round(((x >> 8) & 255) + ((((y >> 8) & 255) - ((x >> 8) & 255)) * tr));
    var bl = Math.round((x & 255) + (((y & 255) - (x & 255)) * tr));
    var out = "#" + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
    if (mixCount++ > 4000) { mixCache = {}; mixCount = 0; }
    mixCache[key] = out;
    return out;
  }

  /** Integer → [0, 1). Same input, same output. */
  function hash01(n) {
    n = n | 0;
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }

  /** Seeded random generator (mulberry32). */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hourOf(date) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  }

  function segment(keys, h) {
    for (var i = 0; i < keys.length - 1; i++) {
      if (h >= keys[i][0] && h <= keys[i + 1][0]) {
        var span = keys[i + 1][0] - keys[i][0];
        return { a: keys[i], b: keys[i + 1], t: span > 0 ? (h - keys[i][0]) / span : 0 };
      }
    }
    var last = keys[keys.length - 1];
    return { a: last, b: last, t: 0 };
  }

  /** Copy of a colour map with every colour blended toward the night ink by d. */
  function shade(colours, d) {
    var out = {};
    for (var k in colours) {
      if (!Object.prototype.hasOwnProperty.call(colours, k)) { continue; }
      var c = colours[k];
      if (typeof c === "string") { out[k] = mix(c, NIGHT_INK, d * NIGHT_SHADE); }
      else if (c) { out[k] = c.map(function (x) { return mix(x, NIGHT_INK, d * NIGHT_SHADE); }); }
    }
    return out;
  }

  /**
   * Draw a character grid. colours maps a character to a colour, or to an array
   * of colours that is spread across the grid cells (used for fairy lights).
   * Runs of the same plain colour on a row are merged into one fillRect.
   */
  function drawGrid(ctx, grid, x, y, p, colours) {
    for (var r = 0; r < grid.length; r++) {
      var row = grid[r];
      var c = 0;
      while (c < row.length) {
        var col = colours[row[c]];
        if (!col) { c++; continue; }
        if (typeof col !== "string") {
          ctx.fillStyle = col[(r * 7 + c) % col.length];
          ctx.fillRect(x + c * p, y + r * p, p, p);
          c++;
          continue;
        }
        var run = 1;
        while (c + run < row.length && row[c + run] === row[c]) { run++; }
        ctx.fillStyle = col;
        ctx.fillRect(x + c * p, y + r * p, run * p, p);
        c += run;
      }
    }
  }

  // =========================================================================
  // Public helpers: season, time, sky, weather
  // =========================================================================

  /** Pixel unit for scenery on a canvas of height H (2 or 3). */
  function px(H) { return Math.max(2, Math.round(H / 80)); }

  /** y of the top of the ground strip; the pet and poos stand on it. */
  function groundTop(H) { return H - 12; }

  /**
   * "plain" and the named seasons are returned as-is; "ordered" (and anything
   * unknown) uses the real month: Mar–May spring … Dec–Feb winter.
   */
  function getActiveSeason(mode, date) {
    if (mode === "plain" || mode === "spring" || mode === "summer" ||
        mode === "autumn" || mode === "winter") { return mode; }
    var month = date.getMonth();
    if (month >= 2 && month <= 4)  { return "spring"; }
    if (month >= 5 && month <= 7)  { return "summer"; }
    if (month >= 8 && month <= 10) { return "autumn"; }
    return "winter";
  }

  /**
   * Clock-hour bucket, shared with the legacy background:
   * dawn 7–10 | morning 10–13 | afternoon 13–16 | sunset 16–19 | dusk 19–22 | night 22–7
   */
  function getTimeOfDay(date) {
    var h = date.getHours();
    if (h >= 7  && h < 10) { return "dawn";      }
    if (h >= 10 && h < 13) { return "morning";   }
    if (h >= 13 && h < 16) { return "afternoon"; }
    if (h >= 16 && h < 19) { return "sunset";    }
    if (h >= 19 && h < 22) { return "dusk";      }
    return "night";
  }

  /** Sky colours at the top of the canvas and at the horizon, blended by minute. */
  function skyColours(date) {
    var s = segment(SKY_KEYS, hourOf(date));
    return { top: mix(s.a[1], s.b[1], s.t), bottom: mix(s.a[2], s.b[2], s.t) };
  }

  /** 0 in full daylight, 1 at night, ramping through dawn and dusk. */
  function darkness(date) {
    var s = segment(DARK_KEYS, hourOf(date));
    return s.a[1] + (s.b[1] - s.a[1]) * s.t;
  }

  /** Veil strength for a codotchi.backgroundOpacity value; unknown values act like medium. */
  function veilAlpha(opacity, date) {
    var v = VEIL[opacity] || VEIL.medium;
    var d = darkness(date);
    return v[0] + (v[1] - v[0]) * d;
  }

  /** Winter fairy lights: lit at dawn, morning, dusk and night; off in the afternoon. */
  function lightsOn(date) {
    var tod = getTimeOfDay(date);
    return tod !== "afternoon" && tod !== "sunset";
  }

  /** Spring showers (then a short rainbow) and winter snow spells. */
  function weather(season, date) {
    var t = date.getTime();
    var out = { raining: false, rainbow: false, snowing: false };
    if (season === "spring") {
      var w = Math.floor(t / RAIN_MS);
      out.raining = hash01(w * 31 + 2027) < RAIN_CHANCE;
      var wasRaining = hash01((w - 1) * 31 + 2027) < RAIN_CHANCE;
      out.rainbow = !out.raining && wasRaining && (t - w * RAIN_MS) < RAINBOW_MS && darkness(date) < 0.3;
    } else if (season === "winter") {
      out.snowing = hash01(Math.floor(t / SNOW_MS) * 31 + 1013) < SNOW_CHANCE;
    }
    return out;
  }

  /**
   * A rare fly-past. Returns null, or { p: 0…1 progress, dir: ±1, y01: 0…1 }.
   * @param {string} kind - key of CRITTERS
   * @param {number} t    - time in ms
   */
  function critter(kind, t) {
    var c = CRITTERS[kind];
    var w = Math.floor(t / c.windowMs);
    if (hash01(w * 7 + c.salt) >= c.chance) { return null; }
    var start = w * c.windowMs + hash01(w * 3 + c.salt * 101) * (c.windowMs - c.durMs);
    var p = (t - start) / c.durMs;
    if (p < 0 || p > 1) { return null; }
    return { p: p, dir: hash01(w * 5 + c.salt * 37) < 0.5 ? 1 : -1, y01: hash01(w * 11 + c.salt * 53) };
  }

  // =========================================================================
  // Layout (seeded, cached per season and canvas size)
  // =========================================================================

  var SEASON_SEEDS = { spring: 11, summer: 23, autumn: 37, winter: 41 };
  var layoutCache = null;

  function treeSize(kind) {
    if (kind === "pine") { return { cols: PINE[0].length, rows: PINE.length }; }
    return { cols: CANOPY[0].length, rows: CANOPY.length + TRUNK_ROWS };
  }

  function layout(season, W, H) {
    var key = season + ":" + W + ":" + H;
    if (layoutCache && layoutCache.key === key) { return layoutCache; }
    var p = px(H), tp = p + 2, pp = p + 1, gTop = groundTop(H);
    var rand = rng(SEASON_SEEDS[season] * 100003 + W * 7 + H);
    var L = { key: key, p: p, tp: tp, pp: pp, gTop: gTop, trees: [], stars: [], clouds: [],
              bits: [], props: [], blades: [], icicles: [], snowman: null };
    var margin = Math.round(W * 0.03);
    var wide = W >= 220;

    // Trees sit at the edges so the pet's walking area stays clear.
    var PAIRS  = { spring: ["blossom", "blossom"], summer: ["leafy", "leafy"],
                   autumn: ["autumn", "bareLeaves"], winter: ["bareSnow", "pine"] };
    var SINGLE = { spring: "blossom", summer: "leafy", autumn: "autumn", winter: "pine" };
    var kinds = wide ? PAIRS[season] : [null, SINGLE[season]];
    for (var i = 0; i < 2; i++) {
      if (!kinds[i]) { continue; }
      var sz = treeSize(kinds[i]);
      var tw = sz.cols * tp, th = sz.rows * tp;
      var tx = i === 0 ? margin : W - margin - tw;
      L.trees.push({ kind: kinds[i], x: tx, y: gTop - th, w: tw, h: th });
    }

    for (var s = 0; s < 9; s++) {
      L.stars.push({ x: Math.floor(rand() * W), y: 2 + Math.floor(rand() * gTop * 0.45), big: rand() < 0.3 });
    }

    var cloudCount = { spring: 2, summer: 3, autumn: 2, winter: 1 }[season];
    for (var c = 0; c < cloudCount; c++) {
      L.clouds.push({ big: season === "summer" || c === 0 && season === "spring",
                      y: Math.round(gTop * (0.06 + rand() * 0.2)),
                      speed: 2 + rand() * 3, offset: rand() });
    }

    var cell, n, k;
    if (season === "spring") {
      n = Math.max(4, Math.floor(W / 26));
      for (k = 0; k < n; k++) {
        L.props.push({ kind: rand() < 0.6 ? "tulip" : "daisy", x: Math.floor(rand() * (W - 3 * pp)),
                       colour: TULIP_COLOURS[Math.floor(rand() * TULIP_COLOURS.length)] });
      }
      n = Math.floor(W / 12);
      for (k = 0; k < n; k++) { L.bits.push({ x: Math.floor(rand() * W / p) * p, colour: rand() < 0.5 ? "#ffffff" : "#f0d040" }); }
    } else if (season === "summer") {
      L.props.push({ kind: "sunflower", x: Math.round(W * 0.2) });
      L.props.push({ kind: "sunflower", x: Math.round(W * 0.8) - 5 * pp });
      if (wide) { L.props.push({ kind: "sunflower", x: Math.round(W * 0.46) }); }
      L.props.push({ kind: "blanket", x: Math.round(W * 0.3) });
      L.props.push({ kind: "ball", x: Math.round(W * 0.64) });
      n = Math.floor(W / 9);
      for (k = 0; k < n; k++) {
        L.blades.push({ x: Math.floor(rand() * W / p) * p, h: 3 + Math.floor(rand() * 4), dark: rand() < 0.5 });
      }
      n = Math.max(2, Math.floor(W / 40));
      for (k = 0; k < n; k++) { L.bits.push({ x: Math.floor(rand() * W / p) * p, w: 3 + Math.floor(rand() * 5) }); }
    } else if (season === "autumn") {
      // One pumpkin, kept at the side so snacks and poos in the middle stay easy to see:
      // just inside the right-hand tree when wide, at the far left when narrow (the
      // leaf pile sits by the single tree on the right).
      var edgeTree = L.trees[L.trees.length - 1];
      L.props.push({ kind: "pumpkin", x: wide ? edgeTree.x - PUMPKIN[0].length * p - p : margin });
      for (k = 0; k < 3; k++) { L.props.push({ kind: "toadstool", x: Math.floor(rand() * (W - 3 * pp)) }); }
      var pileTree = L.trees[0];
      L.props.push({ kind: "pile", x: Math.max(0, pileTree.x + (wide ? pileTree.w : -8 * pp)) });
      n = Math.floor(W / 5);
      for (k = 0; k < n; k++) {
        L.bits.push({ x: Math.floor(rand() * W / p) * p, row: Math.floor(rand() * 3),
                      colour: AUTUMN_LEAVES[Math.floor(rand() * AUTUMN_LEAVES.length)] });
      }
    } else if (season === "winter") {
      var pine = L.trees[L.trees.length - 1];
      var snowW = SNOWMAN[0].length * pp;
      L.snowman = { x: wide ? pine.x - snowW - 3 * p : margin, y: gTop - SNOWMAN.length * pp };
      n = 2 + Math.floor(W / 120);
      for (k = 0; k < n; k++) {
        L.bits.push({ x: Math.floor(rand() * W / p) * p, w: 12 + Math.floor(rand() * 12), h: 2 + Math.floor(rand() * 2) });
      }
      for (cell = Math.floor(rand() * 4) * p; cell < W; cell += (4 + Math.floor(rand() * 6)) * p) {
        L.icicles.push({ x: cell, len: 2 + Math.floor(rand() * 4) });
      }
    }

    layoutCache = L;
    return L;
  }

  // =========================================================================
  // Drawing pieces
  // =========================================================================

  function drawSky(ctx, W, gTop, sky) {
    var bandH = Math.ceil(gTop / SKY_BANDS);
    for (var i = 0; i < SKY_BANDS; i++) {
      ctx.fillStyle = mix(sky.top, sky.bottom, i / (SKY_BANDS - 1));
      ctx.fillRect(0, i * bandH, W, bandH);
    }
  }

  function drawStars(ctx, L, t, d) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (d - 0.4) / 0.6);
    ctx.fillStyle = "#e8e8d8";
    var phase = Math.floor(t / 800);
    for (var i = 0; i < L.stars.length; i++) {
      if (hash01(i * 131 + phase) < 0.15) { continue; }   // twinkle off this beat
      var s = L.stars[i];
      var size = s.big ? L.p : Math.max(1, L.p - 1);
      ctx.fillRect(s.x, s.y, size, size);
    }
    ctx.restore();
  }

  function drawMoon(ctx, W, L, season, d) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (d - 0.4) / 0.4);
    var colour = season === "winter" ? "#d8e8ff" : "#e8dfc0";
    drawGrid(ctx, MOON, W - MOON[0].length * L.p - 6, 4 + L.p, L.p, { "1": colour });
    ctx.restore();
  }

  var SUNRISE = 7, SUNSET = 19;     // the sun crosses the sky between these hours (low and warm at both ends)

  function drawSun(ctx, W, L, h) {
    var t = (h - SUNRISE) / (SUNSET - SUNRISE);
    if (t <= 0 || t >= 1) { return; }
    var lift = Math.sin(Math.PI * t);
    var size = SUN[0].length * L.pp;
    var x = Math.round(W * (0.88 - 0.76 * t) - size / 2);
    var y = Math.round(L.gTop * 0.6 - lift * L.gTop * 0.5);
    var body = mix("#f5a030", "#fbe070", lift);
    drawGrid(ctx, SUN, x, y, L.pp, { "1": body, "2": mix(body, "#ffffff", 0.5) });
  }

  function drawRainbow(ctx, W, L) {
    var p = L.p;
    var cx = W / 2, cy = L.gTop;
    var R = Math.min(W * 0.45, L.gTop * 0.85);
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (var b = 0; b < RAINBOW.length; b++) {
      var r = R - b * p;
      ctx.fillStyle = RAINBOW[b];
      for (var x = Math.floor((cx - r) / p) * p; x <= cx + r; x += p) {
        var dx = x + p / 2 - cx;
        if (Math.abs(dx) > r) { continue; }
        var y = Math.round((cy - Math.sqrt(r * r - dx * dx)) / p) * p;
        ctx.fillRect(x, y, p, p);
      }
    }
    ctx.restore();
  }

  function drawClouds(ctx, W, L, t, d, raining) {
    if (d >= 0.7) { return; }
    var colours = raining
      ? { "1": "#c8ccd4", "2": "#b4bac4", "3": "#9aa2b0" }
      : { "1": "#ffffff", "2": "#f0f6fb", "3": "#d6e4ee" };
    ctx.save();
    ctx.globalAlpha = 1 - d / 0.7;
    for (var i = 0; i < L.clouds.length; i++) {
      var c = L.clouds[i];
      var grid = c.big ? CLOUD_BIG : CLOUD_SMALL;
      var cw = grid[0].length * L.p;
      var span = W + cw;
      var x = Math.round(((t / 1000) * c.speed + c.offset * span) % span) - cw;
      drawGrid(ctx, grid, x, c.y, L.p, colours);
    }
    ctx.restore();
  }

  /** Light snow on top of every branch cell that has open sky above it. */
  function capBranches(ctx, x, y, tp, colour, sparse) {
    ctx.fillStyle = colour;
    for (var r = 0; r < BARE.length; r++) {
      for (var c = 0; c < BARE[r].length; c++) {
        if (BARE[r][c] !== "b") { continue; }
        if (r > 0 && BARE[r - 1][c] !== ".") { continue; }
        if (sparse && (r + c) % 3 !== 0) { continue; }
        ctx.fillRect(x + c * tp, y + (r - 1) * tp, tp, tp);
      }
    }
  }

  function drawTrunk(ctx, x, y, tp, colours) {
    ctx.fillStyle = colours.trunk;
    ctx.fillRect(x + 4 * tp, y, 3 * tp, TRUNK_ROWS * tp);
    ctx.fillStyle = colours.trunkDark;
    ctx.fillRect(x + 6 * tp, y, tp, TRUNK_ROWS * tp);
    ctx.fillRect(x + 3 * tp, y + (TRUNK_ROWS - 1) * tp, 5 * tp, tp);   // root flare
  }

  function drawTree(ctx, tree, tp, d, t, lit) {
    var wood = shade({ trunk: TRUNK, trunkDark: TRUNK_DARK }, d);
    var canopyY = tree.y;
    var trunkY  = tree.y + CANOPY.length * tp;
    if (tree.kind === "pine") {
      var pc = shade({ "1": "#2c6c48", "2": "#1c4a32", s: SNOW, t: TRUNK }, d);
      if (lit) {
        var shift = Math.floor(t / 700) % FAIRY_LIGHTS.length;
        pc.L = FAIRY_LIGHTS.slice(shift).concat(FAIRY_LIGHTS.slice(0, shift));
      } else {
        pc.L = pc["1"];
      }
      drawGrid(ctx, PINE, tree.x, tree.y, tp, pc);
      return;
    }
    if (tree.kind === "bareSnow" || tree.kind === "bareLeaves") {
      drawTrunk(ctx, tree.x, trunkY, tp, wood);
      var winter = tree.kind === "bareSnow";
      var tips = winter ? mix(SNOW, NIGHT_INK, d * NIGHT_SHADE) : AUTUMN_LEAVES.map(function (c) {
        return mix(c, NIGHT_INK, d * NIGHT_SHADE);
      });
      drawGrid(ctx, BARE, tree.x, canopyY, tp, { b: wood.trunk, "4": tips });
      capBranches(ctx, tree.x, canopyY, tp,
                  winter ? mix(SNOW, NIGHT_INK, d * NIGHT_SHADE) : mix(AUTUMN_LEAVES[0], NIGHT_INK, d * NIGHT_SHADE),
                  !winter);
      return;
    }
    drawTrunk(ctx, tree.x, trunkY, tp, wood);
    drawGrid(ctx, CANOPY, tree.x, canopyY, tp, shade(TREE_COLOURS[tree.kind], d));
  }

  function drawGround(ctx, W, H, L, season, d) {
    var g = shade(GROUND[season], d);
    var p = L.p, gTop = L.gTop;
    ctx.fillStyle = g.base;
    ctx.fillRect(0, gTop, W, H - gTop);
    ctx.fillStyle = g.top;
    ctx.fillRect(0, gTop, W, p);
    // Dithered fringe: every other cell pokes up above the ground line.
    ctx.fillStyle = g.fringe;
    for (var x = 0; x < W; x += 2 * p) { ctx.fillRect(x, gTop - p, p, p); }

    var i, b;
    if (season === "spring") {
      for (i = 0; i < L.bits.length; i++) {
        b = L.bits[i];
        ctx.fillStyle = mix(b.colour, NIGHT_INK, d * NIGHT_SHADE);
        ctx.fillRect(b.x, gTop + 2 * p, p, p);
      }
    } else if (season === "summer") {
      var dry = shade({ a: "#c8b450", b: "#a8963c" }, d);
      for (i = 0; i < L.bits.length; i++) {
        b = L.bits[i];
        for (var c = 0; c < b.w; c++) {
          ctx.fillStyle = c % 2 ? dry.b : dry.a;
          ctx.fillRect(b.x + c * p, gTop + (c % 2) * p, p, p);
        }
      }
    } else if (season === "autumn") {
      for (i = 0; i < L.bits.length; i++) {
        b = L.bits[i];
        ctx.fillStyle = mix(b.colour, NIGHT_INK, d * NIGHT_SHADE);
        ctx.fillRect(b.x, gTop - p + b.row * p, p, p);
      }
    } else if (season === "winter") {
      var drift = shade({ top: "#ffffff", shadow: "#98aac4" }, d);
      for (i = 0; i < L.bits.length; i++) {
        b = L.bits[i];
        for (var r = 0; r < b.h; r++) {
          var inset = r * 2 * p;   // each row up is narrower, so the drift is a mound
          ctx.fillStyle = drift.top;
          ctx.fillRect(b.x + inset, gTop - (r + 1) * p, Math.max(p, b.w * p - 2 * inset), p);
        }
        ctx.fillStyle = drift.shadow;
        ctx.fillRect(b.x + b.w * p - 2 * p, gTop, 2 * p, p);
      }
    }
  }

  function drawProps(ctx, W, L, season, d) {
    var p = L.pp, gTop = L.gTop;
    for (var i = 0; i < L.props.length; i++) {
      var pr = L.props[i];
      if (pr.kind === "tulip") {
        drawGrid(ctx, TULIP, pr.x, gTop - TULIP.length * p, p, shade({ a: pr.colour, g: "#3a8a30" }, d));
      } else if (pr.kind === "daisy") {
        drawGrid(ctx, DAISY, pr.x, gTop - DAISY.length * p, p, shade({ w: "#ffffff", y: "#f0d040", g: "#3a8a30" }, d));
      } else if (pr.kind === "sunflower") {
        drawGrid(ctx, SUNFLOWER, pr.x, gTop - SUNFLOWER.length * p, p,
                 shade({ y: "#f8d020", b: "#7a4a10", g: "#3e8a26", l: "#5cb03a" }, d));
      } else if (pr.kind === "blanket") {
        var bc = shade({ a: "#d84040", b: "#f4f0e8" }, d);
        for (var c = 0; c < 10; c++) {
          for (var r = 0; r < 2; r++) {
            ctx.fillStyle = (c + r) % 2 ? bc.b : bc.a;
            ctx.fillRect(pr.x + c * p + r * p, gTop + r * p, p, p);
          }
        }
      } else if (pr.kind === "ball") {
        drawGrid(ctx, BALL, pr.x, gTop - BALL.length * p, p,
                 shade({ r: "#e04040", w: "#ffffff", b: "#3a7ae0", y: "#f0d040" }, d));
      } else if (pr.kind === "pumpkin") {
        drawGrid(ctx, PUMPKIN, pr.x, gTop - PUMPKIN.length * p, p, shade({ o: "#e87a20", O: "#c85a14", s: "#4a7a2a" }, d));
      } else if (pr.kind === "toadstool") {
        drawGrid(ctx, TOADSTOOL, pr.x, gTop - TOADSTOOL.length * p, p, shade({ r: "#d03028", w: "#f4ecdc" }, d));
      } else if (pr.kind === "pile") {
        var leaves = AUTUMN_LEAVES.map(function (x) { return mix(x, NIGHT_INK, d * NIGHT_SHADE); });
        drawGrid(ctx, ["..1212..", ".231423.", "41324132"], pr.x, gTop - 3 * p, p,
                 { "1": leaves[0], "2": leaves[1], "3": leaves[2], "4": leaves[3] });
      }
    }
    if (season === "summer") {
      var blade = shade({ dark: "#2e8a2e", light: "#4caf30" }, d);
      for (var j = 0; j < L.blades.length; j++) {
        var bl = L.blades[j];
        ctx.fillStyle = bl.dark ? blade.dark : blade.light;
        ctx.fillRect(bl.x, gTop - bl.h * L.p, Math.max(1, L.p - 1), bl.h * L.p);
      }
    }
  }

  function drawIcicles(ctx, L, d) {
    var ice = shade({ body: "#dff0ff", tip: "#ffffff" }, d);
    var p = L.p;
    for (var i = 0; i < L.icicles.length; i++) {
      var ic = L.icicles[i];
      ctx.fillStyle = ice.body;
      ctx.fillRect(ic.x, 0, p, (ic.len - 1) * p);
      ctx.fillStyle = ice.tip;
      ctx.fillRect(ic.x, (ic.len - 1) * p, Math.max(1, p - 1), p);
    }
  }

  /** Petals (spring) or leaves (autumn) drifting down from the trees, then settling. */
  function drawFalling(ctx, L, t, d, colours, cycleMs, count) {
    var p = L.p;
    for (var i = 0; i < count; i++) {
      var tree = L.trees[i % L.trees.length];
      if (!tree || tree.kind === "pine") { continue; }
      var q = ((t / cycleMs) + i / count) % 1;
      var fall = Math.min(1, q / 0.85);   // the last 15% of the cycle rests on the ground
      var startX = tree.x + tree.w * (0.25 + 0.5 * hash01(i * 17 + Math.floor(t / cycleMs + i / count)));
      var startY = tree.y + 4 * L.tp;
      var x = Math.round(startX + Math.sin(fall * Math.PI * 3) * p * 3 + fall * p * 8 * (i % 2 ? -1 : 1));
      var y = Math.round(startY + fall * (L.gTop - p - startY));
      ctx.fillStyle = mix(colours[i % colours.length], NIGHT_INK, d * NIGHT_SHADE);
      ctx.fillRect(x, y, p, p);
    }
  }

  function drawSnow(ctx, W, L, t) {
    var p = L.p;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#ffffff";
    for (var i = 0; i < 9; i++) {
      var speed = 10 + (i % 3) * 5;
      var y = Math.round(((t / 1000) * speed + hash01(i * 97) * L.gTop) % L.gTop);
      var x = Math.round(((hash01(i * 59) * W + Math.sin(t / 1250 + i) * 6) % W + W) % W);
      ctx.fillRect(x, y, p, p);
    }
    ctx.restore();
  }

  function drawRain(ctx, W, L, t) {
    var p = L.p;
    ctx.fillStyle = "#9cc0e8";
    for (var i = 0; i < 9; i++) {
      var y = Math.round(((t / 1000) * 120 + hash01(i * 71) * L.gTop) % L.gTop);
      var x = Math.round(hash01(i * 43) * W);
      ctx.fillRect(x, y, Math.max(1, p - 1), 3 * p);
    }
  }

  function drawPuddles(ctx, W, L, d) {
    var p = L.p;
    ctx.fillStyle = mix("#7aa8d8", NIGHT_INK, d * NIGHT_SHADE);
    ctx.fillRect(Math.round(W * 0.34), L.gTop + p, 6 * p, p);
    ctx.fillRect(Math.round(W * 0.68), L.gTop + p, 4 * p, p);
  }

  function flyPath(W, L, ev, wobble) {
    var x = ev.dir > 0 ? -10 + (W + 20) * ev.p : W + 10 - (W + 20) * ev.p;
    var y = L.gTop * (0.25 + 0.35 * ev.y01) + Math.sin(ev.p * Math.PI * 4) * L.pp * wobble;
    return { x: Math.round(x), y: Math.round(y) };
  }

  function drawCritters(ctx, W, L, season, t, d) {
    var p = L.pp;
    var frame = Math.floor(t / 180) % 2;
    var ev, pos;
    if (d < 0.5 && season === "spring") {
      ev = critter("bird", t);
      if (ev) { pos = flyPath(W, L, ev, 2); drawGrid(ctx, BIRD[frame], pos.x, pos.y, p, { k: "#2a2a3a" }); }
      ev = critter("butterfly", t);
      if (ev) {
        pos = flyPath(W, L, ev, 4);
        drawGrid(ctx, BUTTERFLY[frame], pos.x, pos.y + Math.round(L.gTop * 0.25), p, { a: "#f070b0", b: "#2a2a3a" });
        drawGrid(ctx, BUTTERFLY[1 - frame], pos.x - 7 * p * ev.dir, pos.y + Math.round(L.gTop * 0.25) + 2 * p, p,
                 { a: "#f0d040", b: "#2a2a3a" });
      }
    }
    if (season === "summer") {
      if (d < 0.5) {
        ev = critter("bee", t);
        if (ev) {
          pos = flyPath(W, L, ev, 3);
          drawGrid(ctx, BEE[frame], pos.x, pos.y + Math.round(L.gTop * 0.3), p, { w: "#e8f4ff", y: "#f0c020", k: "#2a2a3a" });
        }
      } else {
        ev = critter("fireflies", t);
        if (ev) {
          ctx.save();
          ctx.globalAlpha = Math.min(1, Math.min(ev.p, 1 - ev.p) * 6);   // fade in and out
          for (var i = 0; i < 6; i++) {
            if (Math.sin(t / 500 + i * 1.7) <= 0.2) { continue; }
            var fx = Math.round(hash01(i * 29 + 5) * W + Math.sin(t / 2000 + i) * 10);
            var fy = Math.round(L.gTop * (0.4 + 0.5 * hash01(i * 13 + 7)) + Math.cos(t / 1700 + i) * 6);
            ctx.fillStyle = "rgba(232,248,112,0.3)";   // soft glow
            ctx.fillRect(fx - p, fy - p, 3 * p, 3 * p);
            ctx.fillStyle = "#f4ff9a";
            ctx.fillRect(fx, fy, p, p);
          }
          ctx.restore();
        }
      }
    }
  }

  // =========================================================================
  // Entry point
  // =========================================================================

  /**
   * Draw the whole background for one frame.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W    - canvas width
   * @param {number} H    - canvas height
   * @param {string} mode - codotchi.background value
   * @param {Date}   date - current time; drives the season, sky and animation
   * @param {{opacity?: string, backdrop?: string}} [opts]
   *   opacity  - codotchi.backgroundOpacity (subtle / medium / vivid; default medium)
   *   backdrop - colour the scene fades toward (the pet palette background)
   *   animate  - false (codotchi.backgroundAnimations off, or reduced motion)
   *              draws a still scene: no drifting clouds, twinkling stars,
   *              cycling lights, falling petals / leaves, weather or critters
   */
  function drawBackground(ctx, W, H, mode, date, opts) {
    var season = getActiveSeason(mode, date);
    var gTop = groundTop(H);

    if (season === "plain") {
      // Neutral dark ground strip so the pet stands on something
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#2a2a3a";
      ctx.fillRect(0, gTop, W, 8);
      ctx.fillStyle = "#3a3a4e";
      ctx.fillRect(0, gTop, W, 3);
      ctx.restore();
      return;
    }

    var animate = !(opts && opts.animate === false);
    var t = animate ? date.getTime() : 0;   // a still scene uses one fixed frame
    var h = hourOf(date);
    var d = darkness(date);
    var L = layout(season, W, H);
    var wx = animate ? weather(season, date) : { raining: false, rainbow: false, snowing: false };

    drawSky(ctx, W, gTop, skyColours(date));
    if (wx.raining) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#5a6478";
      ctx.fillRect(0, 0, W, gTop);
      ctx.restore();
    }
    if (d > 0.4) { drawStars(ctx, L, t, d); drawMoon(ctx, W, L, season, d); }
    if (!wx.raining) { drawSun(ctx, W, L, h); }
    if (wx.rainbow) { drawRainbow(ctx, W, L); }
    drawClouds(ctx, W, L, t, d, wx.raining);

    var lit = lightsOn(date);
    for (var i = 0; i < L.trees.length; i++) { drawTree(ctx, L.trees[i], L.tp, d, t, lit); }
    if (L.snowman) {
      drawGrid(ctx, SNOWMAN, L.snowman.x, L.snowman.y, L.pp,
               shade({ w: "#f8fbff", s: "#c8d6ea", k: "#26262e", o: "#f08a24", r: "#d83a3a", b: TRUNK }, d));
    }

    drawGround(ctx, W, H, L, season, d);
    drawProps(ctx, W, L, season, d);
    if (season === "spring" && (wx.raining || wx.rainbow)) { drawPuddles(ctx, W, L, d); }
    if (season === "winter") { drawIcicles(ctx, L, d); }

    // Soften the scene so the pet stands out; small moving bits stay crisp.
    var veil = veilAlpha(opts && opts.opacity, date);
    if (veil > 0) {
      ctx.save();
      ctx.globalAlpha = veil;
      ctx.fillStyle = (opts && opts.backdrop) || "#1a1a1a";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    if (!animate) { return; }
    if (season === "spring") { drawFalling(ctx, L, t, d, ["#fde2ec", "#f2b6cb"], 7000, 2); }
    if (season === "autumn") { drawFalling(ctx, L, t, d, AUTUMN_LEAVES, 9000, 3); }
    if (wx.snowing) { drawSnow(ctx, W, L, t); }
    if (wx.raining) { drawRain(ctx, W, L, t); }
    drawCritters(ctx, W, L, season, t, d);
  }

  // =========================================================================
  // Legacy background (codotchi.backgroundStyle = "legacy")
  // The pre-2.25 look, kept exactly: a flat time-of-day tint over a base
  // fill, a two-layer ground strip and a few seasonal props. Opacity and
  // animation settings do not apply; it is a single static frame.
  // =========================================================================

  /** Pre-2.25 clock-hour bucket — the scenic sky now uses the same stages (getTimeOfDay). */
  function legacyTimeOfDay(date) {
    return getTimeOfDay(date);
  }

  /**
   * Draws the legacy background, base fill included.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W
   * @param {number} H
   * @param {string} mode     - codotchi.background value
   * @param {Date}   date
   * @param {string} backdrop - pet palette background colour
   */
  function drawLegacyBackground(ctx, W, H, mode, date, backdrop) {
    var season = getActiveSeason(mode, date);
    var tod = legacyTimeOfDay(date);

    // Base — a lighter daytime base during morning/afternoon so sky tints read clearly
    ctx.fillStyle = (tod === "morning" || tod === "afternoon") ? "#243444" : (backdrop || "#1a1a1a");
    ctx.fillRect(0, 0, W, H);

    if (season === "plain") {
      // Plain mode: draw a neutral dark ground strip so the pet stands on something
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#2a2a3a";
      ctx.fillRect(0, H - 12, W, 8);
      ctx.fillStyle = "#3a3a4e";
      ctx.fillRect(0, H - 12, W, 3);
      ctx.restore();
      return;
    }

    // ── Sky overlay: time-of-day tint ─────────────────────────────────────
    var skyColour = "#000000";
    var skyAlpha  = 0.25;
    if (tod === "dawn")      { skyColour = "#e8844a"; skyAlpha = 0.22; }
    if (tod === "morning")   { skyColour = "#78b8e8"; skyAlpha = 0.50; }
    if (tod === "afternoon") { skyColour = "#5aaad4"; skyAlpha = 0.45; }
    if (tod === "sunset")    { skyColour = "#1a4060"; skyAlpha = 0.45; }
    if (tod === "dusk")      { skyColour = "#7a3a6e"; skyAlpha = 0.25; }
    if (tod === "night")     { skyColour = "#0a0a2a"; skyAlpha = 0.40; }

    ctx.save();
    ctx.globalAlpha = skyAlpha;
    ctx.fillStyle = skyColour;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // ── Sky overlay: season tint (C) ──────────────────────────────────────
    var seasonSkyColour = null;
    var seasonSkyAlpha  = 0.0;
    if (season === "spring") { seasonSkyColour = "#90e060"; seasonSkyAlpha = 0.02; }
    if (season === "summer") { seasonSkyColour = "#f5e050"; seasonSkyAlpha = 0.025; }
    if (season === "autumn") { seasonSkyColour = "#e07030"; seasonSkyAlpha = 0.025; }
    if (season === "winter") { seasonSkyColour = "#6080c0"; seasonSkyAlpha = 0.03; }

    if (seasonSkyColour) {
      ctx.save();
      ctx.globalAlpha = seasonSkyAlpha;
      ctx.fillStyle = seasonSkyColour;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Sky accent (sun or stars) ──────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.85;
    if (tod === "morning" || tod === "afternoon") {
      // High sun — circle r=7, moves right→left across the top
      ctx.fillStyle = "#f5d84a";
      var sunCx = tod === "morning" ? Math.floor(W * 0.65) + 3 : Math.floor(W * 0.35) + 3;
      ctx.beginPath();
      ctx.arc(sunCx, 11, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (tod === "dawn" || tod === "sunset") {
      // Low sun near horizon — circle r=6
      ctx.fillStyle = "#f5a030";
      var lowCx = tod === "dawn" ? W - 12 : 16;
      ctx.beginPath();
      ctx.arc(lowCx, Math.floor(H * 0.55) + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (tod === "dusk") {
      // Barely-visible sun just off the left edge — circle r=6
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#f5a030";
      ctx.beginPath();
      ctx.arc(8, Math.floor(H * 0.55) + 2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Night: crescent moon (right-facing ☽) + 5 stars as 2×2 dots
      var moonColour = season === "winter" ? "#d8e8ff" : "#e8dfc0";
      var moonCx = W - 12, moonCy = 8, moonR = 4;
      // Step 1: draw full moon circle
      ctx.fillStyle = moonColour;
      ctx.beginPath();
      ctx.arc(moonCx, moonCy, moonR, 0, Math.PI * 2);
      ctx.fill();
      // Step 2: punch crescent bite (destination-out erases pixels → sky shows through)
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.beginPath();
      ctx.arc(moonCx + moonR * 0.55, moonCy - moonR * 0.1, moonR * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // Stars
      ctx.fillStyle = "#e8e8d8";
      var starPositions = [
        [Math.floor(W * 0.15), 7],
        [Math.floor(W * 0.38), 12],
        [Math.floor(W * 0.60), 5],
        [Math.floor(W * 0.80), 14],
        [Math.floor(W * 0.50), 20],
      ];
      for (var si = 0; si < starPositions.length; si++) {
        ctx.fillRect(starPositions[si][0], starPositions[si][1], 2, 2);
      }
    }
    ctx.restore();

    // ── Sunset orange→blue gradient band (top third, 16 strips) ──────────
    if (tod === "sunset") {
      ctx.save();
      var gradH = Math.floor(H * 0.33);
      var strips = 16;
      var stripH = gradH / strips;
      // Orange top #f07020 → blue bottom #1a4060
      var r0 = 240, g0 = 112, b0 = 32;
      var r1 = 26,  g1 = 64,  b1 = 96;
      for (var gi = 0; gi < strips; gi++) {
        var t = gi / (strips - 1);
        var r = Math.round(r0 + (r1 - r0) * t);
        var g = Math.round(g0 + (g1 - g0) * t);
        var b = Math.round(b0 + (b1 - b0) * t);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
        ctx.fillRect(0, Math.round(gi * stripH), W, Math.ceil(stripH));
      }
      ctx.restore();
    }

    // ── Ground strip: 8px, two-layer (A) ──────────────────────────────────
    // Layer 1: base colour (darker), 8px tall
    // Layer 2: lighter highlight, 3px tall at top of strip
    var groundBase    = "#3a6b30";
    var groundHighlight = "#5ec44a";
    if (season === "spring") { groundBase = "#3a6b30"; groundHighlight = "#5ec44a"; }
    if (season === "summer") { groundBase = "#2d6620"; groundHighlight = "#4caf30"; }
    if (season === "autumn") { groundBase = "#7a4a20"; groundHighlight = "#c86820"; }
    if (season === "winter") { groundBase = "#8090a8"; groundHighlight = "#d8e8f0"; }

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = groundBase;
    ctx.fillRect(0, H - 12, W, 8);
    ctx.fillStyle = groundHighlight;
    ctx.fillRect(0, H - 12, W, 3);
    ctx.restore();

    // ── Seasonal accents (B) ───────────────────────────────────────────────
    ctx.save();
    ctx.globalAlpha = 0.90;

    if (season === "spring") {
      // Three flowers (5×5 petals, 2×2 centre) + grass blades
      // Flower 1 (left) — pink
      ctx.fillStyle = "#e87898";
      ctx.fillRect(4,  H - 21, 5, 5);
      ctx.fillStyle = "#f8f060";
      ctx.fillRect(6,  H - 19, 2, 2);
      // Flower 2 (centre-left) — purple-pink
      ctx.fillStyle = "#d060a8";
      ctx.fillRect(15, H - 20, 5, 5);
      ctx.fillStyle = "#f8f060";
      ctx.fillRect(17, H - 18, 2, 2);
      // Flower 3 (right) — pink
      ctx.fillStyle = "#e87898";
      ctx.fillRect(W - 14, H - 21, 5, 5);
      ctx.fillStyle = "#f8f060";
      ctx.fillRect(W - 12, H - 19, 2, 2);
      // Grass blades: 1×5 vertical strips
      ctx.fillStyle = "#70d840";
      ctx.fillRect(11, H - 18, 1, 5);
      ctx.fillRect(23, H - 17, 1, 4);
      ctx.fillRect(W - 20, H - 17, 1, 4);

    } else if (season === "summer") {
      // Tall grass blades + two sunflowers with stems
      // Tall grass: 1×7 dark-green blades
      ctx.fillStyle = "#28882a";
      ctx.fillRect(4,  H - 19, 1, 7);
      ctx.fillRect(9,  H - 18, 1, 6);
      ctx.fillRect(14, H - 20, 1, 8);
      ctx.fillRect(W - 10, H - 18, 1, 6);
      ctx.fillRect(W - 6,  H - 19, 1, 7);
      // Sunflower 1 stem
      ctx.fillStyle = "#4a8020";
      ctx.fillRect(22, H - 17, 1, 5);
      // Sunflower 1 head — 5×5 petals
      ctx.fillStyle = "#f8d020";
      ctx.fillRect(20, H - 22, 5, 5);
      ctx.fillStyle = "#8a5010";
      ctx.fillRect(22, H - 20, 2, 2);
      // Sunflower 2 stem
      ctx.fillStyle = "#4a8020";
      ctx.fillRect(W - 18, H - 17, 1, 5);
      // Sunflower 2 head — 5×5 petals
      ctx.fillStyle = "#f8d020";
      ctx.fillRect(W - 20, H - 22, 5, 5);
      ctx.fillStyle = "#8a5010";
      ctx.fillRect(W - 18, H - 20, 2, 2);

    } else if (season === "autumn") {
      // 5 falling leaves at varied heights — two colours
      ctx.fillStyle = "#e88020";  // amber
      ctx.fillRect(5,  H - 24, 3, 3);
      ctx.fillRect(W - 8, H - 17, 2, 2);
      ctx.fillStyle = "#d8682a";  // orange
      ctx.fillRect(W - 14, H - 22, 3, 3);
      ctx.fillStyle = "#c84010";  // dark orange-red
      ctx.fillRect(13, H - 19, 2, 2);
      ctx.fillRect(8,  H - 15, 2, 2);
      // Wider leaf pile
      ctx.fillStyle = "#a03810";
      ctx.fillRect(3,  H - 14, 6, 1);
      ctx.fillStyle = "#c85020";
      ctx.fillRect(4,  H - 15, 5, 1);
      ctx.fillStyle = "#d8682a";
      ctx.fillRect(5,  H - 16, 4, 1);

    } else if (season === "winter") {
      // Large snowflake (7×7 cross, left) + small snowflake (5×5 cross, right)
      ctx.fillStyle = "#e8f0f8";
      // Large snowflake
      ctx.fillRect(8,  H - 28, 1, 7); // vertical arm
      ctx.fillRect(5,  H - 25, 7, 1); // horizontal arm
      // Small snowflake
      ctx.fillRect(W - 10, H - 25, 1, 5); // vertical arm
      ctx.fillRect(W - 12, H - 23, 5, 1); // horizontal arm
      // Snow blanket on ground (three thicker segments)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(2,  H - 14, 8, 2);
      ctx.fillRect(14, H - 13, 6, 2);
      ctx.fillRect(W - 12, H - 14, 8, 2);
    }

    ctx.restore();
  }

  // =========================================================================
  // Exports
  // =========================================================================

  window.backgroundArt = {
    RAIN_MS:         RAIN_MS,
    RAIN_CHANCE:     RAIN_CHANCE,
    RAINBOW_MS:      RAINBOW_MS,
    SNOW_MS:         SNOW_MS,
    SNOW_CHANCE:     SNOW_CHANCE,
    CRITTERS:        CRITTERS,
    VEIL:            VEIL,
    veilAlpha:       veilAlpha,
    px:              px,
    groundTop:       groundTop,
    getActiveSeason: getActiveSeason,
    getTimeOfDay:    getTimeOfDay,
    skyColours:      skyColours,
    darkness:        darkness,
    lightsOn:        lightsOn,
    weather:         weather,
    critter:         critter,
    layout:          layout,
    drawBackground:  drawBackground,
    legacyTimeOfDay: legacyTimeOfDay,
    drawLegacyBackground: drawLegacyBackground,
  };
}());
