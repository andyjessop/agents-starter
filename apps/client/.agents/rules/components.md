# Component organisation

Organise by **business ownership first**, not component size or current appearance. Component levels describe responsibilities; they are not global folders. Do not create app-wide `widgets/`, `layouts/` or page-component directories alongside `modules/`.

## What goes where

- **Primitives** — generic controls, surfaces, tables, badges and overlay mechanics belong to `packages/design-system` (`@agent-starter/design-system`). Reuse its existing components. Keep business data, permissions and workflow rules out of the library.
- **Shared presentation patterns** — repeated compositions such as `PageHeader`, `EmptyState` and `WorkflowFrame` belong to `src/shared/components/`. They receive values, content slots and callbacks; they must not import business modules or select domain state.
- **Domain components** — small pieces with business meaning, such as `NodeletIdentity`, `BindingStatus` and `GrantSummary`, belong to the owning module's React side. Sharing across modules does not move them into `shared/`.
- **Widgets and workflows** — coherent regions or operations, such as `NodeletCapabilities`, `BridgePairing` and `AddThingWorkflow`, also belong to their owning module. Redux owns their data, decisions and meaningful state; React subscribes narrowly, renders and dispatches intents.
- **Layouts** — own placement, responsive regions and navigation presentation. `Shell` belongs to `shell`; detail workspace layouts belong to the owning feature module. Accept content/action slots rather than embedding another module's business rules.
- **Pages** — compose layouts and widgets for one route. Keep them in the owning module's React side, with one real screen per file and static registration in `src/pages.ts`.

Follow [modules.md](modules.md) for the `redux.ts` / `react.tsx` split and when to introduce folders. Small private components may share a file. Do not create a file, folder or module for every visual fragment.

## Standalone state panels

`EmptyState`, `UnavailableState` and `ErrorState` own their surface, border, spacing and content layout. Render them as standalone panels; never nest them inside a card, bordered panel or table wrapper. Borderless layout containers and section headers may surround them. Put the subject in the state's heading when removing an outer card heading so the panel remains understandable on its own.

Place `AsyncRegion` outside the card or table wrapper for loaded content, so its empty and error branches replace the whole surface. Keep unavailable states muted grey and distinguish states through wording and icons as well as colour.

## Business ownership (starter)

Grow modules as you add product surfaces. The starter ships:

- `auth`: sign-in and account creation presentation.
- `session`: workspace load and account menu.
- `navigation`: route admission, recovery and shell routing state.
- `live`: RTK Query live client, scopes and subscription wiring.
- `home`: default signed-in landing (demo catalogue).
- `shell`: application chrome, navigation rail and viewport.
- `theme`: appearance and named visual packs (presentation preferences, not authority).
- `debug`: Redux recorder and developer tooling (development only).

Add new modules for new routes rather than overloading `home`.

## Sharing and imports

Default to private. Expose a component when a concrete consumer needs the same meaning and a small, clear contract. Similar markup alone is insufficient; avoid abstractions with unrelated mode flags. A substantial workflow can justify a boundary even with one consumer.

Cross-module consumers use explicit public contracts: `public.ts` for actions/selectors/types and focused React entry files for reusable UI. Never reach into another module's private Redux state or implementation files. Do not collect pages into a barrel that other modules import for side effects.

Keep dependencies directional: shell may compose feature modules; feature modules must not import shell internals. Detail composition may consume related read contracts through slots. Shared presentation and the API base must not import business modules.

## Boundaries that must survive a redesign

- Share widgets that show a specific resource using an **explicit resource ID**. The page decides which resource to show; the widget must not silently select “the latest”.
- Pass **captured values** for historical rows (activity, prior revisions, frozen membership). Never resolve historical identity from mutable current catalogue state.
- Reuse badge styling, not status policy: reachability, permission, compatibility, observation age and operation evidence are distinct contracts (see root UX rules).
- Reuse workflow state/actions and fields across dialogs, drawers and full pages. The visual host must not own submission or eligibility rules. Use supported API capabilities; do not turn demo simulations into business rules.
- Keep list columns/actions in their business module; share table mechanics. Subscribe by stable IDs and narrow fields rather than passing a whole aggregate through the page.
- Keep appearance in scoped styles and design tokens under [styling.md](styling.md). A change from tabs to a menu, cards to a list, or a dialog to a page should not require moving domain ownership or duplicating Redux logic.
