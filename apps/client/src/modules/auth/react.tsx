import type { FC } from "react";
import { useEffect, useRef } from "react";
import {
  Alert,
  Button,
  Stack,
  TextField,
  Typography,
} from "@agent-starter/design-system";

import { useAppDispatch, useAppSelector } from "../../hooks.ts";
import { router } from "../../router.ts";
import { PageHeader } from "../../shared/components/page-header.tsx";
import {
  authConfirmPasswordChanged,
  authEmailChanged,
  authPasswordChanged,
  selectAuth,
  submitCreateAccount,
  submitForgotPassword,
  submitResetPassword,
  submitSignIn,
  turnstileTokenSet,
} from "./redux.ts";
import "./auth.css";

export const SignInPage: FC = () => {
  const auth = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();
  const submitting = auth.status === "submitting";
  return (
      <Stack className="app-section app-auth">
      <PageHeader description="Use the email and password for your account.">
        Sign in
      </PageHeader>
      <form
        className="app-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void dispatch(submitSignIn());
        }}
      >
        <AuthFields />
        <TurnstileField />
        <Button type="submit" disabled={submitting || auth.status === "loading"}>
          Sign in
        </Button>
      </form>
      <AuthError />
      <Stack direction="row" className="app-inline-actions">
        <Button
          variant="ghost"
          onClick={() => {
            void dispatch(router.navigate("createAccount"));
          }}
        >
          Create account
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void dispatch(router.navigate("resetPassword"));
          }}
        >
          Forgot password
        </Button>
      </Stack>
    </Stack>
  );
};

export const CreateAccountPage: FC = () => {
  const auth = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();
  const submitting = auth.status === "submitting";
  return (
    <Stack className="app-section app-auth">
      <PageHeader description="We will send a verification link. Signing in is a separate step after you use that link.">
        Create account
      </PageHeader>
      <form
        className="app-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void dispatch(submitCreateAccount());
        }}
      >
        <AuthFields confirm />
        <TurnstileField />
        <Button type="submit" disabled={submitting || auth.status === "loading"}>
          Create account
        </Button>
      </form>
      <AuthError />
      <Button
        variant="ghost"
        onClick={() => {
          void dispatch(router.navigate("signIn"));
        }}
      >
        Already have an account
      </Button>
    </Stack>
  );
};

export const CheckEmailPage: FC = () => {
  const dispatch = useAppDispatch();
  return (
    <Stack className="app-section app-auth">
      <PageHeader description="If that address can be used, we sent a message. The link expires and can be used once. It does not sign you in.">
        Check your email
      </PageHeader>
      <Button
        variant="ghost"
        onClick={() => {
          void dispatch(router.navigate("signIn"));
        }}
      >
        Back to sign in
      </Button>
    </Stack>
  );
};

export const ResetPasswordPage: FC = () => {
  const auth = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();
  const submitting = auth.status === "submitting";
  const setPassword = auth.resetToken.length > 0;
  return (
    <Stack className="app-section app-auth">
      <PageHeader
        description={
          setPassword
            ? "Choose a new password. You will sign in afterwards."
            : "If that address has an account, we will send a reset link."
        }
      >
        {setPassword ? "Set a password" : "Reset password"}
      </PageHeader>
      <form
        className="app-auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void dispatch(
            setPassword ? submitResetPassword() : submitForgotPassword(),
          );
        }}
      >
        {setPassword ? <AuthFields confirm passwordOnly /> : <AuthFields emailOnly />}
        <TurnstileField />
        <Button type="submit" disabled={submitting || auth.status === "loading"}>
          {setPassword ? "Set password" : "Send reset link"}
        </Button>
      </form>
      <AuthError />
      <Button
        variant="ghost"
        onClick={() => {
          void dispatch(router.navigate("signIn"));
        }}
      >
        Back to sign in
      </Button>
    </Stack>
  );
};

