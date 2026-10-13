import type { FC } from "react";
import { Icon } from "@agent-starter/design-system";

export const OpenGlyph: FC = () => (
  <Icon>
    <path d="M5 12h10" />
    <path d="M12 7l5 5-5 5" />
  </Icon>
);

export const RevokeGlyph: FC = () => (
  <Icon>
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </Icon>
);

export const DownloadGlyph: FC = () => (
  <Icon>
    <path d="M12 4v12" />
    <path d="M7 12l5 5 5-5" />
    <path d="M5 19h14" />
  </Icon>
);

export const KeyGlyph: FC = () => (
  <Icon>
    <circle cx="8" cy="12" r="3" />
    <path d="M11 12h8" />
    <path d="M16 12v3" />
  </Icon>
);

export const GrantGlyph: FC = () => (
  <Icon>
    <path d="M5 7h14" />
    <path d="M5 12h10" />
    <path d="M5 17h7" />
  </Icon>
);

export const PairGlyph: FC = () => (
  <Icon>
    <rect x="4" y="7" width="7" height="10" rx="1" />
    <rect x="13" y="7" width="7" height="10" rx="1" />
    <path d="M11 12h2" />
  </Icon>
);
