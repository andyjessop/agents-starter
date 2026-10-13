import {
  createAsyncThunk,
  createListenerMiddleware,
  createSlice,
  type Middleware,
  type PayloadAction,
} from "@reduxjs/toolkit";

import type { Session } from "../../api-types.ts";
import { appFailure, appRequestFromUnknown } from "../../api.ts";
import { appApi } from "../live/api.ts";
import { appRead } from "../live/http.ts";
import { unwrapLive } from "../live/subscribe.ts";
import { navigationIdentityReset } from "../navigation/redux.ts";

export type { AppExtra } from "../live/extra.ts";

export interface SessionState {
  session: Session | null;
  identityEpoch: number;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  requestId: string | null;
  switching: boolean;
  switchError: string | null;
  accountMenuOpen: boolean;
  appOrigin: string;
}

const initialState: SessionState = {
  session: null,
  identityEpoch: 0,
  status: "idle",
  error: null,
  requestId: null,
  switching: false,
  switchError: null,
  accountMenuOpen: false,
  appOrigin: "",
};

export function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

function isUnauthenticated(error: unknown): boolean {
  const request = appRequestFromUnknown(error);
  if (request?.status === 401) {
    return true;
  }
  const message = request?.message ?? (error instanceof Error ? error.message : "");
  return message.includes("UNAUTHENTICATED") || message.includes("401");
}

function failure(error: unknown): { detail: string; requestId: string | null } {
  const failed = appFailure(error, "The workspace could not be loaded.");
  return { detail: failed.detail, requestId: failed.requestId };
}

async function readLiveSession(api: {
  dispatch: (action: unknown) => { unsubscribe: () => void };
  extra: unknown;
  getState: () => unknown;
}): Promise<Session> {
  return unwrapLive(
    api,
    (state) => appApi.endpoints.liveSession.select()(state as never),
    () => api.dispatch(appApi.endpoints.liveSession.initiate()),
    { deadlineMs: 4_000 },
  );
}

export const loadWorkspace = createAsyncThunk<
  Session,
  void,
  {
    extra: import("../live/extra.ts").AppExtra;
    rejectValue: { detail: string; requestId: string | null };
  }
>("session/loadWorkspace", async (_arg, api) => {
  try {
    return await appRead<Session>(api.extra, "/v1/session");
  } catch (error) {
    if (isUnauthenticated(error)) {
      return api.rejectWithValue(failure(error));
    }
  }
  try {
    return await readLiveSession(api);
  } catch (error) {
    return api.rejectWithValue(failure(error));
  }
});

export const signOut = createAsyncThunk<
  void,
  void,
  {
    extra: import("../live/extra.ts").AppExtra;
    state: { session: SessionState };
    rejectValue: string;
  }
>(
  "session/signOut",
  async (_arg, api) => {
    try {
      await api.dispatch(appApi.endpoints.logout.initiate()).unwrap();
      api.extra.restartSession?.();
    } catch {
      return api.rejectWithValue("Could not sign out. Try again.");
    }
  },
  { condition: (_arg, api) => !api.getState().session.switching },
);

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    accountMenuOpened(state) {
      state.accountMenuOpen = true;
    },
    accountMenuClosed(state) {
      state.accountMenuOpen = false;
    },
    accountMenuOpenChanged(state, action: PayloadAction<boolean>) {
      state.accountMenuOpen = action.payload;
    },
    appOriginSet(state, action: PayloadAction<string>) {
      state.appOrigin = action.payload;
    },
    sessionReplaced(state, action: PayloadAction<Session>) {
      if (
        state.session !== null &&
        state.session.userId !== action.payload.userId
      ) {
        state.identityEpoch += 1;
      }
      state.session = action.payload;
      state.status = "ready";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signOut.pending, (state) => {
        state.switching = true;
        state.switchError = null;
      })
      .addCase(signOut.fulfilled, (state) => {
        state.session = null;
        state.identityEpoch += 1;
        state.accountMenuOpen = false;
        state.switching = false;
      })
      .addCase(signOut.rejected, (state, action) => {
        state.switching = false;
        state.switchError = action.payload ?? "Could not sign out.";
      })
      .addCase(loadWorkspace.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadWorkspace.fulfilled, (state, action) => {
        state.status = "ready";
        state.session = action.payload;
        state.error = null;
        state.requestId = null;
      })
      .addCase(loadWorkspace.rejected, (state, action) => {
        state.status = "error";
        state.session = null;
        state.error =
          action.payload?.detail ?? "The workspace could not be loaded.";
        state.requestId = action.payload?.requestId ?? null;
      });
  },
});

export const {
  accountMenuOpened,
  accountMenuClosed,
  accountMenuOpenChanged,
  appOriginSet,
  sessionReplaced,
} = sessionSlice.actions;

export const sessionReducer = sessionSlice.reducer;

export const selectAccountMenuOpen = (state: { session: SessionState }): boolean =>
  state.session.accountMenuOpen;

export function createSessionMiddleware(): Middleware {
  const listeners = createListenerMiddleware<{ session: SessionState }>();
  listeners.startListening({
    actionCreator: signOut.fulfilled,
    effect: (_action, listenerApi) => {
      listenerApi.dispatch(navigationIdentityReset());
      listenerApi.dispatch(appApi.util.resetApiState());
    },
  });
  listeners.startListening({
    predicate: (_action, current, previous) => {
      const cur = appApi.endpoints.liveSession.select()(current as never).data;
      const prev = appApi.endpoints.liveSession.select()(previous as never).data;
      return cur !== prev && cur !== undefined;
    },
    effect: (_action, listenerApi) => {
      const session = appApi.endpoints.liveSession.select()(
        listenerApi.getState() as never,
      ).data;
      if (session) {
        listenerApi.dispatch(sessionReplaced(session));
      }
    },
  });
  return listeners.middleware;
}
