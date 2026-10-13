import {
  createRouter,
  q,
  route,
  type RouteName,
  type RouterState,
  type TypedRouter,
} from "typed-redux-router";

import { admitNavigation } from "./modules/navigation/admit.ts";

function guard(context: {
  url: string;
  signal: AbortSignal;
}): Promise<boolean> {
  return admitNavigation(context);
}

export const routes = {
  entry: route("/", {
    title: "Agent Starter",
    shouldNavigate: guard,
  }),
  home: route("/home", {
    title: "Home",
    shouldNavigate: guard,
  }),
  signIn: route("/sign-in", {
    title: "Sign in",
    query: {
      returnTo: q.optional(q.string),
    },
    shouldNavigate: guard,
  }),
  createAccount: route("/create-account", {
    title: "Create account",
    shouldNavigate: guard,
  }),
  checkEmail: route("/check-email", {
    title: "Check your email",
    shouldNavigate: guard,
  }),
  resetPassword: route("/reset-password", {
    title: "Reset password",
    query: {
      token: q.optional(q.string),
    },
    shouldNavigate: guard,
  }),
  notFound: route("/404", {
    title: "Not found",
    shouldNavigate: guard,
  }),
} as const;

export type AppRoutes = typeof routes;
export type AppRouteName = RouteName<AppRoutes>;
export type AppRouterState = RouterState<AppRoutes>;
export type AppRouter = TypedRouter<AppRoutes>;

export const router = createRouter({
  routes,
  fallback: "notFound",
});

export function selectRouteName(state: { router: AppRouterState }): AppRouteName | null {
  return state.router.current?.name ?? null;
}

export function selectCurrentRoute(state: { router: AppRouterState }) {
  return state.router.current;
}

type Matched = AppRouterState["current"];

export function routeChanged(current: Matched, previous: Matched): boolean {
  if (current === previous) {
    return false;
  }
  if (!current || !previous) {
    return current !== previous;
  }
  return (
    current.name !== previous.name ||
    JSON.stringify(current.params) !== JSON.stringify(previous.params) ||
    JSON.stringify(current.query) !== JSON.stringify(previous.query)
  );
}

export function createAppRouter(): AppRouter {
  return createRouter({ routes, fallback: "notFound", browser: null });
}
