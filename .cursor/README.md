# Cursor harness adapters (Agent Starter)

Repository engineering guidance is **harness-agnostic**. This folder holds **Cursor-only** integration; canonical content lives in [`.agents/`](../.agents/) and [`AGENTS.md`](../AGENTS.md).

## Three-way split

| Concern | Location | Cursor behaviour |
| --- | --- | --- |
| Rules | [`.agents/rules/`](../.agents/rules/) | Full prose here. [`.cursor/rules/*.mdc`](rules/) are thin pointers with `globs` / `description` for discovery. |
| Skills | [`.agents/skills/`](../.agents/skills/) | Standard Agent Skills discovery under `.agents/skills/`. |
| Execution policy | User config, SDK, [`.cursor/agents/`](../.cursor/agents/), optional local rules | Models, `Task` parameters, cloud/local agents — not in portable skills. |

See also [`.codex/README.md`](../.codex/README.md) for Codex (AGENTS.md chain, no `.mdc` rule files).

## Rule pointers

Files in [`rules/`](rules/) tell Cursor **when** to load canonical rules. They must not duplicate rule text.

## Cursor-only skills

Workflows that require Cursor product features (`/loop`, cloud agents, specific subagent types) live under [`.cursor/skills/`](skills/).

## Role labels

Portable skills use role names such as `explore` and `implement`. Map them to models in your harness policy. Example shape: [`.cursor/execution-policy.example.md`](execution-policy.example.md).
