# ReduxForm

A small, Redux-first form runtime. Product form state is ordinary serialisable Redux state. React is optional. Selectors and actions are the public interface, and async validation or submission lives in middleware rather than components.

There is no hidden registry, context, provider, hook, or component state. If you need an escape hatch, it is ordinary Redux: wrap the reducer, listen to actions, write custom middleware, or derive whatever you need with selectors.

## Setup

```ts
import { configureStore } from '@reduxjs/toolkit'
import { defineForm, type FormState } from 'redux-form'

interface ProfileValues {
  name: string
  email: string
  addresses: Array<{ city: string }>
}

interface RootState {
  profileForm: FormState<ProfileValues>
}

export const profileForm = defineForm<ProfileValues>({
  name: 'profileForm',
  initialValues: { name: '', email: '', addresses: [] },
  validateOn: ['change', 'blur', 'submit'],
  validationDebounceMs: { change: 150 },
  validate: ({ values }) => ({
    errors: values.email.includes('@') ? {} : { email: 'Invalid email' },
  }),
  onSubmit: async ({ values, signal }) => {
    await api.updateProfile(values, { signal })
  },
  extraReducer: (state, action) => {
    // App-owned action, not from this form. extraReducer lets the form pick it
    // up so a loaded profile becomes values and the dirty baseline in one go.
    if (action.type === 'profile/loaded') {
      return {
        ...state,
        values: action.payload,
        initialValues: action.payload,
      }
    }
  },
})

const targeted = profileForm.target((state: RootState) => state.profileForm)

const store = configureStore({
  reducer: { profileForm: profileForm.reducer },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(targeted.middleware),
})
```

## React

ReduxForm does not ship a React component or hook. React reads form state with
`useSelector` and sends user events back to Redux with `dispatch`.

This is a complete controlled form:

```tsx
import type { ChangeEvent, FormEvent } from 'react'
import { useDispatch, useSelector } from 'react-redux'

export function ProfileForm() {
  const dispatch = useDispatch()
  const name = useSelector(targeted.selectors.value('name'))
  const email = useSelector(targeted.selectors.value('email'))
  const nameError = useSelector(targeted.selectors.error('name'))
  const nameTouched = useSelector(targeted.selectors.touched('name'))
  const disabled = useSelector(targeted.selectors.disabled)
  const readOnly = useSelector(targeted.selectors.readOnly)
  const canSubmit = useSelector(targeted.selectors.canSubmit)

  const change =
    (path: 'name' | 'email') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatch(profileForm.actions.fieldChanged(path, event.currentTarget.value))
    }

  const blur = (path: 'name' | 'email') => () => {
    dispatch(profileForm.actions.fieldBlurred(path))
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    dispatch(profileForm.actions.submit())
  }

  const reset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    dispatch(profileForm.actions.reset())
  }

  return (
    <form noValidate onSubmit={submit} onReset={reset}>
      <label>
        Name
        <input
          name="name"
          value={name}
          onChange={change('name')}
          onBlur={blur('name')}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={nameTouched && nameError !== undefined}
        />
      </label>
      {nameTouched && nameError !== undefined && <p role="alert">{nameError}</p>}

      <label>
        Email
        <input
          name="email"
          type="email"
          value={email}
          onChange={change('email')}
          onBlur={blur('email')}
          disabled={disabled}
          readOnly={readOnly}
        />
      </label>

      <button type="reset" disabled={disabled || readOnly}>Reset</button>
      <button type="submit" disabled={!canSubmit}>Save</button>
    </form>
  )
}
```

The event handlers are deliberately visible. An input event does not update
Redux by itself. `onChange` must dispatch `fieldChanged`, `onBlur` must dispatch
`fieldBlurred`, and `onSubmit` must prevent the browser navigation and dispatch
`submit`. The middleware observes those actions and runs the configured
validation or submission.

### Controlled values and initial values

Use `value`, not `defaultValue`, for text inputs owned by the form:

```tsx
const name = useSelector(targeted.selectors.value('name'))

return (
  <input
    value={name}
    onChange={event =>
      dispatch(profileForm.actions.fieldChanged('name', event.currentTarget.value))
    }
  />
)
```

`defaultValue` only sets the DOM value when an uncontrolled input mounts. Later
Redux updates, `reset()`, and `reinitialize()` will not be reflected in that
input. Do not pass both `value` and `defaultValue`.

The default belongs in `defineForm({ initialValues })`. `initialValues` is also
the dirty baseline and the destination for `reset()`, so duplicating a default
in JSX can make the DOM and Redux disagree. Keep controlled string fields as
strings, usually `''`, rather than changing between `undefined` and a string.
React warns when an input switches between uncontrolled and controlled.

`reinitialize({ values })` changes both the displayed controlled values and the
reset baseline. `setValue`, `patchValues`, and `replaceValues` change current
values only, so a later `reset()` still returns to `initialValues`.

### Form event quirks

- `fieldChanged(path, value)` represents a user edit. It changes the value but
  does not mark the field touched. `fieldBlurred(path)` marks it touched. This
  lets errors remain hidden until blur even when change validation is enabled.
- Change validation only runs after `fieldChanged`, and only when the value
  actually changed. Programmatic actions such as `setValue` do not masquerade
  as browser change events. Dispatch `validate({ path })` as well when a
  programmatic update needs immediate validation.
- User actions (`fieldChanged`, `fieldBlurred`, array edits, and `submit`) are
  ignored while the form is disabled or read-only. Programmatic value actions
  deliberately bypass those flags, which allows loading data into a locked
  form.
- A submit action touches every current leaf field before validation. Native
  HTML validation can prevent `onSubmit` from firing, so use `noValidate` on
  the `<form>` if ReduxForm must own all validation.
- A button inside a form defaults to `type="submit"`. Give non-submit buttons
  an explicit `type="button"`, and reset buttons `type="reset"`.
- The browser's native reset changes DOM controls, not Redux. In a controlled
  form, handle `onReset`, call `preventDefault()`, and dispatch `reset()` as in
  the example.
- React sends strings from text, number, date, and select controls. Convert at
  the boundary when the field type is not a string:

  ```tsx
  <input
    type="number"
    value={age}
    onChange={event => {
      const text = event.currentTarget.value
      dispatch(profileForm.actions.fieldChanged('age', text === '' ? undefined : Number(text)))
    }}
  />
  ```

- Checkboxes and radio buttons are controlled with `checked`, not `value`.
  For a checkbox, dispatch `event.currentTarget.checked`. A multiple select
  needs `Array.from(event.currentTarget.selectedOptions, option => option.value)`.
- File inputs cannot be controlled with a non-empty `value`. Keep the
  `FileList` outside serialisable Redux form state, or copy only serialisable
  file metadata into the form.
- React events are not Redux actions. Do not dispatch the event object itself,
  and read `event.currentTarget` inside the handler before handing work to
  asynchronous code.

## Escape hatches

- wrap `profileForm.reducer` and handle your own product actions
- use `config.extraReducer` for product actions without wrapping the reducer. It runs after the built-in reducer. Return a new state, or `undefined` to keep the built-in result. The `profile/loaded` handler above is the usual shape.
- listen to `profileForm.actions.fieldChanged.type` with Redux listener middleware
- omit `onSubmit` and own the submit lifecycle in application middleware
- write arbitrary selectors over `FormState`

## Development

```sh
npm ci
npm test
```

## Licence

MIT
