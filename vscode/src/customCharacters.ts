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
  /** Name shown for the character type in the info line and status bar tooltip (default: the capitalised spriteType). */
  characterLabel?: string;
  /** Label for the Pat button in the minigame overlay. */
  patLabel:    string;
  /** attention_call_gift toast message (optional — uses default if absent). */
  giftMessage?: string;
  /** Gifts picked at random per gift call, in place of giftMessage (optional; see giftItem.ts). */
  gifts?: CustomCharacterGift[];
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
  /** Speech bubble when an attention call expires unanswered (optional). */
  ignoredBubble?: string;
  /** Replacement text for the 5-minute break nap (optional — the dog chews a bone instead). */
  breakNap?: CustomCharacterBreakNap;
}

/** One gift a gift call can bring (__Name__ = pet name). */
export interface CustomCharacterGift {
  /** What the webview draws on the floor for this gift, e.g. "mouse" (optional — a gift box if absent). */
  kind?:         string;
  /** Toast / log line when the gift call fires. */
  message:       string;
  /** Speech bubble when you praise to accept this gift (optional — the usual praise lines if absent). */
  praiseBubble?: string;
}

/** Replacement text for the break nap (__Name__ = pet name). */
export interface CustomCharacterBreakNap {
  /** Notification / log line when the 30-minute break call fires (optional). */
  call?:   string;
  /** Log line when the break starts. */
  started: string;
  /** Log line when you try to wake it early. */
  noWake:  string;
  /** Notification / log line when the break ends. */
  over:    string;
  /** Sleep button label while the break runs ("Chewing 3m"). */
  button:  string;
  /** Weight gained when the break starts (the dog's big bone). */
  weightGain?: number;
  /** Speech bubble while away on the break, one picked at random (optional — the sleep lines if absent). */
  bubbles?: string[];
}

export const CUSTOM_CHARACTERS: CustomCharacter[] = [
  {
    spriteType:  "tim",
    passcode:    "teawtim",
    defaultName:  "Timagotchi",
    characterLabel: "Timagotchi",
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
    gifts: [
      { message: "__Name__ found a beer in its pouch!" },
      { message: "__Name__ brought you some Tim Tams!", praiseBubble: "These are better than Penguins!" },
    ],
    patToasts: {
      patted:      "__Name__: Cya later!",
      pat_refused: "__Name__: I'm exhausted, mate.",
    },
    patBubbles: [
      "Good on ya, mate!",
      "She'll be right.",
      "Fair dinkum, what a bounce!",
    ],
    patCall: {
      call:     "__Name__'s keen as for a bounce!",
      answered: "You took __Name__ for a bounce.",
      expired:  "__Name__ wanted a bounce. Thanks for that, champ.",
      status:   "is keen as for a bounce!",
    },
    ignoredBubble: "Yeah, nah… fair enough.",
    breakNap: {
      call:    "__Name__ wants smoko! You've been coding for 30 minutes.",
      started: "__Name__ needs to get a Bunnings snag 🌭",
      noWake:  "Oi! __Name__'s on smoko!",
      over:    "Smoko's over. Back to it, __Name__!",
      button:  "Smoko",
      bubbles: ["Gone for smoko 🚬", "Off to Bunnings for a snag 🌭"],
    },
  },
  {
    spriteType:  "dog",
    passcode:    "shiba",
    defaultName:  "Codotchi",
    patLabel:    "Pat",
    giftMessage: "__Name__ brought you a ball and wants to play fetch! 🎾",
    patToasts: {
      patted:      "__Name__ enjoyed the attention!",
      pat_refused: "__Name__ is too tired for pats!",
    },
    patBubbles: [
      "*tail wags intensify*",
      "Much code. Very wow.",
      "Who's a good boy?",
    ],
    ignoredBubble: "*sad whimper*… fine.",
    breakNap: {
      started: "__Name__ is busy with a big bone 🦴",
      noWake:  "__Name__ won't give up the bone yet!",
      over:    "__Name__ finished the bone. Back to work!",
      button:  "Chewing",
      weightGain: 5,
    },
  },
  // ── Add future custom characters here ──────────────────────────────────────
  {
    spriteType:  "cat",
    passcode:    "blackcat",
    defaultName:  "Codotchi",
    patLabel:    "Pat",
    gifts: [
      { kind: "mouse", message: "__Name__ left a mouse at your feet. You're welcome.", praiseBubble: "Don't say I never get you anything." },
      { kind: "mouse", message: "__Name__ caught a mouse for you!",                     praiseBubble: "I am a mighty hunter." },
      { kind: "bird",  message: "__Name__ brought you a bird!",                         praiseBubble: "Took me all morning." },
      { kind: "bird",  message: "__Name__ proudly presents a bird!",                    praiseBubble: "Fresh from the garden." },
    ],
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
    patCall: {
      call:     "__Name__ demands chin scratches.",
      answered: "You gave __Name__ chin scratches.",
      expired:  "__Name__ demanded chin scratches and was ignored.",
      status:   "demands chin scratches.",
    },
    snackCravings: ["some tuna", "a saucer of milk"],
    ignoredBubble: "Hmph. Fine.",
    breakNap: {
      call:    "__Name__ wants a catnap! You've been coding for 30 minutes.",
      started: "__Name__ curled up in a sunbeam for a catnap ☀️",
      noWake:  "__Name__ is catnapping. Do not disturb.",
      over:    "__Name__ stretched and woke from the catnap. Back to work!",
      button:  "Catnap",
      bubbles: ["Zzz… sunbeam…", "Do not disturb."],
    },
  },
  {
    spriteType:  "stu",
    passcode:    "rubylovessalmon",
    defaultName: "Stugotchi",
    characterLabel: "Stugotchi",
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
  "dylscoop": [...ROTATION_ANIMALS, "tim", "stu"],
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
