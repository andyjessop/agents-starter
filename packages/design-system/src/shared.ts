import type { CSSProperties } from 'react';

export const cx = (...values: (string | undefined | false)[]): string => values.filter(Boolean).join(' ');
/** Typed escape hatch for CSS custom properties. No runtime theme processing. */
export type ThemeStyle = CSSProperties & {
    [K in `--ui-${string}`]?: string | number;
};
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
