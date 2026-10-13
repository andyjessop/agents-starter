import { useId, useSyncExternalStore, type FC } from "react";
import { Radio } from "@agent-starter/design-system";

const storageKey = "agent-starter-app-theme";
const attribute = "appTheme";

/** Registered packs. Each id must have a matching file under ./themes/. */
export const appThemes = [
  { id: "macchiato", label: "Catppuccin Macchiato" },
  { id: "tfm", label: "TFM hybrid" },
  { id: "default", label: "Default" },
] as const;

export type AppThemeId = (typeof appThemes)[number]["id"];

/** Pack applied when nothing valid is stored. */
const initialAppTheme: AppThemeId = "macchiato";

const isAppThemeId = (value: string | null | undefined): value is AppThemeId =>
  appThemes.some((theme) => theme.id === value);

export const currentAppTheme = (): AppThemeId => {
  const value = document.documentElement.dataset[attribute];
  return isAppThemeId(value) ? value : initialAppTheme;
};

export function initialiseAppTheme(): void {
  try {
    const saved = window.localStorage.getItem(storageKey);
    document.documentElement.dataset[attribute] = isAppThemeId(saved)
      ? saved
      : initialAppTheme;
  } catch {
    document.documentElement.dataset[attribute] = initialAppTheme;
  }
}

function changeAppTheme(theme: AppThemeId): void {
  document.documentElement.dataset[attribute] = theme;
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // Keep the selected pack for this page when storage is unavailable.
  }
}

function subscribe(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-app-theme"],
  });
  return () => {
    observer.disconnect();
  };
}

/** Named token pack switcher; separate from Light / Dark / System and from Redux. */
export const AppThemeControl: FC = () => {
  const id = useId();
  const theme = useSyncExternalStore(subscribe, currentAppTheme);
  return (
    <fieldset className="theme-app-theme">
      <legend>Theme</legend>
      <div className="theme-app-theme-options">
        {appThemes.map(({ id: value, label }) => (
          <label key={value} htmlFor={`${id}-${value}`}>
            <Radio
              id={`${id}-${value}`}
              name="app-theme"
              value={value}
              checked={theme === value}
              onChange={() => {
                changeAppTheme(value);
              }}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export const useAppTheme = (): AppThemeId =>
  useSyncExternalStore(subscribe, currentAppTheme);
