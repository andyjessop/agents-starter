# redux-router

A small Redux-first browser router with strict TypeScript inference.

The URL is a serialisation of navigable Redux state. **Committed route state lives in Redux. Navigation actions are the supported way to change it.** The middleware owns only the browser mechanics required to keep history and committed Redux state aligned.

There are deliberately no plugins, loaders, subscriptions, `beforeNavigation`, or `afterNavigation` hooks. Redux modules react to committed route state like any other state.

The one route lifecycle primitive is `shouldNavigate`, because deciding whether a navigation attempt may enter a route is routing.

## The API

```ts
import { createRoute, createRouter, q } from 'typed-redux-router';

type AppState = {
  auth: { signedIn: boolean };
  users: { allowed: ReadonlySet<string> };
};

const route = createRoute<AppState>();

const routes = {
  home: route('/', { title: 'Home' }),

  users: route('/users/:userId', {
    query: {
      source: q.optional(q.enum('search', 'feed')),
    },

    shouldNavigate({ params, state }) {
      return state.auth.signedIn && state.users.allowed.has(params.userId);
    },

    children: (route) => ({
      post: route('/posts/:postId', {
        query: {
          view: q.enum('post', 'comments'),
          page: q.default(q.int, 1),
        },
      }),
    }),
  }),

  login: route('/login'),
  notFound: route('/404'),
} as const;

export const router = createRouter({
  routes,
  fallback: 'notFound',
});
```

The `children` callback is intentional. It gives the child route factory the parent's path, params, query schema, and state type. That is what makes inherited route types exact rather than approximate.

## Navigation is fully typed

```ts
router.navigate('users.post', {
  params: {
    userId: 'USER-123',
    postId: 'POST-456',
  },
  query: {
    view: 'comments',
  },
});
```

`page` is omitted because it has a query default. TypeScript still knows that a committed `users.post` route always has `query.page: number`.

Common mistakes fail at compile time:

```ts
router.navigate('user.post');
//              ^ unknown route

router.navigate('users.post', {
  params: { postId: 'POST-456' },
  query: { view: 'post' },
});
//          ^ inherited userId is missing

router.navigate('users.post', {
  params: { userId: 'USER-123', postId: 'POST-456' },
});
// ^ required view query is missing

router.navigate('users.post', {
  params: { userId: 'USER-123', postId: 'POST-456' },
  query: { view: 'summary' },
});
//                ^ not "post" | "comments"
```

`href()` uses the same route-aware types:

```ts
const href = router.href('users.post', {
  params: { userId: 'USER-123', postId: 'POST-456' },
  query: { view: 'comments' },
});
```

## Patch shareable query state

Filters, sorting, pagination, tabs, and other shareable UI state can live directly on the matched route. Do not mirror the same value into another Redux slice.

```ts
dispatch(
  router.patchQuery('users.post', {
    view: 'comments',
    page: 2,
  }),
);
```

The route name gives TypeScript the exact query schema. Invalid route names, keys, values, and attempts to clear required query values fail at compile time.

A patch preserves the current params, hash, and every query value not mentioned.

Optional or defaulted values can be reset explicitly:

```ts
dispatch(
  router.patchQuery('users.post', {
    source: undefined,
    page: undefined, // resets to q.default(q.int, 1)
  }),
);
```

`patchQuery` uses `replaceState` by default:

```ts
router.patchQuery('users.post', { page: 2 });
```

Use a history entry when Back should replay the query change:

```ts
router.patchQuery(
  'users.post',
  { view: 'comments' },
  { history: 'push' },
);
```

`patchQuery` only applies when that named route is currently committed. It is not an implicit navigation API. Patching another route fails deterministically.

The patch commits one complete matched route. Redux observers never see intermediate per-query-field states.

## Guard semantics

`shouldNavigate` is a check on **navigation attempts**.

These all run the relevant guard chain:

- `router.navigate(...)`
- `router.replace(...)`
- intercepted same-origin links
- initial browser URL resolution
- browser Back/Forward
- navigating to the same route name with different params
- navigating to the same route name with different query values

For example, both of these are guarded navigations:

```text
/users/USER-1/posts/POST-1 → /users/USER-2/posts/POST-1

?view=post → ?view=comments   // when changed with navigate/replace/history
```

`patchQuery` is the deliberate exception. It mutates query state on an already committed route and **does not rerun `shouldNavigate`**.

That has an important consequence:

> `shouldNavigate` must not be used to enforce invariants that must hold for every possible query value.

Use query codecs to validate query values. If a query transition itself requires admission logic, perform it as a normal typed navigation rather than `patchQuery`.

### Inherited guards

A guard on a parent applies to that route and every descendant.

