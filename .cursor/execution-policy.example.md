# Execution policy example (harness-owned)

Repository skills refer to **roles** below. Map each role to models, tools, and session settings in your Cursor, Codex, or other harness configuration. Do not commit provider-specific model slugs into portable skills.

| Role | Typical use | Suggested constraints |
| --- | --- | --- |
| `explore` | Read-only codebase investigation (`how`, `why` investigators) | Read-only, fresh context, parallel OK |
| `explain` | Synthesis and prose (`how` explainer, `why` synthesizer) | Read-only or tool-enabled for citation checks |
| `implement` | Code-writing delegates (feature, bug-fix, perf, refactoring, hillclimb) | Writable, fresh context per round |
| `swarm-worker` | Parallel verification or exploration slices | Isolated output paths |
| `arena-runner` | Competing design or code candidates | Isolated worktrees or directories |
| `cross-judge` | Read-only scoring of arena candidates | Read-only, independent from parent |
| `interrogate-reviewer` | Adversarial diff or branch review (`workflow/interrogate`) | Read-only, independent sessions |
| `reflect-judgment` | Transcript mining, judgment lens | Tool access if transcript references external systems |
| `reflect-tooling` | Transcript mining, tooling lens | Tool access when needed |
| `reflect-divergent` | Transcript mining, divergent lens | Tool access when needed |
| `reflect-synthesizer` | Merge reflect reviewer outputs | May need tool access for citation checks |

Fields harnesses may set per role (examples only):

- `readonly`: true/false
- `freshContext`: true for new review or implementation rounds
- `parallelism`: max concurrent workers for a fan-out step
- `environment`: local vs remote when the harness distinguishes them

Codex operators configure subagents in user or team harness settings. Cursor operators may use local rules, SDK config, or [`.cursor/agents/`](agents/) definitions. See [`.cursor/README.md`](README.md) and [`.codex/README.md`](../.codex/README.md).
