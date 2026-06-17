/**
 * asciiArt.ts
 *
 * Terminal ASCII art renderer for the codotchi OpenCode plugin.
 *
 * Provides:
 *   - Stage-specific ASCII art (egg → baby → child → teen → adult → senior)
 *   - Mood overlays (happy / neutral / sad / sleeping / sick)
 *   - ANSI colour helpers
 *   - buildSpeechBubble() — pet art + speech bubble side-by-side, returned as string
 *   - buildStatusBlock() — compact stat bar for the /codotchi status command, returned as string
 *   - buildToast()       — one-line notification string
 */
/** Wrap text in an ANSI colour code and reset. */
export declare function colour(text: string, ansiCode: string): string;
/**
 * Strip all ANSI escape sequences from a string, returning plain text.
 * Used to produce markdown-safe output from art functions (e.g. for the
 * experimental.text.complete hook, which renders in a markdown context where
 * ANSI codes appear as raw escape sequences rather than colours).
 */
export declare function stripAnsi(str: string): string;
/**
 * Return the art lines for a pet at the given stage and mood.
 * Falls back to the stage's "happy" art if the mood has no specific art.
 * Falls back to egg/default art if the stage is unknown.
 */
export declare function getArt(stage: string, mood: string, spriteType?: string): string[];
export declare function buildBubble(message: string, maxWidth?: number, bubbleColor?: string): string[];
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
export declare function buildSpeechBubble(stage: string, mood: string, message: string, name: string, spriteType?: string, ideLabel?: string, bubbleColor?: string, tierEmoji?: string): string;
/**
 * Build a full status readout for the pet and return as a string.
 *
 * @param state - Minimal state fields needed for the display.
 */
export declare function buildStatusBlock(state: {
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
    spriteType?: string;
}): string;
/**
 * Format a token count as a human-readable string.
 *   0        → "0"
 *   < 1000   → "950"
 *   < 10000  → "1.2k"
 *   < 1000000 → "45k"
 *   ≥ 1000000 → "1.5M"
 */
export declare function formatTokens(n: number): string;
/**
 * Format a USD cost value as a human-readable string.
 *   0         → "$0.00"
 *   < 0.01    → "<$0.01"
 *   otherwise → "$X.XX"
 */
export declare function formatCost(usd: number): string;
/**
 * Build a contextual speech line combining pet mood and coding session activity.
 *
 * @param pet                 - Key pet fields needed to pick a mood-relevant phrase.
 * @param filesEdited         - Number of files edited this session.
 * @param sessionMs           - Milliseconds elapsed since the session started.
 * @param timeSinceLastEditMs - Milliseconds since the last file.edited event (0 = unknown/not yet).
 * @param sessionUserMessages - Number of user messages sent this session.
 * @param isOnProdBranch      - True when the current branch is main, master, release/x, or prod.
 * @param dailyCostUSD        - Total USD spent today (across all OpenCode sessions).
 * @param dailyTokens         - Total tokens consumed today (across all OpenCode sessions).
 * @param costWarnThreshold   - Daily cost (USD) at which the pet switches to a warning tone (default 30).
 * @param costShoutThreshold  - Daily cost (USD) at which the pet switches to ALL CAPS shouting (default 50).
 */
export declare function buildContextualSpeech(pet: {
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
}, filesEdited: number, sessionMs: number, timeSinceLastEditMs?: number, sessionUserMessages?: number, isOnProdBranch?: boolean, dailyCostUSD?: number, dailyTokens?: number, costWarnThreshold?: number, costShoutThreshold?: number): {
    message: string;
    bubbleColor: string;
    tierEmoji: string;
};
/**
 * Pick a random element from an array.
 */
export declare function pickRandom<T>(arr: T[]): T;
/**
 * Phrase factories for todo completions.
 * Each entry is a function that takes the todo content and returns a phrase.
 */
export declare const TODO_COMPLETE_PHRASES: Array<(content: string) => string>;
/**
 * Phrases shown when the AI finishes a work burst (session.diff + session.idle).
 */
export declare const SESSION_DIFF_PHRASES: string[];
/**
 * Build a simple one-line toast notification string (for minor events).
 */
export declare function buildToast(stage: string, message: string): string;
//# sourceMappingURL=asciiArt.d.ts.map