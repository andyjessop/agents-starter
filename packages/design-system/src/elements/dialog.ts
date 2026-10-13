import { attachDialog, type DialogOptions } from '../behaviours/dialog';
import { register } from './register';
import { observeParts, recoverProperty, emit, type ElementController } from './lifecycle';

export class DialogElement extends HTMLElement {
    static observedAttributes = ['disabled', 'value', 'input-value', 'default-open'];
    private connected = false;
    private controller: ElementController<DialogOptions> | undefined;
    private stop: (() => void) | undefined;
    private configuration: DialogOptions = {};
    get options(): DialogOptions {
        return this.configuration;
    }
    set options(value: DialogOptions) {
        this.configuration = value;
        this.reconcile();
    }
    connectedCallback(): void {
        recoverProperty(this, 'options');
        this.connected = true;
        this.stop = observeParts(
            this,
            () => ['dialog'].every((name) => this.querySelector(`[data-ui-part="${name}"]`)),
            () => {
                this.reconcile();
            },
        );
    }
    disconnectedCallback(): void {
        this.connected = false;
        this.stop?.();
        this.stop = undefined;
        this.controller?.destroy();
        this.controller = undefined;
    }
    adoptedCallback(): void {
        this.disconnectedCallback();
        if (this.isConnected) this.connectedCallback();
    }
    attributeChangedCallback(_name: string): void {
        if (!this.connected) return;
        this.reconcile();
    }
    private reconcile(): void {
        if (
            !this.connected ||
            !this.isConnected ||
            !['dialog'].every((name) => this.querySelector(`[data-ui-part="${name}"]`))
        )
            return;
        const options: DialogOptions = {
            ...this.configuration,
            onOpenChange: (open: boolean) => emit(this, 'ui-open-change', { open }),
            defaultOpen: this.configuration.defaultOpen ?? this.hasAttribute('default-open'),
        };
        if (this.controller) this.controller.update(options);
        else {
            const dialog = this.querySelector<HTMLElement>('[data-ui-part="dialog"]');
            if (dialog) this.controller = attachDialog(dialog, options);
        }
    }
    show(invoker?: HTMLElement): void {
        this.controller?.show?.(invoker);
    }
    hide(): void {
        this.controller?.hide?.();
    }
}
register('ui-dialog', DialogElement);
