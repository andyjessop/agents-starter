# Agent Starter workflow skills: a practical engineering guide

*A curated tutorial for the agent skills in [`.agents/skills/workflow/`](.) in this repository.*

## Contents

- [What the stack contains](#1-what-you-are-actually-installing) and [how to start](#2-start-here-install-configure-and-run-one-task)
- [Which skills to learn first](#3-which-skills-are-worth-learning)
- [Guide 1: Understand a codebase](#guide-1-understand-a-codebase-before-changing-it)
- [Guide 2: Design an API or feature](#guide-2-design-a-new-api-or-cross-cutting-feature)
- [Guide 3: Fix a bug](#guide-3-fix-a-bug-with-evidence)
- [Guide 4: Refactor or migrate](#guide-4-refactor-without-changing-behaviour)
- [Guide 5: Deliver a feature](#guide-5-deliver-an-ordinary-feature)
- [Guide 6: Diagnose performance](#guide-6-diagnose-and-improve-performance)
- [Guide 7: Build a verification harness](#guide-7-give-agents-a-repeatable-verification-surface)
- [Guide 8: Review and ship](#guide-8-review-the-change-and-ship-it-safely)
- [Guide 9: Parallel and unattended work](#guide-9-parallel-work-and-unattended-runs)
- [Guide 10: Improve the environment](#guide-10-improve-the-repository-and-the-skills-over-time)
- [Principles worth remembering](#4-the-principles-worth-actually-remembering)
- [Three end-to-end examples](#5-three-complete-workflows-to-copy)
- [Evaluation and exclusions](#6-evaluation-what-i-would-keep-change-or-ignore)
- [Quick decision reference](#7-short-decision-reference)

---

## 1. What you are actually installing

This folder is a harness-agnostic agent workflow library for this repository, not a pile of unrelated commands. Cursor-only programme playbooks live under [`.cursor/skills/workflow/`](../../../.cursor/skills/workflow/). It ships **48 skills** here: **24 operational or supporting skills** and **24 engineering principles**. The main dispatcher, [`/workflow`](SKILL.md), selects one of **23 playbooks** and calls other skills at the appropriate steps.

The layers serve different purposes:

| Layer | Purpose | Example |
| --- | --- | --- |
| Skill | Perform a particular capability | `/how` traces a code path; `/interrogate` reviews a diff. |
| Playbook | Sequence the capabilities to finish a type of task | The Bug fix playbook reproduces, isolates, fixes, verifies and opens a PR. |
| Principle | Constrain an engineering decision | *Prove It Works* requires evidence from the real application. |

You normally invoke the dispatcher, not a hand-written chain of skills. Invoke an individual skill when you want a specific output, a narrower read-only operation, or more scrutiny than the dispatcher would otherwise apply.

This README is selective. It concentrates on the workflows most likely to improve ordinary engineering work and identifies the optional and expensive parts. Each skill lives in a subdirectory with its own `SKILL.md`. Repository-wide engineering instructions live in [`AGENTS.md`](../../../AGENTS.md) and [`.agents/rules/`](../../rules/).

## 2. Start here: run one task

Skills load from `.agents/skills/workflow/`. There is no separate setup step. Map **roles** to models in your harness execution policy (see [`.cursor/execution-policy.example.md`](../../../.cursor/execution-policy.example.md)). Repository skills describe workflows, not model IDs.

Run a bounded task:

```text
/workflow add --json output to the status command.
Keep its existing text output byte-for-byte unchanged.
Done means both modes run against the fixture and JSON parses.
Show the commands and their output. Do not merge anything.
```

This is normally the **Feature playbook**. It investigates the current system, designs the change, delegates the implementation, verifies the real command and prepares a PR. You do not need to name the intermediate skills.

In Cursor, using Option+Enter on macOS (Alt+Enter on Windows) when selecting `/workflow` makes it a persistent Custom Mode. Pressing Enter attaches it to one message. The persistent mode re-evaluates new tasks; it does not need to run for trivial questions.

**A practical prompt contract** has five fields: the goal, the observable done condition, scope, evidence and authority. For example: *'Fix duplicate notifications after reconnect; do not alter the delivery format; show a failing-before and passing-after reproduction; create a PR but do not merge.'* These constraints are more valuable than telling the agent precisely which skills to call.

**Set authority explicitly.** The stack favours autonomous operation and allows many reversible tool actions without asking. If you do not want it to create PRs, change tickets, push branches, message people or merge, say so. In particular, unattended shipping should be an explicit decision.

### One useful setup step that is easy to overlook

If your repository does not already have a reliable way for an agent to run the application and check a user-visible change, use [`/create-verification-skill`](create-verification-skill/SKILL.md). This is arguably the best long-term investment in the entire stack. Guide 7 explains how to use it.

## 3. Which skills are worth learning?

Learn these first. The commands are linked to their definitions.

| Job | Primary skill | When to choose it | What you should receive |
| --- | --- | --- | --- |
| Dispatch a non-trivial task | [`/workflow`](SKILL.md) | You want work completed, not just analysed | A matched playbook, executed steps, checks and artifacts |
| Understand code | [`/how`](how/SKILL.md) | Runtime behaviour, ownership, call paths | A traced explanation with file locations |
| Understand a design decision | [`/why`](why/SKILL.md) | Historical rationale, thresholds, regressions | Source-backed reasoning, including gaps |
| Settle an API or module shape | [`/architect`](architect/SKILL.md) | A change crosses boundaries or constrains future callers | Caller-first usage, types, signatures, module map |
| Compare substantially different designs | [`/arena`](arena/SKILL.md) | One proposed design is not enough | Competing artifacts, judged and synthesised |
| Fix a cheap-to-test defect | [`/tdd`](tdd/SKILL.md) | A narrow failing regression can be written | Failing-before test, fix, passing-after test |
| Check hidden impact | [`/blast-radius`](blast-radius/SKILL.md) | A small diff might break other consumers | Risks and a tested safety claim |
| Review a substantive diff | [`/interrogate`](interrogate/SKILL.md) | You want rule-scoped reviewers per `AGENTS.md` / `.agents/rules` | Findings by scope, ranked by actionability |
| Verify actual application behaviour | [`/create-verification-skill`](create-verification-skill/SKILL.md) | Agents lack a stable launch-and-drive procedure | A project-local verification skill and feature map |
| Validate performance claims | [`/benchmark-checklist`](benchmark-checklist/SKILL.md) | Before trusting or publishing a speedup | Repeatable figures, limitations, verdict |
| Parallelise independent work | [`/swarm`](swarm/SKILL.md) | Packages or test surfaces can be checked separately | One coverage report with explicit gaps |
| Eliminate repeated agent errors | [`/correct`](correct/SKILL.md) | The same mistake happens in several PRs | A structural or executable constraint proven to catch it |

The other skills are useful mainly as components of these workflows. Do not spend equal time learning every vendored skill.

---

## Guide 1. Understand a codebase before changing it

**Situation:** you have entered an unfamiliar subsystem, or an agent proposes a change to code you do not yet understand.

Use four different tools for four different questions:

| Question | Skill | Distinction |
| --- | --- | --- |
| What happens at runtime? | `/how` | Explains current code and its call flow. |
| Why was it designed this way? | `/why` | Searches history and other evidence for motivation. |
| Can you teach me the whole concept? | [`/teach`](teach/SKILL.md) | Combines code mechanics and rationale into an explanation. |
| Where did I leave off last week? | [`/recall`](recall/SKILL.md) | Reconstructs your previous working context and current thread status. |

### Procedure

1. Begin with `/how` when your uncertainty is about behaviour or ownership. It reads the code. Larger requests fan out to two to four read-only explorers, followed by an explanation.
2. Use `/why` only when history may change the decision. It anchors to files and commits, then searches available source control, tickets, documents, chat, observability, errors and analytics through connected tools. Missing sources must remain visible as gaps. This breadth can make it an expensive choice for a simple question.
3. Use `/teach` when you need a progressive explanation rather than a reference map. It normally composes `/how` and `/why`.
4. Use `/recall` when resuming a *topic across several prior chats*. For one in-flight branch or agent session, ask `/workflow take over this branch` to select the **Session pickup** playbook instead.

### Example

```text
/how trace an incoming device event from the WebSocket bridge to storage.
Show the public entry points, relevant types, error paths and side effects.
Do not edit anything.
```

Then, if an odd retry or timeout emerges:

```text
/why why does the bridge retry on this interval?
Start with the responsible commit and PR. Check whether the reason
still applies. Separate evidence from inference.
```

**Done means:** you have a reproducible account of what the code does, where it lives, and which assumptions are confirmed rather than guessed. Do not start a fix just because the investigation found an oddity; decide whether that oddity violates a real contract.

**Use less machinery when:** the question is one function and its caller. A direct `/how` is sufficient. `/why` is excessive without a genuine historical question.

## Guide 2. Design a new API or cross-cutting feature

**Situation:** you are about to add a subsystem, change ownership, create a shared module or expose an API that many callers will depend on.

Use [`/architect`](architect/SKILL.md). Its sequence is deliberate: understand the existing code with `/how`, consult `/why` if changing ownership, produce at least two structurally different design sketches through `/arena`, choose a design and implement against it.

The output should begin with **how a caller uses the interface**, then derive types, signatures and module boundaries from that usage. The sketch may include unimplemented bodies. This forces the public contract to exist before implementation details fill the files.

### Procedure

1. Describe the user-visible result and constraints, not your preferred class hierarchy.
2. Say whether the request is **design-only**. By default, `/architect` continues to implementation after it selects a sketch.
3. Ask for a checkpoint when you want to approve the design: `/architect with checkpoint. Stop before implementing.`
4. Compare the candidates on public API surface, state ownership, failure handling, migration cost and how a future agent would extend the module.
5. Implement the chosen design. If implementation repeatedly requires escape hatches or unrelated workarounds, revisit the design rather than accumulating patches.
6. Verify the actual caller behaviour. Use `/interrogate` on the real diff if the design remains contested.

### Example

```text
/architect with checkpoint. Design a device-event ingestion module.
Consumers should call run(input) and receive a typed result.
Retries must be idempotent. Keep transport concerns at the boundary
and keep the core logic deterministic.
Show caller examples, alternative module shapes, tradeoffs and the
chosen public interface. Do not implement until I approve the sketch.
```

### When to add `/arena` directly

Use `/arena` when you have one identical brief and want two or more serious attempts before deciding. Candidates work independently; a cross-model judge scores them against a rubric; the parent chooses a base, grafts useful ideas from other candidates and verifies the result.

```text
/arena compare three implementations of the event deduplication index.
Same fixtures and memory budget for every candidate.
Assess correctness, complexity and read/write cost.
```

Do not use `/arena` simply to throw agents at different packages. That is `/swarm`. Also, do not pay for an arena when one interface is obvious and cheap to reverse.

### When to prototype instead of planning

For a decision that can be settled empirically, use the **Prototype playbook**:

```text
/workflow prototype two approaches to reconnect scheduling.
Run both against the same simulated disconnect pattern.
Return observed retry timelines and a recommendation.
Do not edit production source.
```

A prototype is throwaway code to answer a question. The real build follows the Feature playbook. This distinction avoids mistaking quick experimental code for production architecture.

## Guide 3. Fix a bug with evidence

**Situation:** a report says behaviour is wrong, but the cause is unclear.

The **Bug fix playbook** is the best default. It requires a reproduction on the matching surface, isolates the cause with hypotheses and runtime evidence, chooses a small fix, verifies on the same surface, and prepares a PR. The [`/tdd`](tdd/SKILL.md) skill is a focused technique inside that workflow, not a competing end-to-end process.

### Procedure

1. Specify the observed defect, expected behaviour, reproduction inputs and affected version or environment if known.
2. Reproduce **before editing**. If the app cannot be driven by the agent, improve the harness or state exactly why the reproduction is unavailable.
3. Trace the cause. Use `/how`; add `/why` if a recent change or earlier incident may explain it. Reject disproved hypotheses rather than stacking defensive fixes.
4. If there is a cheap local check, ask for `/tdd`: write the failing test, run it, implement the smallest fix, rerun it. Do not manufacture brittle mocks simply to say TDD was followed.
5. Rerun the original end-to-end reproduction. A unit test passing is necessary evidence for some bugs, not sufficient evidence that the original symptom disappeared.
6. Ask `/blast-radius` if the corrected code also serves other consumers, then `/interrogate` if the diff carries significant risk.

### Example

```text
/workflow a reconnect sometimes writes the same event twice.
Reproduce the duplicate using the local event fixture before changing
code. Find the mechanism rather than adding another guard.
If the regression has a cheap test target, use /tdd.
Done means exactly one persisted event after repeated reconnects.
Show the before and after storage contents and test output.
Open a PR; do not merge.
```

A useful final report contains the failed reproduction, root cause, change made, successful reproduction and any remaining uncertainty. Avoid treating a plausible code explanation as proof.

### Use `/blast-radius` for a change that looks safe locally

`/blast-radius` is not another diff review. It follows consequences outside the changed files: downstream callers, serialised formats, library behaviour, lifecycle ordering and hidden consumers. It identifies the one or two assumptions that make the change safe and tries to prove them with a test or a running app. If it cannot prove them, its result should say **unproven**.

```text
/blast-radius check this change to the retry cache key.
Find consumers outside the modified files and prove that no persisted
or externally visible identifier changes shape.
```

Use it when a small diff has a large potential reach, including shared package types, storage formats, retry semantics and event ordering.

## Guide 4. Refactor without changing behaviour

**Situation:** code works, but the structure makes future changes expensive or error-prone.

The **Refactoring playbook** starts by pinning the existing behaviour. This is its defining difference from Feature: **the structure changes; the observable contract does not**.

### Procedure

1. Use `/how` to map current callers, boundary contracts and side effects.
2. Capture a behavioural baseline before moving code: fixture outputs, snapshots, an equivalence script, or a driven application flow. Typechecking alone is not a baseline.
3. Describe the new shape. Identify the state, interface or module boundary that should replace the current one. If changing ownership or a public signature, use `/architect`.
4. Remove dead paths and redundant indirection before adding new abstractions. Move code in small, independently verifiable steps.
5. Migrate known internal callers and remove the old internal API in one wave. If external consumers exist, compatibility is a separate product constraint that must be stated rather than silently deleted.
6. Compare the new result against the captured baseline. Split any behavioural fix into a separate task.

### Example

```text
/workflow refactor event parsing into one module with a single
public entry point. No behaviour change, including existing errors.
Record output for the current fixtures first, then prove byte-equivalent
results after the move. Migrate internal callers and delete the old
internal functions. Show the before/after call graph and checks.
Do not merge.
```

### Large migrations

For a migration across many packages or PRs, use [`/figure-it-out`](figure-it-out/SKILL.md) or ask `/workflow` to produce a **Multi-phase plan**. The plan playbook deliberately stops before implementation. It divides work into verifiable PRs and states which execution playbook should follow. Use a separate run to execute the approved plan.

```text
/workflow plan the migration from the legacy client to the new API.
Inventory the call sites, prove existing behaviour on fixtures,
identify dependency order and produce small verifiable PRs.
The deliverable is the plan only. Do not start implementation.
```

If an API is public outside the repository, do not adopt the playbook's preference for deleting compatibility layers without checking versioning obligations.

## Guide 5. Deliver an ordinary feature

**Situation:** the intended behaviour is known and the main work is implementing it, rather than deciding what the system should do.

Use `/workflow` with a clear feature request. Its **Feature playbook** runs `/how`, designs with `/architect`, names the data shape, delegates code to a separate implementer, verifies the actual application surface and opens a PR. It can split independent workstreams, but shared mutable files and state should stay under one owner.

### Procedure

1. Describe the behaviour in terms a caller or user can observe.
2. Identify the existing contract that must not change.
3. State at least one positive case, one negative case and the proof surface.
4. Let the playbook choose the internal skills. If the feature is trivial, omit `/workflow` and ask for a direct edit instead.
5. Review the resulting interface and data model, not just the amount of code changed.
6. Require a real run and a focused PR description that distinguishes verified facts from remaining gaps.

### Example

```text
/workflow add a dry-run mode to the import command.
It must display planned writes but perform no persistent writes.
Existing output remains unchanged without the flag.
Run the command on a seeded dataset in both modes and check the
storage state before and after. Open a PR; do not merge.
```

A feature is finished when the actual user action produces the promised result and existing contracts still hold. A passing build or typecheck is not the finish condition.

## Guide 6. Diagnose and improve performance

**Situation:** latency, throughput or resource use is worse than expected.

Choose the playbook from the evidence you already have:

| Input or goal | Best route | Expected result |
| --- | --- | --- |
| 'This operation is slow; fix it.' | **Perf issue** | Baseline, cause, change, before/after measurement |
| 'The live process intermittently spins or leaks.' | **Runtime forensics** | Instrumented diagnosis, no speculative fix |
| 'I have a `cpuprofile` or trace.' | **Trace forensics** | Hot frames tied to source and a cause hypothesis |
| 'Improve this one metric as far as practical.' | **Hillclimb** | Multiple controlled hypotheses, keep wins, revert losses |
| 'Can we trust this benchmark?' | [`/benchmark-checklist`](benchmark-checklist/SKILL.md) | A qualified number and a verdict |

The Perf issue playbook measures first, uses `/how` to ground hypotheses, then tries to remove work before making it cheaper. It reruns the trace and validates every claimed improvement.

### Procedure

1. Freeze the workload, dataset, environment and metric. Define whether you are optimising user-visible latency, throughput, memory or another measurable outcome.
2. Capture a baseline **in the actual path**. Check that the work finished and produced the correct result.
3. Identify the limiter, such as CPU time in a named function, storage round trips, the load generator, or external network latency.
4. Change one cause at a time. Re-run the same workload, including correctness checks. Keep beneficial changes; discard unsuccessful experiments.
5. Run `/benchmark-checklist` before publishing. It asks whether runs were correctly tuned, respected hardware limits, contained errors, reproduced over alternating runs, mattered end to end, and actually performed the timed work.

### Example

```text
/workflow command startup is too slow on the 20k-record fixture.
Measure the real command first and capture a profile.
Find the limiting operation, change only the measured cause,
then compare production-mode runs on identical data.
Report median and range, correctness results and trace artifacts.
```

When the task is just to interpret an existing trace, say **no fix yet**. Do not commission a code change before understanding the bottleneck.

## Guide 7. Give agents a repeatable verification surface

**Situation:** every agent claims a feature is finished, but a human still needs to launch the application and test it manually.

Run:

```text
/create-verification-skill
```

The generator studies the repository and writes a project-local `.cursor/skills/verify-<app>/` skill. It should reuse existing Playwright, CLI, PTY or HTTP harnesses before introducing new machinery. It also builds a feature map, starting with roughly three to five important user-facing features.

Every generated verification skill must define five operations:

| Operation | Contract |
| --- | --- |
| **Launch** | Start an isolated instance with a known command and readiness signal. |
| **Doctor** | Check that the instance and environment are worth testing. |
| **Drive** | Exercise a feature using stable selectors, CLI commands or HTTP requests. |
| **Evidence** | Capture the action and its observable result, including side effects. |
| **Cleanup** | Stop only the processes and scratch state that the run created; retain evidence. |

### Procedure

1. Run the generator in a clean, runnable checkout. Resolve startup blockers first.
2. Inspect the generated commands and feature map. Ensure the map describes user-visible behaviour, not only internal functions.
3. Require the generator to **run its own skill once**: launch, doctor, drive one feature, capture evidence and clean up.
4. Commit the verification skill alongside the repository. Thereafter, call it from bug-fix and feature prompts.
5. When routes or features change, use [`/maintain-verification-skill`](maintain-verification-skill/SKILL.md) to audit the feature map and drive every mapped feature. It edits verification instructions and harness files, not production code.

### Example

```text
/create-verification-skill for this CLI.
Reuse the existing integration fixture and PTY harness if possible.
Include launch, doctor, drive, evidence and cleanup.
Cover pairing, listing devices and receiving an event.
Prove the generated instructions work before handing them over.
```

Later:

```text
/workflow add a reconnect command.
Use /verify-<app> to test the real pairing and reconnect flow.
Provide the terminal transcript and resulting device state.
```

**High-value consequence:** once agents have a reliable command to prove a feature works, they can use it repeatedly while implementing. This is more durable than adding another paragraph to agent instructions telling them to test carefully.

## Guide 8. Review the change and ship it safely

**Situation:** the code is implemented and tested; now you need to decide whether it is safe, reviewable and ready to merge.

There are separate decisions. Do not conflate them:

| Question | Tool | Meaning |
| --- | --- | --- |
| What might break *outside* this diff? | `/blast-radius` | Dependency and runtime consequence analysis, with a tested safety claim |
| Can independent reviewers find defects *in* the change? | `/interrogate` | One reviewer per `AGENTS.md` scope and its `.agents/rules` |
| Are the changes presented clearly? | [`/technical-writing`](technical-writing/SKILL.md) and [`/unslop`](unslop/SKILL.md) | Documentation, PR and commit prose |
| Are the comments carrying unnecessary information? | [`/no-comments`](no-comments/SKILL.md) | Aggressive comment review; optional for most teams |
| Are CI and review threads resolved? | **Babysit playbook** | Make the PR merge-ready; does not merge |
| Should this verified stack land now? | **Shipping playbook** | Re-verify and merge only safe contiguous PRs |

### Procedure

1. First verify that the real behavioural contract passes. Reviews cannot substitute for this.
2. Invoke `/blast-radius` if the change can affect unmodified consumers, stored formats, lifecycle behaviour or integrations.
3. Invoke `/interrogate` on the diff when correctness, security, ownership or reversibility warrants multi-model review. It returns `Act on`, `Consider`, `Noted` and `Dismissed` buckets. It **does not automatically apply** proposed changes.
4. Address confirmed findings; do not act automatically on every comment. Rerun the relevant verification after changing the patch.
5. Prepare a focused PR with intent, scope, tradeoffs, risks and evidence. The Opening a PR playbook normally handles this, including small ordered commits.
6. Ask for **Babysit** when the PR needs conflicts, reviews or CI attended. Ask for **check** if you only want one status read.
7. Invoke **Shipping** only when you actually authorise merging. The playbook independently verifies each PR against its current patch and only lands the contiguous verified portion of a stack.

### Review example

```text
/interrogate this branch against main.
The intended change is to reject duplicate event IDs without changing
existing delivery order. Focus on correctness and regressions.
Do not edit code yet. Show dismissed findings with reasons.
```

### Babysit example

```text
/workflow check PR 123 and tell me what remains before merge.
Do not push, rebase or merge.
```

For active maintenance:

```text
/workflow babysit PR 123 until merge-ready.
Resolve genuine review findings and CI failures.
Do not merge.
```

For landing, use a separate, explicit prompt:

```text
/workflow land the verified stack, bottom-up.
Do not deploy. Stop on any failed or stale verification verdict.
```

The stack's approach to comments is unusually aggressive. `/no-comments` tries to remove comments that can be replaced by code, types or checks. It may be useful for a team with a strong minimal-comment policy; it is not a universal substitute for good explanatory comments about external protocols, constraints and non-obvious decisions.

## Guide 9. Parallel work and unattended runs

**Situation:** a task is large enough that one agent is no longer the obvious execution unit.

There are three different shapes of parallel work:

| Shape | Use | Why |
| --- | --- | --- |
| Several attempts at **the same brief** | `/arena` | You need competition, selection and synthesis of an artifact. |
| Independent checks or slices | `/swarm` | You need breadth, not a winning design. |
| Many PRs over time | **Autopilot-stack** or **Orchestrate** playbooks | You need ownership, state, handovers and verification across a programme. |

A `/swarm` worker gets one standalone brief with scope, exact commit/branch where necessary, expected evidence and a `PASS`, `ISSUES` or `BLOCKED` report. The parent combines results into one table. The file and process environments must not collide. It uses cloud workers by default; local work needs isolation.

### Example: audit every package

```text
/swarm audit packages/* for undocumented public entry points.
One worker per package. Each worker must provide actual exported
symbols, file locations and a PASS/ISSUES/BLOCKED verdict.
Do not edit code. Aggregate the gaps in one report.
```

### Example: a long migration you will review later

```text
/workflow prepare the migration of all consumers to the new parser.
Use a separate worktree per independently writable unit.
Done means no imports of the old API, the old API deleted, fixtures
equivalent, and all tests passing.
Keep /show-me-your-work decision records.
Do not merge or deploy. Stop at a reviewable PR stack.
```

[`/show-me-your-work`](show-me-your-work/SKILL.md) records decisions in a TSV: timestamp, phase, decision, reason, evidence pointer and result. This is useful when an agent has worked across several hours or PRs. It does not replace the commit history or runtime checks; it tells a reviewer where to look.

### Which long-running route?

- **Autonomous run** handles one task with one checkable exit condition. Cursor's built-in `/loop` provides the wake-up mechanism.
- [`/figure-it-out`](figure-it-out/SKILL.md) designs a bespoke auditable run when no standard playbook fits, often for cross-cutting migrations.
- **Autopilot-stack** builds a linear stack of PRs and stops short of merging. Prefer it as the first unattended multi-PR workflow.
- **Autopilot-full** builds and merges independent PRs with verification gates. This requires explicit authority and trust in the verification system.
- **Orchestrate** is for a standing, multi-day programme where a coordinator delegates numerous PRs. It is excessive for an ordinary feature.

Unattended work needs a checkable finish condition, adequate isolation, a durable log and a stopping policy. A time budget such as 'work on it overnight' is not itself a completion test. Before granting merge authority, prove the harness and smaller workflow while supervised.

## Guide 10. Improve the repository and the skills over time

**Situation:** agents can write code, but you keep issuing the same corrections or dealing with the same failure modes. The operating model for that work is [`.agents/rules/`](../../rules/) plus [`AGENTS.md`](../../../AGENTS.md). This guide is the workflow.

Three skills solve related but different problems:

| Symptom | Skill | Changes |
| --- | --- | --- |
| 'Agents repeatedly make the same coding mistake.' | [`/correct`](correct/SKILL.md) | Architecture, types, lint, CI and tests in the repository |
| 'This session taught us a durable lesson.' | [`/reflect`](reflect/SKILL.md) | Proposed edits to existing skills, with approval |
| 'I want my own preferred agent operating style.' | [`/automate-me`](automate-me/SKILL.md) | A personal `-mode` skill derived from prior usage |

### Procedure for repeated mistakes

1. Identify a **class** that has repeated, not one unfortunate example.
2. Run `/correct` with a clear description. It also inspects recent commits, review comments and reverts.
3. Prefer making the wrong path impossible: one public entry point, one owner for mutable state, discriminated types or a mechanical check.
4. Require evidence that the new check rejects a real previous mistake.
5. Keep an instruction-to-enforcement table so untested prose rules remain visible.

```text
/correct agents keep importing private modules instead of using the
package's public entry point. Find the repeated cases and enforce
the supported import boundary, preferably in lint or exports.
Demonstrate a former bad import failing the new check.
```

After a particularly informative session, use `/reflect` to capture **skill** improvements. It synthesises findings from several reviewers and asks for approval before editing skills. Do not use it for a one-off quirk. Use `/automate-me` if the missing contract is a persistent personal way of working rather than a repository invariant.

When changing a skill itself, the **Authoring a skill** and **Eval** playbooks help validate its metadata and assess whether the new instructions perform better on comparable tasks. Treat an eval verdict as evidence, not as an automatic guarantee of future behaviour.

---

## 4. The principles worth actually remembering

There are 24 standalone `principle-*` skills. They are best treated as policy underneath the workflows, not as 24 new commands to memorise. These are the most reusable ones:

| Principle | Invoke or mention it when | Concrete instruction |
| --- | --- | --- |
| [Model the Domain](principle-model-the-domain/SKILL.md) | Logic branches on repeated ad-hoc state | 'Represent this as a typed state machine, not three booleans.' |
| [Boundary Discipline](principle-boundary-discipline/SKILL.md) | Validation or adapters spread through internal code | 'Parse external input once at the entry point.' |
| [Type System Discipline](principle-type-system-discipline/SKILL.md) | The API permits invalid combinations | 'Make invalid states unrepresentable in the public type.' |
| [Make Operations Idempotent](principle-make-operations-idempotent/SKILL.md) | Retries or crashes could duplicate effects | 'A retry must converge on the same stored result.' |
| [Subtract Before You Add](principle-subtract-before-you-add/SKILL.md) | A proposed refactor adds more layers | 'Remove obsolete wrappers before adding another abstraction.' |
| [Separate Before Serialising Shared State](principle-separate-before-serializing-shared-state/SKILL.md) | Parallel agents or workers share files or keys | 'Give each worker a separate worktree and output namespace.' |
| [Test Behaviour, Not Implementation](principle-test-behavior-not-implementation/SKILL.md) | Tests mostly mock collaborators | 'Assert the result visible to the caller against a literal expected value.' |
| [Prove It Works](principle-prove-it-works/SKILL.md) | Someone declares done after build or typecheck | 'Run the real CLI command and show the persisted result.' |
| [Sequence Work into Verifiable Units](principle-sequence-verifiable-units/SKILL.md) | A large patch is hard to review | 'Split it into units, each independently checked.' |
| [Build the Lever](principle-build-the-lever/SKILL.md) | An agent repeats manual steps | 'Write a repeatable script and run it instead.' |

Most of the remaining principles refine the same ideas: choose smaller changes, avoid unnecessary layers, redesign when assumptions fail, protect the context window, interrogate measurements and encode lessons into executable structure. The other `principle-*` skills in this folder cover the rest.

For TypeScript-heavy repositories, [`/typescript-best-practices`](typescript-best-practices/SKILL.md) is a useful extra. It promotes discriminated unions, `unknown` at input boundaries, schema-derived types, exhaustive cases and stronger modelling only when it removes unsafe assumptions. Treat its individual style rules as engineering guidance to reconcile with existing project conventions.

## 5. Three complete workflows to copy

### A. An intermittent production defect

1. **Scope the defect, read-only:** `/workflow investigate why events duplicate after reconnect. Show the runtime path and any known regression history. Do not change code.`
2. **Fix from a reproduction:** `/workflow reproduce the duplicate on the local fixture, isolate the cause, then fix it. Use /tdd if the regression is cheap to express. Show before-and-after persisted event IDs. Do not merge.`
3. **Check indirect impact:** `/blast-radius the deduplication change. Prove its new key is compatible with the other event consumers.`
4. **Get independent review:** `/interrogate the branch against main. Review event ordering, retries and storage behaviour. Do not edit.`
5. **Finish the PR:** `/workflow open a focused PR with the failing-before and passing-after evidence.`

The final artifact is a PR accompanied by executable proof and a separate assessment of regressions. Notice that only the first step is read-only; the fix starts in a new task rather than leaking out of the investigation.

### B. A new library API

1. **Understand existing ownership:** `/how trace existing consumers of the configuration registry and show the current public API.`
2. **Settle the interface:** `/architect with checkpoint. Design a single-entry configuration API using typed input and output. Show two structural alternatives and caller examples. Do not implement yet.`
3. **Build after approval:** `/workflow implement the approved interface. Preserve old behaviour for supported callers. Verify the usage example as an actual program. Open a PR; do not merge.`
4. **Review:** `/interrogate the diff with emphasis on type contracts, callers and error handling.`
5. **Write docs:** `/technical-writing produce a short how-to for consumers and a separate reference for the public functions.`

The checkpoint is useful here because a public API is more expensive to change than an internal implementation. Do not pay the same design cost for a trivial private helper.

### C. A multi-package migration

1. **Discover:** `/how identify every package that reads the old message envelope and every externally visible representation.`
2. **Plan only:** `/workflow plan migration to the new envelope. Order packages by dependency, capture old fixture outputs, and create one verifiable PR per independent unit. Stop after the plan.`
3. **Run with isolation:** `/workflow execute the approved plan as an autopilot-stack. Separate writable worktrees, keep a decision log, require live verification, and do not merge.`
4. **Audit:** `/show-me-your-work summarise the decisions and evidence, then identify which PRs still need a human decision.`
5. **Land explicitly:** after reviewing the stack and its fresh verification, request `/workflow land the verified stack. Stop on any failed gate.`

The stack route keeps the operator in control of merging, unlike Autopilot-full. It is the safer default for the first few multi-agent migration runs.

---

## 6. Evaluation: what I would keep, change or ignore

### Start with this core

For day-to-day engineering, the strongest combination is:

`/workflow` + `/how` + `/architect` + `/tdd` where practical + `/create-verification-skill` + `/blast-radius` + `/interrogate` + `/correct`.

Add `/why` when historical context matters, `/arena` when the design space is genuinely open, `/benchmark-checklist` for performance, and `/swarm` when work partitions cleanly. This is a usable stack without learning every supporting skill.

### Use only when the situation warrants it

- **`/recall` and `/teach`:** useful for resuming context and learning, but not necessary for routine implementation.
- **`/figure-it-out` and `/show-me-your-work`:** valuable for long or unusual jobs; excessive for small PRs.
- **`/maintain-verification-skill`:** run after significant changes or on a cadence justified by feature-map churn; it performs a full live pass and is not free.
- **`/technical-writing` and `/unslop`:** useful for documentation and PRs; they do not substitute for a correctly implemented feature.
- **`/reflect` and `/automate-me`:** useful once you have observed stable patterns, not on day one.
- **`/no-comments`:** a deliberately strong house style. Opt in only if it aligns with your team's documentation conventions.

### Safe to set aside at first

- **Navigation-only upstream skills** (for example plugin help commands): not vendored here.
- **`/bro`:** a plain-language restatement command. Convenient, not essential to engineering.
- **`/make-bot-ui`:** a specific UI for waking a Grok Bot through webhooks and Tailscale. Not a general UI engineering skill.
- **The 24 standalone `principle-*` commands:** retain the rules that matter, but let `/workflow` load them or name a principle when correcting course.
- **Autopilot-full and Orchestrate:** powerful but operationally expensive. Adopt only after repeatable verification, branch isolation and authority boundaries are demonstrated.

### Four limitations to account for

**1. The default can be expensive.** `/architect` requires multiple designs through `/arena`, `/interrogate` normally launches multiple reviewers, and `/why` can search several connected systems. Use them at decisions where additional scrutiny is likely to change the result. A one-line edit rarely qualifies.

**2. Multi-model agreement is not empirical proof.** Two reviewers can share an error. Treat consensus as a prioritisation signal. The verification harness, fixture or runtime observation is still the proof.

**3. This skill set is not entirely self-contained.** The mode and playbooks refer to `/deslop`, `control-ui` and `control-cli` from the separate `cursor-team-kit` plugin. They also use Cursor-specific facilities such as `Task` subagents, cloud worktrees, Custom Modes and the built-in `/loop`. Other Agent Skills implementations may parse the files but not execute these workflows unchanged. Check your environment and substitute an existing project harness where appropriate.

**4. Autonomy needs a local policy.** The playbooks encourage progress without frequent human questions. That is appropriate for reversible work in an isolated checkout. Define separate gates for deployment, data deletion, external communications, force-push and merging. An agent's ability to perform an action is not permission to perform it.

## 7. Short decision reference

| Your immediate question | Use |
| --- | --- |
| 'What does this system do?' | `/how` |
| 'Why is it designed that way?' | `/why` |
| 'Where did we leave off?' | `/recall` |
| 'Should we settle the interface first?' | `/architect with checkpoint` |
| 'Which of these several designs is best?' | `/arena` or the Prototype playbook |
| 'Fix this reproducible defect.' | `/workflow` Bug fix, `/tdd` if cheap |
| 'Restructure, but preserve behaviour.' | `/workflow` Refactoring |
| 'What else could this small change break?' | `/blast-radius` |
| 'Can independent reviewers challenge this diff?' | `/interrogate` |
| 'Can an agent check the real app itself?' | `/create-verification-skill` |
| 'Is the claimed 30% improvement real?' | `/benchmark-checklist` |
| 'Check every independent package.' | `/swarm` |
| 'Make this PR merge-ready.' | `/workflow` Babysit |
| 'Merge the verified stack.' | `/workflow` Shipping |
| 'Give me a reviewable overnight run.' | `/workflow` Autonomous run or Autopilot-stack, plus `/show-me-your-work` |
| 'Stop agents repeating the same mistake.' | `/correct` |

## Source material

These skills were adapted from the upstream Cursor [pstack](https://github.com/cursor/plugins/tree/main/pstack/skills) plugin and maintained in [`.agents/skills/workflow/`](.), especially [`SKILL.md`](SKILL.md) and the [23 playbooks](playbooks/). The ranking and recommendations in this README are engineering guidance for this repository, not upstream plugin policy.

For branch or diff review, use [`/interrogate`](interrogate/SKILL.md). For verification gates, run **`npm run check`** (see root [`AGENTS.md`](../../../AGENTS.md) and [`.agents/rules/verification-and-evidence.md`](../../rules/verification-and-evidence.md)).
