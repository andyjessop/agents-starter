import type { Controller } from '../internal/controller';
/** Custom-element lifecycle only. Behaviour remains in the individual controllers. */
export function observeParts(root: HTMLElement, ready: () => boolean, reconcile: () => void): () => void {
    let scheduled = false;
    let active = true;
    function schedule(): void {
        if (scheduled || !active) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            if (active && root.isConnected && ready()) reconcile();
        });
    }
    const observer = new MutationObserver(schedule);
    observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [
            'id',
            'disabled',
            'data-ui-value',
            'data-ui-owner',
            'data-ui-item',
            'data-ui-selectable',
            'data-ui-disabled',
            'label',
        ],
    });
    schedule();
    return () => {
        active = false;
        observer.disconnect();
    };
}
export function recoverProperty(root: HTMLElement, key: string): void {
    if (!Object.prototype.hasOwnProperty.call(root, key)) return;
    const value: unknown = Reflect.get(root, key);
    Reflect.deleteProperty(root, key);
    Reflect.set(root, key, value);
}
export function emit(root: HTMLElement, name: string, detail: unknown, cancelable = false): boolean {
    return root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable }));
}
export type ElementController<O> = Controller<O> & {
    show?: (invoker?: HTMLElement) => void;
    hide?: () => void;
    getState?: () => { value: string | null; inputValue?: string; label?: string };
};
