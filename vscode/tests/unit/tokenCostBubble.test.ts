import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { tokenCostBubbleMessage } from "../../src/tokenCostBubble";

describe("tokenCostBubbleMessage", () => {
  it("marks the token-cost bubble as a usage report", () => {
    assert.deepEqual(tokenCostBubbleMessage("Claude: $1.20"), { type: "showBubble", text: "Claude: $1.20", kind: "usage" });
  });
});
