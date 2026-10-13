# Redux coverage for the client

## Aim

Cover Redux-owned behaviour as thoroughly as possible under the Node store integration suite (`test:store`), **without** coverage-ignore comments, excluded lines, or other tricks that inflate the report.

Treat as Redux-owned:

- `src/store.ts`
- `src/router.ts`
- `src/modules/**/redux.ts`
- `src/modules/**/redux/**/*.ts` (including helpers that live beside slices)
- API envelope / client modules that participate in store-owned request handling once established

Prefer real store paths: navigate, dispatch public actions, await state, assert selectors. When a branch is hard to reach (for example RTK Query `use*` hooks co-located next to endpoints, or demo fixture transport), leave it uncovered rather than ignoring it. Move presentation hooks under `react/` over time if that makes the Redux surface clearer; do not paper over gaps with `v8 ignore`.

Do not treat React unit tests (`test:unit`), Playwright e2e, mock stores, or fixture-mode oracles as substitutes for this suite. React is unit-tested only; application-behaviour confidence stays here. See [implementing-features.md](implementing-features.md). Report coverage honestly when you change Redux behaviour; extend store specs for new or risky paths, and do not add thresholds that force ignore comments.

## Required testing pattern

Integration tests observe **Redux state as the source of truth**.

1. Create the harness (production store + real router instance).
2. **Navigate to the route the behaviour belongs on** before exercising the workflow. The router lives in Redux. Route params and query shape drive which data is loaded and which listeners run, so requests and derived state are only trustworthy after the correct route is committed.
3. Dispatch the public actions presentation would dispatch. Dispatch once, outside any wait.
4. **Await state** with `expectState` (or a direct `.unwrap()` when that call itself is the boundary). Do not sleep, flush microtasks in a loop, or wait for a vague “store idle”.
5. Assert through production selectors (and route selectors when navigation is part of the outcome).

Canonical shape:

```ts
const app = createAppTestHarness();
onTestFinished(() => app.dispose());

await app.navigate('home');

await app.expectState((state) => {
    expect(selectRouteName(state)).toBe('home');
});
```

Synchronous reducer updates may assert immediately after dispatch. Asynchronous work (listeners, RTK Query, thunks) must await the resulting state. Prefer holding HTTP responses with Nock when intermediate states matter; advance a controlled clock only for debounce or polling.

## Harness and router

Use `createAppTestHarness()` only. It must own a fresh `Router({ routes, browser: null })` wired into `createAppStore`, expose `navigate` / `expectState` / `dispose`, and keep HTTP on Nock. See [testing.md](./testing.md) for the full setup contract.
