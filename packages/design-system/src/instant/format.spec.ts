import { expect, it } from 'vitest';

import {
    formatAbsoluteInstant,
    formatInstantDisplay,
    formatRelativeInstant,
    INSTANT_AUTO_RELATIVE_WINDOW_MS,
} from './format';

const now = Date.parse('2026-10-06T16:00:00.000Z');

it('formats relative future and past instants', () => {
    expect(formatRelativeInstant('2026-10-06T16:56:11.084Z', now)).toBe('in 56 minutes');
    expect(formatRelativeInstant('2026-10-06T15:00:00.000Z', now)).toBe('1 hour ago');
});

it('auto mode switches to absolute outside the relative window', () => {
    const far = new Date(now + INSTANT_AUTO_RELATIVE_WINDOW_MS + 86_400_000).toISOString();
    expect(formatInstantDisplay({ iso: far, display: 'auto', nowMs: now }).mode).toBe('absolute');
});

it('deadline mode shows Expired after the instant passes', () => {
    expect(
        formatInstantDisplay({
            iso: '2026-10-06T15:59:00.000Z',
            display: 'relative',
            deadline: true,
            nowMs: now,
        }).label,
    ).toBe('Expired');
});

it('relative mode exposes an absolute tooltip label', () => {
    const formatted = formatInstantDisplay({
        iso: '2026-10-06T16:30:00.000Z',
        display: 'relative',
        nowMs: now,
        timeZone: 'UTC',
    });
    expect(formatted.mode).toBe('relative');
    expect(formatted.label).toBe('in 30 minutes');
    expect(formatted.tooltipAbsolute).not.toBeNull();
    expect(formatAbsoluteInstant('2026-10-06T16:30:00.000Z', { timeZone: 'UTC' })).toBe(
        '6 Oct 2026, 16:30',
    );
});
