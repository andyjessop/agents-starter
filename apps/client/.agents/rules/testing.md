# Testing the client

Feature order is in [implementing-features.md](implementing-features.md): Redux first, store integration tests when the harness exists, then React.

## Required boundary (when store harness exists)

Test application behaviour in **Node only, through the real Redux store**. Create a fresh store, navigate to the route under test, dispatch public actions, await observable state, and assert through production selectors.

The router is part of Redux (`browser: null` in Node). Do not render components or use DOM libraries for this suite. Do not use a mock store or duplicate middleware lists in tests.

React uses **unit tests only** (`npm run test:unit`). See [redux-coverage.md](./redux-coverage.md) for coverage expectations on Redux-owned files.

## Setup contract

When you add `vitest.store.config.ts` and `src/test/*-test-harness.ts`:

1. Include `src/**/*.store.test.ts` with `environment: 'node'` and `browser: { enabled: false }`.
2. Point HTTP at a deterministic test origin with Nock (or similar). Tests must not reach the internet.
3. Add `test:store` in `apps/client/package.json` and wire it into `test` once the harness exists.
4. Harness calls production `createAppStore()` / `createAppStore()` with injected adapters and `dispose()` that tears down listeners and queries.

Until that harness exists, **`npm run test`** runs unit tests and typecheck only. Do not claim store integration coverage without running `test:store`.

## Example (intended harness API)

```ts
it('lands on home when signed in', async () => {
  const app = createAppTestHarness();
  onTestFinished(() => app.dispose());

  await app.navigate('home');

  await app.expectState((state) => {
    expect(selectRouteName(state)).toBe('home');
  });
});
```

## Run commands

From the repository root:

```sh
npm run test --workspace=@agent-starter/client
npm run typecheck --workspace=@agent-starter/client
```

When `test:store` exists:

```sh
npm run test:store --workspace=@agent-starter/client
```

Report exact commands, exit codes, and blockers honestly.
