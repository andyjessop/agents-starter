import { createToastStore, type ToastStore } from '../behaviours/toast';
import { emit, observeParts } from './lifecycle';
import { register } from './register';
/** The host renders snapshots into light DOM; this element never manufactures children. */
export class ToastElement extends HTMLElement {
    private current: ToastStore | undefined;
    private stop: (() => void) | undefined;
    private unsubscribe: (() => void) | undefined;
    get store(): ToastStore {
        if (!this.current) this.current = createToastStore(this.ownerDocument);
        return this.current;
    }
    connectedCallback(): void {
        this.unsubscribe = this.store.subscribe(() => emit(this, 'ui-toast-change', this.store.getSnapshot()));
        const pause = (event: Event): void => {
            const item = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-ui-toast]') : null;
            if (!item) return;
            const id = item.dataset.uiToast;
            if (!id) return;
            const isFocus = event.type.startsWith('focus');
            const leave = event.type === 'pointerout' || event.type === 'focusout';
            if (
                leave &&
                event instanceof FocusEvent &&
                event.relatedTarget instanceof Node &&
                item.contains(event.relatedTarget)
            )
                return;
            if (
                leave &&
                event instanceof PointerEvent &&
                event.relatedTarget instanceof Node &&
                item.contains(event.relatedTarget)
            )
                return;
            this.store.pause(id, isFocus ? 'focus' : 'hover', !leave);
        };
        for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout']) this.addEventListener(type, pause);
        const unobserve = observeParts(
            this,
            () => true,
            () => {
                const polite = this.querySelector('[data-ui-part="polite"]');
                const urgent = this.querySelector('[data-ui-part="urgent"]');
                polite?.setAttribute('aria-live', 'polite');
                urgent?.setAttribute('aria-live', 'assertive');
            },
        );
        this.stop = () => {
            unobserve();
            for (const type of ['pointerover', 'pointerout', 'focusin', 'focusout'])
                this.removeEventListener(type, pause);
        };
    }
    disconnectedCallback(): void {
        this.stop?.();
        this.unsubscribe?.();
        this.current?.destroy();
        this.current = undefined;
    }
    adoptedCallback(): void {
        this.disconnectedCallback();
        if (this.isConnected) this.connectedCallback();
    }
}
register('ui-toast', ToastElement);