```ts
const routes = {
  users: route('/users/:userId', {
    shouldNavigate({ params, state }) {
      return state.users.allowed.has(params.userId);
    },

    children: (route) => ({
      post: route('/posts/:postId', {
        shouldNavigate({ params, query }) {
          // params.userId -> inherited
          // params.postId -> local
          // query         -> complete inherited + local schema
          return query.view !== 'comments' || params.userId !== 'guest';
        },
      }),
    }),
  }),
} as const;
```

For `users.post`, guards run root to leaf:

```text
users.shouldNavigate
       ↓
users.post.shouldNavigate
       ↓
commit navigation
```

A guard returns `boolean | Promise<boolean>`:

- `true`: continue
- `false`: leave the current route committed and return `'blocked'`
- throw/reject: record the error and reject the dispatch promise

There is intentionally no redirect return type. A Redux module can observe `router.actionTypes.navigationBlocked` or `state.router.blocked` and dispatch another typed navigation if the application wants a redirect.

## Navigation completion

Router actions are awaitable through a store whose dispatch type includes the router middleware extension:

```ts
const result = await dispatch(
  router.navigate('users.post', {
    params: { userId: 'USER-123', postId: 'POST-456' },
    query: { view: 'post' },
  }),
);

// result is:
// 'committed'  - this transition became current
// 'blocked'    - shouldNavigate returned false
// 'superseded' - a newer router operation won
```

Guard errors, malformed runtime actions, and route-resolution failures reject rather than returning another result string.

## Query codecs

Query values are validated at runtime, not merely cast to a TypeScript type.

Built in:

```ts
q.string
q.int
q.number
q.boolean
q.enum('a', 'b', 'c')
q.array(q.string)
q.optional(q.int)
q.default(q.int, 1)
```

### Defaults

A default is optional in the URL and navigation input, but present in committed route state:

```ts
const postRoutes = {
  posts: route('/posts', {
    query: {
      page: q.default(q.int, 1),
    },
  }),
};

const postsRouter = createRouter({ routes: postRoutes });

postsRouter.href('posts');
// /posts

postsRouter.match('/posts')?.query.page;
// 1
```

Generated URLs omit the default value:

```ts
postsRouter.href('posts', { query: { page: 1 } });
// /posts

postsRouter.href('posts', { query: { page: 2 } });
// /posts?page=2
```

An incoming explicit default such as `/posts?page=1` is accepted and preserved as the matched URL. Matching itself does not rewrite the browser URL. A later generated navigation or query patch uses the canonical omitted form.

Defaults are intentionally limited to string, number, boolean, and enum-style scalar codecs. This keeps canonical equality unambiguous.

Inherited query keys cannot be redefined by a child. Doing so would make parent guard semantics ambiguous, so it is rejected by TypeScript and at runtime.

## Redux setup

With Redux Toolkit:

```ts
import { configureStore } from '@reduxjs/toolkit';
import { router } from './router.js';

export const store = configureStore({
  reducer: {
    router: router.reducer,
    // ...other reducers
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(router.middleware),
});
```

Or Redux directly:

```ts
import { applyMiddleware, combineReducers, legacy_createStore } from 'redux';

const store = legacy_createStore(
  combineReducers({
    router: router.reducer,
  }),
  applyMiddleware(router.middleware),
);
```

The middleware owns:

- initial URL matching
- same-origin anchor interception
- `popstate`
- `pushState`, `replaceState`, and guarded history restoration
- `shouldNavigate`
- typed `patchQuery`
- document titles
- supersession and guard cancellation

Fetching, subscriptions, analytics, loading state, and application workflows belong to ordinary Redux modules.

## Route state

```ts
type RouterState = {
  status: 'idle' | 'navigating';
  current: MatchedRoute | null;
  pending: MatchedRoute | null;
  blocked: MatchedRoute | null;
  error: string | null;
  navigationId: number;
};
```

`current` is a discriminated union keyed by the literal route name:

```ts
const current = state.router.current;

if (current?.name === 'users.post') {
  current.params.userId; // string
  current.params.postId; // string
  current.query.view;    // 'post' | 'comments'
  current.query.page;    // number, because it has a default
}
```

Route-specific selectors preserve the same narrowing:

```ts
const selectPostRoute = router.selectors.route('users.post');
const postRoute = selectPostRoute(state.router);
```

## Path grammar

Paths intentionally use a small grammar:

```text
/static
/users/:userId
/posts/*slug
```

`:param` matches one segment. `*splat` matches the remaining path. Both are inferred into `params`.

Child routes use explicit fragments:

```ts
route('/users/:userId', {
  children: (route) => ({
    post: route('/posts/:postId'),
  }),
});
```

