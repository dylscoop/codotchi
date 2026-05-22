/**
 * customCharacters.ts — registry of hidden/unlockable custom characters.
 *
 * To add a new custom character:
 *   1. Add DEFS["<spriteType>"] to sprites.js (and pycharm mirror).
 *   2. Add palette entry to spriteConstants.js (and pycharm mirror).
 *   3. Add "<spriteType>" to UPRIGHT_TYPES in sprites.js if upright grid.
 *   4. Add entry to CUSTOM_CHARACTERS below — no other TS/Kotlin changes needed.
 *   5. Add "<spriteType>" to SpriteType union in gameEngine.ts.
 *   6. Add entry to CustomCharacters.kt (pycharm mirror).
 */

export interface CustomCharacterToasts {
  patted:      string;
  pat_refused: string;
}

export interface CustomCharacter {
  /** Sprite type key — must match a DEFS key in sprites.js. */
  spriteType:  string;
  /** Exact passcode the user enters in codotchi.characterPasscode. */
  passcode:    string;
  /** Default name pre-filled on the setup screen. For Tim, also overrides "Codotchi" (case-insensitive). */
  defaultName:  string;
  /** Label for the Pat button in the minigame overlay. */
  patLabel:    string;
  /** Minigame overlay title — replaces the default "Play or Pat". */
  mgTitle:     string;
  /** attention_call_gift toast message (optional — uses default if absent). */
  giftMessage?: string;
  /** Toast notification strings for pat-related events. */
  patToasts:   CustomCharacterToasts;
  /** Speech bubbles shown at random after a successful pat. */
  patBubbles:  string[];
}

export const CUSTOM_CHARACTERS: CustomCharacter[] = [
  {
    spriteType:  "tim",
    passcode:    "teawtim",
    defaultName:  "Timagotchi",
    patLabel:    "Go for a Run",
    mgTitle:     "Play or Go for a Run",
    giftMessage: "Tim wants a tea break!",
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
  {
    spriteType:  "testsprite",
    passcode:    "pixel",
    defaultName:  "Pixel",
    patLabel:    "Pat",
    mgTitle:     "Play or Pat",
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
  // ── Add future custom characters here ──────────────────────────────────────
];

/** Look up a custom character by passcode. Returns undefined if not found. */
export function getCustomCharacterByPasscode(passcode: string): CustomCharacter | undefined {
  return CUSTOM_CHARACTERS.find(c => c.passcode === passcode);
}

/** Look up a custom character by spriteType. Returns undefined if not found. */
export function getCustomCharacterBySpriteType(spriteType: string): CustomCharacter | undefined {
  return CUSTOM_CHARACTERS.find(c => c.spriteType === spriteType);
}
