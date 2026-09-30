import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { STAGE_HEIGHT_PX, stageHeightPx } from "../../src/stageHeight";

describe("stageHeightPx", () => {
  it("maps each preset to its pixel height", () => {
    assert.equal(stageHeightPx("compact"), 180);
    assert.equal(stageHeightPx("normal"), 240);
    assert.equal(stageHeightPx("tall"), 320);
    assert.equal(stageHeightPx("extraTall"), 400);
  });

  it("falls back to Normal for missing or unknown values", () => {
    assert.equal(stageHeightPx(undefined), 240);
    assert.equal(stageHeightPx("huge"), 240);
  });

  it("matches the codotchi.stageHeight setting declared in package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../package.json"), "utf8"));
    const prop = pkg.contributes.configuration.properties["codotchi.stageHeight"];
    assert.deepEqual(prop.enum, Object.keys(STAGE_HEIGHT_PX));
    assert.equal(prop.default, "normal");
    prop.enumDescriptions.forEach((d: string, i: number) =>
      assert.ok(d.includes(`(${STAGE_HEIGHT_PX[prop.enum[i]]} px)`), d));
  });
});
