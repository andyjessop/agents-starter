import {
  createAsyncThunk,
  createListenerMiddleware,
  createSlice,
  type Middleware,
  type PayloadAction,
} from "@reduxjs/toolkit";

import { appFailure } from "../../api.ts";
import { routeChanged, router } from "../../router.ts";
import { appApi } from "../live/api.ts";
import type { AppExtra } from "../live/extra.ts";
import {
  isLocalDevOrigin,
  loadWorkspace,
  type SessionState,
} from "../session/redux.ts";

export interface AuthState {
  email: string;
  password: string;
  confirmPassword: string;
  turnstileToken: string;
  /** Bumped each time a rejected auth mutation clears the token so the widget re-issues. */
  turnstileResetEpoch: number;
  resetToken: string;
  turnstileSiteKey: string | null;
  passwordMinLength: number | null;
  status: "idle" | "loading" | "ready" | "submitting" | "error";
  error: string | null;
  requestId: string | null;
}

const initialState: AuthState = {
  email: "",
  password: "",
  confirmPassword: "",
  turnstileToken: "",
  turnstileResetEpoch: 0,
  resetToken: "",
  turnstileSiteKey: null,
  passwordMinLength: null,
  status: "idle",
  error: null,
  requestId: null,
};

const AUTH_ROUTES = new Set([
  "signIn",
  "createAccount",
  "checkEmail",
  "resetPassword",
]);

function failure(
  error: unknown,
  detail: string,
): { detail: string; requestId: string | null } {
  return { detail, requestId: appFailure(error, detail).requestId };
}

export function resolveReturnTo(
  origin: string,
  returnTo: string | undefined,
): { kind: "oauth"; href: string } | { kind: "path"; href: string } | null {
  if (!returnTo?.startsWith("/") || returnTo.startsWith("//")) {
    return null;
  }
  let destination: URL;
  try {
    destination = new URL(returnTo, origin);
  } catch {
    return null;
  }
  if (
    destination.origin !== origin ||
    destination.username ||
    destination.password
  ) {
    return null;
  }
  const href = `${destination.pathname}${destination.search}${destination.hash}`;
  if (destination.pathname === "/oauth" || destination.pathname.startsWith("/oauth/")) {
    return { kind: "oauth", href: destination.href };
  }
  return { kind: "path", href };
}

export const loadAuthConfig = createAsyncThunk<
  { turnstileSiteKey: string | null; passwordMinLength: number },
  void,
  {
    extra: AppExtra;
    rejectValue: { detail: string; requestId: string | null };
  }
>("auth/loadConfig", async (_arg, api) => {
  try {
    return await api
      .dispatch(
        appApi.endpoints.getAuthConfig.initiate(undefined, {
          subscribe: false,
        }),
      )
      .unwrap();
  } catch (error) {
    return api.rejectWithValue(
      failure(error, "Sign-in could not be loaded."),
    );
  }
});

