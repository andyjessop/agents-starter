# Scope discovery

Interrogate fans out **one independent reviewer per AGENTS.md scope** that has changed files in the review diff.

## Finding scopes

1. Discover every `AGENTS.md` in the repository (skip hidden dirs and `node_modules`).
2. The **scope root** is the directory containing that `AGENTS.md`.
3. **Assigned rules** are every `*.md` file in `{scope_root}/.agents/rules/` when that directory exists. If it does not exist, the reviewer still runs for that scope using `{scope_root}/AGENTS.md` as the only instruction file (no invented rules).
4. **Path assignment:** a changed file belongs to the scope whose `AGENTS.md` directory is the nearest ancestor (longest matching path prefix). Example: `apps/client/src/foo.ts` → `apps/client/`.
5. **Repository root scope:** changes not under any nested `AGENTS.md` directory (e.g. `packages/redux-router/`, root config) belong to the root scope when `AGENTS.md` exists at the repo root. Root reviewers use `.agents/rules/*.md`.

## Partition helper

From the repository root:

```sh
python3 .agents/skills/workflow/interrogate/scripts/partition_review_scope.py --base main
```

The JSON includes `scopes`, `paths_by_scope`, and `active_scope_ids`. Only spawn reviewers for ids in `active_scope_ids`.

Build each reviewer's diff with `git diff main...HEAD -- <paths>` (or the user's base branch).

## Nested AGENTS.md

When `apps/client/AGENTS.md` points at root [`.agents/rules/frontend.md`](../../../../.agents/rules/frontend.md), the **client scope reviewer** still owns client paths. Include root rules that `AGENTS.md` explicitly requires for that tree (read client `AGENTS.md` and add linked root rule paths to the brief) in addition to `apps/client/.agents/rules/*.md`.

Keep portable: do not hard-code paths in this file beyond examples; read `AGENTS.md` for each scope at review time.
