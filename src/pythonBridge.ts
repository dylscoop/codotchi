/**
 * pythonBridge.ts
 *
 * Spawns the Python game-engine subprocess and provides a typed,
 * serial request/response interface over newline-delimited JSON.
 *
 * Usage:
 *   const bridge = new PythonBridge(context);
 *   await bridge.start();
 *   const state = await bridge.send({ action: "new_game", name: "Pixel", pet_type: "codeling", color: "neon" });
 *   bridge.dispose();
 */

import * as child_process from "child_process";
import * as path from "path";
import * as vscode from "vscode";

/** Full state snapshot returned by the Python game engine after every action. */
export interface PetState {
  hunger: number;
  happiness: number;
  discipline: number;
  energy: number;
  health: number;
  weight: number;
  age_days: number;
  stage: string;
  character: string;
  alive: boolean;
  sick: boolean;
  sleeping: boolean;
  poops: number;
  mood: string;
  name: string;
  pet_type: string;
  color: string;
  sprite: string;
  care_score: number;
  events: string[];
  // Persistence bookkeeping (optional — present in full snapshots)
  ticks_alive?: number;
  ticks_since_last_poop?: number;
  consecutive_snacks?: number;
  hunger_zero_ticks?: number;
  medicine_doses_given?: number;
  care_score_hunger_sum?: number;
  care_score_happiness_sum?: number;
  care_score_health_sum?: number;
  care_score_ticks?: number;
}

/** Response when no saved state exists yet. */
export interface NeedsNewGameResponse {
  needs_new_game: true;
  alive: null;
  action: "init";
}

/** Error response from the engine. */
export interface ErrorResponse {
  error: string;
  action?: string;
}

export type EngineResponse = PetState | NeedsNewGameResponse | ErrorResponse;

/** Any JSON object we can send as a command. */
export type Command = Record<string, unknown>;

export class PythonBridge implements vscode.Disposable {
  private process: child_process.ChildProcess | null = null;
  private buffer: string = "";
  private pendingResolve: ((value: EngineResponse) => void) | null = null;
  private pendingReject: ((reason: Error) => void) | null = null;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel("vscode_gotchi");
  }

  /** Resolve the path to the Python executable from settings or auto-detect. */
  private resolvePythonPath(): string {
    const config = vscode.workspace.getConfiguration("gotchi");
    const configured = config.get<string>("pythonPath", "");
    if (configured && configured.length > 0) {
      return configured;
    }
    return process.platform === "win32" ? "python" : "python3";
  }

  /** Resolve the absolute path to game_engine.py inside the extension. */
  private resolveEnginePath(): string {
    return path.join(this.context.extensionPath, "python", "game_engine.py");
  }

  /** Spawn the Python subprocess and attach stdin/stdout listeners. */
  async start(): Promise<void> {
    const pythonPath = this.resolvePythonPath();
    const enginePath = this.resolveEnginePath();

    this.outputChannel.appendLine(
      `Starting Python engine: ${pythonPath} ${enginePath}`
    );

    this.process = child_process.spawn(pythonPath, [enginePath], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: path.dirname(enginePath),
    });

    this.process.stdout!.setEncoding("utf8");
    this.process.stdout!.on("data", (chunk: string) => {
      this.handleChunk(chunk);
    });

    this.process.stderr!.setEncoding("utf8");
    this.process.stderr!.on("data", (chunk: string) => {
      this.outputChannel.appendLine(`[python stderr] ${chunk.trim()}`);
    });

    this.process.on("error", (err: Error) => {
      this.outputChannel.appendLine(`[python error] ${err.message}`);
      if (this.pendingReject) {
        this.pendingReject(err);
        this.pendingResolve = null;
        this.pendingReject = null;
      }
    });

    this.process.on("exit", (code: number | null) => {
      this.outputChannel.appendLine(`[python exit] code=${code}`);
      if (this.pendingReject) {
        this.pendingReject(new Error(`Python process exited with code ${code}`));
        this.pendingResolve = null;
        this.pendingReject = null;
      }
    });
  }

  /** Handle incoming stdout data, splitting on newlines. */
  private handleChunk(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const response: EngineResponse = JSON.parse(trimmed);
        if (this.pendingResolve) {
          const resolve = this.pendingResolve;
          this.pendingResolve = null;
          this.pendingReject = null;
          resolve(response);
        }
      } catch (parseError) {
        this.outputChannel.appendLine(
          `[parse error] ${(parseError as Error).message}: ${trimmed}`
        );
        if (this.pendingReject) {
          const reject = this.pendingReject;
          this.pendingResolve = null;
          this.pendingReject = null;
          reject(parseError as Error);
        }
      }
    }
  }

  /**
   * Send a command to the Python engine and wait for the next response.
   *
   * Commands are serialised and queued serially — only one pending request
   * at a time is allowed.
   */
  async send(command: Command): Promise<EngineResponse> {
    if (!this.process || !this.process.stdin) {
      throw new Error("Python process is not running. Call start() first.");
    }
    if (this.pendingResolve) {
      throw new Error(
        "A request is already in flight. Await the previous send() call first."
      );
    }

    return new Promise<EngineResponse>((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      const line = JSON.stringify(command) + "\n";
      this.process!.stdin!.write(line);
    });
  }

  /** Terminate the Python subprocess and clean up. */
  dispose(): void {
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // Already dead — nothing to do.
      }
      this.process = null;
    }
    this.outputChannel.dispose();
  }
}
