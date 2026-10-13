# Behaviour and adapter contracts

Version 1 is a deliberately narrow native-platform API. Rich composition is not supported. These contracts apply to direct attachment, React, and the corresponding custom element unless stated otherwise.

## Attachment, ownership and cleanup

Import `attachMenu`, `attachPopover`, `attachTabs`, `attachTree`, `attachTooltip`, `attachCombobox` or `attachDialog` from `@agent-starter/design-system/behaviours/<name>`. Pass a connected, complete root and an options snapshot. A second attachment of the same behaviour throws. Destroy before replacing required structural parts; item lists can change in place followed by `refresh()` or `update(options)`.

All handles have `update(completeOptions)`, `refresh()` and idempotent `destroy()`. Updates replace options rather than merging past configurations. Calls through a destroyed handle do not mutate a new attachment. `data-ui-root` is the instance boundary. Nested `data-ui-root` and canonical `ui-*` elements are excluded from an ancestor's part queries. Keep IDs stable and unique within the document. Parts and option values must not use array indices as identity.

The host owns structure, item IDs, text, native item disabled attributes and data. Controllers do not render, clone, portal or move children. They own the attributes listed below, focus and inline positioning mechanics while attached. The combobox additionally updates its display/hidden input values and the dedicated status region's text. Destroy restores attributes only when they still equal the controller's last write. Later host changes win. Geometry styles are restored on close; no theme colours are copied to JavaScript.

React attaches after commit, updates after every commit, and destroys on unmount, without reattaching for callback identity changes. React Strict Mode is tested. React's `useId()` provides SSR-compatible instance IDs; item IDs derive from stable values. Rendered initial attributes remain equivalent to the first controller snapshot. The types exclude arbitrary composition and conflicting owned ARIA/state properties. Do not bypass these types with assertions. Advanced triggers start disabled until enhancement; native form controls remain usable without scripts.

Custom-element modules are **browser-only side-effect imports**. Each exports its class and registers one tag. Loading the same module again is idempotent; attempting to register another implementation for that tag throws. Use one installed version per document. Do not load two separately bundled copies. No registration or element classes appear in React bundles.

An element's `.options` property accepts the corresponding complete controller options. Its callbacks are replaced by DOM events; listen to events rather than putting callbacks in `.options` (dialog `onCancel` remains a callback because cancellation is synchronous). Set structured combobox options after rendering their markup. Properties assigned before upgrade are recovered. Initially an explicit options field wins over an attribute, which wins over a default. Later scalar attribute changes update that field. `disabled`, `value`, and `input-value` are supported where applicable; menu/popover/dialog also read `default-open` at first attachment. Do not use `open` to control native top-layer visibility. Setting `.options` reconciles synchronously when connected and complete. A scoped MutationObserver batches child, label, ID and native-disabled changes; ARIA and geometry writes are not observed. Initial attachment waits for required parts. Disconnect destroys the instance. Reconnect preserves committed uncontrolled tabs/combobox state and clears actual popup visibility; destroy before adoption releases the old document's listeners. A toast viewport destroys its store on disconnect, rather than retaining pending notifications.

## State and events

Presence of `value` at first attachment selects controlled mode. `null` is a controlled empty value; `undefined` selects uncontrolled mode. A combobox's `inputValue` is independently controlled. These modes cannot change during an attachment. Controlled requests never optimistically change committed selection. Returning `false` from a direct/React change callback rejects an uncontrolled change. No response timeout transfers state ownership.

`Request<T, Reason>` contains `{value, reason, originalEvent?}`. `update()` never emits a user request. Element events bubble and are composed:

- `ui-value-request`: cancelable. Tabs detail is a value request; combobox detail also contains `label`. `preventDefault()` rejects an uncontrolled commit. Controlled hosts explicitly supply the accepted snapshot.
- `ui-input-request`: cancelable combobox query request with the reason union below. Value and query are separate fields; one selection can request both.
- `ui-open-change`: non-cancelable `{open: boolean}`, mirroring actual visibility.
- `ui-action`: `{id: string}` for one enabled menu activation.
- `ui-toast-change`: readonly array of the currently visible notifications. The HTML host renders it.

