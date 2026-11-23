import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import * as claude from "../../../claude-codotchi/dist/asciiArt.js";

// Test the actual compiled entry points, not another implementation of getArt.
const require = createRequire(import.meta.url);
const opencode = require("../../../opencode-codotchi/out-test/src/asciiArt.js");
const stages = ["egg", "baby", "child", "teen", "adult", "senior"];
const moods = ["happy", "neutral", "sad", "sleeping", "sick"];
const approved = {
  dog: ["           __", "      (___()'`;", "      /,    /`", "jgs   \\\\\"--\\\\"],
  cat: [" _._     _,-'\"\"`-._", "(,-.`._,'(       |\\`-/|", "    `-.-' \\ )-`( , o o)", "          `-    \\`_`\"'-"],
  kangaroo: ["  /  /)_", " //  /.'-'", " \\\\ /_(=", "  \\(__)__,   ldb"],
  sheep: ["         ,ww", "   wWWWWWWW_)", "   `WWWWWW'", "    II  II", "pb"],
  snake: ["       __", "      {0O}", "      \\__/", "      /^/", "     ( (              -Peter Bier-", "     \\_\\_____", "     (_______)", "    (_________()Oo"],
  dragon: [" .-.        .-", "  \\_//|    /_(", " _/(o)/  .'_(", "/o_.-. \\/__(  .", "     \\-\\--'   |\\", "    3\\-3\\ \\   .|", "     /--\\  '.'/", "  __//_//__.-'", " '-'-'-'-'   AoS"],
};

for (const [host, api] of Object.entries({ opencode, claude })) {
  describe(`Feature 17 — ${host} sourced rotation art integration`, () => {
    it("returns each approved drawing verbatim for every non-egg stage/mood", () => {
      for (const [species, drawing] of Object.entries(approved)) {
        for (const stage of stages.slice(1)) for (const mood of moods) {
          assert.deepEqual(api.getArt(stage, mood, species), drawing, `${species}/${stage}/${mood}`);
        }
        assert.deepEqual(api.getArt("egg", "happy", species), api.getArt("egg", "happy"));
        assert.deepEqual(api.getArt("unknown", "happy", species), api.getArt("egg", "happy"));
        const mutable = api.getArt("adult", "happy", species);
        mutable[0] = "do not mutate the source";
        assert.deepEqual(api.getArt("adult", "happy", species), drawing);
      }
      assert.deepEqual(api.getArt("adult", "neutral", "roo"), approved.kangaroo);
    });

    it("preserves every Classic and people stage/mood byte-for-byte", () => {
      const hashes = {
        classic: "dc814ee3d002a4d7c7a114e7ca8fc79d02b4180026bc5ef332748a2ca2a79911",
        tim: "3711fb1aed53a478385be62e79c901faa8493fe75086f6ff05c0937b491d16e3",
        stu: "4035b9065aab15b37e0fbd890daae5511606118c2d265e847b7f5e15e23af6c0",
      };
      for (const [species, hash] of Object.entries(hashes)) {
        const art = stages.flatMap(s => moods.map(m => api.getArt(s, m, species)));
        assert.equal(createHash("sha256").update(JSON.stringify(art)).digest("hex"), hash, species);
      }
    });

    it("renders drawings, credits, speech, status and a companion without truncation", () => {
      for (const [species, drawing] of Object.entries(approved)) {
        const speech = api.stripAnsi(api.buildSpeechBubble("adult", "sleeping", "hello", "Pixel", species));
        for (const line of drawing) assert.ok(speech.includes(line), `${species}: ${line}`);
        assert.ok(speech.includes("hello"));
        const status = api.stripAnsi(api.buildStatusBlock({ name: "Pixel", stage: "adult", mood: "sleeping",
          spriteType: species, hunger: 80, happiness: 70, energy: 60, health: 100, discipline: 50,
          weight: 40, ageDays: 20, alive: true, sick: false, sleeping: true, poops: 0 }));
        for (const line of drawing) assert.ok(status.includes(line), `${species} status: ${line}`);
        const paired = api.sideBySideArt(drawing, approved.cat);
        assert.equal(paired.length, Math.max(drawing.length, approved.cat.length));
        assert.ok(paired.at(-1).includes(approved.cat.at(-1)));
      }
    });
  });
}
