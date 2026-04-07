/**
 * asciiArt.ts
 *
 * Terminal ASCII art renderer for the gotchi OpenCode plugin.
 *
 * Provides:
 *   - Stage-specific ASCII art (egg → baby → child → teen → adult → senior)
 *   - Mood overlays (happy / neutral / sad / sleeping / sick)
 *   - ANSI colour helpers
 *   - renderSpeechBubble() — pet art + speech bubble side-by-side, written to stdout
 *   - renderStatusBlock() — compact stat bar for the /codotchi status command
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
 * Each line is exactly 12 characters wide (padded with spaces if needed).
 */
const STAGE_ART: Record<string, Record<string, string[]>> = {
  egg: {
    default: [
      "    _____   ",
      "   /     \\  ",
      "  | o   o | ",
      "  |   ~   | ",
      "   \\_____/  ",
      "            ",
    ],
  },
  baby: {
    happy: [
      "   (^.^)    ",
      "  /|   |\\   ",
      " / |   | \\  ",
      "   |___|    ",
      "  /     \\   ",
      "            ",
    ],
    neutral: [
      "   (-_-)    ",
      "  /|   |\\   ",
      " / |   | \\  ",
      "   |___|    ",
      "  /     \\   ",
      "            ",
    ],
    sad: [
      "   (;_;)    ",
      "  /|   |\\   ",
      " / |   | \\  ",
      "   |___|    ",
      "  /     \\   ",
      "            ",
    ],
    sleeping: [
      "   (-_-)    ",
      "  /|zzz|\\   ",
      " / |   | \\  ",
      "   |___|    ",
      "  /~~~~~\\   ",
      "            ",
    ],
    sick: [
      "   (@_@)    ",
      "  /|   |\\   ",
      " / |   | \\  ",
      "   |___|    ",
      "  /     \\   ",
      "            ",
    ],
  },
  child: {
    happy: [
      "  \\(^o^)/   ",
      "   |   |    ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /     \\   ",
      "            ",
    ],
    neutral: [
      "  \\(-_-)/   ",
      "   |   |    ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /     \\   ",
      "            ",
    ],
    sad: [
      "  \\(T_T)/   ",
      "   |   |    ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /     \\   ",
      "            ",
    ],
    sleeping: [
      "  \\(-.-)/ z ",
      "   |   |    ",
      "  /|zzz|\\   ",
      " / |___| \\  ",
      "  /~~~~~\\   ",
      "            ",
    ],
    sick: [
      "  \\(@_@)/   ",
      "   |   |    ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /     \\   ",
      "            ",
    ],
  },
  teen: {
    happy: [
      "  o(^_^)o   ",
      "  \\|   |/   ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /  |  \\   ",
      "    / \\     ",
    ],
    neutral: [
      "  o(-_-)o   ",
      "  \\|   |/   ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /  |  \\   ",
      "    / \\     ",
    ],
    sad: [
      "  o(T_T)o   ",
      "  \\|   |/   ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /  |  \\   ",
      "    / \\     ",
    ],
    sleeping: [
      "  o(-.-)o z ",
      "  \\|zzz|/   ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /~~~~~\\   ",
      "    / \\     ",
    ],
    sick: [
      "  o(@_@)o   ",
      "  \\|   |/   ",
      "  /|   |\\   ",
      " / |___| \\  ",
      "  /  |  \\   ",
      "    / \\     ",
    ],
  },
  adult: {
    happy: [
      " \\(^_^)/    ",
      "  /|   |\\   ",
      " / | ^ | \\  ",
      "  /|___|\\   ",
      " / /   \\ \\  ",
      "/_/     \\_\\ ",
    ],
    neutral: [
      " \\(-_-)/    ",
      "  /|   |\\   ",
      " / | - | \\  ",
      "  /|___|\\   ",
      " / /   \\ \\  ",
      "/_/     \\_\\ ",
    ],
    sad: [
      " \\(T_T)/    ",
      "  /|   |\\   ",
      " / | v | \\  ",
      "  /|___|\\   ",
      " / /   \\ \\  ",
      "/_/     \\_\\ ",
    ],
    sleeping: [
      " \\(-.-)/  z ",
      "  /|zzz|\\   ",
      " / |   | \\  ",
      "  /|___|\\   ",
      " /~~~~~~~\\  ",
      "/_/     \\_\\ ",
    ],
    sick: [
      " \\(@_@)/    ",
      "  /|   |\\   ",
      " / | x | \\  ",
      "  /|___|\\   ",
      " / /   \\ \\  ",
      "/_/     \\_\\ ",
    ],
  },
  senior: {
    happy: [
      "  (^_^) ~   ",
      " ~|   |~    ",
      "  | ^ |     ",
      " /|___|\\    ",
      "/  / \\  \\   ",
      "  /   \\     ",
    ],
    neutral: [
      "  (-_-) ~   ",
      " ~|   |~    ",
      "  | - |     ",
      " /|___|\\    ",
      "/  / \\  \\   ",
      "  /   \\     ",
    ],
    sad: [
      "  (T_T) ~   ",
      " ~|   |~    ",
      "  | v |     ",
      " /|___|\\    ",
      "/  / \\  \\   ",
      "  /   \\     ",
    ],
    sleeping: [
      "  (-.-) z   ",
      " ~|zzz|~    ",
      "  |   |     ",
      " /|___|\\    ",
      "/~~~~~~~\\   ",
      "  /   \\     ",
    ],
    sick: [
      "  (@_@) ~   ",
      " ~|   |~    ",
      "  | x |     ",
      " /|___|\\    ",
      "/  / \\  \\   ",
      "  /   \\     ",
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
export function buildBubble(message: string, maxWidth = 36): string[] {
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
 * Render pet art + speech bubble side-by-side and write to stdout.
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
export function renderSpeechBubble(
  stage: string,
  mood: string,
  message: string,
  name: string
): void {
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

  // Print name header
  const header = `${BOLD}${stageColour}${name}${RESET} ${FG_GRAY}[${stage}]${RESET}`;
  process.stdout.write("\n" + header + "\n");

  // Print combined lines
  const GAP = "  ";
  for (let i = 0; i < maxLines; i++) {
    const artLine    = artColoured[i]    ?? "";
    const bubbleLine = bubblePadded[i]   ?? "";
    // Connect art row 1 (index 1) to bubble row 1 with a tail arrow
    const connector = i === 1 ? colour("-->", FG_GRAY) : "   ";
    process.stdout.write(artLine + connector + GAP + bubbleLine + "\n");
  }
  process.stdout.write("\n");
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
 * Render a full status readout for the pet and write it to stdout.
 *
 * @param state - Minimal state fields needed for the display.
 */
export function renderStatus(state: {
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
}): void {
  const stageColour = STAGE_COLOURS[state.stage] ?? FG_WHITE;
  const art = getArt(state.stage, state.mood);

  process.stdout.write("\n");
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

  for (let i = 0; i < maxH; i++) {
    process.stdout.write(colour(artPad[i] ?? "", stageColour) + "  " + (hdrPad[i] ?? "") + "\n");
  }

  // Stats
  process.stdout.write("\n");
  process.stdout.write(statBar("Hunger",     state.hunger)     + "\n");
  process.stdout.write(statBar("Happiness",  state.happiness)  + "\n");
  process.stdout.write(statBar("Energy",     state.energy)     + "\n");
  process.stdout.write(statBar("Health",     state.health)     + "\n");
  process.stdout.write(statBar("Discipline", state.discipline) + "\n");
  process.stdout.write("\n");
  process.stdout.write(`  ${FG_CYAN}Weight${RESET}        ${state.weight} / 99\n`);
  process.stdout.write("\n");
}

/**
 * Render a simple one-line toast notification (for minor events).
 * Uses process.stdout so it appears in the terminal without disrupting the TUI.
 */
export function renderToast(stage: string, message: string): void {
  const c = STAGE_COLOURS[stage] ?? FG_WHITE;
  process.stdout.write(`${c}[gotchi]${RESET} ${message}\n`);
}
