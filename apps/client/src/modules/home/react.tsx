import type { FC } from "react";
import { Stack, Typography } from "@agent-starter/design-system";

import { useAppSelector } from "../../hooks.ts";
import { appApi } from "../live/api.ts";

export const HomePage: FC = () => {
  const session = useAppSelector((state) => state.session.session);
  const catalogue = useAppSelector(
    (state) => appApi.endpoints.liveDemoCatalogue.select()(state).data,
  );
  return (
    <Stack className="client-section">
      <Typography as="h1" variant="heading">
        Home
      </Typography>
      <Typography variant="body">
        {session
          ? `Signed in as ${session.displayName || session.email}.`
          : "You are not signed in."}
      </Typography>
      <Typography variant="body">
        This page demonstrates live catalogue admission. Items come from the mock
        live scope at <code>/v1/live/demo-catalogue</code>.
      </Typography>
      {catalogue?.items.map((item) => (
        <Stack key={item.id} className="client-card">
          <Typography as="h2" variant="heading">
            {item.title}
          </Typography>
          <Typography variant="body">{item.summary}</Typography>
        </Stack>
      ))}
    </Stack>
  );
};
