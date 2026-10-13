import {
  createListenerMiddleware,
  createSlice,
  type Middleware,
  type PayloadAction,
} from "@reduxjs/toolkit";

import type { AppRouter } from "../../router.ts";
import { userFacingDetail } from "../../user-facing-error.ts";

export type RouteOutcome =
  | "ready"
  | "forbidden"
  | "unavailable"
  | "not-found"
  | "mismatch"
  | "signed-out"
  | "error";

export type RouteRecovery = "home" | "signIn" | null;

function navigationMessageFallback(outcome: RouteOutcome): string {
  switch (outcome) {
    case "forbidden":
      return "You do not have access to this page.";
    case "not-found":
      return "This page could not be found.";
    case "signed-out":
      return "Sign in to continue.";
    case "unavailable":
      return "This page is unavailable.";
    default:
      return "This page could not be loaded.";
  }
}

export interface NavigationState {
  hold: boolean;
  phase: "idle" | "preparing" | "ready";
  outcome: RouteOutcome;
  message: string | null;
  locator: string | null;
  recovery: RouteRecovery;
  intendedRouteName: string | null;
  switchNotice: string | null;
  generation: number;
}

const initialState: NavigationState = {
  hold: false,
  phase: "idle",
  outcome: "ready",
  message: null,
  locator: null,
  recovery: null,
  intendedRouteName: null,
  switchNotice: null,
  generation: 0,
};

const navigationSlice = createSlice({
  name: "navigation",
  initialState,
  reducers: {
    navigationPreparationBegan(
      state,
      action: PayloadAction<{ routeName?: string | null }>,
    ) {
      state.phase = "preparing";
      state.outcome = "ready";
      state.message = null;
      state.recovery = null;
      state.intendedRouteName = action.payload.routeName ?? null;
      state.generation += 1;
    },
    navigationSettled(
      state,
      action: PayloadAction<{
        outcome: RouteOutcome;
        message?: string | null;
        locator?: string | null;
        recovery?: RouteRecovery;
      }>,
    ) {
      state.phase = "ready";
      state.hold = false;
      state.outcome = action.payload.outcome;
      const rawMessage = action.payload.message ?? null;
      state.message =
        rawMessage === null
          ? null
          : userFacingDetail(
              rawMessage,
              navigationMessageFallback(action.payload.outcome),
            );
      state.locator = action.payload.locator ?? null;
      state.recovery = action.payload.recovery ?? null;
      state.switchNotice = null;
    },
    navigationIdentityReset(state) {
      Object.assign(state, initialState);
    },
  },
});

export const {
  navigationPreparationBegan,
  navigationSettled,
  navigationIdentityReset,
} = navigationSlice.actions;

export const navigationReducer = navigationSlice.reducer;

export function selectRouteReadiness(state: {
  navigation: NavigationState;
  router: { status: string; current: unknown };
  session: { switching: boolean };
}): "gated" | "ready" | RouteOutcome {
  if (
    state.session.switching ||
    state.navigation.hold ||
    state.router.status === "navigating" ||
    state.router.current === null ||
    state.navigation.phase === "preparing"
  ) {
    return "gated";
  }
  return state.navigation.outcome;
}

export function createNavigationMiddleware(instance: AppRouter): Middleware {
  const listeners = createListenerMiddleware<{ navigation: NavigationState }>();
  listeners.startListening({
    type: instance.actionTypes.navigationBlocked,
    effect: (_action, listenerApi) => {
      if (listenerApi.getState().navigation.phase !== "preparing") {
        return;
      }
      listenerApi.dispatch(
        navigationSettled({
          outcome: "ready",
          message: null,
          locator: null,
          recovery: null,
        }),
      );
    },
  });
  listeners.startListening({
    type: instance.actionTypes.navigationFailed,
    effect: (_action, listenerApi) => {
      if (listenerApi.getState().navigation.phase !== "preparing") {
        return;
      }
      listenerApi.dispatch(
        navigationSettled({
          outcome: "error",
          message: "This page could not be loaded.",
          locator: null,
          recovery: null,
        }),
      );
    },
  });
  return listeners.middleware;
}
