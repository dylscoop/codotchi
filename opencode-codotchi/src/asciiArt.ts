/**
 * asciiArt.ts
 *
 * Terminal ASCII art renderer for the gotchi OpenCode plugin.
 *
 * Provides:
 *   - Stage-specific ASCII art (egg → baby → child → teen → adult → senior)
 *   - Mood overlays (happy / neutral / sad / sleeping / sick)
 *   - ANSI colour helpers
 *   - buildSpeechBubble() — pet art + speech bubble side-by-side, returned as string
 *   - buildStatusBlock() — compact stat bar for the /codotchi status command, returned as string
 *   - buildToast()       — one-line notification string
 */

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

// Foreground colours
const FG_CYAN    = "\x1b[36m";
const FG_GREEN   = "\x1b[32m";
const FG_YELLOW  = "\x1b[33m";
const FG_RED     = "\x1b[31m";
const FG_BLUE    = "\x1b[34m";
const FG_MAGENTA = "\x1b[35m";
const FG_WHITE   = "\x1b[37m";
const FG_GRAY    = "\x1b[90m";

/** Wrap text in an ANSI colour code and reset. */
export function colour(text: string, ansiCode: string): string {
  return `${ansiCode}${text}${RESET}`;
}

// ---------------------------------------------------------------------------
// Sprite art — one entry per life stage, per mood
// Each art block is an array of strings (lines). All lines are the same width.
// ---------------------------------------------------------------------------

/**
 * Minimal, clean ASCII pet art per stage / mood.
 * Each stage has a distinct silhouette. Lines are padded to equal width.
 *
 * Stage silhouette guide:
 *   egg    — round shell, no limbs, tiny face peeking through
 *   baby   — round head + round body, tiny nub arms, nub feet
 *   child  — oval head, torso with short arms out, stubby legs
 *   teen   — narrower head, slim torso, long arms, long separate legs
 *   adult  — wide torso, arm stubs at sides, thick legs with feet
 *   senior — wider hunched torso, cane on right, short bowed legs
 */
