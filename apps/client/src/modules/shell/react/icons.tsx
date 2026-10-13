import type { FC, ReactNode } from "react";
import { Icon } from "@agent-starter/design-system";

import type { ShellNavIcon } from "../nav.ts";

const paths: Record<ShellNavIcon, ReactNode> = {
  grid: <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.7 1.5-1.7 3M12 17h.01" />
    </>
  ),
};

export const ShellIcon: FC<{ name: ShellNavIcon; className?: string }> = ({
  name,
  className,
}) => (
  <Icon
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    {paths[name]}
  </Icon>
);

export const MenuIcon: FC<{ className?: string }> = ({ className }) => (
  <Icon
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);

export const ChevronIcon: FC<{ className?: string }> = ({ className }) => (
  <Icon
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const BrandMark: FC<{ className?: string }> = ({ className }) => (
  <img
    className={className}
    src="/brand-mark.svg"
    alt=""
    aria-hidden="true"
    draggable={false}
  />
);
