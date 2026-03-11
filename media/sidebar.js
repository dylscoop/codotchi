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

  const petNameDisplay = document.getElementById("pet-name-display");
  const moodLabel      = document.getElementById("mood-label");
  const infoLine       = document.getElementById("info-line");
  const eventLog       = document.getElementById("event-log");
  const deadStats      = document.getElementById("dead-stats");

  const barHunger    = document.getElementById("bar-hunger");
  const barHappiness = document.getElementById("bar-happiness");
  const barEnergy    = document.getElementById("bar-energy");
  const barHealth    = document.getElementById("bar-health");

  const spriteCanvas = document.getElementById("sprite-canvas");
  const spriteCtx    = spriteCanvas.getContext("2d");

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

  document.getElementById("btn-sleep").addEventListener("click", function () {
    vscode.postMessage({ command: "sleep" });
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

  // ── Screen management ────────────────────────────────────────────────────

  /**
   * Show one of "setup", "game", or "dead"; hide the others.
   * @param {"setup"|"game"|"dead"} name
   */
  function showScreen(name) {
    setupScreen.classList.toggle("hidden", name !== "setup");
    gameScreen.classList.toggle("hidden",  name !== "game");
    deadScreen.classList.toggle("hidden",  name !== "dead");
  }

  // ── State rendering ──────────────────────────────────────────────────────

  /**
   * Update every UI element from a PetState snapshot.
   * @param {object} state
   */
  function renderState(state) {
    if (!state.alive) {
      renderDeadScreen(state);
      showScreen("dead");
      return;
    }

    showScreen("game");

    petNameDisplay.textContent = state.name || "Gotchi";
    moodLabel.textContent      = moodText(state);

    setBar(barHunger,    state.hunger);
    setBar(barHappiness, state.happiness);
    setBar(barEnergy,    state.energy);
    setBar(barHealth,    state.health);

    const poopStr = state.poops === 1 ? "1 poop" : state.poops + " poops";
    infoLine.textContent =
      "Age: " + state.age_days + "d  |  " +
      state.stage + "  |  " +
      poopStr;

    appendEvents(state.events || []);
    drawSprite(state);
  }

  /**
   * Scale a stat bar to [0, 100].
   * @param {HTMLElement} bar
   * @param {number} value
   */
  function setBar(bar, value) {
    const clamped = Math.max(0, Math.min(100, value));
    bar.style.transform = "scaleX(" + (clamped / 100) + ")";
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
  function appendEvents(events) {
    if (!events.length) { return; }
    events.forEach(function (text) {
      const li = document.createElement("li");
      li.textContent = text;
      eventLog.insertBefore(li, eventLog.firstChild);
    });
    // Trim log to last 20 entries
    while (eventLog.children.length > 20) {
      eventLog.removeChild(eventLog.lastChild);
    }
  }

  /** Show the dead screen with final stats. */
  function renderDeadScreen(state) {
    deadStats.textContent =
      state.name + " lived " + state.age_days + " day(s).\n" +
      "Stage reached: " + state.stage + ".";
  }

  // ── Sprite drawing ───────────────────────────────────────────────────────

  /**
   * Draw a simple procedural pixel-art sprite on the canvas.
   *
   * No sprite files are bundled yet; this renders a coloured block
   * creature whose appearance varies by pet_type, stage, and mood.
   * When real sprite sheets are added, swap this function for an
   * Image-based draw.
   *
   * @param {object} state
   */
  function drawSprite(state) {
    const palette = COLOR_PALETTES[state.color] || COLOR_PALETTES["neon"];
    const primary    = palette.primary;
    const secondary  = palette.secondary;
    const background = palette.background;

    spriteCtx.clearRect(0, 0, 64, 64);

    // Background
    spriteCtx.fillStyle = background;
    spriteCtx.fillRect(0, 0, 64, 64);

    // Body — size grows with stage
    const stageScale = STAGE_SCALES[state.stage] || 0.5;
    const bodySize   = Math.round(24 * stageScale);
    const bodyX      = Math.round((64 - bodySize) / 2);
    const bodyY      = Math.round(32 - bodySize / 2);

    spriteCtx.fillStyle = primary;
    spriteCtx.fillRect(bodyX, bodyY, bodySize, bodySize);

    // Eyes
    const eyeSize = Math.max(2, Math.round(bodySize * 0.18));
    const eyeY    = bodyY + Math.round(bodySize * 0.25);
    const leftEyeX  = bodyX + Math.round(bodySize * 0.2);
    const rightEyeX = bodyX + Math.round(bodySize * 0.62);

    const eyeColor = state.sick ? "#ff0000" :
                     state.sleeping ? "#888888" : secondary;
    spriteCtx.fillStyle = eyeColor;
    spriteCtx.fillRect(leftEyeX,  eyeY, eyeSize, eyeSize);
    spriteCtx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

    // Mouth — changes with mood
    const mouthY = bodyY + Math.round(bodySize * 0.65);
    const mouthX = bodyX + Math.round(bodySize * 0.3);
    const mouthW = Math.round(bodySize * 0.4);

    spriteCtx.fillStyle = secondary;
    if (state.mood === "happy") {
      // Smile: draw two pixels at ends + one pixel higher in the middle
      spriteCtx.fillRect(mouthX,              mouthY,     2, 2);
      spriteCtx.fillRect(mouthX + mouthW - 2, mouthY,     2, 2);
      spriteCtx.fillRect(mouthX + 2,          mouthY + 2, mouthW - 4, 2);
    } else if (state.mood === "sad" || state.sick) {
      // Frown
      spriteCtx.fillRect(mouthX,              mouthY + 2, 2, 2);
      spriteCtx.fillRect(mouthX + mouthW - 2, mouthY + 2, 2, 2);
      spriteCtx.fillRect(mouthX + 2,          mouthY,     mouthW - 4, 2);
    } else {
      // Flat line
      spriteCtx.fillRect(mouthX, mouthY + 1, mouthW, 2);
    }

    // Sleeping Zzz indicator
    if (state.sleeping) {
      spriteCtx.fillStyle = secondary;
      spriteCtx.font = "bold 10px monospace";
      spriteCtx.fillText("z", bodyX + bodySize + 2, bodyY - 2);
    }

    // Sick cross indicator
    if (state.sick && !state.sleeping) {
      spriteCtx.fillStyle = "#ff4444";
      spriteCtx.font = "bold 10px monospace";
      spriteCtx.fillText("+", bodyX + bodySize + 2, bodyY - 2);
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

    // needs_new_game response: stay on / return to setup
    if (state && state.needs_new_game) {
      showScreen("setup");
      return;
    }

    if (state) {
      renderState(state);
    }
  });

  // ── Initial view ─────────────────────────────────────────────────────────
  // Show setup by default; extension host will post state if one exists.
  showScreen("setup");

}());
