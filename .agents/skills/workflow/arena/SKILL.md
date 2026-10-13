---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Fan out N parallel attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Graft the best ideas from the others into it. Verify the synthesized result.

Use independent workers for candidates (`arena-runner` role). Prefer diversity across workers for judgment-sensitive tasks.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

The N candidates will receive the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. The rubric is the picker's tool in Phase D. Candidates only see the task.
3. Choose N runners. Use at least two distinct perspectives when the task is design-sensitive. Use more runners when the arena covers multiple design directions.
4. Assign output paths. Each candidate writes to its own location (a git worktree where possible, otherwise separate directories), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Launch all N workers concurrently, each with the task, the path to the shared grounding, its own output path, and instructions to produce both the artifact and a short rationale.

Each rationale names the alternatives the candidate considered and what it rejected.

If a candidate fails to produce output, proceed with N-1 and note the dropout in the synthesis record.

## Phase C: Cross-judge

After all Phase B candidates complete, spawn one read-only judge worker (`cross-judge` role) when the harness supports it. Prefer a perspective independent from the parent. The judge sees the rubric and the candidates by path label, scores each criterion, and recommends a base with rationale. It may run in parallel with the parent's reading in Phase D. Do not start the judge while candidates are still writing.

## Phase D: Pick a base

Read every candidate end to end before picking.

Score each candidate against the rubric criterion by criterion, not on holistic feel. Compare against the cross-judge when present. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base on which candidate a future maintainer can extend most easily without breaking invariants. Prefer the cleaner boundary or smaller API when two feel tied, per the Laziness Protocol.

## Phase E: Graft

Merge the strongest ideas from non-base candidates into the base. Do not paste whole alternate implementations. Each graft names what changed and why.

## Phase F: Verify

Verify the synthesized artifact against the rubric and the task's done predicate. Record the synthesis decision for the parent thread.
