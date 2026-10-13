---
name: why
description: "Use for 'why does X work this way', 'why we picked Y', design rationale, regressions, postmortems, or data-backed thresholds. Discovers available MCPs and queries each evidence category (source control, issue tracker, long-form docs, real-time chat, infrastructure observability, error tracking, product analytics warehouse) in parallel, then returns a cited read on decisions and tradeoffs. Use how for runtime behavior."
disable-model-invocation: true
---

# Why

Investigate the motivation and intent behind code.

Companion to the `how` skill. `how` answers what the code does and how it works. `why` answers what forces led to its shape.

Use independent read-only or tool-enabled workers when the harness supports parallel investigation (`explore` / category-specific roles). Investigators need MCP access where categories require it.

## Operating posture

Operate as a **careful, cautious, and precise investigator**. Be honest about what you know vs what you're inferring. Read `references/epistemics.md` for the full confidence framework and phrasing guide. The synthesizer must follow it.

## Step 1. Understand the target and the question

Parse what the user is asking. The **target** is usually a chunk of code, a pattern, a feature, or a named design decision. The **question** is usually a design rationale, a tradeoff, a motivating edge case, an external constraint, dead code, or a broad history sweep.

If the target is vague ("why do we do it this way?" with no clear referent), make your best guess from conversation context. State your interpretation briefly so the user can redirect if you're off, then proceed.

## Step 2. Establish the code anchor

Before spawning investigators, anchor the investigation in concrete code. You need:

- The relevant file path(s) and line range(s)
- The key symbols (function names, class names, constants)
- An initial commit list. The last few commits touching the target.
- PR numbers from merge commits (pattern `(#1234)` in the subject line)

Build this inline with git and `gh` as needed. Pull PR bodies and discussion for substantive commits.

Capture this as seed context (file paths, symbols, commits, PR numbers, linked ticket IDs). Pass it to the investigators.

## Step 3. Spawn parallel investigators (default posture)

**Default to the full parallel investigation.**

### Discovery

Before spawning investigators, list MCP tools available in the harness. Map each available integration to one evidence category:

1. Source control history
2. Issue / ticket tracker
3. Long-form documents
4. Real-time team chat
5. Infrastructure observability
6. Error / exception tracking
7. Product analytics warehouse

Source control is always available through git and `gh`. Aim for a complete **coverage map**, not a minimal one. Document the null, don't skip the search.

Launch all matching investigators concurrently. Don't ask one agent to cover multiple MCPs.

Each investigator gets:

1. The base prompt from `references/investigator-prompt.md`
2. The category playbook `references/sources/<source>.md` for the selected MCP, adapted from the examples in `references/source-playbook.md`
3. The cross-cutting `references/sources/incident-postmortem.md` **if the target code looks defensive** (null checks, retry logic, timeout handling, rate limiting, feature flags, egress guards, OOM handlers)
4. The code anchor from Step 2
5. The user's original question

Investigators must not edit repository files. They need tool access for MCP-backed categories.

### Investigator roster

Spawn one investigator per category that has a matching MCP. See the numbered roster in the prior version of this skill (source control always; others when MCPs exist).

### When to skip an investigator

Only skip with an **explicit, written justification** in the final "Sources Consulted" section: no MCP for that category, or provably irrelevant source.

If the PR description already contains the complete answer for a trivial single-commit target, you may answer inline **only after** confirming parallel category searches would be redundant. Say so explicitly. This should be rare.

## Step 4. Synthesize

Combine investigator findings with the `explain` role when the harness provides an independent worker. The synthesizer gets investigator outputs, the code anchor, the user's question, `references/epistemics.md`, and `references/synthesizer-prompt.md`. Spot-verification of citations may require MCP access.

## Step 5. Present

Take the synthesizer's output and present it to the user. You may lightly edit for clarity or add context from the conversation, but **do not rewrite the confidence language**.

## References

- `references/investigator-prompt.md`. Base prompt template for investigator workers.
- `references/synthesizer-prompt.md`. Prompt template for the synthesizer, including the output format.
- `references/epistemics.md`. Confidence labelling.
- `references/source-playbook.md` and `references/sources/*.md`. Category playbooks.
