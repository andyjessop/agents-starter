# Agent Starter

A generic **Redux-first React SPA scaffold** for agent-driven product work. It ships the shell patterns we want to reuse: auth, session, live scopes, navigation admission, design-system theming, and a typed Redux router — without a product backend.

## Prerequisites

- **Node.js** (current LTS or newer)
- **npm** (bundled with Node)

## Quick start

```sh
git clone <this-repo>
cd agent-starter
npm install
npm run dev
```

Open **http://localhost:5173**.

The Vite dev server includes an **in-process mock API** for auth, session HTTP, and live WebSockets. Create an account on `/create-account`, then sign in on `/sign-in`. Signed-in users land on `/home` with a demo live catalogue.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`apps/client`](apps/client) | SPA application |
| [`packages/design-system`](packages/design-system) | CSS-first UI primitives |
| [`packages/redux-router`](packages/redux-router) | `typed-redux-router` |
| [`packages/redux-form`](packages/redux-form) | Redux-first forms |
| [`packages/live`](packages/live) | Live scope paths and wire helpers |

Agent instructions: [`AGENTS.md`](AGENTS.md). Client module rules: [`apps/client/AGENTS.md`](apps/client/AGENTS.md).

## Verification

```sh
npm run check      # format, lint, test, typecheck (all workspaces)
npm run build      # production build for client + packages that define build
```

On pull requests, CI runs **Nx affected** targets (`lint`, `test`, `typecheck`, `build`) against `main`. Pushes to **main** run the full suite across all projects.

## Extending the starter

1. Add product routes in [`apps/client/src/router.ts`](apps/client/src/router.ts) and pages in [`apps/client/src/pages.ts`](apps/client/src/pages.ts).
2. Add Redux modules under [`apps/client/src/modules/`](apps/client/src/modules/) following [`apps/client/.agents/rules/modules.md`](apps/client/.agents/rules/modules.md).
3. Extend live scopes in [`packages/live`](packages/live) and wire real APIs (replace or augment [`apps/client/vite-mock-api.ts`](apps/client/vite-mock-api.ts)).
