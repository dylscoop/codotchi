/**
 * customCharacters.js — registry of hidden/unlockable custom characters.
 *
 * To add a new custom character:
 *   1. Add DEFS["<spriteType>"] to sprites.js (and pycharm mirror).
 *   2. Add a palette entry to spriteConstants.js (and pycharm mirror).
 *   3. Add "<spriteType>" to UPRIGHT_TYPES in sprites.js if it uses a 32×48 grid.
 *   4. Add an entry to CUSTOM_CHARACTERS below — no other file changes needed.
 *
 * Exposes on `window`:
 *   CUSTOM_CHARACTERS       — object keyed by spriteType
 *   customCharByPasscode(p) — returns the character entry for passcode p, or null
 *   customCharBySpriteType(s) — returns the character entry for spriteType s, or null
 */
(function () {
  "use strict";

  /**
   * Registry of custom characters, keyed by spriteType.
   *
   * Each entry shape:
   *   passcode      {string}   — exact string the user must enter in settings
   *   defaultName   {string}   — default name pre-filled on setup screen; for Tim, overrides "Codotchi" (case-insensitive)
   *   patLabel      {string}   — label for the Pat button in the minigame overlay
   *   mgTitle       {string}   — minigame overlay title (replaces "Play or Pat")
   *   giftMessage   {string}   — attention_call_gift toast message (optional)
   *   patToasts     {object}   — toast strings keyed by event name:
   *     patted        {string}  — shown when pat succeeds
   *     pat_refused   {string}  — shown when not enough energy
   *   patBubbles    {string[]} — speech bubbles shown at random after a successful pat
   */
  var CUSTOM_CHARACTERS = {
    tim: {
      passcode:     "teawtim",
      defaultName:  "Timagotchi",
      patLabel:     "Go for a Run",
      mgTitle:      "Play or Go for a Run",
      giftMessage:  "Tim wants a tea break!",
      patToasts: {
        patted:      "Tim went for a run!",
        pat_refused: "Tim doesn't have enough energy for a run!",
      },
      patBubbles: [
        "That was a great run!",
        "5K done. Now where's my tea?",
        "Legs are burning but the mind is clear.",
        "That counts as cardio.",
      ],
    },
    kangaroo: {
      passcode:     "straya",
      defaultName:  "Kangagotchi",
      patLabel:     "Bounce",
      mgTitle:      "Play or Bounce",
      giftMessage:  "Kangagotchi found a souvenir!",
      patToasts: {
        patted:      "Kangagotchi had a bounce!",
        pat_refused: "Kangagotchi is too tired to bounce!",
      },
      patBubbles: [
        "Straight from the pixel bush.",
        "Pouch secured.",
        "Big tail, bigger hops.",
        "That's proper straya.",
      ],
    },
    testsprite: {
      passcode:     "pixel",
      defaultName:  "Pixel",
      patLabel:     "Pat",
      mgTitle:      "Play or Pat",
      patToasts: {
        patted:      "Pixel enjoyed the attention!",
        pat_refused: "Pixel is too tired for that right now!",
      },
      patBubbles: [
        "...",
        "beep.",
        "I am rendered.",
        "700 columns wide and loving it.",
      ],
    },
    // ── Add future custom characters here ────────────────────────────────────
    stu: {
      passcode:     "rubylovessalmon",
      defaultName:  "Stugotchi",
      patLabel:     "Collect Stickers",
      mgTitle:      "Play or Collect Stickers",
      giftMessage:  "Stu wants a pint!",
      patToasts: {
        patted:      "Stu collected some stickers!",
        pat_refused: "Stu doesn't have enough energy to collect stickers!",
      },
      patBubbles: [
        "That's going in the binder.",
        "No, you cannot have that one.",
        "Scotland sticker. Rarest of them all.",
        "Thanks for fuelling the addiction.",
      ],
      feedMealMaxPerCycle:  10,
      feedSnackMaxPerCycle: 10,
      feedHungerMult:       0.25,
      snackSickThreshold:   5,
      feedMealWeightGain:   1,
      feedSnackWeightGain:  2,
      playWeightLoss:       5,
    },
  };

  /**
   * Look up a custom character entry by passcode.
   * Returns the entry object (with spriteType added) or null if not found.
   * @param {string} passcode
   */
  function customCharByPasscode(passcode) {
    var keys = Object.keys(CUSTOM_CHARACTERS);
    for (var i = 0; i < keys.length; i++) {
      var entry = CUSTOM_CHARACTERS[keys[i]];
      if (entry.passcode === passcode) {
        return Object.assign({ spriteType: keys[i] }, entry);
      }
    }
    return null;
  }

  /**
   * Look up a custom character entry by spriteType.
   * Returns the entry object or null if not found.
   * @param {string} spriteType
   */
  function customCharBySpriteType(spriteType) {
    return CUSTOM_CHARACTERS[spriteType] || null;
  }

  window.CUSTOM_CHARACTERS      = CUSTOM_CHARACTERS;
  window.customCharByPasscode   = customCharByPasscode;
  window.customCharBySpriteType = customCharBySpriteType;

}());
