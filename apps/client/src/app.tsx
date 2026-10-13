import type { FC } from "react";
import { useSelector } from "react-redux";

import { useAppSelector } from "./hooks.ts";
import { OutcomePanel, RouteGate } from "./modules/navigation/react.tsx";
import { selectRouteReadiness } from "./modules/navigation/redux.ts";
import { Shell } from "./modules/shell/react.tsx";
import { AppearanceControl } from "./modules/theme/appearance.tsx";
import { AppThemeControl } from "./modules/theme/app-theme.tsx";
import { pages } from "./pages.ts";
import { selectRouteName } from "./router.ts";
import "@agent-starter/design-system/styles.css";
import "./modules/theme/themes/index.css";

export const App: FC = () => {
  const readiness = useAppSelector(selectRouteReadiness);
  const name = useSelector(selectRouteName);
  const gated = readiness === "gated" || name === null;
  const Page = name ? pages[name] : null;
  const terminal =
    !gated &&
    (readiness === "forbidden" ||
      readiness === "unavailable" ||
      readiness === "mismatch" ||
      readiness === "not-found" ||
      readiness === "signed-out" ||
      readiness === "error");
  return (
    <Shell
      accountMenu={
        <>
          <AppearanceControl />
          <AppThemeControl />
        </>
      }
    >
      {gated ? (
        <RouteGate />
      ) : terminal ? (
        <OutcomePanel />
      ) : Page ? (
        <Page />
      ) : (
        <RouteGate />
      )}
    </Shell>
  );
};
