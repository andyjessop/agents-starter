import {
  LIVE_REFRESH_CURSOR,
  livePath,
  parseLiveWireFrame,
  type LiveScope,
} from "@agent-starter/live";

export interface LiveSnapshotFrame {
  revision: number;
  data: Record<string, unknown>;
}

export interface LiveClose {
  code: number;
  reason: string;
}

export interface LiveHandle {
  first: Promise<LiveSnapshotFrame>;
  closed: Promise<LiveClose>;
  readonly open: boolean;
  subscribe(onSnapshot: (frame: LiveSnapshotFrame) => void): () => void;
  refresh(): Promise<LiveSnapshotFrame>;
  close(): void;
}

export interface LiveClient {
  connect(scope: LiveScope, origin: string): LiveHandle;
}

function wsUrl(origin: string, scope: LiveScope): string {
  const url = new URL(livePath(scope), origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function readSnapshot(raw: string): LiveSnapshotFrame {
  const frame = parseLiveWireFrame(JSON.parse(raw) as unknown);
  if (frame?.type !== "snapshot") {
    throw new Error(frame?.type === "error" ? frame.code : "INVALID_LIVE_FRAME");
  }
  const data =
    frame.data !== undefined &&
    typeof frame.data === "object" &&
    !Array.isArray(frame.data)
      ? frame.data
      : {};
  return { revision: frame.revision, data };
}

const reconnectBackoffMs = [250, 500, 1_000, 2_000, 4_000];

export function liveReconnectDelay(attempt: number): number {
  return reconnectBackoffMs[Math.min(attempt, reconnectBackoffMs.length - 1)] ?? 4_000;
}

export function createBrowserLiveClient(socket: typeof WebSocket): LiveClient {
  return {
    connect(scope, origin) {
      const connection = new socket(wsUrl(origin, scope));
      const listeners = new Set<(frame: LiveSnapshotFrame) => void>();
      const refreshWaiters = new Set<(frame: LiveSnapshotFrame) => void>();
      let revision = -1;
      let data: Record<string, unknown> | undefined;
      let closed = false;
      let resolveFirst: (frame: LiveSnapshotFrame) => void = () => undefined;
      let rejectFirst: (error: Error) => void = () => undefined;
      let resolveClosed: (close: LiveClose) => void = () => undefined;
      const first = new Promise<LiveSnapshotFrame>((resolve, reject) => {
        resolveFirst = resolve;
        rejectFirst = reject;
      });
      const closedPromise = new Promise<LiveClose>((resolve) => {
        resolveClosed = resolve;
      });
      connection.addEventListener("open", () => {
        if (closed) {
          return;
        }
        connection.send(
          JSON.stringify({ type: "more", cursor: LIVE_REFRESH_CURSOR }),
        );
      });
      connection.addEventListener("message", (event) => {
        const frame = readSnapshot(String(event.data));
        if (frame.revision < revision) {
          return;
        }
        revision = frame.revision;
        data = frame.data;
        resolveFirst(frame);
        for (const waiter of [...refreshWaiters]) {
          waiter(frame);
        }
        for (const listener of listeners) {
          listener(frame);
        }
      });
      connection.addEventListener("error", () => {
        rejectFirst(new Error("LIVE_SOCKET_ERROR"));
        refreshWaiters.clear();
      });
      connection.addEventListener("close", (event) => {
        closed = true;
        const close = { code: event.code, reason: event.reason };
        rejectFirst(new Error(`LIVE_SOCKET_CLOSED:${close.code}`));
        resolveClosed(close);
      });
      return {
        first,
        closed: closedPromise,
        get open() {
          return !closed;
        },
        subscribe(onSnapshot) {
          if (data !== undefined) {
            onSnapshot({ revision, data });
          }
          listeners.add(onSnapshot);
          return () => {
            listeners.delete(onSnapshot);
          };
        },
        refresh() {
          if (closed) {
            return Promise.reject(new Error("LIVE_SOCKET_CLOSED"));
          }
          if (data !== undefined) {
            return Promise.resolve({ revision, data });
          }
          return new Promise<LiveSnapshotFrame>((resolve, reject) => {
            refreshWaiters.add(resolve);
            connection.send(
              JSON.stringify({ type: "more", cursor: LIVE_REFRESH_CURSOR }),
            );
            first.catch(reject);
          });
        },
        close() {
          if (!closed) {
            connection.close();
          }
        },
      };
    },
  };
}
