import type { FC } from "react";
import { Button, Stack, Typography } from "@agent-starter/design-system";

import { useAppDispatch, useAppSelector } from "../../hooks.ts";
import { router } from "../../router.ts";
import {
  selectRouteReadiness,
  type RouteRecovery,
  type RouteOutcome,
} from "./redux.ts";

export const SwitchNotice: FC = () => {
  const notice = useAppSelector((state) => state.navigation.switchNotice);
  if (!notice) {
    return null;
  }
  return (
    <div className="client-switch-notice" role="status" aria-live="polite">
      <Typography variant="body">{notice}</Typography>
    </div>
  );
};

export const RouteGate: FC = () => {
  const notice = useAppSelector((state) => state.navigation.switchNotice);
  return (
    <div className="client-route-gate" role="status" aria-live="polite">
      <Stack className="client-route-gate-panel">
        <Typography as="h1" variant="heading">
          Loading…
        </Typography>
        {notice ? <Typography variant="body">{notice}</Typography> : null}
      </Stack>
    </div>
  );
};

export const OutcomePanel: FC = () => {
  const outcome = useAppSelector(selectRouteReadiness);
  const message = useAppSelector((state) => state.navigation.message);
  const recovery = useAppSelector((state) => state.navigation.recovery);
  const dispatch = useAppDispatch();
  const resolvedOutcome = outcome === "gated" ? "error" : outcome;
  const title = outcomeTitle(resolvedOutcome, recovery);
  const body =
    message ?? defaultOutcomeMessage(resolvedOutcome, recovery);
  const action = recoveryAction(recovery);
  return (
    <Stack className="client-section">
      <Typography as="h1" variant="heading">
        {title}
      </Typography>
      <Typography variant="body">{body}</Typography>
      {action ? (
        <Button
          type="button"
          onClick={() => {
            void dispatch(action.navigate);
          }}
        >
          {action.label}
        </Button>
      ) : null}
    </Stack>
  );
};

function outcomeTitle(
  outcome: RouteOutcome,
  recovery: RouteRecovery,
): string {
  if (recovery === "signIn") {
    return "Sign in required";
  }
  switch (outcome) {
    case "forbidden":
      return "Access denied";
    case "not-found":
      return "Not found";
    case "signed-out":
      return "Sign in required";
    case "unavailable":
      return "Unavailable";
    default:
      return "Something went wrong";
  }
}

function defaultOutcomeMessage(
  outcome: RouteOutcome,
  recovery: RouteRecovery,
): string {
  if (recovery === "signIn") {
    return "Sign in to continue.";
  }
  switch (outcome) {
    case "forbidden":
      return "You do not have access to this page.";
    case "not-found":
      return "This page could not be found.";
    case "signed-out":
      return "Sign in to continue.";
    case "unavailable":
      return "This page is unavailable.";
    default:
      return "This page could not be loaded.";
  }
}

function recoveryAction(
  recovery: RouteRecovery,
): { label: string; navigate: ReturnType<typeof router.navigate> } | null {
  switch (recovery) {
    case "home":
      return { label: "Go home", navigate: router.navigate("home") };
    case "signIn":
      return { label: "Sign in", navigate: router.navigate("signIn") };
    default:
      return null;
  }
}
