# High-contrast application theme

The foundation combines compact structure (Linear-inspired), Vercel-style contrast, and Clerk-style surface separation. Existing public token names and scope semantics remain unchanged.

## Foundation

- Typography: Inter when supplied by the host, otherwise native sans-serif. Body 14px, controls 13px, metadata 12px, section titles 15px, page titles 20px. Use tabular numerals for comparisons and monospace for identifiers.
- Light surfaces: white canvas and surface, `#f3f3f5` secondary surfaces. Text `#161618`, secondary `#4b4b52`, metadata `#65656e`. Dividers `#d6d6dc`, stronger controls `#9696a0`.
- Dark surfaces: `#0c0c0d` canvas, `#141416` secondary surface, `#151517` panels and `#242427` floating surfaces. Text `#fafafa`, secondary `#c5c5cc`, metadata `#a2a2ac`. Dividers `#34343b`, stronger controls `#686873`.
- Blue is the primary interaction accent: `#3e63dd` in light and `#9cb4ff` in dark. Green, amber and rose communicate status; categorical chart colours do not imply severity.
- Hover uses a 5% neutral text wash; selection uses 13% and remains distinguishable after the pointer leaves. Navigation adds weight and a structural indicator.
- Spacing retains the 4px base, with independent density settings. Controls have a 32px minimum visual height; coarse-pointer controls retain the 44px target minimum. Density never scales type or touch targets.
- Corners remain 4px for small elements, 6px for controls and 8px for panels/popups. Static working regions use flat separators. Floating menus and dialogs retain shadows.
- Charts retain the shared renderer, categorical palette and accessible data tables. Theme and system-colour changes redraw the canvas without remounting workflows.

## Application composition

Host applications own layout chrome. All product styling lives in `@layer app` and consumes public semantic tokens. Application styles do not introduce a parallel palette. Product dimensions without a shared role use scoped module properties. Named visual packs live in the host under `@layer themes` so they can override module CSS.

## Scope and component contract

Primitive inputs and derived families remain separate. Aliases re-evaluate at `:root`, `data-ui-scope`, `data-ui-theme` and `data-ui-density`. Override palette and spacing inputs at those boundaries. Optional `--ui-<component>-*` hooks remain undeclared until a consumer needs an override. Never consume private `--_ui-*` properties in product CSS.

The chart's `--ui-chart-*` dimensions and palette are consumed by CSS and its canvas adapter; `--ui-line-chart-*` remains the per-chart override surface. Stylesheet-rule changes outside observed theme, density, class and style boundaries require a chart remount.

## Appearance and accessibility

Hosts typically expose Light, Dark and System. The browser restores `agent-starter-appearance` (or your chosen storage key) before React mounts. System uses the existing `data-ui-theme="auto"` contract and follows the operating system without a separate theme implementation. Blocked storage keeps the choice for the current page. This browser preference adapter is separate from the domain store.

Focus uses a visible outline. Status retains readable labels and icons. Increased contrast, forced colours, reduced motion and native overlay dismissal remain supported.