const STAGE_ART: Record<string, Record<string, string[]>> = {
  egg: {
    default: [
      "   .------.  ",
      "  /  o  o  \\ ",
      " |    ~    | ",
      " |         | ",
      "  \\._____./ ",
      "             ",
    ],
    happy: [
      "   .------.  ",
      "  /  ^  ^  \\ ",
      " |    u    | ",
      " |         | ",
      "  \\._____./ ",
      "             ",
    ],
    sad: [
      "   .------.  ",
      "  /  T  T  \\ ",
      " |    _    | ",
      " |         | ",
      "  \\._____./ ",
      "             ",
    ],
    sleeping: [
      "   .------.  ",
      "  /  -  -  \\ ",
      " |   ___   | ",
      " |  (zzz)  | ",
      "  \\._____./ ",
      "             ",
    ],
    sick: [
      "   .------.  ",
      "  /  @  @  \\ ",
      " |    x    | ",
      " |  ~~~~~  | ",
      "  \\._____./ ",
      "             ",
    ],
  },
  baby: {
    happy: [
      "    (^.^)    ",
      "   ( o   o ) ",
      "    \\___/    ",
      "    /   \\    ",
      "   v     v   ",
      "             ",
    ],
    neutral: [
      "    (-_-)    ",
      "   ( o   o ) ",
      "    \\___/    ",
      "    /   \\    ",
      "   v     v   ",
      "             ",
    ],
    sad: [
      "    (;_;)    ",
      "   ( o   o ) ",
      "    \\___/    ",
      "    /   \\    ",
      "   v     v   ",
      "             ",
    ],
    sleeping: [
      "    (-_-)z   ",
      "   ( o   o ) ",
      "    \\___/    ",
      "   /~~~~~\\   ",
      "  /         \\",
      "             ",
    ],
    sick: [
      "    (@_@)    ",
      "   ( o   o ) ",
      "    \\___/    ",
      "    /   \\    ",
      "   v     v   ",
      "             ",
    ],
  },
  child: {
    happy: [
      "   (^o^)     ",
      "  --| |--    ",
      "    | |      ",
      "   /| |\\     ",
      "  / | | \\    ",
      " J  | |  L   ",
    ],
    neutral: [
      "   (-_-)     ",
      "  --| |--    ",
      "    | |      ",
      "   /| |\\     ",
      "  / | | \\    ",
      " J  | |  L   ",
    ],
    sad: [
      "   (T_T)     ",
      "  --| |--    ",
      "    | |      ",
      "   /| |\\     ",
      "  / | | \\    ",
      " J  | |  L   ",
    ],
    sleeping: [
      "   (-.-) z   ",
      "   --| |--   ",
      "    |zzz|    ",
      "   /~~~~~\\   ",
      "  /       \\  ",
      " J         L ",
    ],
    sick: [
      "   (@_@)     ",
      "  --| |--    ",
      "    | |      ",
      "   /| |\\     ",
      "  / | | \\    ",
      " J  | |  L   ",
    ],
  },
  teen: {
    happy: [
      "   (^_^)     ",
      "  o-| |-o    ",
      "    | |      ",
      "    | |      ",
      "   /   \\     ",
      "  /     \\    ",
    ],
    neutral: [
      "   (-_-)     ",
      "  o-| |-o    ",
      "    | |      ",
      "    | |      ",
      "   /   \\     ",
      "  /     \\    ",
    ],
    sad: [
      "   (T_T)     ",
      "  o-| |-o    ",
      "    | |      ",
      "    | |      ",
      "   /   \\     ",
      "  /     \\    ",
    ],
    sleeping: [
      "   (-.-)  z  ",
      "  o-|zzz|-o  ",
      "    | |      ",
      "   /~~~\\     ",
      "  /     \\    ",
      " /       \\   ",
    ],
    sick: [
      "   (@_@)     ",
      "  o-| |-o    ",
      "    | |      ",
      "    | |      ",
      "   /   \\     ",
      "  /     \\    ",
    ],
  },
  adult: {
    happy: [
      "  \\(^_^)/    ",
      "  _| | |_    ",
      " / | | | \\   ",
      "   |___|     ",
      "  // | \\\\    ",
      " //  |  \\\\   ",
    ],
    neutral: [
      "  \\(-_-)/    ",
      "  _| | |_    ",
      " / | | | \\   ",
      "   |___|     ",
      "  // | \\\\    ",
      " //  |  \\\\   ",
    ],
    sad: [
      "  \\(T_T)/    ",
      "  _| | |_    ",
      " / | | | \\   ",
      "   |___|     ",
      "  // | \\\\    ",
      " //  |  \\\\   ",
    ],
    sleeping: [
      "  \\(-.-)/  z ",
      "  _|zzz|_    ",
      " / |   | \\   ",
      "  /~~~~~\\    ",
      " //     \\\\   ",
      "//       \\\\  ",
    ],
    sick: [
      "  \\(@_@)/    ",
      "  _| | |_    ",
      " / | | | \\   ",
      "   |___|     ",
      "  // | \\\\    ",
      " //  |  \\\\   ",
    ],
  },
  senior: {
    happy: [
      "  ~(^_^)~    ",
      "  ~| | |~    ",
      " ~ | | | ~   ",
      "   |___|     ",
      "  /  |  /    ",
      " /   | /     ",
    ],
    neutral: [
      "  ~(-_-)~    ",
      "  ~| | |~    ",
      " ~ | | | ~   ",
      "   |___|     ",
      "  /  |  /    ",
      " /   | /     ",
    ],
    sad: [
      "  ~(T_T)~    ",
      "  ~| | |~    ",
      " ~ | | | ~   ",
      "   |___|     ",
      "  /  |  /    ",
      " /   | /     ",
    ],
    sleeping: [
      "  ~(-.-)~ z  ",
      "  ~|zzz|~    ",
      " ~ |   | ~   ",
      "  /~~~~~\\    ",
      " /   |   /   ",
      "/    |  /    ",
    ],
    sick: [
      "  ~(@_@)~    ",
      "  ~| | |~    ",
      " ~ | | | ~   ",
      "   |___|     ",
      "  /  |  /    ",
      " /   | /     ",
    ],
  },
};

// ---------------------------------------------------------------------------
// Stage colour schemes
// ---------------------------------------------------------------------------

const STAGE_COLOURS: Record<string, string> = {
  egg:    FG_CYAN,
  baby:   FG_GREEN,
  child:  FG_YELLOW,
  teen:   FG_MAGENTA,
  adult:  FG_BLUE,
  senior: FG_WHITE,
};

// ---------------------------------------------------------------------------
// Art lookup
// ---------------------------------------------------------------------------

/**
 * Return the art lines for a pet at the given stage and mood.
 * Falls back to the stage's "happy" art if the mood has no specific art.
 * Falls back to egg/default art if the stage is unknown.
 */
export function getArt(stage: string, mood: string): string[] {
  const stageMap = STAGE_ART[stage] ?? STAGE_ART.egg;
  // mood keys: happy / neutral / sad / sleeping / sick
  const moodKey = mood === "sleeping" ? "sleeping"
    : mood === "sick"    ? "sick"
    : mood === "sad"     ? "sad"
    : mood === "happy"   ? "happy"
    : "neutral";
  return stageMap[moodKey] ?? stageMap["happy"] ?? stageMap["default"] ?? STAGE_ART.egg.default;
}

