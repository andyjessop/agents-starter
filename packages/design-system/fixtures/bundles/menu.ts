import * as component from '../../src/react/menu';

(globalThis as typeof globalThis & { platformUI: unknown }).platformUI = component;
