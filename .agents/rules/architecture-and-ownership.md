---
id: architecture-and-ownership
description: Module ownership, dependency direction and client versus shared packages.
---
# Architecture and ownership

Scope: responsibilities and dependency direction. File naming and build wiring belong to [`structure-and-toolchain.md`](structure-and-toolchain.md).

- The hosted human UI lives in `apps/client`. Shared primitives belong to `@agent-starter/design-system`. Shared Redux-first form and router runtimes belong to `packages/redux-form` and `packages/redux-router` (`typed-redux-router`). Live scope names and wire helpers belong to `@agent-starter/live`. Local development uses the Vite mock API in `apps/client/vite-mock-api.ts`, not a separate backend app in this starter.
- `packages/design-system` owns CSS-first UI primitives and the public `--ui-*` theme contract. `packages/redux-form` and `packages/redux-router` own their library boundaries. `packages/live` owns live scope identifiers and subscription wire shapes consumed by the client. Apps compose packages; packages must not import application modules.
- Session and auth state in the client Redux store are presentation and routing inputs. They are not authority sources beyond what the mock or your real backend exposes. Do not embed secrets, staff bypasses or long-lived credentials in client bundles.
- Pure library logic must not import React, Vite plugins or app-specific modules. Application modules may depend inward on packages through their public exports only.
- Cross-package imports use named public entry modules or `package.json` exports, not another package's private files. Keep packages cohesive and avoid cycles.
- Add an abstraction only for a present boundary or demonstrated repetition. Do not prebuild frameworks for hypothetical features.
- Trace cross-package changes through callers and consumers, including errors and cleanup. A compiling import graph does not establish correct ownership or behaviour.

Review evidence: name the dependency or owner being crossed and the concrete invariant it compromises. Prefer the smallest coherent correction.
