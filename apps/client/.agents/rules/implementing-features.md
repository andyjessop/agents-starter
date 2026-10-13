# Implementing a feature

Feature work in this app follows a fixed order. Do not skip steps or reverse them.

## Required order

1. **Redux first.** Put the feature's behaviour in the owning module's Redux side: slices, actions, selectors, listeners/middleware, routing, forms, and RTK Query. Follow [modules.md](modules.md) and [performance.md](performance.md). Do not build React components yet.
2. **Redux integration tests next.** Cover that behaviour with the Node-only store integration suite and the shared harness (`createAppTestHarness`), as specified in [testing.md](testing.md) and [redux-coverage.md](redux-coverage.md). Navigate, dispatch public actions, await state, assert through production selectors. Run the affected specs and the full app store-integration suite until they pass.
3. **React last.** Only after the store and its integration tests are done, implement presentation components that subscribe and dispatch. Follow [components.md](components.md), [pages.md](pages.md), [styling.md](styling.md), and [i18n.md](i18n.md).

## Where confidence comes from

**Main confidence is Redux integration tests with the harness.** That suite is the proof that the feature works. React unit tests do not replace it. Browser Vitest and Playwright e2e do not replace it either.

## React testing

Test React with **unit tests only** (`*.test.ts` / `*.test.tsx` under the console unit Vitest config). Assert rendering, wiring (correct selectors and dispatches), and presentational branches. Do not prove application behaviour by mounting the full store, exercising workflows through the DOM, or treating component tests as integration coverage.

If a behaviour needs an integration-style proof, it belongs in Redux and in `*.store.test.ts`, not in a React test.
