import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { createPet } from "../../src/gameEngine";
import { leaderboardBlockedReason, sealState, verifySeal } from "../../src/integrity";

// "Push live progress" must always work for an eligible pet in both IDEs, and an
// ineligible pet must say why instead of a click that silently does nothing.
const repo = path.join(__dirname, "../../../..");
const read = (p: string): string => fs.readFileSync(path.join(repo, p), "utf8").replace(/\r\n/g, "\n");
const KEY = "test-key";

describe("live progress eligibility", () => {
  it("a freshly hatched pet can push live progress", () => {
    assert.equal(leaderboardBlockedReason(createPet("Pixel", "codeling"), false, KEY), null);
  });

  it("a fresh pet stays eligible after a save and reload (seal round trip)", () => {
    const pet = createPet("Pixel", "codeling");
    assert.equal(leaderboardBlockedReason(verifySeal(pet, sealState(pet, KEY), KEY), false, KEY), null);
  });

  it("a pet saved before seals existed (pre-2.27) can still push", () => {
    const loaded = verifySeal(createPet("Pixel", "codeling"), undefined, KEY);
    assert.equal(loaded.leaderboardIneligible, "unverified");
    assert.equal(leaderboardBlockedReason(loaded, false, KEY), null);
  });

  it("an edited save or a dev-mode pet is blocked with a reason", () => {
    const pet = createPet("Pixel", "codeling");
    assert.match(leaderboardBlockedReason({ ...pet, leaderboardIneligible: "tampered" }, false, KEY) ?? "", /edited outside Codotchi/);
    assert.match(leaderboardBlockedReason({ ...pet, devModeEverUsed: true }, false, KEY) ?? "", /dev mode/);
  });
});

describe("live progress button (shared webview)", () => {
  const sidebar = read("vscode/media/sidebar.js");

  it("the button exists and a click sends toggle_live_subscribe", () => {
    assert.match(read("vscode/media/sidebar.html"), /<button id="btn-live-subscribe"/);
    assert.match(sidebar, /btnLiveSubscribe\.addEventListener\("click", function \(\) \{\n\s*vscode\.postMessage\(\{ command: "toggle_live_subscribe" \}\);/);
  });

  it("is only disabled for a blocked pet that isn't subscribed, and then says why", () => {
    assert.match(sidebar, /var liveBlocked = leaderboardBlocked !== null && !message\.liveSubscribed;/);
    assert.match(sidebar, /btnLiveSubscribe\.disabled = liveBlocked;/);
    assert.match(sidebar, /"Live progress unavailable"/);
    assert.match(sidebar, /leaderboardBlocked !== null && !message\.liveSubscribed\) \{\n\s*livePushStatus\.textContent = leaderboardBlocked;/);
    assert.match(read("vscode/media/sidebar.css"), /\.link-btn:disabled \{/);
  });

  it("the blocked reason comes from the stateUpdate payload in both IDEs", () => {
    assert.match(sidebar, /leaderboardBlocked = message\.leaderboardBlockedReason \|\| null;/);
    assert.match(read("vscode/src/sidebarProvider.ts"), /leaderboardBlockedReason: leaderboardBlockedReason\(state, devMode\)/);
    assert.match(read("pycharm/src/main/kotlin/com/codotchi/CodotchiBrowserPanel.kt"),
      /"leaderboardBlockedReason":\$\{jsonStringOrNull\(leaderboardBlockedReason\)\}/);
  });
});

describe("live progress host handlers", () => {
  it("VS Code flips the subscription, pushes straight away and re-broadcasts", () => {
    const src = read("vscode/src/sidebarProvider.ts");
    const handler = src.slice(src.indexOf('case "toggle_live_subscribe"'), src.indexOf('case "token_cost"'));
    assert.match(handler, /globalState\.update\("leaderboardLiveSubscribed", nowSubscribed\)/);
    assert.match(handler, /void this\.pushLiveScore\(s, true\)/);
    assert.match(handler, /this\.onStateUpdate\(s\)/);
  });

  it("PyCharm flips the subscription, pushes straight away and re-broadcasts", () => {
    const src = read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt");
    const start = src.indexOf('"toggle_live_subscribe" -> {');
    assert.ok(start >= 0, "toggle_live_subscribe handler missing");
    const handler = src.slice(start, src.indexOf('"reset_high_score" -> {', start));
    assert.match(handler, /props\.setValue\("codotchi\.liveSubscribed", subscribing\)/);
    assert.match(handler, /shouldBroadcast = true/);
    assert.match(handler, /pushLiveScoreAsync\(stateSnap, promptIfNoToken = true\)/);
  });

  it("PyCharm posts a signed leaderboard-live issue and records the sync", () => {
    const src = read("pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt");
    const push = src.slice(src.indexOf("private fun pushLiveScoreAsync"), src.indexOf("private fun submitLeaderboardAsync"));
    assert.match(push, /buildLiveEntryJson\(/);
    assert.match(push, /"labels" to listOf\("leaderboard-live"\)/);
    assert.match(push, /URL\(GITHUB_ISSUES_API\)/);
    assert.match(push, /responseCode == 201/);
    assert.match(push, /setValue\("codotchi\.liveLastPushedAt"/);
  });
});
