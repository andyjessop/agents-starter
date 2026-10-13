import type { RouteOutcome } from "../navigation/redux.ts";

export type LiveQueryResult<T> = {
  status: string;
  data?: T;
  error?: unknown;
};

export type LiveAdmissionResource = "demo-catalogue";

export function liveSocketCloseToHttpStatus(closeCode: number): number | null {
  if (closeCode === 4001) {
    return 401;
  }
  if (closeCode === 4003) {
    return 403;
  }
  if (closeCode === 4004) {
    return 404;
  }
  return null;
}

export function liveQueryHttpStatus(error: unknown): number | null {
  if (
    error !== null &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return null;
}

export function isTerminalLiveRejection(result: LiveQueryResult<unknown>): boolean {
  if (result.status !== "rejected") {
    return false;
  }
  const status = liveQueryHttpStatus(result.error);
  if (status === 401 || status === 403 || status === 404) {
    return true;
  }
  if (result.error instanceof Error) {
    return !isRecoverableLiveError(result.error);
  }
  return true;
}

export function isRecoverableLiveError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.message === "LIVE_SOCKET_ERROR") {
    return true;
  }
  return /^LIVE_SOCKET_CLOSED:\d+$/.test(error.message);
}

export function resolveLiveAdmissionFailure(
  select: (endpoint: string) => LiveQueryResult<unknown>,
  options: { resource: LiveAdmissionResource },
): { outcome: RouteOutcome; message: string; recovery: "signIn" | "home" | null } {
  const endpoint =
    options.resource === "demo-catalogue" ? "liveDemoCatalogue" : "liveSession";
  const result = select(endpoint);
  if (result.status === "rejected") {
    const status =
      result.error !== null &&
      typeof result.error === "object" &&
      "status" in result.error &&
      typeof (result.error as { status: unknown }).status === "number"
        ? (result.error as { status: number }).status
        : null;
    if (status === 401) {
      return {
        outcome: "signed-out",
        message: "Sign in to continue.",
        recovery: "signIn",
      };
    }
    if (status === 403) {
      return {
        outcome: "forbidden",
        message: "You do not have access to this page.",
        recovery: "home",
      };
    }
  }
  return {
    outcome: "unavailable",
    message: "This page is unavailable.",
    recovery: null,
  };
}
