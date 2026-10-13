export type LiveScope = { kind: "session" } | { kind: "demo-catalogue" };

export const LIVE_TOKEN_HASH_HEADER = "x-agent-starter-live-token-hash";
export const LIVE_REFRESH_CURSOR = "*";

export function parseLivePath(pathname: string): LiveScope | undefined {
  const parts = pathname.split("/").filter((part) => part.length > 0);
  if (parts[0] !== "v1" || parts[1] !== "live") {
    return undefined;
  }
  if (parts.length === 3 && parts[2] === "session") {
    return { kind: "session" };
  }
  if (parts.length === 3 && parts[2] === "demo-catalogue") {
    return { kind: "demo-catalogue" };
  }
  return undefined;
}

export function livePath(scope: LiveScope): string {
  switch (scope.kind) {
    case "session":
      return "/v1/live/session";
    case "demo-catalogue":
      return "/v1/live/demo-catalogue";
    default: {
      const exhaustive: never = scope;
      return exhaustive;
    }
  }
}

export function liveScopeKey(scope: LiveScope): string {
  return livePath(scope);
}

export function parseLiveClientFrame(
  text: string,
): { type: "more"; cursor: string } | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    (parsed as { type?: unknown }).type === "more" &&
    typeof (parsed as { cursor?: unknown }).cursor === "string"
  ) {
    return {
      type: "more",
      cursor: (parsed as { cursor: string }).cursor,
    };
  }
  return undefined;
}

export function serializeLiveAttachment(attachment: {
  scope: LiveScope;
  tokenHash: string;
  revision: number;
  cursor?: string;
}): {
  scope: string;
  tokenHash: string;
  revision: number;
  cursor?: string;
} {
  return {
    scope: livePath(attachment.scope),
    tokenHash: attachment.tokenHash,
    revision: attachment.revision,
    ...(attachment.cursor === undefined ? {} : { cursor: attachment.cursor }),
  };
}
