/* global window, document, Image */
(function () {
  "use strict";

  var MANIFEST = window.__GOTCHI_SPRITE_MANIFEST || {};
  var SPRITES = {};
  var READY = false;
  var STARTED = false;
  var READY_CALLBACKS = [];
  var DEFAULT_RENDER_SIZE = 160;
  var tempCanvas = document.createElement("canvas");
  var tempCtx = tempCanvas.getContext("2d");

  function flushReadyCallbacks() {
    READY = true;
    while (READY_CALLBACKS.length > 0) {
      var cb = READY_CALLBACKS.shift();
      try {
        cb();
      } catch (_) {
        // Keep the sprite loader resilient; rendering can continue without one callback.
      }
    }
  }

  function loadGotchiSprites(onReady) {
    if (typeof onReady === "function") {
      if (READY) {
        onReady();
      } else {
        READY_CALLBACKS.push(onReady);
      }
    }

    if (STARTED) {
      return;
    }

    STARTED = true;
    var keys = Object.keys(MANIFEST);
    if (keys.length === 0) {
      flushReadyCallbacks();
      return;
    }

    var remaining = keys.length;
    function markDone() {
      remaining -= 1;
      if (remaining <= 0) {
        flushReadyCallbacks();
      }
    }

    keys.forEach(function (fileName) {
      var img = new Image();
      img.onload = markDone;
      img.onerror = markDone;
      img.src = MANIFEST[fileName];
      SPRITES[fileName] = img;
    });
  }

  function darkenHex(hex, factor) {
    var h = (hex || "#000000").replace("#", "");
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var r = Math.round(parseInt(h.substring(0, 2), 16) * factor);
    var g = Math.round(parseInt(h.substring(2, 4), 16) * factor);
    var b = Math.round(parseInt(h.substring(4, 6), 16) * factor);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function getSpriteFileName(state, animState) {
    var stage = state.stage || "baby";
    if (stage === "egg") {
      return "egg.gif";
    }

    var spriteType = state.spriteType || "classic";
    var desiredState = animState || "idle";
    var exact = spriteType + "_" + stage + "_" + desiredState + ".gif";
    var fallbackState = spriteType + "_" + stage + "_idle.gif";
    var classicState = "classic_" + stage + "_" + desiredState + ".gif";
    var classicIdle = "classic_" + stage + "_idle.gif";

    return SPRITES[exact] ? exact
      : SPRITES[fallbackState] ? fallbackState
      : SPRITES[classicState] ? classicState
      : classicIdle;
  }

  function getBaseRenderSize() {
    if (typeof window !== "undefined" && typeof window.GOTCHI_BASE_RENDER_SIZE === "number") {
      return window.GOTCHI_BASE_RENDER_SIZE;
    }
    return DEFAULT_RENDER_SIZE;
  }

  function tintSprite(targetCtx, bodyWidth, bodyHeight, state, getPalette) {
    if (!getPalette) {
      return;
    }

    var palette = getPalette(state.color);
    var primary = (palette && palette.primary) || "#ff8c00";
    var secondary = (palette && palette.secondary) || "#ffffff";
    var accent = darkenHex(primary, 0.72);

    tempCtx.save();
    tempCtx.globalCompositeOperation = "source-atop";
    tempCtx.fillStyle = primary;
    tempCtx.globalAlpha = 0.18;
    tempCtx.fillRect(0, 0, bodyWidth, bodyHeight);

    tempCtx.fillStyle = accent;
    tempCtx.globalAlpha = 0.10;
    tempCtx.fillRect(0, bodyHeight * 0.45, bodyWidth, bodyHeight * 0.55);

    tempCtx.fillStyle = secondary;
    tempCtx.globalAlpha = 0.07;
    tempCtx.fillRect(bodyWidth * 0.15, bodyHeight * 0.15, bodyWidth * 0.40, bodyHeight * 0.25);

    if (state.sick) {
      tempCtx.fillStyle = "#ff4444";
      tempCtx.globalAlpha = 0.22;
      tempCtx.fillRect(0, 0, bodyWidth, bodyHeight);
    }

    if (state.sleeping) {
      tempCtx.fillStyle = "#777777";
      tempCtx.globalAlpha = 0.16;
      tempCtx.fillRect(0, 0, bodyWidth, bodyHeight);
    }
    tempCtx.restore();
  }

  function renderSpriteGrid(ctx, state, x, bodyY, facingLeft, animState,
                            STAGE_SCALES, STAGE_BODY_HEIGHT_MULTS, weightWidthMultiplier, getPalette) {
    loadGotchiSprites();

    var stage = state.stage || "baby";
    var stageScale = STAGE_SCALES[stage] || 1.0;
    var petSizeVal = (typeof document !== "undefined" && document.body && document.body.dataset)
      ? (document.body.dataset.petSize || "medium")
      : "medium";
    var sizeMultiplier = petSizeVal === "small" ? 0.85 : petSizeVal === "large" ? 1.2 : 1.0;
    var baseSize = getBaseRenderSize();
    var bodySize = Math.round(baseSize * sizeMultiplier * stageScale);
    var bodyWidth = Math.round(bodySize * weightWidthMultiplier((state && state.weight) || 50));
    var bodyHeight = Math.round(bodySize * (STAGE_BODY_HEIGHT_MULTS[stage] || 1.0));

    var fileName = getSpriteFileName(state, animState);
    var image = SPRITES[fileName];
    if (!image || !image.complete) {
      return;
    }

    tempCanvas.width = Math.max(1, bodyWidth);
    tempCanvas.height = Math.max(1, bodyHeight);
    tempCtx.clearRect(0, 0, bodyWidth, bodyHeight);
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.drawImage(image, 0, 0, bodyWidth, bodyHeight);
    tintSprite(tempCtx, bodyWidth, bodyHeight, state, getPalette);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (facingLeft) {
      ctx.translate(x + bodyWidth, 0);
      ctx.scale(-1, 1);
      ctx.translate(-x, 0);
    }
    ctx.drawImage(tempCanvas, x, bodyY, bodyWidth, bodyHeight);
    ctx.restore();
  }

  window.SPRITES = SPRITES;
  window.loadGotchiSprites = loadGotchiSprites;
  window.areGotchiSpritesReady = function () {
    return READY;
  };
  window.renderSpriteGrid = renderSpriteGrid;

  loadGotchiSprites();
}());
