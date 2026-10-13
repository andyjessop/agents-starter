# Routing (SPA)

This app is a **single-page application**. Every in-app route change goes through the Redux router in `src/router.ts` (`typed-redux-router`). Do not cause full document loads for product navigation.

## Required behaviour

- Navigate with `dispatch(router.navigate(name, args))` (or `router.patchQuery` when only the query changes).
- Build display URLs with `router.href(name, args)` when you need an `href` for accessibility, middle-click, or copy-link.
- Keep the route tree data-only in `router.ts`. Map route names to pages in `pages.ts`. Follow [pages.md](pages.md).

## Anchors and clicks

The router listens for clicks on the document and intercepts same-origin anchors that match a configured route. That only works if the event reaches the document.

- Do **not** call `event.stopPropagation()` on an in-app `<a href>` unless you also `preventDefault()` and `dispatch(router.navigate(...))` yourself.
- Inside clickable rows (for example table rows with `onClick`), prefer: `preventDefault()`, `stopPropagation()`, then `dispatch(router.navigate(...))`, so the row handler does not also fire and the browser does not follow the link.
- Modifier clicks (meta/ctrl/shift/alt), non-primary buttons, `download`, `rel="external"`, and `target` other than `_self` are left to the browser. Do not break those.

## Do not

- Assign `window.location`, call `location.assign` / `replace`, or use a bare `href` that reloads the document for an in-app route.
- Use React Router, Next Link, or any second client router.
- Treat a full page refresh as acceptable “navigation” while developing or reviewing UI.

## Route guards

SPA navigation guards follow **tiered live admission**: route admission waits on catalogue/list live evidence; detail live scopes are for page rendering, not router commit. See [navigation-admission.md](navigation-admission.md).

## Tests

Router state is part of Redux. Integration tests navigate with the harness (`await app.navigate(...)`) before exercising route-scoped behaviour. See [testing.md](testing.md).
