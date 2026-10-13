---
id: testing-and-fixtures
description: What tests must prove and how fixtures support that.
---
# Testing and fixtures

Scope: whether tests establish behaviour. Running commands and reporting evidence belongs to [`verification-and-evidence.md`](verification-and-evidence.md). Client store harness tests are specified under [`frontend.md`](frontend.md) and `apps/client/.agents/rules/testing.md`.

- Tests must falsify meaningful behaviour. Assert outcomes a user or integrator would care about, not implementation trivia or mock call counts in isolation.
- Keep unit tests close to the code they protect. Shared packages use Node test runners as declared in their `package.json`. The client uses Vitest.
- Prefer real production modules in store integration tests when a harness exists: real store, real router, HTTP mocked at the client boundary.
- Do not substitute a green unit suite for missing coverage of a changed public contract when a harness already exists for that layer.
- Fixture data should be minimal and explicit. Avoid copying large production dumps into tests unless the case requires it.

Review evidence: name the behaviour that remains unproven and the smallest test that would prove or disprove it.
