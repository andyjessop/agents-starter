import type { ComponentProps } from 'react';

/** How browser and extension password managers should treat a control. */
export type PasswordManagerPolicy =
    | 'ignore'
    | 'username'
    | 'current-password'
    | 'new-password'
    | 'one-time-code';

const IGNORE_DATA_ATTRS = {
    'data-1p-ignore': '',
    'data-lpignore': 'true',
    'data-form-type': 'other',
} as const;

/** Input attributes for {@link PasswordManagerPolicy}. */
export function passwordManagerInputProps(
    policy: PasswordManagerPolicy,
    options?: { autoComplete?: ComponentProps<'input'>['autoComplete'] },
): Partial<ComponentProps<'input'>> {
    switch (policy) {
        case 'ignore':
            return {
                ...(options?.autoComplete === undefined ? { autoComplete: 'off' as const } : {}),
                ...IGNORE_DATA_ATTRS,
            };
        case 'username':
            return { autoComplete: 'username' };
        case 'current-password':
            return { autoComplete: 'current-password' };
        case 'new-password':
            return { autoComplete: 'new-password' };
        case 'one-time-code':
            return { autoComplete: 'one-time-code' };
        default: {
            const _exhaustive: never = policy;
            return _exhaustive;
        }
    }
}

/** Form attributes when nested fields must not be treated as sign-in or sign-up. */
export function passwordManagerFormProps(): Pick<ComponentProps<'form'>, 'autoComplete'> {
    return { autoComplete: 'off' };
}
