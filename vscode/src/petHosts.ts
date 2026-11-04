/**
 * petHosts.ts
 *
 * Tracks every webview currently showing the pet — the sidebar view and, when
 * opened, an editor tab (codotchi.openInEditor).  Cursor reserves its
 * secondary sidebar for its own agent, so an editor tab dragged into a
 * right-hand group is the best home there.  Messages go to every host so the
 * two stay in sync.
 *
 * No vscode import, so it can be unit-tested directly.
 */

/** One place the pet is rendered. */
export interface PetHost {
  /** Send a message to this host's webview. */
  postMessage(message: unknown): void;
  /** Whether the host is on screen right now. */
  readonly visible: boolean;
}

export class PetHostSet<H extends PetHost = PetHost> {
  private readonly hosts = new Set<H>();

  add(host: H): void {
    this.hosts.add(host);
  }

  remove(host: H): void {
    this.hosts.delete(host);
  }

  get size(): number {
    return this.hosts.size;
  }

  /** Send a message to every host. */
  broadcast(message: unknown): void {
    for (const host of this.hosts) {
      host.postMessage(message);
    }
  }

  /** True when at least one host is on screen — the pet is only deep idle when none are. */
  anyVisible(): boolean {
    for (const host of this.hosts) {
      if (host.visible) { return true; }
    }
    return false;
  }
}
