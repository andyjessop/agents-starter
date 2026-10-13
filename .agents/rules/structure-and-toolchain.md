---
id: structure-and-toolchain
description: Repository layout, naming, package boundaries and reproducible tooling.
---
# Structure and toolchain

Scope: where files live and how packages build. Code semantics belong to [`coding-and-type-safety.md`](coding-and-type-safety.md); verification claims to [`verification-and-evidence.md`](verification-and-evidence.md).

- This repository is an npm workspaces monorepo: `apps/*` and `packages/*`. The application is `apps/client`. Shared packages include `@agent-starter/design-system`, `@agent-starter/live`, `redux-form`, and `typed-redux-router` (`packages/redux-router`). Agent guidance lives under `.agents/` (rules, skills). Do not reintroduce a second package manager without an explicit decision.
- Use feature-cohesive directories and descriptive kebab-case TypeScript filenames. Use `.test.ts` / `.test.tsx` for focused package and app tests. Client Redux store harness specs may use `*.store.test.ts` when added; see `apps/client/.agents/rules/testing.md`.
- Use named package entry modules and explicit exports. Keep private implementation files private. Avoid catch-all `utils` or barrel trees that erase ownership.
- Hoist runtime and toolchain dependencies to the root `package.json` where practical. Leaf workspaces declare scripts and peer needs. Use `npm ci` in CI with a committed `package-lock.json`. Run repository scripts through npm (`npm run check`, `npm run dev`) and Nx for workspace targets (`nx run-many`, `nx affected`).
- Every app and package `tsconfig.json` extends the root base config and overrides only local needs (for example `jsx`, DOM `lib`, emit/`outDir`). Do not let a narrow root tsconfig silently exclude the changed package from verification.
- Development-only mock routes and debug tooling must not be mistaken for production entrypoints. Missing production configuration for a real deployment is out of scope for this starter unless you add it deliberately.
- Use Biome for format and lint. Every app and package exposes `format`, `lint`, `test` and `typecheck` scripts so root `npm run check` can drive them. The client uses Vitest; shared libraries use their established Node/`node:test` (and Playwright e2e for the router package). Do not add Prettier or a second formatter.

Review evidence: identify the missing build input, broken import/export, duplicate entrypoint or nonreproducible dependency wiring.
