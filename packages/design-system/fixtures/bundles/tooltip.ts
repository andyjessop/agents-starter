import * as component from '../../src/react/tooltip';

(globalThis as typeof globalThis & { platformUI: unknown }).platformUI = component;
