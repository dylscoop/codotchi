/**
 * state.test.mjs
 *
 * Unit tests for scripts/state.mjs — focused on the `messageCount` field added
 * to the daily usage accumulator (accumulateDailyUsage / scanAllDailyUsage).
 * messageCount is the denominator used to compute a tokens-per-message average
 * shown in the pet's speech bubble, replacing the previous unbounded
 * cumulative daily token total.
 *
 * scanAllDailyUsage() reads directly from ~/.claude/projects/**\/*.jsonl, so
 * these tests point HOME/USERPROFILE at a temporary directory containing a
 * fake transcript tree instead of touching the real user's Claude Code data.
 * os.homedir() re-reads the HOME/USERPROFILE env vars on every call (verified
 * on this project's target platforms), so redirecting them before each test
 * is sufficient — no filesystem mocking library is required.
 *
 * Run with:
 *   node --test tests/unit/state.test.mjs
 *   (from claude-codotchi/)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import {
  accumulateDailyUsage,
  getIDEBase,
  resolveVSCodeStatePath,
  resolvePyCharmStatePath,
  resolveCanonicalPetPath,
  loadIDEStateFile,
  loadStateFile,
  saveStateFile,
  statePath,
} from "../../scripts/state.mjs";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Today's date as an ISO instant (UTC), used to build timestamps scanAllDailyUsage will count. */
function todayIso(hour = 12) {
  const d = new Date();
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

/** Yesterday's date as an ISO instant — used to build timestamps that must be excluded. */
function yesterdayIso(hour = 12) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

function assistantLine({ timestamp, inputTokens = 100, outputTokens = 50, cacheRead = 0, cacheCreate = 0, model = "claude-sonnet-4-x" } = {}) {
  return {
    type: "assistant",
    timestamp,
    message: {
      model,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cache_read_input_tokens: cacheRead,
        cache_creation_input_tokens: cacheCreate,
      },
    },
  };
}

function userLine({ timestamp } = {}) {
  return { type: "user", timestamp, message: { content: "hello" } };
}

/**
 * Run `fn` with HOME/USERPROFILE redirected to a fresh temp directory
 * containing the given transcript fixtures, then clean up afterwards.
 *
 * @param transcripts - Array of { project: string, session: string, lines: object[] | string[] }.
 *                      `lines` entries that are strings are written verbatim (for malformed-JSON tests);
 *                      object entries are JSON.stringify'd.
 * @param fn          - async callback invoked once the fixture is in place.
 */
