import { useId, useSyncExternalStore, type FC } from "react";
import { Radio } from "@agent-starter/design-system";

const storageKey = "agent-starter-appearance";
type Appearance = "light" | "dark" | "auto";
const appearanceLabels = { light: "Light", dark: "Dark", auto: "System" } as const;

export const currentAppearance = (): Appearance => {
  const value = document.documentElement.dataset.uiTheme;
  return value === "light" || value === "auto" ? value : "dark";
};

export function initialiseAppearance(): void {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark" || saved === "auto") {
      document.documentElement.dataset.uiTheme = saved;
    }
  } catch {
    // The theme remains usable when the browser blocks preference storage.
  }
}

function changeAppearance(appearance: Appearance): void {
  document.documentElement.dataset.uiTheme = appearance;
  try {
    window.localStorage.setItem(storageKey, appearance);
  } catch {
    // Keep the selected appearance for this page when storage is unavailable.
  }
}

export function subscribeAppearance(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-ui-theme"],
  });
  return () => {
    observer.disconnect();
  };
}

/** A browser appearance preference, deliberately separate from the domain store. */
export const AppearanceControl: FC = () => {
  const id = useId();
  const appearance = useSyncExternalStore(subscribeAppearance, currentAppearance);
  return (
    <fieldset className="theme-appearance">
      <legend>Appearance</legend>
      <div className="theme-appearance-options">
        {(["light", "dark", "auto"] as const).map((value) => (
          <label key={value} htmlFor={`${id}-${value}`}>
            <Radio
              id={`${id}-${value}`}
              name="appearance"
              value={value}
              checked={appearance === value}
              onChange={() => {
                changeAppearance(value);
              }}
            />
            {appearanceLabels[value]}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export const useAppearance = (): Appearance =>
  useSyncExternalStore(subscribeAppearance, currentAppearance);
