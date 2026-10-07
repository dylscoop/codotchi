/**
 * customCharacters.js — registry of hidden/unlockable custom characters.
 *
 * To add a new custom character:
 *   1-3. Add the art: images in sprites/<spriteType>/ (+ sprite.json with the
 *        palette, "upright" if needed), then node scripts/import_sprites_bulk.js
 *        (see developer_notes/SPRITE_IMPORT.md). PyCharm copies vscode/media at build time.
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
   *   characterLabel {string}  — optional: name shown for the character type in the info line (default: capitalised spriteType)
   *   patLabel      {string}   — label for the Pat button in the minigame overlay
   *   giftMessage   {string}   — attention_call_gift toast message (optional)
   *   patToasts     {object}   — toast strings keyed by event name:
   *     patted        {string}  — shown when pat succeeds
   *     pat_refused   {string}  — shown when not enough energy
   *   patBubbles    {string[]} — speech bubbles shown at random after a successful pat
   *   patCall       {object}   — optional replacement text for the "wants a pat" call:
   *     call, answered, expired, status {string} (__Name__ = pet name)
   *   snackCravings {object[]} — optional: what a snack craving asks for, as
   *     { label, item } — label is the text ("a tea"), item the floor snack type
   */
  var CUSTOM_CHARACTERS = {
    tim: {
      passcode:     "teawtim",
      defaultName:  "Timagotchi",
      characterLabel: "Timagotchi",
      patLabel:     "Go for a Run",
      giftMessage:  "Timagotchi wants a tea break!",
      patToasts: {
        patted:      "Timagotchi went for a run!",
        pat_refused: "Timagotchi doesn't have enough energy for a run!",
      },
      patBubbles: [
        "That was a great run!",
        "5K done. Now where's my tea?",
        "Legs are burning but the mind is clear.",
        "That counts as cardio.",
      ],
      patCall: {
        call:     "__Name__ wants to go for a run!",
        answered: "You took __Name__ for a run.",
        expired:  "__Name__ wanted a run and was ignored.",
        status:   "wants to go for a run!",
      },
      snackCravings: [{ label: "a tea", item: "tea" }],
    },
    kangaroo: {
      passcode:     "straya",
      defaultName:  "Skippy",
      patLabel:     "Bounce",
      giftMessage:  "Skippy found a souvenir!",
      patToasts: {
        patted:      "Skippy had a bounce!",
        pat_refused: "Skippy is too tired to bounce!",
      },
      patBubbles: [
        "Straight from the pixel bush.",
        "Pouch secured.",
        "Big tail, bigger hops.",
        "That's proper straya.",
      ],
    },
    dog: {
      passcode:     "shiba",
      defaultName:  "Codotchi",
      patLabel:     "Pat",
      giftMessage:  "__Name__ found a tiny tennis ball!",
      patToasts: {
        patted:      "__Name__ enjoyed the attention!",
        pat_refused: "__Name__ is too tired for pats!",
      },
    },
    cat: {
      passcode:     "blackcat",
      defaultName:  "Codotchi",
      patLabel:     "Pat",
      giftMessage:  "__Name__ found a toy mouse!",
      patToasts: {
        patted:      "__Name__ purred!",
        pat_refused: "__Name__ is too tired for cuddles!",
      },
      patBubbles: [
        "Purrrr.",
        "Don't stop.",
        "I will knock that off the desk.",
        "Fine. You may pet me.",
      ],
    },
    // ── Add future custom characters here ────────────────────────────────────
    roo: {
      passcode:     "bounce",
      defaultName:  "Roogotchi",
      patLabel:     "Bounce",
      giftMessage:  "Roogotchi found something in its pouch!",
      patToasts: {
        patted:      "Roogotchi had a bounce!",
        pat_refused: "Roogotchi is too tired to bounce!",
      },
      patBubbles: [
        "Imported straight from a JPEG.",
        "Pouch secured.",
        "550 pixels tall and ready to hop.",
        "Not bad for a photo.",
      ],
    },
    stu: {
      passcode:     "rubylovessalmon",
      defaultName:  "Stugotchi",
      characterLabel: "Stugotchi",
      patLabel:     "Collect Stickers",
      giftMessage:  "Stugotchi wants a pint!",
      patToasts: {
        patted:      "Stugotchi collected some stickers!",
        pat_refused: "Stugotchi doesn't have enough energy to collect stickers!",
      },
      patBubbles: [
        "That's going in the binder.",
        "No, you cannot have that one.",
        "Scotland sticker. Rarest of them all.",
        "Thanks for fuelling the addiction.",
      ],
      patCall: {
        call:     "__Name__ wants to collect stickers!",
        answered: "You helped __Name__ collect stickers.",
        expired:  "__Name__ wanted stickers and was ignored.",
        status:   "wants to collect stickers!",
      },
      snackCravings: [
        { label: "a pint",      item: "guinness" },
        { label: "some salmon", item: "salmon" },
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
