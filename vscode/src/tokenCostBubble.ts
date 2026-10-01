/**
 * Webview message for the "Today's Token Cost" report. kind "usage" makes the
 * pet hold a phone / tablet / laptop for as long as the bubble shows.
 */
export function tokenCostBubbleMessage(text: string): { type: "showBubble"; text: string; kind: "usage" } {
  return { type: "showBubble", text, kind: "usage" };
}
