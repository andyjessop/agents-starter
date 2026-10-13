---
id: product-and-developer-experience
description: User-visible behaviour and local developer experience for the starter client.
---
# Product and developer experience

Scope: user-visible behaviour and integration usability. Client implementation patterns belong to [`frontend.md`](frontend.md) and `apps/client/.agents/rules/`.

- Copy and empty states should read as a coherent product, even when backed by mock data. Avoid leaking implementation identifiers in user-facing text.
- Distinguish signed-out, loading, error and ready states. User-visible error text must be plain language; never show raw codes or socket labels (see [`frontend.md`](frontend.md) and `apps/client/.agents/rules/errors.md`).
- Local development is first-class. **`npm run dev`** starts the client with the Vite mock API. Document any extra services you add; do not assume Docker or external backends for the default loop.
- Consume `@agent-starter/design-system` and client frontend rules rather than inventing a parallel UI kit.

Review evidence: specific user journey, observed interruption or error, and expected recovery.
