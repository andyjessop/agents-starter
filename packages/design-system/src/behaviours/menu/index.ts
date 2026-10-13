import {
    enabled,
    lifetime,
    owned,
    part,
    requireId,
    unmodified,
    type Controller,
    type Visibility,
} from '../../internal/controller';
import { attachPopover, type PopoverOptions } from '../popover';

export interface MenuOptions extends PopoverOptions {
    onAction?: (id: string) => void;
}
export function attachMenu(root: HTMLElement, initial: MenuOptions = {}): Controller<MenuOptions> & Visibility {
    const life = lifetime(root, 'menu');
    let trigger: HTMLElement;
    let popup: HTMLElement;
    try {
        trigger = part(root, 'trigger');
        popup = part(root, 'popup');
        requireId(popup);
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    let options = initial;
    let items: HTMLElement[] = [];
    let focused: HTMLElement | undefined;
    let text = '';
    let lastKey = 0;
    life.attr(popup, 'role', 'menu');
    life.attr(popup, 'tabindex', '-1');
    life.attr(trigger, 'aria-haspopup', 'menu');
    const popover = attachPopover(root, options);
    // Both behaviours share one physical root; keep the public ownership boundary explicit.
    life.attr(root, 'data-ui-root', 'menu');
    function focus(item?: HTMLElement): void {
        focused = item;
        (item ?? popup).focus();
    }
    function refresh(): void {
        if (!life.alive) return;
        const oldIndex = focused ? items.indexOf(focused) : -1;
        const all = owned(root, '[data-ui-item]');
        const ids = new Set<string>();
        for (const item of all) {
            const id = item.dataset.uiItem;
            if (!id || ids.has(id) || item.localName !== 'button')
                throw new Error('Menu requires unique action IDs on buttons');
            ids.add(id);
            life.attr(item, 'role', 'menuitem');
            life.attr(item, 'tabindex', '-1');
            life.attr(item, 'aria-disabled', String(!enabled(item) && item.hasAttribute('disabled')));
        }
        items = all.filter(enabled);
        popover.refresh();
        if (focused && !items.includes(focused) && popup.matches(':popover-open'))
            focus(items[Math.min(Math.max(0, oldIndex), items.length - 1)]);
    }
    function open(last = false): void {
        popover.show();
        if (popup.matches(':popover-open')) focus(last ? items.at(-1) : items[0]);
    }
    function close(restore: boolean): void {
        if (!life.alive) return;
        const active = root.ownerDocument.activeElement;
        const owns = popup.contains(active) || active === trigger;
        popover.hide();
        if (restore && owns && trigger.isConnected) trigger.focus();
    }
    life.listen(trigger, 'keydown', (event) => {
        if (!(event instanceof KeyboardEvent) || !unmodified(event) || options.disabled) return;
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            open(event.key === 'ArrowUp');
        }
    });
    life.listen(trigger, 'click', () => {
        if (popup.matches(':popover-open')) focus(items[0]);
    });
    life.listen(popup, 'keydown', (event) => {
        if (
            !(event instanceof KeyboardEvent) ||
            !unmodified(event) ||
            !popup.matches(':popover-open') ||
            (event.target instanceof Element && event.target.closest('[data-ui-root]') !== root)
        )
            return;
        const index = items.indexOf(root.ownerDocument.activeElement as HTMLElement);
        let next: number | undefined;
        if (event.key === 'ArrowDown') next = (index + 1) % items.length;
        if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = items.length - 1;
        if (next !== undefined) {
            event.preventDefault();
            focus(items[next]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close(true);
        } else if (event.key === 'Tab') {
            // Restore the document's sequential starting point before native Tab runs.
            close(true);
        } else if (event.key.length === 1 && event.key !== ' ') {
            event.preventDefault();
            const now = Date.now();
            text = now - lastKey > 500 ? event.key : text + event.key;
            lastKey = now;
            const query = text.toLowerCase() === event.key.toLowerCase().repeat(text.length) ? event.key : text;
            const match = items
                .slice(index + 1)
                .concat(items.slice(0, index + 1))
                .find((item) => item.textContent.trim().toLowerCase().startsWith(query.toLowerCase()));
            if (match) focus(match);
        }
    });
    life.listen(popup, 'click', (event) => {
        const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-item]') : null;
        if (!item || !items.includes(item) || !enabled(item)) return;
        close(true);
        const id = item.dataset.uiItem;
        if (id) options.onAction?.(id);
    });
    life.cleanup.push(popover.destroy);
    try {
        refresh();
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    return {
        show: () => {
            open();
        },
        hide: () => {
            close(false);
        },
        refresh,
        update(next) {
            if (!life.alive) return;
            options = next;
            popover.update(next);
            refresh();
        },
        destroy: life.destroy,
    };
}
