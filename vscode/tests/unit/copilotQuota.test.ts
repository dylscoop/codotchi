/**
 * copilotQuota.test.ts
 *
 * Unit tests for src/copilotQuota.ts — covers the pure response parsing
 * (all four fallback shapes), HTTP status mapping, session orchestration,
 * and the in-memory cache. Uses the built-in Node.js test runner
 * (node:test + node:assert), same as gameEngine.test.ts.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  parseQuotaBody,
  getCachedCopilotQuota,
  clearCopilotQuotaCache,
  COPILOT_QUOTA_CACHE_TTL_MS,
  type FetchLike,
  type GetSessionLike,
} from "../../src/copilotQuota";

/** Build a fake `fetch` that returns a fixed status + JSON body, recording calls. */
function fakeFetch(status: number, body: unknown, calls: string[]): FetchLike {
  return (async (url: string) => {
    calls.push(String(url));
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as unknown as Response;
  }) as FetchLike;
}

/** Build a fake `fetch` that throws (simulates an offline/network failure). */
function throwingFetch(): FetchLike {
  return (async () => {
    throw new Error("network down");
  }) as FetchLike;
}

/** Build a fake `fetch` that returns 200 with an unparseable body. */
function unparseableFetch(): FetchLike {
  return (async () => {
    return {
      status: 200,
      ok: true,
      json: async () => { throw new Error("bad json"); },
    } as unknown as Response;
  }) as FetchLike;
}

/** Build a fake session getter that returns a fixed token (or undefined). */
function fakeGetSession(token: string | undefined, calls: boolean[]): GetSessionLike {
  return (async (createIfNone: boolean) => {
    calls.push(createIfNone);
    return token !== undefined ? { accessToken: token } : undefined;
  }) as GetSessionLike;
}

describe("parseQuotaBody", () => {
  it("parses the modern quota_snapshots shape", () => {
    const result = parseQuotaBody({
      quota_snapshots: { premium_interactions: { percent_remaining: 42.6, unlimited: false } },
    });
    assert.deepEqual(result, { ok: true, percentRemaining: 43, unlimited: false });
  });

  it("parses the modern shape with unlimited: true", () => {
    const result = parseQuotaBody({
      quota_snapshots: { premium_interactions: { percent_remaining: 100, unlimited: true } },
    });
    assert.deepEqual(result, { ok: true, percentRemaining: 100, unlimited: true });
  });

  it("parses the legacy limited_user_quotas.premium_interactions shape", () => {
    const result = parseQuotaBody({
      limited_user_quotas: { premium_interactions: { limit: 300, used: 75 } },
    });
    assert.deepEqual(result, { ok: true, percentRemaining: 75, unlimited: false });
  });

  it("parses the legacy limited_user_quotas.completions shape with explicit remaining", () => {
    const result = parseQuotaBody({
      limited_user_quotas: { completions: { monthly_maximum: 300, used: 100, remaining: 150 } },
    });
    assert.deepEqual(result, { ok: true, percentRemaining: 50, unlimited: false });
  });

  it("parses the nested quota shape", () => {
    const result = parseQuotaBody({ quota: { maximum: 100, used: 20 } });
    assert.deepEqual(result, { ok: true, percentRemaining: 80, unlimited: false });
  });

  it("parses the nested premium_interactions shape", () => {
    const result = parseQuotaBody({ premium_interactions: { total: 50, used: 10 } });
    assert.deepEqual(result, { ok: true, percentRemaining: 80, unlimited: false });
  });

  it("parses the flat premium_requests_maximum shape", () => {
    const result = parseQuotaBody({ premium_requests_maximum: 200, premium_requests_used: 50 });
    assert.deepEqual(result, { ok: true, percentRemaining: 75, unlimited: false });
  });

  it("parses the flat monthly_maximum_premium_requests shape", () => {
    const result = parseQuotaBody({ monthly_maximum_premium_requests: 10, premium_requests_used: 10 });
    assert.deepEqual(result, { ok: true, percentRemaining: 0, unlimited: false });
  });

  it("returns 0% (not a divide-by-zero crash) for a zero-limit legacy quota", () => {
    const result = parseQuotaBody({ limited_user_quotas: { premium_interactions: { limit: 0, used: 0 } } });
    assert.deepEqual(result, { ok: true, percentRemaining: 0, unlimited: false });
  });

  it("returns parse_error for an unrecognized body shape", () => {
    assert.deepEqual(parseQuotaBody({ some: "unrelated field" }), { ok: false, reason: "parse_error" });
  });

  it("returns parse_error for a non-object body", () => {
    assert.deepEqual(parseQuotaBody("nope"), { ok: false, reason: "parse_error" });
    assert.deepEqual(parseQuotaBody(null), { ok: false, reason: "parse_error" });
  });
});

