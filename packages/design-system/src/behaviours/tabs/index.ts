import {
    enabled,
    lifetime,
    owned,
    part,
    requireId,
    unmodified,
    type Controller,
    type Request,
    type ChangeHandler,
} from '../../internal/controller';

export interface TabsOptions {
    value?: string | null;
    defaultValue?: string | null;
    activation?: 'manual' | 'automatic';
    orientation?: 'horizontal' | 'vertical';
    onValueChange?: ChangeHandler<Request<string, 'activate' | 'navigate'>>;
}
export function attachTabs(
    root: HTMLElement,
    initial: TabsOptions = {},
): Controller<TabsOptions> & { getState: () => { value: string | null } } {
    const life = lifetime(root, 'tabs');
    let list: HTMLElement;
    try {
        list = part(root, 'list');
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    const controlled = initial.value !== undefined;
    let options = initial;
    let value = initial.value ?? initial.defaultValue ?? null;
    let focusValue: string | undefined;
    let tabs: HTMLElement[] = [];
    function refresh(): void {
        if (!life.alive) return;
        tabs = owned(root, '[data-ui-part="tab"]');
        for (const tab of tabs)
            if (tab.hasAttribute('data-ui-gated'))
                life.attr(tab, 'disabled', tab.dataset.uiDisabled === 'true' ? '' : null);
        const panels = owned(root, '[data-ui-part="panel"]');
        const enabledTabs = tabs.filter(enabled);
        if (!controlled && !enabledTabs.some((t) => t.dataset.uiValue === value))
            value = enabledTabs[0]?.dataset.uiValue ?? null;
        if (!enabledTabs.some((t) => t.dataset.uiValue === focusValue))
            focusValue =
                enabledTabs.find((t) => t.dataset.uiValue === value)?.dataset.uiValue ??
                enabledTabs[0]?.dataset.uiValue;
        life.attr(list, 'role', 'tablist');
        life.attr(list, 'aria-orientation', options.orientation ?? 'horizontal');
        life.attr(root, 'data-orientation', options.orientation ?? 'horizontal');
        const seen = new Set<string>();
        for (const tab of tabs) {
            const id = tab.dataset.uiValue;
            if (!id || seen.has(id)) throw new Error('Tabs require unique data-ui-value identifiers');
            seen.add(id);
            const panel = panels.find((p) => p.dataset.uiValue === id);
            if (!panel) throw new Error(`Missing panel for ${id}`);
            const selected = id === value && enabled(tab);
            const label = tab.textContent.replace(/\s+/g, ' ').trim();
            life.attr(tab, 'role', 'tab');
            life.attr(tab, 'aria-controls', requireId(panel));
            life.attr(tab, 'aria-selected', String(selected));
            life.attr(tab, 'data-active', selected ? '' : null);
            life.attr(tab, 'data-label', label || null);
            life.attr(tab, 'tabindex', id === focusValue ? '0' : '-1');
            life.attr(panel, 'role', 'tabpanel');
            life.attr(panel, 'aria-labelledby', requireId(tab));
            life.attr(panel, 'hidden', selected ? null : '');
        }
        for (const panel of panels) if (!seen.has(panel.dataset.uiValue ?? '')) life.attr(panel, 'hidden', '');
    }
    function request(tab: HTMLElement, reason: 'activate' | 'navigate', event: Event): void {
        const next = tab.dataset.uiValue;
        if (!next || !enabled(tab)) return;
        focusValue = next;
        if (
            next !== value &&
            options.onValueChange?.({ value: next, reason, originalEvent: event }) !== false &&
            !controlled
        )
            value = next;
        refresh();
    }
    life.listen(list, 'click', (event) => {
        const tab = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-part="tab"]') : null;
        if (tab && tabs.includes(tab)) request(tab, 'activate', event);
    });
    life.listen(list, 'keydown', (event) => {
        if (!(event instanceof KeyboardEvent) || !unmodified(event)) return;
        const current = tabs.find((t) => t === root.ownerDocument.activeElement);
        if (!current) return;
        const available = tabs.filter(enabled);
        const index = available.indexOf(current);
        const vertical = options.orientation === 'vertical';
        const rtl = root.ownerDocument.defaultView?.getComputedStyle(list).direction === 'rtl';
        const horizontalForward = rtl ? 'ArrowLeft' : 'ArrowRight';
        const forward = vertical ? 'ArrowDown' : horizontalForward;
        const horizontalBackward = rtl ? 'ArrowRight' : 'ArrowLeft';
        const backward = vertical ? 'ArrowUp' : horizontalBackward;
        let next: HTMLElement | undefined;
        if (event.key === forward) next = available[(index + 1) % available.length];
        if (event.key === backward) next = available[(index - 1 + available.length) % available.length];
        if (event.key === 'Home') [next] = available;
        if (event.key === 'End') next = available.at(-1);
        if (next) {
            event.preventDefault();
            focusValue = next.dataset.uiValue;
            refresh();
            next.focus();
            if (options.activation === 'automatic') request(next, 'navigate', event);
        }
    });
    try {
        refresh();
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    return {
        getState: () => ({ value }),
        refresh,
        destroy: life.destroy,
        update(next) {
            if (!life.alive) return;
            if ((next.value !== undefined) !== controlled) throw new Error('Tabs cannot switch control mode');
            options = next;
            if (controlled) value = next.value ?? null;
            refresh();
        },
    };
}
