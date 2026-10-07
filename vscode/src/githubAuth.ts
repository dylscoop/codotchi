/**
 * githubAuth.ts
 *
 * Pure/testable helper that resolves the signed-in GitHub user for the
 * leaderboard, treating a 401/403 from `api.github.com/user` as "session
 * invalid" (BUG-S08). VS Code's `getSession` happily returns a cached session
 * whose token has been revoked, so without this every retry reuses the dead
 * token and the user is never asked to sign in again.
 *
 * Interactive callers (user clicked Submit / Delete / Sign in) get one
 * `forceNewSession` re-prompt and a retry; background callers (hourly live
 * push, auto-submit on death) get `auth_expired` back so they can flag it
 * without popping a sign-in dialog.
 *
 * Kept independent of `vscode` (session getter and fetch are injected) so it
 * can be unit-tested without a host.
 */

import type { FetchLike, GitHubSessionLike } from "./copilotQuota";

const USER_ENDPOINT = "https://api.github.com/user";

export const REAUTH_DETAIL = "Your GitHub sign-in expired — sign in again to sync your codotchi.";

export interface GetSessionOptions {
  createIfNone?: boolean;
  forceNewSession?: boolean | { detail: string };
}

export type GetSessionWithOptions = (
  opts: GetSessionOptions
) => Promise<GitHubSessionLike | undefined>;

export type GithubUserOutcome =
  | { ok: true; session: GitHubSessionLike; username: string }
  | { ok: false; reason: "no_session" | "auth_expired" | "network_error" | "api_error"; status?: number };

/** Minimal response shape needed to classify an auth failure. */
export interface StatusLike {
  status: number;
  headers?: { get(name: string): string | null };
}

/**
 * True when a GitHub API response means the token is no longer usable.
 * 401 always counts; 403 counts unless it is a (secondary) rate limit, which
 * GitHub also reports as 403 and which must not wipe a valid sign-in.
 */
export function isAuthFailure(res: StatusLike): boolean {
  if (res.status === 401) { return true; }
  if (res.status !== 403) { return false; }
  const remaining = res.headers?.get("x-ratelimit-remaining");
  const retryAfter = res.headers?.get("retry-after");
  return remaining !== "0" && !retryAfter;
}

async function fetchLogin(
  token: string,
  fetchImpl: FetchLike
): Promise<{ username: string } | { reason: "auth_expired" | "network_error" | "api_error"; status?: number }> {
  let res: Response;
  try {
    res = await fetchImpl(USER_ENDPOINT, {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/json",
        "User-Agent": "Codotchi-VSCode",
      },
    });
  } catch {
    return { reason: "network_error" };
  }
  if (isAuthFailure(res)) { return { reason: "auth_expired", status: res.status }; }
  if (!res.ok) { return { reason: "api_error", status: res.status }; }
  try {
    const body = await res.json() as Record<string, unknown>;
    const username = String(body.login ?? "");
    return username ? { username } : { reason: "api_error", status: res.status };
  } catch {
    return { reason: "api_error", status: res.status };
  }
}

/**
 * Get a GitHub session and resolve its username.
 *
 * @param getSession - injected `(opts) => vscode.authentication.getSession('github', scopes, opts)`
 * @param fetchImpl - injected fetch implementation
 * @param interactive - true when a user action triggered this: prompts sign-in
 *   if there is no session, and forces a fresh session once on 401/403
 */
export async function resolveGithubUser(
  getSession: GetSessionWithOptions,
  fetchImpl: FetchLike,
  interactive: boolean
): Promise<GithubUserOutcome> {
  const session = await getSession({ createIfNone: interactive });
  if (!session) { return { ok: false, reason: "no_session" }; }

  const first = await fetchLogin(session.accessToken, fetchImpl);
  if ("username" in first) { return { ok: true, session, username: first.username }; }
  if (first.reason !== "auth_expired" || !interactive) { return { ok: false, ...first }; }

  // Cached session is dead — ask VS Code for a brand new one and retry once.
  let fresh: GitHubSessionLike | undefined;
  try {
    fresh = await getSession({ forceNewSession: { detail: REAUTH_DETAIL } });
  } catch {
    fresh = undefined; // user cancelled the re-auth prompt
  }
  if (!fresh) { return { ok: false, reason: "auth_expired", status: first.status }; }

  const second = await fetchLogin(fresh.accessToken, fetchImpl);
  if ("username" in second) { return { ok: true, session: fresh, username: second.username }; }
  return { ok: false, ...second };
}

/** User-facing message for a failed `resolveGithubUser` outcome. */
export function describeGithubUserFailure(outcome: Extract<GithubUserOutcome, { ok: false }>): string {
  switch (outcome.reason) {
    case "no_session":    return "GitHub sign-in was cancelled.";
    case "auth_expired":  return "GitHub sign-in expired — try again and accept the GitHub sign-in prompt.";
    case "network_error": return "Network error contacting GitHub.";
    default:              return `GitHub API error: ${outcome.status ?? "unknown"}`;
  }
}
