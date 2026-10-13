/*
 * redux-form
 *
 * A small, Redux-first form runtime.
 *
 * Goals:
 * - all product form state is ordinary serialisable Redux state
 * - common form mechanics are generated once
 * - React is optional; selectors/actions are the public interface
 * - async validation/submission live in middleware, not components
 * - no hidden registry, context, provider, hook, or component state
 * - escape hatches remain ordinary Redux: wrap the reducer, listen to actions,
 *   write custom middleware, or derive whatever you need with selectors
 *
 * Runtime dependency: none.
 * Type dependency: `redux` only (`import type`).
 */

import type { Dispatch, Middleware, Reducer, UnknownAction } from 'redux'

// -------------------------------------------------------------------------------------------------
// Public utility types
// -------------------------------------------------------------------------------------------------

export type Primitive = string | number | boolean | bigint | symbol | null | undefined
export type Builtin = Primitive | Date | RegExp

export type DeepPartial<T> =
  T extends Builtin ? T
    : T extends readonly (infer U)[] ? readonly DeepPartial<U>[]
      : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T

type StringKeyOf<T> = Extract<keyof T, string | number>

type PathImpl<K extends string | number, V> =
  V extends Builtin
    ? `${K}`
    : V extends readonly (infer U)[]
      ? U extends Builtin
        ? `${K}` | `${K}.${number}`
        : `${K}` | `${K}.${number}` | `${K}.${number}.${FieldPath<U>}`
      : V extends object
        ? `${K}` | `${K}.${FieldPath<V>}`
        : `${K}`

/** Dot-separated paths. Object keys containing `.` are intentionally unsupported. */
export type FieldPath<T> =
  T extends object
    ? { [K in StringKeyOf<T>]-?: PathImpl<K, T[K]> }[StringKeyOf<T>]
    : never

type PathValueImpl<T, P extends string> =
  P extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
      ? PathValueImpl<T[Head], Rest>
      : T extends readonly (infer U)[]
        ? Head extends `${number}`
          ? PathValueImpl<U, Rest>
          : never
        : never
    : P extends keyof T
      ? T[P]
      : T extends readonly (infer U)[]
        ? P extends `${number}` ? U : never
        : never

export type FieldPathValue<T, P extends FieldPath<T>> =
  PathValueImpl<T, Extract<P, string>>

type ArrayPathImpl<K extends string | number, V> =
  V extends readonly (infer U)[]
    ? U extends object
      ? `${K}` | `${K}.${number}.${FieldArrayPath<U>}`
      : `${K}`
    : V extends object
      ? `${K}.${FieldArrayPath<V>}`
      : never

export type FieldArrayPath<T> =
  T extends object
    ? { [K in StringKeyOf<T>]-?: ArrayPathImpl<K, T[K]> }[StringKeyOf<T>]
    : never

export type FieldArrayElement<T, P extends FieldArrayPath<T>> =
  PathValueImpl<T, Extract<P, string>> extends readonly (infer U)[] ? U : never

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error'
export type ValidationStatus = 'idle' | 'validating'
export type ValidationTrigger = 'change' | 'blur' | 'submit' | 'manual'

export type FormErrors<TValues, TError> = Partial<Record<FieldPath<TValues>, TError>>

export interface FormState<TValues, TFieldError = string, TSubmitError = string> {
  values: TValues
  initialValues: TValues
  touched: Partial<Record<FieldPath<TValues>, true>>
  errors: FormErrors<TValues, TFieldError>
  formError?: TFieldError
  submitError?: TSubmitError
  validationError?: string
  status: FormStatus
  validationStatus: ValidationStatus
  submitCount: number
  disabled: boolean
  readOnly: boolean
  activeValidationId?: number
  activeSubmissionId?: number
}

export interface FormValidationResult<TValues, TFieldError> {
  errors?: FormErrors<TValues, TFieldError>
  formError?: TFieldError
}

export interface FormValidationContext<TValues, TRootState> {
  values: Readonly<TValues>
  initialValues: Readonly<TValues>
  rootState: TRootState
  reason: ValidationTrigger
  changedPath?: FieldPath<TValues>
  signal: AbortSignal
}

export interface FieldValidationContext<TValues, TRootState>
  extends FormValidationContext<TValues, TRootState> {
  path: FieldPath<TValues>
}

export type FormValidator<TValues, TFieldError, TRootState> = (
  context: FormValidationContext<TValues, TRootState>,
) => FormValidationResult<TValues, TFieldError> | void | Promise<FormValidationResult<TValues, TFieldError> | void>

export type FieldValidator<TValue, TValues, TFieldError, TRootState> = (
  value: Readonly<TValue>,
  context: FieldValidationContext<TValues, TRootState>,
) => TFieldError | undefined | Promise<TFieldError | undefined>

export type FieldValidatorMap<TValues, TFieldError, TRootState> = Partial<{
  [P in FieldPath<TValues>]: FieldValidator<FieldPathValue<TValues, P>, TValues, TFieldError, TRootState>
}>

export interface SubmitResult<TValues, TFieldError, TSubmitError> {
  /** Server-side field validation failures. */
  errors?: FormErrors<TValues, TFieldError>
  /** Server-side form-wide validation failure. */
  formError?: TFieldError
  /** Non-validation submission failure. */
  submitError?: TSubmitError
}

export interface SubmitContext<TValues, TRootState> {
  values: Readonly<TValues>
  initialValues: Readonly<TValues>
  rootState: TRootState
  dispatch: Dispatch<UnknownAction>
  getState: () => TRootState
  signal: AbortSignal
}

export type SubmitHandler<TValues, TFieldError, TSubmitError, TRootState> = (
  context: SubmitContext<TValues, TRootState>,
) => SubmitResult<TValues, TFieldError, TSubmitError> | void | Promise<SubmitResult<TValues, TFieldError, TSubmitError> | void>

export interface ReinitializeOptions {
  /** Preserve values that differ from the previous initial values. Arrays are preserved as a unit. */
  keepDirtyValues?: boolean
  keepTouched?: boolean
  keepSubmitState?: boolean
}

export interface FormConfig<TValues, TFieldError = string, TSubmitError = string, TRootState = unknown> {
  /** Unique action namespace, e.g. `profileForm`. */
  name: string
  initialValues: TValues

