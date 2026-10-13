# Navigation admission

Route admission runs in `src/modules/navigation/admit.ts` before the router commits. It may load session state and wait on **catalogue** live scopes. Detail-only live queries belong on pages, not in admission.

## Resource table (starter)

| Route | Admission waits on | Do not wait on |
| --- | --- | --- |
| Auth routes (`signIn`, `createAccount`, …) | Session load only when redirecting signed-in users | Live scopes |
| `entry` | Session load | Live scopes |
| Protected routes (e.g. `home`) | Signed-in session; for `home`, `liveDemoCatalogue` catalogue readiness | Detail-only scopes |
| Unknown URL | — | — (settle as not found) |

## Rules

- Use `waitForLiveQuery` against list or catalogue endpoints (for example `liveDemoCatalogue`) when the route needs catalogue membership or list evidence.
- Use `liveSession` only when admission genuinely depends on session live state, not for page-only rendering.
- Settle navigation with qualitative copy via `navigationSettled`; recovery actions must match the route (see `errors.md` and `navigation/react.tsx`).

## Anti-patterns

- Waiting on a detail-only live endpoint when a catalogue query can admit the route.
- Blocking auth routes on live subscriptions.

Lint: `scripts/check-navigation-admission.mjs` (run via client `npm run lint` when wired).