// ---------------------------------------------------------------------------
// Speech bubble
// ---------------------------------------------------------------------------

/**
 * Build a speech bubble as an array of lines.
 *
 * @param message  - The message text. Long messages are word-wrapped.
 * @param maxWidth - Max characters per bubble line (default 36).
 */
export function buildBubble(message: string, maxWidth = 40): string[] {
  // Word-wrap the message
  const words = message.split(" ");
  const wrapped: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxWidth) {
      current += " " + word;
    } else {
      wrapped.push(current);
      current = word;
    }
  }
  if (current.length > 0) { wrapped.push(current); }

  const innerWidth = Math.max(...wrapped.map((l) => l.length), 4);
  const top    = ` ${"_".repeat(innerWidth + 2)} `;
  const bottom = ` ${"‾".repeat(innerWidth + 2)} `;

  const lines: string[] = [top];
  for (let i = 0; i < wrapped.length; i++) {
    const padded = wrapped[i].padEnd(innerWidth, " ");
    const isFirst = i === 0;
    const isLast  = i === wrapped.length - 1;
    const left  = isFirst && isLast ? "<" : isFirst ? "/" : isLast ? "\\" : "|";
    const right = isFirst && isLast ? ">" : isFirst ? "\\" : isLast ? "/" : "|";
    lines.push(`${left} ${padded} ${right}`);
  }
  lines.push(bottom);
  return lines;
}

// ---------------------------------------------------------------------------
// Combined render
// ---------------------------------------------------------------------------

/**
 * Build pet art + speech bubble side-by-side and return as a string.
 *
 * Layout (art on left, bubble on right, connected by a tail):
 *
 *    (^_^)        ________
 *    |   |       < Hello! >
 *    ...          ‾‾‾‾‾‾‾‾
 *
 * @param stage   - Life stage of the pet.
 * @param mood    - Current mood key.
 * @param message - The speech bubble text.
 * @param name    - Pet's name (used as a label above the art).
 */
