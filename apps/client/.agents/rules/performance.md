# Performance

How to keep Redux-owned UI state fast. Module layout and the Redux / React file split are in `modules.md`.

## Core invariant

All application-observable UI state lives in Redux.

React-local state is only for ephemeral interaction state that has no meaning outside the component performing the interaction, such as:

- hover
- focus
- transient pointer position
- animation-frame state
- other purely local interaction details

Do not move meaningful UI state out of Redux as a performance optimisation.

The performance strategy is instead:

> Centralise state, decentralise subscriptions.

## Primary rule

Redux state MUST be addressable at the smallest independently renderable unit.

React components SHOULD subscribe directly to the smallest piece of state they render.

Optimise for **render fan-out**, not selector count.

Running thousands of cheap selectors and rendering one component is preferable to running a handful of broad selectors and causing a large React subtree to reconcile.

## Select narrowly

Prefer:

```tsx
const value = useSelector((state) => state.forms.byId[formId].fields[fieldId].value);

const error = useSelector((state) => state.forms.byId[formId].fields[fieldId].error);
```

Avoid:

```tsx
const form = useSelector((state) => state.forms.byId[formId]);
```

and especially:

```tsx
const ui = useSelector((state) => state.ui);
```

Parent components SHOULD NOT subscribe to large state objects merely to distribute them to children through props.

Push Redux subscriptions down towards the components that actually render the data.

## Prefer many cheap selectors

Do not attempt to reduce the number of `useSelector` calls merely because there are many of them.

Cheap selectors should normally be O(1):

```tsx
(state) => state.entities.byId[id].status;
```

Thousands of selectors like this are acceptable.

Selector count is usually much less important than unnecessary React renders.

## Preserve reference identity

Reducers MUST preserve references for state that has not changed.

Updating one field should not recreate unrelated forms, entities, rows, modals, or other UI state.

With Redux Toolkit / Immer, prefer targeted updates:

```tsx
state.forms.byId[formId].fields[fieldId].value = value;
```

Structural sharing is part of the performance model. Unchanged data should retain its previous reference wherever possible.

## Do not allocate from simple selectors

Avoid selectors that create a new object or array on every execution:

```tsx
useSelector((state) => ({
    value: state.fields[id].value,
    error: state.fields[id].error,
}));
```

Prefer independent primitive/reference selectors:

```tsx
const value = useSelector((state) => state.fields[id].value);
const error = useSelector((state) => state.fields[id].error);
```

Use memoised selectors only when an aggregate or derived value is genuinely required.

## Keep selectors cheap

Simple property lookups do not need memoisation.

Do not use Reselect merely to memoise:

```tsx
(state) => state.fields[id].value;
```

Memoise selectors that perform actual derived work, such as:

```tsx
filter
sort
map
reduce
aggregation
expensive joins
```

Expensive transformations MUST NOT be repeated independently across large numbers of subscribers.

## Normalise collections

For lists and entity collections, subscribe by ID.

Prefer:

```tsx
function UserList() {
  const ids = useSelector(selectUserIds)

  return ids.map(id => <UserRow key={id} id={id} />)
}

function UserRow({ id }) {
  const user = useSelector(state => state.users.byId[id])

  return ...
}
```

Avoid selecting all entity objects in the parent and passing each object down.

Changing one entity should normally cause only the component rendering that entity to rerender.

## Forms

Redux remains the source of truth for form state, including:

- values
- dirty state
- touched state
- validation state
- submission state

Each field SHOULD subscribe to its own state.

Typing into one field should ideally result in:

```
dispatch
→ selectors run
→ unrelated selector results remain equal
→ one field rerenders
```

Do not optimise forms by introducing a second component-local source of truth.

## Validation

Cheap validation may run synchronously with field updates.

Expensive or cross-field validation SHOULD be dependency-aware.

A field change should recompute only the validation rules affected by that field rather than validating the entire form or application.

For example:

```
password changed
→ validate password
→ validate confirmPassword dependency
```

not:

```
password changed
→ validate every field
```

## Render boundaries

Components SHOULD own their own Redux subscriptions rather than receiving large state objects from container components.

Prefer:

```
Page
 ├─ Toolbar      → subscribes to toolbar state
 ├─ Search       → subscribes to search state
 ├─ Table
 │   ├─ Row      → subscribes to row A
 │   ├─ Row      → subscribes to row B
 │   └─ Row      → subscribes to row C
 └─ Modal        → subscribes to modal state
```

Avoid:

```
Page → subscribes to everything
     → passes everything through props
```

Use `React.memo` where useful at structural boundaries such as rows, fields, tree nodes, graph nodes, and expensive reusable components.

Do not add `React.memo` indiscriminately. It is useful when a parent can rerender independently of a child and the child's props are stable.

## High-frequency state

Redux may contain large amounts of UI state. State size alone is not the primary concern.

Be more cautious with extremely high-frequency updates.

State such as these normally remains local:

- mouse coordinates
- hover
- focus
- intermediate drag pixels
- animation frame values
- continuously sampled scroll position

State such as these belongs in Redux:

- selected rows
- expanded sections
- modal state
- form values
- validation state
- filters
- sorting
- pagination
- active tabs
- wizard steps
- drafts
- dirty state

## Performance review heuristic

When reviewing frontend code, ask:

1. What changes in Redux?
2. Which selectors will observe the dispatch?
3. Which selector results actually change?
4. Which components consequently rerender?
5. How large is the resulting React render/reconciliation surface?

The target is not necessarily to minimise selector execution.

The target is:

> A small Redux change should produce the smallest possible React render.

A system that executes 5,000 O(1) selectors and rerenders one leaf component is generally preferable to one that executes five broad selectors and rerenders hundreds of components.

## Avoid these patterns

Do not introduce:

```tsx
useSelector((state) => state.ui);
```

or other broad root/subtree subscriptions without a specific reason.

Do not select a whole form when only one field is needed.

Do not select an entire collection when individual entities can subscribe by ID.

Do not construct fresh objects or arrays in ordinary selectors.

Do not perform `filter`, `sort`, `map`, or `reduce` repeatedly in non-memoised selectors.

Do not move Redux-owned state into React-local state merely to avoid dispatching.

Do not propagate large Redux state objects through the React tree when children can subscribe directly.

## Summary

The frontend architecture assumes that meaningful UI state belongs in Redux.

Performance comes from:

- fine-grained subscriptions
- normalised state
- structural sharing
- O(1) selectors
- memoised derived data
- dependency-aware validation
- stable component boundaries
- minimising render fan-out

Treat these as part of the Redux invariant, not as optional optimisations.
