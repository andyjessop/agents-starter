import { memo, type FC, type ReactNode } from "react";
import { VisuallyHidden } from "@agent-starter/design-system";
import "./browse.css";

/** Status dot tone. Callers map their own status policy onto these. */
export type TileTone = "ok" | "warn" | "off" | "neutral";

export const TileGrid: FC<{
  label: string;
  className?: string;
  children: ReactNode;
}> = ({ label, className, children }) => (
  <ul
    className={className ? `app-tile-grid ${className}` : "app-tile-grid"}
    aria-label={label}
  >
    {children}
  </ul>
);

/**
 * One browse tile whose primary control opens the resource.
 */
export const Tile: FC<{
  glyph: ReactNode;
  name: string;
  meta?: ReactNode;
  tone?: TileTone;
  toneLabel?: string;
  href?: string;
  onOpen?: () => void;
  disabled?: boolean;
  busy?: boolean;
}> = memo((props) => {
  const body = (
    <>
      <span className="app-tile-glyph" aria-hidden="true">
        {props.glyph}
      </span>
      <span className="app-tile-name">{props.name}</span>
      {props.meta ? <span className="app-tile-meta">{props.meta}</span> : null}
      {props.tone ? (
        <span className="app-tile-dot" data-tone={props.tone} aria-hidden="true" />
      ) : null}
      {props.toneLabel ? <VisuallyHidden>{`, ${props.toneLabel}`}</VisuallyHidden> : null}
    </>
  );
  return (
    <li className="app-tile">
      {props.href ? (
        <a className="app-tile-open" href={props.href}>
          {body}
        </a>
      ) : (
        <button
          type="button"
          className="app-tile-open"
          disabled={props.disabled}
          aria-busy={props.busy || undefined}
          onClick={props.onOpen}
        >
          {body}
        </button>
      )}
    </li>
  );
});
Tile.displayName = "Tile";
