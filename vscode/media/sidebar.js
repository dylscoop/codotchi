/**
 * sidebar.js — codotchi webview client
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

  /** Public leaderboard URL (GitHub Pages). */
  const LEADERBOARD_PAGES_URL = "https://dylscoop.github.io/codotchi/leaderboard/";

  /** Energy cost of the play action — must match PLAY_ENERGY_COST in gameEngine.ts. */
  var PLAY_ENERGY_COST = 25;

  /** Energy cost of the pat action — must match PAT_ENERGY_COST in gameEngine.ts. */
  var PAT_ENERGY_COST = 20;
  /** Pixel size of floor snacks (each grid cell is SNACK_SCALE × SNACK_SCALE px). */
  var SNACK_SCALE = 3;
  /** Half the width of a typical 5–6-column snack at SNACK_SCALE — the pet aims at item.x + this. */
  var SNACK_HALF_W = 8;
  /** Pixel size of poos on the floor. */
  var POO_SCALE = 3;

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
    fed_meal:      1000,   // twice the snack — the pet lingers at its bowl
    fed_snack:     500,
    played:        700,
    fell_asleep:   600,
    woke_up:       400,
    scolded:       500,
    praised:       600,
    evolved:       900,
    hatched:       900,
    poop_appeared: 700,
    became_sick:   600,
    healed:        500,
    died:          1200,
    patted:        1400,
  };

  /** Speech bubbles stay up for BUBBLE_HOLD_MS, then fade over BUBBLE_FADE_MS. */
  const BUBBLE_HOLD_MS = 6000;
  const BUBBLE_FADE_MS = 500;
  /** How long the AI-usage device takes to come out. */
  const DEVICE_SLIDE_MS = 300;

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
  const highScoreSection   = document.getElementById("high-score-section");
  const highScoreStats     = document.getElementById("high-score-stats");
  const leaderboardSection = document.getElementById("leaderboard-section");
  const btnSubmitLB        = document.getElementById("btn-submit-leaderboard");
  const leaderboardStatus  = document.getElementById("leaderboard-status");
  const lbDeleteSection    = document.getElementById("leaderboard-delete-section");
  const btnDeleteLB        = document.getElementById("btn-delete-leaderboard");
  const lbDeleteStatus     = document.getElementById("leaderboard-delete-status");
  const btnViewLB          = document.getElementById("btn-view-leaderboard");
  const rankDisplay        = document.getElementById("rank-display");
  const btnViewLBLive      = document.getElementById("btn-view-leaderboard-live");
  const btnLiveSubscribe      = document.getElementById("btn-live-subscribe");
  const livePushStatus        = document.getElementById("live-push-status");
  const btnSignInLeaderboard  = document.getElementById("btn-sign-in-leaderboard");
  const lbSignInStatus        = document.getElementById("lb-sign-in-status");
  const setupHighScore   = document.getElementById("setup-high-score");
  const setupHsStats     = document.getElementById("setup-hs-stats");
  const mealsLeftEl    = document.getElementById("meals-left");

  const devModeBanner    = document.getElementById("dev-mode-banner");
  const btnResetHs       = document.getElementById("btn-reset-hs");
  const resetHsConfirm   = document.getElementById("reset-hs-confirm");
  const btnResetHsYes    = document.getElementById("btn-reset-hs-yes");
  const btnResetHsCancel = document.getElementById("btn-reset-hs-cancel");
  const snacksLeftEl   = document.getElementById("snacks-left");
  const medicineLeftEl = document.getElementById("medicine-left");

  const barHunger    = document.getElementById("bar-hunger");
  const barHappiness = document.getElementById("bar-happiness");
  const barEnergy    = document.getElementById("bar-energy");
  const barHealth    = document.getElementById("bar-health");

  const spriteCanvas = document.getElementById("sprite-canvas");
  const spriteCtx    = spriteCanvas.getContext("2d");

  // ── Reduced-motion detection ─────────────────────────────────────────────
  // Reads the data attribute injected by the host (from codotchi.reducedMotion
  // setting) OR the OS-level prefers-reduced-motion media query.

  const REDUCED_MOTION = document.body.dataset.reducedMotion === "true" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Background mode — injected by sidebarProvider.ts via data-background attribute.
  // Values: "plain" | "ordered" | "spring" | "summer" | "autumn" | "winter"
  const BG_MODE = (document.body && document.body.dataset && document.body.dataset.background) || "ordered";
  // codotchi.backgroundOpacity — how strongly the scene shows behind the pet (subtle / medium / vivid)
  const BG_OPACITY = (document.body && document.body.dataset && document.body.dataset.backgroundOpacity) || "medium";
  // codotchi.backgroundStyle — "scenic" (pixel-art scenery) or "legacy" (the pre-2.25 tint and props)
  const BG_STYLE = (document.body && document.body.dataset && document.body.dataset.backgroundStyle) || "scenic";
  // codotchi.backgroundAnimations — false (or reduced motion) draws a still background
  const BG_ANIMATE = !REDUCED_MOTION &&
    !(document.body && document.body.dataset && document.body.dataset.backgroundAnimations === "false");

  // ── Animation state ──────────────────────────────────────────────────────

  let lastState     = null;   // most recent PetState snapshot
  let petX          = null;   // horizontal position (canvas pixels, left edge of body) — null = init on first frame
  let petY          = null;   // vertical position (null = init on first frame)
  let petVx         = 0;      // horizontal velocity px/s
  let petVy         = 0;      // vertical velocity px/s
  let petFacingLeft = false;
  let animTick      = 0;      // raw frame counter (drives leg animation period)
  let lastFrameMs   = 0;      // performance.now() of previous rAF frame
  let breathPhase   = 0;      // sleeping breath bob phase in radians
  let floatPhase    = 0;      // floating bob phase in radians (dragon only)
  let hopTimer      = HOP_INTERVAL; // seconds until next happy hop
  let idleTimer     = 0;      // seconds until next wander direction/pause change
  let reactionQueue = [];     // [{ type, startMs, durationMs, startX, startY }]
  let moodParticles = [];     // sparkles / tears / crumbs / z's (window.spriteMood)
  let patParticles  = [];     // hearts / prr / smoke during a pat (window.spritePat)
  let lastMood      = null;   // mood drawn last frame — particles reset when it changes
  let lastMoodFrame = -1;     // flip-book frame drawn last frame
  let chompUntilMs  = 0;      // performance.now() until which a floor-snack chomp plays
  let snackChomp    = false;  // the current "eating" is a snack (plate) rather than a meal (bowl)
  let latestHighScore = null; // cached high score from last stateUpdate
  let leaderboardAvailable = false; // true when host supports leaderboard submission
  let leaderboardSubmitted = false; // true once user successfully submitted this death
  let leaderboardBlocked = null;    // why this pet can't go on the leaderboard (dev mode, edited save…), or null
  let currentScreen = "game"; // tracks which screen is visible
  let hasActiveGame = false;  // true once a real (non-needs_new_game) state is received
  let pendingNewGame = false; // set when Hatch! is clicked; bypasses setup-screen suppression
  let setupDefaultName = "Codotchi"; // default name for the setup screen name input; updated from stateUpdate
  let giftBoxX   = null;     // floor X of gift box while a "gift" attention call is active
  let snackItems = [];       // floor items: [{ x, type: "candy"|"bone" }]
  let currentCravingItem = null; // custom character's craved snack label ("a pint"), from the host
  let heldSnackAnswers     = []; // answered-call events waiting for the pet to eat a floor snack
  let releasedSnackAnswers = []; // ...and once eaten, shown with the next state update
  let activeBubble = null;   // speech bubble: { text, kind, startMs, fadeOutMs, fadeDurMs } or null
  let bubbleQueue  = [];     // pending attention-call text; at most 1 entry
  let pendingDeathTimer = null; // setTimeout id while the "died" reaction plays before the dead screen
  let petIsSleeping = false; // true while fell_asleep is active; suppresses all other bubbles

  // Speech when a whim attention call is answered — one line picked at random.
  // Mirrored in opencode-codotchi/src/index.ts and claude-codotchi/scripts/action.mjs.
  const WHIM_ANSWER_SPEECH = {
    play:    ["Yay, you played with me!", "That's just what I wanted!", "Again! Again!", "Best game ever!"],
    pat:     ["Ahh, that's the spot.", "I needed that, thank you!", "More pats, please!", "You always know what I need."],
    craving: ["Mmm, just what I was craving!", "You read my mind!", "That hit the spot!", "Exactly what I wanted, yum!"],
  };

  // ── Setup form state ────────────────────────────────────────────────────

  let selectedPetType = "codeling";

  // Wire up option-button groups
  document.querySelectorAll(".option-row").forEach(function (row) {
    row.querySelectorAll(".opt-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        row.querySelectorAll(".opt-btn").forEach(function (b) {
          b.classList.remove("selected");
        });
        btn.classList.add("selected");
        const value = btn.dataset["value"];
        selectedPetType = value;
      });
    });
  });

  startBtn.addEventListener("click", function () {
    const name = petNameInput.value.trim() || setupDefaultName;
    pendingNewGame = true;
    vscode.postMessage({
      command: "new_game",
      name: name,
      petType: selectedPetType,
    });
  });

  // ── Action buttons ───────────────────────────────────────────────────────

  document.getElementById("btn-feed-meal").addEventListener("click", function () {
    vscode.postMessage({ command: "feed", feedType: "meal" });
  });

  document.getElementById("btn-feed-snack").addEventListener("click", function () {
    // Report the snacks really on the floor so the host refuses a 4th ("threw the snack away")
    vscode.postMessage({ command: "feed", feedType: "snack", floorSnacks: snackItems.length });
  });

  document.getElementById("btn-play").addEventListener("click", function () {
    if (lastState && lastState.sick) { return; }   // BUG-S04: no games while sick
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

  if (btnSubmitLB) {
    btnSubmitLB.addEventListener("click", function () {
      btnSubmitLB.disabled = true;
      btnSubmitLB.textContent = "Submitting…";
      if (leaderboardStatus) { leaderboardStatus.classList.add("hidden"); }
      vscode.postMessage({ command: "submit_leaderboard" });
    });
  }

  if (btnDeleteLB) {
    btnDeleteLB.addEventListener("click", function () {
      btnDeleteLB.disabled = true;
      btnDeleteLB.textContent = "Requesting deletion…";
      if (lbDeleteStatus) { lbDeleteStatus.classList.add("hidden"); }
      vscode.postMessage({ command: "delete_leaderboard_entry" });
    });
  }

  if (btnViewLB) {
    btnViewLB.addEventListener("click", function (e) {
      e.preventDefault();
      vscode.postMessage({ command: "open_leaderboard_url" });
    });
  }

  if (btnViewLBLive) {
    btnViewLBLive.addEventListener("click", function (e) {
      e.preventDefault();
      vscode.postMessage({ command: "open_leaderboard_url" });
    });
  }

  // Sign-in in flight (stateUpdates must not reset the button mid-flow) and the
  // last sign-in error, kept visible until the next successful sign-in (BUG-S08).
  let lbSignInPending = false;
  let lbSignInError = null;

  if (btnSignInLeaderboard) {
    btnSignInLeaderboard.addEventListener("click", function () {
      lbSignInPending = true;
      vscode.postMessage({ command: "sign_in_leaderboard" });
      btnSignInLeaderboard.textContent = "Opening sign-in…";
      btnSignInLeaderboard.disabled = true;
    });
  }

  if (btnLiveSubscribe) {
    btnLiveSubscribe.addEventListener("click", function () {
      vscode.postMessage({ command: "toggle_live_subscribe" });
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

  // Pixel-art overlay for the games (doors, number card, coin), drawn by
  // minigameArt.js on #mg-canvas above the pet. Without it the games still
  // work from the panel text alone.
  var mgCanvas = document.getElementById("mg-canvas");
  var mgCtx    = mgCanvas ? mgCanvas.getContext("2d") : null;
  var mgArt    = window.minigameArt;
  var cfAnimId = null;   // requestAnimationFrame id while the coin spins
  var bjTimer  = null;   // setTimeout id while the blackjack dealer plays

  /**
   * Show and clear the overlay, sized to the sprite canvas so the art keeps
   * square pixels. Returns false if the canvas or art module is missing.
   */
  function mgBegin() {
    if (!mgCtx || !mgArt) { return false; }
    if (mgCanvas.width  !== spriteCanvas.width)  { mgCanvas.width  = spriteCanvas.width; }
    if (mgCanvas.height !== spriteCanvas.height) { mgCanvas.height = spriteCanvas.height; }
    mgCtx.imageSmoothingEnabled = false;
    mgCtx.clearRect(0, 0, mgCanvas.width, mgCanvas.height);
    mgCanvas.classList.remove("hidden");
    return true;
  }

  function mgClear() {
    if (cfAnimId !== null) { cancelAnimationFrame(cfAnimId); cfAnimId = null; }
    if (bjTimer !== null) { clearTimeout(bjTimer); bjTimer = null; }
    lrReveal = null;
    if (mgCtx) { mgCtx.clearRect(0, 0, mgCanvas.width, mgCanvas.height); }
    if (mgCanvas) { mgCanvas.classList.add("hidden"); }
  }

  function showMgOverlay() {
    btnGrid.classList.add("hidden");
    mgPanels.classList.remove("hidden");
  }
  function hideMgOverlay() {
    mgPanels.classList.add("hidden");
    btnGrid.classList.remove("hidden");
    mgClear();
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
    // Stu plays one round of Blackjack instead of Coin Flip
    if (playsBlackjack(lastState)) { startBlackjackGame(); } else { startCoinFlipGame(); }
  });
  document.getElementById("btn-mg-pat").addEventListener("click", function () {
    hideMgOverlay();
    vscode.postMessage({ command: "pat" });
  });
  document.getElementById("btn-mg-cost").addEventListener("click", function () {
    hideMgOverlay();
    vscode.postMessage({ command: "token_cost" });
  });
  document.getElementById("btn-mg-cancel").addEventListener("click", function () {
    hideMgOverlay();
  });
  document.getElementById("btn-mg-ok").addEventListener("click", function () {
    hideMgOverlay();
  });

  // ── Left / Right game ─────────────────────────────────────────────────────

  var lrRound, lrScore, lrPetSide, lrAnswered, lrTimerId, lrCountdown;
  var lrReveal = null;   // null while guessing, else { petSide, choice, won, open: "ajar"|"open" }
  var LR_AJAR_MS = 150;  // the pet's door shows ajar this long before swinging fully open

  document.getElementById("btn-lr-left").addEventListener("click",  function () { handleLRChoice("left"); });
  document.getElementById("btn-lr-right").addEventListener("click", function () { handleLRChoice("right"); });

  function startLeftRightGame() {
    lrRound    = 0;
    lrScore    = 0;
    lrAnswered = false;
    showMgPanel("mg-left-right");
    startLRRound();
  }

  function startLRRound() {
    lrAnswered  = false;
    lrReveal    = null;
    lrPetSide   = Math.random() < 0.5 ? "left" : "right";
    lrCountdown = 3;
    drawLRDoors();
    updateLRScore();
    document.getElementById("lr-countdown").textContent = lrCountdown;
    if (lrTimerId) { clearInterval(lrTimerId); }
    lrTimerId = setInterval(function () {
      lrCountdown -= 1;
      document.getElementById("lr-countdown").textContent = lrCountdown;
      if (lrCountdown > 0) { drawLRDoors(); }
      if (lrCountdown <= 0) {
        clearInterval(lrTimerId);
        resolveLRRound(null); // timeout — treat as wrong
      }
    }, 1000);
  }

  /**
   * Draw the doors and the countdown (or ✓ / ✗ once the round is decided).
   * While lrReveal is set the pet's door is open and the other is faded.
   */
  function drawLRDoors() {
    if (!mgBegin()) { return; }
    var W = mgCanvas.width;
    var H = mgCanvas.height;
    var palette = lastState ? window.spriteGetPalette(lastState.spriteType) : null;
    mgArt.drawDoors(mgCtx, W, H, lrReveal, palette);
    mgArt.drawCountdown(mgCtx, W, H,
      lrReveal ? (lrReveal.won ? "✓" : "✗") : lrCountdown);
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
    var reveal = { petSide: lrPetSide, choice: side, won: won, open: REDUCED_MOTION ? "open" : "ajar" };
    lrReveal = reveal;
    drawLRDoors();
    if (!REDUCED_MOTION) {
      setTimeout(function () {
        if (lrReveal !== reveal) { return; }   // next round started or game closed
        reveal.open = "open";
        drawLRDoors();
      }, LR_AJAR_MS);
    }
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
    mgClear();   // the result panel shows no doors
    showMgPanel("mg-result");
    document.getElementById("mg-result-text").textContent =
      result === "win"
        ? "You won Left / Right! (" + lrScore + "/3 correct)"
        : "You lost Left / Right. (" + lrScore + "/3 correct)";
    sendPlayResult("left_right", result);
  }

  // ── Higher or Lower game ──────────────────────────────────────────────────

  var hlRound, hlCorrect, hlCurrentNum;

  /** Number card on the overlay; flash = null or { correct, dir: "up"|"down" }. */
  function drawHLCard(n, flash) {
    if (!mgBegin()) { return; }
    mgArt.drawNumberCard(mgCtx, mgCanvas.width, mgCanvas.height, n, flash);
  }

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
    drawHLCard(hlCurrentNum, null);
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
    drawHLCard(nextNum, { correct: correct, dir: nextNum > hlCurrentNum ? "up" : "down" });

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
    mgClear();
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
    drawCoinAt(0, "heads", 0);
  }

  var CF_SPIN_MS = 800;

  /**
   * Coin on the overlay. lift 0..1 raises it along the toss arc; face is
   * "heads", "tails" or null (only drawn on face-on frames anyway).
   */
  function drawCoinAt(frame, face, lift) {
    if (!mgBegin()) { return; }
    var H  = mgCanvas.height;
    var px = mgArt.coinPx(H);
    var half = mgArt.COIN_SIZE * px / 2;
    var cy = Math.round(half + H * 0.22 - lift * H * 0.18);
    mgArt.drawCoin(mgCtx, Math.round(mgCanvas.width / 2), cy, px, frame, face);
  }

  /** Toss and spin the coin, landing on outcome, then call done(). */
  function playCoinSpin(outcome, done) {
    if (REDUCED_MOTION || !mgCtx || !mgArt) {
      drawCoinAt(0, outcome, 0);
      done();
      return;
    }
    var frames = mgArt.coinFrames(CF_SPIN_MS);
    var cycle  = mgArt.COIN_WIDTHS.length;
    var total  = frames.length * mgArt.COIN_FRAME_MS;
    var start  = null;
    function step(now) {
      if (start === null) { start = now; }
      var t = Math.min(1, (now - start) / total);
      var i = Math.min(frames.length - 1, Math.floor(t * frames.length));
      // Faces alternate each turn while spinning; the last frame shows the outcome
      var face = t >= 1 ? outcome : (Math.floor(i / cycle) % 2 === 0 ? "heads" : "tails");
      drawCoinAt(t >= 1 ? 0 : frames[i], face, Math.sin(Math.PI * t));
      if (t < 1) {
        cfAnimId = requestAnimationFrame(step);
      } else {
        cfAnimId = null;
        done();
      }
    }
    cfAnimId = requestAnimationFrame(step);
  }

  function handleCFChoice(choice) {
    document.getElementById("btn-cf-heads").disabled = true;
    document.getElementById("btn-cf-tails").disabled = true;

    var outcome = Math.random() < 0.5 ? "heads" : "tails";
    var won = outcome === choice;
    playCoinSpin(outcome, function () { showCFResult(outcome, won); });
  }

  function showCFResult(outcome, won) {
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
    mgClear();
    showMgPanel("mg-result");
    document.getElementById("mg-result-text").textContent =
      result === "win"
        ? "You won Coin Flip!"
        : "You lost Coin Flip.";
    sendPlayResult("coin_flip", result);
  }

  // ── Blackjack (replaces Coin Flip for Stu) ────────────────────────────────

  var BJ_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  var BJ_SUITS = ["♠", "♥", "♦", "♣"];
  var BJ_DEALER_STEP_MS = 600;
  var bjDeck = [], bjPlayer = [], bjDealer = [], bjHideHole = true;

  /** Whether this pet's Coin Flip button plays Blackjack instead. */
  function playsBlackjack(state) {
    return !!(state && state.spriteType === "stu" && customCharBySpriteType && customCharBySpriteType("stu"));
  }

  document.getElementById("btn-bj-hit").addEventListener("click", function () { handleBJHit(); });
  document.getElementById("btn-bj-stand").addEventListener("click", function () { handleBJStand(); });

  function bjButtons(enabled) {
    document.getElementById("btn-bj-hit").disabled = !enabled;
    document.getElementById("btn-bj-stand").disabled = !enabled;
  }

  /** Redraw the table and the screen-reader / text summary of both hands. */
  function drawBJ() {
    var you = mgArt ? mgArt.blackjackTotal(bjPlayer) : 0;
    var dealer = bjHideHole ? "?" : (mgArt ? mgArt.blackjackTotal(bjDealer) : 0);
    document.getElementById("bj-hands").textContent = "You " + you + " · Dealer " + dealer;
    if (!mgBegin()) { return; }
    mgArt.drawBlackjackTable(mgCtx, mgCanvas.width, mgCanvas.height, bjDealer, bjPlayer, bjHideHole);
  }

  function startBlackjackGame() {
    if (!mgArt) { startCoinFlipGame(); return; }
    bjDeck = [];
    for (var s = 0; s < BJ_SUITS.length; s++) {
      for (var r = 0; r < BJ_RANKS.length; r++) { bjDeck.push({ rank: BJ_RANKS[r], suit: BJ_SUITS[s] }); }
    }
    for (var i = bjDeck.length - 1; i > 0; i--) {             // Fisher–Yates shuffle
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = bjDeck[i]; bjDeck[i] = bjDeck[j]; bjDeck[j] = tmp;
    }
    bjPlayer = [bjDeck.pop(), bjDeck.pop()];
    bjDealer = [bjDeck.pop(), bjDeck.pop()];
    bjHideHole = true;
    document.getElementById("bj-feedback").textContent = "";
    showMgPanel("mg-blackjack");
    drawBJ();
    // A natural on either side ends the round straight away
    if (mgArt.blackjackTotal(bjPlayer) === 21 || mgArt.blackjackTotal(bjDealer) === 21) {
      bjButtons(false);
      bjHideHole = false;
      bjTimer = setTimeout(function () { bjTimer = null; drawBJ(); finishBlackjack(); }, BJ_DEALER_STEP_MS);
      return;
    }
    bjButtons(true);
  }

  function handleBJHit() {
    bjPlayer.push(bjDeck.pop());
    drawBJ();
    var total = mgArt.blackjackTotal(bjPlayer);
    if (total > 21) {
      bjButtons(false);
      bjHideHole = false;
      drawBJ();
      finishBlackjack();
    } else if (total === 21) {
      handleBJStand();
    }
  }

  /** Dealer reveals the hole card and draws to 17, one card per step. */
  function handleBJStand() {
    bjButtons(false);
    bjHideHole = false;
    drawBJ();
    function dealerStep() {
      bjTimer = null;
      if (mgArt.blackjackTotal(bjDealer) < 17) {
        bjDealer.push(bjDeck.pop());
        drawBJ();
        if (REDUCED_MOTION) { dealerStep(); } else { bjTimer = setTimeout(dealerStep, BJ_DEALER_STEP_MS); }
        return;
      }
      finishBlackjack();
    }
    if (REDUCED_MOTION) { dealerStep(); } else { bjTimer = setTimeout(dealerStep, BJ_DEALER_STEP_MS); }
  }

  function finishBlackjack() {
    var result = mgArt.blackjackOutcome(bjPlayer, bjDealer);
    var you = mgArt.blackjackTotal(bjPlayer), dealer = mgArt.blackjackTotal(bjDealer);
    document.getElementById("bj-feedback").textContent =
        result === "win"  ? "✓ " + (dealer > 21 ? "Dealer busts!" : you + " beats " + dealer + "!") + " You win!"
      : result === "push" ? "Push — " + you + " each."
      : "✗ " + (you > 21 ? "Bust!" : dealer + " beats " + you + ".") + " Dealer wins.";
    if (result === "win") {
      spriteCanvas.classList.add("anim-jump");
      spriteCanvas.addEventListener("animationend", function onAnimEnd() {
        spriteCanvas.classList.remove("anim-jump");
        spriteCanvas.removeEventListener("animationend", onAnimEnd);
      });
    }
    bjTimer = setTimeout(function () {
      bjTimer = null;
      endBlackjackGame(result);
    }, 1400);
  }

  function endBlackjackGame(result) {
    mgClear();
    showMgPanel("mg-result");
    document.getElementById("mg-result-text").textContent =
        result === "win"  ? "You won at Blackjack!"
      : result === "push" ? "Blackjack was a push."
      : "You lost at Blackjack.";
    sendPlayResult("blackjack", result);
  }

  // ── Canvas sizing ─────────────────────────────────────────────────────────

  // BASE_SIZE must match the value used in sprites.js renderSpriteGrid (96).
  // Using the same constant here ensures floorY, maxX, bWidth and all other
  // layout calculations agree with the actual pixel dimensions drawn on-canvas.
  var BASE_SIZE = 96;

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
    // Do NOT reset petX here — the per-frame clamp (petX vs minX/maxX) already
    // keeps the pet in-bounds after a resize. Resetting to null recentres the
    // pet, which fired on every play/pat click because toggling the mini-game
    // overlay nudges the container width (e.g. scrollbar show/hide).
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
    if (!lastState) { return spriteCanvas.height - 12; }
    var scale      = STAGE_SCALES[lastState.stage] || 0.5;
    var bSize      = Math.round(BASE_SIZE * petSizeMultiplier(lastState.spriteType) * scale);
    var bWidth     = effectiveBWidth(lastState, bSize);
    var bHeight    = petBoxHeight(lastState, bWidth);
    // For overweight quadrupeds (not upright, not snake), belly-sag rows add to the effective height.
    var _gsType = lastState.spriteType || "classic";
    // Use SPRITE_GRID_META to detect non-quadruped types (v2 variable-grid aware).
    // Fall back to the hardcoded string check if SPRITE_GRID_META is unavailable.
    var _gsMeta = window.SPRITE_GRID_META && window.SPRITE_GRID_META[_gsType];
    var _gsRows = _gsMeta ? _gsMeta.rows : 32;
    var _gsIsQuad = _gsMeta
      ? (_gsMeta.rows <= _gsMeta.cols)   // quadrupeds are wider-than-tall grids
      : !(_gsType === "snake" || _gsType === "classic" || _gsType === "dragon" || _gsType === "tim" || _gsType === "stu");
    if (_gsIsQuad && _gsType !== "snake" && !window.spriteDrawsAsClassic(_gsType, lastState.stage)) {
      var sagCellH = Math.max(1, Math.round(bHeight / _gsRows));
      bHeight += quadrupedBellySagRows(lastState.weight || 50) * sagCellH;
    }
    return spriteCanvas.height - bHeight - 12;
  }

  /**
   * Push a reaction onto the queue.
   * @param {string} type
   * @param {number} nowMs  - performance.now() value
   * @param {number} [durationMs] - overrides REACTION_DURATIONS[type]
   */
  function pushReaction(type, nowMs, durationMs) {
    var dur = durationMs || REACTION_DURATIONS[type];
    if (!dur) { return; }
    reactionQueue.push({
      type:       type,
      startMs:    nowMs,
      durationMs: dur,
    });
  }

  // ── Speech bubble ─────────────────────────────────────────────────────────

  /**
   * Queue a speech bubble above the pet.
   * Calling this while a bubble is already showing replaces it immediately.
   * The bubble stays visible for 6 s then fades out over 0.5 s.
   * @param {string} text
   * @param {string} [kind] - "usage" for the AI-usage report (the pet holds a device)
   */
  function showBubble(text, kind) {
    var now = performance.now();
    activeBubble = {
      text:       text,
      kind:       kind || null,
      startMs:    now,
      fadeOutMs:  now + BUBBLE_HOLD_MS,   // begin fade after 6 s
      fadeDurMs:  BUBBLE_FADE_MS,         // fade-out duration in ms
    };
  }

  /**
   * Opacity of a bubble at nowMs: 1 while held, falling to 0 over the fade,
   * 0 once it has gone. Persistent bubbles (fadeOutMs = Infinity) stay at 1.
   */
  function bubbleAlpha(bubble, nowMs) {
    if (!bubble) { return 0; }
    if (bubble.fadeOutMs === Infinity) { return 1; }
    var elapsed   = nowMs - bubble.startMs;
    var fadeStart = bubble.fadeOutMs - bubble.startMs;
    if (elapsed >= fadeStart + bubble.fadeDurMs) { return 0; }
    if (elapsed > fadeStart) { return 1 - (elapsed - fadeStart) / bubble.fadeDurMs; }
    return 1;
  }

  // Queue an attention-call bubble instead of overriding the current one.
  // Only one pending entry is kept — ticking the same attention call many
  // times should not stack messages, so later text simply replaces earlier.
  function queueBubble(text) {
    if (!activeBubble) {
      showBubble(text);
    } else {
      bubbleQueue[0] = text;
    }
  }

  /**
   * Wrap text to fit inside maxWidth using the current canvas context font.
   * Returns an array of lines.
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} maxWidth
   * @returns {string[]}
   */
  function wrapBubbleText(ctx, text, maxWidth) {
    var words = text.split(" ");
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var test = current ? current + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = words[i];
      } else {
        current = test;
      }
    }
    if (current) { lines.push(current); }
    return lines;
  }

  /**
   * Draw the active speech bubble above the pet at (petCx, petTopY).
   * Call this from the animation loop after the pet body has been drawn.
   * Also used by drawStaticPet (reduced-motion mode).
   *
   * @param {number} petCx   — horizontal centre of the pet sprite (canvas px)
   * @param {number} petTopY — top edge of the pet sprite (canvas px)
   * @param {number} nowMs   — performance.now()
   * @param {number} [clearance] — extra gap above the head for z's / hearts (emojiClearance)
   */
  function drawSpeechBubble(petCx, petTopY, nowMs, clearance) {
    if (!activeBubble) { return; }

    // Persistent bubbles (e.g. sleep) stay at full alpha and are never cleared here
    var alpha = bubbleAlpha(activeBubble, nowMs);
    if (alpha <= 0) {
      // Fully faded — clear and show any queued attention-call bubble
      activeBubble = null;
      if (bubbleQueue.length > 0) { showBubble(bubbleQueue.shift()); }
      return;
    }

    var PAD_X    = 8;
    var PAD_Y    = 6;
    var TAIL_H   = 6;   // triangle tail height
    var TAIL_W   = 8;   // half-width of the tail base
    var FONT     = "10px monospace";
    var MAX_W    = Math.min(spriteCanvas.width - 8, 160);
    var LINE_H   = 13;

    spriteCtx.save();
    spriteCtx.globalAlpha = alpha;
    spriteCtx.font = FONT;

    var lines = wrapBubbleText(spriteCtx, activeBubble.text, MAX_W - PAD_X * 2);

    var boxW = 0;
    for (var i = 0; i < lines.length; i++) {
      var lw = spriteCtx.measureText(lines[i]).width;
      if (lw > boxW) { boxW = lw; }
    }
    boxW += PAD_X * 2;
    var boxH = lines.length * LINE_H + PAD_Y * 2;

    // Position: centred on pet, above its head
    var boxX = Math.round(petCx - boxW / 2);
    // Clamp to canvas edges
    boxX = Math.max(4, Math.min(spriteCanvas.width - boxW - 4, boxX));

    // Lift above the z / heart band (clearance) so the emojis stay visible
    var boxBottomY = petTopY - (clearance || 0) - TAIL_H - 2;
    var boxY = boxBottomY - boxH;
    var flipped = false;
    if (boxY < 2 && petTopY - TAIL_H - 2 - boxH >= 2) {
      // Fits above the head but not above the emojis — pin to the top edge
      boxY = 2;
      boxBottomY = boxY + boxH;
    } else if (boxY < 2) {
      // If there's no room above, flip below (pet near top edge — rare)
      boxY = petTopY + 2 + TAIL_H;   // place below pet top instead
      boxBottomY = boxY + boxH;
      flipped = true;
    }

    // Tail tip X — clamped to stay within the box
    var tailTipX = Math.round(petCx);
    tailTipX = Math.max(boxX + TAIL_W + 2, Math.min(boxX + boxW - TAIL_W - 2, tailTipX));

    // Draw box
    spriteCtx.fillStyle = "#1a1a2e";
    spriteCtx.strokeStyle = "#888888";
    spriteCtx.lineWidth = 1;
    spriteCtx.beginPath();
    spriteCtx.roundRect(boxX, boxY, boxW, boxH, 4);
    spriteCtx.fill();
    spriteCtx.stroke();

    // Draw tail triangle
    spriteCtx.beginPath();
    if (!flipped) {
      // Tail points downward from the box bottom
      spriteCtx.moveTo(tailTipX - TAIL_W, boxBottomY);
      spriteCtx.lineTo(tailTipX + TAIL_W, boxBottomY);
      spriteCtx.lineTo(tailTipX, boxBottomY + TAIL_H);
    } else {
      // Tail points upward from the box top
      spriteCtx.moveTo(tailTipX - TAIL_W, boxY);
      spriteCtx.lineTo(tailTipX + TAIL_W, boxY);
      spriteCtx.lineTo(tailTipX, boxY - TAIL_H);
    }
    spriteCtx.closePath();
    spriteCtx.fillStyle = "#1a1a2e";
    spriteCtx.fill();
    // Stroke only the two outer edges of the tail (not the base shared with the box)
    spriteCtx.strokeStyle = "#888888";
    spriteCtx.lineWidth = 1;
    if (!flipped) {
      spriteCtx.beginPath();
      spriteCtx.moveTo(tailTipX - TAIL_W, boxBottomY);
      spriteCtx.lineTo(tailTipX, boxBottomY + TAIL_H);
      spriteCtx.lineTo(tailTipX + TAIL_W, boxBottomY);
      spriteCtx.stroke();
    } else {
      spriteCtx.beginPath();
      spriteCtx.moveTo(tailTipX - TAIL_W, boxY);
      spriteCtx.lineTo(tailTipX, boxY - TAIL_H);
      spriteCtx.lineTo(tailTipX + TAIL_W, boxY);
      spriteCtx.stroke();
    }

    // Draw text
    spriteCtx.fillStyle = "#dddddd";
    spriteCtx.font = FONT;
    spriteCtx.textBaseline = "top";
    for (var j = 0; j < lines.length; j++) {
      spriteCtx.fillText(lines[j], boxX + PAD_X, boxY + PAD_Y + j * LINE_H);
    }

    spriteCtx.restore();
  }

  // ── Animation loop ────────────────────────────────────────────────────────

  function animationLoop(nowMs) {
    requestAnimationFrame(animationLoop);

    if (!lastState || !lastState.alive || currentScreen !== "game") { return; }

    var dt = lastFrameMs === 0 ? 0 : Math.min((nowMs - lastFrameMs) / 1000, 0.1);
    lastFrameMs = nowMs;

    // Dimension helpers
    var scale      = STAGE_SCALES[lastState.stage] || 0.5;
    var bSize      = Math.round(BASE_SIZE * petSizeMultiplier(lastState.spriteType) * scale);
    var bWidth     = effectiveBWidth(lastState, bSize);
    var bHeight    = petBoxHeight(lastState, bWidth);
    // For overweight quadrupeds (not upright, not snake), belly-sag rows add to the effective height.
    var _sType = lastState.spriteType || "classic";
    var _isUprightOrSnake = (_sType === "snake" || _sType === "classic" || _sType === "dragon" || _sType === "tim" || _sType === "stu");
    if (!_isUprightOrSnake && !window.spriteDrawsAsClassic(_sType, lastState.stage)) {
      var sagCellH = Math.max(1, Math.round(bHeight / 32));
      bHeight += quadrupedBellySagRows(lastState.weight || 50) * sagCellH;
    }
    spriteCanvas.style.filter = "";
    var floorY     = spriteCanvas.height - bHeight - 12;
    var minX       = 4;
    var maxX       = spriteCanvas.width - bWidth - 4;

    // Keep floor snacks reachable after the sidebar is narrowed — otherwise the
    // pet chases an off-canvas snack against the right wall forever (BUGFIX-164).
    for (var sk = 0; sk < snackItems.length; sk++) {
      snackItems[sk].x = Math.max(minX, Math.min(maxX, snackItems[sk].x));
    }

    // Init X and Y on first frame — centre horizontally
    if (petY === null) { petY = floorY; }
    if (petX === null) { petX = Math.max(minX, Math.min(maxX, Math.floor(spriteCanvas.width / 2 - bWidth / 2))); }

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
    var isDragon = (lastState.spriteType === "dragon");

    if (activeReaction && (activeReaction.type === "fell_asleep" || activeReaction.type === "died")) {
      // Lock to floor in current position during the fell_asleep / died animation
      petY  = floorY;
      petVx = 0;
      petVy = 0;

    } else if (activeReaction && activeReaction.type === "patted" && window.spritePat.runLap(lastState.spriteType, 0) !== null) {
      // Tim's "Go for a Run": jog a lap towards the roomier side and back
      if (activeReaction.runFromX === undefined) {
        var runDir  = (petX + bWidth / 2 < spriteCanvas.width / 2) ? 1 : -1;
        var runRoom = runDir > 0 ? maxX - petX : petX - minX;
        activeReaction.runFromX = petX;
        activeReaction.runDist  = runDir * Math.max(0, Math.min(runRoom, Math.max(bWidth * 1.5, spriteCanvas.width * 0.5)));
      }
      var runLap = window.spritePat.runLap(lastState.spriteType, (nowMs - activeReaction.startMs) / activeReaction.durationMs);
      var runX   = Math.max(minX, Math.min(maxX, activeReaction.runFromX + activeReaction.runDist * runLap));
      petVx = dt > 0 ? (runX - petX) / dt : 0;
      if (Math.abs(petVx) > 0.5) { petFacingLeft = petVx < 0; }
      petX  = runX;
      petY  = isDragon ? floorY - Math.round(bHeight * 0.12) : floorY;
      petVy = 0;

    } else if (activeReaction && activeReaction.type === "fed_meal") {
      // Eating a meal: stand still at the bowl (wander resumes once the reaction ends)
      petVx = 0;
      petVy = 0;
      petY  = isDragon ? floorY - Math.round(bHeight * 0.12) : floorY;

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
      petY  = isDragon ? floorY - Math.round(bHeight * 0.12) : floorY;

    } else if (isDragon) {
      // ── Dragon: hover + gentle float bob, no gravity ─────────────────────
      floatPhase += 1.2 * dt;
      var floatOffset = Math.round(Math.sin(floatPhase) * 3);
      var hoverY = floorY - Math.round(bHeight * 0.12);  // float ~12% of body height above floor
      petY  = hoverY + floatOffset;
      petVy = 0;

      // Horizontal movement (same wander logic, no gravity/hop)
      var speed = getSpeedPPS(lastState);
      if (snackItems.length > 0 && speed > 0) {
        var closestSnack = snackItems[0];
        var closestDist  = Math.abs((petX + bWidth / 2) - (snackItems[0].x + SNACK_HALF_W));
        for (var si = 1; si < snackItems.length; si++) {
          var sd = Math.abs((petX + bWidth / 2) - (snackItems[si].x + SNACK_HALF_W));
          if (sd < closestDist) { closestDist = sd; closestSnack = snackItems[si]; }
        }
        if (closestDist < bWidth / 2 + 4) {
          snackItems.splice(snackItems.indexOf(closestSnack), 1);
          releaseSnackAnswers();
          idleTimer = 0.6;  // chomp pause (mood layer "eating")
          chompUntilMs = nowMs + 600;
          petVx     = 0;
          vscode.postMessage({ command: "snack_consumed" });
        } else {
          petVx         = (closestSnack.x + SNACK_HALF_W) > (petX + bWidth / 2) ? speed : -speed;
          petFacingLeft = petVx < 0;
          petX         += petVx * dt;
        }
      } else if (speed > 0 && idleTimer <= 0) {
        if (petVx === 0) {
          petVx         = Math.random() < 0.5 ? speed : -speed;
          petFacingLeft = petVx < 0;
        }
        petX += petVx * dt;
        if (petX >= maxX) { petX = maxX; petVx = -speed; petFacingLeft = true; }
        else if (petX <= minX) { petX = minX; petVx = speed; petFacingLeft = false; }
        if (Math.random() < 0.0015) { petVx = -petVx; petFacingLeft = !petFacingLeft; }
      } else if (idleTimer > 0) {
        idleTimer -= dt;
        if (idleTimer < 0) { idleTimer = 0; if (petVx === 0) { petVx = Math.random() < 0.5 ? speed : -speed; petFacingLeft = petVx < 0; } }
        petVx = 0;
      }
      petX = Math.max(minX, Math.min(maxX, petX));

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
        // Snack targeting — use center-to-center distance (pet center vs snack center)
        var closestSnack = snackItems[0];
        var closestDist  = Math.abs((petX + bWidth / 2) - (snackItems[0].x + SNACK_HALF_W));
        for (var si = 1; si < snackItems.length; si++) {
          var sd = Math.abs((petX + bWidth / 2) - (snackItems[si].x + SNACK_HALF_W));
          if (sd < closestDist) { closestDist = sd; closestSnack = snackItems[si]; }
        }
        if (closestDist < bWidth / 2 + 4) {
          // Pet reached the snack
          snackItems.splice(snackItems.indexOf(closestSnack), 1);
          releaseSnackAnswers();
          idleTimer = 0.6;  // chomp pause (mood layer "eating")
          chompUntilMs = nowMs + 600;
          petVx     = 0;
          vscode.postMessage({ command: "snack_consumed" });
        } else {
          petVx         = (closestSnack.x + SNACK_HALF_W) > (petX + bWidth / 2) ? speed : -speed;
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
    // Dragon floats — it has no legs, so always pass legFrame -1 (upright/neutral).
    var walking  = !isDragon && !lastState.sleeping && Math.abs(petVx) > 0.5 && petY >= floorY - 0.5;
    var running  = activeReaction && activeReaction.type === "patted" && window.spritePat.runLap(lastState.spriteType, 0) !== null;
    var legFrame = isDragon ? -1 : (walking ? Math.floor(animTick / (running ? 4 : 10)) % 2 : 0);
    var walkBob  = (walking && legFrame === 1) ? -1 : 0;

    // ── Mood layer: props, body squash, particles (window.spriteMood) ─────
    var feeding = activeReaction && (activeReaction.type === "fed_meal" || activeReaction.type === "fed_snack");
    if (nowMs < chompUntilMs) { snackChomp = true; }
    else if (feeding) { snackChomp = (activeReaction.type === "fed_snack"); }
    var mood = window.spriteMood.current(lastState, activeReaction && activeReaction.type, nowMs < chompUntilMs);
    if (mood !== lastMood) { moodParticles.length = 0; lastMoodFrame = -1; }
    lastMood = mood;
    lastState.displayMood = mood;   // lets renderSpriteGrid pick optional per-mood grids
    var moodFrame = window.spriteMood.frame(mood, animTick);
    var moodBox   = { x: Math.round(petX), y: Math.round(petY) + walkBob, w: bWidth, h: bHeight,
                      pxW: petPropWidth(lastState) };
    window.spriteMood.spawn(moodParticles, mood, moodFrame, moodFrame !== lastMoodFrame, moodBox, petFacingLeft, dt);
    window.spriteMood.step(moodParticles, dt, floorY + bHeight);
    lastMoodFrame = moodFrame;
    var moodProps = mood && !isDragon;   // the dragon hovers, so no floor props
    var patting   = activeReaction && activeReaction.type === "patted";
    var patT      = patting ? Math.min(1, (nowMs - activeReaction.startMs) / activeReaction.durationMs) : 0;
    if (patting) {
      // Stu opens a sticker binder or a pack — picked once per action
      if (activeReaction.prop === undefined) { activeReaction.prop = window.spritePat.pickProp(lastState.spriteType); }
      window.spritePat.spawn(patParticles, lastState.spriteType, moodBox, petFacingLeft, dt, Math.random, patT);
    }
    window.spriteMood.step(patParticles, dt, floorY + bHeight);

    // ── Draw ──────────────────────────────────────────────────────────────
    drawEnvironment(lastState);
    if (moodProps) {
      window.spriteMood.drawProps(spriteCtx, mood, moodFrame, moodBox, petFacingLeft, snackChomp);
    }
    drawBodyWithReaction(lastState, Math.round(petX), Math.round(petY) + walkBob, petFacingLeft, legFrame, activeReaction, nowMs,
                         window.spriteMood.scaleY(mood, moodFrame));
    var moodPxSize = window.spriteMood.px(moodBox);
    if (patting && window.spritePat.usesHand(lastState.spriteType)) {
      window.spritePat.drawHand(spriteCtx, patT, moodBox, petFacingLeft, moodPxSize);
    } else if (patting && activeReaction.prop) {
      window.spritePat.drawProp(spriteCtx, activeReaction.prop, patT, moodBox, moodPxSize);
    }
    window.spriteMood.drawParticles(spriteCtx, moodParticles, moodPxSize);
    window.spriteMood.drawParticles(spriteCtx, patParticles, moodPxSize);
    // AI-usage report: the pet holds a phone / tablet / laptop for as long as the bubble shows
    if (activeBubble && activeBubble.kind === "usage" && !lastState.sleeping) {
      window.spritePat.drawDevice(spriteCtx, window.spritePat.device(lastState.spriteType), moodBox, petFacingLeft,
                                  moodPxSize, (nowMs - activeBubble.startMs) / DEVICE_SLIDE_MS,
                                  bubbleAlpha(activeBubble, nowMs), animTick);
    }
    drawStatusIndicators(lastState, Math.round(petX), Math.round(petY) + walkBob);

    // ── Speech bubble ──────────────────────────────────────────────────────
    var _bScale   = STAGE_SCALES[lastState.stage] || 0.5;
    var _bSz      = Math.round(BASE_SIZE * petSizeMultiplier(lastState.spriteType) * _bScale);
    var _bW       = effectiveBWidth(lastState, _bSz);
    var _petCx    = Math.round(petX) + Math.round(_bW / 2);
    var _petTopY  = Math.round(petY) + walkBob - headGap(lastState);
    drawSpeechBubble(_petCx, _petTopY, nowMs,
                     emojiClearance(lastState.sleeping || patting, moodPxSize));
  }

  /**
   * Height (canvas px) of the band above the head used by the floating z's,
   * the pat hearts and the patting hand, so the speech bubble sits above them.
   * z's and hearts rise ~20px; the (half-size) hand reaches ~6 prop-pixels above the head.
   * @param {boolean} active — the pet is asleep or being patted
   * @param {number}  px     — mood / pat prop pixel size
   * @returns {number}
   */
  function emojiClearance(active, px) {
    var lingering = false;
    var all = moodParticles.concat(patParticles);
    for (var i = 0; i < all.length; i++) {
      if (all[i].kind === "z" || all[i].kind === "heart") { lingering = true; break; }
    }
    return (active || lingering) ? Math.max(24, 6 * px + 4) : 0;
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
      // The "died" reaction is still playing — the timer shows the dead screen.
      if (pendingDeathTimer !== null) { return; }
      // Fire a death bubble once, on the transition tick
      if (lastState && lastState.alive) {
        var _diedCode = (state.events || []).indexOf("died_of_old_age") !== -1
          ? "died_of_old_age" : "died";
        showBubble(humaniseEvent(_diedCode, state.name, state));
        if (!REDUCED_MOTION && currentScreen === "game") {
          // Play the float-up on the last alive snapshot (lastState is left
          // untouched), then switch to the dead screen.
          reactionQueue = [];
          pushReaction("died", performance.now());
          pendingDeathTimer = setTimeout(function () {
            pendingDeathTimer = null;
            reactionQueue = [];
            lastState = state;
            renderDeadScreen(state, highScore);
            showScreen("dead");
          }, REACTION_DURATIONS.died);
          return;
        }
      }
      renderDeadScreen(state, highScore);
      showScreen("dead");
      return;
    }

    if (pendingDeathTimer !== null) {
      clearTimeout(pendingDeathTimer);
      pendingDeathTimer = null;
    }

    showScreen("game");

    var _cc = (customCharBySpriteType) ? customCharBySpriteType(state.spriteType) : null;

    var _nameDefault = _cc ? _cc.defaultName : "Codotchi";
    petNameDisplay.textContent = state.name || _nameDefault;
    moodLabel.textContent      = moodText(state);

    setBar(barHunger,    state.hunger);
    setBar(barHappiness, state.happiness);
    setBar(barEnergy,    state.energy);
    setHealthBar(barHealth, state.health);

    // Tim-specific: rename "Hunger" label to "Thirst"
    var _hungerLabelEl = document.getElementById("stat-label-hunger");
    var _hungerTrackEl = document.getElementById("bar-track-hunger");
    if (_hungerLabelEl) {
      var _hungerLabelText = (_cc && state.spriteType === "tim") ? "Thirst" : "Hunger";
      _hungerLabelEl.textContent = _hungerLabelText;
      if (_hungerTrackEl) { _hungerTrackEl.setAttribute("aria-label", _hungerLabelText); }
    }

    const typeLabel = (state.petType || "codeling");
    const _infoCC = (customCharBySpriteType) ? customCharBySpriteType(state.spriteType) : null;
    const typeLabelCap = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
    const spriteLabel = (_infoCC && _infoCC.characterLabel) ? _infoCC.characterLabel
      : (state.spriteType && state.spriteType !== "classic")
      ? state.spriteType.charAt(0).toUpperCase() + state.spriteType.slice(1)
      : "";
    infoLine.textContent =
      "Age: " + formatAge(state.ageDays) + "  |  " +
      state.stage            + "  |  " +
      (spriteLabel ? spriteLabel + "  |  " : "") +
      typeLabelCap;

    // Update sleep/wake button label to match current state
    const sleepWakeBtn = document.getElementById("btn-sleep-wake");
    // A break nap can't be cut short — show the minutes left instead of "Wake"
    const napTicks = state.breakNapTicksRemaining || 0;
    sleepWakeBtn.textContent = napTicks > 0
      ? "Napping " + Math.max(1, Math.ceil(napTicks * 3 / 60)) + "m"
      : (state.sleeping ? "Wake" : "Sleep");
    sleepWakeBtn.title = napTicks > 0 ? "Taking a break nap — it wakes up on its own" : "";
    sleepWakeBtn.dataset["sleeping"] = state.sleeping ? "true" : "false";

    // BUGFIX-002: disable care buttons while pet is sleeping; also disable while paused
    const isSleeping = state.sleeping;
    const isPaused   = !!state.paused;
    const isSick     = !!state.sick;
    ["btn-feed-meal", "btn-feed-snack", "btn-play",
     "btn-clean", "btn-medicine", "btn-praise", "btn-scold"].forEach(function (id) {
      const btn = document.getElementById(id);
      if (btn) { btn.disabled = isSleeping || isPaused; }
    });
    // BUG-S04: Feed, Snack and Play are refused while sick — grey them out
    if (isSick) {
      ["btn-feed-meal", "btn-feed-snack", "btn-play"].forEach(function (id) {
        const btn = document.getElementById(id);
        if (btn) { btn.disabled = true; }
      });
    }
    // Sleep/Wake button: disabled while paused or during a break nap
    // (otherwise it must remain clickable to Wake while sleeping)
    if (sleepWakeBtn) { sleepWakeBtn.disabled = isPaused || napTicks > 0; }

    // Medicine doses-left badge, shown only while sick
    var MEDICINE_DOSES = 3;
    if (medicineLeftEl) {
      medicineLeftEl.textContent = isSick
        ? Math.max(0, MEDICINE_DOSES - (state.medicineDosesGiven || 0)) + ""
        : "";
    }

    // Meals-left badge on Feed button
    var _feedCC = (customCharBySpriteType) ? customCharBySpriteType(state.spriteType) : null;
    var MEAL_MAX = (_feedCC && _feedCC.feedMealMaxPerCycle) ? _feedCC.feedMealMaxPerCycle : 3;
    var mealsLeft = Math.max(0, MEAL_MAX - mealsGiven);
    if (mealsLeftEl) {
      mealsLeftEl.textContent = mealsLeft > 0 ? mealsLeft + "" : "";
    }

    // Snacks-left badge on Snack button + disable when at limit
    var SNACK_MAX = (_feedCC && _feedCC.feedSnackMaxPerCycle) ? _feedCC.feedSnackMaxPerCycle : 3;
    var snacksLeft = Math.max(0, SNACK_MAX - (state.snacksGivenThisCycle || 0));
    if (snacksLeftEl) {
      snacksLeftEl.textContent = snacksLeft > 0 ? snacksLeft + "" : "";
    }
    var snackBtn = document.getElementById("btn-feed-snack");
    if (snackBtn && !isSleeping && !isPaused && !isSick) {
      snackBtn.disabled = snacksLeft <= 0;
    }

    // Custom character Pat button label
    var _customChar = (customCharBySpriteType) ? customCharBySpriteType(state.spriteType) : null;
    var mgPatBtn = document.getElementById("btn-mg-pat");
    if (mgPatBtn) { mgPatBtn.textContent = _customChar ? _customChar.patLabel : "Pat"; }
    var mgCfBtn = document.getElementById("btn-mg-cf");
    if (mgCfBtn) { mgCfBtn.textContent = playsBlackjack(state) ? "Blackjack" : "Coin Flip"; }

    // Reset position when a brand-new or just-loaded pet first appears
    if (!lastState || !lastState.alive) {
      var scale2   = STAGE_SCALES[state.stage] || 0.5;
      var bSize2   = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * scale2);
      var bWidth2  = effectiveBWidth(state, bSize2);
      var centreX  = Math.max(4, Math.floor(spriteCanvas.width / 2 - bWidth2 / 2));
      if (state.sleeping) {
        // Restore the position where the pet fell asleep (saved to localStorage).
        // Falls back to centre only if no stored value exists.
        var storedSleepX = parseFloat(localStorage.getItem("codotchi_sleepX") || "");
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
      moodParticles = [];
      patParticles  = [];
      lastMood      = null;
      chompUntilMs  = 0;
      giftBoxX      = null;
      snackItems    = [];
      heldSnackAnswers     = [];
      releasedSnackAnswers = [];
    }

    // Reset position when the pet evolves to a new stage
    if (lastState && lastState.alive && state.stage !== lastState.stage) {
      petX      = null;   // re-centred on first rAF frame
      petY      = null;   // re-floored on first rAF frame
      petVx     = 0;
      petVy     = 0;
      lastFrameMs = 0;
    }

    // ── Map incoming events to reactions ──────────────────────────────────
    var nowMs = performance.now();
    var events = state.events || [];

    // A snack answers the hunger / craving call as soon as it's placed, but the
    // "answered" bubble and log line wait until the pet has eaten it, then come
    // through with the fed_snack state. Reduced motion has no walking pet to
    // eat the snack, so there they show straight away.
    var snackPlaced = events.indexOf("snack_placed") !== -1 && snackItems.length < 3;
    if (snackPlaced && !REDUCED_MOTION) {
      heldSnackAnswers = heldSnackAnswers.concat(events.filter(isAnsweredCall));
      events = events.filter(function (e) { return !isAnsweredCall(e); });
    }
    if (releasedSnackAnswers.length > 0) {
      events = events.concat(releasedSnackAnswers);
      releasedSnackAnswers = [];
    }

    if (events.indexOf("fed_meal")      !== -1) { pushReaction("fed_meal",      nowMs); }
    if (events.indexOf("fed_snack")     !== -1) { pushReaction("fed_snack",     nowMs); }
    if (events.indexOf("played")        !== -1) { pushReaction("played",        nowMs); }
    if (events.indexOf("patted")        !== -1) {
      // Tim's run and Stu's stickers take longer than a pat
      pushReaction("patted", nowMs, window.spritePat.durationMs(state.spriteType, REACTION_DURATIONS.patted));
    }
    if (events.indexOf("fell_asleep")   !== -1) {
      pushReaction("fell_asleep",   nowMs);
      // Persist the X position so it survives a webview reload while sleeping
      try { localStorage.setItem("codotchi_sleepX", String(Math.round(petX !== null ? petX : 0))); } catch (e) {}
      // Sleep bubble — picks one of 4 options at random, persists until wake
      (function () {
        var _sleepTexts = ["Zzz...", "z z Z Z...", "*snoozing*", state.name + " is asleep. Zzz..."];
        showBubble(_sleepTexts[Math.floor(Math.random() * _sleepTexts.length)]);
        if (activeBubble) { activeBubble.fadeOutMs = Infinity; }
      })();
      petIsSleeping = true;
    }
    if (events.indexOf("woke_up")        !== -1 ||
        events.indexOf("auto_woke_up")   !== -1 ||
        events.indexOf("break_nap_over") !== -1) {
      petIsSleeping = false;
      activeBubble = null; // clear the persistent sleep bubble
      pushReaction("woke_up",       nowMs);
    }
    if (events.indexOf("scolded")       !== -1) { pushReaction("scolded", nowMs); }
    if (events.indexOf("praised")       !== -1) { pushReaction("praised", nowMs); }
    if (events.indexOf("became_sick")   !== -1) { pushReaction("became_sick",   nowMs); }
    if (events.indexOf("cured")         !== -1) { pushReaction("healed",        nowMs); }
    if (events.indexOf("pooped")        !== -1) { pushReaction("poop_appeared", nowMs); }
    // evolved: any evolved_to_* event (egg → baby gets the hatch burst instead)
    for (var ei = 0; ei < events.length; ei++) {
      if (events[ei] === "evolved_to_baby") { pushReaction("hatched", nowMs); break; }
      if (events[ei].indexOf("evolved_to_") === 0) { pushReaction("evolved", nowMs); break; }
    }

    // ── Speech bubble triggers ─────────────────────────────────────────────
    // Suppressed entirely while pet is sleeping (sleep bubble persists until wake).
    // Priority: attention calls > minigame > praise > scold > commit > save.
    // Only one bubble per tick — first match wins.
    if (!petIsSleeping) (function () {
      var _n = state.name;
      // 1. Attention calls (unanswered, unexpired) — queued so they don't clobber an active bubble
      for (var _ai = 0; _ai < events.length; _ai++) {
        if (events[_ai].indexOf("attention_call_") === 0 &&
            events[_ai].indexOf("attention_call_answered_") !== 0 &&
            events[_ai].indexOf("attention_call_expired_") !== 0) {
          queueBubble(humaniseEvent(events[_ai], _n, state));
          return;
        }
      }
      // 1b. Answered whim calls (play / pat / craving) — outranks the minigame result
      var _whimChar = customCharBySpriteType ? customCharBySpriteType(state.spriteType) : null;
      for (var _wk in WHIM_ANSWER_SPEECH) {
        // Tim / Stu answer a run / sticker call with their own patBubbles (step 5)
        if (_wk === "pat" && _whimChar && _whimChar.patCall) { continue; }
        if (events.indexOf("attention_call_answered_" + _wk) !== -1) {
          var _wl = WHIM_ANSWER_SPEECH[_wk];
          showBubble(_wl[Math.floor(Math.random() * _wl.length)]);
          return;
        }
      }
      // 2. Minigame results (play, not pat)
      for (var _mi = 0; _mi < events.length; _mi++) {
        if (events[_mi].indexOf("minigame_") === 0) {
          showBubble(humaniseEvent(events[_mi], _n, state));
          return;
        }
      }
      // 3. Praise — only when answering a gift or unhappiness attention call
      if (events.indexOf("praised") !== -1 &&
          (events.indexOf("attention_call_answered_gift") !== -1 ||
           events.indexOf("attention_call_answered_unhappiness") !== -1)) {
        var _praiseTexts = ["This makes me happy!", "I feel so loved.", "That means a lot to me.", "I'm happy you're here."];
        showBubble(_praiseTexts[Math.floor(Math.random() * _praiseTexts.length)]);
        return;
      }
      // 4. Scold — only when answering a misbehaviour attention call
      if (events.indexOf("scolded") !== -1 &&
          events.indexOf("attention_call_answered_misbehaviour") !== -1) {
        var _scoldTexts = ["Okay okay, I'll behave...", "Sorry... I'll stop.", "I didn't mean it...", "Okay! I'll be good!"];
        showBubble(_scoldTexts[Math.floor(Math.random() * _scoldTexts.length)]);
        return;
      }
      // 5. Custom character pat speech bubble
      if (events.indexOf("patted") !== -1) {
        var _patChar = customCharBySpriteType(state.spriteType);
        if (_patChar && _patChar.patBubbles && _patChar.patBubbles.length > 0) {
          var _bubbles = _patChar.patBubbles;
          showBubble(_bubbles[Math.floor(Math.random() * _bubbles.length)]);
          return;
        }
      }
      // 6. Commit activity
      if (events.indexOf("commit_activity_rewarded") !== -1) {
        showBubble(humaniseEvent("commit_activity_rewarded", _n, state));
        return;
      }
      // 6. Save / code activity
      if (events.indexOf("code_activity_rewarded") !== -1) {
        showBubble(humaniseEvent("code_activity_rewarded", _n, state));
      }
    })();

    // Gift box — show a box on the floor while a "gift" attention call is active
    var prevGift = lastState && lastState.activeAttentionCall === "gift";
    var currGift = state.activeAttentionCall === "gift";
    if (!prevGift && currGift) {
      var gW2 = spriteCanvas.width;
      var gx  = 4 + Math.floor(Math.random() * Math.max(1, gW2 - 28));
      if (Math.abs(gx - (petX !== null ? petX : 0)) < 24 && gW2 > 60) {
        gx = gW2 - 28 - gx;
        if (gx < 4) { gx = 4; }
      }
      giftBoxX = gx;
    } else if (prevGift && !currGift) {
      giftBoxX = null;
    }

    // Hand off to animation loop — it owns all drawing
    lastState = state;

    appendEvents(events, state.name, state);

    // Spawn poo overlay animation
    if ((state.events || []).indexOf("pooped") !== -1) { spawnPooAnim(); }

    // Snack items — spawn a floor item when snack_placed fires
    if (snackPlaced) {
      var siW = spriteCanvas.width;
      // Compute the pet's reachable X range so the snack is always within reach.
      var siScale  = STAGE_SCALES[(state.stage || lastState && lastState.stage) || "baby"] || 0.5;
      var siBSize  = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType || (lastState && lastState.spriteType)) * siScale);
      var siBWidth = effectiveBWidth(state.alive ? state : lastState, siBSize);
      var siMinX   = 4;
      var siMaxX   = siW - siBWidth - 4;
      var siRawX   = 4 + Math.floor(Math.random() * Math.max(1, siW - 24));
      snackItems.push({
        x:    Math.max(siMinX, Math.min(siMaxX, siRawX)),
        type: cravedSnackType(_cc)
            || ((_cc && state.spriteType === "tim") ? "tea"
            : (_cc && state.spriteType === "stu") ? (Math.random() < 0.5 ? "guinness" : "salmon")
            : (["candy", "bone", "cookie"][Math.floor(Math.random() * 3)])),
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

  /** Floor snack type matching the active snack craving (e.g. Stu's pint → "guinness"), or null. */
  function cravedSnackType(cc) {
    if (!cc || !cc.snackCravings || !currentCravingItem) { return null; }
    for (var i = 0; i < cc.snackCravings.length; i++) {
      if (cc.snackCravings[i].label === currentCravingItem) { return cc.snackCravings[i].item; }
    }
    return null;
  }

  /** Append new event strings to the scrollable event log. */
  function humaniseEvent(code, name, state) {
    var n = name || "Codotchi";
    var _cc = (state && customCharBySpriteType) ? customCharBySpriteType(state.spriteType) : null;
    var labels = {
      "auto_woke_up":           n + " woke up after a full nap.",
      "break_nap_over":         "Break's over! " + n + " woke up from their nap.",
      "pooped":                  n + " pooped!",
      "became_sick":             n + " got sick!",
      "sickness_damage":         n + " is losing health from being sick!",
      "starvation_damage":       n + " is starving and losing health!",
      "unhappiness_damage":      n + " is miserable and losing health!",
      "exhaustion_damage":       n + " is exhausted and losing health!",
      "died":                    n + " passed away...",
      "fed_snack":               n + " had a snack.",
      "snack_placed":            "",   // silent — only triggers the floor-item animation
      "game_paused":             "",   // silent — pause state shown via toolbar button
      "game_resumed":            "",   // silent
      "cured":                   n + " recovered!",
      "meal_refused":            n + " refused the meal.",
      "meal_refused_sick":       n + " is too sick to eat — give medicine first!",
      "snack_refused_sick":      n + " is too sick for a snack — give medicine first!",
      "play_refused_sick":       n + " is too sick to play — give medicine first!",
      "break_nap_no_wake":       n + " is on a break nap and will wake up on their own.",
      "fed_meal":                n + " ate a meal.",
      "snack_refused":           n + " threw the snack away.",
      "play_refused_no_energy":  n + " doesn't have enough energy to play!",
      "played":                  n + " played!",
      "pat_refused_no_energy":   (_cc && _cc.patToasts) ? _cc.patToasts.pat_refused.replace("__Name__", n) : n + " doesn't have enough energy to be patted!",
      "patted":                  (_cc && _cc.patToasts) ? _cc.patToasts.patted.replace("__Name__", n)       : n + " was patted!",
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
      "code_activity_rewarded":  [n + " watches you type and tries not to judge.", n + " sees you saving again... another bug?", n + " noticed. Didn't say it was good.", n + " is not saying anything. Just watching.", n + " has no idea what you're building.", n + " sees you putting in the work.", n + " respects the grind, barely."],
      "commit_activity_rewarded": [n + " has seen better commits. Still, well done.", n + " is cautiously optimistic.", n + " is legally required to say 'great job'.", n + " approves this commit with two paws up!", n + " is proud of the progress you're making!"],
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
      "attention_call_gift":            (_cc && _cc.giftMessage) ? _cc.giftMessage.replace("__Name__", n) : n + " brought you a gift!",
      "attention_call_critical_health": n + " is calling — health is critical!",
      "attention_call_play":            n + " wants to play a game with you!",
      "attention_call_pat":             n + " wants a pat!",
      "attention_call_craving_meal":    n + " is craving a proper meal!",
      "attention_call_craving_snack":   n + " is craving a snack!",
      "attention_call_break":           "Time for a break! You've been coding for 30 minutes.",
      // Attention calls — answered
      "attention_call_answered_hunger":          "You answered " + n + "'s hunger call.",
      "attention_call_answered_unhappiness":     "You answered " + n + "'s sadness call.",
      "attention_call_answered_poop":            "You cleaned up after " + n + ".",
      "attention_call_answered_sick":            "You answered " + n + "'s sickness call.",
      "attention_call_answered_low_energy":      "You answered " + n + "'s exhaustion call.",
      "attention_call_answered_misbehaviour":    "You scolded " + n + " and answered their call.",
      "attention_call_answered_gift":            "You accepted " + n + "'s gift!",
      "attention_call_answered_critical_health": "You answered " + n + "'s critical health call.",
      "attention_call_answered_play":            "You played with " + n + " when they asked.",
      "attention_call_answered_pat":             "You gave " + n + " the pat they wanted.",
      "attention_call_answered_craving":         "You satisfied " + n + "'s craving.",
      "attention_call_answered_break":           "You're taking a break — " + n + " is napping too (5 min).",
      // Attention calls — expired
      "attention_call_expired_hunger":          n + "'s hunger call went unanswered!",
      "attention_call_expired_unhappiness":     n + "'s sadness call went unanswered!",
      "attention_call_expired_poop":            n + "'s clean-up call went unanswered!",
      "attention_call_expired_sick":            n + "'s sickness call went unanswered!",
      "attention_call_expired_low_energy":      n + "'s exhaustion call went unanswered!",
      "attention_call_expired_misbehaviour":    n + "'s misbehaviour call went unanswered!",
      "attention_call_expired_gift":            n + "'s gift was ignored.",
      "attention_call_expired_critical_health": n + "'s critical health call went unanswered!",
      "attention_call_expired_play":            n + " wanted to play and was ignored.",
      "attention_call_expired_pat":             n + " wanted a pat and was ignored.",
      "attention_call_expired_craving":         n + "'s craving went unanswered.",
      "attention_call_expired_break":           n + "'s break reminder was skipped.",
      // Mini-game results
      "minigame_left_right_win":    n + " won Left / Right!",
      "minigame_left_right_lose":   n + " lost Left / Right.",
      "minigame_higher_lower_win":  n + " won Higher or Lower!",
      "minigame_higher_lower_lose": n + " lost Higher or Lower.",
      "minigame_coin_flip_win":     n + " won Coin Flip!",
      "minigame_coin_flip_lose":    n + " lost Coin Flip.",
      "minigame_blackjack_win":     n + " won at Blackjack!",
      "minigame_blackjack_lose":    n + " lost at Blackjack.",
      "minigame_blackjack_push":    n + " pushed at Blackjack.",
    };
    // Custom characters ask for a run / stickers instead of a pat, and name their snack
    var _pc = _cc && _cc.patCall;
    if (_pc) {
      labels["attention_call_pat"]          = _pc.call.replace("__Name__", n);
      labels["attention_call_answered_pat"] = _pc.answered.replace("__Name__", n);
      labels["attention_call_expired_pat"]  = _pc.expired.replace("__Name__", n);
    }
    if (_cc && _cc.snackCravings && currentCravingItem) {
      labels["attention_call_craving_snack"] = n + " is craving " + currentCravingItem + "!";
    }
    var val = labels[code];
    if (val) {
      // Tim-specific event message overrides
      if (_cc && state.spriteType === "tim") {
        if (code === "fed_snack")                      { return n + " drank some tea."; }
        if (code === "became_sick")                    { return n + " had too much gluten!"; }
        if (code === "sickness_damage")                { return n + " is losing health from too much gluten!"; }
        if (code === "attention_call_sick")            { return n + " is calling — gluten intolerance acting up!"; }
        if (code === "attention_call_answered_sick")   { return "You answered " + n + "'s gluten call."; }
        if (code === "attention_call_expired_sick")    { return n + "'s gluten call went unanswered!"; }
      }
      return Array.isArray(val) ? val[Math.floor(Math.random() * val.length)] : val;
    }
    if (code.indexOf("evolved_to_") === 0) {
      var stage = code.slice("evolved_to_".length);
      return n + " evolved into " + stage + "!";
    }
    if (code.indexOf("minigame_") === 0) {
      return n + " played a mini-game.";
    }
    return code;
  }

  // Consecutive repeats of the same event (damage ticks, pats, snacks,
  // medicine, …) collapse into one updating line with a (×N) counter instead of
  // flooding the log with identical entries.  The first label is kept so
  // events with randomised wording don't change text on every repeat.
  function isAnsweredCall(code) {
    return code.indexOf("attention_call_answered_") === 0;
  }

  /** The pet ate a floor snack: let the held "answered" text through with the next state. */
  function releaseSnackAnswers() {
    releasedSnackAnswers = releasedSnackAnswers.concat(heldSnackAnswers);
    heldSnackAnswers = [];
  }

  function appendEvents(events, petName, state) {
    if (!events.length) { return; }
    events.forEach(function (text) {
      const label = humaniseEvent(text, petName, state);
      if (!label) { return; }
      const mostRecent = eventLog.firstChild;
      if (mostRecent && mostRecent.dataset && mostRecent.dataset.eventCode === text) {
        const count = (parseInt(mostRecent.dataset.count, 10) || 1) + 1;
        mostRecent.dataset.count = String(count);
        mostRecent.textContent = (mostRecent.dataset.label || label) + " (×" + count + ")";
        return;
      }
      const li = document.createElement("li");
      li.textContent = label;
      li.dataset.eventCode = text;
      li.dataset.label = label;
      li.dataset.count = "1";
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

    var x = Math.max(0, Math.min(container.offsetWidth - W, petX !== null ? petX : Math.floor(container.offsetWidth / 2)));
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
      // Collapse consecutive repeats into one line with a (×N) counter,
      // matching the live event log.
      var lastCode = null, lastLi = null, lastLabel = "", lastCount = 0;
      reversed.forEach(function (text) {
        var label = humaniseEvent(text, state.name, state);
        if (!label) { return; }
        if (lastLi && text === lastCode) {
          lastCount += 1;
          lastLi.textContent = lastLabel + " (×" + lastCount + ")";
          return;
        }
        var li = document.createElement("li");
        li.textContent = label;
        deadEventLog.appendChild(li);
        lastCode = text; lastLi = li; lastLabel = label; lastCount = 1;
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

    // Leaderboard submit button — shown when VS Code/PyCharm host supports it
    if (leaderboardSection) {
      if (leaderboardAvailable) {
        leaderboardSection.classList.remove("hidden");
        // Reset button state for a fresh death (unless already submitted this run)
        if (btnSubmitLB && !leaderboardSubmitted) {
          btnSubmitLB.disabled = leaderboardBlocked !== null;
          btnSubmitLB.textContent = leaderboardBlocked !== null ? "Not eligible for the leaderboard" : "Submit to Leaderboard";
          btnSubmitLB.title = leaderboardBlocked || "";
        }
        if (leaderboardStatus) {
          if (leaderboardBlocked !== null && !leaderboardSubmitted) {
            leaderboardStatus.textContent = leaderboardBlocked;
            leaderboardStatus.classList.remove("hidden");
          } else {
            leaderboardStatus.classList.add("hidden");
          }
        }
      } else {
        leaderboardSection.classList.add("hidden");
      }
    }

    // Delete entry button — shown after submission (user can only delete what they've submitted)
    if (lbDeleteSection) {
      if (leaderboardAvailable && leaderboardSubmitted) {
        lbDeleteSection.classList.remove("hidden");
      } else {
        lbDeleteSection.classList.add("hidden");
      }
    }

    // "View Leaderboard" link is always visible on the dead screen regardless of platform
    if (btnViewLB) {
      btnViewLB.classList.remove("hidden");
      btnViewLB.href = LEADERBOARD_PAGES_URL;
    }
  }

  // ── Sprite drawing ───────────────────────────────────────────────────────

  /**
   * Draw a 1-px outline around every set cell of a pixel grid, so the coloured
   * cells drawn on top of it stand out against a busy background.
   *
   * @param {number[][]} grid  - Rows of cells; 0 = empty
   * @param {number}     x     - Left edge in canvas pixels
   * @param {number}     y     - Top edge in canvas pixels
   * @param {number}     scale - Canvas pixels per cell
   * @param {string}     colour
   */
  function drawGridOutline(grid, x, y, scale, colour) {
    spriteCtx.fillStyle = colour;
    grid.forEach(function (row, ry) {
      row.forEach(function (cell, rx) {
        if (cell) { spriteCtx.fillRect(x + rx * scale - 1, y + ry * scale - 1, scale + 2, scale + 2); }
      });
    });
  }

  /**
   * Draw background, ground line, poos, gift box, snack items.
   * @param {object} state
   */
  function drawEnvironment(state) {
    const palette    = getPalette(state.spriteType);
    const background = palette.background;

    const W = spriteCanvas.width;
    const H = spriteCanvas.height;

    spriteCtx.clearRect(0, 0, W, H);

    // Background — the pet palette colour; every mode except plain covers it with sky
    spriteCtx.fillStyle = background;
    spriteCtx.fillRect(0, 0, W, H);

    // Sky, scenery, ground and weather (backgroundArt.js)
    if (window.backgroundArt && BG_STYLE === "legacy") {
      window.backgroundArt.drawLegacyBackground(spriteCtx, W, H, BG_MODE, new Date(), background);
    } else if (window.backgroundArt) {
      window.backgroundArt.drawBackground(spriteCtx, W, H, BG_MODE, new Date(),
                                          { opacity: BG_OPACITY, backdrop: background, animate: BG_ANIMATE });
    }

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
    var PS = POO_SCALE;
    var pW = POO_PIXELS[0].length * PS;
    var pH = POO_PIXELS.length    * PS;
    var pooGroundY = H - 12 - pH;
    var pooXPositions = [
      Math.round(W * 0.12),
      Math.round(W * 0.52),
      Math.round(W * 0.78),
    ];
    var numPoos = Math.min(state.poops || 0, 3);
    for (var pi = 0; pi < numPoos; pi++) {
      var pooX = pooXPositions[pi];
      // Light outline so the dark poo stands out on brown and green ground
      drawGridOutline(POO_PIXELS, pooX, pooGroundY, PS, "rgba(255,255,255,0.6)");
      POO_PIXELS.forEach(function (row, ry) {
        row.forEach(function (cell, rx) {
          if (!cell) { return; }
          spriteCtx.fillStyle = cell === 2 ? "#A0522D" : "#6B3A2A";
          spriteCtx.fillRect(pooX + rx * PS, pooGroundY + ry * PS, PS, PS);
        });
      });
    }

    // Gift box (or big tea mug for Tim)
    if (giftBoxX !== null) {
      var gbX = Math.round(giftBoxX);
      var _giftCc = (state && customCharBySpriteType) ? customCharBySpriteType(state.spriteType) : null;
      if (_giftCc && state.spriteType === "tim") {
        // Big tea mug for Tim — with a "T" on the body
        var BIG_MUG_PIXELS = [
          [0,2,0,2,0,0,0,0],
          [0,2,0,2,0,0,0,0],
          [1,1,1,1,1,1,0,0],
          [1,5,5,5,5,1,1,0],
          [1,3,5,5,3,1,1,0],
          [1,3,3,5,3,1,1,0],
          [1,3,3,5,3,1,1,0],
          [1,3,3,3,3,1,0,0],
          [1,1,1,1,1,1,0,0],
          [0,1,1,1,1,0,0,0],
        ];
        var BMS = 2;
        var bmH = BIG_MUG_PIXELS.length * BMS;
        var bmY = H - 12 - bmH;
        BIG_MUG_PIXELS.forEach(function (row, ry) {
          row.forEach(function (cell, rx) {
            if (!cell) { return; }
            // 1=dark brown body, 2=steam blue-white, 3=tea amber, 4=handle, 5=white T
            spriteCtx.fillStyle = cell === 2 ? "#C8E0FF"
                                : cell === 3 ? "#C49A6C"
                                : cell === 5 ? "#FFFFFF"
                                :              "#8B5E3C";
            spriteCtx.fillRect(gbX + rx * BMS, bmY + ry * BMS, BMS, BMS);
          });
        });
      } else {
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
        var gbY = H - 12 - gbH;
        drawGridOutline(GIFT_PIXELS, gbX, gbY, GS, "rgba(0,0,0,0.55)");
        GIFT_PIXELS.forEach(function (row, ry) {
          row.forEach(function (cell, rx) {
            if (!cell) { return; }
            spriteCtx.fillStyle = cell === 2 ? "#FFD600" : cell === 3 ? "#B71C1C" : "#E53935";
            spriteCtx.fillRect(gbX + rx * GS, gbY + ry * GS, GS, GS);
          });
        });
      }
    }

    // Snack items — tea mug (Tim), guinness/salmon (Stu) or candy/bone/cookie (others)
    if (snackItems.length > 0) {
      // Tea mug: 6 cols × 6 rows at scale 2 (12×12 px)
      // 1=dark brown body, 2=steam blue-white, 3=tea amber, 4=handle
      var TEA_MUG_PIXELS = [
        [0,2,0,2,0,0],
        [1,1,1,1,0,0],
        [1,3,3,1,4,0],
        [1,3,3,1,4,0],
        [1,3,3,1,0,0],
        [1,1,1,1,0,0],
      ];
      // Guinness pint: 6 cols × 8 rows at scale 2 (12×16 px)
      // 1=dark stout, 2=cream head, 3=glass/rim/G letter
      var GUINNESS_PIXELS = [
        [0,3,3,3,3,0],  // rim
        [0,2,3,3,0,0],  // cream + G top:  ##.
        [0,2,3,0,0,0],  // cream + G left: #..
        [0,2,3,3,3,0],  // cream + G bar:  ###
        [0,2,3,3,0,0],  // cream + G bot:  ##.
        [0,1,1,1,1,0],  // dark stout
        [0,1,1,1,1,0],  // dark stout
        [0,3,3,3,3,0],  // base
      ];
      // Smoked salmon: 6 cols × 4 rows at scale 2 (12×8 px)
      // 1=salmon flesh, 2=fat stripe, 3=dark edge
      var SALMON_PIXELS = [
        [3,3,3,3,3,3],
        [3,1,2,1,2,3],
        [3,2,1,2,1,3],
        [3,3,3,3,3,3],
      ];
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
      var COOKIE_PIXELS = [
        [0,1,1,1,0],
        [1,1,2,1,1],
        [1,2,1,1,1],
        [1,1,1,2,1],
        [0,1,1,1,0],
      ];
      var SS = SNACK_SCALE;
      snackItems.forEach(function (item) {
        var spx = item.type === "tea"      ? TEA_MUG_PIXELS
                : item.type === "guinness" ? GUINNESS_PIXELS
                : item.type === "salmon"   ? SALMON_PIXELS
                : item.type === "candy"    ? CANDY_PIXELS
                : item.type === "cookie"   ? COOKIE_PIXELS : BONE_PIXELS;
        var spH = spx.length * SS;
        var sY  = H - 12 - spH;
        var sX  = Math.round(item.x);
        // Dark outline so the snack stands out on any background
        drawGridOutline(spx, sX, sY, SS, "rgba(0,0,0,0.55)");
        spx.forEach(function (row, ry) {
          row.forEach(function (cell, rx) {
            if (!cell) { return; }
            if (item.type === "tea") {
              spriteCtx.fillStyle = cell === 2 ? "#C8E0FF"
                                  : cell === 3 ? "#C49A6C"
                                  : cell === 4 ? "#6B3A1F"
                                  :              "#8B5E3C";
            } else if (item.type === "guinness") {
              spriteCtx.fillStyle = cell === 1 ? "#0d0400"
                                  : cell === 2 ? "#ede0c4"
                                  :              "#8a8070";
            } else if (item.type === "salmon") {
              spriteCtx.fillStyle = cell === 1 ? "#e07050"
                                  : cell === 2 ? "#f0c8a0"
                                  :              "#a03020";
            } else if (item.type === "candy") {
              spriteCtx.fillStyle = cell === 2 ? "#FFE0E0" : "#FF6B9D";
            } else if (item.type === "cookie") {
              spriteCtx.fillStyle = cell === 2 ? "#4A2800" : "#D2961E";
            } else {
              spriteCtx.fillStyle = cell === 2 ? "#F5DEB3" : "#DEB887";
            }
            spriteCtx.fillRect(sX + rx * SS, sY + ry * SS, SS, SS);
          });
        });
      });
    }
  }

  /**
   * Draw the pet body at (x, bodyY).
   * Delegates to window.renderSpriteGrid() (defined in sprites.js, loaded first).
   *
   * @param {object}  state
   * @param {number}  x          - Left edge of body in canvas pixels
   * @param {number}  bodyY      - Top of body in canvas pixels
   * @param {boolean} facingLeft
   * @param {number}  legFrame   - 0 or 1
   */
  function drawBody(state, x, bodyY, facingLeft, legFrame) {
    window.renderSpriteGrid(
      spriteCtx, state, x, bodyY, facingLeft, legFrame, breathPhase,
      STAGE_SCALES, weightWidthMultiplier, getPalette, spriteHeightRatio,
      quadrupedBellySagRows
    );
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
   * @param {number}      [moodScaleY] - mood squash/stretch (1 = none); a reaction overrides it
   */
  function drawBodyWithReaction(state, x, bodyY, facingLeft, legFrame, reaction, nowMs, moodScaleY) {
    if (!reaction) {
      if (moodScaleY && moodScaleY !== 1) {
        // Squash/stretch anchored at the feet, widened slightly to keep the volume
        var mScale = STAGE_SCALES[state.stage] || 0.5;
        var mW     = effectiveBWidth(state, Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * mScale));
        var mH     = petBoxHeight(state, mW);
        var mCx    = x + mW / 2;
        var mFeet  = bodyY + mH;
        spriteCtx.save();
        spriteCtx.translate(mCx, mFeet);
        spriteCtx.scale(1 + (1 - moodScaleY) * 0.5, moodScaleY);
        spriteCtx.translate(-mCx, -mFeet);
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.restore();
      } else {
        drawBody(state, x, bodyY, facingLeft, legFrame);
      }
      return;
    }

    var t = Math.min(1, (nowMs - reaction.startMs) / reaction.durationMs);
    var palette   = getPalette(state.spriteType);
    var stageScale = STAGE_SCALES[state.stage] || 0.5;
    var bSize     = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * stageScale);
    var bWidth    = effectiveBWidth(state, bSize);
    var bHeight   = petBoxHeight(state, bWidth);
    var feetY     = bodyY + bHeight;              // canvas Y of the bottom of the feet

    switch (reaction.type) {

      case "fed_meal":
      case "fed_snack": {
        // Bob up then down: yOff = -|sin(t*π*bobs)|*10 — a meal lasts twice as
        // long as a snack, so it bobs twice at the same pace
        var bobs = reaction.type === "fed_meal" ? 2 : 1;
        var yOff = -Math.abs(Math.sin(t * Math.PI * bobs)) * 10;
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
        spriteCtx.fillRect(x, bodyY + yOff3, bWidth, bHeight);
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
        spriteCtx.fillRect(x, bodyY, bWidth, bHeight);
        spriteCtx.restore();
        break;
      }

      case "hatched": {
        // Baby grows out of the egg (pivot: feet) while two shell halves fly
        // apart and sparkles burst outwards
        var sc3 = 0.5 + t * 0.5;
        spriteCtx.save();
        spriteCtx.translate(x + bWidth / 2, feetY);
        spriteCtx.scale(sc3, sc3);
        spriteCtx.translate(-(x + bWidth / 2), -feetY);
        drawBody(state, x, bodyY, facingLeft, legFrame);
        spriteCtx.restore();

        var hcx    = x + bWidth / 2;
        var hcy    = feetY - bHeight * 0.3;
        var shellR = Math.max(4, bWidth * 0.3);
        var lift   = -Math.sin(t * Math.PI) * 20;
        spriteCtx.save();
        spriteCtx.globalAlpha = 1 - t;
        spriteCtx.fillStyle   = palette.primary;
        for (var side = -1; side <= 1; side += 2) {
          spriteCtx.save();
          spriteCtx.translate(hcx + side * t * 30, hcy + lift);
          spriteCtx.rotate(side * t * Math.PI / 2);
          spriteCtx.beginPath();
          // Left half is the left side of the egg, right half the right side
          spriteCtx.ellipse(0, 0, shellR, shellR * 1.3, 0,
            side < 0 ? Math.PI / 2 : -Math.PI / 2,
            side < 0 ? Math.PI * 1.5 : Math.PI / 2);
          spriteCtx.fill();
          spriteCtx.restore();
        }
        spriteCtx.fillStyle = "#FFD600";
        var sparkR = t * bWidth * 0.8;
        for (var sp = 0; sp < 8; sp++) {
          var ang = sp * Math.PI / 4;
          spriteCtx.fillRect(Math.round(hcx + Math.cos(ang) * sparkR) - 1,
                             Math.round(hcy + Math.sin(ang) * sparkR) - 1, 2, 2);
        }
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
        spriteCtx.fillRect(x, bodyY, bWidth, bHeight);
        spriteCtx.restore();
        break;
      }

      case "fell_asleep": {
        // Position handled by movement; just draw the body normally
        drawBody(state, x, bodyY, facingLeft, legFrame);
        break;
      }

      case "patted": {
        // Per-pet motion (window.spritePat), anchored at the feet, plus blush for the humans
        var pm   = window.spritePat.motion(state.spriteType, t);
        var pCx  = x + bWidth / 2 + pm.dx;
        var pFy  = feetY + pm.dy;
        var pPx  = Math.max(1, Math.round(bWidth / 16));
        spriteCtx.save();
        spriteCtx.translate(pCx, pFy);
        spriteCtx.rotate(pm.rot * (facingLeft ? -1 : 1));
        spriteCtx.scale(pm.sx, pm.sy);
        spriteCtx.translate(-(x + bWidth / 2), -feetY);
        drawBody(state, x, bodyY, facingLeft, legFrame);
        window.spritePat.drawBlush(spriteCtx, state.spriteType, t, { x: x, y: bodyY, w: bWidth, h: bHeight }, pPx);
        spriteCtx.restore();
        break;
      }

      case "died": {
        // Float up and fade out, with a halo above the head
        var yOff4 = -t * 40;
        spriteCtx.save();
        spriteCtx.globalAlpha = 1 - t;
        drawBody(state, x, bodyY + yOff4, facingLeft, legFrame);
        spriteCtx.strokeStyle = "#FFD600";
        spriteCtx.lineWidth   = 2;
        spriteCtx.beginPath();
        spriteCtx.ellipse(x + bWidth / 2, bodyY + yOff4 - 6, Math.max(4, bWidth * 0.25), 3, 0, 0, Math.PI * 2);
        spriteCtx.stroke();
        spriteCtx.restore();
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
    var bSize    = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * scale);
    var bWidth   = effectiveBWidth(state, bSize);
    var palette  = getPalette(state.spriteType);
    var secondary = palette.secondary;

    var indicatorX = x + Math.round(bWidth / 2) - 4;
    var indicatorY = bodyY - 3 - headGap(state);
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
    var bSize    = Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * scale);
    var bWidth   = effectiveBWidth(state, bSize);
    var bHeight  = petBoxHeight(state, bWidth);
    // For overweight quadrupeds (not upright, not snake), belly-sag rows add to the effective height.
    var _dsType = state.spriteType || "classic";
    var _dsUOS = (_dsType === "snake" || _dsType === "classic" || _dsType === "dragon" || _dsType === "tim" || _dsType === "stu");
    if (!_dsUOS && !window.spriteDrawsAsClassic(_dsType, state.stage)) {
      var sagCellH2 = Math.max(1, Math.round(bHeight / 32));
      bHeight += quadrupedBellySagRows(state.weight || 50) * sagCellH2;
    }
    var H        = spriteCanvas.height;
    var staticX  = Math.max(4, Math.floor(spriteCanvas.width / 2 - bWidth / 2));
    var staticY  = H - bHeight - 12;

    drawBody(state, staticX, staticY, false, 0);
    drawStatusIndicators(state, staticX, staticY);
    drawSpeechBubble(staticX + Math.round(bWidth / 2), staticY - headGap(state), performance.now());
  }

  // ── Static look-up tables ────────────────────────────────────────────────

  // ── Sprite constants — sourced from spriteConstants.js (loaded first) ───────
  // Values are defined in spriteConstants.js and exposed on window.*
  // to keep them in a single place shared with sprite_preview.html.
  var ANIMAL_PALETTES         = window.SPRITE_ANIMAL_PALETTES;
  var STAGE_SCALES            = window.SPRITE_STAGE_SCALES;

  /**
   * Return the height/width ratio for a given spriteType.
   * Delegates to spriteConstants.js.
   */
  function spriteHeightRatio(spriteType) {
    return window.spriteHeightRatio(spriteType);
  }

  /**
   * Return the realistic colour palette for a given spriteType.
   * Delegates to spriteConstants.js.
   */
  function getPalette(spriteType) {
    return window.spriteGetPalette(spriteType);
  }

  /**
   * Return the base-size multiplier driven by the codotchi.petSize setting.
   * The value is injected into document.body.dataset.petSize by sidebarProvider.ts.
    *   small  = 0.75x (extra small)
    *   medium = 1.0x  (default)
    *   large  = 1.5x  (high-detail 24x32 sprites)
    */
   function petSizeMultiplier(spriteType) {
     var ps = (document.body && document.body.dataset && document.body.dataset.petSize) || "medium";
     var isUp = !!(window.UPRIGHT_TYPES && window.UPRIGHT_TYPES[spriteType]);
     if (isUp) {
       return ps === "small" ? 0.5625 : ps === "large" ? 1.0 : 0.75;
     }
     if (spriteType === "cat" || spriteType === "dog") {
       return ps === "small" ? 0.64 : ps === "large" ? 1.28 : 0.85;
     }
     return ps === "small" ? 0.75 : ps === "large" ? 1.5 : 1.0;
   }

  /**
   * Return the width multiplier for the sprite based on weight.
   * Delegates to spriteConstants.js so thresholds are shared.
   * @param {number} weight
   * @returns {number}
   */
  function weightWidthMultiplier(weight) {
    return window.spriteWeightWidthMult(weight);
  }

  /**
   * Return the number of extra belly-sag rows for an overweight quadruped.
   * Delegates to spriteConstants.js so thresholds are shared.
   * @param {number} weight
   * @returns {number}
   */
  function quadrupedBellySagRows(weight) {
    return window.spriteQuadBellySag(weight);
  }

  /**
   * Return true if this sprite type uses width-stretching for overweight
   * (upright types + snake).  All other quadrupeds use belly-sag instead.
   * @param {string} spriteType
   * @returns {boolean}
   */
   function spriteUsesWidthStretch(spriteType) {
     // Width stretch is no longer applied; this function is kept for compatibility
     // but always returns false. Use spriteIsUpright() to check orientation.
     return false;
   }

   /**
    * Return the effective rendered width (in canvas px) for a given state and bodySize.
     * Weight no longer affects width.
    * @param {object} state
    * @param {number} bSize  — base body size
    * @returns {number}
    */
   function effectiveBWidth(state, bSize) {
     if (state && window.spriteDrawsAsClassic(state.spriteType, state.stage)) {
       return window.spriteClassicBox(state).w;   // the classic creature's own width, not a 32×48 grid
     }
     return Math.round(bSize);
  }

  /**
   * Return the rendered height (canvas px, before belly sag) for a pet of width bWidth.
   * The classic creature uses its real height, so nothing floats above its head.
   * @param {object} state
   * @param {number} bWidth — from effectiveBWidth
   * @returns {number}
   */
  function petBoxHeight(state, bWidth) {
    if (state && window.spriteDrawsAsClassic(state.spriteType, state.stage)) {
      return window.spriteClassicBox(state).h;
    }
    return Math.round(bWidth * spriteHeightRatio(state.spriteType || "classic"));
  }

  /**
   * Width used to size mood / pat props and particles: the grid width the pet
   * would have, so the narrow classic creature keeps normal-sized hearts and hand.
   */
  function petPropWidth(state) {
    return Math.round(BASE_SIZE * petSizeMultiplier(state.spriteType) * (STAGE_SCALES[state.stage] || 0.5));
  }

  /**
   * Small empty band (canvas px) kept between the top of every pet and the
   * status indicator / speech bubble above it — one mood prop-pixel, min 2px.
   * @param {object} state
   * @returns {number}
   */
  function headGap(state) {
    return Math.max(2, Math.round(petPropWidth(state) / 16));
  }

  // ── Initial view ─────────────────────────────────────────────────────────
  // Must be set BEFORE the message listener is registered so that any
  // bootstrap stateUpdate arriving immediately does not get dropped by the
  // currentScreen === "setup" guard in the handler below (BUGFIX-016).
  showScreen("game");

  // ── Message handler ──────────────────────────────────────────────────────

  window.addEventListener("message", function (event) {
    const message = event.data;
    if (!message) { return; }
    if (message.type === "showBubble") {
      showBubble(message.text, message.kind);
      return;
    }
    if (message.type === "leaderboard_submit_result") {
      if (!btnSubmitLB) { return; }
      if (message.status === "success") {
        btnSubmitLB.textContent = "Submitted ✓";
        btnSubmitLB.disabled = true;
        leaderboardSubmitted = true;
      } else if (message.status === "cancelled") {
        btnSubmitLB.disabled = false;
        btnSubmitLB.textContent = "Submit to Leaderboard";
      } else {
        btnSubmitLB.disabled = false;
        btnSubmitLB.textContent = "Try Again";
        if (leaderboardStatus) {
          leaderboardStatus.textContent = message.message || "Submission failed.";
          leaderboardStatus.classList.remove("hidden");
        }
      }
      return;
    }
    if (message.type === "leaderboard_sign_in_result") {
      lbSignInPending = false;
      if (message.username) {
        lbSignInError = null;
        if (lbSignInStatus) {
          lbSignInStatus.textContent = "Leaderboard: @" + message.username;
          lbSignInStatus.classList.remove("hidden");
        }
        if (btnSignInLeaderboard) btnSignInLeaderboard.classList.add("hidden");
      } else {
        lbSignInError = message.error || "Sign-in failed — try again";
        if (lbSignInStatus) {
          lbSignInStatus.textContent = lbSignInError;
          lbSignInStatus.classList.remove("hidden");
        }
        if (btnSignInLeaderboard) {
          btnSignInLeaderboard.textContent = "Retry GitHub sign-in";
          btnSignInLeaderboard.disabled = false;
          btnSignInLeaderboard.classList.remove("hidden");
        }
      }
      return;
    }
    if (message.type === "leaderboard_delete_result") {
      if (!btnDeleteLB) { return; }
      if (message.status === "success") {
        btnDeleteLB.textContent = "Deletion requested ✓";
        btnDeleteLB.disabled = true;
        if (lbDeleteStatus) {
          lbDeleteStatus.textContent = "Your entry will be removed shortly.";
          lbDeleteStatus.classList.remove("hidden");
        }
      } else if (message.status === "cancelled") {
        btnDeleteLB.disabled = false;
        btnDeleteLB.textContent = "Delete my entry";
      } else {
        btnDeleteLB.disabled = false;
        btnDeleteLB.textContent = "Delete my entry";
        if (lbDeleteStatus) {
          lbDeleteStatus.textContent = message.message || "Deletion request failed.";
          lbDeleteStatus.classList.remove("hidden");
        }
      }
      return;
    }
    if (message.type !== "stateUpdate") { return; }

    const state = message.state;

    currentCravingItem = message.cravingItem || null;

    if (message.highScore) { latestHighScore = message.highScore; }
    if (message.highScore === null) { latestHighScore = null; }

    // Track whether the host supports leaderboard submission
    if (message.leaderboardAvailable) { leaderboardAvailable = true; }
    leaderboardBlocked = message.leaderboardBlockedReason || null;

    // Update the setup screen default name whenever the host sends one.
    if (message.defaultPetName) {
      setupDefaultName = message.defaultPetName;
      if (petNameInput && petNameInput.value.toLowerCase() === "codotchi") {
        petNameInput.value = setupDefaultName;
      }
    }

    // Show/hide dev mode banner
    if (devModeBanner) {
      devModeBanner.classList.toggle("hidden", !message.devMode);
    }

    // Rank visible only when subscribed (opted in via push button).
    if (rankDisplay) {
      if (message.liveSubscribed && state && state.alive && message.liveRank != null) {
        rankDisplay.textContent = "Rank #" + message.liveRank + " of " + message.liveTotalScores + " on the leaderboard";
        rankDisplay.classList.remove("hidden");
      } else {
        rankDisplay.classList.add("hidden");
      }
    }

    if (btnViewLBLive) {
      if (state && state.alive) {
        btnViewLBLive.classList.remove("hidden");
      } else {
        btnViewLBLive.classList.add("hidden");
      }
    }

    // Sign-in status + button — shown when alive.
    if (state && state.alive) {
      if (message.leaderboardGithubUsername) { lbSignInError = null; }
      if (lbSignInStatus) {
        if (message.leaderboardGithubUsername) {
          lbSignInStatus.textContent = "Leaderboard: @" + message.leaderboardGithubUsername;
        } else if (lbSignInError) {
          lbSignInStatus.textContent = lbSignInError;
        } else if (message.leaderboardAuthExpired) {
          lbSignInStatus.textContent = "GitHub sign-in expired — leaderboard sync paused";
        } else {
          lbSignInStatus.textContent = "Not signed in to GitHub";
        }
        lbSignInStatus.classList.remove("hidden");
      }
      if (btnSignInLeaderboard) {
        if (message.leaderboardGithubUsername) {
          btnSignInLeaderboard.classList.add("hidden");
        } else if (!lbSignInPending) {
          btnSignInLeaderboard.textContent = lbSignInError
            ? "Retry GitHub sign-in"
            : message.leaderboardAuthExpired
              ? "Sign in to GitHub again"
              : "Sign in to GitHub (Leaderboard)";
          btnSignInLeaderboard.disabled = false;
          btnSignInLeaderboard.classList.remove("hidden");
        }
      }
    } else {
      if (lbSignInStatus) lbSignInStatus.classList.add("hidden");
      if (btnSignInLeaderboard) btnSignInLeaderboard.classList.add("hidden");
    }

    // Live subscribe button — always shown when alive.
    if (btnLiveSubscribe) {
      if (state && state.alive) {
        // Ineligible pets can't push live progress (unsubscribing is always allowed).
        // The reason is shown under the button too, so a disabled click never looks broken.
        var liveBlocked = leaderboardBlocked !== null && !message.liveSubscribed;
        btnLiveSubscribe.textContent = message.liveSubscribed
          ? "Unsubscribe live progress"
          : liveBlocked
            ? "Live progress unavailable"
            : "Push live progress";
        btnLiveSubscribe.disabled = liveBlocked;
        btnLiveSubscribe.title = leaderboardBlocked || "";
        btnLiveSubscribe.classList.remove("hidden");
      } else {
        btnLiveSubscribe.classList.add("hidden");
      }
    }

    // "Last synced" line — shown when subscribed and at least one push has happened.
    if (livePushStatus) {
      if (state && state.alive && leaderboardBlocked !== null && !message.liveSubscribed) {
        livePushStatus.textContent = leaderboardBlocked;
        livePushStatus.classList.remove("hidden");
      } else if (state && state.alive && message.liveSubscribed && message.liveLastPushedAt) {
        var diffMs = Date.now() - message.liveLastPushedAt;
        var diffMins = Math.floor(diffMs / 60000);
        var syncedText = diffMins < 1
          ? "Synced just now"
          : diffMins < 60
            ? "Synced " + diffMins + "m ago"
            : "Synced " + Math.floor(diffMins / 60) + "h ago";
        livePushStatus.textContent = syncedText;
        livePushStatus.classList.remove("hidden");
      } else {
        livePushStatus.classList.add("hidden");
      }
    }

    if (state && state.needs_new_game) {
      hasActiveGame = false;
      showScreen("setup");
      return;
    }

    if (state) {
      hasActiveGame = true;
      // Reset submission state when a new live pet arrives
      if (state.alive && !lastState) { leaderboardSubmitted = false; }
      else if (state.alive && lastState && !lastState.alive) { leaderboardSubmitted = false; }

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
  // Skipped entirely when codotchi.idleResetOnMouseMovement is disabled.
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

}());
