import {
  livePath,
  parseLivePath,
  type LiveScope,
} from "@agent-starter/live";

import type { AppRouteName } from "../../router.ts";

export type { LiveScope };
export { livePath, parseLivePath };

export function liveScopeKey(scope: LiveScope): string {
  return livePath(scope);
}

export function liveScopesEqual(left: LiveScope[], right: LiveScope[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const keys = new Set(left.map(liveScopeKey));
  return right.every((scope) => keys.has(liveScopeKey(scope)));
}

/** Live sockets required for a signed-in route. */
export function liveScopesForRoute(input: {
  signedIn: boolean;
  routeName: AppRouteName | null;
}): LiveScope[] {
  if (!input.signedIn) {
    return [];
  }
  const scopes: LiveScope[] = [{ kind: "session" }];
  if (input.routeName === "home") {
    scopes.push({ kind: "demo-catalogue" });
  }
  return scopes;
}
