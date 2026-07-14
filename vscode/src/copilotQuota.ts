/**
 * copilotQuota.ts
 *
 * Pure/testable module for fetching a GitHub Copilot Chat quota percentage
 * via GitHub's own OAuth sign-in (VS Code's built-in "github" authentication
 * provider) — no manual PAT, no billing-admin access required.
 *
 * Hits the same undocumented endpoint VS Code's own Copilot status bar and
 * several third-party quota-monitor extensions use
 * (`api.github.com/copilot_internal/user`). It has no public API contract,
 * so parsing tolerates several known response shapes and degrades to
 * `ok: false` rather than throwing on anything unrecognized.
 *
 * Kept independent of `vscode` (except for the injected session getter) so
 * the parsing/caching logic can be unit-tested without a host.
 */

const QUOTA_ENDPOINT = "https://api.github.com/copilot_internal/user";

/** In-memory cache lifetime — long enough to survive repeated button
 * clicks within a session, short enough to reflect quota changes. */
export const COPILOT_QUOTA_CACHE_TTL_MS = 12 * 60 * 1000;

export type FetchLike = typeof fetch;

export type CopilotQuotaOutcome =
  | { ok: true; percentRemaining: number; unlimited: boolean }
  | { ok: false; reason: "no_session" | "unauthorized" | "network_error" | "parse_error" };

/** Minimal shape of the session object VS Code's authentication API returns. */
export interface GitHubSessionLike {
  accessToken: string;
}

export type GetSessionLike = (
  createIfNone: boolean
) => Promise<GitHubSessionLike | undefined>;

/**
 * Parse a `copilot_internal/user` response body into a quota percentage.
 *
 * Tries four known shapes in order (newest first), mirroring what
 * third-party Copilot quota-monitor extensions (IntelliJ/VS Code) fall back
 * through, since GitHub has changed this undocumented shape over time:
 *  1. Modern:  `quota_snapshots.premium_interactions.{percent_remaining,unlimited}`
 *  2. Legacy:  `limited_user_quotas.{premium_interactions,completions}.{limit|monthly_maximum,used,remaining?}`
 *  3. Nested:  `quota` / `premium_interactions` / `premium_requests`.{monthly_maximum|maximum|total|limit,used,remaining?}
 *  4. Flat:    `premium_requests_maximum` / `monthly_maximum_premium_requests` / `premium_requests_monthly_limit` + `premium_requests_used`
 */
export function parseQuotaBody(body: unknown): CopilotQuotaOutcome {
  if (typeof body !== "object" || body === null) { return { ok: false, reason: "parse_error" }; }
  const root = body as Record<string, unknown>;

  const pctFromLimitUsed = (limit: number, used: number, remaining?: number): number => {
    const rem = remaining !== undefined ? remaining : limit - used;
    return limit > 0 ? Math.round((rem / limit) * 100) : 0;
  };

  // 1. Modern shape
  const snapshots = root.quota_snapshots as Record<string, unknown> | undefined;
  if (snapshots && typeof snapshots === "object") {
    const premium = snapshots.premium_interactions as Record<string, unknown> | undefined;
    if (premium && typeof premium === "object" && premium.percent_remaining !== undefined) {
      return {
        ok: true,
        percentRemaining: Math.round(Number(premium.percent_remaining)),
        unlimited: Boolean(premium.unlimited),
      };
    }
  }

  // 2. Legacy shape
  const legacyRoot = root.limited_user_quotas as Record<string, unknown> | undefined;
  if (legacyRoot && typeof legacyRoot === "object") {
    const legacy = (legacyRoot.premium_interactions ?? legacyRoot.completions) as Record<string, unknown> | undefined;
    if (legacy && typeof legacy === "object") {
      const limit = Number(legacy.limit ?? legacy.monthly_maximum ?? 0);
      const used = Number(legacy.used ?? 0);
      const remaining = legacy.remaining !== undefined ? Number(legacy.remaining) : undefined;
      return { ok: true, percentRemaining: pctFromLimitUsed(limit, used, remaining), unlimited: false };
    }
  }

  // 3. Nested shape
  const nested = (root.quota ?? root.premium_interactions ?? root.premium_requests) as Record<string, unknown> | undefined;
  if (nested && typeof nested === "object") {
    const limit = Number(nested.monthly_maximum ?? nested.maximum ?? nested.total ?? nested.limit ?? 0);
    const used = Number(nested.used ?? 0);
    const remaining = nested.remaining !== undefined ? Number(nested.remaining) : undefined;
    return { ok: true, percentRemaining: pctFromLimitUsed(limit, used, remaining), unlimited: false };
  }

  // 4. Flat shape
  const flatMax = root.premium_requests_maximum ?? root.monthly_maximum_premium_requests ?? root.premium_requests_monthly_limit;
  if (flatMax !== undefined) {
    const limit = Number(flatMax);
    const used = Number(root.premium_requests_used ?? 0);
    return { ok: true, percentRemaining: pctFromLimitUsed(limit, used), unlimited: false };
  }

  return { ok: false, reason: "parse_error" };
}

async function fetchQuotaWithToken(token: string, fetchImpl: FetchLike): Promise<CopilotQuotaOutcome> {
  let res: Response;
  try {
    res = await fetchImpl(QUOTA_ENDPOINT, {
      headers: {
        "Authorization": `token ${token}`,
        "Accept": "application/json",
        "User-Agent": "Codotchi-VSCode",
      },
    });
  } catch {
    return { ok: false, reason: "network_error" };
  }
  if (res.status === 401 || res.status === 403) { return { ok: false, reason: "unauthorized" }; }
  if (!res.ok) { return { ok: false, reason: "network_error" }; }
  try {
    const body = await res.json();
    return parseQuotaBody(body);
  } catch {
    return { ok: false, reason: "parse_error" };
  }
}

let cache: { outcome: CopilotQuotaOutcome; fetchedAtMs: number } | undefined;

/** Clears the in-memory quota cache. Exposed for tests. */
export function clearCopilotQuotaCache(): void {
  cache = undefined;
}

/**
 * Fetch the Copilot premium-quota percentage, using VS Code's built-in
 * GitHub authentication provider (no manual PAT) and a short-lived cache so
 * repeated bubble clicks in the same session don't re-hit the network or
 * re-prompt sign-in.
 *
 * @param getSession - injected `(createIfNone) => vscode.authentication.getSession('github', ['read:user'], {createIfNone})`
 * @param fetchImpl - injected fetch implementation (defaults to global fetch)
 * @param createIfNone - whether to prompt a GitHub sign-in if no session exists yet
 * @param nowMs - injected clock for tests
 */
export async function getCachedCopilotQuota(
  getSession: GetSessionLike,
  fetchImpl: FetchLike,
  createIfNone: boolean,
  nowMs: number = Date.now()
): Promise<CopilotQuotaOutcome> {
  if (cache && nowMs - cache.fetchedAtMs < COPILOT_QUOTA_CACHE_TTL_MS) {
    return cache.outcome;
  }
  const session = await getSession(createIfNone);
  if (!session) {
    return { ok: false, reason: "no_session" };
  }
  const outcome = await fetchQuotaWithToken(session.accessToken, fetchImpl);
  // Only cache successful/definitive outcomes — a transient network error
  // shouldn't be pinned in the cache for the full TTL.
  if (outcome.ok || outcome.reason === "unauthorized") {
    cache = { outcome, fetchedAtMs: nowMs };
  }
  return outcome;
}
