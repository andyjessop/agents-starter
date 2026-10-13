import type { Problem } from "../../api-types.ts";
import { AppRequestError } from "../../api.ts";

export interface AppHttpTransport {
  origin: string;
  fetch: typeof globalThis.fetch;
}

export function selectCsrfToken(state: {
  session: { session: { csrfToken: string } | null };
}): string | null {
  return state.session.session?.csrfToken ?? null;
}

export async function appHttp(
  transport: AppHttpTransport,
  path: string,
  init: RequestInit,
  csrfToken?: string,
  idempotencyKey?: string,
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  headers.set("origin", transport.origin);
  if (csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }
  if (idempotencyKey) {
    headers.set("idempotency-key", idempotencyKey);
  }
  const response = await transport.fetch(new URL(path, transport.origin), {
    ...init,
    headers,
    credentials: "include",
  } as RequestInit);
  if (response.status === 204) {
    if (!response.ok) {
      throw new AppRequestError(
        "AUTHORITY_UNAVAILABLE",
        response.status,
        response.headers.get("x-request-id") ?? "",
        "The request could not be completed.",
      );
    }
    return undefined;
  }
  const payload: unknown = await response.json();
  if (!response.ok) {
    const problem = payload as Problem;
    throw new AppRequestError(
      typeof problem.code === "string" ? problem.code : "UNKNOWN",
      response.status,
      typeof problem.requestId === "string" ? problem.requestId : "",
      typeof problem.detail === "string"
        ? problem.detail
        : "The request could not be completed.",
    );
  }
  return payload;
}

export async function appRead<T>(
  transport: AppHttpTransport,
  path: string,
): Promise<T> {
  return (await appHttp(transport, path, { method: "GET" })) as T;
}

export async function appMutate<T>(
  transport: AppHttpTransport,
  path: string,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body: unknown,
  idempotencyKey: string,
  csrfToken: string,
): Promise<T> {
  return (await appHttp(
    transport,
    path,
    method === "DELETE" && body === undefined
      ? { method }
      : {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body ?? {}),
        },
    csrfToken,
    idempotencyKey,
  )) as T;
}

export function requireCsrf(state: {
  session: { session: { csrfToken: string } | null };
}): string {
  const csrf = selectCsrfToken(state);
  if (!csrf) {
    throw new AppRequestError(
      "UNAUTHENTICATED",
      401,
      "",
      "Sign in before mutating.",
    );
  }
  return csrf;
}
