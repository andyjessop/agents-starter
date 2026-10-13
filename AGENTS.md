# Agent Starter engineering instructions

Agent Starter is an npm workspaces monorepo: [`apps/client`](apps/client) (Redux-first SPA) and shared packages under [`packages/`](packages/). Biome formats and lints the repo. Use **npm**.

## Git safety: NEVER force push to `main`

**Never force push to `main`**. Fix forward with a branch and merge.

## Read the readme

Developer documentation starts at [`README.md`](README.md). Keep it aligned with the code when you change behaviour.

## Rules before editing

Canonical guidance lives in [`.agents/rules/`](.agents/rules/). **Read the applicable rule files before changing code.** Referencing a path does not load it; you must read and follow the content.

Root domain rules:

- [`architecture-and-ownership.md`](.agents/rules/architecture-and-ownership.md)
- [`structure-and-toolchain.md`](.agents/rules/structure-and-toolchain.md)
- [`coding-and-type-safety.md`](.agents/rules/coding-and-type-safety.md)
- [`testing-and-fixtures.md`](.agents/rules/testing-and-fixtures.md)
- [`verification-and-evidence.md`](.agents/rules/verification-and-evidence.md)
- [`frontend.md`](.agents/rules/frontend.md)
- [`persistence-and-recovery.md`](.agents/rules/persistence-and-recovery.md)
- [`state-machines-and-concurrency.md`](.agents/rules/state-machines-and-concurrency.md)
- [`security-and-authority.md`](.agents/rules/security-and-authority.md)
- [`product-and-developer-experience.md`](.agents/rules/product-and-developer-experience.md)

When work touches **`apps/client`**, also read [`apps/client/AGENTS.md`](apps/client/AGENTS.md) and the procedures under [`apps/client/.agents/rules/`](apps/client/.agents/rules/).

Harness adapters (optional): [`.cursor/README.md`](.cursor/README.md) (Cursor), [`.codex/README.md`](.codex/README.md) (Codex).

## Task workflows (skills)

Reusable workflows live in [`.agents/skills/workflow/`](.agents/skills/workflow/). Start with [`workflow/SKILL.md`](.agents/skills/workflow/SKILL.md) (dispatcher, playbooks, routed skills). For branch review, use [`interrogate`](.agents/skills/workflow/interrogate/SKILL.md) (scopes the diff by each `AGENTS.md` and fans out reviewers for that folder's `.agents/rules/`).

Models, subagent types, background execution, session boundaries, and tool permissions are chosen by the **execution harness**, not by repository skills.

## Definition of done

Run **`npm run check`** on the final change (format, lint, test, typecheck across workspaces). Use **`npm run build`** or **`npx nx affected -t lint,test,typecheck,build --base=main`** when you need broader or branch-scoped confidence (see [`.agents/rules/verification-and-evidence.md`](.agents/rules/verification-and-evidence.md)).

Local dev: **`npm run dev`** (client at http://localhost:5173). See [`README.md`](README.md).

Report commands, exit statuses, and anything left unverified.

## Agent mistake enforcement

| Invariant | Enforcement |
| --- | --- |
| Client styling uses CSS custom properties | [`apps/client/scripts/check-no-inline-theme-style.mjs`](apps/client/scripts/check-no-inline-theme-style.mjs) |
| Module effects stay in modules | [`apps/client/scripts/check-modular-effects.mjs`](apps/client/scripts/check-modular-effects.mjs) |
| Module layout | [`apps/client/scripts/check-module-layout.mjs`](apps/client/scripts/check-module-layout.mjs) |
| Route admission uses catalogue live scopes | [`apps/client/scripts/check-navigation-admission.mjs`](apps/client/scripts/check-navigation-admission.mjs) |
