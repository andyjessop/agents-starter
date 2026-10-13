import { attachTabs, type TabsOptions } from '../behaviours/tabs';
import { register } from './register';
import { observeParts, recoverProperty, emit, type ElementController } from './lifecycle';

export class TabsElement extends HTMLElement {
    static observedAttributes = ['disabled', 'value', 'input-value', 'default-open'];
    private connected = false;
    private controller: ElementController<TabsOptions> | undefined;
    private stop: (() => void) | undefined;
    private configuration: TabsOptions = {};
    get options(): TabsOptions {
        return this.configuration;
    }
    set options(value: TabsOptions) {
        this.configuration = value;
        this.reconcile();
    }
    connectedCallback(): void {
        recoverProperty(this, 'options');
        this.connected = true;
        this.stop = observeParts(
            this,
            () => ['list', 'tab', 'panel'].every((name) => this.querySelector(`[data-ui-part="${name}"]`)),
            () => {
                this.reconcile();
            },
        );
    }
    disconnectedCallback(): void {
        this.connected = false;
        const state = this.controller?.getState?.();
        if (state && this.configuration.value === undefined && !this.hasAttribute('value'))
            this.configuration = { ...this.configuration, defaultValue: state.value };
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
        if (name === 'value') this.configuration = { ...this.configuration, value: this.getAttribute(name) };
        this.reconcile();
    }
    private reconcile(): void {
        if (
            !this.connected ||
            !this.isConnected ||
            !['list', 'tab', 'panel'].every((name) => this.querySelector(`[data-ui-part="${name}"]`))
        )
            return;
        const options: TabsOptions = {
            ...this.configuration,
            onValueChange: (request) => emit(this, 'ui-value-request', request, true),
            ...(this.configuration.value === undefined && this.hasAttribute('value')
                ? { value: this.getAttribute('value') }
                : {}),
        };
        if (this.controller) this.controller.update(options);
        else this.controller = attachTabs(this, options);
    }
    show(): void {
        this.controller?.show?.();
    }
    hide(): void {
        this.controller?.hide?.();
    }
}
register('ui-tabs', TabsElement);
