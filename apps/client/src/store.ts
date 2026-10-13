import {
  configureStore,
  type EnhancedStore,
  type ThunkDispatch,
  type UnknownAction,
} from "@reduxjs/toolkit";
import type { RouterDispatchExtension } from "typed-redux-router";

import { registerAdmitAppStore } from "./modules/navigation/admit.ts";
import { appReduxRecorder } from "./debug/redux-recorder.ts";
import { authReducer, createAuthMiddleware } from "./modules/auth/redux.ts";
import {
  createNavigationMiddleware,
  navigationReducer,
} from "./modules/navigation/redux.ts";
import {
  appOriginSet,
  createSessionMiddleware,
  sessionReducer,
} from "./modules/session/redux.ts";
import type { AppExtra } from "./modules/live/extra.ts";
import {
  appApi,
  createBrowserLiveClient,
  createLiveMiddleware,
  liveScopesReducer,
  type LiveClient,
} from "./modules/live/public.ts";
import { createShellMiddleware, shellReducer } from "./modules/shell/redux.ts";
import {
  router,
  type AppRouter,
  type AppRouterState,
  type AppRoutes,
} from "./router.ts";

export interface AppRootState {
  router: AppRouterState;
  session: ReturnType<typeof sessionReducer>;
  navigation: ReturnType<typeof navigationReducer>;
  shell: ReturnType<typeof shellReducer>;
  auth: ReturnType<typeof authReducer>;
  live: ReturnType<typeof liveScopesReducer>;
  api: ReturnType<typeof appApi.reducer>;
}

export interface AppStoreOptions {
  router?: AppRouter;
  origin?: string;
  fetch?: typeof globalThis.fetch;
  live?: LiveClient;
  openExternalUrl?: (url: string) => void;
  restartSession?: () => void;
}

export type AppStore = Omit<EnhancedStore<AppRootState>, "dispatch"> & {
  dispatch: RouterDispatchExtension<AppRoutes> &
    ThunkDispatch<AppRootState, AppExtra, UnknownAction>;
};

export type AppDispatch = AppStore["dispatch"];

export function createAppStore(options: AppStoreOptions = {}): AppStore {
  const instance = options.router ?? router;
  const origin =
    options.origin ??
    (globalThis as { window?: { location: { origin: string } } }).window
      ?.location.origin ??
    "http://localhost:5173";
  const live =
    options.live ??
    createBrowserLiveClient(globalThis.WebSocket);
  const extra: AppExtra = {
    origin,
    fetch: options.fetch ?? globalThis.fetch.bind(globalThis),
    live,
    liveHandles: new Map(),
    ...(options.restartSession
      ? { restartSession: options.restartSession }
      : {}),
    ...(options.openExternalUrl
      ? { openExternalUrl: options.openExternalUrl }
      : {
          openExternalUrl: (url: string) => {
            (
              globalThis as {
                window?: { location: { assign(href: string): void } };
              }
            ).window?.location.assign(url);
          },
        }),
  };
  const store = configureStore({
    reducer: {
      router: instance.reducer,
      session: sessionReducer,
      navigation: navigationReducer,
      shell: shellReducer,
      auth: authReducer,
      live: liveScopesReducer,
      api: appApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument: extra,
        },
      }).concat(
        appApi.middleware,
        instance.middleware,
        createLiveMiddleware(extra),
        createShellMiddleware(),
        createSessionMiddleware(),
        createAuthMiddleware(),
        createNavigationMiddleware(instance),
      ),
    enhancers: (getDefaultEnhancers) =>
      getDefaultEnhancers().concat(appReduxRecorder.enhancer),
  }) as AppStore;
  extra.subscribe = (listener) => store.subscribe(listener);
  store.dispatch(appOriginSet(origin));
  registerAdmitAppStore(store);
  appReduxRecorder.attachStore(store.getState.bind(store));
  return store;
}
