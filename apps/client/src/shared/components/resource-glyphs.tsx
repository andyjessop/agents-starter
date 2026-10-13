import type { FC } from "react";
import { Icon } from "@agent-starter/design-system";

export const ProjectGlyph: FC = () => (
  <Icon>
    <path d="M3.5 7.5h6l1.6 2h9.4v9h-17z" />
    <path d="M3.5 7.5v-2h5.7l1.4 2" />
  </Icon>
);

export const NodeletGlyph: FC = () => (
  <Icon>
    <rect x="5" y="5" width="14" height="14" rx="3" />
    <path d="M9 9h6v6H9zM12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

export const BridgeGlyph: FC = () => (
  <Icon>
    <path d="M4 19V9m16 10V9M4 12h16M7 12c0-4 2-7 5-7s5 3 5 7" />
  </Icon>
);

export const ApiKeyGlyph: FC = () => (
  <Icon>
    <circle cx="8" cy="12" r="3" />
    <path d="M11 12h9M17 12v3M14 12v2" />
  </Icon>
);

export const AddGlyph: FC = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const CopyGlyph: FC = () => (
  <Icon>
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
);

export const RenameGlyph: FC = () => (
  <Icon>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="m13.5 6.5 4 4" />
  </Icon>
);

export const DeleteGlyph: FC = () => (
  <Icon>
    <path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M6 7l1 13h10l1-13" />
  </Icon>
);
