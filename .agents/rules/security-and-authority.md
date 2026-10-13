---
id: security-and-authority
description: Browser session boundaries and safe defaults for the starter client.
---
# Security and authority

Scope: what the client must not do with credentials and session data. This starter uses mock auth in development; replace with your real model when you wire a backend.

- Do not commit secrets, API keys or live session tokens to the repository. Use environment variables and local-only files ignored by git.
- Do not log credentials, reset tokens or live subscription payloads in client debug tooling intended for export.
- Treat Redux session state as a cache of server truth, not a permission source. Route guards may redirect unauthenticated users; they do not replace server-side authorisation when you add a real API.
- The Vite mock API is for local development only. Do not deploy it as a production auth or live service without hardening.

Review evidence: name the secret or authority leak, the exposure path, and the concrete fix.