Direct/React `onOpenChange` receives a boolean. Browser dismissal is authoritative; this API does not promise vetoable controlled `open`. Handles expose `show()` and `hide()`. Dialog `show(invoker?)` accepts an explicit element so Safari pointer activation can restore the right focus even when clicking did not focus the button. React dialog/popover expose these methods through `ref`.

## Menu

Parts: one native button `trigger`; one named, ID-bearing `popup` with `popover="auto"`; zero or more native action buttons with unique nonempty `data-ui-item` IDs. Native separators can sit between actions. Item labels are plain text. No links, checkable items, nested menus or interactive descendants.

Options: `disabled`, `defaultOpen`, `side`, `align`, `onOpenChange`, `onAction(id)`. React adds `label`, `items: {id,label,disabled?,tone?:'danger'}[]`, optional custom `trigger` content, `className`, `triggerClassName` and `triggerVariant` (`outline` | `ghost`). Element: `ui-menu`.

Owned: root `data-ui-root`; trigger `aria-haspopup`, `aria-controls`, `aria-expanded`, enhancement `disabled` and removal of `popovertarget`; popup `popover`, `role`, `tabindex`; items `role`, `tabindex`, `aria-disabled`; popup position styles. Do not combine a controller toggle with `popovertarget`.

Enter/Space click activation opens at the first enabled item, ArrowDown opens first, ArrowUp last. Arrows wrap; Home/End select endpoints. Unmodified printable keys use case-insensitive prefix matching with a 500 ms reset; repeating one character cycles matches. Composition and modified shortcuts are ignored. Enter/Space produce one native activation, close and restore owned focus. Escape closes and restores focus; outside pointer dismissal leaves native destination focus alone. Tab/Shift+Tab close, restore the trigger's sequential starting point and let the browser continue, including the browser's keyboard-navigation preferences. Empty menus focus the labelled popup. Refresh moves focus off removed/disabled items to an enabled neighbour.

```html
<ui-menu>
    <button type="button" data-ui-part="trigger" disabled>Actions</button>
    <div id="actions" data-ui-part="popup" class="ui-popup" popover="auto" aria-label="Actions">
        <button type="button" data-ui-item="rename">Rename</button>
        <button type="button" data-ui-item="archive" disabled>Archive</button>
    </div>
</ui-menu>
```

## Popover

Parts: native button `trigger` and named, ID-bearing `popup`. Options: `disabled`, `defaultOpen`, `side`, `align`, `onOpenChange`. React: `label`, `trigger`, `children`, optional `className` (root), `popupClassName`, `triggerClassName`, `triggerVariant` (`outline` | `ghost`), imperative `ref`. Element: `ui-popover`.

Owned: trigger `disabled`, `aria-controls`, `aria-expanded`, `popovertarget`; popup `popover` and position styles. Ordinary content keeps normal document Tab navigation and receives no menu/listbox roles. Native `toggle` reconciles actual state, including coalesced events. Local CSS inheritance and native popup ancestry are preserved. Native links and native declarative popovers are alternatives when operation without JavaScript is necessary.

## Tooltip

Parts: a focusable `trigger`; an ID-bearing text-only `popup`. No focusable descendants. Options: `hoverDelay` (500 ms), `leaveDelay` (100 ms), `disabled`, `side`, `align`. React: `label` is description text; `children` is the button's accessible label/content. Element: `ui-tooltip`.

Owned: popup `role="tooltip"`, `popover="manual"`, positioning; trigger `aria-describedby` tokens. Existing description tokens are preserved. Focus opens immediately; mouse/pen hover waits. Pointer transfer between trigger and surface uses departure grace. Escape is intercepted only while visible and suppresses reopening until the initiating focus/hover ends. It does not close a parent dialog. No focus movement or `aria-expanded`. Touch interaction is not required for discovery. Never make tooltip text the sole accessible name or the only place essential instructions appear.

## Tabs

Parts: `list`; native button `tab` parts with IDs and `data-ui-value`; `panel` parts with matching values and IDs. Every tab requires a panel, including disabled tabs. Options: `value`, `defaultValue`, `orientation` (`horizontal` default), `activation` (`manual` default), `onValueChange(Request<string,'activate'|'navigate'>)`. React adds `label` and `items: {value,label,content,disabled?}[]`. Element: `ui-tabs`.