export function buildSpeechBubble(
  stage: string,
  mood: string,
  message: string,
  name: string
): string {
  const art    = getArt(stage, mood);
  const bubble = buildBubble(message);
  const stageColour = STAGE_COLOURS[stage] ?? FG_WHITE;

  // Pad art to bubble height (or vice versa)
  const artWidth = (art[0] ?? "").length;
  const maxLines = Math.max(art.length, bubble.length);
  const artPadded    = [...art,    ...Array(maxLines - art.length).fill(" ".repeat(artWidth))];
  const bubblePadded = [...bubble, ...Array(maxLines - bubble.length).fill("")];

  // Colour the art lines
  const artColoured = artPadded.map((l) => colour(l, stageColour));

  // Build name header
  const header = `${BOLD}${stageColour}${name}${RESET} ${FG_GRAY}[${stage}]${RESET}`;
  const lines: string[] = [RESET, "", header];

  // Build combined lines
  const GAP = "  ";
  for (let i = 0; i < maxLines; i++) {
    const artLine    = artColoured[i]    ?? "";
    const bubbleLine = bubblePadded[i]   ?? "";
    // Connect art row 1 (index 1) to bubble row 1 with a tail arrow
    const connector = i === 1 ? colour("-->", FG_GRAY) : "   ";
    lines.push(artLine + connector + GAP + bubbleLine);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Status block
// ---------------------------------------------------------------------------

/** Render a single stat bar of the form:  Label [████░░░░] 72 */
function statBar(label: string, value: number, barWidth = 10): string {
  const filled = Math.round((value / 100) * barWidth);
  const empty  = barWidth - filled;
  const barColour = value >= 50 ? FG_GREEN : value >= 25 ? FG_YELLOW : FG_RED;
  const bar = colour("█".repeat(filled), barColour) + colour("░".repeat(empty), FG_GRAY);
  const labelPad = label.padEnd(12, " ");
  return `  ${FG_CYAN}${labelPad}${RESET}[${bar}] ${value}`;
}

/**
 * Build a full status readout for the pet and return as a string.
 *
 * @param state - Minimal state fields needed for the display.
 */
export function buildStatusBlock(state: {
  name: string;
  stage: string;
  mood: string;
  hunger: number;
  happiness: number;
  energy: number;
  health: number;
  discipline: number;
  weight: number;
  ageDays: number;
  alive: boolean;
  sick: boolean;
  sleeping: boolean;
  poops: number;
}): string {
  const stageColour = STAGE_COLOURS[state.stage] ?? FG_WHITE;
  const art = getArt(state.stage, state.mood);

  // Art + header side by side
  const headerLines = [
    `${BOLD}${stageColour}${state.name}${RESET}`,
    `${FG_GRAY}Stage   : ${RESET}${state.stage}`,
    `${FG_GRAY}Age     : ${RESET}${state.ageDays} day${state.ageDays !== 1 ? "s" : ""}`,
    `${FG_GRAY}Mood    : ${RESET}${state.mood}`,
    `${FG_GRAY}Status  : ${RESET}${state.sick ? colour("SICK", FG_RED) : state.sleeping ? colour("sleeping", FG_BLUE) : colour("healthy", FG_GREEN)}`,
    `${FG_GRAY}Poops   : ${RESET}${state.poops > 0 ? colour(String(state.poops), FG_YELLOW) : "0"}`,
  ];

  const maxH = Math.max(art.length, headerLines.length);
  const artPad = [...art, ...Array(maxH - art.length).fill(" ".repeat((art[0] ?? "").length))];
  const hdrPad = [...headerLines, ...Array(maxH - headerLines.length).fill("")];

  const lines: string[] = [RESET, ""];
  for (let i = 0; i < maxH; i++) {
    lines.push(colour(artPad[i] ?? "", stageColour) + "  " + (hdrPad[i] ?? ""));
  }

  lines.push("");
  lines.push(statBar("Hunger",     state.hunger));
  lines.push(statBar("Happiness",  state.happiness));
  lines.push(statBar("Energy",     state.energy));
  lines.push(statBar("Health",     state.health));
  lines.push(statBar("Discipline", state.discipline));
  lines.push("");
  lines.push(`  ${FG_CYAN}Weight${RESET}        ${state.weight} / 99`);
  lines.push("");
  return lines.join("\n");
}

/**
 * Build a contextual speech line combining pet mood and coding session activity.
 *
 * @param pet          - Key pet fields needed to pick a mood-relevant phrase.
 * @param filesEdited  - Number of files edited this session.
 * @param sessionMs    - Milliseconds elapsed since the session started.
 */
export function buildContextualSpeech(
  pet: {
    name: string;
    stage: string;
    mood: string;
    hunger: number;
    happiness: number;
    energy: number;
    health: number;
    sick: boolean;
    sleeping: boolean;
    poops: number;
  },
  filesEdited: number,
  sessionMs: number
): string {
  // --- Session activity phrase ---
  const sessionMins = Math.floor(sessionMs / 60_000);
  const sessionHours = Math.floor(sessionMins / 60);
  const sessionLabel = sessionHours >= 1
    ? `${sessionHours}h ${sessionMins % 60}m`
    : sessionMins >= 1
    ? `${sessionMins}m`
    : "just started";
  const activityPhrase =
    filesEdited === 0  ? "No edits yet this session."
    : filesEdited < 5  ? `${filesEdited} file${filesEdited > 1 ? "s" : ""} edited — just warming up!`
    : filesEdited < 15 ? `${filesEdited} files edited in ${sessionLabel} — nice flow!`
    : filesEdited < 30 ? `${filesEdited} files edited in ${sessionLabel} — on a roll!`
    :                    `${filesEdited} files edited in ${sessionLabel} — incredible focus!`;

  // --- Pet mood phrase (most critical stat wins) ---
  let moodPhrase: string;
  if (!pet.sleeping && pet.energy < 15) {
    moodPhrase = "I'm absolutely exhausted, please let me sleep...";
  } else if (pet.sick) {
    moodPhrase = "I don't feel well at all. I need medicine!";
  } else if (pet.hunger < 15) {
    moodPhrase = "I'm starving! Please feed me soon.";
  } else if (pet.poops > 2) {
    moodPhrase = "It's getting really messy in here...";
  } else if (pet.happiness < 20) {
    moodPhrase = "Gotchi wants to play";
  } else if (pet.health < 30) {
    moodPhrase = "My health is low — please take care of me.";
  } else if (pet.sleeping) {
    moodPhrase = "Zzz... I'm recharging. Talk to you soon!";
  } else if (pet.hunger < 40) {
    moodPhrase = "Getting a bit hungry — a snack would be nice.";
  } else if (pet.energy < 40) {
    moodPhrase = "A bit tired but still with you!";
  } else if (pet.happiness > 70 && pet.health > 70) {
    moodPhrase = "I'm thriving! Keep up the great work.";
  } else if (pet.mood === "happy") {
    moodPhrase = "I'm feeling great today!";
  } else {
    moodPhrase = "I'm doing okay. Let's keep coding!";
  }

  return `${moodPhrase} ${activityPhrase}`;
}

/**
 * Build a simple one-line toast notification string (for minor events).
 */
export function buildToast(stage: string, message: string): string {
  const c = STAGE_COLOURS[stage] ?? FG_WHITE;
  return `${c}[gotchi]${RESET} ${message}`;
}
