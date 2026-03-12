/**
 * sidebar.js — vscode_gotchi webview client
 *
 * Communicates with the extension host via the VS Code webview message API:
 *   - postMessage(cmd)  → sends a command to SidebarProvider
 *   - onmessage event   → receives { type: "stateUpdate", state } snapshots
 *
 * No external dependencies; vanilla JS only.
 */

/* global acquireVsCodeApi */

(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // ── Element references ──────────────────────────────────────────────────

  const setupScreen = document.getElementById("setup-screen");
  const gameScreen  = document.getElementById("game-screen");
  const deadScreen  = document.getElementById("dead-screen");

  const petNameInput = document.getElementById("pet-name");
  const startBtn     = document.getElementById("start-btn");
  const btnNewGame   = document.getElementById("btn-new-game");
  const btnRestart   = document.getElementById("btn-restart");
  const btnContinue  = document.getElementById("btn-continue");

  const petNameDisplay = document.getElementById("pet-name-display");
  const moodLabel      = document.getElementById("mood-label");
  const infoLine       = document.getElementById("info-line");
  const eventLog       = document.getElementById("event-log");
  const deadStats      = document.getElementById("dead-stats");
  const deadTime       = document.getElementById("dead-time");
  const deadEventLog   = document.getElementById("dead-event-log");
  const highScoreSection = document.getElementById("high-score-section");
  const highScoreStats   = document.getElementById("high-score-stats");
  const setupHighScore   = document.getElementById("setup-high-score");
  const setupHsStats     = document.getElementById("setup-hs-stats");
  const mealsLeftEl    = document.getElementById("meals-left");
  const snacksLeftEl   = document.getElementById("snacks-left");

  const barHunger    = document.getElementById("bar-hunger");
  const barHappiness = document.getElementById("bar-happiness");
  const barEnergy    = document.getElementById("bar-energy");
  const barHealth    = document.getElementById("bar-health");

  const spriteCanvas = document.getElementById("sprite-canvas");
  const spriteCtx    = spriteCanvas.getContext("2d");

  // ── Animation state ──────────────────────────────────────────────────────

  let lastState     = null;   // most recent PetState snapshot
  let petX          = 4;      // horizontal position (canvas pixels, left edge of body)
  let petVelX       = 1;      // direction: +1 = right, -1 = left
  let petFacingLeft = false;
  let idlePauseTicks = 0;     // frames remaining in current idle pause
  let animTick      = 0;      // raw frame counter (drives leg/bob animation)
  let latestHighScore = null; // cached high score from last stateUpdate
  let currentScreen = "game"; // tracks which screen is visible
  let hasActiveGame = false;  // true once a real (non-needs_new_game) state is received
  let pendingNewGame = false; // set when Hatch! is clicked; bypasses setup-screen suppression

  // ── Setup form state ────────────────────────────────────────────────────

  let selectedPetType = "codeling";
  let selectedColor   = "neon";

  // Wire up option-button groups
  document.querySelectorAll(".option-row").forEach(function (row) {
    row.querySelectorAll(".opt-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        row.querySelectorAll(".opt-btn").forEach(function (b) {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
        const value = btn.dataset["value"];
        if (row.getAttribute("aria-label") === "Pet type") {
          selectedPetType = value;
        } else {
          selectedColor = value;
        }
      });
    });
  });

  startBtn.addEventListener("click", function () {
    const name = petNameInput.value.trim() || "Gotchi";
    pendingNewGame = true;
    vscode.postMessage({
      command: "new_game",
      name: name,
      petType: selectedPetType,
      color: selectedColor,
    });
  });

  // ── Action buttons ───────────────────────────────────────────────────────

  document.getElementById("btn-feed-meal").addEventListener("click", function () {
    vscode.postMessage({ command: "feed", feedType: "meal" });
  });

  document.getElementById("btn-feed-snack").addEventListener("click", function () {
    vscode.postMessage({ command: "feed", feedType: "snack" });
  });

  document.getElementById("btn-play").addEventListener("click", function () {
    // Simple win/loss determined randomly client-side for variety
    const result = Math.random() > 0.35 ? "win" : "lose";
    vscode.postMessage({ command: "play", game: "guess", result: result });
  });

  document.getElementById("btn-sleep-wake").addEventListener("click", function () {
    // Read current sleeping state from the button's own data attribute,
    // set by renderState() after each state update.
    const isSleeping = document.getElementById("btn-sleep-wake").dataset["sleeping"] === "true";
    vscode.postMessage({ command: isSleeping ? "wake" : "sleep" });
  });

  document.getElementById("btn-clean").addEventListener("click", function () {
    vscode.postMessage({ command: "clean" });
  });

  document.getElementById("btn-medicine").addEventListener("click", function () {
    vscode.postMessage({ command: "medicine" });
  });

  document.getElementById("btn-praise").addEventListener("click", function () {
    vscode.postMessage({ command: "praise" });
  });

  document.getElementById("btn-scold").addEventListener("click", function () {
    vscode.postMessage({ command: "scold" });
  });

  btnNewGame.addEventListener("click", function () {
    showScreen("setup");
  });

  btnRestart.addEventListener("click", function () {
    showScreen("setup");
  });

  if (btnContinue) {
    btnContinue.addEventListener("click", function () {
      showScreen("game");
    });
  }

  // ── Screen management ────────────────────────────────────────────────────

  /**
   * Show one of "setup", "game", or "dead"; hide the others.
   * @param {"setup"|"game"|"dead"} name
   */
  function showScreen(name) {
    currentScreen = name;
    setupScreen.classList.toggle("hidden", name !== "setup");
    gameScreen.classList.toggle("hidden",  name !== "game");
    deadScreen.classList.toggle("hidden",  name !== "dead");
    if (name === "game")  { resizeCanvas(); }
    if (name === "setup") {
      renderSetupHighScore(latestHighScore);
      if (btnContinue) {
        btnContinue.classList.toggle("hidden", !hasActiveGame);
      }
    }
  }

  // ── Canvas sizing ─────────────────────────────────────────────────────────

  /**
   * Sync the canvas pixel buffer width to the container's CSS width.
   * Called on first render and whenever the sidebar is resized.
   */
  function resizeCanvas() {
    const container = spriteCanvas.parentElement;
    if (!container) { return; }
    const newWidth = Math.max(container.clientWidth, 64);
    if (spriteCanvas.width === newWidth) { return; }
    spriteCanvas.width = newWidth;
    // Clamp petX so the pet doesn't walk off the right edge after a resize
    if (lastState) {
      const scale   = STAGE_SCALES[lastState.stage] || 0.5;
      const bSize   = Math.round(24 * scale);
      const maxX    = spriteCanvas.width - bSize - 4;
      if (petX > maxX) { petX = Math.max(4, maxX); }
    }
  }

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(spriteCanvas.parentElement);
  }
  resizeCanvas();

  // ── Movement helpers ──────────────────────────────────────────────────────

  /** Canvas pixels per animation frame (approx. 60 fps). */
  const MOOD_SPEED = { happy: 1.5, neutral: 0.8, sad: 0.4 };

  function getPetSpeed(state) {
    if (!state || state.sleeping) { return 0; }
    if (state.sick)               { return 0.3; }
    return MOOD_SPEED[state.mood] || 0.8;
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  function animationLoop() {
    if (lastState && lastState.alive) {
      const speed      = getPetSpeed(lastState);
      const stageScale = STAGE_SCALES[lastState.stage] || 0.5;
      const bodySize   = Math.round(24 * stageScale);
      const minX       = 4;
      const maxX       = spriteCanvas.width - bodySize - 4;

      animTick++;

      if (speed > 0 && idlePauseTicks <= 0) {
        petX += petVelX * speed;

        if (petX >= maxX) {
          petX          = maxX;
          petVelX       = -1;
          petFacingLeft = true;
          // Pause briefly after bouncing off the right wall
          if (Math.random() < 0.4) {
            idlePauseTicks = 20 + Math.floor(Math.random() * 60);
          }
        } else if (petX <= minX) {
          petX          = minX;
          petVelX       = 1;
          petFacingLeft = false;
          if (Math.random() < 0.4) {
            idlePauseTicks = 20 + Math.floor(Math.random() * 60);
          }
        }

        // Occasional mid-walk pause (and 50 % chance to turn around)
        if (Math.random() < 0.0015) {
          idlePauseTicks = 30 + Math.floor(Math.random() * 90);
          if (Math.random() < 0.5) {
            petVelX       = -petVelX;
            petFacingLeft = !petFacingLeft;
          }
        }
      } else if (idlePauseTicks > 0) {
        idlePauseTicks--;
      }

      // Leg alternation and body bob only while walking
      const walking  = speed > 0 && idlePauseTicks <= 0;
      const legFrame = walking ? Math.floor(animTick / 10) % 2 : 0;
      const bobOffset = walking ? legFrame : 0;   // 0 or 1 pixel up

      drawSprite(lastState, Math.round(petX), bobOffset, petFacingLeft, legFrame);
    }

    requestAnimationFrame(animationLoop);
  }

  requestAnimationFrame(animationLoop);

  // ── State rendering ──────────────────────────────────────────────────────

  /**
   * Update every UI element from a PetState snapshot.
   * @param {object} state
   * @param {number} mealsGiven
   * @param {object|null} highScore
   */
  function renderState(state, mealsGiven, highScore) {
    if (!state.alive) {
      renderDeadScreen(state, highScore);
      showScreen("dead");
      return;
    }

    showScreen("game");

    petNameDisplay.textContent = state.name || "Gotchi";
    moodLabel.textContent      = moodText(state);

    setBar(barHunger,    state.hunger);
    setBar(barHappiness, state.happiness);
    setBar(barEnergy,    state.energy);
    setHealthBar(barHealth, state.health);

    const poopStr = state.poops === 1 ? "1 poop" : state.poops + " poops";
    const typeLabel = (state.petType || "codeling");
    const typeLabelCap = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
    infoLine.textContent =
      "Age: " + state.ageDays + "d  |  " +
      state.stage            + "  |  " +
      typeLabelCap           + "  |  " +
      poopStr;

    // Update sleep/wake button label to match current state
    const sleepWakeBtn = document.getElementById("btn-sleep-wake");
    sleepWakeBtn.textContent = state.sleeping ? "Wake" : "Sleep";
    sleepWakeBtn.dataset["sleeping"] = state.sleeping ? "true" : "false";

    // BUGFIX-002: disable care buttons while pet is sleeping
    const isSleeping = state.sleeping;
    ["btn-feed-meal", "btn-feed-snack", "btn-play",
     "btn-clean", "btn-medicine", "btn-praise", "btn-scold"].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) { btn.disabled = isSleeping; }
    });

    // Meals-left badge on Feed button
    var MEAL_MAX = 3;
    var mealsLeft = Math.max(0, MEAL_MAX - mealsGiven);
    if (mealsLeftEl) {
      mealsLeftEl.textContent = mealsLeft > 0 ? mealsLeft + "" : "";
    }

    // Snacks-left badge on Snack button + disable when at limit
    var SNACK_MAX = 3;
    var snacksLeft = Math.max(0, SNACK_MAX - (state.snacksGivenThisCycle || 0));
    if (snacksLeftEl) {
      snacksLeftEl.textContent = snacksLeft > 0 ? snacksLeft + "" : "";
    }
    var snackBtn = document.getElementById("btn-feed-snack");
    if (snackBtn && !isSleeping) {
      snackBtn.disabled = snacksLeft <= 0;
    }



    // Reset position when a brand-new or just-loaded pet first appears
    if (!lastState || !lastState.alive) {
      petX          = Math.max(4, Math.floor(spriteCanvas.width / 2 - 12));
      petVelX       = 1;
      petFacingLeft = false;
      animTick      = 0;
    }

    // Hand off to animation loop — it owns all drawing
    lastState = state;

    appendEvents(state.events || [], state.name);

    // Spawn poo animation when the pet poops
    if ((state.events || []).indexOf("pooped") !== -1) { spawnPooAnim(); }
  }

  /**
   * Scale a stat bar to [0, 100].
   * @param {HTMLElement} bar
   * @param {number} value
   */
  function setBar(bar, value) {
    const clamped = Math.max(0, Math.min(100, value));
    bar.style.width = clamped + "%";
  }

  /**
   * Set the health bar width AND colour-shift it: green > 60, yellow 30–60, red < 30.
   * @param {HTMLElement} bar
   * @param {number} value
   */
  function setHealthBar(bar, value) {
    setBar(bar, value);
    bar.classList.toggle("health-low", value < 30);
    bar.classList.toggle("health-mid", value >= 30 && value < 60);
  }

  /**
   * Return a human-readable mood string.
   * @param {object} state
   * @returns {string}
   */
  function moodText(state) {
    if (state.sleeping) { return "Zzz…"; }
    if (state.sick)     { return "Feeling sick"; }
    const mood = state.mood || "neutral";
    return mood.charAt(0).toUpperCase() + mood.slice(1);
  }

  /** Append new event strings to the scrollable event log. */
  function humaniseEvent(code, name) {
    var n = name || "Gotchi";
    var labels = {
      "auto_woke_up":           n + " woke up automatically.",
      "pooped":                  n + " pooped!",
      "became_sick":             n + " got sick!",
      "sickness_damage":         n + " is losing health from being sick!",
      "starvation_damage":       n + " is starving and losing health!",
      "unhappiness_damage":      n + " is miserable and losing health!",
      "died":                    n + " passed away...",
      "fed_snack":               n + " had a snack.",
      "cured":                   n + " recovered!",
      "meal_refused":            n + " refused the meal.",
      "fed_meal":                n + " ate a meal.",
      "snack_refused":           n + " refused the snack.",
      "play_refused_no_energy":  n + " doesn't have enough energy to play!",
      "played":                  n + " played!",
      "already_sleeping":        n + " is already asleep.",
      "fell_asleep":             n + " fell asleep.",
      "already_awake":           n + " is already awake.",
      "woke_up":                 n + " woke up.",
      "already_clean":           "Already clean!",
      "cleaned":                 "Cleaned up " + n + "'s mess.",
      "medicine_not_needed":     n + " isn't sick.",
      "medicine_given":          "Gave " + n + " medicine.",
      "scolded":                 n + " was scolded.",
      "praised":                 n + " was praised!",
      "code_activity_rewarded":  n + " felt stimulated!",
      "evolved_to_senior":       n + " reached their senior years!",
      "died_of_old_age":         n + " passed away of old age...",
    };
    if (labels[code]) { return labels[code]; }
    if (code.indexOf("evolved_to_") === 0) {
      var stage = code.slice("evolved_to_".length);
      return n + " evolved into " + stage + "!";
    }
    if (code.indexOf("minigame_") === 0) {
      return n + " played a mini-game.";
    }
    return code;
  }

  function appendEvents(events, petName) {
    if (!events.length) { return; }
    events.forEach(function (text) {
      const li = document.createElement("li");
      li.textContent = humaniseEvent(text, petName);
      eventLog.insertBefore(li, eventLog.firstChild);
    });
    // Trim log to last 20 entries
    while (eventLog.children.length > 20) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }

  /**
   * Spawn a pixel-art poo sprite that floats up from near the pet and fades out.
   * Called whenever a "pooped" event arrives in the state update.
   */
  function spawnPooAnim() {
    var container = document.getElementById("sprite-container");
    if (!container) { return; }

    // 6×7 pixel art poo grid: 1 = dark brown (#6B3A2A), 2 = light brown (#A0522D)
    var PIXELS = [
      [0,0,1,1,0,0],
      [0,1,1,1,1,0],
      [1,1,2,1,1,1],
      [1,2,1,1,1,1],
      [0,1,1,1,1,0],
      [0,1,1,1,1,0],
      [1,1,1,1,1,1],
    ];
    var SCALE = 3;
    var W = PIXELS[0].length * SCALE;
    var H = PIXELS.length    * SCALE;

    var c = document.createElement("canvas");
    c.width  = W;
    c.height = H;
    var ctx = c.getContext("2d");
    PIXELS.forEach(function (row, ry) {
      row.forEach(function (px, rx) {
        if (!px) { return; }
        ctx.fillStyle = px === 2 ? "#A0522D" : "#6B3A2A";
        ctx.fillRect(rx * SCALE, ry * SCALE, SCALE, SCALE);
      });
    });

    // Spawn near the pet's current horizontal position
    var x = Math.max(0, Math.min(container.offsetWidth - W, petX));
    var div = document.createElement("div");
    div.className   = "poo-anim";
    div.style.left  = x + "px";
    div.appendChild(c);
    container.appendChild(div);

    div.addEventListener("animationend", function () {
      if (div.parentNode) { div.parentNode.removeChild(div); }
    });
  }

  /** Show (or hide) the high score block on the setup screen. */
  function renderSetupHighScore(hs) {
    if (!setupHighScore || !setupHsStats) { return; }
    if (hs) {
      setupHighScore.classList.remove("hidden");
      var hsElapsed  = hs.diedAt - (hs.spawnedAt || 0);
      var hsTotalSec = Math.floor(hsElapsed / 1000);
      var hsDays     = Math.floor(hsTotalSec / 86400);
      var hsHours    = Math.floor((hsTotalSec % 86400) / 3600);
      var hsMinutes  = Math.floor((hsTotalSec % 3600)  / 60);
      var hsParts = [];
      if (hsDays    > 0) { hsParts.push(hsDays    + "d"); }
      if (hsHours   > 0) { hsParts.push(hsHours   + "h"); }
      if (hsMinutes > 0) { hsParts.push(hsMinutes + "m"); }
      if (hsParts.length === 0) { hsParts.push("< 1m"); }
      setupHsStats.textContent =
        hs.name + "  |  " + hs.ageDays + " day(s)  |  " + hs.stage + "\n" +
        hsParts.join(" ") + " real time";
    } else {
      setupHighScore.classList.add("hidden");
    }
  }

  /** Show the dead screen with final stats. */
  function renderDeadScreen(state, highScore) {
    deadStats.textContent =
      state.name + " lived " + state.ageDays + " day(s).\n" +
      "Stage reached: " + state.stage + ".";

    // Real-life elapsed time since spawnedAt
    if (deadTime) {
      var spawnedAt = state.spawnedAt || 0;
      var elapsedMs = Date.now() - spawnedAt;
      var totalSec  = Math.floor(elapsedMs / 1000);
      var days      = Math.floor(totalSec / 86400);
      var hours     = Math.floor((totalSec % 86400) / 3600);
      var minutes   = Math.floor((totalSec % 3600)  / 60);
      var parts = [];
      if (days    > 0) { parts.push(days    + "d"); }
      if (hours   > 0) { parts.push(hours   + "h"); }
      if (minutes > 0) { parts.push(minutes + "m"); }
      if (parts.length === 0) { parts.push("< 1m"); }
      deadTime.textContent = "Lived for " + parts.join(" ") + " in real time";
    }

    // Recent event log (last 20 events)
    if (deadEventLog) {
      deadEventLog.innerHTML = "";
      var log = state.recentEventLog || [];
      // Show most-recent first
      var reversed = log.slice().reverse();
      reversed.forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        deadEventLog.appendChild(li);
      });
    }

    // High score panel
    if (highScoreSection && highScoreStats) {
      if (highScore) {
        highScoreSection.classList.remove("hidden");
        var hsElapsed = highScore.diedAt - (highScore.spawnedAt || 0);
        var hsTotalSec = Math.floor(hsElapsed / 1000);
        var hsDays    = Math.floor(hsTotalSec / 86400);
        var hsHours   = Math.floor((hsTotalSec % 86400) / 3600);
        var hsMinutes = Math.floor((hsTotalSec % 3600)  / 60);
        var hsParts = [];
        if (hsDays    > 0) { hsParts.push(hsDays    + "d"); }
        if (hsHours   > 0) { hsParts.push(hsHours   + "h"); }
        if (hsMinutes > 0) { hsParts.push(hsMinutes + "m"); }
        if (hsParts.length === 0) { hsParts.push("< 1m"); }
        highScoreStats.textContent =
          highScore.name + "  |  " + highScore.ageDays + " day(s)  |  " + highScore.stage + "\n" +
          hsParts.join(" ") + " real time";
      } else {
        highScoreSection.classList.add("hidden");
      }
    }
  }

  // ── Sprite drawing ───────────────────────────────────────────────────────

  /**
   * Draw the pet sprite at a given horizontal position on the stage canvas.
   *
   * The canvas is cleared and redrawn every call (driven by animationLoop).
   * A horizontal flip is applied when the pet faces left.
   *
   * @param {object}  state      - Current PetState snapshot.
   * @param {number}  x          - Left edge of the body in canvas pixels.
   * @param {number}  bobOffset  - Pixels to raise the body (walking bob, 0–1).
   * @param {boolean} facingLeft - Whether the sprite should face left.
   * @param {number}  legFrame   - Leg animation frame (0 or 1).
   */
  function drawSprite(state, x, bobOffset, facingLeft, legFrame) {
    const palette    = COLOR_PALETTES[state.color] || COLOR_PALETTES["neon"];
    const primary    = palette.primary;
    const secondary  = palette.secondary;
    const background = palette.background;

    const W = spriteCanvas.width;
    const H = spriteCanvas.height;

    spriteCtx.clearRect(0, 0, W, H);

    // Background
    spriteCtx.fillStyle = background;
    spriteCtx.fillRect(0, 0, W, H);

    // Ground line
    spriteCtx.fillStyle = "rgba(255,255,255,0.08)";
    spriteCtx.fillRect(0, H - 5, W, 1);

    // Persistent poo sprites — drawn before the pet so they sit on the floor
    // 6×7 pixel art: 1 = dark brown, 2 = light brown highlight
    var POO_PIXELS = [
      [0,0,1,1,0,0],
      [0,1,1,1,1,0],
      [1,1,2,1,1,1],
      [1,2,1,1,1,1],
      [0,1,1,1,1,0],
      [0,1,1,1,1,0],
      [1,1,1,1,1,1],
    ];
    var PS = 2;                            // 2px per pixel → 12×14 total
    var pW = POO_PIXELS[0].length * PS;
    var pH = POO_PIXELS.length    * PS;
    var pooGroundY = H - 4 - pH;           // sit just above the ground line
    var pooXPositions = [
      Math.round(W * 0.12),
      Math.round(W * 0.52),
      Math.round(W * 0.78),
    ];
    var numPoos = Math.min(state.poops || 0, 3);
    for (var pi = 0; pi < numPoos; pi++) {
      var pooX = pooXPositions[pi];
      POO_PIXELS.forEach(function (row, ry) {
        row.forEach(function (cell, rx) {
          if (!cell) { return; }
          spriteCtx.fillStyle = cell === 2 ? "#A0522D" : "#6B3A2A";
          spriteCtx.fillRect(pooX + rx * PS, pooGroundY + ry * PS, PS, PS);
        });
      });
    }

    // Body size scales with stage
    const stageScale = STAGE_SCALES[state.stage] || 0.5;
    const bodySize   = Math.round(24 * stageScale);
    const legH       = Math.max(2, Math.round(bodySize * 0.22));  // leg height in pixels
    const bodyY      = H - bodySize - legH - 4 - bobOffset;       // sits above legs, above ground

    // Apply horizontal flip for direction
    spriteCtx.save();
    if (facingLeft) {
      spriteCtx.translate(x + bodySize, 0);
      spriteCtx.scale(-1, 1);
      spriteCtx.translate(-x, 0);
    }

    // Legs (alternating height = walking animation)
    const legW  = Math.max(2, Math.round(bodySize * 0.15));
    const legX1 = x + Math.round(bodySize * 0.2);
    const legX2 = x + Math.round(bodySize * 0.6);
    const legY  = bodyY + bodySize;
    spriteCtx.fillStyle = primary;
    spriteCtx.fillRect(legX1, legY, legW, legFrame === 0 ? legH     : legH - 1);
    spriteCtx.fillRect(legX2, legY, legW, legFrame === 0 ? legH - 1 : legH    );

    // Body
    spriteCtx.fillStyle = primary;
    spriteCtx.fillRect(x, bodyY, bodySize, bodySize);

    // Eyes
    const eyeSize   = Math.max(2, Math.round(bodySize * 0.18));
    const eyeY      = bodyY + Math.round(bodySize * 0.25);
    const leftEyeX  = x + Math.round(bodySize * 0.20);
    const rightEyeX = x + Math.round(bodySize * 0.62);

    spriteCtx.fillStyle = state.sick     ? "#ff0000"  :
                          state.sleeping ? "#888888"  : secondary;
    spriteCtx.fillRect(leftEyeX,  eyeY, eyeSize, eyeSize);
    spriteCtx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

    // Mouth
    const mouthY = bodyY + Math.round(bodySize * 0.65);
    const mouthX = x + Math.round(bodySize * 0.3);
    const mouthW = Math.round(bodySize * 0.4);

    spriteCtx.fillStyle = secondary;
    if (state.mood === "happy") {
      spriteCtx.fillRect(mouthX,              mouthY,     2, 2);
      spriteCtx.fillRect(mouthX + mouthW - 2, mouthY,     2, 2);
      spriteCtx.fillRect(mouthX + 2,          mouthY + 2, mouthW - 4, 2);
    } else if (state.mood === "sad" || state.sick) {
      spriteCtx.fillRect(mouthX,              mouthY + 2, 2, 2);
      spriteCtx.fillRect(mouthX + mouthW - 2, mouthY + 2, 2, 2);
      spriteCtx.fillRect(mouthX + 2,          mouthY,     mouthW - 4, 2);
    } else {
      spriteCtx.fillRect(mouthX, mouthY + 1, mouthW, 2);
    }

    spriteCtx.restore();  // end flip transform

    // Status indicators — drawn outside the flip so text stays readable
    const indicatorX = x + Math.round(bodySize / 2) - 4;
    const indicatorY = bodyY - 3;
    if (state.sleeping) {
      spriteCtx.fillStyle = secondary;
      spriteCtx.font = "bold 10px monospace";
      spriteCtx.fillText("z", indicatorX, indicatorY);
    } else if (state.sick) {
      spriteCtx.fillStyle = "#ff4444";
      spriteCtx.font = "bold 10px monospace";
      spriteCtx.fillText("+", indicatorX, indicatorY);
    }
  }

  // ── Static look-up tables ────────────────────────────────────────────────

  const COLOR_PALETTES = {
    neon:   { primary: "#39ff14", secondary: "#ff00ff", background: "#0d0d0d" },
    pastel: { primary: "#ffb3c1", secondary: "#b5ead7", background: "#fdf6ec" },
    mono:   { primary: "#e0e0e0", secondary: "#888888", background: "#1a1a1a" },
    ocean:  { primary: "#00cfff", secondary: "#004e7c", background: "#001f3f" },
  };

  const STAGE_SCALES = {
    egg:    0.35,
    baby:   0.45,
    child:  0.55,
    teen:   0.70,
    adult:  0.85,
    senior: 0.90,
  };

  // ── Message handler ──────────────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    const message = event.data;
    if (!message || message.type !== "stateUpdate") { return; }

    const state = message.state;

    // Cache the latest high score whenever the host sends one
    if (message.highScore) { latestHighScore = message.highScore; }

    // needs_new_game response: stay on / return to setup
    if (state && state.needs_new_game) {
      showScreen("setup");
      return;
    }

    if (state) {
      // Mark that a real game exists so the Continue button can appear.
      // Clear hasActiveGame when the pet dies so Continue is hidden after death.
      if (state.alive) {
        hasActiveGame = true;
      } else {
        hasActiveGame = false;
      }

      // UI-refresh fix: don't bounce the user off the setup screen on every tick.
      // If the user is on setup and the pet is still alive, just update the
      // Continue button visibility without switching screens.
      // Exception: pendingNewGame bypasses this so Hatch! always transitions.
      if (currentScreen === "setup" && state.alive && !pendingNewGame) {
        if (btnContinue) { btnContinue.classList.toggle("hidden", !hasActiveGame); }
        return;
      }

      pendingNewGame = false;
      renderState(state, message.mealsGivenThisCycle || 0, latestHighScore);
    }
  });

  // ── Initial view ─────────────────────────────────────────────────────────
  // Show game screen by default; the extension host will post state on open,
  // routing to setup (needs_new_game) or rendering the live pet immediately.
  showScreen("game");

}());
