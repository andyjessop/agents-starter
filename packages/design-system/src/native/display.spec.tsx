import { render } from 'vitest-browser-react';

import '../styles/index.css';
import { Button } from './controls';
import { Chip, Empty } from './display';

it('centres a muted empty region with a decorative icon', async () => {
    const screen = await render(
        <Empty title="No snapshots yet" description="Wallets sit on the case until someone starts a run." />,
    );

    const heading = screen.getByRole('heading', { name: 'No snapshots yet', exact: true });
    await expect.element(heading).toBeVisible();
    await expect
        .element(screen.getByText('Wallets sit on the case until someone starts a run.', { exact: true }))
        .toBeVisible();

    const root = heading.element().parentElement;
    if (!(root instanceof HTMLElement)) throw new Error('Missing empty root');
    expect(root.className).toContain('ui-empty');
    const style = getComputedStyle(root);
    expect(style.alignItems).toBe('center');
    expect(style.justifyContent).toBe('center');
    expect(style.textAlign).toBe('center');

    const icon = root.querySelector('.ui-empty-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('svg[aria-hidden="true"]')).not.toBeNull();

    const description = root.querySelector('p');
    if (!(description instanceof HTMLElement)) throw new Error('Missing empty description');
    expect(getComputedStyle(description).color).not.toBe(getComputedStyle(heading.element()).color);
});

it('shows an action and can omit the icon', async () => {
    const screen = await render(
        <Empty
            title="No yield"
            description="This snapshot was cancelled before it finished."
            icon={null}
            action={<Button>Back to snapshots</Button>}
        />,
    );

    await expect.element(screen.getByRole('button', { name: 'Back to snapshots', exact: true })).toBeVisible();
    expect(document.querySelector('.ui-empty-icon')).toBeNull();
});

it('draws a chip with a visible border', async () => {
    const screen = await render(<Chip>SampleBank</Chip>);
    const chip = screen.getByText('SampleBank', { exact: true }).element();
    expect(chip.className).toContain('ui-chip');
    expect(Number.parseFloat(getComputedStyle(chip).borderTopWidth)).toBeGreaterThan(0);
});
