---
id: coding-and-type-safety
description: Strict TypeScript, boundary parsing, explicit failures and focused implementation.
---
# Coding and type safety

Scope: implementation correctness and type discipline. Distributed lifecycle rules belong to [`state-machines-and-concurrency.md`](state-machines-and-concurrency.md); wire contracts live under `implementation/contracts/`.

- Keep strict TypeScript. Treat JSON, messages, persisted legacy data and provider output as `unknown` until parsed. Derive transport types from their contract; represent outcomes/states as discriminated unions with exhaustive handling.
- Do not use `any`, double casts, unchecked non-null assertions or suppressions to bypass validation. A necessary library-boundary assertion is local, explains the verified invariant and has a boundary test. Do not spread an assertion through the domain.
- Make input absence explicit; do not collapse `undefined`, null, zero, false or an empty string with truthiness defaults. Use safe integer/decimal rules and units for counters, money, generations and deadlines. Avoid implicit string/number coercion.
- Validate once at the trust boundary and carry a trusted representation inward. Keep business decisions in cohesive functions with explicit inputs/results. Avoid duplicate guards that can disagree, speculative configuration and opaque generic abstractions.
- Await relevant asynchronous work or persist its effect intent. No floating source calls, swallowed exceptions or catch-and-success fallbacks. Timeouts and aborts do not establish that a remote effect did not occur. Release local resources in bounded cleanup paths without overwriting the primary evidence.
- Distinguish expected domain failures from unexpected programming/provider failures. Preserve useful internal causes without leaking source data or secrets through logs/problems. Do not retry arbitrary errors or return cached values as live successes.
- Comments explain invariants, tradeoffs and unusual constraints, not restate syntax. Names express the domain and units. Keep changes scoped; avoid opportunistic renaming, formatting churn and needless compatibility layers.
- Use Drizzle ORM for all product database schema, migrations and queries (see [`persistence-and-recovery.md`](persistence-and-recovery.md)). Prefer Drizzle's parameter binding; never interpolate untrusted values into SQL. Use structured subprocess arguments and safe path handling. Never interpolate untrusted values into shell code, log formats or object property paths.
- At every TypeScript boundary where static type information is lost, parse with Zod into a trusted type before domain use. That includes JSON parse results, HTTP/RPC/Bridge/MCP bodies, env and config, CloudEvents, provider payloads, and any driver row that is not already typed by Drizzle. Do not cast `unknown` into a domain type. Where the shape is owned by an OpenAPI or JSON Schema contract, use a Zod schema generated from or proven equal to that authority; do not hand-maintain a divergent parallel schema. Spec-asset CI may still validate JSON Schema with the pinned standards tooling; that does not replace Zod at TypeScript runtime boundaries.

Review evidence: show an unsafe boundary, meaningful type hole, mishandled value/error or concrete control-flow failure. Flag style only when this rule or existing tooling explicitly requires it.
