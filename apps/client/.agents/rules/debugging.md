# Debugging

Unless the defect is **obviously** presentational (wrong markup, styling, layout, or a component reading the wrong selector / failing to dispatch), start in Redux.

## Required order

1. **Reproduce in Redux with TDD.** Write a failing Node store integration test with the harness (`createAppTestHarness`) that encodes the bug: navigate, dispatch the public actions presentation would dispatch, await state, assert the expected selectors. Follow [testing.md](testing.md) and [redux-coverage.md](redux-coverage.md).
2. **Fix Redux until that test passes.** Change slices, listeners, middleware, routing, forms, or RTK Query as needed. Do not reach for React to “paper over” bad state.
3. **Only then touch React**, and only if the failing behaviour is still unexplained after the store is correct, or if the issue was clearly presentational from the start.

## Default assumption

Most bugs live in Redux-owned behaviour. Treat the store integration suite as the first debugging surface and the main proof the fix works. React unit tests and the browser are secondary; they do not replace a Redux harness regression test for behaviour defects.

## Runtime capture tool

For bugs that need evidence from a live browser session, the console ships a keyboard-only Redux recorder in `src/debug/` (see the [readme](../../../../README.md) for the shortcuts). It taps the store from outside Redux and React, records the plain actions reducers see plus state snapshots and a compact Jade DOM snapshot, persists recordings across refreshes, and copies minified JSONL to the clipboard. Paste its output into a bug report; then encode the reproduced sequence as a harness test above. Keep it outside Redux and React: it must never dispatch, subscribe, or render.

See [implementing-features.md](implementing-features.md) for the same Redux-first split when building new work.
