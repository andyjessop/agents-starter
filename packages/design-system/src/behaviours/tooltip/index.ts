import { lifetime, part, requireId, type Controller } from '../../internal/controller';
import { positionPopup, type PositionOptions } from '../../internal/position';

export interface TooltipOptions extends PositionOptions {
    hoverDelay?: number;
    leaveDelay?: number;
    disabled?: boolean;
}
export function attachTooltip(root: HTMLElement, initial: TooltipOptions = {}): Controller<TooltipOptions> {
    const life = lifetime(root, 'tooltip');
    let trigger: HTMLElement;
    let popup: HTMLElement;
    try {
        trigger = part(root, 'trigger');
        popup = part(root, 'popup');
        requireId(popup);
        if (popup.querySelector('button,a[href],input,select,textarea,[tabindex]'))
            throw new Error('Tooltip must be non-interactive text');
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }
    let previousId = popup.id;
    let options = initial;
    let hovering = false;
    let focused = false;
    let suppressed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stop: (() => void) | undefined;
    function clear(): void {
        clearTimeout(timer);
        timer = undefined;
    }
    function escape(event: Event): void {
        if (event instanceof KeyboardEvent && event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            suppressed = true;
            hide();
        }
    }
    function hide(): void {
        clear();
        stop?.();
        stop = undefined;
        root.ownerDocument.removeEventListener('keydown', escape, true);
        if (popup.matches(':popover-open')) popup.hidePopover();
    }
    function show(): void {
        clear();
        if (!life.alive || suppressed || options.disabled || !root.isConnected) return;
        if (!popup.matches(':popover-open')) {
            popup.showPopover();
            stop = positionPopup(trigger, popup, options, hide);
            if (!popup.matches(':popover-open')) {
                stop();
                stop = undefined;
                return;
            }
            root.ownerDocument.addEventListener('keydown', escape, true);
        }
    }
    function leave(): void {
        clear();
        if (!hovering && !focused) {
            suppressed = false;
            timer = setTimeout(hide, options.leaveDelay ?? 100);
        }
    }
    function enter(event: Event): void {
        if (event instanceof PointerEvent && event.pointerType === 'touch') return;
        hovering = true;
        clear();
        timer = setTimeout(show, options.hoverDelay ?? 500);
    }
    function depart(): void {
        hovering = false;
        leave();
    }
    for (const el of [trigger, popup]) {
        life.listen(el, 'pointerenter', enter);
        life.listen(el, 'pointerleave', depart);
    }
    life.listen(trigger, 'focus', () => {
        focused = true;
        show();
    });
    life.listen(trigger, 'blur', () => {
        focused = false;
        leave();
    });
    function refresh(): void {
        if (!life.alive) return;
        life.attr(popup, 'role', 'tooltip');
        life.attr(popup, 'popover', 'manual');
        const tokens = new Set((trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
        tokens.delete(previousId);
        previousId = requireId(popup);
        tokens.add(previousId);
        life.attr(trigger, 'aria-describedby', [...tokens].join(' '));
        if (options.disabled) hide();
    }
    life.cleanup.push(hide);
    refresh();
    return {
        refresh,
        destroy: life.destroy,
        update(next) {
            if (!life.alive) return;
            options = next;
            refresh();
        },
    };
}
