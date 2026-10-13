import { memo, type FC } from "react";
import { Button, VisuallyHidden } from "@agent-starter/design-system";

import { useAppDispatch, useAppSelector } from "../../../hooks.ts";
import { selectCurrentRoute } from "../../../router.ts";
import { MenuIcon } from "./icons.tsx";
import {
  explorerOpenSet,
  mobileNavOpened,
  selectExplorerOpenPreference,
  selectMobileNavOpen,
  selectViewportBand,
} from "../redux.ts";
import { crumbLabelForRoute } from "../nav.ts";

const Breadcrumb: FC = memo(() => {
  const route = useAppSelector((state) => selectCurrentRoute(state as never));
  const label = crumbLabelForRoute(route?.name ?? null);
  return (
    <nav className="client-shell-crumbs" aria-label="Breadcrumb">
      <ol>
        <li>
          <span aria-current="page">{label}</span>
        </li>
      </ol>
    </nav>
  );
});
Breadcrumb.displayName = "Breadcrumb";

export const ShellTopbar: FC = () => {
  const dispatch = useAppDispatch();
  const band = useAppSelector(selectViewportBand);
  const mobileOpen = useAppSelector(selectMobileNavOpen);
  const explorerPref = useAppSelector(selectExplorerOpenPreference);
  return (
    <header className="client-shell-topbar">
      {band === "mobile" ? (
        <Button
          type="button"
          variant="ghost"
          aria-expanded={mobileOpen}
          aria-controls="client-shell-drawer"
          onClick={() => dispatch(mobileNavOpened())}
        >
          <MenuIcon />
          <VisuallyHidden>Open navigation</VisuallyHidden>
        </Button>
      ) : null}
      <Breadcrumb />
      {band === "desktop" ? (
        <Button
          type="button"
          variant="ghost"
          aria-pressed={explorerPref}
          onClick={() => dispatch(explorerOpenSet(!explorerPref))}
        >
          {explorerPref ? "Hide explorer" : "Show explorer"}
        </Button>
      ) : null}
    </header>
  );
};
