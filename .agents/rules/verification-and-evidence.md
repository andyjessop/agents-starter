---
id: verification-and-evidence
description: Commands, gates and honest reporting of what was exercised.
---
# Verification and evidence

Scope: what to run before claiming completion and how to report it.

- Before claiming a change complete, run **`npm run check`** against the final files in this session (format, lint, test, typecheck across workspaces). Report command, exit status, affected scope and outstanding checks. Do not present an earlier build's result as current.
- **`npm run check`** is the primary monorepo gate. Full-workspace equivalents include `npm run format`, `npm run lint`, `nx run-many -t test,typecheck --all`, and `npm run build` when you need broader confidence. For partial verification, use **`nx affected -t lint,test,typecheck,build`** with `--base=main`.
- For local dev stack proof, use **`npm run dev`** (Vite client, default http://localhost:5173; mock API in-process). See [`README.md`](../../README.md). Missing harness or environment is missing evidence, not a skipped pass.
- Green package gates do not establish launch readiness for a production deployment you have not defined. State exactly what was exercised and what was not.

Review evidence: list commands run, exit codes, and any gate that could not run with reason.
