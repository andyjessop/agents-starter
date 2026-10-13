import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import '../styles/index.css';
import { CopyButton } from './copy-button';

afterEach(() => {
    vi.useRealTimers();
});

it('copies the value, shows a success tick, then returns to the copy icon', async () => {
    vi.useFakeTimers();
    const copied: string[] = [];
    const screen = await render(
        <CopyButton
            value="secret-key"
            label="Copy API key"
            copyText={(text) => {
                copied.push(text);
                return Promise.resolve();
            }}
        />,
    );

    const button = screen.getByRole('button', { name: 'Copy API key', exact: true });
    await expect.element(button).toBeVisible();
    expect(button.element().className).toContain('ui-copy-button');
    expect(button.element().getAttribute('data-copied')).toBeNull();
    expect(document.querySelector('[role="status"]')).toBeNull();

    await userEvent.click(button);
    // Flush the copy promise while timers are faked.
    await vi.advanceTimersByTimeAsync(0);
    const copiedButton = screen.getByRole('button', { name: 'Copied', exact: true });
    await expect.element(copiedButton).toBeVisible();
    expect(copied).toEqual(['secret-key']);
    expect(copiedButton.element().getAttribute('data-copied')).toBe('true');
    expect(document.querySelector('[role="status"]')).toBeNull();

    await vi.advanceTimersByTimeAsync(1_999);
    expect(copiedButton.element().getAttribute('data-copied')).toBe('true');
    await vi.advanceTimersByTimeAsync(1);
    const idleButton = screen.getByRole('button', { name: 'Copy API key', exact: true });
    await expect.element(idleButton).toBeVisible();
    expect(idleButton.element().getAttribute('data-copied')).toBeNull();
});

it('keeps the copy icon when writing fails', async () => {
    const screen = await render(
        <CopyButton value="secret-key" label="Copy API key" copyText={() => Promise.reject(new Error('denied'))} />,
    );

    const button = screen.getByRole('button', { name: 'Copy API key', exact: true });
    await userEvent.click(button);
    await expect.element(button).toBeVisible();
    expect(button.element().getAttribute('data-copied')).toBeNull();
});
