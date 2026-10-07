/**
 * minigameArt.js - pixel-art drawing for the sidebar mini-games
 *
 * Doors (Left / Right), the number card (Higher or Lower), the coin (Coin
 * Flip), playing cards (Stu's Blackjack), a countdown and a small bitmap font. Everything is drawn with
 * fillRect on a whole-pixel unit, the same style as the mood layer in
 * sprites.js. No DOM access and no CSS variables (canvas ignores them), so
 * the functions can be unit-tested against a mock context.
 *
 * Exposes window.minigameArt. Loaded before sidebar.js in VS Code and
 * inlined by CodotchiBrowserPanel.kt in PyCharm.
 */
(function () {
  "use strict";

  // =========================================================================
  // Palette
  // =========================================================================

  var C = {
    outline:   "#2b1a0e",
    wood:      "#a0662a",
    woodDark:  "#7a4a1c",
    woodLight: "#c8843c",
    brass:     "#e8c547",
    brassDark: "#8a6d1a",
    room:      "#1a1a2e",
    roomFloor: "#2e2e4a",
    cream:     "#fff4a3",
    shadow:    "#2b1a0e",
    card:      "#f2efe6",
    cardEdge:  "#5a5a6e",
    ink:       "#2b2b3a",
    good:      "#4caf50",
    bad:       "#e05252",
    gold:      "#e8c547",
    goldLight: "#fff1a0",
    goldDark:  "#a07a1a",
    eye:       "#1a1a1a",
    cardBack:  "#2f5fa8",
    cardBackHi:"#5b8bd6",
  };

  // =========================================================================
  // Bitmap font — 3×5 glyphs ("1" = ink), plus 5×5 symbols
  // =========================================================================

  var GLYPHS = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"],
    "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "111"],
    "?": ["111", "001", "011", "000", "010"],
    "!": ["010", "010", "010", "000", "010"],
    "E": ["111", "100", "110", "100", "111"],
    "F": ["111", "100", "110", "100", "100"],
    "G": ["111", "100", "101", "101", "111"],
    "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"],
    "L": ["100", "100", "100", "100", "111"],
    "R": ["110", "101", "110", "101", "101"],
    "T": ["111", "010", "010", "010", "010"],
    "A": ["010", "101", "111", "101", "101"],
    "J": ["001", "001", "001", "101", "111"],
    "Q": ["010", "101", "101", "110", "011"],
    "K": ["101", "101", "110", "101", "101"],
    " ": ["000", "000", "000", "000", "000"],
    "✓": ["00001", "00011", "10110", "11100", "01000"],   // ✓
    "✗": ["10001", "01010", "00100", "01010", "10001"],   // ✗
    "^":      ["00100", "01110", "11111", "01110", "01110"],   // up arrow
    "v":      ["01110", "01110", "11111", "01110", "00100"],   // down arrow
    "♥": ["01010", "11111", "11111", "01110", "00100"],
    "♦": ["00100", "01110", "11111", "01110", "00100"],
    "♠": ["00100", "01110", "11111", "11111", "00100"],
    "♣": ["01110", "01110", "11111", "11111", "00100"],
  };

  var GLYPH_H = 5;

  function glyphFor(ch) { return GLYPHS[ch] || GLYPHS["?"]; }

  /** Width in canvas pixels of str drawn at pixel size px (1-column gap). */
  function textWidth(str, px) {
    var cols = 0;
    for (var i = 0; i < str.length; i++) {
      cols += glyphFor(str[i])[0].length + (i > 0 ? 1 : 0);
    }
    return cols * px;
  }

  /** Draw str with its top-left at (x, y). Returns the drawn width. */
  function drawText(ctx, str, x, y, px, colour) {
    ctx.fillStyle = colour;
    var cx = x;
    for (var i = 0; i < str.length; i++) {
      var g = glyphFor(str[i]);
      for (var r = 0; r < g.length; r++) {
        for (var c = 0; c < g[r].length; c++) {
          if (g[r][c] === "1") { ctx.fillRect(cx + c * px, y + r * px, px, px); }
        }
      }
      cx += (g[0].length + 1) * px;
    }
    return cx - x - px;
  }

  /** drawText with a dark one-pixel outline and drop shadow, readable on light and dark themes. */
  function drawTextShadow(ctx, str, x, y, px, colour) {
    var offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]];
    for (var i = 0; i < offsets.length; i++) {
      drawText(ctx, str, x + offsets[i][0] * px, y + offsets[i][1] * px, px, C.shadow);
    }
    return drawText(ctx, str, x, y, px, colour);
  }

  /** Centre str horizontally on cx. */
  function drawTextCentred(ctx, str, cx, y, px, colour, shadow) {
    var x = Math.round(cx - textWidth(str, px) / 2);
    return shadow ? drawTextShadow(ctx, str, x, y, px, colour)
                  : drawText(ctx, str, x, y, px, colour);
  }

  // =========================================================================
  // Doors (Left / Right)
  // =========================================================================

  var DOOR_COLS = 12;
  var DOOR_ROWS = 20;

  var FACE = [
    "00111100",
    "01111110",
    "11311311",
    "11111111",
    "12311321",
    "11133111",
    "01111110",
    "00111100",
  ];

  /** Pixel unit for a door that fits inside w × h. */
  function doorPx(w, h) {
    return Math.max(1, Math.floor(Math.min(w / DOOR_COLS, h / DOOR_ROWS)));
  }

  function drawFace(ctx, x, y, px, palette) {
    var colours = { "1": palette.primary, "2": palette.secondary || palette.primary, "3": C.eye };
    for (var r = 0; r < FACE.length; r++) {
      for (var c = 0; c < FACE[r].length; c++) {
        var k = FACE[r][c];
        if (k === "0") { continue; }
        ctx.fillStyle = colours[k];
        ctx.fillRect(x + c * px, y + r * px, px, px);
      }
    }
  }

  /**
   * One door. box = {x, y, w, h}; the door is DOOR_COLS × DOOR_ROWS pixels,
   * bottom-centred in box.
   * opts.state:   "closed" | "ajar" | "open"
   * opts.hinge:   "left" | "right" (the side the door swings towards)
   * opts.palette: {primary, secondary} — when set, the pet's face shows in an open door
   * opts.dim:     draw faded (the door that was not the answer)
   * Returns the door rectangle actually drawn.
   */
  function drawDoor(ctx, box, opts) {
    var px = doorPx(box.w, box.h);
    var dw = DOOR_COLS * px;
    var dh = DOOR_ROWS * px;
    var x = box.x + Math.round((box.w - dw) / 2);
    var y = box.y + box.h - dh;
    var state = opts.state || "closed";
    var hingeLeft = opts.hinge !== "right";

    ctx.save();
    if (opts.dim) { ctx.globalAlpha = 0.4; }

    // Frame
    ctx.fillStyle = C.outline;
    ctx.fillRect(x, y, dw, dh);

    var ix = x + px, iy = y + px, iw = dw - 2 * px, ih = dh - px;

    if (state !== "closed") {
      // Dark room behind the doorway, with a floor strip
      ctx.fillStyle = C.room;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.fillStyle = C.roomFloor;
      ctx.fillRect(ix, iy + ih - 3 * px, iw, 3 * px);
      if (state === "open" && opts.palette) {
        var fx = ix + Math.round((iw - FACE[0].length * px) / 2);
        var fy = iy + ih - 3 * px - FACE.length * px;
        drawFace(ctx, fx, fy, px, opts.palette);
      }
    }

    // Door panel: full width when closed, half when ajar, a thin edge when open
    var pw = state === "closed" ? iw : state === "ajar" ? Math.round(iw / 2) : 2 * px;
    var panelX = hingeLeft ? ix : ix + iw - pw;
    ctx.fillStyle = C.wood;
    ctx.fillRect(panelX, iy, pw, ih);
    ctx.fillStyle = C.woodLight;
    ctx.fillRect(panelX, iy, pw, px);
    if (state === "closed") {
      // Plank lines
      ctx.fillStyle = C.woodDark;
      var third = Math.round(iw / (3 * px)) * px;
      ctx.fillRect(ix + third, iy + px, px, ih - px);
      ctx.fillRect(ix + 2 * third, iy + px, px, ih - px);
      // Knob on the side away from the hinge
      var kx = hingeLeft ? ix + iw - 3 * px : ix + px;
      var ky = iy + Math.round(ih / 2);
      ctx.fillStyle = C.brass;
      ctx.fillRect(kx, ky, 2 * px, 2 * px);
      ctx.fillStyle = C.brassDark;
      ctx.fillRect(kx, ky + 2 * px, 2 * px, px);
      // Question mark
      drawTextCentred(ctx, "?", x + dw / 2, iy + 3 * px, px, C.cream, true);
    } else {
      ctx.fillStyle = C.woodDark;
      ctx.fillRect(hingeLeft ? panelX + pw - px : panelX, iy, px, ih);
    }

    ctx.restore();
    return { x: x, y: y, w: dw, h: dh, px: px };
  }

  /**
   * Both doors plus their labels. W × H is the canvas size.
   * reveal: null while guessing, else {petSide, choice, won, open}
   *   open: "ajar" | "open" (the reveal frame)
   * palette: pet palette for the face behind the door.
   */
  function drawDoors(ctx, W, H, reveal, palette) {
    var gap = Math.floor(W * 0.05);
    var dw = Math.floor(W * 0.30);
    var top = Math.floor(H * 0.20);
    var labelRoom = Math.max(10, Math.floor(H * 0.10));
    var dh = H - top - labelRoom;
    var startX = Math.floor((W - (dw * 2 + gap)) / 2);
    var sides = ["left", "right"];
    var drawn = [];
    for (var i = 0; i < 2; i++) {
      var side = sides[i];
      var isPet = reveal && side === reveal.petSide;
      drawn.push(drawDoor(ctx, { x: startX + i * (dw + gap), y: top, w: dw, h: dh }, {
        state:   isPet ? reveal.open : "closed",
        hinge:   side === "left" ? "left" : "right",
        palette: palette,
        dim:     !!reveal && !isPet,
      }));
    }
    var labelPx = Math.max(1, Math.floor(drawn[0].px / 2));
    for (var j = 0; j < 2; j++) {
      var d = drawn[j];
      var colour = C.cream;
      if (reveal && reveal.choice === sides[j]) { colour = reveal.won ? C.good : C.bad; }
      drawTextCentred(ctx, sides[j].toUpperCase(), d.x + d.w / 2, d.y + d.h + labelPx * 2,
        labelPx, colour, true);
    }
    return drawn;
  }

  /**
   * Countdown digit (or ✓ / ✗) centred at the top of the canvas.
   * value: number of seconds, or "✓" / "✗".
   */
  function drawCountdown(ctx, W, H, value) {
    var px = Math.max(1, Math.floor(H * 0.14 / GLYPH_H));
    var str = String(value);
    var colour = str === "✓" ? C.good : str === "✗" ? C.bad : C.cream;
    drawTextCentred(ctx, str, W / 2, Math.max(1, Math.floor(H * 0.03)), px, colour, true);
    return px;
  }

  // =========================================================================
  // Number card (Higher or Lower)
  // =========================================================================

  /**
   * Scoreboard card centred horizontally near the top of a W × H canvas.
   * flash: null, or {correct: bool, dir: "up" | "down"} after a guess.
   * Returns the card rectangle.
   */
  function drawNumberCard(ctx, W, H, n, flash) {
    var px = Math.max(2, Math.floor(H / 45));
    var str = String(n);
    var tw = textWidth("100", px * 2);          // fixed width so the card doesn't jump
    var cw = tw + 6 * px;
    var ch = GLYPH_H * px * 2 + 6 * px;
    var x = Math.round((W - cw) / 2);
    var y = Math.max(px, Math.floor(H * 0.04));
    var edge = !flash ? C.cardEdge : flash.correct ? C.good : C.bad;

    ctx.save();
    // Drop shadow, edge, face
    ctx.fillStyle = C.shadow;
    ctx.fillRect(x + px, y + px, cw, ch);
    ctx.fillStyle = edge;
    ctx.fillRect(x, y, cw, ch);
    ctx.fillStyle = C.card;
    ctx.fillRect(x + px, y + px, cw - 2 * px, ch - 2 * px);
    // Corner notches for a tile look
    ctx.fillStyle = edge;
    ctx.fillRect(x + px, y + px, px, px);
    ctx.fillRect(x + cw - 2 * px, y + px, px, px);
    ctx.fillRect(x + px, y + ch - 2 * px, px, px);
    ctx.fillRect(x + cw - 2 * px, y + ch - 2 * px, px, px);
    drawTextCentred(ctx, str, x + cw / 2, y + 3 * px, px * 2, C.ink, false);

    if (flash) {
      // Left: arrow for the way the number actually went. Right: ✓ / ✗.
      var sy = y + Math.round((ch - GLYPH_H * px) / 2);
      var arrow = flash.dir === "up" ? "^" : "v";
      var mark = flash.correct ? "✓" : "✗";
      var markColour = flash.correct ? C.good : C.bad;
      drawTextShadow(ctx, arrow, x - textWidth(arrow, px) - 2 * px, sy, px, C.cream);
      drawTextShadow(ctx, mark, x + cw + 2 * px, sy, px, markColour);
    }
    ctx.restore();
    return { x: x, y: y, w: cw, h: ch, px: px };
  }

  // =========================================================================
  // Coin (Coin Flip)
  // =========================================================================

  var COIN_SIZE = 11;
  // Width of the coin face (in coin pixels) for each spin frame.
  var COIN_WIDTHS = [11, 7, 3, 1, 3, 7];
  var COIN_FRAME_MS = 60;

  var CROWN = [
    "10101",
    "11111",
    "11111",
  ];

  /**
   * Frame indices for a spin of durationMs, ending on frame 0 (face-on).
   */
  function coinFrames(durationMs) {
    var n = Math.max(1, Math.round(durationMs / COIN_FRAME_MS));
    var frames = [];
    for (var i = 0; i < n; i++) { frames.push(i % COIN_WIDTHS.length); }
    frames.push(0);
    return frames;
  }

  /**
   * Coin centred on (cx, cy). frame indexes COIN_WIDTHS; face is "heads" or
   * "tails" and only shows on face-on frames (width ≥ 7).
   */
  function drawCoin(ctx, cx, cy, px, frame, face) {
    var fw = COIN_WIDTHS[((frame % COIN_WIDTHS.length) + COIN_WIDTHS.length) % COIN_WIDTHS.length];
    var size = COIN_SIZE;
    var x0 = Math.round(cx - (fw * px) / 2);
    var y0 = Math.round(cy - (size * px) / 2);
    ctx.save();
    // Circle approximated per row: full rows in the middle, inset at the ends
    for (var r = 0; r < size; r++) {
      var inset = r === 0 || r === size - 1 ? 3 : r === 1 || r === size - 2 ? 1 : 0;
      var rowInset = Math.round(inset * fw / size);
      var rw = fw - rowInset * 2;
      if (rw <= 0) { continue; }
      var rx = x0 + rowInset * px;
      ctx.fillStyle = C.goldDark;
      ctx.fillRect(rx, y0 + r * px, rw * px, px);
      if (rw > 2 && r > 0 && r < size - 1) {
        ctx.fillStyle = r < size / 2 ? C.goldLight : C.gold;
        ctx.fillRect(rx + px, y0 + r * px, (rw - 2) * px, px);
      }
    }
    if (fw >= 7) {
      var faceX = Math.round(cx - 2.5 * px);
      if (face === "heads") {
        ctx.fillStyle = C.goldDark;
        for (var cr = 0; cr < CROWN.length; cr++) {
          for (var cc = 0; cc < CROWN[cr].length; cc++) {
            if (CROWN[cr][cc] === "1") {
              ctx.fillRect(faceX + cc * px, y0 + (4 + cr) * px, px, px);
            }
          }
        }
      } else if (face === "tails") {
        drawText(ctx, "T", Math.round(cx - 1.5 * px), y0 + 3 * px, px, C.goldDark);
      }
    }
    ctx.restore();
    return { x: x0, y: y0, w: fw * px, h: size * px };
  }

  /** Pixel unit for the coin on a canvas of height H. */
  function coinPx(H) { return Math.max(2, Math.floor(H / 40)); }

  // =========================================================================
  // Playing cards (Blackjack — replaces Coin Flip for Stu)
  // =========================================================================

  var CARD_W = 11;
  var CARD_H = 15;

  /** Blackjack value of a hand of {rank, suit} cards; aces count 11 unless that busts. */
  function blackjackTotal(cards) {
    var total = 0, aces = 0;
    for (var i = 0; i < cards.length; i++) {
      var r = cards[i].rank;
      if (r === "A") { total += 11; aces++; }
      else if (r === "J" || r === "Q" || r === "K") { total += 10; }
      else { total += parseInt(r, 10); }
    }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  /** "win" | "lose" | "push" for the player against the dealer, once both hands are final. */
  function blackjackOutcome(player, dealer) {
    var p = blackjackTotal(player), d = blackjackTotal(dealer);
    if (p > 21) { return "lose"; }
    if (d > 21) { return "win"; }
    var pNatural = p === 21 && player.length === 2, dNatural = d === 21 && dealer.length === 2;
    if (pNatural !== dNatural) { return pNatural ? "win" : "lose"; }
    return p > d ? "win" : p < d ? "lose" : "push";
  }

  /** Pixel unit for the blackjack table on a canvas of height H (two rows of cards). */
  function cardPx(H) { return Math.max(1, Math.floor(H / 52)); }

  /**
   * One card with its top-left at (x, y). card = {rank, suit}; faceDown draws
   * the back. Hearts and diamonds are red, spades and clubs ink.
   */
  function drawPlayingCard(ctx, x, y, px, card, faceDown) {
    ctx.save();
    ctx.fillStyle = C.shadow;
    ctx.fillRect(x + px, y + px, CARD_W * px, CARD_H * px);
    ctx.fillStyle = C.cardEdge;
    ctx.fillRect(x, y, CARD_W * px, CARD_H * px);
    if (faceDown) {
      ctx.fillStyle = C.cardBack;
      ctx.fillRect(x + px, y + px, (CARD_W - 2) * px, (CARD_H - 2) * px);
      ctx.fillStyle = C.cardBackHi;                       // diagonal lattice
      for (var r = 2; r < CARD_H - 2; r++) {
        for (var c = 2; c < CARD_W - 2; c++) {
          if ((r + c) % 3 === 0) { ctx.fillRect(x + c * px, y + r * px, px, px); }
        }
      }
    } else {
      ctx.fillStyle = C.card;
      ctx.fillRect(x + px, y + px, (CARD_W - 2) * px, (CARD_H - 2) * px);
      var ink = card.suit === "♥" || card.suit === "♦" ? C.bad : C.ink;
      drawText(ctx, card.rank, x + 2 * px, y + 2 * px, px, ink);
      drawText(ctx, card.suit, x + 3 * px, y + 8 * px, px, ink);
    }
    ctx.restore();
    return { x: x, y: y, w: CARD_W * px, h: CARD_H * px };
  }

  /**
   * Dealer's hand on top, the player's below, centred on a W × H canvas, each
   * row labelled with its total. hideHole keeps the dealer's second card face
   * down (and its total as "?").
   */
  function drawBlackjackTable(ctx, W, H, dealer, player, hideHole) {
    var px = cardPx(H);
    var gap = 3 * px;
    var rows = [
      { cards: dealer, hide: hideHole, y: Math.max(px, Math.floor(H * 0.03)) },
      { cards: player, hide: false,    y: Math.max(px, Math.floor(H * 0.03)) + CARD_H * px + gap },
    ];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var n = Math.max(1, row.cards.length);
      // Cards overlap when the hand gets long, so up to ~6 cards fit
      var step = Math.min((CARD_W + 1) * px, Math.floor((W * 0.6 - CARD_W * px) / Math.max(1, n - 1)));
      var rowW = CARD_W * px + step * (n - 1);
      var x0 = Math.round((W - rowW) / 2);
      for (var k = 0; k < row.cards.length; k++) {
        drawPlayingCard(ctx, x0 + k * step, row.y, px, row.cards[k], row.hide && k === 1);
      }
      var label = row.hide ? "?" : String(blackjackTotal(row.cards));
      drawTextShadow(ctx, label, x0 + rowW + 3 * px, row.y + Math.round((CARD_H - GLYPH_H) * px / 2), px, C.cream);
    }
    return { px: px };
  }

  // =========================================================================
  // Exports
  // =========================================================================

  window.minigameArt = {
    COLOURS:        C,
    GLYPHS:         GLYPHS,
    COIN_SIZE:      COIN_SIZE,
    COIN_WIDTHS:    COIN_WIDTHS,
    COIN_FRAME_MS:  COIN_FRAME_MS,
    textWidth:      textWidth,
    drawText:       drawText,
    drawDoor:       drawDoor,
    drawDoors:      drawDoors,
    drawCountdown:  drawCountdown,
    drawNumberCard: drawNumberCard,
    coinFrames:     coinFrames,
    coinPx:         coinPx,
    drawCoin:       drawCoin,
    CARD_W:         CARD_W,
    CARD_H:         CARD_H,
    cardPx:         cardPx,
    blackjackTotal:   blackjackTotal,
    blackjackOutcome: blackjackOutcome,
    drawPlayingCard:    drawPlayingCard,
    drawBlackjackTable: drawBlackjackTable,
  };
}());
