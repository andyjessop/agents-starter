import { render } from 'vitest-browser-react';

import './ensure-navigator-language';
import '../styles/index.css';
import { BarChart, LineChart, Sparkline } from './line-chart';

it('renders a labelled line chart host for plotted points', async () => {
    const screen = await render(
        <LineChart
            label="Sample value over time"
            points={[
                { x: '2024-01-01', y: 100 },
                { x: '2024-02-01', y: 140 },
                { x: '2024-03-01', y: 120 },
            ]}
        />,
    );

    const chart = screen.getByRole('figure', { name: 'Sample value over time' });
    await expect.element(chart).toBeVisible();
    expect(chart.element().querySelector('.ui-line-chart-plot')).not.toBeNull();
    expect(chart.element().querySelector('.uplot')).not.toBeNull();
});

it('shows an empty message when there are no plottable points', async () => {
    const screen = await render(<LineChart label="Empty history" points={[]} />);
    await expect.element(screen.getByText('No values to plot.', { exact: true })).toBeVisible();
});

it('keeps the live legend above following content in a narrow report card', async () => {
    const screen = await render(
        <div style={{ width: '320px' }}>
            <LineChart
                label="Narrow portfolio chart"
                points={[
                    { x: '2026-01-01', y: 100 },
                    { x: '2026-02-01', y: 140 },
                ]}
                seriesLabel="Balance (EUR)"
            />
            <button type="button">View monthly values</button>
        </div>,
    );
    const chart = screen.getByRole('figure', { name: 'Narrow portfolio chart' }).element();
    const legend = chart.querySelector('.u-legend');
    if (!(legend instanceof HTMLElement)) throw new Error('Missing live legend');
    const next = screen.getByRole('button', { name: 'View monthly values' }).element();
    expect(legend.getBoundingClientRect().bottom).toBeLessThanOrEqual(next.getBoundingClientRect().top);
    expect(legend.textContent).not.toContain('1970');
});

it('repaints the canvas series when an ancestor changes appearance', async () => {
    const screen = await render(
        <div data-ui-theme="light">
            <LineChart
                label="Theme-aware chart"
                points={[
                    { x: '2026-01-01', y: 10 },
                    { x: '2026-02-01', y: 20 },
                ]}
            />
        </div>,
    );
    const chart = screen.getByRole('figure', { name: 'Theme-aware chart' }).element();
    const markerColour = (): string | undefined => {
        const marker = chart.querySelector('.u-series:last-child .u-marker');
        return marker instanceof HTMLElement ? marker.style.borderColor : undefined;
    };
    await expect.poll(markerColour).toBeTruthy();
    const lightColour = markerColour();
    const scope = chart.parentElement;
    if (!scope) throw new Error('Missing theme scope');
    scope.dataset.uiTheme = 'dark';
    await expect.poll(markerColour).not.toBe(lightColour);
    scope.dataset.uiTheme = 'light';
    await expect.poll(markerColour).toBe(lightColour);
});

it('renders a condensed sparkline without axes or chart data disclosure', async () => {
    const screen = await render(
        <Sparkline
            label="Trading activity sparkline"
            points={[
                { x: '2024-01-01', y: 100 },
                { x: '2024-02-01', y: 140 },
                { x: '2024-03-01', y: 120 },
            ]}
        />,
    );
    const chart = screen.getByRole('figure', { name: 'Trading activity sparkline' }).element();
    await expect.element(screen.getByRole('figure', { name: 'Trading activity sparkline' })).toBeVisible();
    expect(chart.querySelector('.uplot')).not.toBeNull();
    expect(chart.querySelector('.u-legend')).toBeNull();
    expect(screen.container.querySelector('.ui-chart-data')).toBeNull();
});

it('keeps an empty sparkline slot at the same height', async () => {
    const screen = await render(<Sparkline label="Empty sparkline" points={[]} />);
    const chart = screen.getByRole('figure', { name: 'Empty sparkline' }).element();
    expect(chart.querySelector('.ui-sparkline-empty')).not.toBeNull();
    expect(chart.querySelector('.uplot')).toBeNull();
});

it('renders categorical bars with uPlot and exposes exact category values', async () => {
    const screen = await render(
        <BarChart
            label="Funding sources"
            categoryLabel="Funding bucket"
            seriesLabel="Value (USD)"
            data={[
                { label: 'Bank', value: 120 },
                { label: 'Exchange', value: 40 },
                { label: 'Other', value: 0 },
            ]}
        />,
    );
    const chart = screen.getByRole('figure', { name: 'Funding sources' });
    expect(chart.element().querySelector('.uplot canvas')).not.toBeNull();
    await screen.getByText('View chart data', { exact: true }).click();
    await expect.element(screen.getByRole('cell', { name: 'Bank', exact: true })).toBeVisible();
    await expect.element(screen.getByRole('cell', { name: '120', exact: true })).toBeVisible();
    await expect.element(screen.getByRole('cell', { name: '0', exact: true })).toBeVisible();
    expect(chart.element().textContent).not.toContain('1970');
});
