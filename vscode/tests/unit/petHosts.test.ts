/**
 * Tests for src/petHosts.ts — the set of webviews showing the pet (sidebar
 * view and editor tab) — and the codotchi.openInEditor contributions in
 * package.json.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { PetHost, PetHostSet } from "../../src/petHosts";

class FakeHost implements PetHost {
  readonly received: unknown[] = [];
  constructor(public visible: boolean) {}
  postMessage(message: unknown): void { this.received.push(message); }
}

describe("PetHostSet", () => {
  it("broadcasts every message to every host", () => {
    const hosts = new PetHostSet<FakeHost>();
    const sidebar = new FakeHost(true);
    const tab = new FakeHost(false);
    hosts.add(sidebar);
    hosts.add(tab);
    hosts.broadcast({ type: "stateUpdate" });
    assert.deepEqual(sidebar.received, [{ type: "stateUpdate" }]);
    assert.deepEqual(tab.received, [{ type: "stateUpdate" }]);
  });

  it("stops sending to a removed host", () => {
    const hosts = new PetHostSet<FakeHost>();
    const tab = new FakeHost(true);
    hosts.add(tab);
    hosts.remove(tab);
    hosts.broadcast({ type: "stateUpdate" });
    assert.equal(hosts.size, 0);
    assert.deepEqual(tab.received, []);
  });

  it("is visible while any host is on screen", () => {
    const hosts = new PetHostSet<FakeHost>();
    assert.equal(hosts.anyVisible(), false);
    const sidebar = new FakeHost(false);
    const tab = new FakeHost(false);
    hosts.add(sidebar);
    hosts.add(tab);
    assert.equal(hosts.anyVisible(), false);
    tab.visible = true;
    assert.equal(hosts.anyVisible(), true);
  });
});

describe("codotchi.openInEditor contributions", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../package.json"), "utf8"));

  it("declares the command", () => {
    const cmd = pkg.contributes.commands.find((c: { command: string }) => c.command === "codotchi.openInEditor");
    assert.ok(cmd, "codotchi.openInEditor not declared");
    assert.equal(cmd.title, "Codotchi: Open Pet in Editor Tab");
  });

  it("shows the command in the pet view's title bar", () => {
    const entry = pkg.contributes.menus["view/title"].find((m: { command: string }) => m.command === "codotchi.openInEditor");
    assert.ok(entry, "codotchi.openInEditor missing from view/title");
    assert.equal(entry.when, "view == codotchiView");
  });

  it("activates to restore the editor tab after a reload", () => {
    assert.ok(pkg.activationEvents.includes("onWebviewPanel:codotchi.pet"));
  });
});
