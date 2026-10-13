import type { FC } from "react";
import { Typography } from "@agent-starter/design-system";

/** Explorer tree placeholder — wire your resource hierarchy here. */
export const ShellExplorer: FC = () => {
  return (
    <aside className="client-shell-explorer" aria-label="Explorer">
      <Typography variant="caption">
        Explorer branches for your product resources go here.
      </Typography>
    </aside>
  );
};