describe("getCachedCopilotQuota", () => {
  beforeEach(() => {
    clearCopilotQuotaCache();
  });

  it("returns no_session when getSession resolves undefined", async () => {
    const calls: boolean[] = [];
    const result = await getCachedCopilotQuota(fakeGetSession(undefined, calls), fakeFetch(200, {}, []), true);
    assert.deepEqual(result, { ok: false, reason: "no_session" });
    assert.deepEqual(calls, [true]);
  });

  it("passes createIfNone through to the session getter", async () => {
    const calls: boolean[] = [];
    await getCachedCopilotQuota(fakeGetSession(undefined, calls), fakeFetch(200, {}, []), false);
    assert.deepEqual(calls, [false]);
  });

  it("fetches and parses on success", async () => {
    const fetchCalls: string[] = [];
    const body = { quota_snapshots: { premium_interactions: { percent_remaining: 60, unlimited: false } } };
    const result = await getCachedCopilotQuota(
      fakeGetSession("tok_abc", []),
      fakeFetch(200, body, fetchCalls),
      true
    );
    assert.deepEqual(result, { ok: true, percentRemaining: 60, unlimited: false });
    assert.equal(fetchCalls.length, 1);
    assert.match(fetchCalls[0], /copilot_internal\/user/);
  });

  it("maps 401 to unauthorized", async () => {
    const result = await getCachedCopilotQuota(fakeGetSession("tok", []), fakeFetch(401, {}, []), true);
    assert.deepEqual(result, { ok: false, reason: "unauthorized" });
  });

  it("maps 403 to unauthorized", async () => {
    const result = await getCachedCopilotQuota(fakeGetSession("tok", []), fakeFetch(403, {}, []), true);
    assert.deepEqual(result, { ok: false, reason: "unauthorized" });
  });

  it("maps other non-2xx statuses to network_error", async () => {
    const result = await getCachedCopilotQuota(fakeGetSession("tok", []), fakeFetch(500, {}, []), true);
    assert.deepEqual(result, { ok: false, reason: "network_error" });
  });

  it("maps a thrown fetch to network_error", async () => {
    const result = await getCachedCopilotQuota(fakeGetSession("tok", []), throwingFetch(), true);
    assert.deepEqual(result, { ok: false, reason: "network_error" });
  });

  it("maps an unparseable JSON body to parse_error", async () => {
    const result = await getCachedCopilotQuota(fakeGetSession("tok", []), unparseableFetch(), true);
    assert.deepEqual(result, { ok: false, reason: "parse_error" });
  });

  it("caches a successful outcome and does not re-fetch within the TTL", async () => {
    const sessionCalls: boolean[] = [];
    const fetchCalls: string[] = [];
    const body = { quota_snapshots: { premium_interactions: { percent_remaining: 60, unlimited: false } } };
    const getSession = fakeGetSession("tok", sessionCalls);
    const fetchImpl = fakeFetch(200, body, fetchCalls);

    const first = await getCachedCopilotQuota(getSession, fetchImpl, true, 1_000);
    const second = await getCachedCopilotQuota(getSession, fetchImpl, true, 1_000 + COPILOT_QUOTA_CACHE_TTL_MS - 1);

    assert.deepEqual(first, second);
    assert.equal(sessionCalls.length, 1);
    assert.equal(fetchCalls.length, 1);
  });

  it("re-fetches once the TTL has elapsed", async () => {
    const sessionCalls: boolean[] = [];
    const fetchCalls: string[] = [];
    const body = { quota_snapshots: { premium_interactions: { percent_remaining: 60, unlimited: false } } };
    const getSession = fakeGetSession("tok", sessionCalls);
    const fetchImpl = fakeFetch(200, body, fetchCalls);

    await getCachedCopilotQuota(getSession, fetchImpl, true, 1_000);
    await getCachedCopilotQuota(getSession, fetchImpl, true, 1_000 + COPILOT_QUOTA_CACHE_TTL_MS + 1);

    assert.equal(sessionCalls.length, 2);
    assert.equal(fetchCalls.length, 2);
  });

  it("does not cache a transient network_error, so the next call retries", async () => {
    const result1 = await getCachedCopilotQuota(fakeGetSession("tok", []), throwingFetch(), true, 1_000);
    assert.deepEqual(result1, { ok: false, reason: "network_error" });

    const fetchCalls: string[] = [];
    const body = { quota_snapshots: { premium_interactions: { percent_remaining: 60, unlimited: false } } };
    const result2 = await getCachedCopilotQuota(fakeGetSession("tok", []), fakeFetch(200, body, fetchCalls), true, 1_001);
    assert.deepEqual(result2, { ok: true, percentRemaining: 60, unlimited: false });
    assert.equal(fetchCalls.length, 1);
  });
});
