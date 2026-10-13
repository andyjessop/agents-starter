import { lifetime, part, requireId, enabled, type Controller, type Visibility } from '../../internal/controller';
import { positionPopup, type PositionOptions } from '../../internal/position';

export interface PopoverOptions extends PositionOptions {
    defaultOpen?: boolean;
    disabled?: boolean;
    onOpenChange?: (open: boolean) => void;
}
export function attachPopover(
    root: HTMLElement,
    initial: PopoverOptions = {},
): Controller<PopoverOptions> & Visibility {
    const life = lifetime(root, 'popover');
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
    let reported = false;
    let stop: (() => void) | undefined;
    function actual(): boolean {
        return popup.matches(':popover-open');
    }
    function sync(): void {
        const open = actual();
        life.attr(trigger, 'aria-expanded', String(open));
        if (!open) {
            stop?.();
            stop = undefined;
        } else if (!stop) {
            stop = positionPopup(trigger, popup, options, hide);
            if (!actual()) {
                stop();
                stop = undefined;
            }
        }
        if (reported !== open) {
            reported = open;
            options.onOpenChange?.(open);
        }
    }
    function show(): void {
        if (life.alive && root.isConnected && trigger.isConnected && !options.disabled && !actual()) {
            popup.showPopover();
            sync();
        }
    }
    function hide(): void {
        if (!life.alive) return;
        if (actual()) popup.hidePopover();
        sync();
    }
    function refresh(): void {
        if (!life.alive) return;
        life.attr(popup, 'popover', 'auto');
        life.attr(trigger, 'aria-controls', requireId(popup));
        life.attr(trigger, 'disabled', options.disabled ? '' : null);
        life.attr(trigger, 'popovertarget', null);
        if (!trigger.isConnected || options.disabled) hide();
        sync();
    }
    life.listen(trigger, 'click', () => {
        if (enabled(trigger)) {
            if (actual()) hide();
            else show();
        }
    });
    life.listen(popup, 'toggle', sync);
    life.cleanup.push(() => {
        stop?.();
        if (actual()) popup.hidePopover();
    });
    refresh();
    if (initial.defaultOpen) show();
    return {
        show,
        hide,
        refresh,
        update(next) {
            if (!life.alive) return;
            options = next;
            stop?.();
            stop = undefined;
            refresh();
        },
        destroy: life.destroy,
    };
}
