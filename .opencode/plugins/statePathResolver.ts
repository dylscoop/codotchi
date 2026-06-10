/**
 * statePathResolver.ts
 *
 * Resolves the VS Code state file path used by opencode-codotchi.
 *
 * When `codotchi.perWorkspacePet` is enabled in VS Code, state is written to a
 * hashed subdirectory (`…/codotchi/vscode/<hash12>/state.json`) instead of the
 * flat global path.  opencode-codotchi has no direct access to VS Code settings,
 * so we scan all `state.json` files under `…/codotchi/vscode/` (the global one
 * plus any `<hash12>/` subdirs) and return the most-recently-modified one.
 * This naturally selects whichever workspace was active when VS Code last saved.
 *
 * The result is cached after the first call so the scan only runs once per
 * opencode session (startup-time resolution is sufficient).
 */

import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";

/** Cached result — resolved once at startup. */
let _resolvedVSCodeStatePath: string | null = null;

/** Reset the cache. Exported for unit tests only. */
export function _resetVSCodePathCache(): void {
  _resolvedVSCodeStatePath = null;
}

/** Platform-specific base directory for all codotchi state files. */
export function getIDEBase(): string {
  return process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");
}

/**
 * Returns the VS Code state file path to use.
 *
 * Scans `…/codotchi/vscode/` for `state.json` files in the global location
 * and in any subdirectory whose name is exactly 12 lowercase hex characters
 * (the per-workspace hash format used by the VS Code extension).  Returns the
 * path with the newest mtime.  Falls back to the global flat path if no files
 * are found or if the base directory does not exist yet.
 *
 * Result is cached after the first call.
 */
export function resolveVSCodeStatePath(): string {
  if (_resolvedVSCodeStatePath !== null) return _resolvedVSCodeStatePath;

  const base   = path.join(getIDEBase(), "codotchi", "vscode");
  const global = path.join(base, "state.json");

  try {
    if (!fs.existsSync(base)) return (_resolvedVSCodeStatePath = global);

    const candidates: { filePath: string; mtime: number }[] = [];

    // Global flat path
    if (fs.existsSync(global)) {
      candidates.push({ filePath: global, mtime: fs.statSync(global).mtimeMs });
    }

    // Per-workspace subdirectories: exactly 12 lowercase hex chars
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory() && /^[0-9a-f]{12}$/.test(entry.name)) {
        const candidate = path.join(base, entry.name, "state.json");
        if (fs.existsSync(candidate)) {
          candidates.push({ filePath: candidate, mtime: fs.statSync(candidate).mtimeMs });
        }
      }
    }

    if (candidates.length === 0) return (_resolvedVSCodeStatePath = global);

    // Most recently written file wins
    candidates.sort((a, b) => b.mtime - a.mtime);
    return (_resolvedVSCodeStatePath = candidates[0].filePath);
  } catch {
    return (_resolvedVSCodeStatePath = global);
  }
}
