import { attachCombobox, type ComboboxOptions } from '../behaviours/combobox';
import { register } from './register';
import { observeParts, recoverProperty, emit, type ElementController } from './lifecycle';

export class ComboboxElement extends HTMLElement {
    static observedAttributes = ['disabled', 'value', 'input-value', 'default-open'];
    private connected = false;
    private controller: ElementController<ComboboxOptions> | undefined;
    private stop: (() => void) | undefined;
    private configuration: ComboboxOptions = { options: [] };
    get options(): ComboboxOptions {
        return this.configuration;
    }
    set options(value: ComboboxOptions) {
        this.configuration = value;
        this.reconcile();
    }
    connectedCallback(): void {
        recoverProperty(this, 'options');
        this.connected = true;
        this.stop = observeParts(
            this,
            () => ['input', 'popup', 'status'].every((name) => this.querySelector(`[data-ui-part="${name}"]`)),
            () => {
                this.reconcile();
            },
        );
    }
    disconnectedCallback(): void {
        this.connected = false;
        const state = this.controller?.getState?.();
        if (state && this.configuration.value === undefined && !this.hasAttribute('value'))
            this.configuration = {
                ...this.configuration,
                defaultValue: state.value,
                defaultInputValue: state.inputValue,
            };
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
        if (name === 'value') this.configuration = { ...this.configuration, value: this.getAttribute(name) };
        if (name === 'input-value')
            this.configuration = { ...this.configuration, inputValue: this.getAttribute(name) ?? '' };
        this.reconcile();
    }
    private reconcile(): void {
        if (
            !this.connected ||
            !this.isConnected ||
            !['input', 'popup', 'status'].every((name) => this.querySelector(`[data-ui-part="${name}"]`))
        )
            return;
        const options: ComboboxOptions = {
            ...this.configuration,
            onOpenChange: (open: boolean) => emit(this, 'ui-open-change', { open }),
            onValueChange: (request) => emit(this, 'ui-value-request', request, true),
            onInputValueChange: (request) => emit(this, 'ui-input-request', request, true),
            disabled: this.configuration.disabled ?? this.hasAttribute('disabled'),
            ...(this.configuration.value === undefined && this.hasAttribute('value')
                ? { value: this.getAttribute('value') }
                : {}),
            ...(this.configuration.inputValue === undefined && this.hasAttribute('input-value')
                ? { inputValue: this.getAttribute('input-value') ?? '' }
                : {}),
        };
        if (this.controller) this.controller.update(options);
        else this.controller = attachCombobox(this, options);
    }
    show(): void {
        this.controller?.show?.();
    }
    hide(): void {
        this.controller?.hide?.();
    }
}
register('ui-combobox', ComboboxElement);
