/**
 * criticalStatNotifier.ts
 *
 * Desktop (OS-level) notifications when hunger, happiness or energy hits 0, or
 * health drops below HEALTH_ALERT_THRESHOLD. VS Code's own notifications only
 * show inside the window, so a minimised IDE would miss them.
 *
 * The decision logic (`evaluateCriticalStats`) and the per-platform command
 * (`osNotificationCommand`) are pure so they can be unit-tested without a host.
 * Delivery shells out to the OS notifier — no npm dependency:
 *   - Windows: PowerShell WinRT toast
 *   - macOS:   osascript `display notification`
 *   - Linux:   notify-send
 * Title and body are passed as environment variables, never interpolated into
 * a script, because the pet name is user-controlled.
 */

import { execFile } from "child_process";

/** These stats are critical once they hit 0. */
export const ZERO_ALERT_STATS = ["hunger", "happiness", "energy"] as const;

/** Health strictly below this value is critical. */
export const HEALTH_ALERT_THRESHOLD = 25;

/** While a stat stays critical, re-notify this often. */
export const CRITICAL_STAT_NOTIFY_REPEAT_MS = 15 * 60_000;

export const CRITICAL_STATS = [...ZERO_ALERT_STATS, "health"] as const;
export type CriticalStat = (typeof CRITICAL_STATS)[number];

/** Last notification time (ms) per stat that is currently critical. */
export type CriticalStatTracker = Partial<Record<CriticalStat, number>>;

export type CriticalStatInput = { name: string; alive: boolean } & Record<CriticalStat, number>;

/** True when this stat's value should raise a desktop alert. */
export function isCritical(stat: CriticalStat, value: number): boolean {
  return stat === "health" ? value < HEALTH_ALERT_THRESHOLD : value <= 0;
}

/**
 * Decide whether to send a notification this tick.
 *
 * A notification fires when any stat newly becomes critical, or when
 * a stat has stayed critical for CRITICAL_STAT_NOTIFY_REPEAT_MS since its last
 * notification. The message lists every critical stat, and all of their timers
 * restart together so one toast covers them. A stat that recovers is dropped
 * from the tracker; a dead pet clears it.
 */
export function evaluateCriticalStats(
  state: CriticalStatInput,
  tracker: CriticalStatTracker,
  nowMs: number
): { message: string | null; tracker: CriticalStatTracker } {
  if (!state.alive) {
    return { message: null, tracker: {} };
  }
  const critical = CRITICAL_STATS.filter((s) => isCritical(s, state[s]));
  const due = critical.some((s) => {
    const last = tracker[s];
    return last === undefined || nowMs - last >= CRITICAL_STAT_NOTIFY_REPEAT_MS;
  });
  const next: CriticalStatTracker = {};
  for (const s of critical) {
    next[s] = due ? nowMs : tracker[s];
  }
  if (!due) {
    return { message: null, tracker: next };
  }
  const parts = critical.map((s) => `${s} ${Math.round(state[s])}`);
  return { message: `${state.name} needs you — ${parts.join(", ")}`, tracker: next };
}

/** AppUserModelID registered by Windows PowerShell; lets an unpackaged script raise a toast. */
const WINDOWS_TOAST_APP_ID = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe";

const WINDOWS_TOAST_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
  "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null",
  "$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
  "$text = $xml.GetElementsByTagName('text')",
  "$text.Item(0).AppendChild($xml.CreateTextNode($env:CODOTCHI_TITLE)) | Out-Null",
  "$text.Item(1).AppendChild($xml.CreateTextNode($env:CODOTCHI_BODY)) | Out-Null",
  `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('${WINDOWS_TOAST_APP_ID}').Show([Windows.UI.Notifications.ToastNotification]::new($xml))`,
].join("; ");

export interface OsNotificationCommand {
  file: string;
  args: string[];
  env: Record<string, string>;
}

/** Build the OS notifier invocation for a platform, or null when unsupported. */
export function osNotificationCommand(
  platform: NodeJS.Platform,
  title: string,
  body: string
): OsNotificationCommand | null {
  const env = { CODOTCHI_TITLE: title, CODOTCHI_BODY: body };
  switch (platform) {
    case "win32":
      return { file: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_TOAST_SCRIPT], env };
    case "darwin":
      return {
        file: "osascript",
        args: ["-e", 'display notification (system attribute "CODOTCHI_BODY") with title (system attribute "CODOTCHI_TITLE")'],
        env,
      };
    case "linux":
    case "freebsd":
    case "openbsd":
      return { file: "notify-send", args: ["--app-name=Codotchi", title, body], env };
    default:
      return null;
  }
}

/** Fire-and-forget desktop notification. Failures (e.g. no notify-send) are only logged. */
export function sendOsNotification(title: string, body: string): void {
  const cmd = osNotificationCommand(process.platform, title, body);
  if (!cmd) {
    return;
  }
  try {
    execFile(cmd.file, cmd.args, { env: { ...process.env, ...cmd.env }, windowsHide: true, timeout: 15_000 }, (err) => {
      if (err) {
        console.warn(`[Codotchi] desktop notification failed: ${err.message}`);
      }
    });
  } catch (err) {
    console.warn(`[Codotchi] desktop notification failed: ${String(err)}`);
  }
}
