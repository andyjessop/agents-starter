import { useEffect, type FC } from "react";

import { useAppDispatch } from "../../../hooks.ts";
import {
  explorerOpenSet,
  railCollapsedSet,
  viewportBandSet,
  type ShellViewportBand,
} from "../redux.ts";

const MOBILE_QUERY = "(max-width: 899px)";
const MID_QUERY = "(min-width: 900px) and (max-width: 1099px)";

function bandFromViewport(): ShellViewportBand {
  if (window.matchMedia(MOBILE_QUERY).matches) {
    return "mobile";
  }
  if (window.matchMedia(MID_QUERY).matches) {
    return "mid";
  }
  return "desktop";
}

function readStoredRailCollapsed(): boolean {
  try {
    return localStorage.getItem("agent-starter-shell-rail-collapsed") === "1";
  } catch {
    return false;
  }
}

function readStoredExplorerOpen(): boolean {
  try {
    const value = localStorage.getItem("agent-starter-shell-explorer-open");
    return value === null ? true : value === "1";
  } catch {
    return true;
  }
}

export const ShellViewportSync: FC = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(railCollapsedSet(readStoredRailCollapsed()));
    dispatch(explorerOpenSet(readStoredExplorerOpen()));
    const publish = (): void => {
      dispatch(viewportBandSet(bandFromViewport()));
    };
    publish();
    const mobile = window.matchMedia(MOBILE_QUERY);
    const mid = window.matchMedia(MID_QUERY);
    mobile.addEventListener("change", publish);
    mid.addEventListener("change", publish);
    return () => {
      mobile.removeEventListener("change", publish);
      mid.removeEventListener("change", publish);
    };
  }, [dispatch]);

  return null;
};
