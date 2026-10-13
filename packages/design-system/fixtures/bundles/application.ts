import { ApplicationFixture } from '../../src/fixtures/application.fixture';

(globalThis as typeof globalThis & { platformUI: unknown }).platformUI = ApplicationFixture;
