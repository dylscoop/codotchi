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

  // ── Constants ────────────────────────────────────────────────────────────

  /** Number of in-game days that equal one displayed year. */
  const GAME_DAYS_PER_YEAR = 365;

  /** Energy cost of the play action — must match PLAY_ENERGY_COST in gameEngine.ts. */
  var PLAY_ENERGY_COST = 25;

  /** Energy cost of the pat action — must match PAT_ENERGY_COST in gameEngine.ts. */
  var PAT_ENERGY_COST = 20;

  /** Base movement speed in px/s per life stage (horizontal). */
  const STAGE_BASE_SPEED_PPS = {
    egg:    0,
    baby:   22,
    child:  35,
    teen:   30,
    adult:  28,
    senior: 15,
  };

  /** Mood multiplier applied to base speed. */
  const MOOD_MULTIPLIER = { happy: 1.5, neutral: 1.0, sad: 0.4 };

  /** Gravity in px/s² (downward). */
  const GRAVITY = 500;

  /** Happy hop vertical impulse in px/s (upward, so negative in canvas coords). */
  const HOP_IMPULSE = -175;

  /** Seconds between happy hops when the pet is on the floor. */
  const HOP_INTERVAL = 4.0;

  /** Floor bounce coefficient (velocity damping on ground contact). */
  const BOUNCE_COEFF = 0.25;

  /** Minimum vertical speed below which bouncing stops (px/s). */
  const BOUNCE_MIN = 2;

  /** Reaction animation durations in ms. */
  const REACTION_DURATIONS = {
    fed_meal:      500,
    fed_snack:     500,
    played:        700,
    fell_asleep:   600,
    woke_up:       400,
    scolded:       500,
    praised:       600,
    evolved:       900,
    poop_appeared: 700,
    became_sick:   600,
    healed:        500,
  };

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

  const devModeBanner    = document.getElementById("dev-mode-banner");
  const btnResetHs       = document.getElementById("btn-reset-hs");
  const resetHsConfirm   = document.getElementById("reset-hs-confirm");
  const btnResetHsYes    = document.getElementById("btn-reset-hs-yes");
  const btnResetHsCancel = document.getElementById("btn-reset-hs-cancel");
  const snacksLeftEl   = document.getElementById("snacks-left");

  const barHunger    = document.getElementById("bar-hunger");
  const barHappiness = document.getElementById("bar-happiness");
  const barEnergy    = document.getElementById("bar-energy");
  const barHealth    = document.getElementById("bar-health");

  const spriteCanvas = document.getElementById("sprite-canvas");
  const spriteCtx    = spriteCanvas.getContext("2d");

  // ── Reduced-motion detection ─────────────────────────────────────────────
  // Reads the data attribute injected by the host (from gotchi.reducedMotion
  // setting) OR the OS-level prefers-reduced-motion media query.

  const REDUCED_MOTION = document.body.dataset.reducedMotion === "true" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── Animation state ──────────────────────────────────────────────────────

  let lastState     = null;   // most recent PetState snapshot
  let petX          = 4;      // horizontal position (canvas pixels, left edge of body)
  let petY          = null;   // vertical position (null = init on first frame)
  let petVx         = 0;      // horizontal velocity px/s
  let petVy         = 0;      // vertical velocity px/s
  let petFacingLeft = false;
  let animTick      = 0;      // raw frame counter (drives leg animation period)
  let lastFrameMs   = 0;      // performance.now() of previous rAF frame
  let breathPhase   = 0;      // sleeping breath bob phase in radians
  let hopTimer      = HOP_INTERVAL; // seconds until next happy hop
  let idleTimer     = 0;      // seconds until next wander direction/pause change
  let reactionQueue = [];     // [{ type, startMs, durationMs, startX, startY }]
  let latestHighScore = null; // cached high score from last stateUpdate
  let currentScreen = "game"; // tracks which screen is visible
  let hasActiveGame = false;  // true once a real (non-needs_new_game) state is received
  let pendingNewGame = false; // set when Hatch! is clicked; bypasses setup-screen suppression
  let giftBoxX   = null;     // floor X of gift box while a "gift" attention call is active
  let snackItems = [];       // floor items: [{ x, type: "candy"|"bone" }]

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
    if (!lastState || lastState.energy < PAT_ENERGY_COST) {
      // Let the server handle the refusal gracefully
      vscode.postMessage({ command: "play" });
      return;
    }
    showMgOverlay();
    showMgPanel("mg-select");
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
      // After death, Continue returns to the dead-screen summary; otherwise
      // it returns to the live game screen.
      showScreen(lastState && !lastState.alive ? "dead" : "game");
    });
  }

  if (btnResetHs) {
    btnResetHs.addEventListener("click", function () {
      if (btnResetHs)     { btnResetHs.classList.add("hidden"); }
      if (resetHsConfirm) { resetHsConfirm.classList.remove("hidden"); }
    });
  }

  if (btnResetHsCancel) {
    btnResetHsCancel.addEventListener("click", function () {
      if (resetHsConfirm) { resetHsConfirm.classList.add("hidden"); }
      if (btnResetHs)     { btnResetHs.classList.remove("hidden"); }
    });
  }

  if (btnResetHsYes) {
    btnResetHsYes.addEventListener("click", function () {
      vscode.postMessage({ command: "reset_high_score" });
      if (resetHsConfirm) { resetHsConfirm.classList.add("hidden"); }
      if (setupHighScore) { setupHighScore.classList.add("hidden"); }
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

  // ── Mini-game panel helpers ───────────────────────────────────────────────

  var mgPanels = document.getElementById("game-panels");
  var btnGrid  = document.querySelector(".btn-grid");

  function showMgOverlay() {
    btnGrid.classList.add("hidden");
    mgPanels.classList.remove("hidden");
  }
  function hideMgOverlay() {
    mgPanels.classList.add("hidden");
    btnGrid.classList.remove("hidden");
    if (lrCanvas) { lrCanvas.classList.add("hidden"); }
  }

  function showMgPanel(id) {
    var panels = mgPanels.querySelectorAll(".mg-panel");
    panels.forEach(function (p) { p.classList.add("hidden"); });
    document.getElementById(id).classList.remove("hidden");
  }

  function sendPlayResult(game, result) {
    vscode.postMessage({ command: "play", game: game, result: result });
    // Do NOT call hideMgOverlay() here — the result panel stays open until the player taps OK.
  }

  // Wire up game-select buttons
  document.getElementById("btn-mg-lr").addEventListener("click", function () {
    startLeftRightGame();
  });
  document.getElementById("btn-mg-hl").addEventListener("click", function () {
    startHigherLowerGame();
  });
  document.getElementById("btn-mg-cf").addEventListener("click", function () {
    startCoinFlipGame();
  });
  document.getElementById("btn-mg-pat").addEventListener("click", function () {
    hideMgOverlay();
    vscode.postMessage({ command: "pat" });
  });
  document.getElementById("btn-mg-cancel").addEventListener("click", function () {
    hideMgOverlay();
  });
  document.getElementById("btn-mg-ok").addEventListener("click", function () {
    hideMgOverlay();
  });

  // ── Left / Right game ─────────────────────────────────────────────────────

  var lrRound, lrScore, lrPetSide, lrAnswered, lrTimerId, lrCountdown;
  var lrCanvas  = document.getElementById("lr-canvas");
  var lrCtx     = lrCanvas ? lrCanvas.getContext("2d") : null;

  document.getElementById("btn-lr-left").addEventListener("click",  function () { handleLRChoice("left"); });
  document.getElementById("btn-lr-right").addEventListener("click", function () { handleLRChoice("right"); });

  function startLeftRightGame() {
    lrRound    = 0;
    lrScore    = 0;
    lrAnswered = false;
    if (lrCanvas) { lrCanvas.classList.remove("hidden"); }
    showMgPanel("mg-left-right");
    startLRRound();
  }

  function startLRRound() {
    lrAnswered  = false;
    lrPetSide   = Math.random() < 0.5 ? "left" : "right";
    lrCountdown = 3;
    drawLRDoors(null);
    updateLRScore();
    document.getElementById("lr-countdown").textContent = lrCountdown;
    if (lrTimerId) { clearInterval(lrTimerId); }
    lrTimerId = setInterval(function () {
      lrCountdown -= 1;
      document.getElementById("lr-countdown").textContent = lrCountdown;
      if (lrCountdown <= 0) {
        clearInterval(lrTimerId);
        resolveLRRound(null); // timeout — treat as wrong
      }
    }, 1000);
  }

  /**
   * Draw the two pixel-art doors on the LR canvas.
   * revealState: null = closed, "correct" = player picked right side, "wrong" = player picked wrong side
   * On reveal the chosen door opens; the unchosen door stays closed (or dim on wrong).
   * @param {string|null} revealState
   * @param {string|null} playerChoice  "left" or "right" (only used when revealState != null)
   */
  function drawLRDoors(revealState, playerChoice) {
    if (!lrCtx) { return; }
    var W = lrCanvas.width;
    var H = lrCanvas.height;
    lrCtx.clearRect(0, 0, W, H);

    // Door geometry — two doors side by side, each ~30% wide, centred vertically in lower 3/4 of canvas
    var dw = Math.floor(W * 0.30);
    var dh = Math.floor(H * 0.68);
    var dy = Math.floor(H * 0.20);
    var gap = Math.floor(W * 0.05);
    var totalDoorsW = dw * 2 + gap;
    var startX = Math.floor((W - totalDoorsW) / 2);
    var leftDoor  = { x: startX,           y: dy, w: dw, h: dh };
    var rightDoor = { x: startX + dw + gap, y: dy, w: dw, h: dh };

    [leftDoor, rightDoor].forEach(function (door, idx) {
      var side = idx === 0 ? "left" : "right";
      var fg  = "var(--vscode-foreground, #cccccc)";
      var bg  = "var(--vscode-sideBar-background, #1e1e1e)";

      var open = false;
      var dim  = false;

      if (revealState !== null) {
        if (side === lrPetSide) {
          open = true;
        } else {
          dim = true;
        }
      }

      // Door frame
      lrCtx.strokeStyle = dim ? "rgba(150,150,150,0.35)" : fg;
      lrCtx.lineWidth = 2;
      lrCtx.strokeRect(door.x, door.y, door.w, door.h);

      // Door fill
      lrCtx.fillStyle = dim
        ? "rgba(60,60,60,0.4)"
        : "var(--vscode-editor-background, #252526)";
      lrCtx.fillRect(door.x + 2, door.y + 2, door.w - 4, door.h - 4);

      if (!open) {
        // Door knob
        lrCtx.fillStyle = dim ? "rgba(150,150,150,0.4)" : fg;
        var knobX = (side === "left") ? door.x + door.w - 10 : door.x + 8;
        lrCtx.fillRect(knobX, door.y + Math.floor(door.h / 2) - 3, 4, 6);
        // "?" question mark
        lrCtx.fillStyle = dim ? "rgba(150,150,150,0.4)" : fg;
        lrCtx.font = "bold " + Math.floor(door.h * 0.35) + "px monospace";
        lrCtx.textAlign = "center";
        lrCtx.textBaseline = "middle";
        lrCtx.fillText("?", door.x + door.w / 2, door.y + door.h / 2);
      } else {
        // Open door — draw simple pet face
        var cx = door.x + door.w / 2;
        var cy = door.y + door.h / 2 - 4;
        var r  = Math.floor(door.w * 0.22);
        // Head
        lrCtx.beginPath();
        lrCtx.arc(cx, cy, r, 0, Math.PI * 2);
        lrCtx.fillStyle = "var(--vscode-foreground, #cccccc)";
        lrCtx.fill();
        // Eyes
        lrCtx.fillStyle = bg;
        var ew = Math.max(2, Math.floor(r * 0.3));
        var eh = Math.max(3, Math.floor(r * 0.4));
        lrCtx.fillRect(cx - r * 0.5 - ew / 2, cy - r * 0.35, ew, eh);
        lrCtx.fillRect(cx + r * 0.5 - ew / 2, cy - r * 0.35, ew, eh);
        // Smile
        lrCtx.beginPath();
        lrCtx.arc(cx, cy + r * 0.15, r * 0.45, 0, Math.PI);
        lrCtx.strokeStyle = bg;
        lrCtx.lineWidth = 2;
        lrCtx.stroke();
      }
    });

    // Label "LEFT" / "RIGHT" below doors
    lrCtx.fillStyle = "var(--vscode-foreground, #aaaaaa)";
    lrCtx.font = "9px monospace";
    lrCtx.textAlign = "center";
    lrCtx.textBaseline = "top";
    lrCtx.globalAlpha = 0.55;
    lrCtx.fillText("LEFT",  leftDoor.x  + leftDoor.w  / 2, leftDoor.y  + leftDoor.h  + 3);
    lrCtx.fillText("RIGHT", rightDoor.x + rightDoor.w / 2, rightDoor.y + rightDoor.h + 3);
    lrCtx.globalAlpha = 1.0;
  }

  function updateLRScore() {
    var circles = "";
    for (var i = 0; i < 3; i++) {
      if (i < lrScore) {
        circles += "●";
      } else {
        circles += "○";
      }
    }
    document.getElementById("lr-score").textContent = "Round " + (lrRound + 1) + " / 3   " + circles;
  }

  function handleLRChoice(side) {
    if (lrAnswered) { return; }
    clearInterval(lrTimerId);
    resolveLRRound(side);
  }

  function resolveLRRound(side) {
    lrAnswered = true;
    var won = side !== null && side === lrPetSide;
    if (won) { lrScore++; }
    drawLRDoors(won ? "correct" : "wrong", side);
    document.getElementById("lr-countdown").textContent = won ? "✓" : "✗";
    setTimeout(function () {
      lrRound++;
      if (lrRound < 3) {
        startLRRound();
      } else {
        endLeftRightGame();
      }
    }, 1200);
  }

  function endLeftRightGame() {
    var result = lrScore >= 2 ? "win" : "lose";
    // Hide the door canvas once the game ends (result panel shows no doors)
    if (lrCtx) { lrCtx.clearRect(0, 0, lrCanvas.width, lrCanvas.height); }
    if (lrCanvas) { lrCanvas.classList.add("hidden"); }
    showMgPanel("mg-result");
    document.getElementById("mg-result-text").textContent =
      result === "win"
        ? "You won Left / Right! (" + lrScore + "/3 correct)"
        : "You lost Left / Right. (" + lrScore + "/3 correct)";
    sendPlayResult("left_right", result);
  }

  // ── Higher or Lower game ──────────────────────────────────────────────────

  var hlRound, hlCorrect, hlCurrentNum;

  document.getElementById("btn-hl-higher").addEventListener("click", function () { handleHLChoice("higher"); });
  document.getElementById("btn-hl-lower").addEventListener("click",  function () { handleHLChoice("lower"); });

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function startHigherLowerGame() {
    hlRound      = 0;
    hlCorrect    = 0;
    hlCurrentNum = randInt(1, 100);
    showMgPanel("mg-hl");
    showHLRound();
  }

  function showHLRound() {
    document.getElementById("hl-current").textContent = hlCurrentNum;
    document.getElementById("hl-score").textContent   =
      "Round " + (hlRound + 1) + " / 5   Correct: " + hlCorrect;
    document.getElementById("hl-feedback").textContent = "";
    document.getElementById("btn-hl-higher").disabled = false;
    document.getElementById("btn-hl-lower").disabled  = false;
  }

  function handleHLChoice(choice) {
    document.getElementById("btn-hl-higher").disabled = true;
    document.getElementById("btn-hl-lower").disabled  = true;

    var nextNum = hlCurrentNum;
    // Re-roll until different to avoid a tie
    while (nextNum === hlCurrentNum) {
      nextNum = randInt(1, 100);
    }

    var correct = (choice === "higher" && nextNum > hlCurrentNum) ||
                  (choice === "lower"  && nextNum < hlCurrentNum);
    if (correct) { hlCorrect++; }

    document.getElementById("hl-feedback").textContent = correct ? "✓ Correct!" : "✗ Wrong";
    document.getElementById("hl-current").textContent  = nextNum;

    // Animate the pet: jump with joy on a correct answer
    if (correct) {
      spriteCanvas.classList.add("anim-jump");
      spriteCanvas.addEventListener("animationend", function onAnimEnd() {
        spriteCanvas.classList.remove("anim-jump");
        spriteCanvas.removeEventListener("animationend", onAnimEnd);
      });
    }

    setTimeout(function () {
      hlRound++;
      hlCurrentNum = nextNum;
      if (hlRound < 5) {
        showHLRound();
      } else {
        endHigherLowerGame();
      }
    }, 900);
  }

  function endHigherLowerGame() {
    var result = hlCorrect >= 4 ? "win" : "lose";
    showMgPanel("mg-result");
    document.getElementById("mg-result-text").textContent =
      result === "win"
        ? "You won Higher or Lower! (" + hlCorrect + "/5 correct)"
        : "You lost Higher or Lower. (" + hlCorrect + "/5 correct)";
    sendPlayResult("higher_lower", result);
  }

  // ── Coin Flip game ─────────────────────────────────────────────────────────

  document.getElementById("btn-cf-heads").addEventListener("click", function () { handleCFChoice("heads"); });
  document.getElementById("btn-cf-tails").addEventListener("click", function () { handleCFChoice("tails"); });

  function startCoinFlipGame() {
    document.getElementById("cf-feedback").textContent = "";
    document.getElementById("btn-cf-heads").disabled = false;
    document.getElementById("btn-cf-tails").disabled = false;
    showMgPanel("mg-coin-flip");
  }

  function handleCFChoice(choice) {
    document.getElementById("btn-cf-heads").disabled = true;
    document.getElementById("btn-cf-tails").disabled = true;

    var outcome = Math.random() < 0.5 ? "heads" : "tails";
    var won = outcome === choice;
    document.getElementById("cf-feedback").textContent = won
      ? "\u2713 It's " + outcome + "! You win!"
      : "\u2717 It's " + outcome + ". Better luck next time.";

    if (won) {
      spriteCanvas.classList.add("anim-jump");
      spriteCanvas.addEventListener("animationend", function onAnimEnd() {
        spriteCanvas.classList.remove("anim-jump");
        spriteCanvas.removeEventListener("animationend", onAnimEnd);
      });
    }

    setTimeout(function () {
      endCoinFlipGame(won ? "win" : "lose");
    }, 900);
  }

  function endCoinFlipGame(result) {
    showMgPanel("mg-result");
    document.getElementById("mg-result-text").textContent =
      result === "win"
        ? "You won Coin Flip!"
        : "You lost Coin Flip.";
    sendPlayResult("coin_flip", result);
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
      const wwm     = weightWidthMultiplier(lastState.weight || 50);
      const bWidth  = Math.round(bSize * wwm);
      const maxX    = spriteCanvas.width - bWidth - 4;
      if (petX > maxX) { petX = Math.max(4, maxX); }
    }
  }

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(spriteCanvas.parentElement);
  }
  resizeCanvas();

  // ── Movement helpers ──────────────────────────────────────────────────────

  /**
   * Return the horizontal speed in px/s for the current state.
   * Returns 0 for sleeping, egg, or when a locking reaction is active.
   * @param {object} state
   * @returns {number}
   */
  function getSpeedPPS(state) {
    if (!state)              { return 0; }
    if (state.sleeping)      { return 0; }
    if (state.stage === "egg") { return 0; }
    if (state.sick)          { return (STAGE_BASE_SPEED_PPS[state.stage] || 0) * 0.05; }
    var base = STAGE_BASE_SPEED_PPS[state.stage] || 0;
    var mult = MOOD_MULTIPLIER[state.mood] || 1.0;
    return base * mult;
  }

  /**
   * Return the Y coordinate of the floor (top of the ground line area),
   * i.e. where the bottom of the pet's legs should sit.
   * @returns {number}
   */
  function getFloorY() {
    if (!lastState) { return spriteCanvas.height - 4; }
    var scale      = STAGE_SCALES[lastState.stage] || 0.5;
    var bSize      = Math.round(24 * scale);
    var heightMult = STAGE_BODY_HEIGHT_MULTS[lastState.stage] || 1.0;
    var bHeight    = Math.round(bSize * heightMult);
    var legH       = Math.max(2, Math.round(bSize * 0.22));
    return spriteCanvas.height - bHeight - legH - 4;
  }

  /**
   * Push a reaction onto the queue.
   * @param {string} type
   * @param {number} nowMs  - performance.now() value
   */
  function pushReaction(type, nowMs) {
    var dur = REACTION_DURATIONS[type];
    if (!dur) { return; }
    reactionQueue.push({
      type:       type,
      startMs:    nowMs,
      durationMs: dur,
    });
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  function animationLoop(nowMs) {
    requestAnimationFrame(animationLoop);

    if (!lastState || !lastState.alive || currentScreen !== "game") { return; }

    var dt = lastFrameMs === 0 ? 0 : Math.min((nowMs - lastFrameMs) / 1000, 0.1);
    lastFrameMs = nowMs;

    // Dimension helpers
    var scale      = STAGE_SCALES[lastState.stage] || 0.5;
    var bSize      = Math.round(24 * scale);
    var wwm        = weightWidthMultiplier(lastState.weight || 50);
    var bWidth     = Math.round(bSize * wwm);
    var heightMult = STAGE_BODY_HEIGHT_MULTS[lastState.stage] || 1.0;
    var bHeight    = Math.round(bSize * heightMult);
    var legH       = Math.max(2, Math.round(bSize * 0.22));
    var floorY     = spriteCanvas.height - bHeight - legH - 4;
    var minX       = 4;
    var maxX       = spriteCanvas.width - bWidth - 4;

    // Init Y on first frame
    if (petY === null) { petY = floorY; }

    // ── Reaction queue processing ─────────────────────────────────────────
    // Expire finished reactions; handle fell_asleep special case.
    for (var ri = reactionQueue.length - 1; ri >= 0; ri--) {
      var rxn = reactionQueue[ri];
      var elapsed = nowMs - rxn.startMs;
      if (elapsed >= rxn.durationMs) {
        reactionQueue.splice(ri, 1);
        // On fell_asleep end, stop movement in current position
        if (rxn.type === "fell_asleep") {
          petY  = floorY;
          petVx = 0;
          petVy = 0;
        }
      }
    }

    // Active reaction (first in queue, if any)
    var activeReaction = reactionQueue.length > 0 ? reactionQueue[0] : null;

    animTick++;

    // ── Movement ──────────────────────────────────────────────────────────
    if (activeReaction && activeReaction.type === "fell_asleep") {
      // Lock to floor in current position during the fell_asleep animation
      petY  = floorY;
      petVx = 0;
      petVy = 0;

    } else if (lastState.stage === "egg") {
      // Egg: static at floor-centre (rocking handled in drawBody)
      petX  = Math.max(minX, Math.min(maxX, Math.floor(spriteCanvas.width / 2 - bWidth / 2)));
      petY  = floorY;
      petVx = 0;
      petVy = 0;

    } else if (lastState.sleeping) {
      // Sleeping: breath bob only — all movement frozen
      breathPhase += 1.8 * dt;
      petVx = 0;
      petVy = 0;
      petY  = floorY;

    } else {
      // ── Normal movement (gravity + mood + wander/snack) ──────────────────
      var speed = getSpeedPPS(lastState);
      var onFloor = (petY >= floorY - 0.5);

      // Gravity
      petVy += GRAVITY * dt;
      petY  += petVy * dt;

      // Floor collision
      if (petY >= floorY) {
        petY = floorY;
        if (petVy > BOUNCE_MIN) {
          petVy = -petVy * BOUNCE_COEFF;
        } else {
          petVy = 0;
        }
        onFloor = true;
      }

      // Occasional hop — only when pet is resting on the floor (petVy >= 0 prevents
      // firing during a bounce while onFloor is briefly true but velocity is still upward)
      if (onFloor && petVy >= 0 && speed > 0) {
        hopTimer -= dt;
        if (hopTimer <= 0) {
          petVy    = HOP_IMPULSE;
          hopTimer = HOP_INTERVAL;
          onFloor  = false;
        }
      }

      // Horizontal movement: snack targeting OR wandering
      if (snackItems.length > 0 && speed > 0) {
        // Snack targeting
        var closestSnack = snackItems[0];
        var closestDist  = Math.abs(petX - snackItems[0].x);
        for (var si = 1; si < snackItems.length; si++) {
          var sd = Math.abs(petX - snackItems[si].x);
          if (sd < closestDist) { closestDist = sd; closestSnack = snackItems[si]; }
        }
        if (closestDist < bWidth / 2 + 4) {
          // Pet reached the snack
          snackItems.splice(snackItems.indexOf(closestSnack), 1);
          idleTimer = 0.2;  // brief chomp pause
          petVx     = 0;
          vscode.postMessage({ command: "snack_consumed" });
        } else {
          petVx         = closestSnack.x > petX ? speed : -speed;
          petFacingLeft = petVx < 0;
          petX         += petVx * dt;
        }
      } else if (speed > 0 && idleTimer <= 0) {
        // Wander — pet always moves horizontally; never pauses
        if (petVx === 0) {
          petVx         = Math.random() < 0.5 ? speed : -speed;
          petFacingLeft = petVx < 0;
        }
        petX += petVx * dt;

        if (petX >= maxX) {
          petX          = maxX;
          petVx         = -speed;
          petFacingLeft = true;
        } else if (petX <= minX) {
          petX          = minX;
          petVx         = speed;
          petFacingLeft = false;
        }

        // Occasional mid-walk direction flip (no pause)
        if (Math.random() < 0.0015) {
          petVx         = -petVx;
          petFacingLeft = !petFacingLeft;
        }
      } else if (idleTimer > 0) {
        idleTimer -= dt;
        if (idleTimer < 0) {
          idleTimer = 0;
          // Pick a fresh direction after the pause
          if (petVx === 0) {
            petVx         = Math.random() < 0.5 ? speed : -speed;
            petFacingLeft = petVx < 0;
          }
        }
        petVx = 0;  // zero velocity during pause (gravity still applies)
      } else {
        // speed === 0 (sick near-zero drift already applied above via petVx)
        if (lastState.sick) {
          // Sick tremor: random tiny horizontal jitter
          petX += (Math.random() - 0.5) * 8 * dt;
          petX  = Math.max(minX, Math.min(maxX, petX));
        }
      }

      // Clamp X
      petX = Math.max(minX, Math.min(maxX, petX));
    }

    // ── Leg frame ────────────────────────────────────────────────────────
    var walking  = !lastState.sleeping && Math.abs(petVx) > 0.5 && petY >= floorY - 0.5;
    var legFrame = walking ? Math.floor(animTick / 10) % 2 : 0;
    var walkBob  = (walking && legFrame === 1) ? -1 : 0;

    // ── Draw ──────────────────────────────────────────────────────────────
    drawEnvironment(lastState);
    drawBodyWithReaction(lastState, Math.round(petX), Math.round(petY) + walkBob, petFacingLeft, legFrame, activeReaction, nowMs);
    drawStatusIndicators(lastState, Math.round(petX), Math.round(petY) + walkBob);
  }

  if (!REDUCED_MOTION) {
    requestAnimationFrame(animationLoop);
  }

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
      "Age: " + formatAge(state.ageDays) + "  |  " +
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
      var scale2   = STAGE_SCALES[state.stage] || 0.5;
      var bSize2   = Math.round(24 * scale2);
      var wwm2     = weightWidthMultiplier(state.weight || 50);
      var bWidth2  = Math.round(bSize2 * wwm2);
      var centreX  = Math.max(4, Math.floor(spriteCanvas.width / 2 - bWidth2 / 2));
      if (state.sleeping) {
        // Restore the position where the pet fell asleep (saved to localStorage).
        // Falls back to centre only if no stored value exists.
        var storedSleepX = parseFloat(localStorage.getItem("gotchi_sleepX") || "");
        petX = isNaN(storedSleepX) ? centreX : storedSleepX;
      } else {
        petX = centreX;
      }
      petY          = null;   // will be initialised to floorY on first rAF frame
      petVx         = 0;
      petVy         = 0;
      petFacingLeft = false;
      animTick      = 0;
      lastFrameMs   = 0;
      breathPhase   = 0;
      hopTimer      = HOP_INTERVAL;
      idleTimer     = 0;
      reactionQueue = [];
      giftBoxX      = null;
      snackItems    = [];
    }

    // ── Map incoming events to reactions ──────────────────────────────────
    var nowMs = performance.now();
    var events = state.events || [];

    if (events.indexOf("fed_meal")      !== -1) { pushReaction("fed_meal",      nowMs); }
    if (events.indexOf("fed_snack")     !== -1) { pushReaction("fed_snack",     nowMs); }
    if (events.indexOf("played")        !== -1) { pushReaction("played",        nowMs); }
    if (events.indexOf("fell_asleep")   !== -1) {
      pushReaction("fell_asleep",   nowMs);
      // Persist the X position so it survives a webview reload while sleeping
      try { localStorage.setItem("gotchi_sleepX", String(Math.round(petX))); } catch (e) {}
    }
    if (events.indexOf("woke_up")       !== -1 ||
        events.indexOf("auto_woke_up")  !== -1) { pushReaction("woke_up",       nowMs); }
    if (events.indexOf("scolded")       !== -1) { pushReaction("scolded",       nowMs); }
    if (events.indexOf("praised")       !== -1) { pushReaction("praised",       nowMs); }
    if (events.indexOf("became_sick")   !== -1) { pushReaction("became_sick",   nowMs); }
    if (events.indexOf("cured")         !== -1) { pushReaction("healed",        nowMs); }
    if (events.indexOf("pooped")        !== -1) { pushReaction("poop_appeared", nowMs); }
    // evolved: any evolved_to_* event
    for (var ei = 0; ei < events.length; ei++) {
      if (events[ei].indexOf("evolved_to_") === 0) { pushReaction("evolved", nowMs); break; }
    }

    // Gift box — show a box on the floor while a "gift" attention call is active
    var prevGift = lastState && lastState.activeAttentionCall === "gift";
    var currGift = state.activeAttentionCall === "gift";
    if (!prevGift && currGift) {
      var gW2 = spriteCanvas.width;
      var gx  = 4 + Math.floor(Math.random() * Math.max(1, gW2 - 28));
      if (Math.abs(gx - petX) < 24 && gW2 > 60) {
        gx = gW2 - 28 - gx;
        if (gx < 4) { gx = 4; }
      }
      giftBoxX = gx;
    } else if (prevGift && !currGift) {
      giftBoxX = null;
    }

    // Hand off to animation loop — it owns all drawing
    lastState = state;

    appendEvents(state.events || [], state.name);

    // Spawn poo overlay animation
    if ((state.events || []).indexOf("pooped") !== -1) { spawnPooAnim(); }

    // Snack items — spawn a floor item when snack_placed fires
    if ((state.events || []).indexOf("snack_placed") !== -1 && snackItems.length < 3) {
      var siW = spriteCanvas.width;
      snackItems.push({
        x:    4 + Math.floor(Math.random() * Math.max(1, siW - 20)),
        type: Math.random() < 0.5 ? "candy" : "bone",
      });
      idleTimer = 0;  // pet walks toward it immediately
    }

    // Reduced motion: draw a static frame immediately after every state update
    if (REDUCED_MOTION) { drawStaticPet(state); }
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
    if (state.sleeping && state.sick) { return "Zzz… (feeling sick)"; }
    if (state.sleeping) { return "Zzz…"; }
    if (state.sick)     { return "Feeling sick"; }
    const mood = state.mood || "neutral";
    return mood.charAt(0).toUpperCase() + mood.slice(1);
  }

  /**
   * Format an age in game-days as a human-readable string.
   * @param {number} ageDays
   * @returns {string}
   */
  function formatAge(ageDays) {
    var years = Math.floor(ageDays / GAME_DAYS_PER_YEAR);
    var days  = ageDays % GAME_DAYS_PER_YEAR;
    if (years > 0) {
      return years + "y " + days + "d";
    }
    return days + "d";
  }

  /** Append new event strings to the scrollable event log. */
  function humaniseEvent(code, name) {
    var n = name || "Gotchi";
    var labels = {
      "auto_woke_up":           n + " woke up after a full nap.",
      "pooped":                  n + " pooped!",
      "became_sick":             n + " got sick!",
      "sickness_damage":         n + " is losing health from being sick!",
      "starvation_damage":       n + " is starving and losing health!",
      "unhappiness_damage":      n + " is miserable and losing health!",
      "exhaustion_damage":       n + " is exhausted and losing health!",
      "died":                    n + " passed away...",
      "fed_snack":               n + " had a snack.",
      "snack_placed":            "",   // silent — only triggers the floor-item animation
      "cured":                   n + " recovered!",
      "meal_refused":            n + " refused the meal.",
      "fed_meal":                n + " ate a meal.",
      "snack_refused":           n + " refused the snack.",
      "play_refused_no_energy":  n + " doesn't have enough energy to play!",
      "played":                  n + " played!",
      "pat_refused_no_energy":   n + " doesn't have enough energy to be patted!",
      "patted":                  n + " was patted!",
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
      "died_of_old_age":         n + " passed away of unforeseen natural causes due to old age.",
      "became_sick_old_age":     n + " came down with an age-related illness.",
      "went_idle":               "IDE idle — decay and aging slowed.",
      "went_deep_idle":          "IDE idle 10 min — stats protected, aging stopped.",
      "weight_became_too_skinny":    n + " is getting too skinny!",
      "weight_became_slightly_fat":  n + " is looking a little chubby.",
      "weight_became_overweight":    n + " is overweight!",
      "weight_no_longer_overweight": n + " has slimmed down.",
      "weight_no_longer_too_skinny": n + " is looking healthier now.",
      // Attention calls — fired
      "attention_call_hunger":          n + " is calling for food!",
      "attention_call_unhappiness":     n + " is calling for attention!",
      "attention_call_poop":            n + " made a mess and is calling for clean-up!",
      "attention_call_sick":            n + " is calling — they feel sick!",
      "attention_call_low_energy":      n + " is calling — they're exhausted!",
      "attention_call_misbehaviour":    n + " is misbehaving and needs discipline!",
      "attention_call_gift":            n + " brought you a gift!",
      "attention_call_critical_health": n + " is calling — health is critical!",
      // Attention calls — answered
      "attention_call_answered_hunger":          "You answered " + n + "'s hunger call.",
      "attention_call_answered_unhappiness":     "You answered " + n + "'s sadness call.",
      "attention_call_answered_poop":            "You cleaned up after " + n + ".",
      "attention_call_answered_sick":            "You answered " + n + "'s sickness call.",
      "attention_call_answered_low_energy":      "You answered " + n + "'s exhaustion call.",
      "attention_call_answered_misbehaviour":    "You scolded " + n + " and answered their call.",
      "attention_call_answered_gift":            "You accepted " + n + "'s gift!",
      "attention_call_answered_critical_health": "You answered " + n + "'s critical health call.",
      // Attention calls — expired
      "attention_call_expired_hunger":          n + "'s hunger call went unanswered!",
      "attention_call_expired_unhappiness":     n + "'s sadness call went unanswered!",
      "attention_call_expired_poop":            n + "'s clean-up call went unanswered!",
      "attention_call_expired_sick":            n + "'s sickness call went unanswered!",
      "attention_call_expired_low_energy":      n + "'s exhaustion call went unanswered!",
      "attention_call_expired_misbehaviour":    n + "'s misbehaviour call went unanswered!",
      "attention_call_expired_gift":            n + "'s gift was ignored.",
      "attention_call_expired_critical_health": n + "'s critical health call went unanswered!",
      // Mini-game results
      "minigame_left_right_win":    n + " won Left / Right!",
      "minigame_left_right_lose":   n + " lost Left / Right.",
      "minigame_higher_lower_win":  n + " won Higher or Lower!",
      "minigame_higher_lower_lose": n + " lost Higher or Lower.",
      "minigame_coin_flip_win":     n + " won Coin Flip!",
      "minigame_coin_flip_lose":    n + " lost Coin Flip.",
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
      const label = humaniseEvent(text, petName);
      if (!label) { return; }
      const li = document.createElement("li");
      li.textContent = label;
      eventLog.insertBefore(li, eventLog.firstChild);
    });
    while (eventLog.children.length > 20) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }

  /**
   * Spawn a pixel-art poo sprite that floats up from near the pet and fades out.
   */
  function spawnPooAnim() {
    var container = document.getElementById("sprite-container");
    if (!container) { return; }

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
        hs.name + "  |  " + formatAge(hs.ageDays) + "  |  " + hs.stage + "\n" +
        hsParts.join(" ") + " real time";
      // Show reset button, hide confirm
      if (btnResetHs)     { btnResetHs.classList.remove("hidden"); }
      if (resetHsConfirm) { resetHsConfirm.classList.add("hidden"); }
    } else {
      setupHighScore.classList.add("hidden");
      // Hide reset controls when there is no high score
      if (btnResetHs)     { btnResetHs.classList.add("hidden"); }
      if (resetHsConfirm) { resetHsConfirm.classList.add("hidden"); }
    }
  }

  /** Show the dead screen with final stats. */
  function renderDeadScreen(state, highScore) {
    deadStats.textContent =
      state.name + " lived " + formatAge(state.ageDays) + ".\n" +
      "Stage reached: " + state.stage + ".";

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

    if (deadEventLog) {
      deadEventLog.innerHTML = "";
      var log = state.recentEventLog || [];
      var reversed = log.slice().reverse();
      reversed.forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        deadEventLog.appendChild(li);
      });
    }

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
          highScore.name + "  |  " + formatAge(highScore.ageDays) + "  |  " + highScore.stage + "\n" +
          hsParts.join(" ") + " real time";
      } else {
        highScoreSection.classList.add("hidden");
      }
    }
  }

  // ── Sprite drawing ───────────────────────────────────────────────────────

  /**
   * Draw background, ground line, poos, gift box, snack items.
   * @param {object} state
   */
  function drawEnvironment(state) {
    const palette    = getPalette(state.color);
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

    // Persistent poo sprites
    var POO_PIXELS = [
      [0,0,1,1,0,0],
      [0,1,1,1,1,0],
      [1,1,2,1,1,1],
      [1,2,1,1,1,1],
      [0,1,1,1,1,0],
      [0,1,1,1,1,0],
      [1,1,1,1,1,1],
    ];
    var PS = 2;
    var pW = POO_PIXELS[0].length * PS;
    var pH = POO_PIXELS.length    * PS;
    var pooGroundY = H - 4 - pH;
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

    // Gift box
    if (giftBoxX !== null) {
      var GIFT_PIXELS = [
        [0,0,2,0,0,2,0,0],
        [0,2,2,2,2,2,2,0],
        [2,2,2,2,2,2,2,2],
        [1,1,1,2,2,1,1,1],
        [1,1,1,2,2,1,1,1],
        [3,3,3,2,2,3,3,3],
        [3,3,3,3,3,3,3,3],
      ];
      var GS = 2;
      var gbH = GIFT_PIXELS.length * GS;
      var gbY = H - 4 - gbH;
      var gbX = Math.round(giftBoxX);
      GIFT_PIXELS.forEach(function (row, ry) {
        row.forEach(function (cell, rx) {
          if (!cell) { return; }
          spriteCtx.fillStyle = cell === 2 ? "#FFD600" : cell === 3 ? "#B71C1C" : "#E53935";
          spriteCtx.fillRect(gbX + rx * GS, gbY + ry * GS, GS, GS);
        });
      });
    }

    // Snack items
    if (snackItems.length > 0) {
      var CANDY_PIXELS = [
        [0,1,1,0],
        [1,2,1,1],
        [1,1,2,1],
        [0,1,1,0],
      ];
      var BONE_PIXELS = [
        [1,1,0,0,1,1],
        [1,2,1,1,2,1],
        [0,1,1,1,1,0],
        [1,2,1,1,2,1],
        [1,1,0,0,1,1],
      ];
      var SS = 2;
      snackItems.forEach(function (item) {
        var spx = item.type === "candy" ? CANDY_PIXELS : BONE_PIXELS;
        var spH = spx.length * SS;
        var sY  = H - 4 - spH;
        var sX  = Math.round(item.x);
        spx.forEach(function (row, ry) {
          row.forEach(function (cell, rx) {
            if (!cell) { return; }
            spriteCtx.fillStyle = item.type === "candy"
              ? (cell === 2 ? "#FFE0E0" : "#FF6B9D")
              : (cell === 2 ? "#F5DEB3" : "#DEB887");
            spriteCtx.fillRect(sX + rx * SS, sY + ry * SS, SS, SS);
          });
        });
      });
    }
  }

  /**
   * Draw the pet body at (x, bodyY).
   * bodyY is the TOP of the body (before adding bobOffset).
   * For sleeping, a vertical breath bob is applied via breathPhase.
   *
   * @param {object}  state
   * @param {number}  x          - Left edge of body in canvas pixels
   * @param {number}  bodyY      - Top of body in canvas pixels
   * @param {boolean} facingLeft
   * @param {number}  legFrame   - 0 or 1
   */
  function drawBody(state, x, bodyY, facingLeft, legFrame) {
    const palette   = getPalette(state.color);
    const primary   = palette.primary;
    const secondary = palette.secondary;

    const stageScale     = STAGE_SCALES[state.stage] || 0.5;
    const bodySize       = Math.round(24 * stageScale);
    const wt             = state.weight || 50;
    const weightWidthMult = weightWidthMultiplier(wt);
    const bodyWidth      = Math.round(bodySize * weightWidthMult);
    const heightMult     = STAGE_BODY_HEIGHT_MULTS[state.stage] || 1.0;
    const bodyHeight     = Math.round(bodySize * heightMult);
    const legH           = Math.max(2, Math.round(bodySize * 0.22));

    // Sleeping breath bob
    var bobY = bodyY;
    if (state.sleeping) {
      bobY = bodyY + Math.round(Math.sin(breathPhase) * 1);
    }

    spriteCtx.save();
    if (facingLeft) {
      spriteCtx.translate(x + bodyWidth, 0);
      spriteCtx.scale(-1, 1);
      spriteCtx.translate(-x, 0);
    }

    const stage = state.stage;

    if (stage === "egg") {
      // Egg: oval + rocking animation
      spriteCtx.save();
      var rockAngle = Math.sin(Date.now() / 600) * (5 * Math.PI / 180);
      var cx = x + bodyWidth / 2;
      var cy = bobY + bodyHeight / 2;
      spriteCtx.translate(cx, cy);
      spriteCtx.rotate(rockAngle);
      spriteCtx.translate(-cx, -cy);

      spriteCtx.fillStyle = primary;
      spriteCtx.beginPath();
      spriteCtx.ellipse(
        cx, cy,
        bodyWidth / 2,
        bodyHeight / 2,
        0, 0, Math.PI * 2
      );
      spriteCtx.fill();

      const dotSize   = Math.max(1, Math.round(bodySize * 0.10));
      const dotY      = bobY + Math.round(bodyHeight * 0.38);
      const dotLeftX  = x + Math.round(bodyWidth * 0.28);
      const dotRightX = x + Math.round(bodyWidth * 0.62);
      spriteCtx.fillStyle = secondary;
      spriteCtx.fillRect(dotLeftX,  dotY, dotSize, dotSize);
      spriteCtx.fillRect(dotRightX, dotY, dotSize, dotSize);
      spriteCtx.restore();

    } else if (stage === "baby") {
      const babyLegH = Math.max(1, Math.round(bodySize * 0.12));
      const legW  = Math.max(2, Math.round(bodyWidth * 0.15));
      const legX1 = x + Math.round(bodyWidth * 0.2);
      const legX2 = x + Math.round(bodyWidth * 0.6);
      const legY  = bobY + bodyHeight;
      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(legX1, legY, legW, legFrame === 0 ? babyLegH     : babyLegH - 1);
      spriteCtx.fillRect(legX2, legY, legW, legFrame === 0 ? babyLegH - 1 : babyLegH    );

      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(x, bobY, bodyWidth, bodyHeight);

      const eyeSize   = Math.max(2, Math.round(bodySize * 0.30));
      const eyeY      = bobY + Math.round(bodyHeight * 0.20);
      const leftEyeX  = x + Math.round(bodyWidth * 0.10);
      const rightEyeX = x + Math.round(bodyWidth * 0.55);
      spriteCtx.fillStyle = state.sick     ? "#ff0000"  :
                            state.sleeping ? "#888888"  : secondary;
      spriteCtx.fillRect(leftEyeX,  eyeY, eyeSize, eyeSize);
      spriteCtx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

      const mouthY = bobY + Math.round(bodyHeight * 0.72);
      const mouthX = x + Math.round(bodyWidth * 0.3);
      const mouthW = Math.round(bodyWidth * 0.4);
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

    } else if (stage === "child") {
      const legW  = Math.max(2, Math.round(bodyWidth * 0.15));
      const legX1 = x + Math.round(bodyWidth * 0.2);
      const legX2 = x + Math.round(bodyWidth * 0.6);
      const legY  = bobY + bodyHeight;
      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(legX1, legY, legW, legFrame === 0 ? legH     : legH - 1);
      spriteCtx.fillRect(legX2, legY, legW, legFrame === 0 ? legH - 1 : legH    );

      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(x, bobY, bodyWidth, bodyHeight);

      const eyeSize   = Math.max(2, Math.round(bodySize * 0.18));
      const eyeY      = bobY + Math.round(bodyHeight * 0.25);
      const leftEyeX  = x + Math.round(bodyWidth * 0.20);
      const rightEyeX = x + Math.round(bodyWidth * 0.62);
      spriteCtx.fillStyle = state.sick     ? "#ff0000"  :
                            state.sleeping ? "#888888"  : secondary;
      spriteCtx.fillRect(leftEyeX,  eyeY, eyeSize, eyeSize);
      spriteCtx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

      const mouthY = bobY + Math.round(bodyHeight * 0.65);
      const mouthX = x + Math.round(bodyWidth * 0.3);
      const mouthW = Math.round(bodyWidth * 0.4);
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

    } else {
      // Teen / Adult / Senior
      const bigLegH    = Math.max(2, Math.round(bodySize * 0.30));
      const seniorLegH = Math.max(2, Math.round(bodySize * 0.25));
      const actualLegH = stage === "senior" ? seniorLegH : bigLegH;

      const legW  = Math.max(2, Math.round(bodyWidth * 0.15));
      const legX1 = x + Math.round(bodyWidth * 0.2);
      const legX2 = x + Math.round(bodyWidth * 0.6);
      const legY  = bobY + bodyHeight;
      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(legX1, legY, legW, legFrame === 0 ? actualLegH     : actualLegH - 1);
      spriteCtx.fillRect(legX2, legY, legW, legFrame === 0 ? actualLegH - 1 : actualLegH    );

      const headFrac   = stage === "teen" ? 0.40 : (stage === "senior" ? 0.42 : 0.38);
      const headH      = Math.round(bodyHeight * headFrac);
      const torsoH     = bodyHeight - headH;
      const torsoYBase = bobY + headH;
      const torsoWidthFrac = stage === "teen" ? 0.82 : (stage === "senior" ? 0.90 : 1.0);
      const torsoWidth     = Math.round(bodyWidth * torsoWidthFrac);
      const torsoX         = x + Math.round((bodyWidth - torsoWidth) / 2);

      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(torsoX, torsoYBase, torsoWidth, torsoH);

      if (stage === "adult") {
        spriteCtx.fillRect(torsoX - 2, torsoYBase, 2, 4);
        spriteCtx.fillRect(torsoX + torsoWidth, torsoYBase, 2, 4);
      }

      spriteCtx.fillStyle = primary;
      spriteCtx.fillRect(x, bobY, bodyWidth, headH);

      const eyeSize   = Math.max(2, Math.round(bodySize * 0.18));
      const eyeY      = bobY + Math.round(headH * 0.35);
      const leftEyeX  = x + Math.round(bodyWidth * 0.20);
      const rightEyeX = x + Math.round(bodyWidth * 0.62);
      spriteCtx.fillStyle = state.sick     ? "#ff0000"  :
                            state.sleeping ? "#888888"  : secondary;
      spriteCtx.fillRect(leftEyeX,  eyeY, eyeSize, eyeSize);
      spriteCtx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

      const mouthY = bobY + Math.round(headH * 0.72);
      const mouthX = x + Math.round(bodyWidth * 0.3);
      const mouthW = Math.round(bodyWidth * 0.4);
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
    }

    spriteCtx.restore();
  }

  /**
   * Wrap drawBody with per-reaction transform / colour overlay.
   *
   * @param {object}      state
   * @param {number}      x          - Left edge of body (canvas px)
   * @param {number}      bodyY      - Top of body (canvas px)
   * @param {boolean}     facingLeft
   * @param {number}      legFrame
   * @param {object|null} reaction   - Active reaction object (or null)
   * @param {number}      nowMs      - performance.now()
   */
  function drawBodyWithReaction(state, x, bodyY, facingLeft, legFrame, reaction, nowMs) {
    if (!reaction) {
      drawBody(state, x, bodyY, facingLeft, legFrame);
      return;
    }

    var t = Math.min(1, (nowMs - reaction.startMs) / reaction.durationMs);
    var palette   = getPalette(state.color);
    var stageScale = STAGE_SCALES[state.stage] || 0.5;
    var bSize     = Math.round(24 * stageScale);
    var wwm       = weightWidthMultiplier(state.weight || 50);
    var bWidth    = Math.round(bSize * wwm);
    var hMult     = STAGE_BODY_HEIGHT_MULTS[state.stage] || 1.0;
    var bHeight   = Math.round(bSize * hMult);
    var legH      = Math.max(2, Math.round(bSize * 0.22));
    var feetY     = bodyY + bHeight + legH;   // canvas Y of the bottom of the feet

    switch (reaction.type) {

      case "fed_meal":
      case "fed_snack": {
        // Bob up then down: yOff = -sin(t*π)*10
        var yOff = -Math.sin(t * Math.PI) * 10;
        drawBody(state, x, bodyY + yOff, facingLeft, legFrame);
        break;
      }

      case "played": {
        // Jump + spin: yOff = -sin(t*π)*20, rotate t*2π around body centre
        var yOff2 = -Math.sin(t * Math.PI) * 20;
        var cx2   = x + bWidth / 2;
        var cy2   = bodyY + yOff2 + bHeight / 2;
        spriteCtx.save();
        spriteCtx.translate(cx2, cy2);
        spriteCtx.rotate(t * Math.PI * 2);
        spriteCtx.translate(-cx2, -cy2);
        drawBody(state, x, bodyY + yOff2, facingLeft, legFrame);
        spriteCtx.restore();
        break;
      }

      case "woke_up": {
        // Scale up from 0.8 to 1.0 (pivot: feet)
        var sc = 0.8 + t * 0.2;
        spriteCtx.save();
        spriteCtx.translate(x + bWidth / 2, feetY);
        spriteCtx.scale(sc, sc);
        spriteCtx.translate(-(x + bWidth / 2), -feetY);
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.restore();
        break;
      }

      case "scolded": {
        // Recoil away from direction of travel
        var dir  = facingLeft ? 1 : -1;
        var xOff = Math.sin(t * Math.PI) * 10 * dir;
        drawBody(state, x + xOff, bodyY, facingLeft, legFrame);
        break;
      }

      case "praised": {
        // Hop up + yellow highlight fade
        var yOff3 = -Math.sin(t * Math.PI) * 16;
        drawBody(state, x, bodyY + yOff3, facingLeft, legFrame);
        spriteCtx.save();
        spriteCtx.globalAlpha = (1 - t) * 0.35;
        spriteCtx.fillStyle = "#FFD600";
        spriteCtx.fillRect(x, bodyY + yOff3, bWidth, bHeight + legH);
        spriteCtx.restore();
        break;
      }

      case "evolved": {
        // Scale pulse + gold flash (pivot: feet)
        var sc2 = 1 + Math.sin(t * Math.PI) * 0.3;
        spriteCtx.save();
        spriteCtx.translate(x + bWidth / 2, feetY);
        spriteCtx.scale(sc2, sc2);
        spriteCtx.translate(-(x + bWidth / 2), -feetY);
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.globalAlpha = Math.sin(t * Math.PI) * 0.4;
        spriteCtx.fillStyle = "#FFD600";
        spriteCtx.fillRect(x, bodyY, bWidth, bHeight + legH);
        spriteCtx.restore();
        break;
      }

      case "poop_appeared": {
        // Force facing toward nearest poo for first half
        var fl2 = facingLeft;
        if (t < 0.5 && state.poops > 0) {
          var W2 = spriteCanvas.width;
          var pooXPositions2 = [
            Math.round(W2 * 0.12),
            Math.round(W2 * 0.52),
            Math.round(W2 * 0.78),
          ];
          var nearestPooX = pooXPositions2[0];
          var nearestDist = Math.abs(x - pooXPositions2[0]);
          for (var pi2 = 1; pi2 < Math.min(state.poops, 3); pi2++) {
            var d2 = Math.abs(x - pooXPositions2[pi2]);
            if (d2 < nearestDist) { nearestDist = d2; nearestPooX = pooXPositions2[pi2]; }
          }
          fl2 = nearestPooX < x;
        }
        drawBody(state, x, bodyY, fl2, legFrame);
        break;
      }

      case "became_sick": {
        // Random jitter per frame — handled in movement; just draw normally here
        drawBody(state, x, bodyY, facingLeft, legFrame);
        break;
      }

      case "healed": {
        // Green overlay fading out
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.save();
        spriteCtx.globalAlpha = (1 - t) * 0.5;
        spriteCtx.fillStyle = "#00c853";
        spriteCtx.fillRect(x, bodyY, bWidth, bHeight + legH);
        spriteCtx.restore();
        break;
      }

      case "fell_asleep": {
        // Position handled by movement; just draw the body normally
        drawBody(state, x, bodyY, facingLeft, legFrame);
        break;
      }

      default:
        drawBody(state, x, bodyY, facingLeft, legFrame);
    }
  }

  /**
   * Draw status indicators (z / +) above the pet — outside any flip transform.
   * @param {object} state
   * @param {number} x      - Left edge of body
   * @param {number} bodyY  - Top of body
   */
  function drawStatusIndicators(state, x, bodyY) {
    var scale    = STAGE_SCALES[state.stage] || 0.5;
    var bSize    = Math.round(24 * scale);
    var wwm      = weightWidthMultiplier(state.weight || 50);
    var bWidth   = Math.round(bSize * wwm);
    var palette  = getPalette(state.color);
    var secondary = palette.secondary;

    var indicatorX = x + Math.round(bWidth / 2) - 4;
    var indicatorY = bodyY - 3;
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

  /**
   * Draw a static (non-animated) frame of the pet at the centre of the stage.
   * Used when REDUCED_MOTION is true.
   * @param {object} state
   */
  function drawStaticPet(state) {
    drawEnvironment(state);

    var scale    = STAGE_SCALES[state.stage] || 0.5;
    var bSize    = Math.round(24 * scale);
    var wwm      = weightWidthMultiplier(state.weight || 50);
    var bWidth   = Math.round(bSize * wwm);
    var hMult    = STAGE_BODY_HEIGHT_MULTS[state.stage] || 1.0;
    var bHeight  = Math.round(bSize * hMult);
    var legH     = Math.max(2, Math.round(bSize * 0.22));
    var H        = spriteCanvas.height;
    var staticX  = Math.max(4, Math.floor(spriteCanvas.width / 2 - bWidth / 2));
    var staticY  = H - bHeight - legH - 4;

    drawBody(state, staticX, staticY, false, 0);
    drawStatusIndicators(state, staticX, staticY);
  }

  // ── Static look-up tables ────────────────────────────────────────────────

  const COLOR_PALETTES = {
    neon:   { primary: "#39ff14", secondary: "#ff00ff", background: "#0d0d0d" },
    pastel: { primary: "#ffb3c1", secondary: "#b5ead7", background: "#57070c" },
    mono:   { primary: "#e0e0e0", secondary: "#888888", background: "#1a1a1a" },
    ocean:  { primary: "#00cfff", secondary: "#004e7c", background: "#001f3f" },
  };

  /**
   * Return the colour palette for a given key.
   * The "custom" key reads colours from CSS custom properties injected by the
   * host (sidebarProvider.ts) at HTML-build time via the
   * --gotchi-custom-* variables, falling back to safe defaults if not set.
   */
  function getPalette(colorKey) {
    if (colorKey === "custom") {
      var s = getComputedStyle(document.documentElement);
      return {
        primary:    s.getPropertyValue("--gotchi-custom-primary").trim()    || "#ff8c00",
        secondary:  s.getPropertyValue("--gotchi-custom-secondary").trim()  || "#ffffff",
        background: s.getPropertyValue("--gotchi-custom-background").trim() || "#1a1a2e",
      };
    }
    return COLOR_PALETTES[colorKey] || COLOR_PALETTES["neon"];
  }

  const STAGE_SCALES = {
    egg:    0.35,
    baby:   0.45,
    child:  0.55,
    teen:   0.70,
    adult:  0.85,
    senior: 0.90,
  };

  /** Height multipliers per stage (relative to bodySize). */
  const STAGE_BODY_HEIGHT_MULTS = {
    egg:    1.3,
    baby:   1.0,
    child:  1.0,
    teen:   1.35,
    adult:  1.5,
    senior: 1.4,
  };

  /**
   * Return the width multiplier for the sprite based on weight.
   * @param {number} weight
   * @returns {number}
   */
  function weightWidthMultiplier(weight) {
    if (weight > 80)  { return 1.5; }
    if (weight > 50)  { return 1.25; }
    if (weight < 17)  { return 0.75; }
    return 1.0;
  }

  // ── Message handler ──────────────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    const message = event.data;
    if (!message || message.type !== "stateUpdate") { return; }

    const state = message.state;

    if (message.highScore) { latestHighScore = message.highScore; }
    if (message.highScore === null) { latestHighScore = null; }

    // Show/hide dev mode banner
    if (devModeBanner) {
      devModeBanner.classList.toggle("hidden", !message.devMode);
    }

    if (state && state.needs_new_game) {
      hasActiveGame = false;
      showScreen("setup");
      return;
    }

    if (state) {
      hasActiveGame = true;

      if (currentScreen === "setup" && !pendingNewGame) {
        if (btnContinue) { btnContinue.classList.toggle("hidden", !hasActiveGame); }
        return;
      }

      if (currentScreen === "dead" && !state.alive) {
        lastState = state;
        return;
      }

      pendingNewGame = false;
      renderState(state, message.mealsGivenThisCycle || 0, latestHighScore);
    }
  });

  // ── Idle-activity detection ───────────────────────────────────────────────
  // Mouse movement inside the sidebar resets the host idle timer (BUGFIX-015).
  // Throttled to at most once per 30 s to avoid flooding the extension host.
  // Skipped entirely when gotchi.idleResetOnMouseMovement is disabled.
  var idleResetMouseEnabled = document.body.dataset.idleResetMouse !== "false";
  if (idleResetMouseEnabled) {
    var lastActivityPost = 0;
    document.addEventListener("mousemove", function () {
      var now = Date.now();
      if (now - lastActivityPost < 30000) { return; }
      lastActivityPost = now;
      vscode.postMessage({ command: "user_activity" });
    });
  }

  // ── Initial view ─────────────────────────────────────────────────────────
  showScreen("game");

}());
