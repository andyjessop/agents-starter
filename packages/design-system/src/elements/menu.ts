import { attachMenu, type MenuOptions } from '../behaviours/menu';
import { register } from './register';
import { observeParts, recoverProperty, emit, type ElementController } from './lifecycle';

export class MenuElement extends HTMLElement {
    static observedAttributes = ['disabled', 'value', 'input-value', 'default-open'];
    private connected = false;
    private controller: ElementController<MenuOptions> | undefined;
    private stop: (() => void) | undefined;
    private configuration: MenuOptions = {};
    get options(): MenuOptions {
        return this.configuration;
    }
    set options(value: MenuOptions) {
        this.configuration = value;
        this.reconcile();
    }
    connectedCallback(): void {
        recoverProperty(this, 'options');
        this.connected = true;
        this.stop = observeParts(
            this,
            () => ['trigger', 'popup'].every((name) => this.querySelector(`[data-ui-part="${name}"]`)),
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
    attributeChangedCallback(name: string): void {
        if (!this.connected) return;
        if (name === 'disabled') this.configuration = { ...this.configuration, disabled: this.hasAttribute(name) };
        this.reconcile();
    }
    private reconcile(): void {
        if (
            !this.connected ||
            !this.isConnected ||
            !['trigger', 'popup'].every((name) => this.querySelector(`[data-ui-part="${name}"]`))
        )
            return;
        const options: MenuOptions = {
            ...this.configuration,
            onOpenChange: (open: boolean) => emit(this, 'ui-open-change', { open }),
            onAction: (id: string) => emit(this, 'ui-action', { id }),
            disabled: this.configuration.disabled ?? this.hasAttribute('disabled'),
            defaultOpen: this.configuration.defaultOpen ?? this.hasAttribute('default-open'),
        };
        if (this.controller) this.controller.update(options);
        else this.controller = attachMenu(this, options);
    }
    show(): void {
        this.controller?.show?.();
    }
    hide(): void {
        this.controller?.hide?.();
    }
}
register('ui-menu', MenuElement);
