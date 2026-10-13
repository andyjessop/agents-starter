import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "./app.tsx";
import { installReduxRecorderHotkeys } from "./debug/recorder-hotkeys.ts";
import { initialiseAppearance } from "./modules/theme/appearance.tsx";
import { initialiseAppTheme } from "./modules/theme/app-theme.tsx";
import { createAppStore } from "./store.ts";

// Installed before anything else so captures work even when boot fails later.
installReduxRecorderHotkeys();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

initialiseAppearance();
initialiseAppTheme();

const store = createAppStore({ restartSession: () => window.location.reload() });

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);
