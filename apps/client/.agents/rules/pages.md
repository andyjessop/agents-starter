# Pages

Each route name renders one page. The route tree stays data only. Do not hang components on `route()`.

`src/pages.ts` maps every `RouteName` to a page component via a static import. `App` selects `selectRouteName` and renders that page. Pages ship in the single app chunk with the rest of the product code; stable libs are split and module-preloaded separately.

Workspace or detail layouts that must stay mounted across nested routes belong in `App` (or a shell-owned layout). Only swap the inner page. Do not wrap those pages in the layout again.

One screen per file. Nested names may reuse the root module page until that screen has its own file.
