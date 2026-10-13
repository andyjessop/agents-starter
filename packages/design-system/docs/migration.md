# Breaking migration to platform behaviours

The canonical inventory is [migration-manifest.json](migration-manifest.json). It includes all original exports, including type-only declarations. All imports use the existing `@agent-starter/design-system` workspace namespace.

## Retained native exports

All native presentation, controls, semantic navigation, accordion, permanent drawer and speed-dial exports remain. `Theme` remains a div and preserves the CSS token contract. These keep their existing supported subset; they do not gain MUI parity.

## Changed behaviour APIs

| Old export                                     | New import        | Required migration                                                                                                                                                   |
| ---------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Menu`, `MenuAction`                           | `/react/menu`     | Plain `{id,label,disabled?}` records; move item `onSelect` callbacks to one `onAction(id)`. Only flat action buttons.                                                |
| `Combobox`                                     | `/react/combobox` | Replace string `items` with `{value,label,disabled?}` options; application filters; use request payloads, including selected label; query has independent ownership. |
| Native/advanced `Tabs`, `TabsProps`, `TabItem` | `/react/tabs`     | `onValueChange` receives `{value,reason,originalEvent?}`; default activation is manual. Invalid controlled value shows no panel. Panels remain mounted.              |
| `Tooltip`                                      | `/react/tooltip`  | Plain description only; no provider. Focus/hover, explicit Escape suppression and native manual popover.                                                             |
| `Dialog`, `DialogProps`, `Drawer`              | `/react/dialog`   | Remove controlled `open`. Use ref `show(invoker?)`/`hide()`; `onOpenChange` mirrors actual native state. `onCancel` can prevent Escape cancellation only.            |
| `Popover`                                      | `/react/popover`  | Narrow label/trigger/children API, optional defaultOpen and visibility notifications; use ref methods for requests. No arbitrary popup-owned native props.           |
| `Snackbar`                                     | `/react/toast`    | Removed old `open/message/onClose/duration` component. Create a store, push/dismiss records, render `ToastViewport`; timers now preserve remaining duration.         |

```tsx
// Before: onSelect lived on arbitrary item records.
// After:
<Menu label="Actions" items={[{id:'rename',label:'Rename'}]}
      onAction={id => actions[id]?.()} />

// Before: onValueChange(value), internally filtered string items.
// After:
<Combobox label="Fruit" value={fruit} inputValue={query}
  options={fruits.filter(label => label.toLowerCase().includes(query.toLowerCase()))
                 .map(label => ({value:label,label}))}
  onValueChange={({value,label}) => {setFruit(value);setQuery(label);}}
  onInputValueChange={({value}) => setQuery(value)} />

// Before: <Dialog open={open} onOpenChange={setOpen} ... />
// After:
const dialog = useRef<Visibility>(null);
<Button onClick={event => dialog.current?.show(event.currentTarget)}>Edit</Button>
<Dialog ref={dialog} title="Edit profile" onOpenChange={setOpen}>
  <Button onClick={() => dialog.current?.hide()}>Done</Button>
</Dialog>
```

## Removed APIs, with no drop-in behavioural substitute

- `ComboboxParts`, `AutocompleteParts`, `MenuParts`, `TabsParts`, `TooltipParts`, `SelectParts`, `SliderParts`, `NumberFieldParts`, `DialogParts`, `PopoverParts`: removed arbitrary Base UI composition. Use the corresponding narrow wrapper or controller contract. Parts remain unavailable.
- `Autocomplete`: removed Base UI-backed free-text autocomplete API. Use the new single-selection combobox only when its commitment semantics fit; use native input/datalist or an application extension for free text. These are different contracts.
- `CustomSelect`/`SelectParts`: custom select and multiselect unavailable. Native `Select` supports ordinary native selection. Custom keyboard styling/composition is not retained.
- `RangeSlider`/`SliderParts`: multithumb ranges unavailable. Native `Slider` is one `<input type="range">`; two application-labelled native inputs are an explicit alternative, not an atomic range widget.
- `FormattedNumberField`/`NumberFieldParts`: formatting, scrubbing and custom increment controls removed. Native `NumberField` uses `type="number"`; formatting belongs to a separate display/application flow.
- `Menubar`: unavailable. Use ordinary semantic navigation or separately specify its full keyboard model.
- Base UI `Toast`: replaced with explicit `createToastStore` and host viewports. No Base UI provider/parts API remains.
- `ToggleGroup` and `Toggle`: removed Base UI exports. Native `ToggleButton` receives host-controlled pressed state; applications coordinate groups.
- `DirectionProvider`: removed. Use inherited native `dir="rtl"` or `dir="ltr"`.

Rich grids, chart behaviour, virtualisation, rich pickers, swipe drawers and tree widgets are outside the core. None retains Base UI behind a fallback.

## Optional `/extra` compositions

`TransferList` coordinates native checkbox selection and host-owned chosen IDs. `DataTable` performs in-memory sort/pagination on a semantic table, not an ARIA grid; no virtualisation or server-fetch contract. `TreeView` is explicitly native details/summary navigation, not `role="tree"` keyboard interaction. `DatePicker`, `TimePicker`, `DateTimePicker` are native input types; `BarChart` is a static SVG/table presentation; `Masonry` is column-major CSS layout. These names retain their existing documented subsets only. They are excluded from the core size/completion claim.

Examples:

```tsx
<TransferList label="Team" items={people} value={selectedIds} onValueChange={setSelectedIds}/>
<DataTable caption="Team" rows={people} rowKey={p=>p.id}
  columns={[{key:'name',header:'Name',value:p=>p.label,sortable:true}]}/>
<TreeView label="Sections" nodes={[{id:'docs',label:'Docs',href:'/docs'}]}/>
<label>Date <DatePicker name="date"/></label>
<label>Time <TimePicker name="time"/></label>
<label>Local appointment <DateTimePicker name="appointment"/></label>
<BarChart label="Counts" data={[{label:'Open',value:3}]}/>
<Masonry><article>One</article><article>Two</article></Masonry>
```
