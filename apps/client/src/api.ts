import { userFacingDetail } from "./user-facing-error.ts";

export class AppRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;

  constructor(code: string, status: number, requestId: string, detail: string) {
    super(detail);
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

/** Rebuild a request error from RTK Query unwrap payloads or thrown AppRequestError. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: unwrap payloads nest status, data and problem fields
export function appRequestFromUnknown(error: unknown): AppRequestError | null {
  if (error instanceof AppRequestError) {
    return error;
  }
  if (error === null || typeof error !== "object") {
    return null;
  }
  const record = error as {
    status?: unknown;
    data?: unknown;
    error?: unknown;
    code?: unknown;
    requestId?: unknown;
    message?: unknown;
  };
  const status = typeof record.status === "number" ? record.status : null;
  const nested =
    record.data !== null && typeof record.data === "object"
      ? (record.data as {
          detail?: unknown;
          code?: unknown;
          requestId?: unknown;
        })
      : null;
  const detailFromData =
    typeof record.data === "string"
      ? record.data
      : typeof nested?.detail === "string"
        ? nested.detail
        : null;
  const detail =
    detailFromData ??
    (typeof record.error === "string" ? record.error : null) ??
    (typeof record.message === "string" ? record.message : null);
  const code =
    typeof record.code === "string"
      ? record.code
      : typeof nested?.code === "string"
        ? nested.code
        : null;
  const requestId =
    typeof record.requestId === "string"
      ? record.requestId
      : typeof nested?.requestId === "string"
        ? nested.requestId
        : "";
  if (status === null && detail === null && code === null) {
    return null;
  }
  return new AppRequestError(
    code ?? "REQUEST_FAILED",
    status ?? 500,
    requestId,
    detail ?? "The request could not be completed.",
  );
}

export function appFailure(
  error: unknown,
  fallback: string,
): { detail: string; requestId: string | null; code?: string; status?: number } {
  const request = appRequestFromUnknown(error);
  if (!request) {
    return { detail: fallback, requestId: null };
  }
  return {
    detail: userFacingDetail(request.message, fallback),
    requestId: request.requestId.length > 0 ? request.requestId : null,
    code: request.code,
    status: request.status,
  };
}

export function idempotencyKey(): string {
  return crypto.randomUUID();
}
