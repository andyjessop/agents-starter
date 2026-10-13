---
id: state-machines-and-concurrency
description: Explicit lifecycle transitions, fencing, retries and remote-state safety.
---
# State machines and concurrency

Scope: transition legality, ownership, liveness and effect permission. Storage atomicity belongs to [`persistence-and-recovery.md`](persistence-and-recovery.md); evidence quality to [`testing-and-fixtures.md`](testing-and-fixtures.md).

- Every important lifecycle uses the owning machine in `implementation/contracts/state-machines.json` and supplement section 10. Add a missing machine/transition to the contract before implementing it. No parallel lifecycle expressed through scattered status assignments or competing booleans.
- Use a pure transition function returning rejection or next state plus durable effect intents. Verify current state, command/event identity, expected version, tenant generation and runner/session fence. Reject unlisted transitions; distinguish duplicate no-ops from invalid commands.
- Source mutation permission follows one unique durable attempt commit. Never call a Thing from a generic state-entry hook, alarm, outbox replay, reconnect handler or status query. A crash or timeout after possible dispatch yields uncertainty, not permission to resend.
- `uncertain` can acquire late final evidence for the same attempt/binding, not a new attempt. A later property read or operator opinion is not proof of an earlier physical result. Preserve earlier evidence when appending a resolution.
- Persist deadlines and carry their expected version into timeout events. Evaluate expiry at admission as well as alarms. Stale timers, old sessions and reconstructed runners cannot cancel newer work, expire renewed authority or activate retired mappings.
- Respect bounded concurrency and explicit no-queue behaviour. Fence before releasing an unused reservation. An uncertain but settled attempt releases concurrency as specified; no TTL may refund committed usage or revive execution. Block revision switches while a live read or mutation exists.
- Cross-object workflows are durable, idempotent sagas. After a lost response, query/retry the same management identity; compensate only when an authoritative participant proves it safe. Never assume a network timeout means the remote commit failed.
- Include all valid transitions, guard failures, illegal transitions, duplicates, reordering, concurrent writers and crash boundaries in model-based coverage. Cover liveness/recovery as well as safety: accepted management work must reconcile or expose a diagnosable blocked state.

- The shared transition store checks the exact machine/from/event/to tuple against the contract before committing an owner reducer’s decision. The owner still evaluates domain guards; the store cannot turn an unlisted edge into a legal one. Harness cases select the actual machine, assert zero effects for denials/faults and one effect for a successful command plus duplicate replay.

Review evidence: state/event sequence, competing actors, durable boundary and incorrect outcome. A generic “possible race” is insufficient. Do not change the machine to legitimise a bug without a visible specification decision.
