import {
  createApi,
  fakeBaseQuery,
  type QueryReturnValue,
} from "@reduxjs/toolkit/query";
import type { LiveScope } from "@agent-starter/live";

import type { AuthConfig, DemoCataloguePage, Session } from "../../api-types.ts";
import {
  appFailure,
  AppRequestError,
  idempotencyKey,
} from "../../api.ts";
import {
  isRecoverableLiveError,
  liveSocketCloseToHttpStatus,
} from "./admission-error.ts";
import type { LiveScope as ClientLiveScope } from "./scopes.ts";
import type { AppExtra } from "./extra.ts";
import { appHttp, appMutate, appRead, requireCsrf } from "./http.ts";
import { liveReconnectDelay, type LiveHandle } from "./client.ts";

function extraOf(api: { extra: unknown }): AppExtra {
  return api.extra as AppExtra;
}

function liveKey(endpoint: string, arg: unknown): string {
  return `${endpoint}:${JSON.stringify(arg ?? null)}`;
}

function liveError(
  error: unknown,
): QueryReturnValue<
  never,
  { status: string | number; error?: string; data?: string },
  Record<string, never>
> {
  let status: string | number = "CUSTOM_ERROR";
  if (error instanceof Error) {
    const closed = error.message.match(/^LIVE_SOCKET_CLOSED:(\d+)$/);
    if (closed) {
      const http = liveSocketCloseToHttpStatus(Number(closed[1]));
      if (http !== null) {
        status = http;
      }
    }
  }
  const message = error instanceof Error ? error.message : "LIVE_SOCKET_ERROR";
  return {
    error: {
      status,
      error: message,
      data: message,
    },
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: live socket retries
async function liveQueryFn<T>(
  scope: ClientLiveScope,
  extra: AppExtra,
  endpoint: string,
  arg: unknown,
  forced = false,
): Promise<
  QueryReturnValue<
    T,
    { status: string | number; error?: string; data?: string },
    Record<string, never>
  >
> {
  const key = liveKey(endpoint, arg);
  const existing = extra.liveHandles.get(key);
  if (forced && existing?.open === true) {
    try {
      const frame = await existing.refresh();
      return { data: frame.data as T };
    } catch (error) {
      return liveError(error);
    }
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, liveReconnectDelay(attempt - 1));
      });
    }
    const handle = extra.live.connect(scope, extra.origin);
    extra.liveHandles.set(key, handle);
    try {
      const frame = await handle.first;
      return { data: frame.data as T };
    } catch (error) {
      lastError = error;
      if (extra.liveHandles.get(key) === handle) {
        extra.liveHandles.delete(key);
        handle.close();
      }
      if (!isRecoverableLiveError(error) || attempt === 3) {
        break;
      }
    }
  }
  return liveError(lastError);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: socket subscription lifecycle
async function liveCache(
  endpoint: string,
  arg: unknown,
  scope: LiveScope,
  extra: AppExtra,
  rawApi: object,
): Promise<void> {
  const api = rawApi as {
    cacheDataLoaded: Promise<unknown>;
    cacheEntryRemoved: Promise<unknown>;
    updateCachedData: (recipe: (draft: never) => unknown) => void;
    dispatch: (action: never) => unknown;
  };
  const key = liveKey(endpoint, arg);
  let handle: LiveHandle | undefined;
  let attempt = 0;
  const apply = (frame: { data: Record<string, unknown> }): void => {
    api.updateCachedData((() => frame.data) as (draft: never) => unknown);
  };
  try {
    await api.cacheDataLoaded;
    handle = extra.liveHandles.get(key);
    let gone = false;
    const removed = api.cacheEntryRemoved.then(() => {
      gone = true;
      extra.liveHandles.get(key)?.close();
      extra.liveHandles.delete(key);
      return "removed" as const;
    });
    while (!gone) {
      if (!handle) {
        handle = extra.liveHandles.get(key);
        if (!handle) {
          handle = extra.live.connect(scope, extra.origin);
          extra.liveHandles.set(key, handle);
        }
        let first: { kind: "frame"; frame: { data: Record<string, unknown> } } | "removed";
        try {
          first = await Promise.race([
            handle.first.then((frame) => ({ kind: "frame" as const, frame })),
            removed,
          ]);
        } catch (error) {
          if (extra.liveHandles.get(key) === handle) {
            handle.close();
            extra.liveHandles.delete(key);
          }
          handle = undefined;
          if (!gone && !isRecoverableLiveError(error)) {
            break;
          }
          continue;
        }
        if (gone || first === "removed") {
          break;
        }
        apply(first.frame);
        attempt = 0;
      }
      const stop = handle.subscribe(apply);
      const outcome = await Promise.race([
        handle.closed.then((close) => ({ kind: "closed" as const, close })),
        removed,
      ]);
      stop();
      handle.close();
      extra.liveHandles.delete(key);
      handle = undefined;
      if (gone || outcome === "removed") {
        break;
      }
      if (outcome.close.code === 4001 || outcome.close.code === 4003) {
        api.dispatch({ type: "live/liveScopesCleared" } as never);
        break;
      }
      const waited = await Promise.race([
        new Promise<"delay">((resolve) => {
          setTimeout(resolve, liveReconnectDelay(attempt));
        }),
        removed,
      ]);
      if (gone || waited === "removed") {
        break;
      }
      attempt += 1;
    }
  } finally {
    extra.liveHandles.get(key)?.close();
    extra.liveHandles.delete(key);
  }
}

