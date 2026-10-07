/**
 * Tests for src/criticalStatNotifier.ts — desktop notifications when hunger,
 * happiness or energy hits 0 or health drops below 25 — and the settings
 * layout in package.json.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import {
  CRITICAL_STAT_NOTIFY_REPEAT_MS,
  CriticalStatInput,
  evaluateCriticalStats,
  osNotificationCommand,
} from "../../src/criticalStatNotifier";

const healthy: CriticalStatInput = { name: "Pip", alive: true, hunger: 60, happiness: 60, energy: 60, health: 60 };
const T0 = 1_000_000;

describe("evaluateCriticalStats", () => {
  it("stays quiet until hunger, happiness or energy hits 0", () => {
    for (const stat of ["hunger", "happiness", "energy"] as const) {
      assert.equal(evaluateCriticalStats({ ...healthy, [stat]: 1 }, {}, T0).message, null, `${stat} 1`);
      assert.equal(evaluateCriticalStats({ ...healthy, [stat]: 0 }, {}, T0).message, `Pip needs you — ${stat} 0`);
    }
  });

  it("alerts when health drops below 25", () => {
    assert.equal(evaluateCriticalStats({ ...healthy, health: 25 }, {}, T0).message, null);
    const r = evaluateCriticalStats({ ...healthy, health: 24.4 }, {}, T0);
    assert.equal(r.message, "Pip needs you — health 24");
    assert.deepEqual(r.tracker, { health: T0 });
  });

  it("repeats only after 15 minutes while the stat stays critical", () => {
    const low = { ...healthy, energy: 0 };
    const first = evaluateCriticalStats(low, {}, T0);
    const soon = evaluateCriticalStats(low, first.tracker, T0 + CRITICAL_STAT_NOTIFY_REPEAT_MS - 1);
    assert.equal(soon.message, null);
    assert.deepEqual(soon.tracker, { energy: T0 });
    const later = evaluateCriticalStats(low, soon.tracker, T0 + CRITICAL_STAT_NOTIFY_REPEAT_MS);
    assert.ok(later.message);
  });

  it("forgets a stat that recovers, so the next drop notifies straight away", () => {
    const first = evaluateCriticalStats({ ...healthy, health: 10 }, {}, T0);
    const recovered = evaluateCriticalStats(healthy, first.tracker, T0 + 1000);
    assert.deepEqual(recovered.tracker, {});
    const again = evaluateCriticalStats({ ...healthy, health: 10 }, recovered.tracker, T0 + 2000);
    assert.ok(again.message);
  });

  it("lists every critical stat in one message and restarts all their timers", () => {
    const first = evaluateCriticalStats({ ...healthy, hunger: 0 }, {}, T0);
    const both = evaluateCriticalStats({ ...healthy, hunger: 0, health: 18 }, first.tracker, T0 + 1000);
    assert.equal(both.message, "Pip needs you — hunger 0, health 18");
    assert.deepEqual(both.tracker, { hunger: T0 + 1000, health: T0 + 1000 });
  });

  it("ignores discipline and dead pets", () => {
    const withDiscipline = { ...healthy, discipline: 0 } as CriticalStatInput;
    assert.equal(evaluateCriticalStats(withDiscipline, {}, T0).message, null);
    const dead = evaluateCriticalStats({ ...healthy, alive: false, health: 0 }, { health: T0 }, T0);
    assert.equal(dead.message, null);
    assert.deepEqual(dead.tracker, {});
  });
});

describe("osNotificationCommand", () => {
  const title = "Codotchi";
  const body = `Bob"; rm -rf ~; echo "`;

  it("passes title and body as env vars and keeps them out of scripts", () => {
    for (const platform of ["win32", "darwin"] as const) {
      const cmd = osNotificationCommand(platform, title, body)!;
      assert.deepEqual(cmd.env, { CODOTCHI_TITLE: title, CODOTCHI_BODY: body });
      assert.ok(!cmd.args.join(" ").includes(body), `${platform}: body leaked into the script`);
    }
  });

  it("uses a PowerShell toast on Windows, osascript on macOS and notify-send on Linux", () => {
    const win = osNotificationCommand("win32", title, body)!;
    assert.equal(win.file, "powershell.exe");
    assert.ok(win.args.at(-1)!.includes("ToastNotificationManager"));
    assert.ok(win.args.at(-1)!.includes("$env:CODOTCHI_BODY"));
    assert.equal(osNotificationCommand("darwin", title, body)!.file, "osascript");
    assert.deepEqual(osNotificationCommand("linux", title, body)!.args, ["--app-name=Codotchi", title, body]);
    assert.equal(osNotificationCommand("aix", title, body), null);
  });
});

describe("settings layout (package.json)", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../../package.json"), "utf8"));
  const [main, dev] = pkg.contributes.configuration as { title: string; properties: Record<string, any> }[];

  it("declares codotchi.osNotifications, on by default", () => {
    assert.equal(main.properties["codotchi.osNotifications"].default, true);
  });

  it("declares codotchi.statusBarEnabled in General, on by default", () => {
    assert.equal(main.properties["codotchi.statusBarEnabled"].type, "boolean");
    assert.equal(main.properties["codotchi.statusBarEnabled"].default, true);
  });

  it("keeps the developer settings in their own Developer section", () => {
    assert.equal(dev.title, "Developer");
    assert.deepEqual(Object.keys(dev.properties), [
      "codotchi.devModeEnabled", "codotchi.developerPasscode",
      "codotchi.devModeAgingMultiplier", "codotchi.devModeHealthFloor",
    ]);
    assert.ok(Object.keys(main.properties).every((k) => !k.startsWith("codotchi.devMode")));
  });

  it("orders AI mode, then display, then idle settings", () => {
    const order = (k: string) => main.properties[`codotchi.${k}`].order as number;
    const seq = ["aiMode", "stageHeight", "tokenCostSources", "background", "fontSize",
                 "idleThresholdSeconds", "idleDeepThresholdSeconds"].map(order);
    assert.deepEqual(seq, [...seq].sort((a, b) => a - b));
    for (const section of [main, dev]) {
      const orders = Object.values(section.properties).map((p) => p.order);
      assert.deepEqual(orders, orders.map((_, i) => i + 1), `${section.title}: order must be 1..n`);
    }
  });
});