  /** Full-form validation. Ideal for schema adapters and cross-field validation. */
  validate?: FormValidator<TValues, TFieldError, TRootState>

  /** Exact-path validators. */
  fields?: FieldValidatorMap<TValues, TFieldError, TRootState>

  /**
   * Dynamic field validation escape hatch. Useful for field arrays where paths are not known when the form is defined.
   * It is called for every leaf path during a full validation pass.
   */
  validateField?: (
    path: FieldPath<TValues>,
    value: unknown,
    context: FieldValidationContext<TValues, TRootState>,
  ) => TFieldError | undefined | Promise<TFieldError | undefined>

  /** Defaults to ['blur', 'submit']. */
  validateOn?: readonly ValidationTrigger[]

  /** Debounce for change/blur/manual validation. Submit validation is never debounced. Defaults to 0. */
  validationDebounceMs?: number | Partial<Record<Exclude<ValidationTrigger, 'submit'>, number>>

  onSubmit?: SubmitHandler<TValues, TFieldError, TSubmitError, TRootState>

  /** Defaults to true. */
  clearFieldErrorOnChange?: boolean

  /** Defaults to true. A new submit aborts the previous one; stale completions are ignored either way. */
  abortPreviousSubmit?: boolean

  /** Override structural equality for dirty calculations. */
  isEqual?: (a: unknown, b: unknown) => boolean

  /** Map a thrown submit exception to your serialisable submit error type. Defaults to String(error). */
  mapSubmitError?: (error: unknown) => TSubmitError

  /**
   * First-class reducer escape hatch. Runs after the built-in reducer for every action.
   * Return a replacement state, or undefined to keep the built-in result.
   *
   * This is ordinary Redux reducer semantics; product-specific behaviour does not need a form-specific plugin API.
   */
  extraReducer?: (
    state: FormState<TValues, TFieldError, TSubmitError>,
    action: UnknownAction,
  ) => FormState<TValues, TFieldError, TSubmitError> | undefined
}

// -------------------------------------------------------------------------------------------------
// Redux-like action creator types (no runtime dependency on Redux Toolkit)
// -------------------------------------------------------------------------------------------------

export interface FormAction<P = undefined> extends UnknownAction {
  payload: P
}

export interface PayloadActionCreator<P> {
  (payload: P): FormAction<P>
  readonly type: string
  match(action: unknown): action is FormAction<P>
}

export interface EmptyActionCreator {
  (): FormAction<undefined>
  readonly type: string
  match(action: unknown): action is FormAction<undefined>
}

export interface PathValueActionCreator<TValues> {
  <P extends FieldPath<TValues>>(path: P, value: FieldPathValue<TValues, P>): FormAction<{ path: P; value: FieldPathValue<TValues, P> }>
  readonly type: string
  match(action: unknown): action is FormAction<{ path: FieldPath<TValues>; value: unknown }>
}

export interface PathActionCreator<TValues> {
  <P extends FieldPath<TValues>>(path: P): FormAction<{ path: P }>
  readonly type: string
  match(action: unknown): action is FormAction<{ path: FieldPath<TValues> }>
}

export interface ArrayAppendActionCreator<TValues> {
  <P extends FieldArrayPath<TValues>>(path: P, value: FieldArrayElement<TValues, P>): FormAction<{ path: P; value: FieldArrayElement<TValues, P> }>
  readonly type: string
  match(action: unknown): action is FormAction<{ path: FieldArrayPath<TValues>; value: unknown }>
}

export interface ArrayInsertActionCreator<TValues> {
  <P extends FieldArrayPath<TValues>>(path: P, index: number, value: FieldArrayElement<TValues, P>): FormAction<{ path: P; index: number; value: FieldArrayElement<TValues, P> }>
  readonly type: string
  match(action: unknown): action is FormAction<{ path: FieldArrayPath<TValues>; index: number; value: unknown }>
}

export interface ArrayIndexActionCreator<TValues> {
  <P extends FieldArrayPath<TValues>>(path: P, index: number): FormAction<{ path: P; index: number }>
  readonly type: string
  match(action: unknown): action is FormAction<{ path: FieldArrayPath<TValues>; index: number }>
}

export interface ArrayMoveActionCreator<TValues> {
  <P extends FieldArrayPath<TValues>>(path: P, from: number, to: number): FormAction<{ path: P; from: number; to: number }>
  readonly type: string
  match(action: unknown): action is FormAction<{ path: FieldArrayPath<TValues>; from: number; to: number }>
}

export interface FormActions<TValues, TFieldError, TSubmitError> {
  /** User-originated change. Ignored while the form is disabled/readOnly. */
  fieldChanged: PathValueActionCreator<TValues>
  fieldBlurred: PathActionCreator<TValues>

  /** Programmatic value mutations. These intentionally bypass disabled/readOnly. */
  setValue: PathValueActionCreator<TValues>
  patchValues: PayloadActionCreator<DeepPartial<TValues>>
  replaceValues: PayloadActionCreator<TValues>

  arrayAppend: ArrayAppendActionCreator<TValues>
  arrayInsert: ArrayInsertActionCreator<TValues>
  arrayRemove: ArrayIndexActionCreator<TValues>
  arrayMove: ArrayMoveActionCreator<TValues>

  touch: PathActionCreator<TValues>
  touchAll: EmptyActionCreator
  untouch: PathActionCreator<TValues>
  clearTouched: EmptyActionCreator

  setFieldError: PayloadActionCreator<{ path: FieldPath<TValues>; error: TFieldError | undefined }>
  setErrors: PayloadActionCreator<FormErrors<TValues, TFieldError>>
  clearErrors: EmptyActionCreator
  setFormError: PayloadActionCreator<TFieldError | undefined>
  setSubmitError: PayloadActionCreator<TSubmitError | undefined>

  setDisabled: PayloadActionCreator<boolean>
  setReadOnly: PayloadActionCreator<boolean>

  reset: EmptyActionCreator
  reinitialize: PayloadActionCreator<{ values: TValues; options?: ReinitializeOptions }>

  validate: PayloadActionCreator<{ path?: FieldPath<TValues> }>
  submit: EmptyActionCreator
  cancelValidation: EmptyActionCreator
  cancelSubmit: EmptyActionCreator