function mutationError(error: unknown, fallback = "The request could not be completed.") {
  const failed = appFailure(error, fallback);
  const request = error instanceof AppRequestError ? error : null;
  return {
    error: {
      status: request?.status ?? 500,
      data: failed.detail,
      ...(request ? { code: request.code, requestId: request.requestId } : {}),
    },
  };
}

export const appApi = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery<{ status: string | number; error?: string; data?: string }>(),
  keepUnusedDataFor: 0,
  endpoints: (build) => ({
    liveSession: build.query<Session, void>({
      queryFn: (_arg, api) =>
        liveQueryFn(
          { kind: "session" },
          extraOf(api),
          "liveSession",
          null,
          api.forced === true,
        ),
      onCacheEntryAdded: (_arg, api) =>
        liveCache("liveSession", null, { kind: "session" }, extraOf(api), api),
    }),
    liveDemoCatalogue: build.query<DemoCataloguePage, void>({
      queryFn: (_arg, api) =>
        liveQueryFn(
          { kind: "demo-catalogue" },
          extraOf(api),
          "liveDemoCatalogue",
          null,
          api.forced === true,
        ),
      onCacheEntryAdded: (_arg, api) =>
        liveCache(
          "liveDemoCatalogue",
          null,
          { kind: "demo-catalogue" },
          extraOf(api),
          api,
        ),
    }),
    getAuthConfig: build.query<AuthConfig, void>({
      queryFn: async (_arg, api) => {
        try {
          return {
            data: await appRead<AuthConfig>(extraOf(api), "/auth/config"),
          };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),
    signInWithPassword: build.mutation<
      Session,
      { email: string; password: string; turnstileToken?: string }
    >({
      queryFn: async (body, api) => {
        try {
          return {
            data: await appMutate<Session>(
              extraOf(api),
              "/auth/sign-in",
              "POST",
              body,
              idempotencyKey(),
              "",
            ),
          };
        } catch (error) {
          return mutationError(error, "Sign in failed.");
        }
      },
    }),
    signUpWithPassword: build.mutation<
      Session,
      { email: string; password: string; turnstileToken?: string }
    >({
      queryFn: async (body, api) => {
        try {
          return {
            data: await appMutate<Session>(
              extraOf(api),
              "/auth/sign-up",
              "POST",
              body,
              idempotencyKey(),
              "",
            ),
          };
        } catch (error) {
          return mutationError(error, "Could not create the account.");
        }
      },
    }),
    forgotPassword: build.mutation<void, { email: string; turnstileToken?: string }>({
      queryFn: async (body, api) => {
        try {
          await appMutate<void>(
            extraOf(api),
            "/auth/forgot-password",
            "POST",
            body,
            idempotencyKey(),
            "",
          );
          return { data: undefined };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),
    resetPassword: build.mutation<
      void,
      { token: string; password: string; turnstileToken?: string }
    >({
      queryFn: async (body, api) => {
        try {
          await appMutate<void>(
            extraOf(api),
            "/auth/reset-password",
            "POST",
            body,
            idempotencyKey(),
            "",
          );
          return { data: undefined };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),
    logout: build.mutation<void, void>({
      queryFn: async (_arg, api) => {
        try {
          await appHttp(
            extraOf(api),
            "/auth/logout",
            { method: "POST" },
            requireCsrf(api.getState() as never),
          );
          return { data: undefined };
        } catch (error) {
          return mutationError(error);
        }
      },
    }),
  }),
});
