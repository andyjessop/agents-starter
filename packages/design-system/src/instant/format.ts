export type InstantDisplay = 'relative' | 'absolute' | 'auto';

/** Within this window, {@link InstantDisplay.auto} prefers relative labels. */
export const INSTANT_AUTO_RELATIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const RELATIVE_DIVISIONS: {
    amount: number;
    unit: Intl.RelativeTimeFormatUnit;
}[] = [
    { amount: 60, unit: 'second' },
    { amount: 60, unit: 'minute' },
    { amount: 24, unit: 'hour' },
    { amount: 7, unit: 'day' },
    { amount: 4.34524, unit: 'week' },
    { amount: 12, unit: 'month' },
    { amount: Number.POSITIVE_INFINITY, unit: 'year' },
];

export interface FormatInstantInput {
    iso: string;
    display?: InstantDisplay;
    /** When true and the instant is in the past, show `Expired` instead of a past-relative label. */
    deadline?: boolean;
    locale?: string;
    timeZone?: string;
    nowMs?: number;
}

export interface FormatInstantResult {
    dateTime: string;
    label: string;
    mode: 'relative' | 'absolute';
    /** Absolute label for tooltips when {@link FormatInstantResult.mode} is `relative`. */
    tooltipAbsolute: string | null;
    valid: boolean;
}

export function parseInstantMs(iso: string): number | null {
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
}

export function formatAbsoluteInstant(
    iso: string,
    options: { locale?: string; timeZone?: string } = {},
): string {
    const ms = parseInstantMs(iso);
    if (ms === null) {
        return iso;
    }
    const locale = options.locale ?? 'en-GB';
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    }).format(ms);
}

export function formatAbsoluteInstantTooltip(
    iso: string,
    options: { locale?: string; timeZone?: string } = {},
): string {
    const ms = parseInstantMs(iso);
    if (ms === null) {
        return iso;
    }
    const locale = options.locale ?? 'en-GB';
    return new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        timeZoneName: 'short',
        ...(options.timeZone ? { timeZone: options.timeZone } : {}),
    }).format(ms);
}

export function formatRelativeInstant(iso: string, nowMs = Date.now(), locale = 'en-GB'): string | null {
    const targetMs = parseInstantMs(iso);
    if (targetMs === null) {
        return null;
    }
    let duration = Math.round((targetMs - nowMs) / 1000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const sign = duration < 0 ? -1 : 1;
    duration = Math.abs(duration);
    for (const { amount, unit } of RELATIVE_DIVISIONS) {
        if (duration < amount) {
            return rtf.format(sign * duration, unit);
        }
        duration = Math.round(duration / amount);
    }
    return rtf.format(sign * duration, 'year');
}

export function resolveInstantDisplay(
    iso: string,
    display: InstantDisplay,
    nowMs: number,
): 'relative' | 'absolute' {
    if (display !== 'auto') {
        return display;
    }
    const targetMs = parseInstantMs(iso);
    if (targetMs === null) {
        return 'absolute';
    }
    const delta = Math.abs(targetMs - nowMs);
    return delta <= INSTANT_AUTO_RELATIVE_WINDOW_MS ? 'relative' : 'absolute';
}

export function formatInstantDisplay(input: FormatInstantInput): FormatInstantResult {
    const {
        iso,
        display = 'auto',
        deadline = false,
        locale = 'en-GB',
        timeZone,
        nowMs = Date.now(),
    } = input;
    const targetMs = parseInstantMs(iso);
    const absolute = formatAbsoluteInstant(iso, { locale, timeZone });
    if (targetMs === null) {
        return {
            dateTime: iso,
            label: iso,
            mode: 'absolute',
            tooltipAbsolute: null,
            valid: false,
        };
    }
    if (deadline && targetMs <= nowMs) {
        return {
            dateTime: iso,
            label: 'Expired',
            mode: 'relative',
            tooltipAbsolute: formatAbsoluteInstantTooltip(iso, { locale, timeZone }),
            valid: true,
        };
    }
    const mode = resolveInstantDisplay(iso, display, nowMs);
    if (mode === 'absolute') {
        return {
            dateTime: iso,
            label: absolute,
            mode: 'absolute',
            tooltipAbsolute: null,
            valid: true,
        };
    }
    const relative = formatRelativeInstant(iso, nowMs, locale);
    return {
        dateTime: iso,
        label: relative ?? absolute,
        mode: 'relative',
        tooltipAbsolute: formatAbsoluteInstantTooltip(iso, { locale, timeZone }),
        valid: true,
    };
}
