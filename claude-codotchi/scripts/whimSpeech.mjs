/**
 * Speech when a whim attention call is answered — one line picked at random.
 * Mirrored in vscode/media/sidebar.js (shared by both IDEs) and
 * opencode-codotchi/src/index.ts.
 */
export const WHIM_ANSWER_SPEECH = {
  play:    ["Yay, you played with me!", "That's just what I wanted!", "Again! Again!", "Best game ever!"],
  pat:     ["Ahh, that's the spot.", "I needed that, thank you!", "More pats, please!", "You always know what I need."],
  craving: ["Mmm, just what I was craving!", "You read my mind!", "That hit the spot!", "Exactly what I wanted, yum!"],
};

/** A random answered-call line for "play", "pat" or "craving". */
export function whimSpeech(call) {
  const lines = WHIM_ANSWER_SPEECH[call];
  return lines[Math.floor(Math.random() * lines.length)];
}