  /** Public lifecycle actions for custom submission middleware/logic. */
  submissionStarted: PayloadActionCreator<{ requestId?: number }>
  submissionSucceeded: PayloadActionCreator<{ requestId?: number }>
  submissionFailed: PayloadActionCreator<{
    requestId?: number
    errors?: FormErrors<TValues, TFieldError>
    formError?: TFieldError
    submitError?: TSubmitError
  }>

  /** Internal validation lifecycle actions. Exposed for transparency/testing, but normally dispatched by the middleware. */
  validationStarted: PayloadActionCreator<{ requestId: number }>
  validationSucceeded: PayloadActionCreator<{
    requestId: number
    errors: FormErrors<TValues, TFieldError>
    formError?: TFieldError
  }>
  validationFailed: PayloadActionCreator<{ requestId: number; message: string }>
}

// -------------------------------------------------------------------------------------------------
// Selectors
// -------------------------------------------------------------------------------------------------

export interface LocalFormSelectors<TValues, TFieldError, TSubmitError> {
  values(state: FormState<TValues, TFieldError, TSubmitError>): TValues
  initialValues(state: FormState<TValues, TFieldError, TSubmitError>): TValues
  errors(state: FormState<TValues, TFieldError, TSubmitError>): FormErrors<TValues, TFieldError>
  formError(state: FormState<TValues, TFieldError, TSubmitError>): TFieldError | undefined
  submitError(state: FormState<TValues, TFieldError, TSubmitError>): TSubmitError | undefined
  status(state: FormState<TValues, TFieldError, TSubmitError>): FormStatus
  validationStatus(state: FormState<TValues, TFieldError, TSubmitError>): ValidationStatus
  submitCount(state: FormState<TValues, TFieldError, TSubmitError>): number
  disabled(state: FormState<TValues, TFieldError, TSubmitError>): boolean
  readOnly(state: FormState<TValues, TFieldError, TSubmitError>): boolean

  value<P extends FieldPath<TValues>>(path: P): (state: FormState<TValues, TFieldError, TSubmitError>) => FieldPathValue<TValues, P>
  error<P extends FieldPath<TValues>>(path: P): (state: FormState<TValues, TFieldError, TSubmitError>) => TFieldError | undefined
  touched<P extends FieldPath<TValues>>(path: P): (state: FormState<TValues, TFieldError, TSubmitError>) => boolean
  dirty<P extends FieldPath<TValues>>(path: P): (state: FormState<TValues, TFieldError, TSubmitError>) => boolean

  isDirty(state: FormState<TValues, TFieldError, TSubmitError>): boolean
  isValid(state: FormState<TValues, TFieldError, TSubmitError>): boolean
  isValidating(state: FormState<TValues, TFieldError, TSubmitError>): boolean
  isSubmitting(state: FormState<TValues, TFieldError, TSubmitError>): boolean
  canSubmit(state: FormState<TValues, TFieldError, TSubmitError>): boolean
}

export interface TargetedFormSelectors<TRootState, TValues, TFieldError, TSubmitError> {
  values(state: TRootState): TValues
  initialValues(state: TRootState): TValues
  errors(state: TRootState): FormErrors<TValues, TFieldError>
  formError(state: TRootState): TFieldError | undefined
  submitError(state: TRootState): TSubmitError | undefined
  status(state: TRootState): FormStatus
  validationStatus(state: TRootState): ValidationStatus
  submitCount(state: TRootState): number
  disabled(state: TRootState): boolean
  readOnly(state: TRootState): boolean

  value<P extends FieldPath<TValues>>(path: P): (state: TRootState) => FieldPathValue<TValues, P>
  error<P extends FieldPath<TValues>>(path: P): (state: TRootState) => TFieldError | undefined
  touched<P extends FieldPath<TValues>>(path: P): (state: TRootState) => boolean
  dirty<P extends FieldPath<TValues>>(path: P): (state: TRootState) => boolean

  isDirty(state: TRootState): boolean
  isValid(state: TRootState): boolean
  isValidating(state: TRootState): boolean
  isSubmitting(state: TRootState): boolean
  canSubmit(state: TRootState): boolean
}

export interface TargetedForm<TRootState, TValues, TFieldError, TSubmitError> {
  selectors: TargetedFormSelectors<TRootState, TValues, TFieldError, TSubmitError>
  middleware: Middleware<object, TRootState, Dispatch<UnknownAction>>
}

export interface FormDefinition<TValues, TFieldError = string, TSubmitError = string> {
  name: string
  reducer: Reducer<FormState<TValues, TFieldError, TSubmitError>, UnknownAction>
  actions: FormActions<TValues, TFieldError, TSubmitError>
  selectors: LocalFormSelectors<TValues, TFieldError, TSubmitError>
  getInitialState(): FormState<TValues, TFieldError, TSubmitError>
  createMiddleware<TRootState>(
    selectFormState: (rootState: TRootState) => FormState<TValues, TFieldError, TSubmitError>,
  ): Middleware<object, TRootState, Dispatch<UnknownAction>>
  target<TRootState>(
    selectFormState: (rootState: TRootState) => FormState<TValues, TFieldError, TSubmitError>,
  ): TargetedForm<TRootState, TValues, TFieldError, TSubmitError>
}

// -------------------------------------------------------------------------------------------------
// Runtime helpers
// -------------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function defaultFormEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (!defaultFormEqual(a[i], b[i])) return false
    }
    return true
  }

  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    for (const key of aKeys) {
      if (!Object.hasOwn(b, key)) return false
      if (!defaultFormEqual(a[key], b[key])) return false
    }
    return true
  }

  return false
}

function splitPath(path: string): string[] {
  if (!path) throw new Error('Form field paths cannot be empty')
  return path.split('.')
}

export function getIn<T = unknown>(object: unknown, path: string): T {
  let current: unknown = object
  for (const segment of splitPath(path)) {
    if (current == null) return undefined as T
    current = (current as Record<string, unknown>)[segment]
  }
  return current as T
}

function isArrayIndex(segment: string): boolean {
  return /^(0|[1-9]\d*)$/.test(segment)
}

