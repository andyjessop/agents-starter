'use client';
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';

import { attachTooltip, type TooltipOptions } from '../behaviours/tooltip';
import { formatInstantDisplay, type FormatInstantInput, type InstantDisplay } from '../instant/format';
import { cx } from '../shared';
import { useController } from './use-controller';

function useTimelineNow(active: boolean, intervalMs = 60_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) {
            return;
        }
        const timer = setInterval(() => {
            setNow(Date.now());
        }, intervalMs);
        return () => {
            clearInterval(timer);
        };
    }, [active, intervalMs]);
    return now;
}

const InstantWithTooltip = ({
    dateTime,
    label,
    tooltip,
    className,
    tooltipOptions,
}: {
    dateTime: string;
    label: string;
    tooltip: string;
    className?: string;
    tooltipOptions?: TooltipOptions;
}): ReactNode => {
    const id = useId();
    const { root } = useController(attachTooltip, tooltipOptions ?? {});
    return (
        <span ref={root} data-ui-root="tooltip" className={className}>
            <time
                dateTime={dateTime}
                className="ui-instant"
                data-ui-part="trigger"
                tabIndex={0}
                aria-describedby={id}
            >
                {label}
            </time>
            <span
                id={id}
                data-ui-part="popup"
                role="tooltip"
                popover="manual"
                className="ui-tooltip"
            >
                {tooltip}
            </span>
        </span>
    );
};

export interface InstantProps extends Omit<FormatInstantInput, 'nowMs' | 'iso'> {
    /** ISO-8601 instant from the API or store. */
    value: string;
    className?: string;
    invalidLabel?: string;
    /** Pin `now` for tests; live UI uses a clock that ticks once per minute when relative. */
    now?: number;
    live?: boolean;
    tooltipOptions?: TooltipOptions;
}

export const Instant = ({
    value,
    display = 'auto',
    deadline = false,
    locale,
    timeZone,
    now,
    live = true,
    invalidLabel = 'Unknown time',
    className,
    tooltipOptions,
}: InstantProps): ReactNode => {
    const tickNow = useTimelineNow(
        live && now === undefined && (display === 'relative' || display === 'auto'),
    );
    const nowMs = now ?? tickNow;
    const formatted = useMemo(
        () =>
            formatInstantDisplay({
                iso: value,
                display: display as InstantDisplay,
                deadline,
                locale,
                timeZone,
                nowMs,
            }),
        [value, display, deadline, locale, timeZone, nowMs],
    );

    if (!formatted.valid) {
        return (
            <time dateTime={value} className={cx('ui-instant', className)}>
                {invalidLabel}
            </time>
        );
    }

    if (formatted.mode === 'relative' && formatted.tooltipAbsolute) {
        return (
            <InstantWithTooltip
                dateTime={formatted.dateTime}
                label={formatted.label}
                tooltip={formatted.tooltipAbsolute}
                className={className}
                tooltipOptions={tooltipOptions}
            />
        );
    }

    return (
        <time dateTime={formatted.dateTime} className={cx('ui-instant', className)}>
            {formatted.label}
        </time>
    );
};
