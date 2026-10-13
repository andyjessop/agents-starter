'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AlignedData, Options } from 'uplot';

import { Accordion } from '../native/overlays';
import { Table } from '../native/layout';
import { cx } from '../shared';
import { UPlot, UPlotLib } from './uplot';
import '../styles/charts.css';

export type LineChartPoint = {
    /** ISO date string, or unix seconds. */
    x: string | number;
    y: number;
};

export type LineChartProps = {
    /** Accessible name for the chart. */
    label: string;
    points: readonly LineChartPoint[];
    /** Series label used in the live legend/cursor values. */
    seriesLabel?: string;
    formatX?: (value: number) => string;
    formatY?: (value: number) => string;
    /** Compact axis labels can differ from exact legend and data-table values. */
    formatYTick?: (value: number) => string;
    className?: string;
    /** When true, show the label as a visible figcaption. Default hides it for host headings. */
    showCaption?: boolean;
};

type ChartPalette = {
    stroke: string;
    fill: string;
    grid: string;
    axis: string;
    font: string;
    surface: string;
    endPadding: number;
    lineWidth: number;
    pointSize: number;
    cursorSize: number;
    ruleWidth: number;
    axisLabelSize: number;
    axisSize: number;
    axisSpace: number;
    axisGap: number;
    valueAxisMin: number;
    valueAxisSpace: number;
    valueAxisPadding: number;
    barWidth: number;
    barMaxSize: number;
};

function readPalette(element: HTMLElement): ChartPalette {
    // Resolve light-dark(), colour mixes and relative font units in the chart's theme scope.
    // Canvas cannot resolve CSS custom properties, and uPlot requires pixel font sizes.
    const probe = document.createElement('span');
    probe.style.fontFamily = 'var(--ui-line-chart-font-family, var(--ui-body-font, system-ui))';
    probe.style.fontSize = 'var(--ui-line-chart-font-size, var(--ui-caption-size, 0.75rem))';
    element.append(probe);
    const resolve = (value: string): string => {
        probe.style.color = value;
        return getComputedStyle(probe).color;
    };
    const stroke = resolve('var(--ui-line-chart-stroke, var(--ui-chart-1))');
    const fill = resolve(`color-mix(in srgb, ${stroke} var(--ui-chart-fill-weight), transparent)`);
    const grid = resolve('var(--ui-line-chart-grid, var(--ui-chart-grid))');
    const axis = resolve('var(--ui-line-chart-axis, var(--ui-chart-axis))');
    const surface = resolve('var(--ui-surface)');
    const style = getComputedStyle(probe);
    const font = `${style.fontSize} ${style.fontFamily}`;
    const length = (token: string): number => {
        probe.style.width = `var(${token})`;
        return Number.parseFloat(getComputedStyle(probe).width);
    };
    // Resolve lengths through a box so rem-based host overrides remain valid for canvas.
    probe.style.display = 'block';
    const dimensions = {
        endPadding: length('--ui-chart-end-padding'),
        lineWidth: length('--ui-chart-line-width'),
        pointSize: length('--ui-chart-point-size'),
        cursorSize: length('--ui-chart-cursor-size'),
        ruleWidth: length('--ui-border-width'),
        axisLabelSize: length('--ui-chart-axis-label-size'),
        axisSize: length('--ui-chart-axis-size'),
        axisSpace: length('--ui-chart-axis-space'),
        axisGap: length('--ui-chart-axis-gap'),
        valueAxisMin: length('--ui-chart-value-axis-min'),
        valueAxisSpace: length('--ui-chart-value-axis-space'),
        valueAxisPadding: length('--ui-chart-value-axis-padding'),
    };
    probe.style.width = 'var(--ui-bar-chart-max-size, 3rem)';
    const barMaxSize = Number.parseFloat(getComputedStyle(probe).width);
    const barWidth = Number.parseFloat(getComputedStyle(element).getPropertyValue('--ui-bar-chart-width')) || 0.6;
    probe.remove();
    return { stroke, fill, grid, axis, surface, font, ...dimensions, barWidth, barMaxSize };
}

