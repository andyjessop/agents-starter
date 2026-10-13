# Codex harness adapters (Agent Starter)

Repository engineering guidance is **harness-agnostic**. Codex loads this repo as follows.

## Three-way split

| Concern | Location | Codex behaviour |
| --- | --- | --- |
| Rules | [`.agents/rules/`](../.agents/rules/) | **Not auto-loaded.** Root [`AGENTS.md`](../AGENTS.md) instructs the agent to read applicable rule files before editing. |
| Skills | [`.agents/skills/`](../.agents/skills/) | Discovered from cwd up to repo root (`SKILL.md` metadata; full skill loaded when chosen). |
| Execution policy | User/team Codex config (`~/.codex/`) | Models, subagents, sandbox approvals, and tool access — not in portable skills. |

See also [`.cursor/README.md`](../.cursor/README.md) for Cursor-specific adapters (`.mdc` rule pointers).

## Instructions chain

Codex concatenates `AGENTS.md` (and optional `AGENTS.override.md`) from the git root down to the current working directory. Nested [`apps/client/AGENTS.md`](../apps/client/AGENTS.md) applies when work is under `apps/client/`.

Official guide: [Custom instructions with AGENTS.md](https://developers.openai.com/codex/guides/agents-md).

## `.codex/rules/` is not engineering rules

Project files under `.codex/rules/*.rules` are **shell command exec policy** (Starlark `prefix_rule`: allow / prompt / forbidden). They do **not** replace [`.agents/rules/`](../.agents/rules/). Do not put architecture or testing prose here.

Add `default.rules` only if sandbox prompts block routine verification commands and the project `.codex/` layer is trusted.

## Role labels (execution policy)

Portable skills refer to **roles** (for example `explore`, `explain`, `implement`, review roster IDs). Map roles to models and subagent settings in your Codex harness configuration, not in the repository.

Example role list: [`.cursor/execution-policy.example.md`](../.cursor/execution-policy.example.md).

## Skills catalogue (repo root)

- [`workflow`](../.agents/skills/workflow/SKILL.md) — dispatcher, playbooks, and routed skills (including [`interrogate`](../.agents/skills/workflow/interrogate/SKILL.md) for diff review)
