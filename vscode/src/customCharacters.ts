/**
 * customCharacters.ts — registry of hidden/unlockable custom characters.
 *
 * To add a new custom character:
 *   1-3. Add the art: images in sprites/<spriteType>/ (+ sprite.json with the
 *        palette, "upright" if needed), then node scripts/import_sprites_bulk.js
 *        (see developer_notes/SPRITE_IMPORT.md). PyCharm copies the output.
 *   4. Add entry to CUSTOM_CHARACTERS below — no other TS/Kotlin changes needed.
 *   5. Add "<spriteType>" to SpriteType union in gameEngine.ts.
 *   6. Add entry to CustomCharacters.kt (pycharm mirror).
 */

import { ROTATION_ANIMALS } from "./gameEngine";

export interface CustomCharacterToasts {
  patted:      string;
  pat_refused: string;
}

/** Replacement text for the "wants a pat" attention call (__Name__ = pet name). */
export interface CustomCharacterPatCall {
  /** Toast / bubble when the call fires. */
  call:     string;
  /** Log line when the call is answered. */
  answered: string;
  /** Log line when the call expires. */
  expired:  string;
  /** Status bar wording, phrased to follow "<name> ". */
  status:   string;
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
  /** attention_call_gift toast message (optional — uses default if absent). */
  giftMessage?: string;
  /** Toast notification strings for pat-related events. */
  patToasts:   CustomCharacterToasts;
  /** Speech bubbles shown at random after a successful pat. */
  patBubbles:  string[];
  /** Replacement text for the pat attention call (optional — uses "wants a pat!" if absent). */
  patCall?: CustomCharacterPatCall;
  /** What a snack craving asks for, e.g. "a tea"; one is picked at random per craving. */
  snackCravings?: string[];
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
    giftMessage: "Timagotchi wants a tea break!",
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
    snackCravings: ["a tea"],
  },
  {
    spriteType:  "kangaroo",
    passcode:    "straya",
    defaultName:  "Skippy",
    patLabel:    "Bounce",
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
    giftMessage: "__Name__ found a tiny tennis ball!",
    patToasts: {
      patted:      "__Name__ enjoyed the attention!",
      pat_refused: "__Name__ is too tired for pats!",
    },
    patBubbles:  [],
  },
  // ── Add future custom characters here ──────────────────────────────────────
  {
    spriteType:  "cat",
    passcode:    "blackcat",
    defaultName:  "Codotchi",
    patLabel:    "Pat",
    giftMessage: "__Name__ found a toy mouse!",
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
  {
    spriteType:  "roo",
    passcode:    "bounce",
    defaultName: "Roogotchi",
    patLabel:    "Bounce",
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
    giftMessage: "Stugotchi wants a pint!",
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
    snackCravings: ["a pint", "some salmon"],
    feedMealMaxPerCycle:  10,
    feedSnackMaxPerCycle: 10,
    feedHungerMult:       0.25,
    snackSickThreshold:   5,
    feedMealWeightGain:   1,
    feedSnackWeightGain:  2,
    playWeightLoss:       5,
  },
];

/** Passcodes that randomly select one spriteType from a pool instead of a fixed character. */
export const CUSTOM_CHARACTER_POOLS: Record<string, string[]> = {
  "dylscoop": [...ROTATION_ANIMALS, "tim", "stu", "roo"],
};

/** Look up a custom character by passcode. Returns undefined if not found. */
export function getCustomCharacterByPasscode(passcode: string): CustomCharacter | undefined {
  const pool = CUSTOM_CHARACTER_POOLS[passcode];
  if (pool && pool.length > 0) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    // Pool members without a dedicated CUSTOM_CHARACTERS entry (plain rotation
    // animals) still need their spriteType forced — synthesize a vanilla
    // character matching the default fallback text used everywhere else.
    const character = CUSTOM_CHARACTERS.find(c => c.spriteType === pick) ?? {
      spriteType:  pick,
      passcode,
      defaultName: "Codotchi",
      patLabel:    "Pat",
      patToasts: {
        patted:      "__Name__ was patted!",
        pat_refused: "__Name__ doesn't have enough energy to be patted!",
      },
      patBubbles: [],
    };
    // Pool passcodes always use the plain "Codotchi" default name, regardless
    // of the picked character's own defaultName (e.g. Timagotchi, Stugotchi).
    return { ...character, defaultName: "Codotchi" };
  }
  return CUSTOM_CHARACTERS.find(c => c.passcode === passcode);
}

/** Look up a custom character by spriteType. Returns undefined if not found. */
export function getCustomCharacterBySpriteType(spriteType: string): CustomCharacter | undefined {
  return CUSTOM_CHARACTERS.find(c => c.spriteType === spriteType);
}
