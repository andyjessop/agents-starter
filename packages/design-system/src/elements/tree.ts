import {
    attachTree,
    type TreeExpansionRequest,
    type TreeOptions,
    type TreeSelectionRequest,
} from '../behaviours/tree';
import { register } from './register';
import { emit, observeParts, recoverProperty, type ElementController } from './lifecycle';

export class TreeElement extends HTMLElement {
    private connected = false;
    private controller: ElementController<TreeOptions> | undefined;
    private stop: (() => void) | undefined;
    private configuration: TreeOptions = {};

    get options(): TreeOptions {
        return this.configuration;
    }

    set options(value: TreeOptions) {
        this.configuration = value;
        this.reconcile();
    }

    connectedCallback(): void {
        recoverProperty(this, 'options');
        this.connected = true;
        this.stop = observeParts(
            this,
            () => this.querySelector('[data-ui-part="item"]') !== null,
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

    private reconcile(): void {
        if (!this.connected || !this.isConnected || !this.querySelector('[data-ui-part="item"]')) return;
        const options: TreeOptions = {
            ...this.configuration,
            onExpandedChange: (request: TreeExpansionRequest) =>
                emit(this, 'ui-expanded-request', request, true),
            onSelectionChange: (request: TreeSelectionRequest) =>
                emit(this, 'ui-selection-request', request, true),
        };
        if (this.controller) this.controller.update(options);
        else this.controller = attachTree(this, options);
    }
}

register('ui-tree', TreeElement);
