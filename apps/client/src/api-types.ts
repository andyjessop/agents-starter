/** Wire shapes for the starter mock API. Extend when you add product routes. */

export interface Session {
  userId: string;
  email: string;
  displayName: string;
  csrfToken: string;
}

export interface AuthConfig {
  turnstileSiteKey: string | null;
  passwordMinLength: number;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
  detail: string;
  requestId: string;
}

export interface DemoCataloguePage {
  items: Array<{ id: string; title: string; summary: string }>;
}

export function isProblem(value: unknown): value is Problem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.code === "string" &&
    typeof record.detail === "string" &&
    typeof record.status === "number"
  );
}
