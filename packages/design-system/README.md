# @agent-starter/design-system

CSS-first UI library for Agent Starter apps. Native HTML covers ordinary controls; small TypeScript controllers implement menus, tabs, tooltips, comboboxes, native overlays and notifications. React attaches those controllers directly. Optional light-DOM custom elements use the same behaviours. No Base UI runtime remains in this library.

This package is internal to the monorepo. Dependencies are hoisted at the workspace root.

## Imports

```tsx
import { Theme, Button, TextField } from '@agent-starter/design-system';
import { Menu } from '@agent-starter/design-system/react/menu';
import { Combobox } from '@agent-starter/design-system/react/combobox';
import { Tree, TreeItem } from '@agent-starter/design-system/react/tree';
```

The root entry includes all component CSS and the theme. Selective imports can load styles explicitly:

```ts
import '@agent-starter/design-system/theme.css';
import '@agent-starter/design-system/components.css';
import { attachMenu } from '@agent-starter/design-system/behaviours/menu';
import '@agent-starter/design-system/elements/menu';
```

`/styles.css` includes theme and component styles. `/advanced` retains the narrow menu, combobox, tabs, tooltip and toast APIs. `/extra` contains optional application compositions with documented limits. Do not deep-import `src/`.

## Theme and native controls

`theme.css` supplies the high-contrast application foundation: near-black and white working surfaces, distinct navigation, blue actions, compact controls and restrained status colours. Dark is the default; light, dark and auto scopes have coordinated neutral palettes. Inter is preferred when supplied by the host, with native system fonts as fallbacks and no mandatory download. See the [theme contract](docs/theme.md) for the palette and application rationale. `Theme` is a scoped div, not a JavaScript provider. Equivalent HTML uses `data-ui-theme="light|dark|auto"`, `data-ui-density="compact|comfortable|spacious"`, and `data-ui-scope`. Component overrides stay unset until consumed, with CSS fallbacks. Top-layer surfaces remain descendants of their local theme.

The optional interface-standard pack is shared across client apps:

```ts
import '@agent-starter/design-system/theme.css';
import '@agent-starter/design-system/themes/default.css';
// <html data-app-theme="default" data-ui-theme="dark">
```

It encodes the Country editorial identity: sage-green signal, warm paper surfaces, serif editorial type, modest radii, parchment cards and compact table registers. Host-only visual packs still live in the host application.

Native inputs, select, number, checkbox, radio, switch, single-range slider and whole-step rating retain browser semantics and form submission. Buttons default to `type="button"`; opt into submit/reset. Typography, layout, cards, lists, tables and navigation remain semantic markup. Application code owns data, URLs, workflow and deletion actions.

## Standalone state panels

`Empty` owns its surface, border, spacing, icon, heading, description and optional action. Empty, unavailable and error compositions built from it must stand alone: do not wrap them in another card, bordered panel or table container. Borderless layout wrappers and section headers are fine. Include the subject in the state heading rather than retaining an outer card just to label it.

When content loads asynchronously, render its card or table container only in the content branch; the state panel replaces that entire surface. Use the same structure for each state, with wording, icons and colour distinguishing their meaning. Unavailable states use a muted grey surface; retain readable text and usable actions rather than disabling the whole panel.

## State and behaviour

```tsx
<Menu label="Actions"
  items={[{id:'rename',label:'Rename'},{id:'archive',label:'Archive',disabled:true}]}
  onAction={id => runAction(id)} />

<Combobox label="Country" name="country"
  value={country} inputValue={query} options={filteredCountries}
  onValueChange={({value,label}) => {setCountry(value);setQuery(label);}}
  onInputValueChange={({value}) => setQuery(value)} />
```

Combobox options are `{value:string,label:string,disabled?:boolean}`. The application filters them. Controlled selection changes only when the host supplies a new value; input text is independently controlled. Uncontrolled fields use defaults. Tabs default to manual activation. Dialog/popover visibility belongs to the browser: use `defaultOpen`, `onOpenChange` and imperative `show()`/`hide()`, not controlled `open`. Pass the invoking element to dialog `show(event.currentTarget)` for Safari pointer-focus restoration.

Controllers require connected, complete markup and return `update(options)`, `refresh()` and idempotent `destroy()`. Direct consumers destroy before removing roots. React handles lifecycle automatically, including Strict Mode. `Tree` provides controlled expansion and selection requests, roving keyboard focus and stylable light-DOM rows. Element entries are browser-only, explicitly register one tag, wait for children, and clean up on disconnect. React and behaviour entries have no top-level DOM access or registration.

`createToastStore()` creates an isolated notification store. Render it through `ToastViewport`, or render an element store's snapshots in host code. Ordinary messages default to five seconds; errors/actions persist. Hover, focus and hidden documents pause remaining time. The store owner calls `destroy()`.

See [contracts](docs/contracts.md) for exact parts, attributes, options, callbacks, element events and unsupported behaviour; [migration](docs/migration.md) and the [export inventory](docs/migration-manifest.json) explain the breaking changes. Rich Base UI composition, multiselect, multithumb sliders, menubars and rich formatting are unavailable rather than silently approximated.

## Result charts

`LineChart` and `BarChart` from `@agent-starter/design-system/react/line-chart` use the same uPlot host, palette and live legend. `BarChart` accepts categorical `data: { label, value }[]` and a `categoryLabel`; its value scale includes zero. Both expose an expandable semantic data table. Use `formatYTick` for compact axis labels while keeping `formatY` precise for the legend and data table. Bar width may be adjusted with `--ui-bar-chart-width` (fraction of category spacing, default 0.6) and `--ui-bar-chart-max-size` (default 3rem); no application data belongs in these properties.

## Verification

```sh
npm run lint --workspace=@agent-starter/design-system
npm run typecheck --workspace=@agent-starter/design-system
npm run test --workspace=@agent-starter/design-system
```

Browser contract tests (Chromium / Firefox / WebKit) are deferred until the Vitest browser provider is wired for this package. Specs remain under `src/`.
