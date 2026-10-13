import { userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { ApplicationFixture } from './fixtures/application.fixture';

describe('complete application', () => {
    it('opens a dialog, dismisses with Escape and restores focus', async () => {
        const screen = await render(<ApplicationFixture />);
        const trigger = screen.getByRole('button', { name: 'Open dialog', exact: true });
        await userEvent.click(trigger);
        await expect.element(screen.getByRole('dialog', { name: 'Edit profile' })).toBeVisible();
        await userEvent.keyboard('{Escape}');
        await expect.element(trigger).toHaveFocus();
    });
    it('filters and commits a country into the submitted value', async () => {
        const screen = await render(<ApplicationFixture />);
        const input = screen.getByRole('combobox', { name: 'Country' });
        await userEvent.fill(input, 'Fra');
        await userEvent.keyboard('{ArrowDown}{Enter}');
        await expect.element(input).toHaveValue('France');
        expect(document.querySelector<HTMLInputElement>('[name="country"]')?.value).toBe('France');
    });
    it('navigates tabs manually and skips disabled items', async () => {
        const screen = await render(<ApplicationFixture />);
        await userEvent.click(screen.getByRole('tab', { name: 'Overview' }));
        await userEvent.keyboard('{ArrowRight}');
        await expect.element(screen.getByRole('tab', { name: 'Activity' })).toHaveFocus();
        await expect.element(screen.getByRole('tabpanel')).toHaveTextContent('Profile overview');
        await userEvent.keyboard('{Enter}');
        await expect.element(screen.getByRole('tabpanel')).toHaveTextContent('Recent activity');
    });
});
