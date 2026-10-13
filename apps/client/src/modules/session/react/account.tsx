import { useEffect, useRef, type FC, type ReactNode } from "react";
import { Avatar, Button, Popover, Typography } from "@agent-starter/design-system";

import { useAppDispatch, useAppSelector } from "../../../hooks.ts";
import { router } from "../../../router.ts";
import {
  accountMenuClosed,
  accountMenuOpenChanged,
  selectAccountMenuOpen,
  signOut,
} from "../redux.ts";

function initialsFrom(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export const AccountSummary: FC<{ compact?: boolean; menu?: ReactNode }> = ({
  compact = false,
  menu,
}) => {
  const dispatch = useAppDispatch();
  const panel = useRef<{ show: () => void; hide: () => void }>(null);
  const menuOpen = useAppSelector(selectAccountMenuOpen);
  const status = useAppSelector((state) => state.session.status);
  const session = useAppSelector((state) => state.session.session);
  const switching = useAppSelector((state) => state.session.switching);
  const switchError = useAppSelector((state) => state.session.switchError);

  useEffect(() => {
    const handle = panel.current;
    if (!handle) {
      return;
    }
    if (menuOpen) {
      handle.show();
    } else {
      handle.hide();
    }
  }, [menuOpen]);

  const name =
    session?.displayName || session?.email || (status === "ready" ? "Signed in" : "Signed out");

  return (
    <Popover
      ref={panel}
      label="Account menu"
      onOpenChange={(open) => {
        dispatch(accountMenuOpenChanged(open));
        if (!open) {
          dispatch(accountMenuClosed());
        }
      }}
      trigger={
        <button
          type="button"
          className="client-shell-account-trigger"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <Avatar alt={name} fallback={initialsFrom(name)} />
          {!compact && (
            <span className="client-shell-account-label">
              <Typography as="span" variant="body">
                {name}
              </Typography>
              {session?.email ? (
                <Typography as="span" variant="caption">
                  {session.email}
                </Typography>
              ) : null}
            </span>
          )}
        </button>
      }
    >
      <div className="client-shell-account-menu" role="menu">
        {menu}
        {session ? (
          <Button
            type="button"
            variant="ghost"
            disabled={switching}
            onClick={() => {
              void dispatch(signOut());
            }}
          >
            {switching ? "Signing out…" : "Sign out"}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void dispatch(router.navigate("signIn"));
            }}
          >
            Sign in
          </Button>
        )}
        {switchError ? (
          <Typography variant="caption" role="alert">
            {switchError}
          </Typography>
        ) : null}
      </div>
    </Popover>
  );
};
