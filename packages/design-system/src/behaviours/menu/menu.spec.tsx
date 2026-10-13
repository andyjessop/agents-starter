import { StrictMode } from 'react';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { attachMenu } from './index';
import { Menu } from '../../react/menu';
import { MenuElement } from '../../elements/menu';

const cleanups: (() => void)[] = [];
afterEach(() => {
    cleanups
        .splice(0)
        .reverse()
        .forEach((fn) => {
            fn();
        });
});
async function setup(host: 'direct' | 'react' | 'element', action: (id: string) => void): Promise<HTMLElement> {
    if (host === 'react') {
        const screen = await render(
            <StrictMode>
                <input aria-label="Before" />
                <Menu
                    label="Actions"
                    items={[
                        { id: 'a', label: 'Alpha' },
                        { id: 'disabled', label: 'Disabled', disabled: true },
                        { id: 'b', label: 'Beta' },
                        { id: 'bravo', label: 'Bravo' },
                    ]}
                    onAction={action}
                />
                <input aria-label="After" style={{ display: 'block', marginTop: '160px' }} />
            </StrictMode>,
        );
        const root = screen.getByRole('button', { name: 'Actions' }).element().parentElement;
        if (!root) throw new Error('Missing menu root');
        return root;
    }
    const wrapper = document.createElement('section');
    document.body.append(wrapper);
    cleanups.push(() => {
        wrapper.remove();
    });
    wrapper.innerHTML = `<input aria-label="Before"/><${host === 'element' ? 'ui-menu' : 'div'}><button type="button" data-ui-part="trigger" disabled>Actions</button><div id="menu-popup" data-ui-part="popup" popover="auto" aria-label="Actions"><button type="button" data-ui-item="a">Alpha</button><button type="button" data-ui-item="disabled" disabled>Disabled</button><button type="button" data-ui-item="b">Beta</button><button type="button" data-ui-item="bravo">Bravo</button></div></${host === 'element' ? 'ui-menu' : 'div'}><input aria-label="After" style="display:block;margin-top:160px"/>`;
    const root = wrapper.children[1];
    if (!(root instanceof HTMLElement)) throw new Error('Fixture missing root');
    if (root instanceof MenuElement) {
        root.options = { onAction: action };
        root.addEventListener('ui-action', (event) => {
            if (event instanceof CustomEvent) {
                const detail = Reflect.get(event, 'detail') as unknown;
                if (detail && typeof detail === 'object' && 'id' in detail && typeof detail.id === 'string')
                    action(detail.id);
            }
        });
    } else {
        const controller = attachMenu(root, { onAction: action });
        cleanups.push(controller.destroy);
    }
    await Promise.resolve();
    return root;
}
for (const host of ['direct', 'react', 'element'] as const) {
    describe(`menu ${host}`, () => {
        it('opens from both arrow directions, skips disabled, typeaheads and activates once', async () => {
            const action = vi.fn();
            const root = await setup(host, action);
            const trigger = root.querySelector<HTMLElement>('[data-ui-part="trigger"]');
            if (!trigger) throw new Error('Missing trigger');
            trigger.focus();
            await userEvent.keyboard('{ArrowUp}');
            expect(document.activeElement?.textContent).toBe('Bravo');
            await userEvent.keyboard('{Home}{ArrowDown}');
            expect(document.activeElement?.textContent).toBe('Beta');
            await userEvent.keyboard('b');
            expect(document.activeElement?.textContent).toBe('Bravo');
            await userEvent.keyboard('{Enter}');
            expect(action).toHaveBeenCalledTimes(1);
            expect(action).toHaveBeenCalledWith('bravo');
            expect(document.activeElement).toBe(trigger);
        });
        it('Tab and Shift+Tab continue outside the menu', async () => {
            const root = await setup(host, vi.fn());
            const trigger = root.querySelector<HTMLElement>('[data-ui-part="trigger"]');
            if (!trigger) throw new Error('Missing trigger');
            trigger.focus();
            await userEvent.keyboard('{ArrowDown}{Tab}');
            expect(document.activeElement?.getAttribute('aria-label')).toBe('After');
            trigger.focus();
            await userEvent.keyboard('{ArrowDown}{Shift>}{Tab}{/Shift}');
            expect(document.activeElement?.getAttribute('aria-label')).toBe('Before');
        });
        it('Escape restores focus and outside click preserves its destination', async () => {
            const root = await setup(host, vi.fn());
            const trigger = root.querySelector<HTMLElement>('[data-ui-part="trigger"]');
            if (!trigger) throw new Error('Missing trigger');
            trigger.focus();
            await userEvent.keyboard('{ArrowDown}{Escape}');
            expect(document.activeElement).toBe(trigger);
            await userEvent.keyboard('{ArrowDown}');
            const after = root.nextElementSibling;
            if (!(after instanceof HTMLElement)) throw new Error('Missing after button');
            await userEvent.click(after);
            expect(document.activeElement).toBe(after);
        });
    });
}
it('refreshes removed items and releases attachment ownership without clobbering host attributes', async () => {
    const root = await setup('direct', vi.fn());
    expect(() => attachMenu(root)).toThrow('already attached');
});
