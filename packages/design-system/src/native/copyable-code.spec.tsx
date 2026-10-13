import { render } from 'vitest-browser-react';

import '../styles/index.css';
import { CopyableCode } from './copyable-code';

it('keeps the copy control inside the code surface', async () => {
    const screen = await render(
        <CopyableCode value="ndlt_abc123" label="Copy nodelet ID" />,
    );

    const copy = screen.getByRole('button', { name: 'Copy nodelet ID', exact: true });
    await expect.element(copy).toBeVisible();

    const root = copy.element().closest('.ui-copyable-code');
    expect(root).not.toBeNull();
    expect(root?.contains(copy.element())).toBe(true);
    expect(root?.getAttribute('data-layout')).toBe('inline');
    expect(root?.querySelector('.ui-copyable-code-body')?.textContent).toBe('ndlt_abc123');
    const body = root?.querySelector('.ui-copyable-code-body');
    expect(body?.nextElementSibling).toBe(copy.element());
});

it('uses block layout for multiline values', async () => {
    const screen = await render(
        <CopyableCode value={'line one\nline two'} label="Copy commands" multiline />,
    );

    const root = screen.getByRole('button', { name: 'Copy commands', exact: true }).element()
        .parentElement;
    expect(root?.getAttribute('data-layout')).toBe('block');
    expect(root?.querySelector('pre.ui-copyable-code-body')?.textContent).toBe('line one\nline two');
});
