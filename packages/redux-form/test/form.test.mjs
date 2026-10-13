import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyMiddleware, createStore } from 'redux'
import {
  defaultFormEqual,
  defineForm,
  getIn,
  setIn,
} from '../src/index.ts'

const tick = async (times = 8) => {
  for (let i = 0; i < times; i += 1) await Promise.resolve()
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const initialValues = {
  name: '',
  email: '',
  addresses: [{ city: 'London' }],
}

function make(config = {}) {
  const form = defineForm({
    name: 'profileForm',
    initialValues,
    ...config,
  })
  const targeted = form.target(state => state.form)
  const store = createStore(
    (state = { form: form.getInitialState() }, action) => ({
      form: form.reducer(state.form, action),
    }),
    applyMiddleware(targeted.middleware),
  )
  return { form, targeted, store }
}

test('defineForm rejects an empty name', () => {
  assert.throws(() => defineForm({ name: '  ', initialValues: {} }), /non-empty name/)
})

test('path helpers round-trip nested values and reject empty paths', () => {
  const next = setIn({ a: { b: [1] } }, 'a.b.0', 2)
  assert.deepEqual(next, { a: { b: [2] } })
  assert.equal(getIn(next, 'a.b.0'), 2)
  assert.equal(getIn({}, 'missing.leaf'), undefined)
  assert.throws(() => getIn({}, ''), /cannot be empty/)
  assert.throws(() => setIn([], 'x', 1), /array index/)
})

test('defaultFormEqual compares dates, regexes, arrays and records', () => {
  assert.equal(defaultFormEqual(1, 1), true)
  assert.equal(defaultFormEqual(new Date(1), new Date(1)), true)
  assert.equal(defaultFormEqual(new Date(1), new Date(2)), false)
  assert.equal(defaultFormEqual(/a/g, /a/g), true)
  assert.equal(defaultFormEqual(/a/g, /a/i), false)
  assert.equal(defaultFormEqual([1, { a: 1 }], [1, { a: 1 }]), true)
  assert.equal(defaultFormEqual([1], [1, 2]), false)
  assert.equal(defaultFormEqual({ a: 1 }, { a: 1 }), true)
  assert.equal(defaultFormEqual({ a: 1 }, { a: 1, b: 2 }), false)
  assert.equal(defaultFormEqual({ a: 1 }, { b: 1 }), false)
  assert.equal(defaultFormEqual(1, '1'), false)
})

test('fieldChanged updates values and is ignored while disabled or readOnly', () => {
  const { form, store } = make()
  store.dispatch(form.actions.fieldChanged('name', 'Ada'))
  assert.equal(store.getState().form.values.name, 'Ada')

  store.dispatch(form.actions.setDisabled(true))
  store.dispatch(form.actions.fieldChanged('name', 'Grace'))
  assert.equal(store.getState().form.values.name, 'Ada')

  store.dispatch(form.actions.setDisabled(false))
  store.dispatch(form.actions.setReadOnly(true))
  store.dispatch(form.actions.fieldChanged('name', 'Grace'))
  assert.equal(store.getState().form.values.name, 'Ada')
})

test('change and blur are separate user events', () => {
  const { form, store } = make()

  store.dispatch(form.actions.fieldChanged('name', 'Ada'))
  assert.equal(store.getState().form.values.name, 'Ada')
  assert.equal(store.getState().form.touched.name, undefined)

  store.dispatch(form.actions.fieldBlurred('name'))
  assert.equal(store.getState().form.values.name, 'Ada')
  assert.equal(store.getState().form.touched.name, true)
})

test('setValue patchValues and replaceValues bypass disabled', () => {
  const { form, store } = make()
  store.dispatch(form.actions.setDisabled(true))
  store.dispatch(form.actions.setValue('email', 'ada@example.com'))
  store.dispatch(form.actions.patchValues({ addresses: [{ city: 'Bath' }] }))
  assert.equal(store.getState().form.values.email, 'ada@example.com')
  assert.equal(store.getState().form.values.addresses[0].city, 'Bath')
  store.dispatch(form.actions.replaceValues({ ...initialValues, name: 'Ada' }))
  assert.equal(store.getState().form.values.name, 'Ada')
  assert.equal(store.getState().form.values.email, '')
})

test('programmatic values do not change the reset baseline', () => {
  const { form, store } = make()

  store.dispatch(form.actions.setValue('name', 'Ada'))
  store.dispatch(form.actions.patchValues({ email: 'ada@example.com' }))
  assert.deepEqual(store.getState().form.initialValues, initialValues)

  store.dispatch(form.actions.reset())
  assert.deepEqual(store.getState().form.values, initialValues)
})

test('reinitialize changes the reset baseline and controlled values', () => {
  const { form, store } = make()
  const loadedValues = {
    name: 'Ada',
    email: 'ada@example.com',
    addresses: [{ city: 'Bath' }],
  }

  store.dispatch(form.actions.reinitialize({ values: loadedValues }))
  assert.deepEqual(store.getState().form.values, loadedValues)
  assert.deepEqual(store.getState().form.initialValues, loadedValues)

  store.dispatch(form.actions.fieldChanged('name', 'Grace'))
  store.dispatch(form.actions.reset())
  assert.deepEqual(store.getState().form.values, loadedValues)
})

test('array insert remove move and append remap touched and errors', () => {
  const { form, store } = make()
  store.dispatch(form.actions.touch('addresses.0.city'))
  store.dispatch(form.actions.setFieldError({ path: 'addresses.0.city', error: 'required' }))
  store.dispatch(form.actions.arrayInsert('addresses', 0, { city: 'York' }))
  assert.deepEqual(store.getState().form.values.addresses, [{ city: 'York' }, { city: 'London' }])
  assert.equal(store.getState().form.touched['addresses.1.city'], true)
  assert.equal(store.getState().form.errors['addresses.1.city'], 'required')

  store.dispatch(form.actions.arrayMove('addresses', 1, 0))
  assert.deepEqual(store.getState().form.values.addresses, [{ city: 'London' }, { city: 'York' }])
  assert.equal(store.getState().form.errors['addresses.0.city'], 'required')

  store.dispatch(form.actions.arrayRemove('addresses', 0))
  assert.deepEqual(store.getState().form.values.addresses, [{ city: 'York' }])
  assert.equal(store.getState().form.errors['addresses.0.city'], undefined)

  store.dispatch(form.actions.arrayAppend('addresses', { city: 'Leeds' }))
  assert.equal(store.getState().form.values.addresses.length, 2)
})

test('array mutations are ignored while disabled and reject non-arrays', () => {
  const { form, store } = make()
  store.dispatch(form.actions.setDisabled(true))
  store.dispatch(form.actions.arrayAppend('addresses', { city: 'York' }))
  assert.equal(store.getState().form.values.addresses.length, 1)
  store.dispatch(form.actions.setDisabled(false))
  assert.throws(() => store.dispatch(form.actions.arrayAppend('name', { city: 'x' })), /expected an array/)
  store.dispatch(form.actions.arrayRemove('addresses', 9))
  store.dispatch(form.actions.arrayMove('addresses', 0, 0))
  assert.equal(store.getState().form.values.addresses.length, 1)
})

test('touch helpers and extraReducer', () => {
  const { form, store } = make({
    extraReducer: (state, action) => action.type === 'custom/mark' ? { ...state, formError: 'custom' } : undefined,
  })
  store.dispatch(form.actions.fieldBlurred('name'))
  store.dispatch(form.actions.fieldBlurred('name'))
  store.dispatch(form.actions.touch('email'))
  store.dispatch(form.actions.touch('email'))
  store.dispatch(form.actions.touchAll())
  assert.equal(store.getState().form.touched['addresses.0.city'], true)
  store.dispatch(form.actions.untouch('email'))
  store.dispatch(form.actions.untouch('email'))
  assert.equal(store.getState().form.touched.email, undefined)
  store.dispatch(form.actions.clearTouched())
  store.dispatch(form.actions.clearTouched())
  assert.deepEqual(store.getState().form.touched, {})
  store.dispatch({ type: 'custom/mark' })
  assert.equal(store.getState().form.formError, 'custom')
})

test('errors reset reinitialize and selectors', () => {
  const { form, targeted, store } = make()
  store.dispatch(form.actions.setFieldError({ path: 'name', error: 'required' }))
  store.dispatch(form.actions.setErrors({ email: 'invalid' }))
  store.dispatch(form.actions.setFormError('form'))
  store.dispatch(form.actions.setSubmitError('submit'))
  store.dispatch(form.actions.fieldChanged('name', 'Ada'))
  assert.equal(targeted.selectors.error('name')(store.getState()), undefined)
  store.dispatch(form.actions.clearErrors())
  assert.deepEqual(targeted.selectors.errors(store.getState()), {})

  store.dispatch(form.actions.fieldChanged('name', 'Ada'))
  store.dispatch(form.actions.touch('name'))
  store.dispatch(form.actions.reinitialize({
    values: { name: 'Grace', email: 'g@example.com', addresses: [] },
    options: { keepDirtyValues: true, keepTouched: true },
  }))
  assert.equal(targeted.selectors.values(store.getState()).name, 'Ada')
  assert.equal(targeted.selectors.touched('name')(store.getState()), true)
  assert.equal(targeted.selectors.dirty('name')(store.getState()), true)
  assert.equal(targeted.selectors.isDirty(store.getState()), true)

  store.dispatch(form.actions.reset())
  assert.equal(targeted.selectors.values(store.getState()).name, 'Grace')
  assert.equal(targeted.selectors.isDirty(store.getState()), false)
  assert.equal(targeted.selectors.canSubmit(store.getState()), true)
  assert.equal(targeted.selectors.status(store.getState()), 'idle')
  assert.equal(targeted.selectors.initialValues(store.getState()).email, 'g@example.com')
  assert.equal(targeted.selectors.value('email')(store.getState()), 'g@example.com')
})

test('submit validation and onSubmit success', async () => {
  let submitted
  const { form, targeted, store } = make({
    validate: ({ values }) => values.email.includes('@') ? {} : { errors: { email: 'Invalid email' } },
    fields: {
      name: value => value ? undefined : 'required',
    },
    validateField: (path, value) => path === 'email' && value === 'bad' ? 'nope' : undefined,
    onSubmit: async ({ values }) => {
      submitted = values
    },
  })

  store.dispatch(form.actions.submit())
  await tick()
  assert.equal(targeted.selectors.isValid(store.getState()), false)
  assert.equal(targeted.selectors.status(store.getState()), 'idle')

  store.dispatch(form.actions.fieldChanged('name', 'Ada'))
  store.dispatch(form.actions.fieldChanged('email', 'ada@example.com'))
  store.dispatch(form.actions.submit())
  await tick()
  assert.equal(targeted.selectors.status(store.getState()), 'success')
  assert.equal(submitted.name, 'Ada')
  assert.equal(targeted.selectors.submitCount(store.getState()), 2)
})

test('submit maps thrown errors and records server failures', async () => {
  const { form, targeted, store } = make({
    validateOn: ['submit'],
    onSubmit: async () => {
      throw new Error('nope')
    },
    mapSubmitError: error => error instanceof Error ? error.message : 'x',
  })
  store.dispatch(form.actions.submit())
  await tick()
  assert.equal(targeted.selectors.status(store.getState()), 'error')
  assert.equal(targeted.selectors.submitError(store.getState()), 'nope')

  const failing = make({
    onSubmit: async () => ({ errors: { name: 'taken' }, formError: 'no' }),
  })
  failing.store.dispatch(failing.form.actions.submit())
  await tick()
  assert.equal(failing.targeted.selectors.formError(failing.store.getState()), 'no')
  assert.equal(failing.targeted.selectors.error('name')(failing.store.getState()), 'taken')
})

test('blur and change validation, debounce, cancel and disabled submit', async () => {
  const { form, targeted, store } = make({
    validateOn: ['change', 'blur', 'submit'],
    validationDebounceMs: { change: 15, blur: 0 },
    validate: ({ values }) => values.name ? {} : { errors: { name: 'required' } },
    onSubmit: async () => {},
  })

  store.dispatch(form.actions.fieldChanged('name', 'A'))
  await wait(30)
  await tick()
  assert.equal(targeted.selectors.isValidating(store.getState()), false)

  store.dispatch(form.actions.fieldChanged('name', ''))
  store.dispatch(form.actions.cancelValidation())
  store.dispatch(form.actions.fieldBlurred('name'))
  await tick()
  assert.equal(targeted.selectors.error('name')(store.getState()), 'required')

  store.dispatch(form.actions.setDisabled(true))
  store.dispatch(form.actions.submit())
  assert.equal(targeted.selectors.submitCount(store.getState()), 0)
  assert.equal(targeted.selectors.disabled(store.getState()), true)
  assert.equal(targeted.selectors.readOnly(store.getState()), false)
})

test('change validation only follows a changed user value', async () => {
  const validations = []
  const { form, store } = make({
    validateOn: ['change'],
    validate: context => {
      validations.push({
        reason: context.reason,
        changedPath: context.changedPath,
        name: context.values.name,
      })
    },
  })

  store.dispatch(form.actions.fieldChanged('name', ''))
  store.dispatch(form.actions.setValue('name', 'programmatic'))
  await tick()
  assert.deepEqual(validations, [])

  store.dispatch(form.actions.fieldChanged('name', 'user edit'))
  await tick()
  assert.deepEqual(validations, [{
    reason: 'change',
    changedPath: 'name',
    name: 'user edit',
  }])
})

test('manual validation follows a programmatic value update', async () => {
  const validations = []
  const { form, store } = make({
    validateOn: ['change'],
    validate: context => {
      validations.push({
        reason: context.reason,
        changedPath: context.changedPath,
        name: context.values.name,
      })
    },
  })

  store.dispatch(form.actions.setValue('name', 'loaded'))
  store.dispatch(form.actions.validate({ path: 'name' }))
  await tick()
  assert.deepEqual(validations, [{
    reason: 'manual',
    changedPath: 'name',
    name: 'loaded',
  }])
})

test('submit touches every leaf but is ignored while readOnly', async () => {
  const { form, store } = make()

  store.dispatch(form.actions.submit())
  await tick()
  assert.deepEqual(store.getState().form.touched, {
    name: true,
    email: true,
    'addresses.0.city': true,
  })
  assert.equal(store.getState().form.submitCount, 1)

  store.dispatch(form.actions.reset())
  store.dispatch(form.actions.setReadOnly(true))
  store.dispatch(form.actions.submit())
  assert.deepEqual(store.getState().form.touched, {})
  assert.equal(store.getState().form.submitCount, 0)
})

test('submit without validateOn submit still runs onSubmit', async () => {
  let ran = false
  const { form, store } = make({
    validateOn: ['blur'],
    onSubmit: async () => {
      ran = true
      return { submitError: 'failed' }
    },
  })
  store.dispatch(form.actions.submit())
  await tick()
  assert.equal(ran, true)
  assert.equal(store.getState().form.status, 'error')
})

test('stale submission completions are ignored', () => {
  const { form, store } = make()
  store.dispatch(form.actions.submissionStarted({ requestId: 1 }))
  store.dispatch(form.actions.submissionSucceeded({ requestId: 2 }))
  assert.equal(store.getState().form.status, 'submitting')
  store.dispatch(form.actions.submissionSucceeded({ requestId: 1 }))
  assert.equal(store.getState().form.status, 'success')

  store.dispatch(form.actions.submissionStarted({ requestId: 3 }))
  store.dispatch(form.actions.submissionFailed({ requestId: 4, submitError: 'old' }))
  assert.equal(store.getState().form.status, 'submitting')
  store.dispatch(form.actions.cancelSubmit())
  assert.equal(store.getState().form.status, 'idle')
})

test('validationFailed ignores stale request ids', () => {
  const { form, store } = make()
  store.dispatch(form.actions.validationStarted({ requestId: 1 }))
  store.dispatch(form.actions.validationFailed({ requestId: 2, message: 'old' }))
  assert.equal(store.getState().form.validationStatus, 'validating')
  store.dispatch(form.actions.validationSucceeded({ requestId: 1, errors: {} }))
  assert.equal(store.getState().form.validationStatus, 'idle')
})

test('clearFieldErrorOnChange can be disabled', () => {
  const { form, store } = make({ clearFieldErrorOnChange: false })
  store.dispatch(form.actions.setFieldError({ path: 'name', error: 'required' }))
  store.dispatch(form.actions.fieldChanged('name', 'Ada'))
  assert.equal(store.getState().form.errors.name, 'required')
})
