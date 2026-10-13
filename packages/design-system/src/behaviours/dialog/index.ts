import { lifetime, owned, type Controller, type Visibility } from '../../internal/controller';

export interface DialogOptions {
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    onCancel?: (event: Event) => void;
    initialFocus?: HTMLElement | (() => HTMLElement | null);
    backdropDismiss?: boolean;
    /** Dismiss UI calls onOpenChange(false) only; the host closes via hide(). */
    controlled?: boolean;
}

const FIELD_SELECTOR = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Prefer a form field in content, then any content control, then the footer (skipping the close button). */
function defaultInitialFocus(dialog: HTMLDialogElement): HTMLElement | null {
    const content = dialog.querySelector('.ui-dialog-content');
    const footer = dialog.querySelector('.ui-dialog-footer');
    const field = content?.querySelector<HTMLElement>(FIELD_SELECTOR);
    if (field) return field;
    const inContent = content?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    if (inContent) return inContent;
    return footer?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? null;
}

function resolveInitialFocus(dialog: HTMLDialogElement, options: DialogOptions): HTMLElement | null | undefined {
    if (options.initialFocus !== undefined) {
        return typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus;
    }
    return defaultInitialFocus(dialog);
}

export function attachDialog(root: HTMLElement, initial: DialogOptions = {}): Controller<DialogOptions> & Visibility {
    const life = lifetime(root, 'dialog');
    if (root.localName !== 'dialog') {
        life.destroy();
        throw new Error('Dialog root must be a native dialog');
    }
    const dialog = root as HTMLDialogElement;
    let options = initial;
    let invoker: HTMLElement | null = null;
    let reported = false;
    let down = false;
    function sync(): void {
        if (reported !== dialog.open) {
            reported = dialog.open;
            options.onOpenChange?.(dialog.open);
        }
    }
    function requestDismiss(): void {
        if (options.controlled) {
            if (reported) {
                reported = false;
                options.onOpenChange?.(false);
            }
            return;
        }
        hide();
    }
    function restore(): void {
        const active = root.ownerDocument.activeElement;
        if (invoker?.isConnected && (active === root.ownerDocument.body || root.contains(active))) invoker.focus();
    }
    function show(explicitInvoker?: HTMLElement): void {
        if (!life.alive || !root.isConnected || dialog.open) return;
        const active = root.ownerDocument.activeElement;
        invoker = explicitInvoker ?? (active instanceof HTMLElement ? active : null);
        dialog.showModal();
        resolveInitialFocus(dialog, options)?.focus();
        reported = true;
        if (!options.controlled) {
            options.onOpenChange?.(true);
        }
    }
    function hide(): void {
        if (!life.alive) return;
        if (dialog.open) {
            dialog.close();
            restore();
        }
        if (!options.controlled) {
            sync();
        }
    }
    life.listen(dialog, 'cancel', (event) => {
        options.onCancel?.(event);
        if (options.controlled && !event.defaultPrevented) {
            event.preventDefault();
            requestDismiss();
        }
    });
    life.listen(dialog, 'close', () => {
        restore();
        if (!options.controlled) {
            sync();
        }
    });
    function backdrop(event: Event): boolean {
        if (!(event instanceof PointerEvent) || event.target !== dialog) return false;
        const r = dialog.getBoundingClientRect();
        return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
    }
    life.listen(dialog, 'pointerdown', (event) => {
        down = backdrop(event);
    });
    life.listen(dialog, 'pointerup', (event) => {
        if (down && backdrop(event) && options.backdropDismiss) requestDismiss();
        down = false;
    });
    life.listen(dialog, 'pointercancel', () => {
        down = false;
    });
    life.listen(dialog, 'click', (event) => {
        const close =
            event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-part="close"]') : null;
        if (close && owned(root, '[data-ui-part="close"]').includes(close)) requestDismiss();
    });
    life.cleanup.push(() => {
        if (dialog.open) dialog.close();
    });
    if (initial.defaultOpen) show();
    return {
        show,
        hide,
        refresh: sync,
        destroy: life.destroy,
        update(next) {
            if (!life.alive) return;
            options = next;
        },
    };
}
export type { Visibility } from '../../internal/controller';
