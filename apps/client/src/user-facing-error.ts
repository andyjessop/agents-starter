/** Machine-oriented detail (codes, socket labels) must not reach product UI. */
const INTERNAL_ALL_CAPS =
  /^[A-Z][A-Z0-9_]*(?::\d+)?$/;

const INTERNAL_LOWERCASE_TOKENS = new Set([
  "unauthenticated",
]);

/**
 * True when `detail` is an implementation label, not copy meant for operators.
 */
export function looksLikeInternalErrorDetail(detail: string): boolean {
  const trimmed = detail.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith("LIVE_")) {
    return true;
  }
  if (INTERNAL_ALL_CAPS.test(trimmed)) {
    return true;
  }
  if (INTERNAL_LOWERCASE_TOKENS.has(trimmed)) {
    return true;
  }
  if (trimmed === "Request failed.") {
    return true;
  }
  return false;
}

/** Map wire or thrown detail to copy safe to show in the app UI. */
export function userFacingDetail(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (raw === null || raw === undefined) {
    return fallback;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0 || looksLikeInternalErrorDetail(trimmed)) {
    return fallback;
  }
  return trimmed;
}
