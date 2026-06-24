/**
 * panel/companion.js — canvas pet renderer for the Claude Code desktop pane.
 *
 * State arrives via Server-Sent Events from panel-server.mjs running on
 * localhost. No Electron IPC, no VS Code API — plain browser JS.
 */

/* global customCharBySpriteType */

(function () {
  "use strict";

  const GAME_DAYS_PER_YEAR = 365;

  const STAGE_BASE_SPEED_PPS = {
    egg: 0, baby: 22, child: 35, teen: 30, adult: 28, senior: 15,
  };
  const MOOD_MULTIPLIER = { happy: 1.5, neutral: 1.0, sad: 0.4 };

  const GRAVITY      = 500;
  const HOP_IMPULSE  = -175;
  const HOP_INTERVAL = 4.0;
  const BOUNCE_COEFF = 0.25;
  const BOUNCE_MIN   = 2;

  const REACTION_DURATIONS = {
    fed_meal: 500, fed_snack: 500, played: 700, fell_asleep: 600,
    woke_up: 400, scolded: 500, praised: 600, evolved: 900,
    poop_appeared: 700, became_sick: 600, healed: 500,
  };

  var BASE_SIZE = 96;
  var STAGE_SCALES    = window.SPRITE_STAGE_SCALES;

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var connectingEl  = document.getElementById("connecting");
  var panelRoot     = document.getElementById("panel-root");
  var gameScreen    = document.getElementById("game-screen");
  var noPetScreen   = document.getElementById("no-pet-screen");
  var sourceBadge   = document.getElementById("source-badge");
  var attentionPill = document.getElementById("attention-pill");
  var petNameDisplay= document.getElementById("pet-name-display");
  var moodLabelEl   = document.getElementById("mood-label");
  var infoLine      = document.getElementById("info-line");
  var barHunger     = document.getElementById("bar-hunger");
  var barHappiness  = document.getElementById("bar-happiness");
  var barEnergy     = document.getElementById("bar-energy");
  var barHealth     = document.getElementById("bar-health");
  var spriteCanvas  = document.getElementById("sprite-canvas");
  var spriteCtx     = spriteCanvas.getContext("2d");

  var REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var BG_MODE = "ordered";

  // ── Animation state ───────────────────────────────────────────────────────
  var lastState     = null;
  var petX = null, petY = null, petVx = 0, petVy = 0;
  var petFacingLeft = false;
  var animTick = 0, lastFrameMs = 0;
  var breathPhase = 0, floatPhase = 0;
  var hopTimer = HOP_INTERVAL, idleTimer = 0;
  var reactionQueue = [];
  var giftBoxX = null, snackItems = [];
  var activeBubble  = null;
  var petIsSleeping = false;
  var currentScreen = "none";

  var CANVAS_H = 220; // fixed height like VS Code sidebar (240px)

  // ── Canvas resize ─────────────────────────────────────────────────────────
  function resizeCanvas() {
    var container = spriteCanvas.parentElement;
    if (!container) { return; }
    var newW = Math.max(container.clientWidth || container.offsetWidth, 120);
    if (spriteCanvas.width !== newW || spriteCanvas.height !== CANVAS_H) {
      spriteCanvas.width  = newW;
      spriteCanvas.height = CANVAS_H;
      petX = null;
    }
  }

  // Defer initial resize to rAF so layout is ready; also watch for future changes
  requestAnimationFrame(function () {
    resizeCanvas();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resizeCanvas).observe(spriteCanvas.parentElement);
    }
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getSpeedPPS(state) {
    if (!state || state.sleeping || state.stage === "egg") { return 0; }
    if (state.sick) { return (STAGE_BASE_SPEED_PPS[state.stage] || 0) * 0.05; }
    return (STAGE_BASE_SPEED_PPS[state.stage] || 0) * (MOOD_MULTIPLIER[state.mood] || 1.0);
  }

  function getPalette(spriteType) {
    return window.spriteGetPalette(spriteType);
  }

  function petSizeMultiplier(spriteType) {
    var isUp = !!(window.UPRIGHT_TYPES && window.UPRIGHT_TYPES[spriteType]);
    return isUp ? 0.75 : 1.0;
  }

  function effectiveBWidth(state, bSize) {
    return Math.round(bSize);
  }

  function getFloorY(state) {
    if (!state) { return spriteCanvas.height - 12; }
    var sc  = STAGE_SCALES[state.stage] || 0.5;
    var bSz = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * sc);
    var bW  = effectiveBWidth(state, bSz);
    var bH  = Math.round(bW * spriteHeightRatio(state.spriteType || "classic"));
    var st  = state.spriteType || "classic";
    var isUp = !!(window.UPRIGHT_TYPES && window.UPRIGHT_TYPES[st]);
    if (!isUp && st !== "snake") {
      bH += (window.spriteQuadBellySag(state.weight || 50)) * Math.max(1, Math.round(bH / 32));
    }
    return spriteCanvas.height - bH - 12;
  }

  function spriteHeightRatio(spriteType) {
    return window.spriteHeightRatio(spriteType);
  }

  function pushReaction(type, nowMs) {
    var dur = REACTION_DURATIONS[type];
    if (dur) { reactionQueue.push({ type, startMs: nowMs, durationMs: dur }); }
  }

  // ── Speech bubble ─────────────────────────────────────────────────────────
  function showBubble(text) {
    activeBubble = { text, startMs: performance.now(), fadeOutMs: performance.now() + 6000, fadeDurMs: 500 };
  }

  function wrapBubbleText(ctx, text, maxWidth) {
    var words = text.split(" "), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = words[i]; }
      else { cur = test; }
    }
    if (cur) { lines.push(cur); }
    return lines;
  }

  function drawSpeechBubble(petCx, petTopY, nowMs) {
    if (!activeBubble) { return; }
    var alpha = 1.0;
    var elapsed = nowMs - activeBubble.startMs;
    var fadeStart = activeBubble.fadeOutMs - activeBubble.startMs;
    if (activeBubble.fadeOutMs !== Infinity) {
      if (elapsed >= fadeStart + activeBubble.fadeDurMs) { activeBubble = null; return; }
      if (elapsed > fadeStart) { alpha = 1 - (elapsed - fadeStart) / activeBubble.fadeDurMs; }
    }

    var PAD_X = 8, PAD_Y = 6, TAIL_H = 6, TAIL_W = 8, LINE_H = 13;
    var MAX_W = Math.min(spriteCanvas.width - 8, 160);
    spriteCtx.save();
    spriteCtx.globalAlpha = alpha;
    spriteCtx.font = "10px monospace";

    var lines = wrapBubbleText(spriteCtx, activeBubble.text, MAX_W - PAD_X * 2);
    var boxW = 0;
    for (var i = 0; i < lines.length; i++) { var lw = spriteCtx.measureText(lines[i]).width; if (lw > boxW) boxW = lw; }
    boxW += PAD_X * 2;
    var boxH = lines.length * LINE_H + PAD_Y * 2;
    var boxX = Math.max(4, Math.min(spriteCanvas.width - boxW - 4, Math.round(petCx - boxW / 2)));
    var boxY = petTopY - TAIL_H - 2 - boxH;
    var flipped = false;
    if (boxY < 2) { boxY = petTopY + 2 + TAIL_H; flipped = true; }
    var tailTipX = Math.max(boxX + TAIL_W + 2, Math.min(boxX + boxW - TAIL_W - 2, Math.round(petCx)));

    spriteCtx.fillStyle = "#1a1a2e"; spriteCtx.strokeStyle = "#888"; spriteCtx.lineWidth = 1;
    spriteCtx.beginPath(); spriteCtx.roundRect(boxX, boxY, boxW, boxH, 4); spriteCtx.fill(); spriteCtx.stroke();

    spriteCtx.beginPath();
    if (!flipped) {
      var boxB = boxY + boxH;
      spriteCtx.moveTo(tailTipX - TAIL_W, boxB); spriteCtx.lineTo(tailTipX + TAIL_W, boxB); spriteCtx.lineTo(tailTipX, boxB + TAIL_H);
    } else {
      spriteCtx.moveTo(tailTipX - TAIL_W, boxY); spriteCtx.lineTo(tailTipX + TAIL_W, boxY); spriteCtx.lineTo(tailTipX, boxY - TAIL_H);
    }
    spriteCtx.closePath(); spriteCtx.fillStyle = "#1a1a2e"; spriteCtx.fill();

    spriteCtx.fillStyle = "#ddd"; spriteCtx.textBaseline = "top";
    for (var j = 0; j < lines.length; j++) { spriteCtx.fillText(lines[j], boxX + PAD_X, boxY + PAD_Y + j * LINE_H); }
    spriteCtx.restore();
  }

  // ── Animation loop ────────────────────────────────────────────────────────
  function animationLoop(nowMs) {
    requestAnimationFrame(animationLoop);
    if (!lastState || !lastState.alive || currentScreen !== "game") { return; }

    var dt = lastFrameMs === 0 ? 0 : Math.min((nowMs - lastFrameMs) / 1000, 0.1);
    lastFrameMs = nowMs;

    var sc   = STAGE_SCALES[lastState.stage] || 0.5;
    var bSz  = Math.round(BASE_SIZE * petSizeMultiplier(lastState.spriteType) * sc);
    var bW   = effectiveBWidth(lastState, bSz);
    var bH   = Math.round(bW * spriteHeightRatio(lastState.spriteType || "classic"));
    var st   = lastState.spriteType || "classic";
    var isUp = !!(window.UPRIGHT_TYPES && window.UPRIGHT_TYPES[st]);
    if (!isUp && st !== "snake") {
      bH += window.spriteQuadBellySag(lastState.weight || 50) * Math.max(1, Math.round(bH / 32));
    }

    var floorY = spriteCanvas.height - bH - 12;
    var minX   = 4, maxX = spriteCanvas.width - bW - 4;

    if (petY === null) { petY = floorY; }
    if (petX === null) { petX = Math.max(minX, Math.min(maxX, Math.floor(spriteCanvas.width / 2 - bW / 2))); }

    for (var ri = reactionQueue.length - 1; ri >= 0; ri--) {
      var rxn = reactionQueue[ri];
      if (nowMs - rxn.startMs >= rxn.durationMs) {
        reactionQueue.splice(ri, 1);
        if (rxn.type === "fell_asleep") { petY = floorY; petVx = 0; petVy = 0; }
      }
    }

    var activeReaction = reactionQueue.length > 0 ? reactionQueue[0] : null;
    animTick++;

    var isDragon = lastState.spriteType === "dragon";
    var speed    = getSpeedPPS(lastState);

    if (activeReaction && activeReaction.type === "fell_asleep") {
      petY = floorY; petVx = 0; petVy = 0;

    } else if (lastState.stage === "egg") {
      petX = Math.max(minX, Math.min(maxX, Math.floor(spriteCanvas.width / 2 - bW / 2)));
      petY = floorY; petVx = 0; petVy = 0;

    } else if (lastState.sleeping) {
      breathPhase += 1.8 * dt; petVx = 0; petVy = 0;
      petY = isDragon ? floorY - Math.round(bH * 0.12) : floorY;

    } else if (isDragon) {
      floatPhase += 1.2 * dt;
      petY = floorY - Math.round(bH * 0.12) + Math.round(Math.sin(floatPhase) * 3);
      petVy = 0;
      if (speed > 0 && idleTimer <= 0) {
        if (petVx === 0) { petVx = Math.random() < 0.5 ? speed : -speed; petFacingLeft = petVx < 0; }
        petX += petVx * dt;
        if (petX >= maxX) { petX = maxX; petVx = -speed; petFacingLeft = true; }
        else if (petX <= minX) { petX = minX; petVx = speed; petFacingLeft = false; }
        if (Math.random() < 0.0015) { petVx = -petVx; petFacingLeft = !petFacingLeft; }
      } else if (idleTimer > 0) {
        idleTimer -= dt; if (idleTimer < 0) { idleTimer = 0; if (petVx === 0) { petVx = speed; petFacingLeft = false; } } petVx = 0;
      }
      petX = Math.max(minX, Math.min(maxX, petX));

    } else {
      petVy += GRAVITY * dt;
      petY  += petVy * dt;
      if (petY >= floorY) {
        petY = floorY;
        petVy = petVy > BOUNCE_MIN ? -petVy * BOUNCE_COEFF : 0;
      }
      var onFloor = petY >= floorY - 0.5;
      if (onFloor && petVy >= 0 && speed > 0) {
        hopTimer -= dt;
        if (hopTimer <= 0) { petVy = HOP_IMPULSE; hopTimer = HOP_INTERVAL; onFloor = false; }
      }
      if (speed > 0 && idleTimer <= 0) {
        if (petVx === 0) { petVx = Math.random() < 0.5 ? speed : -speed; petFacingLeft = petVx < 0; }
        petX += petVx * dt;
        if (petX >= maxX) { petX = maxX; petVx = -speed; petFacingLeft = true; }
        else if (petX <= minX) { petX = minX; petVx = speed; petFacingLeft = false; }
        if (Math.random() < 0.0015) { petVx = -petVx; petFacingLeft = !petFacingLeft; }
      } else if (idleTimer > 0) {
        idleTimer -= dt; if (idleTimer < 0) { idleTimer = 0; } petVx = 0;
      } else if (lastState.sick) {
        petX += (Math.random() - 0.5) * 8 * dt;
      }
      petX = Math.max(minX, Math.min(maxX, petX));
    }

    var walking  = !isDragon && !lastState.sleeping && Math.abs(petVx) > 0.5 && petY >= floorY - 0.5;
    var legFrame = isDragon ? -1 : (walking ? Math.floor(animTick / 10) % 2 : 0);
    var walkBob  = (walking && legFrame === 1) ? -1 : 0;

    drawEnvironment(lastState);
    drawBodyWithReaction(lastState, Math.round(petX), Math.round(petY) + walkBob, petFacingLeft, legFrame, activeReaction, nowMs);
    drawStatusIndicators(lastState, Math.round(petX), Math.round(petY) + walkBob);

    var sc2    = STAGE_SCALES[lastState.stage] || 0.5;
    var bSz2   = Math.round(BASE_SIZE * petSizeMultiplier(lastState.spriteType) * sc2);
    var petCx  = Math.round(petX) + Math.round(effectiveBWidth(lastState, bSz2) / 2);
    drawSpeechBubble(petCx, Math.round(petY) + walkBob, nowMs);
  }

  if (!REDUCED_MOTION) { requestAnimationFrame(animationLoop); }

  // ── Environment drawing ───────────────────────────────────────────────────
  function drawEnvironment(state) {
    var W = spriteCanvas.width, H = spriteCanvas.height;
    spriteCtx.clearRect(0, 0, W, H);
    spriteCtx.fillStyle = "#243444";
    spriteCtx.fillRect(0, 0, W, H);
    drawBackground(W, H);

    // Poop
    var POO = [[0,0,1,1,0,0],[0,1,1,1,1,0],[1,1,2,1,1,1],[1,2,1,1,1,1],[0,1,1,1,1,0],[0,1,1,1,1,0],[1,1,1,1,1,1]];
    var PS = 2, pH = POO.length * PS;
    var numPoos = Math.min(state.poops || 0, 3);
    var pooXs = [Math.round(W * 0.12), Math.round(W * 0.52), Math.round(W * 0.78)];
    for (var pi = 0; pi < numPoos; pi++) {
      var pooX = pooXs[pi];
      POO.forEach(function (row, ry) {
        row.forEach(function (cell, rx) {
          if (!cell) return;
          spriteCtx.fillStyle = cell === 2 ? "#A0522D" : "#6B3A2A";
          spriteCtx.fillRect(pooX + rx * PS, H - 12 - pH + ry * PS, PS, PS);
        });
      });
    }

    // Gift box
    if (giftBoxX !== null) {
      var GB = [[0,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0],[0,1,1,1,1,1,1,0]];
      var GBS = 2, gbH2 = GB.length * GBS;
      var gPal = getPalette(state.spriteType);
      GB.forEach(function (row, ry) {
        row.forEach(function (cell, rx) {
          if (!cell) return;
          spriteCtx.fillStyle = ry === 0 ? gPal.secondary : ry === 1 ? gPal.accent : gPal.primary;
          spriteCtx.fillRect(Math.round(giftBoxX) + rx * GBS, H - 12 - gbH2 + ry * GBS, GBS, GBS);
        });
      });
    }
  }

  // ── Body drawing ──────────────────────────────────────────────────────────
  function drawBody(state, x, bodyY, facingLeft, legFrame) {
    window.renderSpriteGrid(
      spriteCtx, state, x, bodyY, facingLeft, legFrame, breathPhase,
      STAGE_SCALES, function(w) { return window.spriteWeightWidthMult(w); },
      getPalette, spriteHeightRatio, function(w) { return window.spriteQuadBellySag(w); }
    );
  }

  function drawBodyWithReaction(state, x, bodyY, facingLeft, legFrame, activeReaction, nowMs) {
    if (!activeReaction) { drawBody(state, x, bodyY, facingLeft, legFrame); return; }
    var t = Math.min(1, (nowMs - activeReaction.startMs) / activeReaction.durationMs);
    switch (activeReaction.type) {
      case "fed_meal": case "fed_snack":
        drawBody(state, x, bodyY - Math.round(Math.abs(Math.sin(t * Math.PI * 2)) * 6), facingLeft, legFrame); break;
      case "scolded":
        drawBody(state, x + Math.round(Math.sin(t * Math.PI) * 10 * (t < 0.5 ? 1 : -1)), bodyY, facingLeft, legFrame); break;
      case "praised": case "evolved": {
        var yOff = -Math.round(Math.sin(t * Math.PI) * 16);
        drawBody(state, x, bodyY + yOff, facingLeft, legFrame);
        spriteCtx.save(); spriteCtx.globalAlpha = (1 - t) * 0.35; spriteCtx.fillStyle = "#FFD600";
        var sc3 = STAGE_SCALES[state.stage] || 0.5;
        var bW3 = effectiveBWidth(state, Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * sc3));
        spriteCtx.fillRect(x, bodyY + yOff, bW3, Math.round(bW3 * spriteHeightRatio(state.spriteType)));
        spriteCtx.restore(); break;
      }
      case "woke_up": {
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.save(); spriteCtx.globalAlpha = (1 - t) * 0.3; spriteCtx.fillStyle = "#FFD600";
        var sc4 = STAGE_SCALES[state.stage] || 0.5;
        var bW4 = effectiveBWidth(state, Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * sc4));
        spriteCtx.fillRect(x, bodyY, bW4, Math.round(bW4 * spriteHeightRatio(state.spriteType)));
        spriteCtx.restore(); break;
      }
      case "healed": {
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.save(); spriteCtx.globalAlpha = (1 - t) * 0.5; spriteCtx.fillStyle = "#00c853";
        var sc5 = STAGE_SCALES[state.stage] || 0.5;
        var bW5 = effectiveBWidth(state, Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * sc5));
        spriteCtx.fillRect(x, bodyY, bW5, Math.round(bW5 * spriteHeightRatio(state.spriteType)));
        spriteCtx.restore(); break;
      }
      default: drawBody(state, x, bodyY, facingLeft, legFrame);
    }
  }

  function drawStatusIndicators(state, x, bodyY) {
    var sc = STAGE_SCALES[state.stage] || 0.5;
    var bSz = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * sc);
    var bW  = effectiveBWidth(state, bSz);
    var indX = x + Math.round(bW / 2) - 4, indY = bodyY - 3;
    if (state.sleeping) {
      spriteCtx.fillStyle = "#aaa"; spriteCtx.font = "bold 10px monospace"; spriteCtx.textBaseline = "alphabetic";
      spriteCtx.fillText("z", indX, indY); spriteCtx.fillText("z", indX + 5, indY - 5); spriteCtx.fillText("Z", indX + 11, indY - 11);
    } else if (state.sick) {
      spriteCtx.fillStyle = "#f44"; spriteCtx.font = "bold 11px monospace"; spriteCtx.textBaseline = "alphabetic";
      spriteCtx.fillText("+", indX - 2, indY); spriteCtx.fillText("+", indX + 6, indY - 4);
    }
  }

  // ── Background / seasonal drawing ─────────────────────────────────────────
  function getTimeOfDay() {
    var h = new Date().getHours();
    if (h >= 7  && h < 10) return "dawn";
    if (h >= 10 && h < 13) return "morning";
    if (h >= 13 && h < 16) return "afternoon";
    if (h >= 16 && h < 19) return "sunset";
    if (h >= 19 && h < 22) return "dusk";
    return "night";
  }

  function getActiveSeason() {
    if (BG_MODE !== "ordered") return BG_MODE;
    var m = new Date().getMonth();
    if (m >= 2 && m <= 4) return "spring";
    if (m >= 5 && m <= 7) return "summer";
    if (m >= 8 && m <= 10) return "autumn";
    return "winter";
  }

  function drawBackground(W, H) {
    var tod = getTimeOfDay(), season = getActiveSeason();
    var skyC = "#000", skyA = 0.25;
    if (tod === "dawn")      { skyC = "#e8844a"; skyA = 0.22; }
    if (tod === "morning")   { skyC = "#78b8e8"; skyA = 0.50; }
    if (tod === "afternoon") { skyC = "#5aaad4"; skyA = 0.45; }
    if (tod === "sunset")    { skyC = "#1a4060"; skyA = 0.45; }
    if (tod === "dusk")      { skyC = "#7a3a6e"; skyA = 0.25; }
    if (tod === "night")     { skyC = "#0a0a2a"; skyA = 0.40; }
    spriteCtx.save(); spriteCtx.globalAlpha = skyA; spriteCtx.fillStyle = skyC; spriteCtx.fillRect(0, 0, W, H); spriteCtx.restore();

    // Sun/moon
    spriteCtx.save(); spriteCtx.globalAlpha = 0.85;
    if (tod === "morning" || tod === "afternoon") {
      spriteCtx.fillStyle = "#f5d84a";
      var sunCx = tod === "morning" ? Math.floor(W * 0.65) : Math.floor(W * 0.35);
      spriteCtx.beginPath(); spriteCtx.arc(sunCx, 11, 7, 0, Math.PI * 2); spriteCtx.fill();
    } else if (tod === "night") {
      spriteCtx.fillStyle = "#e8dfc0";
      spriteCtx.beginPath(); spriteCtx.arc(W - 12, 8, 4, 0, Math.PI * 2); spriteCtx.fill();
      spriteCtx.globalCompositeOperation = "destination-out"; spriteCtx.fillStyle = "rgba(0,0,0,1)";
      spriteCtx.beginPath(); spriteCtx.arc(W - 10, 7, 3.4, 0, Math.PI * 2); spriteCtx.fill();
      spriteCtx.globalCompositeOperation = "source-over";
    }
    spriteCtx.restore();

    // Ground
    var gBase = season === "spring" ? "#3a6b30" : season === "summer" ? "#2d6620" : season === "autumn" ? "#7a4a20" : "#8090a8";
    var gTop  = season === "spring" ? "#5ec44a" : season === "summer" ? "#4caf30" : season === "autumn" ? "#c86820" : "#d8e8f0";
    spriteCtx.save(); spriteCtx.globalAlpha = 0.85;
    spriteCtx.fillStyle = gBase; spriteCtx.fillRect(0, H - 12, W, 8);
    spriteCtx.fillStyle = gTop;  spriteCtx.fillRect(0, H - 12, W, 3);
    spriteCtx.restore();
  }

  // ── Screen switching ──────────────────────────────────────────────────────
  function showScreen(name) {
    currentScreen = name;
    gameScreen  .classList.toggle("hidden", name !== "game");
    noPetScreen .classList.toggle("hidden", name !== "no-pet");
  }

  // ── Stat bars ─────────────────────────────────────────────────────────────
  function setBar(bar, value) { bar.style.width = Math.max(0, Math.min(100, value)) + "%"; }
  function setHealthBar(bar, value) {
    setBar(bar, value);
    bar.classList.toggle("health-low", value < 30);
    bar.classList.toggle("health-mid", value >= 30 && value < 60);
  }

  // ── Text helpers ──────────────────────────────────────────────────────────
  function moodText(state) {
    if (state.sleeping && state.sick) return "Zzz… (feeling sick)";
    if (state.sleeping) return "Zzz…";
    if (state.sick)     return "Feeling sick";
    var m = state.mood || "neutral";
    return m.charAt(0).toUpperCase() + m.slice(1);
  }

  function formatAge(ageDays) {
    var years = Math.floor(ageDays / GAME_DAYS_PER_YEAR);
    var days  = ageDays % GAME_DAYS_PER_YEAR;
    return years > 0 ? years + "y " + days + "d" : days + "d";
  }

  function humaniseEvent(code, name, state) {
    var n = name || "Codotchi";
    var map = {
      pooped:          n + " pooped!",
      became_sick:     n + " got sick!",
      cured:           n + " recovered!",
      fell_asleep:     n + " fell asleep.",
      woke_up:         n + " woke up.",
      auto_woke_up:    n + " woke up after a full nap.",
      fed_meal:        n + " ate a meal.",
      fed_snack:       n + " had a snack.",
      played:          n + " played!",
      patted:          n + " was patted!",
      praised:         n + " was praised!",
      scolded:         n + " was scolded.",
      cleaned:         "Cleaned up the mess.",
      medicine_given:  "Gave " + n + " medicine.",
      commit_activity_rewarded: [n + " saw the commit. Cautiously optimistic.", n + " approves!", n + " is proud of you!"],
      code_activity_rewarded:   [n + " watches you type.", n + " sees you saving again.", n + " is not saying anything."],
      attention_call_hunger:          n + " is hungry!",
      attention_call_unhappiness:     n + " is lonely!",
      attention_call_poop:            n + " needs a clean-up!",
      attention_call_sick:            n + " is calling — feel sick!",
      attention_call_low_energy:      n + " is exhausted!",
      attention_call_misbehaviour:    n + " is misbehaving!",
      attention_call_gift:            n + " brought you a gift!",
      attention_call_critical_health: n + " — health is critical!",
    };
    var val = map[code];
    if (val) return Array.isArray(val) ? val[Math.floor(Math.random() * val.length)] : val;
    if (code.indexOf("evolved_to_") === 0) return n + " evolved into " + code.slice(11) + "!";
    return "";
  }

  function pillLabel(call) {
    return { hunger: "Hungry!", unhappiness: "Lonely!", poop: "Needs clean!", sick: "Sick!",
             low_energy: "Tired!", misbehaviour: "Misbehaving!", critical_health: "Critical!", gift: "Gift!" }[call] || call;
  }

  // ── renderState ───────────────────────────────────────────────────────────
  function renderState(state, source) {
    if (!state || !state.alive) {
      showScreen("no-pet");
      lastState = state;
      return;
    }

    showScreen("game");
    petNameDisplay.textContent = state.name || "Codotchi";
    moodLabelEl.textContent    = moodText(state);
    setBar(barHunger,    state.hunger);
    setBar(barHappiness, state.happiness);
    setBar(barEnergy,    state.energy);
    setHealthBar(barHealth, state.health);

    var stage  = (state.stage || "baby");
    var sprite = (state.spriteType || "cat");
    var age    = formatAge(state.ageDays || 0);
    infoLine.textContent = age + "  ·  " + stage + "  ·  " + sprite;

    // Source badge
    if (sourceBadge) {
      sourceBadge.textContent = { vscode: "VS Code", pycharm: "PyCharm", claude: "Claude Code" }[source] || source || "Claude Code";
    }

    // Attention pill
    var call = state.activeAttentionCall || null;
    if (call) {
      attentionPill.textContent = pillLabel(call);
      attentionPill.className   = "attention-pill call-" + call;
    } else {
      attentionPill.textContent = "";
      attentionPill.className   = "attention-pill hidden";
    }

    // Reset position when pet first appears or stage changes
    if (!lastState || !lastState.alive || (lastState && state.stage !== lastState.stage)) {
      petX = null; petY = null; petVx = 0; petVy = 0; petFacingLeft = false;
      animTick = 0; lastFrameMs = 0; breathPhase = 0; hopTimer = HOP_INTERVAL; idleTimer = 0;
      reactionQueue = []; giftBoxX = null; snackItems = [];
    }

    var nowMs = performance.now();
    var events = state.events || [];

    if (events.indexOf("fed_meal")    !== -1) pushReaction("fed_meal",    nowMs);
    if (events.indexOf("fed_snack")   !== -1) pushReaction("fed_snack",   nowMs);
    if (events.indexOf("played")      !== -1) pushReaction("played",      nowMs);
    if (events.indexOf("fell_asleep") !== -1) { pushReaction("fell_asleep", nowMs); petIsSleeping = true; showBubble("Zzz..."); if (activeBubble) activeBubble.fadeOutMs = Infinity; }
    if (events.indexOf("woke_up")     !== -1 || events.indexOf("auto_woke_up") !== -1) { petIsSleeping = false; activeBubble = null; pushReaction("woke_up", nowMs); }
    if (events.indexOf("scolded")     !== -1) pushReaction("scolded",     nowMs);
    if (events.indexOf("praised")     !== -1) pushReaction("praised",     nowMs);
    if (events.indexOf("became_sick") !== -1) pushReaction("became_sick", nowMs);
    if (events.indexOf("cured")       !== -1) pushReaction("healed",      nowMs);
    if (events.indexOf("pooped")      !== -1) pushReaction("poop_appeared", nowMs);
    for (var ei = 0; ei < events.length; ei++) {
      if (events[ei].indexOf("evolved_to_") === 0) { pushReaction("evolved", nowMs); break; }
    }

    if (!petIsSleeping) {
      for (var ai = 0; ai < events.length; ai++) {
        if (events[ai].indexOf("attention_call_") === 0) { showBubble(humaniseEvent(events[ai], state.name, state)); break; }
      }
      if (events.indexOf("commit_activity_rewarded") !== -1) showBubble(humaniseEvent("commit_activity_rewarded", state.name, state));
      else if (events.indexOf("code_activity_rewarded") !== -1) showBubble(humaniseEvent("code_activity_rewarded", state.name, state));
    }

    var prevGift = lastState && lastState.activeAttentionCall === "gift";
    if (!prevGift && call === "gift") { giftBoxX = 4 + Math.floor(Math.random() * Math.max(1, spriteCanvas.width - 28)); }
    else if (prevGift && call !== "gift") { giftBoxX = null; }

    lastState = state;

    if (REDUCED_MOTION) {
      var floorY2 = getFloorY(state);
      var sc2 = STAGE_SCALES[state.stage] || 0.5;
      var bSz2 = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * sc2);
      var bW2  = effectiveBWidth(state, bSz2);
      var stX  = Math.max(4, Math.floor(spriteCanvas.width / 2 - bW2 / 2));
      drawEnvironment(state);
      drawBody(state, stX, floorY2, false, 0);
      drawStatusIndicators(state, stX, floorY2);
    }
  }

  // ── SSE connection ────────────────────────────────────────────────────────
  var ssePort  = parseInt(document.location.port || "39847", 10);
  var sseUrl   = "http://127.0.0.1:" + ssePort + "/sse";
  var sse      = null;
  var firstMsg = false;

  function connect() {
    if (sse) { try { sse.close(); } catch {} }
    sse = new EventSource(sseUrl);

    sse.onmessage = function (evt) {
      try {
        var payload = JSON.parse(evt.data);
        if (!firstMsg) {
          firstMsg = true;
          connectingEl.classList.add("hidden");
          panelRoot.classList.remove("hidden");
          // Panel was display:none so ResizeObserver never fired — force resize now
          requestAnimationFrame(resizeCanvas);
        }
        renderState(payload.state, payload.source);
      } catch {}
    };

    sse.onerror = function () {
      // EventSource auto-retries — just show connecting state if we haven't received anything yet
      if (!firstMsg) {
        connectingEl.classList.remove("hidden");
        panelRoot.classList.add("hidden");
      }
    };
  }

  connect();

  showScreen("no-pet");

}());