function queryValue(state: unknown, key: string): string | undefined {
  if (state === null || typeof state !== "object" || !("router" in state)) {
    return undefined;
  }
  const current = (state as { router?: { current?: { query?: unknown } } })
    .router?.current?.query;
  if (current === null || typeof current !== "object") {
    return undefined;
  }
  const value = (current as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export const submitSignIn = createAsyncThunk<
  void,
  void,
  {
    extra: AppExtra;
    state: { auth: AuthState; session: SessionState };
    rejectValue: { detail: string; requestId: string | null };
  }
>(
  "auth/signIn",
  async (_arg, api) => {
    const { auth } = api.getState();
    if (auth.turnstileSiteKey && !auth.turnstileToken) {
      return api.rejectWithValue({
        detail: "Complete the check before signing in.",
        requestId: null,
      });
    }
    try {
      await api
        .dispatch(
          appApi.endpoints.signInWithPassword.initiate({
            email: auth.email,
            password: auth.password,
            ...(auth.turnstileToken
              ? { turnstileToken: auth.turnstileToken }
              : {}),
          }),
        )
        .unwrap();
      api.dispatch(appApi.util.resetApiState());
      await api.dispatch(loadWorkspace()).unwrap();
      await followReturn(
        api.extra,
        api.dispatch,
        queryValue(api.getState(), "returnTo"),
      );
    } catch (error) {
      return api.rejectWithValue(
        failure(error, "Sign in failed. Check the details and try again."),
      );
    }
  },
  {
    condition: (_arg, { getState }) =>
      getState().auth.status !== "submitting",
  },
);

export const submitCreateAccount = createAsyncThunk<
  void,
  void,
  {
    extra: AppExtra;
    state: { auth: AuthState };
    rejectValue: { detail: string; requestId: string | null };
  }
>(
  "auth/createAccount",
  async (_arg, api) => {
    const { auth } = api.getState();
    if (auth.password !== auth.confirmPassword) {
      return api.rejectWithValue({
        detail: "The passwords do not match.",
        requestId: null,
      });
    }
    if (
      auth.passwordMinLength !== null &&
      auth.password.length < auth.passwordMinLength
    ) {
      return api.rejectWithValue({
        detail: `Use at least ${auth.passwordMinLength} characters.`,
        requestId: null,
      });
    }
    if (auth.turnstileSiteKey && !auth.turnstileToken) {
      return api.rejectWithValue({
        detail: "Complete the check before creating an account.",
        requestId: null,
      });
    }
    try {
      await api
        .dispatch(
          appApi.endpoints.signUpWithPassword.initiate({
            email: auth.email,
            password: auth.password,
            ...(auth.turnstileToken
              ? { turnstileToken: auth.turnstileToken }
              : {}),
          }),
        )
        .unwrap();
      // Local dev verifies the account at creation (no mailbox), so the
      // ordinary sign-in form completes the journey.
      await api.dispatch(
        router.replace(
          isLocalDevOrigin(api.extra.origin) ? "signIn" : "checkEmail",
        ),
      );
    } catch (error) {
      return api.rejectWithValue(
        failure(error, "The account could not be created. Try again."),
      );
    }
  },
  {
    condition: (_arg, { getState }) =>
      getState().auth.status !== "submitting",
  },
);

export const submitForgotPassword = createAsyncThunk<
  void,
  void,
  {
    extra: AppExtra;
    state: { auth: AuthState };
    rejectValue: { detail: string; requestId: string | null };
  }
>(
  "auth/forgotPassword",
  async (_arg, api) => {
    const { auth } = api.getState();
    if (auth.turnstileSiteKey && !auth.turnstileToken) {
      return api.rejectWithValue({
        detail: "Complete the check before requesting a reset.",
        requestId: null,
      });
    }
    try {
      await api
        .dispatch(
          appApi.endpoints.forgotPassword.initiate({
            email: auth.email,
            ...(auth.turnstileToken
              ? { turnstileToken: auth.turnstileToken }
              : {}),
          }),
        )
        .unwrap();
      await api.dispatch(router.replace("checkEmail"));
    } catch (error) {
      return api.rejectWithValue(
        failure(error, "The reset email could not be sent. Try again."),
      );
    }
  },
  {
    condition: (_arg, { getState }) =>
      getState().auth.status !== "submitting",
  },
);

export const submitResetPassword = createAsyncThunk<
  void,
  void,
  {
    extra: AppExtra;
    state: { auth: AuthState };
    rejectValue: { detail: string; requestId: string | null };
  }
>(
  "auth/resetPassword",
  async (_arg, api) => {
    const { auth } = api.getState();
    if (auth.password !== auth.confirmPassword) {
      return api.rejectWithValue({
        detail: "The passwords do not match.",
        requestId: null,
      });
    }
    if (
      auth.passwordMinLength !== null &&
      auth.password.length < auth.passwordMinLength
    ) {
      return api.rejectWithValue({
        detail: `Use at least ${auth.passwordMinLength} characters.`,
        requestId: null,
      });
    }
    if (!auth.resetToken) {
      return api.rejectWithValue({
        detail: "This reset link is not valid. Request a new one.",
        requestId: null,
      });
    }
    if (auth.turnstileSiteKey && !auth.turnstileToken) {
      return api.rejectWithValue({
        detail: "Complete the check before setting a new password.",
        requestId: null,
      });
    }
    try {
      await api
        .dispatch(
          appApi.endpoints.resetPassword.initiate({
            token: auth.resetToken,
            password: auth.password,
            ...(auth.turnstileToken
              ? { turnstileToken: auth.turnstileToken }
              : {}),
          }),
        )
        .unwrap();
      await api.dispatch(router.replace("signIn"));
    } catch (error) {
      return api.rejectWithValue(
        failure(error, "The password could not be set. Request a new link."),
      );
    }
  },
  {
    condition: (_arg, { getState }) =>
      getState().auth.status !== "submitting",
  },
);

export const followSignedInReturn = createAsyncThunk<
  void,
  string | undefined,
  { extra: AppExtra }
>("auth/followReturn", async (returnTo, api) => {
  await followReturn(api.extra, api.dispatch, returnTo);
});

async function followReturn(
  extra: AppExtra,
  dispatch: (action: unknown) => unknown,
  returnTo: string | undefined,
): Promise<void> {
  const resolved = resolveReturnTo(extra.origin, returnTo);
  if (resolved?.kind === "oauth") {
    extra.openExternalUrl?.(resolved.href);
    return;
  }
  if (resolved?.kind === "path") {
    const matched = router.match(resolved.href);
    if (matched) {
      await dispatch(
        router.replace(matched.name as "entry", {
          params: matched.params,
          query: matched.query,
          hash: matched.hash,
        } as never),
      );
      return;
    }
  }
  await dispatch(router.replace("entry"));
}

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    authEmailChanged(state, action: PayloadAction<string>) {
      state.email = action.payload;
      if (state.status === "error") {
        state.status = state.turnstileSiteKey ? "ready" : "idle";
        state.error = null;
        state.requestId = null;
      }
    },
    authPasswordChanged(state, action: PayloadAction<string>) {
      state.password = action.payload;
      if (state.status === "error") {
        state.status = state.turnstileSiteKey ? "ready" : "idle";
        state.error = null;
        state.requestId = null;
      }
    },
    authConfirmPasswordChanged(state, action: PayloadAction<string>) {
      state.confirmPassword = action.payload;
      if (state.status === "error") {
        state.status = state.turnstileSiteKey ? "ready" : "idle";
        state.error = null;
        state.requestId = null;
      }
    },
    turnstileTokenSet(state, action: PayloadAction<string>) {
      state.turnstileToken = action.payload;
    },
    resetTokenReceived(state, action: PayloadAction<string>) {
      state.resetToken = action.payload;
    },
    authFormReset(state) {
      state.email = "";
      state.password = "";
      state.confirmPassword = "";
      state.turnstileToken = "";
      state.resetToken = "";
      state.error = null;
      state.requestId = null;
      if (state.status === "submitting" || state.status === "error") {
        state.status = state.turnstileSiteKey ? "ready" : "idle";
      }
    },
    resetAuth() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAuthConfig.pending, (state) => {
        state.status = "loading";
        state.error = null;
        state.requestId = null;
      })
      .addCase(loadAuthConfig.fulfilled, (state, action) => {
        state.status = "ready";
        state.turnstileSiteKey = action.payload.turnstileSiteKey;
        state.passwordMinLength = action.payload.passwordMinLength;
        state.error = null;
        state.requestId = null;
      })
      .addCase(loadAuthConfig.rejected, (state, action) => {
        state.status = "error";
        state.error =
          action.payload?.detail ?? "Sign-in could not be loaded.";
        state.requestId = action.payload?.requestId ?? null;
      })
      .addCase(submitSignIn.pending, (state) => {
        state.status = "submitting";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitSignIn.fulfilled, (state) => {
        state.status = "ready";
        state.password = "";
        state.turnstileToken = "";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitSignIn.rejected, (state, action) => {
        if (action.meta.condition) {
          return;
        }
        state.status = "error";
        state.turnstileToken = "";
        state.turnstileResetEpoch += 1;
        state.error =
          action.payload?.detail ??
          "Sign in failed. Check the details and try again.";
        state.requestId = action.payload?.requestId ?? null;
      })
      .addCase(submitCreateAccount.pending, (state) => {
        state.status = "submitting";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitCreateAccount.fulfilled, (state) => {
        state.status = "ready";
        state.password = "";
        state.confirmPassword = "";
        state.turnstileToken = "";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitCreateAccount.rejected, (state, action) => {
        if (action.meta.condition) {
          return;
        }
        state.status = "error";
        state.turnstileToken = "";
        state.turnstileResetEpoch += 1;
        state.error =
          action.payload?.detail ??
          "The account could not be created. Try again.";
        state.requestId = action.payload?.requestId ?? null;
      })
      .addCase(submitForgotPassword.pending, (state) => {
        state.status = "submitting";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitForgotPassword.fulfilled, (state) => {
        state.status = "ready";
        state.turnstileToken = "";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitForgotPassword.rejected, (state, action) => {
        if (action.meta.condition) {
          return;
        }
        state.status = "error";
        state.turnstileToken = "";
        state.turnstileResetEpoch += 1;
        state.error =
          action.payload?.detail ??
          "The reset email could not be sent. Try again.";
        state.requestId = action.payload?.requestId ?? null;
      })
      .addCase(submitResetPassword.pending, (state) => {
        state.status = "submitting";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitResetPassword.fulfilled, (state) => {
        state.status = "ready";
        state.password = "";
        state.confirmPassword = "";
        state.turnstileToken = "";
        state.resetToken = "";
        state.error = null;
        state.requestId = null;
      })
      .addCase(submitResetPassword.rejected, (state, action) => {
        if (action.meta.condition) {
          return;
        }
        state.status = "error";
        state.turnstileToken = "";
        state.turnstileResetEpoch += 1;
        state.error =
          action.payload?.detail ??
          "The password could not be set. Request a new link.";
        state.requestId = action.payload?.requestId ?? null;
      });
  },
});

export const authReducer = authSlice.reducer;
export const {
  authEmailChanged,
  authPasswordChanged,
  authConfirmPasswordChanged,
  turnstileTokenSet,
  resetTokenReceived,
  authFormReset,
  resetAuth,
} = authSlice.actions;

export const selectAuth = (state: { auth: AuthState }): AuthState => state.auth;

type AuthMiddlewareState = {
  auth: AuthState;
  session: SessionState;
  router: {
    current: {
      name?: string;
      query?: Record<string, string | undefined>;
    } | null;
  };
};

type AuthListenerApi = {
  getState: () => AuthMiddlewareState;
  dispatch: (action: unknown) => unknown;
};

async function syncHostedAuthRoute(
  listenerApi: AuthListenerApi,
): Promise<void> {
  const state = listenerApi.getState();
  const current = state.router.current;
  const name = current?.name;
  if (!name || !AUTH_ROUTES.has(name)) {
    listenerApi.dispatch(resetAuth());
    return;
  }
  listenerApi.dispatch(authFormReset());
  const token = current?.query?.token;
  if (name === "resetPassword" && typeof token === "string") {
    listenerApi.dispatch(resetTokenReceived(token));
  }
  if (state.session.session && state.session.status === "ready") {
    if (name === "signIn") {
      await listenerApi.dispatch(
        followSignedInReturn(current?.query?.returnTo) as never,
      );
      return;
    }
    await listenerApi.dispatch(router.replace("entry") as never);
    return;
  }
  if (
    name !== "checkEmail" &&
    listenerApi.getState().auth.turnstileSiteKey === null
  ) {
    await listenerApi.dispatch(loadAuthConfig() as never);
  }
}

export function createAuthMiddleware(): Middleware {
  const listeners = createListenerMiddleware<AuthMiddlewareState>();
  listeners.startListening({
    predicate: (_action, current, previous) =>
      routeChanged(
        current.router.current as never,
        previous.router.current as never,
      ),
    effect: async (_action, listenerApi) => {
      await syncHostedAuthRoute(listenerApi);
    },
  });
  return listeners.middleware;
}