const AuthFields: FC<{
  confirm?: boolean;
  emailOnly?: boolean;
  passwordOnly?: boolean;
}> = ({ confirm = false, emailOnly = false, passwordOnly = false }) => {
  const auth = useAppSelector(selectAuth);
  const dispatch = useAppDispatch();
  return (
    <>
      {passwordOnly ? null : (
        <TextField
          label="Email"
          name="email"
          type="email"
          passwordManager="username"
          value={auth.email}
          onChange={(event) => {
            dispatch(authEmailChanged(event.target.value));
          }}
        />
      )}
      {emailOnly ? null : (
        <TextField
          label="Password"
          name="password"
          type="password"
          passwordManager={confirm ? "new-password" : "current-password"}
          value={auth.password}
          onChange={(event) => {
            dispatch(authPasswordChanged(event.target.value));
          }}
        />
      )}
      {confirm ? (
        <TextField
          label="Confirm password"
          name="confirmPassword"
          type="password"
          passwordManager="new-password"
          value={auth.confirmPassword}
          onChange={(event) => {
            dispatch(authConfirmPasswordChanged(event.target.value));
          }}
        />
      ) : null}
    </>
  );
};

const AuthError: FC = () => {
  const auth = useAppSelector(selectAuth);
  if (!auth.error) {
    return null;
  }
  return (
    <Alert tone="danger">
      {auth.error}
      {auth.requestId ? ` Request ${auth.requestId}.` : ""}
    </Alert>
  );
};

// The Turnstile API script must load exactly once per page: duplicate
// executions break widget rendering (the challenge iframe never mounts).
let turnstileApiScript: Promise<void> | undefined;

function loadTurnstileApi(): Promise<void> {
  turnstileApiScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      turnstileApiScript = undefined;
      reject(new Error("TURNSTILE_SCRIPT_FAILED"));
    });
    document.head.append(script);
  });
  return turnstileApiScript;
}

const TurnstileField: FC = () => {
  const siteKey = useAppSelector((state) => state.auth.turnstileSiteKey);
  const resetEpoch = useAppSelector(
    (state) => state.auth.turnstileResetEpoch,
  );
  const dispatch = useAppDispatch();
  const host = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!siteKey || !host.current) {
      return undefined;
    }
    const node = host.current;
    let cancelled = false;
    let removeWidget: (() => void) | undefined;
    loadTurnstileApi()
      .then(() => {
        if (cancelled) {
          return;
        }
        const turnstile = (
          globalThis as {
            turnstile?: {
              render: (
                container: HTMLElement,
                options: { sitekey: string; callback: (token: string) => void },
              ) => string;
              remove: (id: string) => void;
              reset: (id?: string) => void;
            };
          }
        ).turnstile;
        if (!turnstile) {
          return;
        }
        const widgetId = turnstile.render(node, {
          sitekey: siteKey,
          callback: (token) => {
            dispatch(turnstileTokenSet(token));
          },
        });
        widgetIdRef.current = widgetId;
        removeWidget = () => {
          turnstile.remove(widgetId);
        };
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      removeWidget?.();
      removeWidget = undefined;
      widgetIdRef.current = null;
    };
  }, [dispatch, siteKey]);
  useEffect(() => {
    // A rejected auth mutation consumes the token; re-run the check so a
    // fresh token is issued instead of leaving a stale "checked" widget.
    if (resetEpoch === 0) {
      return;
    }
    const turnstile = (
      globalThis as {
        turnstile?: { reset: (id?: string) => void };
      }
    ).turnstile;
    const widgetId = widgetIdRef.current;
    if (!turnstile || !widgetId) {
      return;
    }
    try {
      turnstile.reset(widgetId);
    } catch {
      return;
    }
  }, [resetEpoch]);
  if (!siteKey) {
    return null;
  }
  return (
    <div className="app-auth-turnstile">
      <Typography variant="caption">Complete the check to continue.</Typography>
      <div ref={host} />
    </div>
  );
};
