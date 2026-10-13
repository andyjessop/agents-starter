import { type LiveScope, parseLivePath } from "./live.ts";

export type LiveSnapshotFrame = {
  type: "snapshot";
  revision: number;
  data?: Record<string, unknown>;
};

export type LiveErrorFrame = {
  type: "error";
  code: string;
  detail?: string;
};

export type LiveMoreFrame = {
  type: "more";
  cursor: string;
};

export type LiveWireFrame = LiveSnapshotFrame | LiveErrorFrame | LiveMoreFrame;

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: wire frame discriminated union
export function parseLiveWireFrame(raw: unknown): LiveWireFrame | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const record = raw as { type?: unknown };
  if (record.type === "snapshot") {
    const revision = (raw as { revision?: unknown }).revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision)) {
      return undefined;
    }
    const data = (raw as { data?: unknown }).data;
    return {
      type: "snapshot",
      revision,
      ...(data !== undefined && typeof data === "object" && !Array.isArray(data)
        ? { data: data as Record<string, unknown> }
        : {}),
    };
  }
  if (record.type === "error") {
    const code = (raw as { code?: unknown }).code;
    if (typeof code !== "string") {
      return undefined;
    }
    const detail = (raw as { detail?: unknown }).detail;
    return {
      type: "error",
      code,
      ...(typeof detail === "string" ? { detail } : {}),
    };
  }
  if (record.type === "more") {
    const cursor = (raw as { cursor?: unknown }).cursor;
    if (typeof cursor !== "string") {
      return undefined;
    }
    return { type: "more", cursor };
  }
  return undefined;
}

export function encodeLiveSnapshot(
  revision: number,
  data: Record<string, unknown>,
): string {
  return JSON.stringify({
    type: "snapshot",
    revision,
    data,
  } satisfies LiveSnapshotFrame);
}

export function encodeLiveError(code: string, detail?: string): string {
  return JSON.stringify({
    type: "error",
    code,
    ...(detail === undefined ? {} : { detail }),
  } satisfies LiveErrorFrame);
}

export type LiveAttachment = {
  scope: LiveScope;
  tokenHash: string;
  revision: number;
  cursor?: string;
};

export function readLiveAttachment(value: unknown): LiveAttachment | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as {
    scope?: unknown;
    tokenHash?: unknown;
    revision?: unknown;
    cursor?: unknown;
  };
  const scopePath = typeof record.scope === "string" ? record.scope : undefined;
  if (!scopePath) {
    return undefined;
  }
  const scope = parseLivePath(scopePath);
  if (
    !scope ||
    typeof record.tokenHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.tokenHash) ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0
  ) {
    return undefined;
  }
  return {
    scope,
    tokenHash: record.tokenHash,
    revision: record.revision,
    ...(typeof record.cursor === "string" ? { cursor: record.cursor } : {}),
  };
}
