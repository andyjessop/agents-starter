import type { FC, ReactNode } from "react";
import { Typography } from "@agent-starter/design-system";
import "./editorial.css";

/** Decorative illustration is CSS-only; all resource information stays text. */
export const PageHeader: FC<{
  children: ReactNode;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}> = ({ children, description, meta, actions }) => {
  return (
    <header className="app-masthead">
      <div className="app-masthead-copy">
        <div className="app-masthead-title">
          <Typography as="h1" variant="display">
            {children}
          </Typography>
          {meta}
        </div>
        {description && <Typography variant="body">{description}</Typography>}
      </div>
      {actions && <div className="app-masthead-actions">{actions}</div>}
    </header>
  );
};
