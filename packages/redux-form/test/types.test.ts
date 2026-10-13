import { configureStore } from '@reduxjs/toolkit'
import { defineForm, type FormState } from '../src/index.js'

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
  fields: {
    name: value => value ? undefined : 'required',
  },
  onSubmit: async ({ values, signal }) => {
    void values
    void signal
  },
})

const targeted = profileForm.target((state: RootState) => state.profileForm)

const store = configureStore({
  reducer: { profileForm: profileForm.reducer },
  middleware: getDefaultMiddleware => getDefaultMiddleware().concat(targeted.middleware),
})

const email: string = targeted.selectors.value('email')(store.getState())
const city: string = targeted.selectors.value('addresses.0.city')(store.getState())
void email
void city

store.dispatch(profileForm.actions.fieldChanged('email', 'ada@example.com'))
store.dispatch(profileForm.actions.arrayAppend('addresses', { city: 'London' }))

// @ts-expect-error Unknown field path
profileForm.actions.fieldChanged('missing', 'x')

// @ts-expect-error Value type must match the path
profileForm.actions.fieldChanged('name', 1)

// @ts-expect-error Array append requires an array path
profileForm.actions.arrayAppend('name', { city: 'x' })
