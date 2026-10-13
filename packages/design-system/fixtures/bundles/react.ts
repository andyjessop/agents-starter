import * as core from '../../src/index';

(globalThis as typeof globalThis & { platformUI: unknown }).platformUI = core;
