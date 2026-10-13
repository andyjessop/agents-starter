import { livePath, type LiveScope } from "@agent-starter/live";

import type { DemoCataloguePage, Session } from "../../api-types.ts";
import type { LiveClient, LiveClose, LiveHandle, LiveSnapshotFrame } from "./client.ts";

export class FakeLiveClient implements LiveClient {
  private readonly snapshots = new Map<string, LiveSnapshotFrame>();
  private readonly handles = new Set<FakeHandle>();
  private readonly held = new Set<string>();
  private readonly failures = new Map<string, { message: string; status: number }>();

  constructor() {
    this.seedDefaults();
  }

  set(scope: LiveScope, data: Record<string, unknown>, revision?: number): void {
    const path = livePath(scope);
    const previous = this.snapshots.get(path);
    const frame = {
      revision: revision ?? (previous?.revision ?? 0) + 1,
      data,
    };
    this.snapshots.set(path, frame);
    this.failures.delete(path);
    if (this.held.has(path)) {
      return;
    }
    for (const handle of this.handles) {
      if (handle.path === path) {
        handle.push(frame);
      }
    }
  }

  fail(scope: LiveScope, message: string, status = 401): void {
    const path = livePath(scope);
    this.failures.set(path, { message, status });
    for (const handle of this.handles) {
      if (handle.path === path) {
        handle.fail(message, status);
      }
    }
  }

  connect(scope: LiveScope, _origin: string): LiveHandle {
    const path = livePath(scope);
    const failure = this.failures.get(path);
    if (failure) {
      return new FailedHandle(failure.message, failure.status);
    }
    const handle = new FakeHandle(path, this.snapshots.get(path), this.handles);
    this.handles.add(handle);
    return handle;
  }

  seedSession(session: Session): void {
    this.set({ kind: "session" }, session as unknown as Record<string, unknown>);
  }

  seedDemoCatalogue(page: DemoCataloguePage): void {
    this.set(
      { kind: "demo-catalogue" },
      page as unknown as Record<string, unknown>,
    );
  }

  private seedDefaults(): void {
    this.seedDemoCatalogue({
      items: [
        {
          id: "demo_1",
          title: "Welcome",
          summary: "Replace this catalogue with your own live scope.",
        },
      ],
    });
  }
}

class FailedHandle implements LiveHandle {
  readonly first: Promise<LiveSnapshotFrame>;
  readonly closed: Promise<LiveClose>;
  readonly open = false;

  constructor(message: string, code: number) {
    const close = { code: code === 401 ? 4001 : 4003, reason: message };
    this.first = Promise.reject(new Error(`LIVE_SOCKET_CLOSED:${close.code}`));
    this.closed = Promise.resolve(close);
  }

  subscribe(): () => undefined {
    return () => undefined;
  }

  refresh(): Promise<LiveSnapshotFrame> {
    return this.first;
  }

  close(): void {
    /* noop */
  }
}

class FakeHandle implements LiveHandle {
  readonly path: string;
  readonly first: Promise<LiveSnapshotFrame>;
  readonly closed: Promise<LiveClose>;
  open = true;
  private readonly listeners = new Set<(frame: LiveSnapshotFrame) => void>();
  private resolveFirst!: (frame: LiveSnapshotFrame) => void;
  private rejectFirst!: (error: Error) => void;
  private resolveClosed!: (close: LiveClose) => void;

  constructor(
    path: string,
    initial: LiveSnapshotFrame | undefined,
    registry: Set<FakeHandle>,
  ) {
    this.path = path;
    this.first = new Promise((resolve, reject) => {
      this.resolveFirst = resolve;
      this.rejectFirst = reject;
      if (initial) {
        resolve(initial);
      }
    });
    this.closed = new Promise((resolve) => {
      this.resolveClosed = resolve;
    });
    const remove = () => registry.delete(this);
    this.closed.finally(remove);
  }

  push(frame: LiveSnapshotFrame): void {
    this.resolveFirst(frame);
    for (const listener of this.listeners) {
      listener(frame);
    }
  }

  fail(message: string, status: number): void {
    const code = status === 401 ? 4001 : 4003;
    this.open = false;
    this.rejectFirst(new Error(`LIVE_SOCKET_CLOSED:${code}`));
    this.resolveClosed({ code, reason: message });
  }

  subscribe(onSnapshot: (frame: LiveSnapshotFrame) => void): () => void {
    this.listeners.add(onSnapshot);
    return () => {
      this.listeners.delete(onSnapshot);
    };
  }

  refresh(): Promise<LiveSnapshotFrame> {
    return this.first;
  }

  close(): void {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.resolveClosed({ code: 1000, reason: "closed" });
  }
}
