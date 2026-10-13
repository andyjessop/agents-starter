# Working on design-system

Read README.md and src/styles/theme.css before editing.

This package owns shared primitives and the public `--ui-*` theme contract. Application composition, module ownership, client styling layers (`@layer app` / `@layer themes`) and Redux-first feature work are owned by root `.agents/rules/frontend.md` and `apps/client/.agents/rules/`. Do not restate those procedures here, and do not add product-specific tokens or workflows to this library.

Two packs ship with the starter: `./themes/macchiato.css` (Catppuccin Macchiato) and `./themes/default.css` (Default pack). Host-only packs live in `apps/client/src/modules/theme/themes/`.

- Keep the native entry independent of Base UI.
- Use native semantics and APIs when their contract fits.
- Keep application data and state outside CSS. Keep design configuration in custom properties.
- Do not alter theme.css casually: its scope/alias rules are a public contract.
- Use British English and document limitations directly.
- Do not add dependencies without a concrete behaviour requirement.
- This library is internal to the monorepo. Use the package.json exports map and the root lockfile; do not deep-import `src/`.

```sh
npm run lint --workspace=@agent-starter/design-system
npm run typecheck --workspace=@agent-starter/design-system
npm run test --workspace=@agent-starter/design-system
```
