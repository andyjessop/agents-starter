import {
  createListenerMiddleware,
  createSlice,
  type Middleware,
  type PayloadAction,
} from "@reduxjs/toolkit";

import type { AppRouteName } from "../../router.ts";
import type { AppExtra } from "./extra.ts";
import {
  liveScopeKey,
  liveScopesEqual,
  liveScopesForRoute,
  type LiveScope,
} from "./scopes.ts";
import { appApi } from "./api.ts";

export interface LiveScopesState {
  scopes: LiveScope[];
}

type LiveStoreReader = {
  live: LiveScopesState;
  session: {
    session: unknown | null;
    status: string;
    identityEpoch: number;
  };
  navigation: {
    phase: string;
    intendedRouteName: string | null;
  };
  router: {
    status?: string;
    current: { name: AppRouteName; params: Record<string, string> } | null;
    pending?: { name: AppRouteName; params: Record<string, string> } | null;
  };
};

const initialState: LiveScopesState = { scopes: [] };

const liveScopesSlice = createSlice({
  name: "live",
  initialState,
  reducers: {
    liveScopesSynced(state, action: PayloadAction<LiveScope[]>) {
      state.scopes = action.payload;
    },
    liveSessionEnsured(state) {
      if (!state.scopes.some((scope) => scope.kind === "session")) {
        state.scopes = [{ kind: "session" }, ...state.scopes];
      }
    },
    liveScopesCleared(state) {
      state.scopes = [];
    },
  },
});

export const { liveScopesSynced, liveSessionEnsured, liveScopesCleared } =
  liveScopesSlice.actions;
export const liveScopesReducer = liveScopesSlice.reducer;

export const selectLiveScopes = (state: {
  live: LiveScopesState;
}): LiveScope[] => state.live.scopes;

export function liveScopesFromStore(state: LiveStoreReader): LiveScope[] {
  const signedIn =
    state.session.session !== null || state.session.status === "loading";
  const navigating = state.router.status === "navigating";
  const preparing = state.navigation.phase === "preparing";
  const inFlight = preparing || navigating;
  const route = navigating
    ? (state.router.pending ?? state.router.current)
    : state.router.current;
  const routeName = preparing
    ? ((state.navigation.intendedRouteName as AppRouteName | null) ??
      route?.name ??
      null)
    : (route?.name ?? null);
  return liveScopesForRoute({
    signedIn: signedIn || Boolean(inFlight && routeName),
    routeName,
  });
}

function initiateScope(
  dispatch: (action: never) => { unsubscribe: () => void },
  scope: LiveScope,
): { unsubscribe: () => void } {
  switch (scope.kind) {
    case "session":
      return dispatch(appApi.endpoints.liveSession.initiate() as never);
    case "demo-catalogue":
      return dispatch(appApi.endpoints.liveDemoCatalogue.initiate() as never);
    default: {
      const exhaustive: never = scope;
      return exhaustive;
    }
  }
}

function closeLiveHandles(extra: AppExtra): void {
  for (const handle of extra.liveHandles.values()) {
    handle.close();
  }
  extra.liveHandles.clear();
}

function registerLiveScopeListeners(
  listeners: ReturnType<typeof createListenerMiddleware<LiveStoreReader>>,
  extra: AppExtra,
): void {
  const subscriptions = new Map<string, () => void>();

  const syncSubscriptions = (
    dispatch: (action: never) => { unsubscribe: () => void },
    scopes: LiveScope[],
  ): void => {
    const wanted = new Set(scopes.map(liveScopeKey));
    for (const [key, unsubscribe] of subscriptions) {
      if (!wanted.has(key)) {
        unsubscribe();
        subscriptions.delete(key);
      }
    }
    for (const scope of scopes) {
      const key = liveScopeKey(scope);
      if (subscriptions.has(key)) {
        continue;
      }
      const result = initiateScope(dispatch, scope);
      subscriptions.set(key, () => result.unsubscribe());
    }
  };

  listeners.startListening({
    predicate: (_action, current, previous) =>
      !liveScopesEqual(current.live.scopes, previous.live.scopes),
    effect: (_action, listenerApi) => {
      syncSubscriptions(
        listenerApi.dispatch as (action: never) => { unsubscribe: () => void },
        listenerApi.getState().live.scopes,
      );
    },
  });
  listeners.startListening({
    predicate: (_action, current, previous) =>
      !liveScopesEqual(
        liveScopesFromStore(current),
        liveScopesFromStore(previous),
      ) || current.session.identityEpoch !== previous.session.identityEpoch,
    effect: (_action, listenerApi) => {
      const next = liveScopesFromStore(listenerApi.getState());
      if (
        liveScopesEqual(next, listenerApi.getState().live.scopes) &&
        listenerApi.getState().session.identityEpoch ===
          listenerApi.getOriginalState().session.identityEpoch
      ) {
        return;
      }
      if (
        listenerApi.getOriginalState().session.session !== null &&
        listenerApi.getState().session.identityEpoch !==
          listenerApi.getOriginalState().session.identityEpoch
      ) {
        for (const unsubscribe of subscriptions.values()) {
          unsubscribe();
        }
        subscriptions.clear();
        closeLiveHandles(extra);
        listenerApi.dispatch(liveScopesCleared());
        listenerApi.dispatch(appApi.util.resetApiState());
      }
      listenerApi.dispatch(liveScopesSynced(next));
      syncSubscriptions(
        listenerApi.dispatch as (action: never) => { unsubscribe: () => void },
        next,
      );
    },
  });
}

export function createLiveMiddleware(extra: AppExtra): Middleware {
  const listeners = createListenerMiddleware<LiveStoreReader>();
  registerLiveScopeListeners(listeners, extra);
  return listeners.middleware;
}
