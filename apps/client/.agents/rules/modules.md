# Modules

A module is a feature. You might also think of it as a domain. In this app we call them modules.

Work lives under `src/modules/<module-name>/`. Keep each module split into two sides:

- **Redux** is the logic. Routing, forms, modals, UI state, and data state (RTK Query) all belong here.
- **React** is presentation only. Components read from the store, dispatch actions, and render.

That split is a hard rule. What may stay in React, and how to subscribe without blowing up renders, is in `performance.md`.

When implementing a feature, build and integration-test Redux before writing React. See [implementing-features.md](implementing-features.md).

## Folder layout

Name files after the slice or the screen they cover. Use kebab-case. **Never** encode the layer in the filename (`create-redux.ts`, `detail-react.tsx`, and similar are forbidden).

### One Redux slice

A pair of root files is enough:

```text
src/modules/settings/
  redux.ts
  react.tsx
```

Only `react.tsx` may be a `.tsx` file at the module root. Helpers (`public.ts`, `admit.ts`, CSS, non-slice logic) stay beside them.

### Several Redux slices or several React surfaces

Use **`redux/`** and **`react/`** folders. One RTK slice per file under `redux/`. Presentation that is not the single page entry lives under `react/`. Keep a **`react.tsx`** at the module root when `pages.ts` or the app shell imports the module’s route entry from a stable path.

```text
src/modules/home/
  redux.ts
  react.tsx
  home.css
```

Do not keep **`redux.ts` at the module root and a `redux/` folder** in the same module. Pick one shape.

When a module has only one slice but many presentation files (for example `shell`), keep **`redux.ts`** at the root and move components into **`react/`**, still exporting the shell from root **`react.tsx`**.

```text
src/modules/shell/
  redux.ts
  react.tsx
  react/
    explorer.tsx
    rail.tsx
    topbar.tsx
  nav.ts
  explorer-filter.ts
```

Lint enforces layout: `scripts/check-module-layout.mjs` via `@agent-starter/client` `npm run lint`.

## Redux files

Put everything that belongs to that slice in the same file: reducer, actions, selectors, listeners or middleware, and any RTK Query API slice that is that slice.

Do not spread one slice across several files. If the file is getting large, you probably have a second slice, not a reason to split the first one.

### Effects and listeners

Keep logic in the module that owns the state or workflow.

- **Asynchronous work** the UI starts (HTTP, awaited navigation, multi-step flows) is a **thunk** in that module's Redux file (`createAsyncThunk` or equivalent).
- **Reactions** (when this action or slice of state changes, dispatch something else) live in **middleware the module exports**, typically `createXMiddleware()` built with RTK `createListenerMiddleware` and `startListening`. The module returns `.middleware`; it does not register listeners elsewhere.

[`src/store.ts`](../../src/store.ts) is composition only: reducer map, thunk `extra`, router and RTK Query middleware, then `createXMiddleware()` from modules. It must not define thunks, call `startListening`, or encode feature reactions.

Lint enforces this: `scripts/check-modular-effects.mjs` fails when `createAsyncThunk`, `createListenerMiddleware`, or `startListening` appear outside `src/modules/`.

## React files

Components are presentational. They do not own application or UI state.

`useState`, `useReducer`, and `useEffect` that own state or orchestrate behaviour are strongly discouraged. If you think you need them, stop and move the behaviour into the slice, unless it is the ephemeral interaction state described in `performance.md`.

How a module page is mounted is in `pages.md`.
