/**
 * events.ts
 *
 * Listens for VS Code workspace events (file saves) and forwards
 * code-activity rewards to the Python engine via the bridge.
 *
 * Throttling is handled by the Python engine itself; this module
 * fires a `code_activity` command on every save event.
 */

import * as vscode from "vscode";
import { PythonBridge, PetState } from "./pythonBridge";
import { saveState } from "./persistence";

export type StateUpdateCallback = (state: PetState) => void;

export class EventsManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly bridge: PythonBridge,
    private readonly context: vscode.ExtensionContext,
    private readonly onStateUpdate: StateUpdateCallback
  ) {}

  /** Register all workspace event listeners. */
  register(): void {
    const saveListener = vscode.workspace.onDidSaveTextDocument(() => {
      this.handleFileSave();
    });
    this.disposables.push(saveListener);
  }

  /** Fire a code_activity command when any file is saved. */
  private handleFileSave(): void {
    this.bridge.send({ action: "code_activity" }).then((response) => {
      if ("hunger" in response) {
        const state = response as PetState;
        saveState(this.context, state);
        this.onStateUpdate(state);
      }
    }).catch(() => {
      // Silently ignore if the bridge is not ready yet.
    });
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
