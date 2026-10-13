import * as component from '../../src/react/combobox';

(globalThis as typeof globalThis & { platformUI: unknown }).platformUI = component;
