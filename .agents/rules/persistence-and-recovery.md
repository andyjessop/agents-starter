---
id: persistence-and-recovery
description: Client-side persistence boundaries for the starter scaffold.
---
# Persistence and recovery

Scope: what the starter persists in the browser and how to recover safely. Server persistence is out of scope until you add a backend.

- Prefer server authority for durable business state. Redux and RTK Query caches are ephemeral; treat refresh as lossy unless you add rehydration deliberately.
- `localStorage` keys for shell, theme and debug tooling must be namespaced (`agent-starter-*`) and must not store secrets or live tokens.
- Navigation and session recovery should settle to a qualitative route outcome (signed out, error, ready) rather than leaving the router in an ambiguous half-admitted state.
- When adding offline or optimistic flows, document what happens on reload and how conflicts resolve.

Review evidence: name the data that could be lost, leaked, or duplicated across reloads or retries.
