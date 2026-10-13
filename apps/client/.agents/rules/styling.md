# Styling

Always use values from the design system wherever available.

Every value that expresses a product design choice must be a CSS custom property. This includes colours, typography, spacing, dimensions, borders, radii, shadows, icon treatment, motion and stacking order. Consume an existing public `--ui-*` token when its meaning fits; do not copy its current literal value or borrow an unrelated token just because its value matches.

Read the [theme contract](../../../../packages/design-system/src/styles/theme.css) and [theme guidance](../../../../packages/design-system/docs/theme.md) before adding styling. Import `@agent-starter/design-system/theme.css` before application styles when the design-system entry point has not already loaded it.

Put product styles and custom properties in `@layer app`, the design system's designated product override layer. Do not put product choices in `ui.tokens`, `ui.components` or `ui.preferences`, or bypass the layer order with unlayered CSS or `!important`.

Named visual packs live in `src/modules/theme/themes/` under `@layer themes`. That layer is declared after `app` in the design-system layer order, so packs beat ordinary `@layer app` module CSS as well as design-system primitives. Do not nest packs as `app.themes`: direct `@layer app` rules outrank nested layers. Each pack sets both `*-light` and `*-dark` inputs on `:root[data-app-theme='…']`; Light / Dark / System (`data-ui-theme`) still picks via `light-dark()`. Register new packs in `app-theme.tsx` and import the CSS from `themes/index.css`.

For a choice without a suitable design-system token, declare a descriptive, module-prefixed property such as `--shell-rail-width` on the owning module root and consume it with `var()`. Prefer defaults derived from design-system tokens; keep unavoidable product literals in these declarations. Shared application choices belong at an application scope. Do not add product-specific tokens to the library or use its private `--_ui-*` properties.

```css
@layer app {
    .shell {
        --shell-rail-width: 3.5rem;
        color: var(--ui-text);
    }
    .shell-sidebar {
        width: var(--shell-rail-width);
        background: var(--ui-surface);
    }
}
```

Use documented `--ui-<component>-*` hooks for design-system component overrides at the consuming scope. Leave optional hooks unset otherwise; never initialise them globally to aliases, which freezes their fallbacks. Change primitive palette, spacing or density inputs at an explicit `data-ui-scope`, `data-ui-theme` or `data-ui-density` boundary so derived tokens recompute. CSS aliases resolve where declared: declare or repeat product aliases at the scope where their inputs change. Keep preference tokens effective, including reduced motion and increased contrast.

Do not set CSS custom properties (or any product styling) through React `style={{ … }}`. Declare the property on a class in `@layer app` and apply that class. Inline style is reserved for measured or runtime-only values that cannot be expressed in CSS (for example pointer coordinates). Prefer a named class even when overriding a single `--ui-*` hook such as `--ui-stack-gap`.

```css
@layer app {
    .app-section {
        --ui-stack-gap: var(--ui-space-4);
    }
}
```

```tsx
{/* correct */}
<Stack className="app-section" />

{/* forbidden */}
<Stack style={{ "--ui-stack-gap": "var(--ui-space-4)" }} />
```

`npm run lint` in this package runs `scripts/check-no-inline-theme-style.mjs`, which fails when TSX under `src/` assigns custom properties via `style`. See root `AGENTS.md` **Agent mistake enforcement** for the full lint script list.

Structural mechanics may stay literal: `display: flex`, `position: fixed`, `auto`, zero resets, full-size percentages and offscreen transforms. State, SVG path geometry, measured coordinates and breakpoint conditions are not theme tokens; keep them in their owning behaviour or structure. This exception does not cover visually chosen sizes, spacing or stacking levels.