async function withFixture(transcripts, fn) {
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-state-test-"));
  const origHome = process.env.HOME;
  const origUserProfile = process.env.USERPROFILE;

  for (const t of transcripts) {
    const dir = path.join(tmpHome, ".claude", "projects", t.project);
    fs.mkdirSync(dir, { recursive: true });
    const content = t.lines
      .map((l) => (typeof l === "string" ? l : JSON.stringify(l)))
      .join("\n") + "\n";
    fs.writeFileSync(path.join(dir, `${t.session}.jsonl`), content, "utf8");
  }

  process.env.HOME = tmpHome;
  process.env.USERPROFILE = tmpHome;

  try {
    await fn();
  } finally {
    if (origHome === undefined) delete process.env.HOME; else process.env.HOME = origHome;
    if (origUserProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = origUserProfile;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Suite 1 — Empty / trivial
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — empty / trivial", () => {
  it("returns messageCount=0 when ~/.claude/projects has no transcripts at all", async () => {
    await withFixture([], async () => {
      const result = accumulateDailyUsage();
      assert.equal(result.messageCount, 0);
      assert.equal(result.costUsd, 0);
      assert.equal(result.tokens, 0);
    });
  });

  it("returns messageCount=0 when the only transcript has no assistant lines", async () => {
    await withFixture(
      [{ project: "proj1", session: "sess1", lines: [userLine({ timestamp: todayIso() }), userLine({ timestamp: todayIso() })] }],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 0);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — Counting
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — counting", () => {
  it("counts a single completed assistant message", async () => {
    await withFixture(
      [{ project: "proj1", session: "sess1", lines: [assistantLine({ timestamp: todayIso(), inputTokens: 1000, outputTokens: 500 })] }],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
        assert.equal(result.tokens, 1500);
      }
    );
  });

  it("counts multiple assistant messages within a single transcript", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: todayIso(), inputTokens: 100, outputTokens: 50 }),
            assistantLine({ timestamp: todayIso(), inputTokens: 200, outputTokens: 100 }),
            assistantLine({ timestamp: todayIso(), inputTokens: 300, outputTokens: 150 }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 3);
        assert.equal(result.tokens, 900);
      }
    );
  });

  it("sums messageCount across multiple projects and multiple transcript files", async () => {
    await withFixture(
      [
        { project: "proj1", session: "sess1", lines: [assistantLine({ timestamp: todayIso() })] },
        { project: "proj1", session: "sess2", lines: [assistantLine({ timestamp: todayIso() }), assistantLine({ timestamp: todayIso() })] },
        { project: "proj2", session: "sess3", lines: [assistantLine({ timestamp: todayIso() })] },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 4);
      }
    );
  });

  it("does not count user messages toward messageCount", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            userLine({ timestamp: todayIso() }),
            assistantLine({ timestamp: todayIso() }),
            userLine({ timestamp: todayIso() }),
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 2);
      }
    );
  });

  it("does not count assistant lines missing a usage field", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            { type: "assistant", timestamp: todayIso(), message: { model: "claude-sonnet-4-x" } }, // no usage
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Date filtering
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — date filtering", () => {
  it("excludes assistant messages timestamped yesterday", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: yesterdayIso() }),
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
      }
    );
  });

  it("counts messages from multiple times today", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: todayIso(0) }),
            assistantLine({ timestamp: todayIso(12) }),
            assistantLine({ timestamp: todayIso(23) }),
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 3);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Robustness
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — messageCount — robustness", () => {
  it("skips malformed JSON lines without throwing", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            "{ not valid json !!",
            assistantLine({ timestamp: todayIso() }),
          ],
        },
      ],
      async () => {
        let result;
        assert.doesNotThrow(() => { result = accumulateDailyUsage(); });
        assert.equal(result.messageCount, 1);
      }
    );
  });

  it("ignores non-.jsonl files in the project directory", async () => {
    await withFixture(
      [{ project: "proj1", session: "sess1", lines: [assistantLine({ timestamp: todayIso() })] }],
      async () => {
        // Write a stray non-jsonl file alongside the transcript.
        const dir = path.join(process.env.HOME, ".claude", "projects", "proj1");
        fs.writeFileSync(path.join(dir, "notes.txt"), "not a transcript", "utf8");
        const result = accumulateDailyUsage();
        assert.equal(result.messageCount, 1);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Integration: tokens-per-message averaging
// ---------------------------------------------------------------------------

describe("accumulateDailyUsage — integration: tokens-per-message averaging", () => {
  it("messageCount stays in lockstep with tokens — enables a sane average", async () => {
    await withFixture(
      [
        {
          project: "proj1",
          session: "sess1",
          lines: [
            assistantLine({ timestamp: todayIso(), inputTokens: 1000, outputTokens: 500 }), // 1500
            assistantLine({ timestamp: todayIso(), inputTokens: 2000, outputTokens: 1000 }), // 3000
            assistantLine({ timestamp: todayIso(), inputTokens: 500, outputTokens: 500 }), // 1000
          ],
        },
      ],
      async () => {
        const result = accumulateDailyUsage();
        assert.equal(result.tokens, 5500);
        assert.equal(result.messageCount, 3);
        assert.ok(result.tokens / result.messageCount > 0);
        assert.equal(Math.round(result.tokens / result.messageCount), 1833);
      }
    );
  });
});

// ---------------------------------------------------------------------------
// IDE identity merge — fixture helpers
//
// Covers resolveVSCodeStatePath / resolvePyCharmStatePath / resolveCanonicalPetPath
// / loadStateFile / saveStateFile: claude-codotchi merging its pet identity with
// whichever of VS Code/PyCharm is most recently active (see state.mjs).
// ---------------------------------------------------------------------------

/**
 * Run `fn` with APPDATA/HOME/USERPROFILE and CLAUDE_PLUGIN_DATA redirected to a
 * fresh temp directory, so every path used by the resolver/load/save functions
 * operates against an isolated fake `codotchi/vscode|pycharm/` tree and a fake
 * local wrapper file, instead of the real machine's.
 */
async function withIDEFixture(fn) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-ide-test-"));
  const orig = {
    APPDATA: process.env.APPDATA,
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    CLAUDE_PLUGIN_DATA: process.env.CLAUDE_PLUGIN_DATA,
  };
  process.env.APPDATA = tmpBase;
  process.env.HOME = tmpBase;
  process.env.USERPROFILE = tmpBase;
  process.env.CLAUDE_PLUGIN_DATA = path.join(tmpBase, "claude-plugin-data");

  try {
    await fn(tmpBase);
  } finally {
    for (const [k, v] of Object.entries(orig)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
}

/** Minimal fake pet state object — only the fields the merge logic itself inspects. */
function petState(name, overrides = {}) {
  return { name, petType: "codeling", spriteType: "dog", alive: true, stage: "egg", mood: "neutral", ...overrides };
}

/**
 * Write a VS Code/PyCharm-shaped state.json for `ide` ("vscode" | "pycharm"),
 * either at the flat/global path or under a `<hash>` per-workspace subdirectory,
 * back-dating its mtime if `mtimeMs` is given (candidates are selected by mtime).
 */
function writeIDEState(ide, { hash, state, savedAt, mtimeMs, raw } = {}) {
  const base = path.join(getIDEBase(), "codotchi", ide);
  const dir = hash ? path.join(base, hash) : base;
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, "state.json");
  const content = raw !== undefined ? raw : JSON.stringify({ state, savedAt: savedAt ?? Date.now() });
  fs.writeFileSync(filePath, content, "utf8");
  if (mtimeMs !== undefined) {
    const t = new Date(mtimeMs);
    fs.utimesSync(filePath, t, t);
  }
  return filePath;
}

// ---------------------------------------------------------------------------
// Suite 6 — resolveCanonicalPetPath: mtime-based selection across both IDEs
// ---------------------------------------------------------------------------

describe("resolveCanonicalPetPath — mtime-based selection", () => {
  it("returns null when neither VS Code nor PyCharm has any state", async () => {
    await withIDEFixture(async () => {
      assert.equal(resolveCanonicalPetPath(), null);
    });
  });

  it("picks PyCharm when it is newer than VS Code", async () => {
    await withIDEFixture(async () => {
      writeIDEState("vscode", { state: petState("VSCodePet"), mtimeMs: 1_000_000 });
      writeIDEState("pycharm", { state: petState("PyCharmPet"), mtimeMs: 2_000_000 });
      const anchor = resolveCanonicalPetPath();
      assert.equal(anchor.ide, "pycharm");
      assert.equal(anchor.state.name, "PyCharmPet");
    });
  });

  it("picks VS Code when it is newer than PyCharm", async () => {
    await withIDEFixture(async () => {
      writeIDEState("vscode", { state: petState("VSCodePet"), mtimeMs: 3_000_000 });
      writeIDEState("pycharm", { state: petState("PyCharmPet"), mtimeMs: 1_000_000 });
      const anchor = resolveCanonicalPetPath();
      assert.equal(anchor.ide, "vscode");
      assert.equal(anchor.state.name, "VSCodePet");
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — hash-subdirectory scanning for both IDEs
// ---------------------------------------------------------------------------

describe("resolveVSCodeStatePath / resolvePyCharmStatePath — hash-subdirectory scanning", () => {
  it("finds a VS Code pet in a per-workspace hash subdirectory when no flat file exists", async () => {
    await withIDEFixture(async () => {
      const p = writeIDEState("vscode", { hash: "5a976b16b6b9", state: petState("WorkspacePet") });
      assert.equal(resolveVSCodeStatePath(), p);
      const loaded = loadIDEStateFile("vscode");
      assert.equal(loaded.state.name, "WorkspacePet");
    });
  });

  it("finds a PyCharm pet in a per-project hash subdirectory when no flat file exists (the fixed gap)", async () => {
    await withIDEFixture(async () => {
      const p = writeIDEState("pycharm", { hash: "ab6e4b20b590", state: petState("ProjectPet") });
      assert.equal(resolvePyCharmStatePath(), p);
      const loaded = loadIDEStateFile("pycharm");
      assert.equal(loaded.state.name, "ProjectPet");
    });
  });

  it("picks the newest of several PyCharm hash subdirectories plus the flat file", async () => {
    await withIDEFixture(async () => {
      writeIDEState("pycharm", { state: petState("OldFlat"), mtimeMs: 1_000_000 });
      writeIDEState("pycharm", { hash: "111111111111", state: petState("OldProject"), mtimeMs: 2_000_000 });
      const newest = writeIDEState("pycharm", { hash: "222222222222", state: petState("NewestProject"), mtimeMs: 3_000_000 });
      assert.equal(resolvePyCharmStatePath(), newest);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — resolveCanonicalPetPath: cascading past corrupt candidates
// ---------------------------------------------------------------------------

describe("resolveCanonicalPetPath — cascades past corrupt/partial candidates", () => {
  it("skips the newest candidate when its JSON is unparsable and falls through to the next-newest valid one", async () => {
    await withIDEFixture(async () => {
      writeIDEState("pycharm", { state: petState("GoodPet"), mtimeMs: 1_000_000 });
      writeIDEState("vscode", { raw: "{ not valid json !!", mtimeMs: 2_000_000 });
      const anchor = resolveCanonicalPetPath();
      assert.equal(anchor.ide, "pycharm");
      assert.equal(anchor.state.name, "GoodPet");
    });
  });

  it("skips the newest candidate when it is valid JSON but missing a `state` field", async () => {
    await withIDEFixture(async () => {
      writeIDEState("pycharm", { state: petState("GoodPet"), mtimeMs: 1_000_000 });
      writeIDEState("vscode", { raw: JSON.stringify({ savedAt: Date.now() }), mtimeMs: 2_000_000 });
      const anchor = resolveCanonicalPetPath();
      assert.equal(anchor.ide, "pycharm");
      assert.equal(anchor.state.name, "GoodPet");
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — loadStateFile: merge behaviour
// ---------------------------------------------------------------------------

describe("loadStateFile — merges with the IDE anchor", () => {
  it("prefers the anchor's pet identity, keeping local wrapper metadata", async () => {
    await withIDEFixture(async () => {
      // Local wrapper with its own bookkeeping fields.
      fs.mkdirSync(path.dirname(statePath()), { recursive: true });
      fs.writeFileSync(statePath(), JSON.stringify({
        state: petState("LocalCopilot"),
        savedAt: 500_000,
        terminalEnabled: false,
        createdDate: "2026-01-01",
        totalMessages: 42,
      }), "utf8");

      writeIDEState("vscode", { state: petState("AnchorPet", { stage: "teen" }), mtimeMs: 9_000_000 });

      const file = loadStateFile();
      assert.equal(file.state.name, "AnchorPet");
      assert.equal(file.state.stage, "teen");
      assert.equal(file.terminalEnabled, false);
      assert.equal(file.totalMessages, 42);
      assert.equal(file.createdDate, "2026-01-01");
      assert.equal(file._anchor.ide, "vscode");
    });
  });

  it("falls back to the local file untouched when neither IDE has any state", async () => {
    await withIDEFixture(async () => {
      fs.mkdirSync(path.dirname(statePath()), { recursive: true });
      fs.writeFileSync(statePath(), JSON.stringify({
        state: petState("LocalCopilot"),
        savedAt: 500_000,
        terminalEnabled: true,
        createdDate: "2026-01-01",
        totalMessages: 7,
      }), "utf8");

      const file = loadStateFile();
      assert.equal(file.state.name, "LocalCopilot");
      assert.equal(file._anchor, undefined);
    });
  });

  it("returns null when there is no local file and no IDE anchor (first-ever run)", async () => {
    await withIDEFixture(async () => {
      assert.equal(loadStateFile(), null);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — saveStateFile: local mirror, anchor write-back, and guards
// ---------------------------------------------------------------------------

describe("saveStateFile — local mirror stays private, anchor write-back rules", () => {
  it("never creates codotchi/vscode or codotchi/pycharm for a fresh pet with no pre-existing anchor", async () => {
    await withIDEFixture(async () => {
      saveStateFile({
        state: petState("FreshCopilot"),
        savedAt: 1,
        terminalEnabled: true,
        createdDate: "2026-01-01",
        totalMessages: 0,
      });

      assert.ok(fs.existsSync(statePath()), "local wrapper file should be written");
      assert.equal(fs.existsSync(path.join(getIDEBase(), "codotchi", "vscode")), false);
      assert.equal(fs.existsSync(path.join(getIDEBase(), "codotchi", "pycharm")), false);
    });
  });

  it("writes state+savedAt back to the resolved anchor when one exists", async () => {
    await withIDEFixture(async () => {
      const anchorPath = writeIDEState("vscode", { state: petState("AnchorPet"), savedAt: 1, mtimeMs: 1_000_000 });
      const file = loadStateFile();
      file.state = petState("AnchorPet", { happiness: 99 });
      saveStateFile(file);

      const after = JSON.parse(fs.readFileSync(anchorPath, "utf8"));
      assert.equal(after.state.happiness, 99);
    });
  });

  it("skips the anchor write when the state content is unchanged (content-diff gate)", async () => {
    await withIDEFixture(async () => {
      const state = petState("AnchorPet");
      const anchorPath = writeIDEState("vscode", { state, savedAt: 1, mtimeMs: 1_000_000 });
      const before = fs.readFileSync(anchorPath, "utf8");

      const file = loadStateFile();
      file.state = petState("AnchorPet"); // identical content
      saveStateFile(file);

      const after = fs.readFileSync(anchorPath, "utf8");
      assert.equal(after, before, "anchor file should not be rewritten when state is unchanged");
    });
  });

  it("does not write back to the anchor for a dead pet, but still writes the local mirror", async () => {
    await withIDEFixture(async () => {
      const anchorPath = writeIDEState("vscode", { state: petState("AnchorPet"), savedAt: 1, mtimeMs: 1_000_000 });
      const before = fs.readFileSync(anchorPath, "utf8");

      const file = loadStateFile();
      file.state = petState("AnchorPet", { alive: false });
      saveStateFile(file);

      const after = fs.readFileSync(anchorPath, "utf8");
      assert.equal(after, before, "anchor file should be untouched for a dead pet");
      const local = JSON.parse(fs.readFileSync(statePath(), "utf8"));
      assert.equal(local.state.alive, false, "local mirror should still be written unconditionally");
    });
  });

  it("reuses the anchor recorded on _anchor rather than re-resolving, avoiding drift if a newer candidate appears mid-invocation", async () => {
    await withIDEFixture(async () => {
      const vscodePath = writeIDEState("vscode", { state: petState("VSCodePet"), savedAt: 1, mtimeMs: 1_000_000 });
      const file = loadStateFile(); // anchors to vscode
      assert.equal(file._anchor.ide, "vscode");

      // Simulate a PyCharm write landing *after* load but before save.
      writeIDEState("pycharm", { state: petState("PyCharmPet"), savedAt: 2, mtimeMs: 9_000_000 });

      file.state = petState("VSCodePet", { happiness: 55 });
      saveStateFile(file);

      const vscodeAfter = JSON.parse(fs.readFileSync(vscodePath, "utf8"));
      assert.equal(vscodeAfter.state.happiness, 55, "write-back should still land in the originally-resolved vscode anchor");
    });
  });
});
