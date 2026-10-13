import * as component from '../../src/react/button';

(globalThis as typeof globalThis & { platformUI: unknown }).platformUI = component;
