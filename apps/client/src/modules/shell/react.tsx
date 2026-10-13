import type { FC, ReactNode } from "react";
import {
  Drawer,
  PermanentDrawer,
  Theme,
  VisuallyHidden,
} from "@agent-starter/design-system";

import { useAppDispatch, useAppSelector } from "../../hooks.ts";
import { ShellExplorer } from "./react/explorer.tsx";
import { RailBody } from "./react/rail.tsx";
import {
  mobileNavClosed,
  selectMobileNavOpen,
  selectRailCompact,
  selectShowExplorer,
  selectShowPermanentRail,
  selectViewportBand,
} from "./redux.ts";
import { ShellStatusLine } from "./react/status-line.tsx";
import { ShellTopbar } from "./react/topbar.tsx";
import { ShellViewportSync } from "./react/viewport.tsx";
import { SwitchNotice } from "../navigation/react.tsx";
import { PUBLIC_DOCS_ORIGIN, PUBLIC_HELP_HREF } from "./nav.ts";
import "./shell.css";
import "./chrome.css";

export { PUBLIC_DOCS_ORIGIN, PUBLIC_HELP_HREF };

export const Shell: FC<{
  children: ReactNode;
  /** Appearance / theme / development controls composed into the account menu. */
  accountMenu?: ReactNode;
}> = ({ children, accountMenu }) => {
  const dispatch = useAppDispatch();
  const showRail = useAppSelector(selectShowPermanentRail);
  const showExplorer = useAppSelector(selectShowExplorer);
  const compact = useAppSelector(selectRailCompact);
  const mobileOpen = useAppSelector(selectMobileNavOpen);
  const band = useAppSelector(selectViewportBand);
  const skipTargetId = "app-main-content";

  return (
    <Theme
      className="app-shell"
      data-shell-band={band}
      data-shell-compact={compact ? "true" : "false"}
      data-shell-explorer={showExplorer ? "true" : "false"}
    >
      <ShellViewportSync />
      <a
        className="app-shell-skip"
        href={`#${skipTargetId}`}
        onClick={(event) => {
          event.preventDefault();
          document.getElementById(skipTargetId)?.focus();
        }}
      >
        Skip to content
      </a>
      <div className="app-shell-frame">
        {showRail && (
          <PermanentDrawer
            className="app-shell-rail"
            aria-label="Primary navigation"
            data-compact={compact ? "true" : undefined}
          >
            <RailBody accountMenu={accountMenu} />
          </PermanentDrawer>
        )}

        <div className="app-shell-stage">
          <ShellTopbar />
          <main id={skipTargetId} className="app-shell-main" tabIndex={-1}>
            <SwitchNotice />
            <div className="app-shell-page">{children}</div>
          </main>
          <ShellStatusLine />
        </div>

        {showExplorer ? <ShellExplorer /> : null}
      </div>

      {band === "mobile" && mobileOpen ? (
        <Drawer
          controlled
          invokerId="app-mobile-menu"
          className="app-shell-mobile-drawer"
          title="Navigation"
          closeLabel="Close navigation"
          backdropDismiss
          onOpenChange={(next) => {
            if (!next) {
              dispatch(mobileNavClosed());
            }
          }}
        >
          <div id="app-mobile-nav" className="app-shell-mobile-rail">
            <RailBody
              accountMenu={accountMenu}
              onNavigate={() => {
                dispatch(mobileNavClosed());
              }}
            />
          </div>
          <VisuallyHidden>
            <span>Use Escape or the close control to dismiss navigation.</span>
          </VisuallyHidden>
        </Drawer>
      ) : null}
    </Theme>
  );
};
