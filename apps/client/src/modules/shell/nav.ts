import type { AppRouteName } from "../../router.ts";

export const PUBLIC_DOCS_ORIGIN = "https://github.com";
export const PUBLIC_HELP_HREF = `${PUBLIC_DOCS_ORIGIN}/`;

export type ShellNavId = "home";

export type ShellNavIcon = "grid" | "help";

export interface ShellNavItem {
  id: ShellNavId;
  label: string;
  route: "home";
  icon: ShellNavIcon;
}

export const primaryNavItems: readonly ShellNavItem[] = [
  { id: "home", label: "Home", route: "home", icon: "grid" },
] as const;

export function primaryNavIdForRoute(routeName: AppRouteName | null): ShellNavId | null {
  if (routeName === "home") {
    return "home";
  }
  return null;
}

export function crumbLabelForRoute(routeName: AppRouteName | null): string {
  switch (routeName) {
    case null:
    case "entry":
      return "Agent Starter";
    case "home":
      return "Home";
    case "signIn":
      return "Sign in";
    case "createAccount":
      return "Create account";
    case "checkEmail":
      return "Check your email";
    case "resetPassword":
      return "Reset password";
    case "notFound":
      return "Not found";
    default:
      return "Agent Starter";
  }
}
