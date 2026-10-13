import { waitForLiveQuery, type LiveQueryResult } from "./wait.ts";

export interface LiveSubscribeApi {
  dispatch: (action: unknown) => { unsubscribe: () => void };
  getState: () => unknown;
  subscribe: (listener: () => void) => () => void;
}

/** Wait for a live RTK subscription to deliver data (socket owned by onCacheEntryAdded). */
export async function awaitLiveSubscription<TData>(
  api: LiveSubscribeApi,
  select: (state: unknown) => LiveQueryResult<TData>,
  initiate: () => { unsubscribe: () => void },
  options?: {
    deadlineMs?: number;
    isReady?: (data: TData) => boolean;
  },
): Promise<TData> {
  const sub = initiate();
  try {
    const outcome = await waitForLiveQuery(
      { getState: api.getState, subscribe: api.subscribe },
      select,
      () => false,
      options,
    );
    if (outcome !== "ready") {
      const result = select(api.getState());
      if (result.status === "rejected" && result.error !== undefined) {
        throw result.error;
      }
      throw new Error("Live query did not become ready");
    }
    const data = select(api.getState()).data;
    if (data === undefined) {
      throw new Error("Live query ready without data");
    }
    return data;
  } finally {
    sub.unsubscribe();
  }
}

export function liveSubscribeApi(api: {
  dispatch: (action: unknown) => { unsubscribe: () => void };
  extra: unknown;
  getState: () => unknown;
}): LiveSubscribeApi {
  const extra = api.extra as {
    subscribe?: (listener: () => void) => () => void;
  };
  if (!extra.subscribe) {
    throw new Error("AppExtra.subscribe is not configured");
  }
  return {
    dispatch: api.dispatch,
    getState: api.getState,
    subscribe: extra.subscribe,
  };
}

export async function unwrapLive<TData>(
  api: {
    dispatch: (action: unknown) => { unsubscribe: () => void };
    extra: unknown;
    getState: () => unknown;
  },
  select: (state: unknown) => LiveQueryResult<TData>,
  initiate: () => { unsubscribe: () => void },
  options?: {
    deadlineMs?: number;
    isReady?: (data: TData) => boolean;
  },
): Promise<TData> {
  return awaitLiveSubscription(
    liveSubscribeApi(api),
    select,
    initiate,
    options,
  );
}

