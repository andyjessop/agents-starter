import {
    lifetime,
    owned,
    part,
    requireId,
    unmodified,
    type Controller,
    type Request,
    type ChangeHandler,
    type Visibility,
} from '../../internal/controller';
import { positionPopup, type PositionOptions } from '../../internal/position';

export interface ComboboxOption {
    value: string;
    label: string;
    disabled?: boolean;
}
export interface ValueRequest extends Request<string | null, 'select' | 'clear' | 'reset'> {
    label: string;
}
export interface ComboboxOptions extends PositionOptions {
    options: readonly ComboboxOption[];
    value?: string | null;
    defaultValue?: string | null;
    inputValue?: string;
    defaultInputValue?: string;
    disabled?: boolean;
    loading?: boolean;
    onValueChange?: ChangeHandler<ValueRequest>;
    onInputValueChange?: ChangeHandler<Request<string, 'input' | 'select' | 'blur' | 'clear' | 'reset'>>;
    onOpenChange?: (open: boolean) => void;
}
export interface ComboboxController extends Controller<ComboboxOptions>, Visibility {
    clear: () => void;
    getState: () => { value: string | null; inputValue: string; label: string };
}
export function attachCombobox(root: HTMLElement, initial: ComboboxOptions): ComboboxController {
    const life = lifetime(root, 'combobox');
    let input: HTMLInputElement;
    let popup: HTMLElement;
    let status: HTMLElement;
    try {
        const candidate = part(root, 'input');
        if (candidate.localName !== 'input') throw new Error('Combobox requires input');
        input = candidate as HTMLInputElement;
        popup = part(root, 'popup');
        status = part(root, 'status');
        requireId(popup);
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    const valueControlled = initial.value !== undefined;
    const inputControlled = initial.inputValue !== undefined;
    let options = initial;
    let value = initial.value ?? initial.defaultValue ?? null;
    let label = initial.options.find((o) => o.value === value)?.label ?? initial.defaultInputValue ?? '';
    let query = initial.inputValue ?? initial.defaultInputValue ?? label;
    let active: string | undefined;
    let nodes: HTMLElement[] = [];
    let stop: (() => void) | undefined;
    let reported = false;
    let composing = false;
    let pointer = false;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    function isOpen(): boolean {
        return popup.matches(':popover-open');
    }
    function syncOpen(): void {
        const open = isOpen();
        life.attr(input, 'aria-expanded', String(open));
        if (!open) {
            active = undefined;
            life.attr(input, 'aria-activedescendant', null);
            stop?.();
            stop = undefined;
        }
        if (open !== reported) {
            reported = open;
            options.onOpenChange?.(open);
        }
    }
    function hide(): void {
        if (!life.alive) return;
        if (isOpen()) popup.hidePopover();
        syncOpen();
    }
    function show(): void {
        if (!life.alive || options.disabled || !root.isConnected) return;
        if (!isOpen()) {
            popup.showPopover();
            stop = positionPopup(input, popup, options, hide);
            if (!isOpen()) {
                stop();
                stop = undefined;
            }
        }
        syncOpen();
    }
    function requestQuery(next: string, reason: 'input' | 'select' | 'blur' | 'clear' | 'reset', event?: Event): void {
        if (options.onInputValueChange?.({ value: next, reason, originalEvent: event }) !== false && !inputControlled)
            query = next;
    }
    function requestValue(
        next: string | null,
        nextLabel: string,
        reason: 'select' | 'clear' | 'reset',
        event?: Event,
    ): boolean {
        const accepted =
            options.onValueChange?.({ value: next, label: nextLabel, reason, originalEvent: event }) !== false;
        if (accepted && !valueControlled) {
            value = next;
            label = nextLabel;
        }
        return accepted;
    }
    function refresh(): void {
        if (!life.alive) return;
        const values = new Set<string>();
        for (const option of options.options) {
            if (values.has(option.value)) throw new Error('Combobox option values must be unique');
            values.add(option.value);
        }
        nodes = owned(root, '[data-ui-part="option"]');
        if (nodes.length !== options.options.length)
            throw new Error('Host must render every supplied option before refresh');
        const current = options.options.find((o) => o.value === value);
        if (current) label = current.label;
        life.attr(input, 'role', 'combobox');
        life.attr(input, 'aria-autocomplete', 'list');
        life.attr(input, 'aria-controls', requireId(popup));
        life.attr(input, 'disabled', options.disabled ? '' : null);
        life.attr(popup, 'role', 'listbox');
        life.attr(popup, 'popover', 'auto');
        life.attr(popup, 'aria-busy', String(!!options.loading));
        if (!options.options.some((o) => o.value === active && !o.disabled)) active = undefined;
        for (const node of nodes) {
            const option = options.options.find((o) => o.value === node.dataset.uiValue);
            if (!option) throw new Error('Option markup must use supplied values');
            requireId(node);
            life.attr(node, 'role', 'option');
            life.attr(node, 'aria-selected', String(option.value === value));
            life.attr(node, 'aria-disabled', String(!!option.disabled));
            life.attr(node, 'data-highlighted', option.value === active ? '' : null);
        }
        const activeNode = nodes.find((n) => n.dataset.uiValue === active);
        life.attr(input, 'aria-activedescendant', isOpen() && activeNode ? activeNode.id : null);
        if (input.value !== query && !composing) input.value = query;
        const hidden = owned(root, '[data-ui-part="value"]')[0];
        if (hidden instanceof HTMLInputElement) {
            hidden.value = value ?? '';
            life.attr(hidden, 'disabled', options.disabled ? '' : null);
        }
        life.attr(status, 'role', 'status');
        life.attr(status, 'aria-live', 'polite');
        const message = options.loading ? 'Loading results' : `${options.options.length} results available`;
        if (status.textContent !== message) status.textContent = message;
        if (options.disabled) hide();
        syncOpen();
    }
    function commit(option: ComboboxOption, event: Event): boolean {
        if (option.disabled || options.disabled) return false;
        clearTimeout(blurTimer);
        pointer = false;
        if (requestValue(option.value, option.label, 'select', event)) {
            requestQuery(option.label, 'select', event);
            hide();
            refresh();
            input.focus();
            return true;
        }
        return false;
    }
    function restore(event: Event): void {
        if (!life.alive) return;
        requestQuery(label, 'blur', event);
        hide();
        refresh();
    }
    life.listen(input, 'compositionstart', () => {
        composing = true;
    });
    life.listen(input, 'compositionend', () => {
        composing = false;
    });
    life.listen(input, 'input', (event) => {
        requestQuery(input.value, 'input', event);
        show();
    });
    life.listen(input, 'keydown', (event) => {
        if (!(event instanceof KeyboardEvent) || !unmodified(event) || composing || options.disabled) return;
        const available = options.options.filter((o) => !o.disabled);
        const index = available.findIndex((o) => o.value === active);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show();
            let next = index < 0 ? available.length - 1 : Math.max(0, index - 1);
            if (event.key === 'ArrowDown') next = Math.min(index + 1, available.length - 1);
            active = available[next]?.value;
            refresh();
            nodes.find((n) => n.dataset.uiValue === active)?.scrollIntoView({ block: 'nearest' });
        } else if (event.key === 'Enter' && isOpen()) {
            const option = available.find((o) => o.value === active);
            if (option && commit(option, event)) event.preventDefault();
        } else if (event.key === 'Escape' && isOpen()) {
            event.preventDefault();
            event.stopPropagation();
            hide();
        } else if (event.key === 'Tab') {
            hide();
        }
    });
    life.listen(popup, 'pointerdown', (event) => {
        if (event.target instanceof Element && event.target.closest('[data-ui-part="option"]')) pointer = true;
    });
    life.listen(popup, 'pointercancel', () => {
        pointer = false;
        if (root.ownerDocument.activeElement !== input) restore(new Event('blur'));
    });
    life.listen(popup, 'click', (event) => {
        const node =
            event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-part="option"]') : null;
        const option =
            node && nodes.includes(node) ? options.options.find((o) => o.value === node.dataset.uiValue) : undefined;
        if (option) commit(option, event);
        pointer = false;
    });
    life.listen(root.ownerDocument, 'pointerup', () => {
        if (pointer)
            blurTimer = setTimeout(() => {
                pointer = false;
                if (root.ownerDocument.activeElement !== input) restore(new Event('blur'));
            }, 0);
    });
    life.listen(input, 'blur', (event) => {
        blurTimer = setTimeout(() => {
            if (!pointer) restore(event);
        }, 0);
    });
    life.listen(popup, 'toggle', syncOpen);
    if (input.form)
        life.listen(input.form, 'reset', (event) => {
            // Native reset runs after the event; queue reconciliation after the default action.
            queueMicrotask(() => {
                if (!life.alive || event.defaultPrevented) return;
                const next = initial.defaultValue ?? null;
                const nextLabel = initial.options.find((o) => o.value === next)?.label ?? '';
                requestValue(next, nextLabel, 'reset', event);
                requestQuery(initial.defaultInputValue ?? nextLabel, 'reset', event);
                hide();
                refresh();
            });
        });
    life.cleanup.push(() => {
        clearTimeout(blurTimer);
        stop?.();
        if (isOpen()) popup.hidePopover();
    });
    try {
        refresh();
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    return {
        show,
        hide,
        refresh,
        destroy: life.destroy,
        getState: () => ({ value, inputValue: query, label }),
        clear() {
            if (!life.alive) return;
            if (requestValue(null, '', 'clear')) requestQuery('', 'clear');
            refresh();
        },
        update(next) {
            if (!life.alive) return;
            if ((next.value !== undefined) !== valueControlled || (next.inputValue !== undefined) !== inputControlled)
                throw new Error('Combobox cannot switch control mode');
            options = next;
            if (valueControlled) value = next.value ?? null;
            if (inputControlled) query = next.inputValue ?? '';
            refresh();
        },
    };
}
