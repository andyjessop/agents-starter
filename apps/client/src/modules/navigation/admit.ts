import { loadWorkspace } from "../session/redux.ts";
import { appApi } from "../live/api.ts";
import { resolveLiveAdmissionFailure } from "../live/admission-error.ts";
import { waitForLiveQuery } from "../live/wait.ts";
import type { AppStore } from "../../store.ts";
import { router } from "../../router.ts";
import {
  navigationPreparationBegan,
  navigationSettled,
  type RouteOutcome,
  type RouteRecovery,
} from "./redux.ts";

let registeredStore: AppStore | null = null;

export function registerAdmitAppStore(store: AppStore): void {
  registeredStore = store;
}

export function unregisterAdmitAppStore(store: AppStore): void {
  if (registeredStore === store) {
    registeredStore = null;
  }
}

const AUTH_ROUTES = new Set([
  "signIn",
  "createAccount",
  "checkEmail",
  "resetPassword",
]);

function settle(
  store: AppStore,
  outcome: RouteOutcome,
  message?: string | null,
  recovery?: RouteRecovery,
): void {
  store.dispatch(
    navigationSettled({
      outcome,
      message: message ?? null,
      locator: null,
      recovery: recovery ?? null,
    }),
  );
}

async function ensureWorkspace(store: AppStore, signal: AbortSignal): Promise<boolean> {
  const sessionState = store.getState().session;
  if (sessionState.status === "ready" || sessionState.status === "error") {
    return sessionState.session !== null;
  }
  try {
    await store.dispatch(loadWorkspace()).unwrap();
    return store.getState().session.session !== null;
  } catch {
    if (signal.aborted) {
      return false;
    }
    return false;
  }
}

async function waitDemoCatalogue(store: AppStore, signal: AbortSignal): Promise<boolean> {
  const result = await waitForLiveQuery(
    store,
    (state) => appApi.endpoints.liveDemoCatalogue.select()(state as never),
    () => signal.aborted,
  );
  if (result !== "ready") {
    const failure = resolveLiveAdmissionFailure(
      (endpoint) => {
        if (endpoint === "liveDemoCatalogue") {
          return appApi.endpoints.liveDemoCatalogue.select()(store.getState() as never);
        }
        return appApi.endpoints.liveSession.select()(store.getState() as never);
      },
      { resource: "demo-catalogue" },
    );
    settle(store, failure.outcome, failure.message, failure.recovery);
    return false;
  }
  return true;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: route admission branches
export async function admitNavigation(context: {
  url: string;
  signal: AbortSignal;
  store?: AppStore;
}): Promise<boolean> {
  const store = context.store ?? registeredStore;
  if (!store) {
    return true;
  }
  const match = router.match(context.url);
  if (!match) {
    store.dispatch(
      navigationPreparationBegan({
        routeName: "notFound",
      }),
    );
    settle(store, "not-found", "This page could not be found.", null);
    return false;
  }
  store.dispatch(
    navigationPreparationBegan({
      routeName: match.name,
    }),
  );
  if (context.signal.aborted) {
    return false;
  }

  const signedIn = await ensureWorkspace(store, context.signal);
  if (context.signal.aborted) {
    return false;
  }

  if (AUTH_ROUTES.has(match.name)) {
    if (signedIn && match.name !== "resetPassword") {
      void store.dispatch(router.navigate("home"));
      settle(store, "ready");
      return false;
    }
    settle(store, "ready");
    return true;
  }

  if (match.name === "entry") {
    void store.dispatch(router.navigate(signedIn ? "home" : "signIn"));
    settle(store, "ready");
    return false;
  }

  if (!signedIn) {
    void store.dispatch(
      router.navigate("signIn", {
        query: { returnTo: context.url },
      }),
    );
    settle(store, "signed-out", "Sign in to continue.", "signIn");
    return false;
  }

  if (match.name === "home") {
    const ok = await waitDemoCatalogue(store, context.signal);
    if (!ok) {
      return false;
    }
  }

  settle(store, "ready");
  return true;
}
