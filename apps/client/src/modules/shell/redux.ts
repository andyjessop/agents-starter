import {
  createSlice,
  type Middleware,
  type PayloadAction,
} from "@reduxjs/toolkit";

import { selectCurrentRoute, type AppRouteName } from "../../router.ts";
import { primaryNavIdForRoute as navIdForRoute, type ShellNavId } from "./nav.ts";

export type ShellViewportBand = "desktop" | "mid" | "mobile";

export interface ShellState {
  viewportBand: ShellViewportBand;
  railCollapsed: boolean;
  mobileNavOpen: boolean;
  explorerOpen: boolean;
}

export const SHELL_RAIL_STORAGE_KEY = "agent-starter-shell-rail-collapsed";
export const SHELL_EXPLORER_STORAGE_KEY = "agent-starter-shell-explorer-open";

const initialState: ShellState = {
  viewportBand: "desktop",
  railCollapsed: false,
  mobileNavOpen: false,
  explorerOpen: true,
};

const shellSlice = createSlice({
  name: "shell",
  initialState,
  reducers: {
    viewportBandSet(state, action: PayloadAction<ShellViewportBand>) {
      state.viewportBand = action.payload;
    },
    railCollapsedSet(state, action: PayloadAction<boolean>) {
      state.railCollapsed = action.payload;
    },
    mobileNavOpened(state) {
      state.mobileNavOpen = true;
    },
    mobileNavClosed(state) {
      state.mobileNavOpen = false;
    },
    explorerOpenSet(state, action: PayloadAction<boolean>) {
      state.explorerOpen = action.payload;
    },
  },
});

export const {
  viewportBandSet,
  railCollapsedSet,
  mobileNavOpened,
  mobileNavClosed,
  explorerOpenSet,
} = shellSlice.actions;

export const shellReducer = shellSlice.reducer;

export const selectViewportBand = (state: { shell: ShellState }) =>
  state.shell.viewportBand;
export const selectRailCompact = (state: { shell: ShellState }) =>
  state.shell.viewportBand !== "mobile" && state.shell.railCollapsed;
export const selectRailCollapsedPreference = (state: { shell: ShellState }) =>
  state.shell.railCollapsed;
export const selectMobileNavOpen = (state: { shell: ShellState }) =>
  state.shell.mobileNavOpen;
export const selectShowPermanentRail = (state: { shell: ShellState }) =>
  state.shell.viewportBand !== "mobile";
export const selectShowExplorer = (state: { shell: ShellState }) =>
  state.shell.explorerOpen && state.shell.viewportBand === "desktop";

export const selectPrimaryNavId = (state: {
  shell: ShellState;
  router: { current: { name: AppRouteName } | null };
}): ShellNavId | null => {
  const route = selectCurrentRoute(state as never);
  return navIdForRoute(route?.name ?? null);
};

export const selectExplorerOpenPreference = (state: { shell: ShellState }) =>
  state.shell.explorerOpen;

export function createShellMiddleware(): Middleware {
  return (_api) => (next) => (action) => next(action);
}
