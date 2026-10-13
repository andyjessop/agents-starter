# User-facing errors

Required for every error path that can appear in the app UI (route outcomes, alerts, form feedback, switch notices, empty-state failure copy).

## Invariants

1. **Never show implementation labels.** Socket codes (`LIVE_*`), HTTP/problem codes (`REQUEST_FAILED`), lowercase auth tokens (`unauthenticated`), and similar machine detail must not appear in UI copy.
2. **Map at the Redux boundary.** Use `appFailure(error, fallback)` for HTTP and RTK Query mutations. Route admission uses `resolveLiveAdmissionFailure` (qualitative copy, 401/403/404 semantics). Page-level live failures may use `liveQueryFailureMessage(result, fallback)`. Pass a **specific, qualitative fallback** per journey (load vs rename vs revoke), not a generic code.
3. **Single normaliser.** `userFacingDetail` in `src/user-facing-error.ts` is the allow/deny gate. `navigationSettled` runs every route message through it. Do not pass `error.message`, RTK `error.data`, or thrown strings straight into slice state, navigation messages, or React props.
4. **Request IDs are supplementary.** When UX-02 requires a recovery reference, show `requestId` beside human copy (existing slice fields). Do not replace the sentence with the id or code.
5. **Tests assert copy, not codes.** Store integration tests that simulate failure must expect the qualitative message operators see, not the internal label used in fakes or clients.
6. **404 is not a load error.** Live WebSocket close `4004` (and HTTP `404`) mean the scoped resource is gone. Route admission must settle `not-found` with resource-specific copy via `resolveLiveAdmissionFailure`, not `error` with “could not be loaded”.
7. **Catalogue vs detail at admission.** When a catalogue live scope exists, admission `not-found` / redirect means the id is **missing from the ready list**, not a failed detail socket. Detail-only 404/gone after catalogue membership is **page-ready** (see [navigation-admission.md](navigation-admission.md)).

## Checklist before merge

- [ ] Every new `rejectWithValue`, `state.error =`, and `navigation.message` path runs through `appFailure` or `liveQueryFailureMessage`.
- [ ] Fakes and harness helpers may keep internal labels; assertions on UI state must not.
- [ ] A unit or store test covers at least one newly introduced failure path with the expected user-facing string.