The effective child path is `/users/:userId/posts/:postId`.

Index children are deliberately disallowed. A URL should never ambiguously mean both a parent route and one of its children.

## Browser history

Normal same-origin left-clicks are intercepted. Native browser behaviour is preserved for modified clicks, downloads, external origins, non-HTTP(S) links, `rel="external"`, targets other than `_self`, and clicks to the current URL.

`back()` and `forward()` delegate to browser history.

### Denied Back/Forward

A historical navigation is different from a normal push. The browser has already changed history position before `popstate` fires.

For history entries managed by the built-in browser adapter, the router stores a small private index in `history.state`. If a historical route is denied or its guard fails, the router uses `history.go(delta)` to return to the last committed position.

Given:

```text
A → B → C
```

if Back reaches B and B is denied, the result remains:

```text
A → B → C
        ↑   current position restored to C
```

B is not overwritten with C. If B later becomes allowed, another Back can still reach it.

The restoration `popstate` is recognised as internal and does not rerun guards.

If a custom/untracked history entry has no router index, there is no reliable direction/distance information. In that case the router falls back to replacing the current address-bar entry with the last committed URL. Custom `BrowserPort` implementations that expose `state` and `go(delta)` receive the stack-preserving behaviour.

## Concurrency

The router has one transition lane. Starting any newer router operation aborts the active guard chain and makes the older operation unable to commit Redux or browser history.

This applies to navigation **and** query patches.

If A is committed and navigation A → B is waiting on an async guard, then:

```ts
dispatch(router.patchQuery('users.post', { page: 2 }));
```

means:

1. the B guard signal is aborted
2. B eventually resolves as `'superseded'`
3. the patch is applied to the last committed A route
4. only the patch may commit

Likewise, rapid Back/Forward events supersede older pending history guards. A late denied result from an older traversal cannot restore the browser to a stale history position.

## Matching and fallback

```ts
router.match('/users/USER-1/posts/POST-1?view=comments');
```

Matching returns the same typed discriminated route shape used in Redux, or `null`.

A fallback may be a route name when it requires no arguments:

```ts
createRouter({ routes, fallback: 'notFound' });
```

Or a fully typed target:

```ts
createRouter({
  routes,
  fallback: {
    name: 'userNotFound',
    params: { userId: 'unknown' },
  },
});
```

Unknown browser URLs are replaced with the fallback URL rather than adding another history entry.

## Tests

Routing is infrastructure, so the repository tests behavioural guarantees at three levels.

### Runtime and state-machine guarantees

The unit suite covers, among other things:

- route grammar, ambiguity, encoding, params, splats, and fallback
- codec parsing/formatting and default canonicalisation
- inherited guard order and route-specific guard contexts
- `patchQuery` preservation, resets, history modes, and guard bypass
- `patchQuery` superseding an in-flight navigation
- late guard resolution/rejection and stale state protection
- tracked Back/Forward denial with history-position restoration
- rapid historical traversals while async guards are pending
- untracked/foreign history metadata fallback
- browser click semantics, teardown, and startup races

After those behaviours are asserted, the Node coverage gate additionally requires:

```text
lines:    100%
branches: 100%
functions: 100%
```

There are no coverage-ignore comments.

### Compile-time guarantees

```sh
pnpm typecheck
```

`@ts-expect-error` assertions verify unknown route names, missing inherited params, extra params, required query values, invalid enum values, wrong query types, invalid query patches, clearing required values, query shadowing, malformed child definitions, and invalid fallback shorthand.

Strict compiler options include `strict`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`.

### Playwright

```sh
pnpm exec playwright install
pnpm test:e2e
```

The browser suite runs the built package against a real Redux store and local HTTP origin. It covers deep links, anchor interception, inherited guards, query defaults, atomic query patches, patch-vs-navigation supersession, preserved Back/Forward stacks after denied history attempts, rapid async history traversal, fallbacks, titles, and native `_blank` behaviour.

GitHub Actions runs Playwright independently on Chromium, Firefox, and WebKit.

## Full local check

```sh
pnpm install
pnpm test
```

## Teardown

If the store/router is permanently discarded, remove its browser listeners:

```ts
router.destroy();
```

A router middleware instance can only be installed once. This prevents one router instance from accidentally controlling multiple stores/windows.

## Philosophy

The router should enforce routing invariants, not become an application framework.

```text
Initial load:        URL → Redux
Application change: Redux → URL
Browser navigation: History → Redux

URL/history ↔ typed-redux-router ↔ committed navigable Redux state
                                      ↓
                               ordinary selectors
                                      ↓
                             other Redux modules
```

Each piece of navigable state has one Redux representation. The URL serialises it; domain slices select it rather than mirror it.
