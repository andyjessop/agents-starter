# Tables

Apply these rules to every data table in `apps/client`. Prefer consistency over one-off layout choices.

## Row density

Prefer a **single visual row** per table row when the cell content is a primary value with a short secondary fact.

- Put primary and secondary values on one line when that stays readable: primary first, then muted secondary.
- Put secondary facts inline with a separator (`·`) or muted trailing text when they fit on one line.
- Prefer an inline flex row for symbol + name when those belong on one line.

**Stacked (two-line) cells are allowed** when a column intentionally carries two layers of information that do not read well inline. Use them deliberately, not by default.

- Stack with a small vertical gap. Put the primary or result line first, then the secondary or status line underneath.
- Keep the secondary line smaller and lighter when it is supporting detail (for example “as of”, identifier under name, status under result).
- Do not mix stacked and inline treatments for the same kind of fact across one table without a reason.

## Alignment

- **Text** columns: left-aligned (default).
- **Numeric** columns: right-aligned via `data-numeric` on both `<th>` and `<td>` (counts, quantities, money).
- **Actions** columns: always last, always right-aligned with a shared actions cell class on the header and cells.

## Action buttons

Row actions in tables should be **icon-only**, bordered, and visually identical across tables.

- Use design-system `Button` with `className="ui-icon-button"`, `variant="outline"`, and a clear `aria-label`.
- Prefer shared glyphs from a app-owned shared table-glyphs module once established (refresh/retry, remove/delete, cancel, add, download, open/view, run/play). Until that module exists, keep glyphs local to the owning module and extract on the second consumer.
- Dangerous actions use `tone="danger"`.
- Wrap multiple actions in an inline flex container inside the actions cell so they stay right-aligned.
- Do not mix ghost (borderless) icon buttons with outline icon buttons in table action columns.
- Navigation row actions (for example open) use the same outline icon-button pattern; do not leave a text “Open” link in the actions column.

### Copy actions (exception)

Copy controls are the known **non-bordered** icon controls in tables. They are lighter in-cell affordances, not Actions-column buttons.

- Wrap copyable monospace values in design-system `CopyableCode` (copy control sits inside the code surface). Use bare `CopyButton` only when there is no code-like container.
- Place it inline with the copied value (for example a shortened identifier), not in the Actions column.

## Shared shell

- Prefer design-system `Table` (or a console `CollectionView` wrapper once established) for server-cursor and other remotely paged lists.
- Use design-system `DataTable` only for bounded in-memory sets the client already holds; it is not the default for catalogue or other cursor-paged collections.
- Keep column meaning in the owning module; share geometry and action styling only.
- Mark the Actions header with the shared actions class so alignment stays consistent.
