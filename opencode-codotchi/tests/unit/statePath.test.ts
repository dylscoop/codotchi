/**
 * statePath.test.ts
 *
 * Unit tests for src/statePathResolver.ts — resolveVSCodeStatePath().
 *
 * Uses the built-in Node.js test runner (node:test + node:assert).
 * Each test creates an isolated temp directory, overrides APPDATA / HOME so
 * getIDEBase() points there, then restores the environment on exit.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";
import { resolveVSCodeStatePath, _resetVSCodePathCache } from "../../src/statePathResolver";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a tmp dir, writes a fake state.json, sets its mtime explicitly. */
function writeStateFile(filePath: string, mtimeMs: number): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ state: {}, savedAt: mtimeMs }), "utf8");
  const mtimeSec = mtimeMs / 1_000;
  fs.utimesSync(filePath, mtimeSec, mtimeSec);
}

let tmpDir: string;
let origAppData: string | undefined;
let origHome:    string | undefined;

function setTmpAsBase(): void {
  origAppData = process.env["APPDATA"];
  origHome    = process.env["HOME"];
  // On Windows getIDEBase() reads APPDATA; on POSIX it reads HOME
  process.env["APPDATA"] = tmpDir;
  process.env["HOME"]    = tmpDir;
}

function restoreBase(): void {
  if (origAppData !== undefined) {
    process.env["APPDATA"] = origAppData;
  } else {
    delete process.env["APPDATA"];
  }
  if (origHome !== undefined) {
    process.env["HOME"] = origHome;
  } else {
    delete process.env["HOME"];
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveVSCodeStatePath", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codotchi-test-"));
    setTmpAsBase();
    _resetVSCodePathCache();
  });

  afterEach(() => {
    restoreBase();
    _resetVSCodePathCache();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns global path when vscode dir does not exist", () => {
    // No directory created — resolveVSCodeStatePath should fall back cleanly
    const result = resolveVSCodeStatePath();
    const expected = path.join(tmpDir, "codotchi", "vscode", "state.json");
    assert.equal(result, expected, "should return global state.json path when dir is absent");
  });

  it("returns global path when vscode dir exists but has no state files", () => {
    // Create the base dir but write no state.json anywhere
    fs.mkdirSync(path.join(tmpDir, "codotchi", "vscode"), { recursive: true });
    const result = resolveVSCodeStatePath();
    const expected = path.join(tmpDir, "codotchi", "vscode", "state.json");
    assert.equal(result, expected, "should return global path as fallback when no state files found");
  });

  it("returns per-workspace path when its state.json is newer than global", () => {
    const vscodeBase  = path.join(tmpDir, "codotchi", "vscode");
    const globalPath  = path.join(vscodeBase, "state.json");
    const hashDir     = "a3f9c1b02d47"; // valid 12-hex-char hash
    const workspacePath = path.join(vscodeBase, hashDir, "state.json");

    const olderMs = Date.now() - 60_000; // global written 1 min ago
    const newerMs = Date.now() - 5_000;  // workspace written 5 sec ago

    writeStateFile(globalPath,   olderMs);
    writeStateFile(workspacePath, newerMs);

    const result = resolveVSCodeStatePath();
    assert.equal(result, workspacePath, "should pick per-workspace file when it has a newer mtime");
  });

  it("returns global path when global state.json is newer than per-workspace", () => {
    const vscodeBase  = path.join(tmpDir, "codotchi", "vscode");
    const globalPath  = path.join(vscodeBase, "state.json");
    const hashDir     = "b1e2f3a4c5d6";
    const workspacePath = path.join(vscodeBase, hashDir, "state.json");

    const olderMs = Date.now() - 120_000; // workspace written 2 min ago
    const newerMs = Date.now() - 3_000;   // global written 3 sec ago

    writeStateFile(workspacePath, olderMs);
    writeStateFile(globalPath,   newerMs);

    const result = resolveVSCodeStatePath();
    assert.equal(result, globalPath, "should pick global file when it has a newer mtime");
  });

  it("ignores subdirectories whose names are not 12 hex chars", () => {
    const vscodeBase = path.join(tmpDir, "codotchi", "vscode");
    const globalPath = path.join(vscodeBase, "state.json");

    // Write a global file (older)
    writeStateFile(globalPath, Date.now() - 10_000);

    // Write state files in dirs with non-hash names — these must be ignored
    for (const badName of ["toolong1234567", "SHORT", "12chars_but_X!"]) {
      const fakePath = path.join(vscodeBase, badName, "state.json");
      writeStateFile(fakePath, Date.now()); // newer mtime — must NOT win
    }

    const result = resolveVSCodeStatePath();
    assert.equal(result, globalPath, "should ignore subdirs whose names are not 12 lowercase hex chars");
  });

  it("caches the result — filesystem is not re-scanned on subsequent calls", () => {
    const vscodeBase = path.join(tmpDir, "codotchi", "vscode");
    const globalPath = path.join(vscodeBase, "state.json");
    writeStateFile(globalPath, Date.now() - 5_000);

    const first  = resolveVSCodeStatePath();
    const second = resolveVSCodeStatePath();
    assert.equal(first, second, "second call should return cached result (same reference)");
    assert.strictEqual(first, second);
  });
});
