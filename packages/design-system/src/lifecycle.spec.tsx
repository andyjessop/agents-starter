import { StrictMode, useState, type ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { Tabs } from './react/tabs';
import { Combobox } from './react/combobox';
import { attachTooltip } from './behaviours/tooltip';
import { attachDialog } from './behaviours/dialog';
import { attachMenu } from './behaviours/menu';
import { TabsElement } from './elements/tabs';
import { ComboboxElement } from './elements/combobox';
import { register } from './elements/register';
import { MenuElement } from './elements/menu';

const releases: (() => void)[] = [];
afterEach(() => {
    releases
        .splice(0)
        .reverse()
        .forEach((fn) => {
            fn();
        });
    vi.useRealTimers();
});
function host(markup: string): HTMLElement {
    const root = document.createElement('section');
    document.body.append(root);
    root.innerHTML = markup;
    releases.push(() => {
        root.remove();
    });
    return root;
}
function get(root: HTMLElement, selector: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
}
it('controlled React tabs reject requests without committing and accept a later snapshot', async () => {
    const request = vi.fn();
    const items = [
        { value: 'a', label: 'Alpha', content: 'First' },
        { value: 'b', label: 'Beta', content: 'Second' },
    ];
    const Example = (): ReactNode => {
        const [value, setValue] = useState('a');
        return (
            <StrictMode>
                <Tabs label="Controlled tabs" items={items} value={value} onValueChange={request} />
                <button
                    type="button"
                    onClick={() => {
                        setValue('b');
                    }}
                >
                    Accept
                </button>
            </StrictMode>
        );
    };
    const screen = await render(<Example />);
    await userEvent.click(screen.getByText('Alpha'));
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(request).toHaveBeenCalledTimes(1);
    await expect.element(screen.getByRole('tabpanel')).toHaveTextContent('First');
    await userEvent.click(screen.getByText('Accept'));
    await expect.element(screen.getByRole('tabpanel')).toHaveTextContent('Second');
});
it('uncontrolled element selection survives reconnect and rejected events do not commit', async () => {
    const root = host(
        '<ui-tabs><div data-ui-part="list" aria-label="Tabs"><button id="ta" data-ui-part="tab" data-ui-value="a">Alpha</button><button id="tb" data-ui-part="tab" data-ui-value="b">Beta</button></div><div id="pa" data-ui-part="panel" data-ui-value="a">First</div><div id="pb" data-ui-part="panel" data-ui-value="b">Second</div></ui-tabs>',
    );
    const tabs = get(root, 'ui-tabs');
    expect(tabs).toBeInstanceOf(TabsElement);
    await Promise.resolve();
    expect(get(root, '#ta').getAttribute('data-label')).toBe('Alpha');
    expect(get(root, '#tb').getAttribute('data-label')).toBe('Beta');
    const reject = (event: Event): void => {
        event.preventDefault();
    };
    tabs.addEventListener('ui-value-request', reject);
    await userEvent.click(get(root, '#tb'));
    expect(get(root, '#pa').hidden).toBe(false);
    tabs.removeEventListener('ui-value-request', reject);
    await userEvent.click(get(root, '#tb'));
    tabs.remove();
    root.append(tabs);
    await Promise.resolve();
    expect(get(root, '#pb').hidden).toBe(false);
});
it('tab selection keeps neighbouring tab positions stable', async () => {
    const root = host(
        '<ui-tabs><div data-ui-part="list" aria-label="Tabs"><button id="ta" data-ui-part="tab" data-ui-value="a">Transactions</button><button id="tb" data-ui-part="tab" data-ui-value="b">Overview</button><button id="tc" data-ui-part="tab" data-ui-value="c">Activity</button></div><div id="pa" data-ui-part="panel" data-ui-value="a">First</div><div id="pb" data-ui-part="panel" data-ui-value="b">Second</div><div id="pc" data-ui-part="panel" data-ui-value="c">Third</div></ui-tabs>',
    );
    await import('./styles/index.css');
    await Promise.resolve();
    const before = [get(root, '#ta'), get(root, '#tb'), get(root, '#tc')].map((tab) => ({
        left: tab.offsetLeft,
        width: tab.offsetWidth,
    }));
    await userEvent.click(get(root, '#tb'));
    const after = [get(root, '#ta'), get(root, '#tb'), get(root, '#tc')].map((tab) => ({
        left: tab.offsetLeft,
        width: tab.offsetWidth,
    }));
    expect(after).toEqual(before);
});
it('late children attach and disconnected elements release enhancement', async () => {
    const root = host('<ui-menu></ui-menu>');
    const menu = get(root, 'ui-menu');
    await Promise.resolve();
    menu.innerHTML =
        '<button data-ui-part="trigger" disabled>Actions</button><div id="late-menu" popover="auto" data-ui-part="popup" aria-label="Actions"><button data-ui-item="a">Alpha</button></div>';
    await new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
    expect(get(menu, 'button').hasAttribute('disabled')).toBe(false);
    menu.remove();
    expect(get(menu, 'button').hasAttribute('disabled')).toBe(true);
});
it('registration rejects an incompatible definition and accepts the same class', () => {
    expect(() => {
        register('ui-menu', MenuElement);
    }).not.toThrow();
    expect(() => {
        register('ui-menu', TabsElement);
    }).toThrow('incompatible');
});
it('Strict Mode combobox survives attach/destroy/attach', async () => {
    const screen = await render(
        <StrictMode>
            <Combobox label="Fruit" defaultValue="a" options={[{ value: 'a', label: 'Apple' }]} />
        </StrictMode>,
    );
    await expect.element(screen.getByRole('combobox')).toHaveValue('Apple');
});
it('element combobox restores its uncontrolled value across reconnect', async () => {
    const root = host(
        '<ui-combobox><label for="ci">Fruit</label><input id="ci" data-ui-part="input"><div id="cl" popover="auto" data-ui-part="popup"><div id="ca" data-ui-part="option" data-ui-value="a">Apple</div></div><span data-ui-part="status"></span></ui-combobox>',
    );
    const combo = get(root, 'ui-combobox');
    if (!(combo instanceof ComboboxElement)) throw new Error('Not upgraded');
    combo.options = { options: [{ value: 'a', label: 'Apple' }] };
    await Promise.resolve();
    get(combo, 'input').focus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    combo.remove();
    root.append(combo);
    await Promise.resolve();
    expect((get(combo, 'input') as HTMLInputElement).value).toBe('Apple');
});
it('tooltip Escape is scoped and description tokens survive destruction', async () => {
    const root = host(
        '<button data-ui-part="trigger" aria-describedby="existing">Help</button><span data-ui-part="popup" id="tip" popover="manual">Description</span>',
    );
    const tip = get(root, '#tip');
    const trigger = get(root, 'button');
    const controller = attachTooltip(root);
    releases.push(controller.destroy);
    trigger.focus();
    expect(tip.matches(':popover-open')).toBe(true);
    expect(trigger.getAttribute('aria-describedby')).toBe('existing tip');
    await userEvent.keyboard('{Escape}');
    expect(tip.matches(':popover-open')).toBe(false);
    trigger.dispatchEvent(new FocusEvent('focus'));
    expect(tip.matches(':popover-open')).toBe(false);
    controller.destroy();
    expect(trigger.getAttribute('aria-describedby')).toBe('existing');
});
it('nested menu Escape leaves the dialog open and cancel can be vetoed', async () => {
    const root = host(
        '<button id="invoker">Open</button><dialog aria-label="Modal"><div id="nested"><button data-ui-part="trigger">Actions</button><div data-ui-part="popup" popover="auto" id="nested-popup" aria-label="Actions"><button data-ui-item="a">Alpha</button></div></div></dialog>',
    );
    const dialog = get(root, 'dialog');
    const modal = attachDialog(dialog, {
        onCancel: (event) => {
            event.preventDefault();
        },
    });
    releases.push(modal.destroy);
    modal.show(get(root, '#invoker'));
    const menu = attachMenu(get(root, '#nested'));
    releases.push(menu.destroy);
    menu.show();
    await userEvent.keyboard('{Escape}');
    expect((dialog as HTMLDialogElement).open).toBe(true);
    await userEvent.keyboard('{Escape}');
    expect((dialog as HTMLDialogElement).open).toBe(true);
    modal.hide();
    expect(document.activeElement).toBe(get(root, '#invoker'));
});
it('destroy does not overwrite later host ARIA changes', () => {
    const root = host(
        '<button data-ui-part="trigger">Help</button><span id="dtip" data-ui-part="popup" popover="manual">Description</span>',
    );
    const controller = attachTooltip(root);
    const trigger = get(root, 'button');
    trigger.setAttribute('aria-describedby', 'host-new-description');
    controller.destroy();
    controller.destroy();
    expect(trigger.getAttribute('aria-describedby')).toBe('host-new-description');
});

it('recovers properties assigned before upgrade with property precedence over attributes', async () => {
    const root = host(
        '<ui-popover disabled><button disabled data-ui-part="trigger">Details</button><div id="preupgrade" data-ui-part="popup" popover="auto">Content</div></ui-popover>',
    );
    const element = get(root, 'ui-popover');
    Reflect.set(element, 'options', { disabled: false });
    await import('./elements/popover');
    await Promise.resolve();
    expect(get(element, 'button').hasAttribute('disabled')).toBe(false);
    element.removeAttribute('disabled');
    element.setAttribute('disabled', '');
    expect(get(element, 'button').hasAttribute('disabled')).toBe(true);
});

it('tooltip hover waits, departure has a grace period, and destruction clears timers', () => {
    vi.useFakeTimers();
    const root = host(
        '<button data-ui-part="trigger">Help</button><span id="timed-tip" data-ui-part="popup" popover="manual">Description</span>',
    );
    const tooltip = attachTooltip(root);
    const trigger = get(root, 'button');
    const surface = get(root, 'span');
    trigger.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(499);
    expect(surface.matches(':popover-open')).toBe(false);
    vi.advanceTimersByTime(1);
    expect(surface.matches(':popover-open')).toBe(true);
    trigger.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(99);
    expect(surface.matches(':popover-open')).toBe(true);
    surface.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));
    vi.advanceTimersByTime(100);
    expect(surface.matches(':popover-open')).toBe(true);
    tooltip.destroy();
    vi.advanceTimersByTime(1_000);
    expect(surface.matches(':popover-open')).toBe(false);
});

it('stale controller handles cannot modify a reattached menu', () => {
    const root = host(
        '<button data-ui-part="trigger">Actions</button><div id="stale-menu" data-ui-part="popup" popover="auto" aria-label="Actions"><button data-ui-item="a">Alpha</button></div>',
    );
    const stale = attachMenu(root);
    stale.destroy();
    const current = attachMenu(root);
    releases.push(current.destroy);
    current.show();
    stale.hide();
    stale.refresh();
    stale.update({ disabled: true });
    expect(get(root, '[popover]').matches(':popover-open')).toBe(true);
    expect(get(root, '[data-ui-part="trigger"]').hasAttribute('disabled')).toBe(false);
});
