/**
 * githubAuth.test.ts
 *
 * Unit tests for src/githubAuth.ts — the leaderboard GitHub user lookup that
 * treats 401/403 as "session invalid" and forces a fresh session once for
 * interactive callers (BUG-S08). Uses the built-in Node.js test runner.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveGithubUser,
  isAuthFailure,
  describeGithubUserFailure,
  REAUTH_DETAIL,
  type GetSessionOptions,
  type GetSessionWithOptions,
} from "../../src/githubAuth";
import type { FetchLike } from "../../src/copilotQuota";

interface FakeResponse { status: number; login?: string; headers?: Record<string, string> }

/** Fake fetch that answers /user by token: `responses[token]`, recording tokens seen. */
function fakeFetch(responses: Record<string, FakeResponse>, seen: string[]): FetchLike {
  return (async (_url: string, init?: RequestInit) => {
    const auth = String((init?.headers as Record<string, string>)["Authorization"]);
    const token = auth.replace("token ", "");
    seen.push(token);
    const r = responses[token] ?? { status: 500 };
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      headers: { get: (n: string) => r.headers?.[n.toLowerCase()] ?? null },
      json: async () => ({ login: r.login }),
    } as unknown as Response;
  }) as FetchLike;
}

/** Fake session getter: normal calls return `cached`, forceNewSession calls return `fresh`. */
function fakeGetSession(
  cached: string | undefined,
  fresh: string | undefined | "throw",
  calls: GetSessionOptions[]
): GetSessionWithOptions {
  return async (opts) => {
    calls.push(opts);
    if (opts.forceNewSession) {
      if (fresh === "throw") { throw new Error("User did not consent to login."); }
      return fresh !== undefined ? { accessToken: fresh } : undefined;
    }
    return cached !== undefined ? { accessToken: cached } : undefined;
  };
}

describe("isAuthFailure", () => {
  const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });
  it("treats 401 as an auth failure", () => {
    assert.equal(isAuthFailure({ status: 401 }), true);
  });
  it("treats a plain 403 as an auth failure", () => {
    assert.equal(isAuthFailure({ status: 403, headers: h({ "x-ratelimit-remaining": "42" }) }), true);
  });
  it("does not treat a rate-limit 403 as an auth failure", () => {
    assert.equal(isAuthFailure({ status: 403, headers: h({ "x-ratelimit-remaining": "0" }) }), false);
    assert.equal(isAuthFailure({ status: 403, headers: h({ "retry-after": "60" }) }), false);
  });
  it("ignores other statuses", () => {
    assert.equal(isAuthFailure({ status: 200 }), false);
    assert.equal(isAuthFailure({ status: 500 }), false);
  });
});

describe("resolveGithubUser", () => {
  it("returns the username for a valid session without re-prompting", async () => {
    const calls: GetSessionOptions[] = [];
    const seen: string[] = [];
    const out = await resolveGithubUser(
      fakeGetSession("good", "unused", calls),
      fakeFetch({ good: { status: 200, login: "octocat" } }, seen),
      true
    );
    assert.deepEqual(out, { ok: true, session: { accessToken: "good" }, username: "octocat" });
    assert.deepEqual(calls, [{ createIfNone: true }]);
  });

  it("interactive: forces a new session on 401 and retries once", async () => {
    const calls: GetSessionOptions[] = [];
    const seen: string[] = [];
    const out = await resolveGithubUser(
      fakeGetSession("dead", "fresh", calls),
      fakeFetch({ dead: { status: 401 }, fresh: { status: 200, login: "octocat" } }, seen),
      true
    );
    assert.equal(out.ok, true);
    assert.equal(out.ok && out.session.accessToken, "fresh");
    assert.deepEqual(calls, [{ createIfNone: true }, { forceNewSession: { detail: REAUTH_DETAIL } }]);
    assert.deepEqual(seen, ["dead", "fresh"]);
  });

  it("interactive: a plain 403 also forces a new session", async () => {
    const calls: GetSessionOptions[] = [];
    const out = await resolveGithubUser(
      fakeGetSession("dead", "fresh", calls),
      fakeFetch({ dead: { status: 403 }, fresh: { status: 200, login: "octocat" } }, []),
      true
    );
    assert.equal(out.ok, true);
    assert.equal(calls.length, 2);
  });

  it("interactive: user cancelling the re-auth prompt returns auth_expired", async () => {
    const out = await resolveGithubUser(
      fakeGetSession("dead", "throw", []),
      fakeFetch({ dead: { status: 401 } }, []),
      true
    );
    assert.deepEqual(out, { ok: false, reason: "auth_expired", status: 401 });
  });

  it("interactive: only retries once when the fresh token is also rejected", async () => {
    const seen: string[] = [];
    const out = await resolveGithubUser(
      fakeGetSession("dead", "alsoDead", []),
      fakeFetch({ dead: { status: 401 }, alsoDead: { status: 401 } }, seen),
      true
    );
    assert.equal(out.ok, false);
    assert.equal(!out.ok && out.reason, "auth_expired");
    assert.deepEqual(seen, ["dead", "alsoDead"]);
  });

  it("background: returns auth_expired on 401 and never forces a new session", async () => {
    const calls: GetSessionOptions[] = [];
    const out = await resolveGithubUser(
      fakeGetSession("dead", "fresh", calls),
      fakeFetch({ dead: { status: 401 } }, []),
      false
    );
    assert.deepEqual(out, { ok: false, reason: "auth_expired", status: 401 });
    assert.deepEqual(calls, [{ createIfNone: false }]);
  });

  it("background: a rate-limit 403 is an api_error, not auth_expired", async () => {
    const out = await resolveGithubUser(
      fakeGetSession("good", undefined, []),
      fakeFetch({ good: { status: 403, headers: { "x-ratelimit-remaining": "0" } } }, []),
      false
    );
    assert.deepEqual(out, { ok: false, reason: "api_error", status: 403 });
  });

  it("returns no_session when there is no session", async () => {
    const out = await resolveGithubUser(fakeGetSession(undefined, undefined, []), fakeFetch({}, []), false);
    assert.deepEqual(out, { ok: false, reason: "no_session" });
  });

  it("returns network_error when fetch throws", async () => {
    const throwing = (async () => { throw new Error("offline"); }) as unknown as FetchLike;
    const out = await resolveGithubUser(fakeGetSession("good", undefined, []), throwing, true);
    assert.deepEqual(out, { ok: false, reason: "network_error" });
  });

  it("describes failures for the UI", () => {
    assert.match(describeGithubUserFailure({ ok: false, reason: "auth_expired" }), /expired/);
    assert.match(describeGithubUserFailure({ ok: false, reason: "api_error", status: 502 }), /502/);
  });
});
