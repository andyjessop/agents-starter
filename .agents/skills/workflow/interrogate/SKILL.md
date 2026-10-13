---
name: interrogate
description: >-
  Rule-scoped branch review: partition the diff by AGENTS.md jurisdictions, fan out
  one independent reviewer per scope with that folder's .agents/rules (and linked
  root rules), then synthesize a verdict. Use for interrogate, adversarial review,
  or review this branch against main.
disable-model-invocation: true
---

# Interrogate

Review a change by **scope**, not by one generic rubric. Each `AGENTS.md` defines a jurisdiction. Reviewers own the rule files in that directory's `.agents/rules/` and only the diff paths under that scope.

The deliverable is a synthesized verdict. Do **not** auto-apply changes.

If the harness cannot provide independent reviewers per active scope, report **incomplete** rather than simulating multiple passes in one thread.

## Step 1. Capture scope and diff

- Default base branch: **main** (override when the user names one).
- Build the full changeset: `git diff <base>...HEAD` (include working tree when the user asked for it).
- Run the partition helper from the repository root:

```sh
python3 .agents/skills/workflow/interrogate/scripts/partition_review_scope.py --base main
```

Read `active_scope_ids`, `paths_by_scope`, and `scopes` from the JSON. If there are no effective changes in active scopes, stop with **no changes to review**.

For each active scope, build a **scoped diff**:

```sh
git diff <base>...HEAD -- <path1> <path2> ...
```

## Step 2. Enrich rule lists per scope

For each active scope, read that scope's `AGENTS.md`. When it requires root or parent rules (for example client scope requiring [`.agents/rules/frontend.md`](../../../../.agents/rules/frontend.md)), add those paths to the reviewer's assigned rule list. Do not duplicate rule prose in the prompt; use file paths.

## Step 3. State intent

Before spawning reviewers, write one paragraph of stated intent from the user message, commits, PR description, and the code. Share the same intent with every scope reviewer.

## Step 4. Fan out scope reviewers

Launch **one independent read-only reviewer per active scope** concurrently (`interrogate-reviewer` role).

Use [reviewer-prompt.md](references/reviewer-prompt.md) with:

- `SCOPE_ID`, `PATH_PREFIX`, `AGENTS_MD`, bullet list of assigned rule **paths**
- Shared intent
- Scoped diff or files only for `paths_by_scope[scope_id]`
- [reviewer-contract.md](references/reviewer-contract.md)

Reviewers must not see other scopes' diffs as their primary audit target. Cross-scope findings belong to the scope where the violating path lives.

Optional cross-cutting lenses ([rubric.md](references/rubric.md), [code-quality-review.md](references/code-quality-review.md)) are for the **coordinator only** during Step 5, not a substitute for rule files in scope briefs.

## Step 5. Synthesize

Merge scope results:

1. Parse findings per scope and status (`findings`, `no_findings`, `incomplete`).
2. **Consensus:** same issue flagged in overlapping scopes counts once; note both rule citations if relevant.
3. **Incomplete scopes:** surface explicitly; do not treat as pass.
4. **Disagreements:** record when one scope's rules imply a fix another scope would reject.

Apply [lead-judgment.md](references/lead-judgment.md) as coordinator. Categorize every finding: **Act on**, **Consider**, **Noted**, **Dismissed**.

## Output format

### Intent
> [Step 3 paragraph]

### Scopes reviewed
- `{scope_id}` (`{path_prefix}` or repo root): [status], [N findings], rules: [file names]

### Act on
[Findings with scope, rule citation, evidence]

### Consider
[Findings with tradeoffs]

### Noted
[Brief list]

### Dismissed
[Brief list with rationale]

### Agreement map
[Cross-scope patterns and gaps]

## References

- [scope-discovery.md](references/scope-discovery.md) — jurisdiction algorithm
- [partition_review_scope.py](scripts/partition_review_scope.py) — path → scope map
