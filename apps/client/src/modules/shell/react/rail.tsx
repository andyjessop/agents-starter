import type { FC, ReactNode } from "react";

import { Button } from "@agent-starter/design-system";

import { useAppDispatch, useAppSelector } from "../../../hooks.ts";
import { AccountSummary } from "../../session/react/account.tsx";
import { BrandMark, ChevronIcon, ShellIcon } from "./icons.tsx";
import { primaryNavItems, PUBLIC_HELP_HREF, type ShellNavItem } from "../nav.ts";
import {
  railCollapsedSet,
  selectPrimaryNavId,
  selectRailCollapsedPreference,
  selectRailCompact,
  selectViewportBand,
} from "../redux.ts";
import { router } from "../../../router.ts";

export const RailBrand: FC<{ compact?: boolean }> = ({ compact = false }) => (
  <a
    className="client-shell-brand"
    href={router.href("entry")}
    aria-label="Agent Starter home"
  >
    <BrandMark className="client-shell-brand-mark" />
    {!compact && (
      <span className="client-shell-brand-lockup">
        <strong>Agent Starter</strong>
        <small>Redux-first SPA scaffold</small>
      </span>
    )}
  </a>
);

const NavGroup: FC<{
  label: string;
  items: readonly ShellNavItem[];
  hrefFor: (item: ShellNavItem) => string;
  compact: boolean;
  onNavigate?: () => void;
  current: string | null;
}> = (props) => {
  return (
    <div className="client-shell-nav-group">
      {!props.compact && (
        <p className="client-shell-nav-label">{props.label}</p>
      )}
      <ul className="client-shell-nav-list">
        {props.items.map((item) => {
          const selected = props.current === item.id;
          return (
            <li key={item.id}>
              <a
                className="client-shell-nav-link"
                href={props.hrefFor(item)}
                aria-current={selected ? "page" : undefined}
                aria-label={item.label}
                data-compact-tip={props.compact ? item.label : undefined}
                onClick={props.onNavigate}
              >
                <ShellIcon name={item.icon} className="client-shell-nav-icon" />
                {!props.compact && <span>{item.label}</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const RailNav: FC<{
  compact?: boolean;
  id?: string;
  onNavigate?: () => void;
}> = ({ compact = false, id, onNavigate }) => {
  const current = useAppSelector(selectPrimaryNavId);
  const hrefFor = (item: ShellNavItem) => router.href(item.route);
  return (
    <nav className="client-shell-nav" id={id} aria-label="Primary">
      <NavGroup
        label="App"
        items={primaryNavItems}
        hrefFor={hrefFor}
        compact={compact}
        onNavigate={onNavigate}
        current={current}
      />
      <div className="client-shell-nav-group">
        {!compact && <p className="client-shell-nav-label">Help</p>}
        <ul className="client-shell-nav-list">
          <li>
            <a
              className="client-shell-nav-link"
              href={PUBLIC_HELP_HREF}
              target="_blank"
              rel="noreferrer"
              aria-label="Documentation"
              data-compact-tip={compact ? "Documentation" : undefined}
            >
              <ShellIcon name="help" className="client-shell-nav-icon" />
              {!compact && <span>Documentation</span>}
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export const RailBody: FC<{
  accountMenu?: ReactNode;
  onNavigate?: () => void;
}> = ({ accountMenu, onNavigate }) => {
  const dispatch = useAppDispatch();
  const compact = useAppSelector(selectRailCompact);
  const band = useAppSelector(selectViewportBand);
  const collapsedPref = useAppSelector(selectRailCollapsedPreference);
  const showCollapse = band !== "mobile";
  return (
    <div className="client-shell-rail-body">
      <div className="client-shell-rail-head">
        <RailBrand compact={compact} />
        {showCollapse ? (
          <Button
            type="button"
            variant="ghost"
            aria-label={collapsedPref ? "Expand rail" : "Collapse rail"}
            onClick={() => dispatch(railCollapsedSet(!collapsedPref))}
          >
            <ChevronIcon />
          </Button>
        ) : null}
      </div>
      <RailNav compact={compact} onNavigate={onNavigate} />
      <div className="client-shell-rail-foot">
        <AccountSummary compact={compact} menu={accountMenu} />
      </div>
    </div>
  );
};
