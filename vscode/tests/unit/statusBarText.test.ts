import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { createPet, PetState } from "../../src/gameEngine";
import { attentionCallLine, formatStatusBar } from "../../src/statusBarText";

function makePet(overrides: Partial<PetState> = {}): PetState {
  return { ...createPet("Pixel", "codeling"), ...overrides };
}

describe("formatStatusBar", () => {
  it("has no ⚠ when no attention call is active", () => {
    const { text, tooltip } = formatStatusBar(makePet({ activeAttentionCall: null }));
    assert.ok(!text.includes("⚠"));
    assert.ok(!tooltip.includes("⚠"));
    assert.ok(text.includes("Pixel"));
  });

  it("prefixes the text with ⚠ and leads the tooltip with the call", () => {
    const { text, tooltip } = formatStatusBar(makePet({ activeAttentionCall: "pat" }));
    assert.ok(text.startsWith("⚠ "));
    assert.ok(tooltip.startsWith("⚠ Pixel wants a pat!"));
  });

  it("names the craved food for a craving call", () => {
    const pet = makePet({ activeAttentionCall: "craving", cravingFood: "snack" });
    assert.equal(attentionCallLine(pet), "⚠ Pixel is craving a snack!");
  });

  it("keeps the ⚠ Sick! tooltip line", () => {
    const { tooltip } = formatStatusBar(makePet({ sick: true }));
    assert.ok(tooltip.includes("⚠ Sick!"));
  });

  it("shows the gravestone when the pet is dead", () => {
    const { text } = formatStatusBar(makePet({ alive: false, activeAttentionCall: "hunger" }));
    assert.ok(text.includes("✝"));
    assert.ok(!text.startsWith("⚠"));
  });
});