function toUnixSeconds(x: string | number): number {
    if (typeof x === 'number') {
        return x > 1_000_000_000_000 ? x / 1_000 : x;
    }
    const milliseconds = Date.parse(x);
    return Number.isFinite(milliseconds) ? milliseconds / 1_000 : Number.NaN;
}

function defaultFormatX(value: number): string {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value * 1_000),
    );
}

function defaultFormatY(value: number): string {
    return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value);
}

/**
 * Design-system line chart built on the local uPlot React host.
 * Canvas colours come from `--ui-chart-*` / optional `--ui-line-chart-*` tokens.
 */
const CartesianChart = ({
    label,
    points,
    seriesLabel = 'Value',
    formatX = defaultFormatX,
    formatY = defaultFormatY,
    formatYTick = formatY,
    className,
    showCaption = false,
    categories,
    categoryLabel = 'Category',
}: LineChartProps & { categories?: readonly string[]; categoryLabel?: string }): ReactNode => {
    const [host, setHost] = useState<HTMLElement | null>(null);
    const [palette, setPalette] = useState<ChartPalette | null>(null);
    useEffect(() => {
        if (!host) return;
        const refresh = (): void => {
            setPalette(readPalette(host));
        };
        refresh();
        const observer = new MutationObserver(refresh);
        for (let scope: HTMLElement | null = host; scope; scope = scope.parentElement) {
            observer.observe(scope, {
                attributes: true,
                attributeFilter: ['data-ui-theme', 'data-ui-density', 'class', 'style'],
            });
        }
        const preferences = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)', '(forced-colors: active)'].map(
            (query) => window.matchMedia(query),
        );
        preferences.forEach((query) => {
            query.addEventListener('change', refresh);
        });
        return () => {
            observer.disconnect();
            preferences.forEach((query) => {
                query.removeEventListener('change', refresh);
            });
        };
    }, [host]);

    const aligned = useMemo((): { data: AlignedData; count: number; rows: { key: string; x: number; y: number }[] } => {
        const xs: number[] = [];
        const ys: number[] = [];
        const rows: { key: string; x: number; y: number }[] = [];
        const occurrences = new Map<number, number>();
        for (const point of points) {
            const x = categories ? Number(point.x) : toUnixSeconds(point.x);
            if (!Number.isFinite(x) || !Number.isFinite(point.y)) continue;
            xs.push(x);
            ys.push(point.y);
            const occurrence = (occurrences.get(x) ?? 0) + 1;
            occurrences.set(x, occurrence);
            rows.push({ key: `${x}:${occurrence}`, x, y: point.y });
        }
        return { data: [xs, ys], count: xs.length, rows };
    }, [points, categories]);

    const options = useMemo((): Omit<Options, 'width' | 'height'> | null => {
        if (!palette) return null;
        return {
            class: 'ui-line-chart-uplot',
            padding: [null, palette.endPadding, null, null],
            cursor: {
                drag: { x: false, y: false },
                y: false,
                points: {
                    size: palette.cursorSize,
                    width: palette.lineWidth,
                    stroke: palette.surface,
                    fill: palette.stroke,
                },
            },
            legend: {
                show: true,
                live: true,
            },
            scales: {
                x: categories
                    ? { time: false, range: () => [-0.5, Math.max(0.5, categories.length - 0.5)] }
                    : { time: true },
                y: categories
                    ? { range: (_plot, min, max) => UPlotLib.rangeNum(Math.min(0, min), Math.max(0, max), 0.1, true) }
                    : { auto: true },
            },
            series: [
                {
                    label: categories ? categoryLabel : 'Date',
                    value: (_plot, value) =>
                        typeof value === 'number' && Number.isFinite(value) ? formatX(value) : '—',
                },
                {
                    label: seriesLabel,
                    stroke: palette.stroke,
                    fill: (plot) => {
                        if (categories) return palette.stroke;
                        const { top, height } = plot.bbox;
                        // uPlot requests a legend colour before it measures the plot.
                        if (!Number.isFinite(top + height)) return palette.fill;
                        const gradient = plot.ctx.createLinearGradient(0, top, 0, top + height);
                        gradient.addColorStop(0, palette.fill);
                        gradient.addColorStop(1, 'transparent');
                        return gradient;
                    },
                    paths: categories
                        ? UPlotLib.paths.bars?.({ size: [palette.barWidth, palette.barMaxSize] })
                        : UPlotLib.paths.spline?.(),
                    width: palette.lineWidth,
                    cap: 'round',
                    points: {
                        show: !categories && aligned.count > 0 && aligned.count <= 24,
                        size: palette.pointSize,
                        width: palette.lineWidth,
                        stroke: palette.stroke,
                        fill: palette.surface,
                    },
                    value: (_uplot, value) => (typeof value === 'number' ? formatY(value) : '—'),
                },
            ],
            axes: [
                {
                    stroke: palette.axis,
                    font: palette.font,
                    label: categories ? categoryLabel : 'Date',
                    splits: categories ? () => categories.map((_label, index) => index) : undefined,
                    labelFont: palette.font,
                    labelSize: palette.axisLabelSize,
                    size: palette.axisSize,
                    space: palette.axisSpace,
                    gap: palette.axisGap,
                    grid: { show: false },
                    border: { show: true, stroke: palette.grid, width: palette.ruleWidth },
                    ticks: { show: false },
                    values: (_uplot, splits) => splits.map((value) => formatX(value)),
                },
                {
                    stroke: palette.axis,
                    font: palette.font,
                    label: seriesLabel,
                    labelFont: palette.font,
                    labelSize: palette.axisLabelSize,
                    // uPlot passes null during init despite its declared string[] signature.
                    size: (plot: UPlotLib, values: string[] | null) => {
                        plot.ctx.font = palette.font;
                        return Math.max(
                            palette.valueAxisMin,
                            ...(values ?? []).map(
                                (value) => plot.ctx.measureText(value).width + palette.valueAxisPadding,
                            ),
                        );
                    },
                    space: palette.valueAxisSpace,
                    gap: palette.axisGap,
                    grid: { stroke: palette.grid, width: palette.ruleWidth },
                    border: { show: true, stroke: palette.grid, width: palette.ruleWidth },
                    ticks: { show: false },
                    values: (_uplot, splits) => splits.map((value) => formatYTick(value)),
                },
            ],
        };
    }, [aligned.count, categories, categoryLabel, formatX, formatY, formatYTick, palette, seriesLabel]);

    const caption = showCaption ? (
        <figcaption>{label}</figcaption>
    ) : (
        <figcaption className="ui-visually-hidden">{label}</figcaption>
    );

    let body: ReactNode = <div className="ui-line-chart-plot" aria-hidden="true" />;
    if (aligned.count === 0) {
        body = <p className="ui-line-chart-empty">No values to plot.</p>;
    } else if (options) {
        body = <UPlot className="ui-line-chart-plot" options={options} data={aligned.data} />;
    }

    return (
        <figure ref={setHost} className={cx('ui-line-chart', className)} aria-label={label}>
            {caption}
            {body}
            {aligned.count > 0 ? (
                <Accordion title="View chart data" className="ui-chart-data">
                    <Table>
                        <caption className="ui-visually-hidden">{label}</caption>
                        <thead>
                            <tr>
                                <th scope="col">{categories ? categoryLabel : 'Date'}</th>
                                <th scope="col" data-numeric>
                                    {seriesLabel}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {aligned.rows.map(({ key, x, y }) => (
                                <tr key={key}>
                                    <td>{formatX(x)}</td>
                                    <td data-numeric>{formatY(y)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Accordion>
            ) : null}
        </figure>
    );
};

/** Time-series chart using the shared uPlot renderer. */
export const LineChart = (props: LineChartProps): ReactNode => <CartesianChart {...props} />;

export type SparklineProps = {
    /** Accessible name for the condensed series. */
    label: string;
    points: readonly LineChartPoint[];
    className?: string;
};

/**
 * Condensed uPlot series for card footers: no axes, legend or data table.
 * Keeps a fixed block size so empty and plotted states share the same slot.
 */
export const Sparkline = ({ label, points, className }: SparklineProps): ReactNode => {
    const [host, setHost] = useState<HTMLElement | null>(null);
    const [palette, setPalette] = useState<ChartPalette | null>(null);
    useEffect(() => {
        if (!host) return;
        const refresh = (): void => {
            setPalette(readPalette(host));
        };
        refresh();
        const observer = new MutationObserver(refresh);
        for (let scope: HTMLElement | null = host; scope; scope = scope.parentElement) {
            observer.observe(scope, {
                attributes: true,
                attributeFilter: ['data-ui-theme', 'data-ui-density', 'class', 'style'],
            });
        }
        const preferences = ['(prefers-color-scheme: dark)', '(prefers-contrast: more)', '(forced-colors: active)'].map(
            (query) => window.matchMedia(query),
        );
        preferences.forEach((query) => {
            query.addEventListener('change', refresh);
        });
        return () => {
            observer.disconnect();
            preferences.forEach((query) => {
                query.removeEventListener('change', refresh);
            });
        };
    }, [host]);

    const aligned = useMemo((): AlignedData => {
        const xs: number[] = [];
        const ys: number[] = [];
        for (const point of points) {
            const x = toUnixSeconds(point.x);
            if (!Number.isFinite(x) || !Number.isFinite(point.y)) continue;
            xs.push(x);
            ys.push(point.y);
        }
        return [xs, ys];
    }, [points]);

    const count = aligned[0].length;

    const options = useMemo((): Omit<Options, 'width' | 'height'> | null => {
        if (!palette || count === 0) return null;
        return {
            class: 'ui-sparkline-uplot',
            padding: [2, 2, 2, 2],
            cursor: { show: false },
            legend: { show: false },
            scales: { x: { time: true }, y: { auto: true } },
            axes: [{ show: false }, { show: false }],
            series: [
                {},
                {
                    stroke: palette.stroke,
                    fill: (plot) => {
                        const { top, height } = plot.bbox;
                        if (!Number.isFinite(top + height)) return palette.fill;
                        const gradient = plot.ctx.createLinearGradient(0, top, 0, top + height);
                        gradient.addColorStop(0, palette.fill);
                        gradient.addColorStop(1, 'transparent');
                        return gradient;
                    },
                    paths: UPlotLib.paths.spline?.(),
                    width: Math.max(1, palette.lineWidth - 0.5),
                    cap: 'round',
                    points: { show: false },
                },
            ],
        };
    }, [count, palette]);

    let body: ReactNode = <div className="ui-sparkline-plot" aria-hidden="true" />;
    if (count === 0) {
        body = <div className="ui-sparkline-empty" aria-hidden="true" />;
    } else if (options) {
        body = <UPlot className="ui-sparkline-plot" options={options} data={aligned} />;
    }

    return (
        <figure ref={setHost} className={cx('ui-sparkline', className)} aria-label={label}>
            <figcaption className="ui-visually-hidden">{label}</figcaption>
            {body}
        </figure>
    );
};

/** Categorical bars share the line chart's theme, sizing and live legend. */
export const BarChart = ({
    data,
    categoryLabel = 'Category',
    ...props
}: Omit<LineChartProps, 'points' | 'formatX'> & {
    data: readonly { label: string; value: number }[];
    categoryLabel?: string;
}): ReactNode => {
    const valid = useMemo(() => data.filter((point) => Number.isFinite(point.value)), [data]);
    const categories = useMemo(() => valid.map((point) => point.label), [valid]);
    const points = useMemo(() => valid.map((point, index) => ({ x: index, y: point.value })), [valid]);
    const formatX = useMemo(
        () =>
            (value: number): string =>
                categories[value] ?? '',
        [categories],
    );
    return (
        <CartesianChart
            {...props}
            points={points}
            categories={categories}
            categoryLabel={categoryLabel}
            formatX={formatX}
        />
    );
};