export function setIn<T>(object: T, path: string, value: unknown): T {
  const segments = splitPath(path)

  const visit = (current: unknown, index: number): unknown => {
    if (index === segments.length) return value

    const key = segments[index]
    const nextKey = segments[index + 1]
    const shouldBeArray = nextKey !== undefined && isArrayIndex(nextKey)

    if (Array.isArray(current)) {
      const copy = current.slice()
      const arrayIndex = Number(key)
      if (!Number.isInteger(arrayIndex) || arrayIndex < 0) {
        throw new Error(`Expected array index in path "${path}", received "${key}"`)
      }
      copy[arrayIndex] = visit(copy[arrayIndex], index + 1)
      return copy
    }

    const source = isRecord(current) ? current : {}
    const copy: Record<string, unknown> = { ...source }
    const child = copy[key as string] ?? (shouldBeArray ? [] : {})
    copy[key as string] = visit(child, index + 1)
    return copy
  }

  return visit(object, 0) as T
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (Array.isArray(patch)) return patch.slice() as T
  if (!isRecord(base) || !isRecord(patch)) return patch as T

  const result: Record<string, unknown> = { ...base }
  for (const [key, patchValue] of Object.entries(patch)) {
    if (patchValue === undefined) {
      result[key] = patchValue
      continue
    }

    const baseValue = result[key]
    result[key] = isRecord(baseValue) && isRecord(patchValue)
      ? deepMerge(baseValue, patchValue)
      : Array.isArray(patchValue)
        ? patchValue.slice()
        : patchValue
  }
  return result as T
}

function leafPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    if (value.length === 0) return prefix ? [prefix] : []
    return value.flatMap((item, index) => leafPaths(item, prefix ? `${prefix}.${index}` : `${index}`))
  }

  if (isRecord(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) return prefix ? [prefix] : []
    return keys.flatMap(key => leafPaths(value[key], prefix ? `${prefix}.${key}` : key))
  }

  return prefix ? [prefix] : []
}

function touchEveryLeaf<TValues>(values: TValues): Partial<Record<FieldPath<TValues>, true>> {
  return Object.fromEntries(leafPaths(values).map(path => [path, true])) as Partial<Record<FieldPath<TValues>, true>>
}

function preserveDirtyValues<T>(
  current: T,
  previousInitial: T,
  nextInitial: T,
  equal: (a: unknown, b: unknown) => boolean,
): T {
  if (equal(current, previousInitial)) return nextInitial

  if (Array.isArray(current) || Array.isArray(previousInitial) || Array.isArray(nextInitial)) {
    // Index semantics become ambiguous when arrays are reordered. Preserve the current array as a unit.
    return current
  }

  if (isRecord(current) && isRecord(previousInitial) && isRecord(nextInitial)) {
    const keys = new Set([...Object.keys(current), ...Object.keys(previousInitial), ...Object.keys(nextInitial)])
    const result: Record<string, unknown> = { ...nextInitial }
    for (const key of keys) {
      result[key] = preserveDirtyValues(
        current[key],
        previousInitial[key],
        nextInitial[key],
        equal,
      )
    }
    return result as T
  }

  return current
}

function hasOwnErrors(errors: Record<string, unknown>): boolean {
  return Object.keys(errors).some(key => errors[key] !== undefined)
}