Owned: list `role`, `aria-orientation`; root `data-orientation`; tab `role`, `aria-controls`, `aria-selected`, `tabindex`, `data-active`, `data-label` (normalised from the tab's text content, used by CSS to reserve the selected font-weight width); panel `role`, `aria-labelledby`, `hidden`. React uses `data-ui-gated` plus `data-ui-disabled` for initial disabled enhancement gates; ordinary HTML hosts can declare native tab disabled state directly.

Selected tabs use the strong font weight. An invisible bold copy of `data-label` participates in layout so neighbouring tabs do not shift when selection changes.

Exactly one enabled tab is sequentially focusable. Arrows follow orientation and RTL; Home/End select endpoints. Manual activation uses native Enter/Space button clicks. Automatic activation is explicit. Focus and committed panels are independent in controlled mode. Invalid controlled values show no panel. Invalid uncontrolled values choose the first enabled tab. Panels stay mounted; there is no built-in unmount-on-hide mode. Applications can replace panel contents after accepting loss of local state.

## Combobox

Parts: labelled native `input`; named, ID-bearing `popup`; stable ID-bearing `option` nodes with `data-ui-value`; persistent `status`; optional hidden input `value` with a host-supplied `name`. Options: supplied `options: {value:string,label:string,disabled?:boolean}[]`, `value`, `defaultValue`, `inputValue`, `defaultInputValue`, `loading`, `disabled`, `side`, `align`, and callbacks below. React adds `label`, `name`, `placeholder`, `description`, `invalid`. Element: `ui-combobox`.

The host filters/fetches and renders **exactly** the supplied options before reconciliation. Values are unique; there are no groups, creation, chips, rich descendants, virtualisation or multiselect. Empty/loading text is outside the option collection.

Owned: input `role`, `aria-autocomplete`, `aria-controls`, `aria-expanded`, `aria-activedescendant`, enhancement `disabled` and display value; popup `role`, `popover`, `aria-busy`, geometry; options `role`, `aria-selected`, `aria-disabled`, `data-highlighted`; status `role`, `aria-live`, count/loading text; hidden input value and disabled state. The text input is not the submitted field. The hidden input submits the committed value (`''` for null) and is disabled with the widget.

`onValueChange` receives `{value:string|null,label:string,reason:'select'|'clear'|'reset',originalEvent?}`. `onInputValueChange` receives `{value:string,reason:'input'|'select'|'blur'|'clear'|'reset',originalEvent?}`. Typing opens and requests query text. Arrow keys navigate enabled results without moving DOM focus and stop at endpoints. Enter prevents submission only when an active result is accepted. IME composition does not select. Home/End and editing shortcuts remain native. Tab closes without selecting; Escape closes without clearing committed value. Pointer selection survives blur without cancelling touch pointer-down. Blur restores the committed label (or requests it from a controlled host). A temporarily absent option retains committed value and its known label. `clear()` on the direct controller requests null explicitly. Form reset restores uncontrolled defaults and emits requests in controlled mode. Required-selection validation and errors belong to the application; `required` display text cannot validate selection.

## Tree

Parts: native button or anchor `item` nodes with unique nonempty `data-ui-value` identifiers; optional nested `group` lists with a matching `data-ui-owner`; and a `label` descendant within each item. Options: `expandedIds`, `selectedId`, `onExpandedChange({id,expanded,reason,originalEvent})` and `onSelectionChange({id,reason,originalEvent})`. React adds `Tree` and composable `TreeItem` components. `TreeItem.href` renders an anchor so hosts can expose copy-link and modified-click behaviour while still handling ordinary selection through the controller. Element: `ui-tree`.

Owned: root `role="tree"`; item `role="treeitem"`, `aria-expanded`, `aria-selected`, `tabindex`, `data-ui-expanded` and `data-ui-selected-path` (present on each ancestor of `selectedId`, not on the selected item itself); group `role="group"` and `hidden`. Expansion and selection are controlled by the host. Pointer activation on a branch row (outside its label) toggles expansion. Its label requests selection and, when the branch is collapsed, also requests expansion without collapsing an already-open branch. Leaf activation requests selection. Up/Down and Home/End move roving focus through visible enabled items. Right expands or moves to the first visible child; Left collapses or moves to the parent. Enter requests selection. Space requests branch expansion or selects a leaf.

The controller never renders or moves nodes. Light DOM, low-specificity `.ui-tree-*` classes and public `--ui-tree-*` hooks keep the component host-stylable. The host owns item content, expansion state, selected state and any navigation resulting from selection.

## Dialog and drawer

The direct root is a named native `<dialog>`. A `ui-dialog` hosts a native `<dialog data-ui-part="dialog">`. Optional `close` parts are native buttons. Options: `defaultOpen`, `onOpenChange`, synchronous `onCancel(event)`, `initialFocus: HTMLElement | (() => HTMLElement|null)`, `backdropDismiss` (false default). React adds `title`, `description`, `children`, `closeLabel`, `className`, imperative `ref`. `Drawer` is the same native dialog with drawer CSS. No swipe gestures.

The browser owns modality and open state through `showModal()`/`close()`. No secondary trap or simulated modal `open` attribute is used. Escape dismisses unless the host prevents native `cancel`. Backdrop dismissal requires both pointer-down and pointer-up outside the dialog rectangle. When `initialFocus` is omitted, focus moves to the first enabled field in `.ui-dialog-content` (`input`/`select`/`textarea`), otherwise the first focusable in content, otherwise the first focusable in `.ui-dialog-footer`, so the heading close control is not the default. Explicit `initialFocus` still wins, including a heading with `tabindex="-1"` for long content. A connected invoker receives focus only when the closing interaction still owns it; pass the explicit invoker on Safari pointer activation. Closing a child widget does not close its dialog. The host must supply a visible, meaningful name.

## Toast

`createToastStore(document?)` is an explicit independent store. When called in a browser without an argument it uses the current document; server creation is safe. `push({message,kind?,urgent?,duration?,action?})` returns a stable ID; `dismiss(id)`, `subscribe(listener)`, `getSnapshot()`, `pause(id,reason,paused)` and idempotent `destroy()` complete the API. `kind` is `info` | `success` | `warning` | `error` (omitted kind renders as success). Action is `{label,run}`. No module singleton.

At most three notifications are visible; newer ones appear first and older ones shift down. Later ones beyond the cap queue and start timers when they become visible. Default timeout is 5,000 ms; errors and actionable notifications persist unless an explicit duration is supplied. Hover, focus and document visibility pause remaining duration, with independent pause reasons. Destroy clears timers and subscribers. React receives a store via `<ToastViewport store={store}/>`; the host owns its lifetime. The viewport is fixed at the top centre and renders a paper panel with a circular status icon, title/description split from `message` when it contains a sentence pair, persistent polite and assertive regions, specific dismiss names and action buttons; it never focuses a toast. Only explicit `urgent:true` uses assertive announcements.

`ui-toast` owns `.store`; `ui-toast-change` tells the host to render snapshots. Supply persistent `polite` and `urgent` parts and apply `data-ui-toast="<id>"` to each host-rendered item for hover/focus pausing. Wire dismiss/action buttons in application code. Reconnection creates a fresh store.

## Positioning and CSS

`side` is top/bottom/left/right; `align` is start/center/end. Logical horizontal alignment follows RTL. The shared bounded fixed-position fallback is currently always used: CSS anchors are intentionally not enabled without evidence for the complete required subset. There is no separate untested anchor path. Popups flip to the opposite side when it has more space, shift within viewport padding and constrain oversized content with scrolling. Relevant scroll/resize, element ResizeObserver and visual viewport events are batched into animation frames, only while open. A disconnected or fully clipped anchor closes its surface. The fallback reads resolved `--ui-popup-gap` and optional `--ui-popup-viewport-padding` (8px fallback) as geometry, never theme colours. No mandatory Floating UI dependency is shipped.

Behaviour timings are options; CSS transition timings remain visual tokens. All top layers stay in their original DOM ancestry. Consumer-created portals require a separately themed host and are outside this placement contract. Native dialog and popover support are required. Chromium, Firefox and WebKit are covered by the browser tests; physical Safari/iOS and assistive-technology checks are not implied.
