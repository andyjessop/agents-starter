import { userFacingDetail } from "../../user-facing-error.ts";
import {
  isTerminalLiveRejection,
  liveQueryHttpStatus,
  type LiveQueryResult,
} from "./admission-error.ts";

const DEFAULT_LIVE_WAIT_MS = 20_000;

export type { LiveQueryResult } from "./admission-error.ts";

/** User-facing detail when an RTK live query settles as rejected (transport/load failures only). */
export function liveQueryFailureMessage(
  result: LiveQueryResult<unknown>,
  fallback: string,
): string {
  if (result.status !== "rejected") {
    return fallback;
  }
  const status = liveQueryHttpStatus(result.error);
  if (status === 401 || status === 403 || status === 404) {
    return fallback;
  }
  const error = result.error;
  if (
    error !== null &&
    typeof error === "object" &&
    "data" in error &&
    typeof (error as { data: unknown }).data === "string" &&
    (error as { data: string }).data.length > 0
  ) {
    return userFacingDetail((error as { data: string }).data, fallback);
  }
  if (
    error !== null &&
    typeof error === "object" &&
    "error" in error &&
    typeof (error as { error: unknown }).error === "string" &&
    (error as { error: string }).error.length > 0
  ) {
    return userFacingDetail((error as { error: string }).error, fallback);
  }
  return fallback;
}

export async function waitForLiveQuery<T>(
  store: {
    getState: () => unknown;
    subscribe: (listener: () => void) => () => void;
  },
  select: (state: unknown) => LiveQueryResult<T>,
  isSuperseded: () => boolean,
  options?: { deadlineMs?: number; isReady?: (data: T) => boolean },
): Promise<"ready" | "error" | "superseded"> {
  const deadline = Date.now() + (options?.deadlineMs ?? DEFAULT_LIVE_WAIT_MS);
  const timedOut = (): boolean => Date.now() >= deadline;
  const settle = (result: LiveQueryResult<T>): "ready" | "error" | null => {
    if (result.status === "fulfilled" && result.data !== undefined) {
      if (options?.isReady && !options.isReady(result.data)) {
        return null;
      }
      return "ready";
    }
    if (result.status === "rejected") {
      return isTerminalLiveRejection(result) ? "error" : null;
    }
    return null;
  };
  const finish = (): "ready" | "error" | "superseded" | null => {
    if (isSuperseded()) {
      return "superseded";
    }
    if (timedOut()) {
      return "error";
    }
    return settle(select(store.getState()));
  };
  const first = finish();
  if (first) {
    return first;
  }
  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = store.subscribe(() => {
      const outcome = finish();
      if (outcome) {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        unsubscribe();
        resolve(outcome);
      }
    });
    const scheduleTimeout = (): void => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        const outcome = finish();
        unsubscribe();
        resolve(outcome ?? "error");
        return;
      }
      timeoutId = setTimeout(() => {
        const outcome = finish();
        unsubscribe();
        resolve(outcome ?? "error");
      }, remaining);
    };
    scheduleTimeout();
    if (isSuperseded()) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
      resolve("superseded");
      return;
    }
    const settled = finish();
    if (settled) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      unsubscribe();
      resolve(settled);
    }
  });
}