function remapArrayPathMap<V>(
  map: Partial<Record<string, V>>,
  arrayPath: string,
  mapIndex: (index: number) => number | undefined,
): Partial<Record<string, V>> {
  const prefix = `${arrayPath}.`
  const next: Partial<Record<string, V>> = {}

  for (const [key, value] of Object.entries(map) as Array<[string, V | undefined]>) {
    if (value === undefined) continue
    if (!key.startsWith(prefix)) {
      next[key] = value
      continue
    }

    const rest = key.slice(prefix.length)
    const [indexPart, ...suffixParts] = rest.split('.')
    if (!isArrayIndex(indexPart as string)) {
      next[key] = value
      continue
    }

    const mapped = mapIndex(Number(indexPart))
    if (mapped === undefined) continue
    const suffix = suffixParts.length > 0 ? `.${suffixParts.join('.')}` : ''
    next[`${prefix}${mapped}${suffix}`] = value
  }

  return next
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function defineActionMetadata<T extends (...args: never[]) => unknown>(fn: T, type: string): T {
  Object.defineProperty(fn, 'type', { value: type, enumerable: true })
  Object.defineProperty(fn, 'match', {
    value: (action: unknown) => isRecord(action) && action.type === type,
    enumerable: true,
  })
  return fn
}

function payloadAction<P>(type: string): PayloadActionCreator<P> {
  return defineActionMetadata(
    ((payload: P) => ({ type, payload })) as unknown as PayloadActionCreator<P>,
    type,
  )
}

function emptyAction(type: string): EmptyActionCreator {
  return defineActionMetadata(
    (() => ({ type, payload: undefined })) as unknown as EmptyActionCreator,
    type,
  )
}

function pathValueAction<TValues>(type: string): PathValueActionCreator<TValues> {
  return defineActionMetadata(
    ((path: string, value: unknown) => ({ type, payload: { path, value } })) as unknown as PathValueActionCreator<TValues>,
    type,
  )
}

function pathAction<TValues>(type: string): PathActionCreator<TValues> {
  return defineActionMetadata(
    ((path: string) => ({ type, payload: { path } })) as unknown as PathActionCreator<TValues>,
    type,
  )
}

function arrayAppendAction<TValues>(type: string): ArrayAppendActionCreator<TValues> {
  return defineActionMetadata(
    ((path: string, value: unknown) => ({ type, payload: { path, value } })) as unknown as ArrayAppendActionCreator<TValues>,
    type,
  )
}

function arrayInsertAction<TValues>(type: string): ArrayInsertActionCreator<TValues> {
  return defineActionMetadata(
    ((path: string, index: number, value: unknown) => ({ type, payload: { path, index, value } })) as unknown as ArrayInsertActionCreator<TValues>,
    type,
  )
}

function arrayIndexAction<TValues>(type: string): ArrayIndexActionCreator<TValues> {
  return defineActionMetadata(
    ((path: string, index: number) => ({ type, payload: { path, index } })) as unknown as ArrayIndexActionCreator<TValues>,
    type,
  )
}

function arrayMoveAction<TValues>(type: string): ArrayMoveActionCreator<TValues> {
  return defineActionMetadata(
    ((path: string, from: number, to: number) => ({ type, payload: { path, from, to } })) as unknown as ArrayMoveActionCreator<TValues>,
    type,
  )
}

function createActions<TValues, TFieldError, TSubmitError>(name: string): FormActions<TValues, TFieldError, TSubmitError> {
  const type = (suffix: string) => `${name}/${suffix}`

  return {
    fieldChanged: pathValueAction(type('fieldChanged')),
    fieldBlurred: pathAction(type('fieldBlurred')),
    setValue: pathValueAction(type('setValue')),
    patchValues: payloadAction(type('patchValues')),
    replaceValues: payloadAction(type('replaceValues')),

    arrayAppend: arrayAppendAction(type('arrayAppend')),
    arrayInsert: arrayInsertAction(type('arrayInsert')),
    arrayRemove: arrayIndexAction(type('arrayRemove')),
    arrayMove: arrayMoveAction(type('arrayMove')),

    touch: pathAction(type('touch')),
    touchAll: emptyAction(type('touchAll')),
    untouch: pathAction(type('untouch')),
    clearTouched: emptyAction(type('clearTouched')),

    setFieldError: payloadAction(type('setFieldError')),
    setErrors: payloadAction(type('setErrors')),
    clearErrors: emptyAction(type('clearErrors')),
    setFormError: payloadAction(type('setFormError')),
    setSubmitError: payloadAction(type('setSubmitError')),

    setDisabled: payloadAction(type('setDisabled')),
    setReadOnly: payloadAction(type('setReadOnly')),

    reset: emptyAction(type('reset')),
    reinitialize: payloadAction(type('reinitialize')),

    validate: payloadAction(type('validate')),
    submit: emptyAction(type('submit')),
    cancelValidation: emptyAction(type('cancelValidation')),
    cancelSubmit: emptyAction(type('cancelSubmit')),

    submissionStarted: payloadAction(type('submissionStarted')),
    submissionSucceeded: payloadAction(type('submissionSucceeded')),
    submissionFailed: payloadAction(type('submissionFailed')),

    validationStarted: payloadAction(type('validationStarted')),
    validationSucceeded: payloadAction(type('validationSucceeded')),
    validationFailed: payloadAction(type('validationFailed')),
  }
}

// -------------------------------------------------------------------------------------------------
// Library
// -------------------------------------------------------------------------------------------------

export function defineForm<
  TValues,
  TFieldError = string,
  TSubmitError = string,
>(
  config: FormConfig<TValues, TFieldError, TSubmitError>,
): FormDefinition<TValues, TFieldError, TSubmitError> {
  if (!config.name.trim()) throw new Error('defineForm requires a non-empty name')

  const actions = createActions<TValues, TFieldError, TSubmitError>(config.name)
  const equal = config.isEqual ?? defaultFormEqual
  const validateOn = new Set<ValidationTrigger>(config.validateOn ?? ['blur', 'submit'])
  const clearFieldErrorOnChange = config.clearFieldErrorOnChange ?? true

  const getInitialState = (): FormState<TValues, TFieldError, TSubmitError> => ({
    values: config.initialValues,
    initialValues: config.initialValues,
    touched: {},
    errors: {},
    status: 'idle',
    validationStatus: 'idle',
    submitCount: 0,
    disabled: false,
    readOnly: false,
  })

  const coreReducer: Reducer<FormState<TValues, TFieldError, TSubmitError>, UnknownAction> = (
    state = getInitialState(),
    action,
  ) => {
    if (actions.fieldChanged.match(action)) {
      if (state.disabled || state.readOnly) return state
      const path = action.payload.path as FieldPath<TValues>
      const nextErrors = { ...state.errors }
      if (clearFieldErrorOnChange) delete nextErrors[path]

      return {
        ...state,
        values: setIn(state.values, path as string, action.payload.value),
        errors: clearFieldErrorOnChange ? nextErrors : state.errors,
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.setValue.match(action)) {
      return {
        ...state,
        values: setIn(state.values, action.payload.path as string, action.payload.value),
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.patchValues.match(action)) {
      return {
        ...state,
        values: deepMerge(state.values, action.payload),
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.replaceValues.match(action)) {
      return {
        ...state,
        values: action.payload,
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.arrayAppend.match(action)) {
      if (state.disabled || state.readOnly) return state
      const array = getIn<unknown[]>(state.values, action.payload.path as string)
      if (!Array.isArray(array)) throw new Error(`arrayAppend expected an array at "${String(action.payload.path)}"`)
      return {
        ...state,
        values: setIn(state.values, action.payload.path as string, [...array, action.payload.value]),
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.arrayInsert.match(action)) {
      if (state.disabled || state.readOnly) return state
      const array = getIn<unknown[]>(state.values, action.payload.path as string)
      if (!Array.isArray(array)) throw new Error(`arrayInsert expected an array at "${String(action.payload.path)}"`)
      const index = Math.max(0, Math.min(action.payload.index, array.length))
      const next = array.slice()
      next.splice(index, 0, action.payload.value)
      const arrayPath = action.payload.path as string
      const remap = (index: number) => index >= action.payload.index ? index + 1 : index
      return {
        ...state,
        values: setIn(state.values, arrayPath, next),
        touched: remapArrayPathMap(state.touched as Partial<Record<string, true>>, arrayPath, remap) as Partial<Record<FieldPath<TValues>, true>>,
        errors: remapArrayPathMap(state.errors as Partial<Record<string, TFieldError>>, arrayPath, remap) as FormErrors<TValues, TFieldError>,
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.arrayRemove.match(action)) {
      if (state.disabled || state.readOnly) return state
      const array = getIn<unknown[]>(state.values, action.payload.path as string)
      if (!Array.isArray(array)) throw new Error(`arrayRemove expected an array at "${String(action.payload.path)}"`)
      if (action.payload.index < 0 || action.payload.index >= array.length) return state
      const next = array.slice()
      next.splice(action.payload.index, 1)
      const arrayPath = action.payload.path as string
      const removed = action.payload.index
      const remap = (index: number) => index === removed ? undefined : index > removed ? index - 1 : index
      return {
        ...state,
        values: setIn(state.values, arrayPath, next),
        touched: remapArrayPathMap(state.touched as Partial<Record<string, true>>, arrayPath, remap) as Partial<Record<FieldPath<TValues>, true>>,
        errors: remapArrayPathMap(state.errors as Partial<Record<string, TFieldError>>, arrayPath, remap) as FormErrors<TValues, TFieldError>,
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.arrayMove.match(action)) {
      if (state.disabled || state.readOnly) return state
      const array = getIn<unknown[]>(state.values, action.payload.path as string)
      if (!Array.isArray(array)) throw new Error(`arrayMove expected an array at "${String(action.payload.path)}"`)
      const { from, to } = action.payload
      if (from < 0 || from >= array.length || to < 0 || to >= array.length || from === to) return state
      const next = array.slice()
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      const arrayPath = action.payload.path as string
      const remap = (index: number): number => {
        if (index === from) return to
        if (from < to && index > from && index <= to) return index - 1
        if (to < from && index >= to && index < from) return index + 1
        return index
      }
      return {
        ...state,
        values: setIn(state.values, arrayPath, next),
        touched: remapArrayPathMap(state.touched as Partial<Record<string, true>>, arrayPath, remap) as Partial<Record<FieldPath<TValues>, true>>,
        errors: remapArrayPathMap(state.errors as Partial<Record<string, TFieldError>>, arrayPath, remap) as FormErrors<TValues, TFieldError>,
        submitError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.fieldBlurred.match(action)) {
      if (state.disabled || state.readOnly) return state
      const path = action.payload.path as FieldPath<TValues>
      if (state.touched[path]) return state
      return { ...state, touched: { ...state.touched, [path]: true } }
    }

    if (actions.touch.match(action)) {
      const path = action.payload.path as FieldPath<TValues>
      if (state.touched[path]) return state
      return { ...state, touched: { ...state.touched, [path]: true } }
    }

    if (actions.touchAll.match(action)) {
      return { ...state, touched: touchEveryLeaf(state.values) }
    }

    if (actions.untouch.match(action)) {
      const path = action.payload.path as FieldPath<TValues>
      if (!state.touched[path]) return state
      const touched = { ...state.touched }
      delete touched[path]
      return { ...state, touched }
    }

    if (actions.clearTouched.match(action)) {
      return Object.keys(state.touched).length === 0 ? state : { ...state, touched: {} }
    }

    if (actions.setFieldError.match(action)) {
      const { path, error } = action.payload
      const errors = { ...state.errors }
      if (error === undefined) delete errors[path]
      else errors[path] = error
      return { ...state, errors }
    }

    if (actions.setErrors.match(action)) {
      return { ...state, errors: action.payload }
    }

    if (actions.clearErrors.match(action)) {
      return {
        ...state,
        errors: {},
        formError: undefined,
        validationError: undefined,
      }
    }

    if (actions.setFormError.match(action)) return { ...state, formError: action.payload }
    if (actions.setSubmitError.match(action)) return { ...state, submitError: action.payload }
    if (actions.setDisabled.match(action)) return { ...state, disabled: action.payload }
    if (actions.setReadOnly.match(action)) return { ...state, readOnly: action.payload }

    if (actions.reset.match(action)) {
      return {
        ...state,
        values: state.initialValues,
        touched: {},
        errors: {},
        formError: undefined,
        submitError: undefined,
        validationError: undefined,
        status: 'idle',
        validationStatus: 'idle',
        submitCount: 0,
        activeValidationId: undefined,
        activeSubmissionId: undefined,
      }
    }

    if (actions.reinitialize.match(action)) {
      const options = action.payload.options ?? {}
      const values = options.keepDirtyValues
        ? preserveDirtyValues(state.values, state.initialValues, action.payload.values, equal)
        : action.payload.values

      return {
        ...state,
        values,
        initialValues: action.payload.values,
        touched: options.keepTouched ? state.touched : {},
        errors: {},
        formError: undefined,
        validationError: undefined,
        validationStatus: 'idle',
        activeValidationId: undefined,
        submitError: options.keepSubmitState ? state.submitError : undefined,
        status: options.keepSubmitState ? state.status : 'idle',
        submitCount: options.keepSubmitState ? state.submitCount : 0,
        activeSubmissionId: options.keepSubmitState ? state.activeSubmissionId : undefined,
      }
    }

    if (actions.submit.match(action)) {
      if (state.disabled || state.readOnly) return state
      return {
        ...state,
        touched: touchEveryLeaf(state.values),
        submitCount: state.submitCount + 1,
        submitError: undefined,
        status: state.status === 'submitting' ? state.status : 'idle',
      }
    }

    if (actions.submissionStarted.match(action)) {
      return {
        ...state,
        status: 'submitting',
        submitError: undefined,
        activeSubmissionId: action.payload.requestId,
      }
    }

    if (actions.submissionSucceeded.match(action)) {
      if (
        action.payload.requestId !== undefined
        && state.activeSubmissionId !== undefined
        && action.payload.requestId !== state.activeSubmissionId
      ) return state

      return {
        ...state,
        status: 'success',
        submitError: undefined,
        activeSubmissionId: undefined,
      }
    }

    if (actions.submissionFailed.match(action)) {
      if (
        action.payload.requestId !== undefined
        && state.activeSubmissionId !== undefined
        && action.payload.requestId !== state.activeSubmissionId
      ) return state

      return {
        ...state,
        status: 'error',
        errors: action.payload.errors ?? state.errors,
        formError: action.payload.formError ?? state.formError,
        submitError: action.payload.submitError,
        activeSubmissionId: undefined,
      }
    }

    if (actions.validationStarted.match(action)) {
      return {
        ...state,
        validationStatus: 'validating',
        validationError: undefined,
        activeValidationId: action.payload.requestId,
      }
    }

    if (actions.validationSucceeded.match(action)) {
      if (state.activeValidationId !== action.payload.requestId) return state
      return {
        ...state,
        validationStatus: 'idle',
        validationError: undefined,
        activeValidationId: undefined,
        errors: action.payload.errors,
        formError: action.payload.formError,
      }
    }

    if (actions.validationFailed.match(action)) {
      if (state.activeValidationId !== action.payload.requestId) return state
      return {
        ...state,
        validationStatus: 'idle',
        validationError: action.payload.message,
        activeValidationId: undefined,
      }
    }

    if (actions.cancelValidation.match(action)) {
      return {
        ...state,
        validationStatus: 'idle',
        activeValidationId: undefined,
      }
    }

    if (actions.cancelSubmit.match(action)) {
      return {
        ...state,
        status: state.status === 'submitting' ? 'idle' : state.status,
        activeSubmissionId: undefined,
      }
    }

    return state
  }

  const reducer: Reducer<FormState<TValues, TFieldError, TSubmitError>, UnknownAction> = (state, action) => {
    const next = coreReducer(state, action)
    return config.extraReducer?.(next, action) ?? next
  }

  const selectors: LocalFormSelectors<TValues, TFieldError, TSubmitError> = {
    values: state => state.values,
    initialValues: state => state.initialValues,
    errors: state => state.errors,
    formError: state => state.formError,
    submitError: state => state.submitError,
    status: state => state.status,
    validationStatus: state => state.validationStatus,
    submitCount: state => state.submitCount,
    disabled: state => state.disabled,
    readOnly: state => state.readOnly,

    value: path => state => getIn(state.values, path as string),
    error: path => state => state.errors[path],
    touched: path => state => Boolean(state.touched[path]),
    dirty: path => state => !equal(
      getIn(state.values, path as string),
      getIn(state.initialValues, path as string),
    ),

    isDirty: state => !equal(state.values, state.initialValues),
    isValid: state => !hasOwnErrors(state.errors as Record<string, unknown>) && state.formError === undefined && state.validationError === undefined,
    isValidating: state => state.validationStatus === 'validating',
    isSubmitting: state => state.status === 'submitting',
    canSubmit: state => (
      !state.disabled
      && !state.readOnly
      && state.status !== 'submitting'
      && state.validationStatus !== 'validating'
      && !hasOwnErrors(state.errors as Record<string, unknown>)
      && state.formError === undefined
      && state.validationError === undefined
    ),
  }

  const debounceFor = (reason: Exclude<ValidationTrigger, 'submit'>): number => {
    const configured = config.validationDebounceMs
    if (typeof configured === 'number') return Math.max(0, configured)
    return Math.max(0, configured?.[reason] ?? 0)
  }

  const createMiddleware = <TRootState,>(
    selectFormState: (rootState: TRootState) => FormState<TValues, TFieldError, TSubmitError>,
  ): Middleware<object, TRootState, Dispatch<UnknownAction>> => {
    let validationRequestId = 0
    let submissionRequestId = 0
    let validationController: AbortController | undefined
    let submissionController: AbortController | undefined
    let validationTimer: ReturnType<typeof setTimeout> | undefined

    const cancelValidation = () => {
      if (validationTimer !== undefined) {
        clearTimeout(validationTimer)
        validationTimer = undefined
      }
      validationController?.abort()
      validationController = undefined
    }

    const cancelSubmission = () => {
      submissionController?.abort()
      submissionController = undefined
    }

    return api => next => action => {
      const previousForm = selectFormState(api.getState())
      const result = next(action)
      const currentForm = selectFormState(api.getState())

      const runValidation = async (
        reason: ValidationTrigger,
        changedPath?: FieldPath<TValues>,
      ): Promise<FormValidationResult<TValues, TFieldError> & { valid: boolean }> => {
        cancelValidation()
        const requestId = ++validationRequestId
        const controller = new AbortController()
        validationController = controller

        api.dispatch(actions.validationStarted({ requestId }))

        const rootState = api.getState()
        const form = selectFormState(rootState)
        const baseContext: FormValidationContext<TValues, TRootState> = {
          values: form.values,
          initialValues: form.initialValues,
          rootState,
          reason,
          changedPath,
          signal: controller.signal,
        }

        try {
          const formResult = await config.validate?.(baseContext)
          if (controller.signal.aborted) return { errors: {}, valid: false }

          const errors: FormErrors<TValues, TFieldError> = { ...(formResult?.errors ?? {}) }
          const paths = [...new Set([
            ...leafPaths(form.values),
            ...Object.keys(config.fields ?? {}),
          ])] as FieldPath<TValues>[]

          const fieldResults = await Promise.all(paths.map(async path => {
            const context: FieldValidationContext<TValues, TRootState> = {
              ...baseContext,
              path,
            }

            const exactValidator = config.fields?.[path] as FieldValidator<unknown, TValues, TFieldError, TRootState> | undefined
            const exactError = exactValidator
              ? await exactValidator(getIn(form.values, path as string), context)
              : undefined

            if (controller.signal.aborted) return [path, undefined] as const

            const dynamicError = config.validateField
              ? await config.validateField(path, getIn(form.values, path as string), context)
              : undefined

            return [path, dynamicError ?? exactError] as const
          }))

          if (controller.signal.aborted) return { errors: {}, valid: false }

          for (const [path, fieldError] of fieldResults) {
            if (fieldError === undefined) {
              if (errors[path] === undefined) delete errors[path]
            } else {
              errors[path] = fieldError
            }
          }

          api.dispatch(actions.validationSucceeded({
            requestId,
            errors,
            formError: formResult?.formError,
          }))

          const valid = !hasOwnErrors(errors as Record<string, unknown>) && formResult?.formError === undefined
          return { errors, formError: formResult?.formError, valid }
        } catch (error) {
          if (controller.signal.aborted) return { errors: {}, valid: false }
          api.dispatch(actions.validationFailed({ requestId, message: errorMessage(error) }))
          return { errors: {}, valid: false }
        } finally {
          if (validationController === controller) validationController = undefined
        }
      }

      const scheduleValidation = (reason: Exclude<ValidationTrigger, 'submit'>, path?: FieldPath<TValues>) => {
        cancelValidation()
        const delay = debounceFor(reason)
        if (delay === 0) {
          void runValidation(reason, path)
          return
        }

        validationTimer = setTimeout(() => {
          validationTimer = undefined
          void runValidation(reason, path)
        }, delay)
      }

      const runSubmit = async () => {
        if (currentForm.disabled || currentForm.readOnly) return

        if (config.abortPreviousSubmit ?? true) {
          const hadActiveSubmission = submissionController !== undefined
          cancelSubmission()
          if (hadActiveSubmission) api.dispatch(actions.cancelSubmit())
        }

        // Reserve the generation before validation so any older completion is stale immediately.
        const requestId = ++submissionRequestId
        const validation = await runValidation('submit')
        if (!validation.valid || requestId !== submissionRequestId) return

        // A custom listener can own submission entirely by omitting onSubmit.
        if (!config.onSubmit) return

        const controller = new AbortController()
        submissionController = controller
        api.dispatch(actions.submissionStarted({ requestId }))

        try {
          const rootState = api.getState()
          const form = selectFormState(rootState)
          const submitResult = await config.onSubmit({
            values: form.values,
            initialValues: form.initialValues,
            rootState,
            dispatch: api.dispatch,
            getState: api.getState,
            signal: controller.signal,
          })

          if (controller.signal.aborted || requestId !== submissionRequestId) return

          const failed = Boolean(
            submitResult?.submitError !== undefined
            || submitResult?.formError !== undefined
            || (submitResult?.errors && hasOwnErrors(submitResult.errors as Record<string, unknown>)),
          )

          if (failed) {
            api.dispatch(actions.submissionFailed({
              requestId,
              errors: submitResult?.errors,
              formError: submitResult?.formError,
              submitError: submitResult?.submitError,
            }))
          } else {
            api.dispatch(actions.submissionSucceeded({ requestId }))
          }
        } catch (error) {
          if (controller.signal.aborted || requestId !== submissionRequestId) return
          api.dispatch(actions.submissionFailed({
            requestId,
            submitError: config.mapSubmitError
              ? config.mapSubmitError(error)
              : String(error) as TSubmitError,
          }))
        } finally {
          if (submissionController === controller) submissionController = undefined
        }
      }

      const valueMutation = (
        actions.fieldChanged.match(action)
        || actions.setValue.match(action)
        || actions.patchValues.match(action)
        || actions.replaceValues.match(action)
        || actions.arrayAppend.match(action)
        || actions.arrayInsert.match(action)
        || actions.arrayRemove.match(action)
        || actions.arrayMove.match(action)
        || actions.reset.match(action)
        || actions.reinitialize.match(action)
      )

      if (valueMutation) cancelValidation()

      if (actions.reset.match(action) || actions.reinitialize.match(action)) {
        cancelSubmission()
      }

      if (actions.cancelValidation.match(action)) {
        cancelValidation()
        return result
      }

      if (actions.cancelSubmit.match(action)) {
        cancelSubmission()
        return result
      }

      if (actions.validate.match(action)) {
        scheduleValidation('manual', action.payload.path)
        return result
      }

      if (actions.submit.match(action)) {
        if (validateOn.has('submit')) void runSubmit()
        else if (config.onSubmit) {
          // Explicitly disabled submit validation.
          const runWithoutValidation = async () => {
            if (currentForm.disabled || currentForm.readOnly) return
            if (config.abortPreviousSubmit ?? true) cancelSubmission()

            const requestId = ++submissionRequestId
            const controller = new AbortController()
            submissionController = controller
            api.dispatch(actions.submissionStarted({ requestId }))

            try {
              const rootState = api.getState()
              const form = selectFormState(rootState)
              const submitResult = await config.onSubmit!({
                values: form.values,
                initialValues: form.initialValues,
                rootState,
                dispatch: api.dispatch,
                getState: api.getState,
                signal: controller.signal,
              })

              if (controller.signal.aborted || requestId !== submissionRequestId) return

              const failed = Boolean(
                submitResult?.submitError !== undefined
                || submitResult?.formError !== undefined
                || (submitResult?.errors && hasOwnErrors(submitResult.errors as Record<string, unknown>)),
              )

              if (failed) api.dispatch(actions.submissionFailed({ requestId, ...submitResult }))
              else api.dispatch(actions.submissionSucceeded({ requestId }))
            } catch (error) {
              if (controller.signal.aborted || requestId !== submissionRequestId) return
              api.dispatch(actions.submissionFailed({
                requestId,
                submitError: config.mapSubmitError
                  ? config.mapSubmitError(error)
                  : String(error) as TSubmitError,
              }))
            } finally {
              if (submissionController === controller) submissionController = undefined
            }
          }

          void runWithoutValidation()
        }
        return result
      }

      if (actions.fieldChanged.match(action) && validateOn.has('change')) {
        if (currentForm.disabled || currentForm.readOnly) return result
        const path = action.payload.path as FieldPath<TValues>
        const before = getIn(previousForm.values, path as string)
        const after = getIn(currentForm.values, path as string)
        if (!equal(before, after)) scheduleValidation('change', path)
        return result
      }

      if (actions.fieldBlurred.match(action) && validateOn.has('blur')) {
        if (!currentForm.disabled && !currentForm.readOnly) {
          scheduleValidation('blur', action.payload.path as FieldPath<TValues>)
        }
      }

      return result
    }
  }

  const target = <TRootState,>(
    selectFormState: (rootState: TRootState) => FormState<TValues, TFieldError, TSubmitError>,
  ): TargetedForm<TRootState, TValues, TFieldError, TSubmitError> => {
    const targeted: TargetedFormSelectors<TRootState, TValues, TFieldError, TSubmitError> = {
      values: state => selectors.values(selectFormState(state)),
      initialValues: state => selectors.initialValues(selectFormState(state)),
      errors: state => selectors.errors(selectFormState(state)),
      formError: state => selectors.formError(selectFormState(state)),
      submitError: state => selectors.submitError(selectFormState(state)),
      status: state => selectors.status(selectFormState(state)),
      validationStatus: state => selectors.validationStatus(selectFormState(state)),
      submitCount: state => selectors.submitCount(selectFormState(state)),
      disabled: state => selectors.disabled(selectFormState(state)),
      readOnly: state => selectors.readOnly(selectFormState(state)),

      value: path => state => selectors.value(path)(selectFormState(state)),
      error: path => state => selectors.error(path)(selectFormState(state)),
      touched: path => state => selectors.touched(path)(selectFormState(state)),
      dirty: path => state => selectors.dirty(path)(selectFormState(state)),

      isDirty: state => selectors.isDirty(selectFormState(state)),
      isValid: state => selectors.isValid(selectFormState(state)),
      isValidating: state => selectors.isValidating(selectFormState(state)),
      isSubmitting: state => selectors.isSubmitting(selectFormState(state)),
      canSubmit: state => selectors.canSubmit(selectFormState(state)),
    }

    return {
      selectors: targeted,
      middleware: createMiddleware(selectFormState),
    }
  }

  return {
    name: config.name,
    reducer,
    actions,
    selectors,
    getInitialState,
    createMiddleware,
    target,
  }
}
