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
  /** Maximum meals allowed per wake cycle (default: FEED_MEAL_MAX_PER_CYCLE = 3). */
  feedMealMaxPerCycle?: number;
  /** Maximum snacks allowed per wake cycle (default: SNACK_MAX_PER_CYCLE = 3). */
  feedSnackMaxPerCycle?: number;
  /** Multiplier applied to the hunger boost from each meal and snack (default: 1.0). */
  feedHungerMult?: number;
  /** Consecutive snacks before the pet gets sick (default: MAX_CONSECUTIVE_SNACKS_BEFORE_SICK = 3). */
  snackSickThreshold?: number;
  /** Weight gained per meal (default: FEED_MEAL_WEIGHT_GAIN = 2). */
  feedMealWeightGain?: number;
  /** Weight gained per snack consumed (default: FEED_SNACK_WEIGHT_GAIN = 5). */
  feedSnackWeightGain?: number;
  /** Weight lost per play session (default: PLAY_WEIGHT_LOSS = 3). */
  playWeightLoss?: number;
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
    spriteType:  "kangaroo",
    passcode:    "straya",
    defaultName:  "Skippy",
    patLabel:    "Bounce",
    mgTitle:     "Play or Bounce",
    giftMessage: "Skippy found a souvenir!",
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
  {
    spriteType:  "dog",
    passcode:    "shiba",
    defaultName:  "Codotchi",
    patLabel:    "Pat",
    mgTitle:     "Play or Pat",
    giftMessage: "__Name__ found a tiny tennis ball!",
    patToasts: {
      patted:      "__Name__ enjoyed the attention!",
      pat_refused: "__Name__ is too tired for pats!",
    },
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
  {
    spriteType:  "roo",
    passcode:    "bounce",
    defaultName: "Roogotchi",
    patLabel:    "Bounce",
    mgTitle:     "Play or Bounce",
    giftMessage: "Roogotchi found something in its pouch!",
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
  {
    spriteType:  "stu",
    passcode:    "rubylovessalmon",
    defaultName: "Stugotchi",
    patLabel:    "Collect Stickers",
    mgTitle:     "Play or Collect Stickers",
    giftMessage: "Stu wants a pint!",
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
];

/** Look up a custom character by passcode. Returns undefined if not found. */
export function getCustomCharacterByPasscode(passcode: string): CustomCharacter | undefined {
  return CUSTOM_CHARACTERS.find(c => c.passcode === passcode);
}

/** Look up a custom character by spriteType. Returns undefined if not found. */
export function getCustomCharacterBySpriteType(spriteType: string): CustomCharacter | undefined {
  return CUSTOM_CHARACTERS.find(c => c.spriteType === spriteType);
}
