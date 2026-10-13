'use client';
import { useId, useEffect, useRef, type ComponentProps, type ReactNode } from 'react';

import { cx, type Tone } from '../shared';
import {
    passwordManagerInputProps,
    type PasswordManagerPolicy,
} from './password-manager';

export type ButtonProps = ComponentProps<'button'> & {
    variant?: 'solid' | 'outline' | 'ghost';
    tone?: Tone;
};
export const Button = ({
    className,
    variant = 'solid',
    tone = 'accent',
    type = 'button',
    ...props
}: ButtonProps): ReactNode => {
    const buttonType = type === 'submit' || type === 'reset' ? type : 'button';
    return (
        <button
            {...props}
            // Default is button. Submit and reset are forwarded from the caller.
            // eslint-disable-next-line react/button-has-type
            type={buttonType}
            data-variant={variant}
            data-tone={tone}
            className={cx('ui-button', className)}
            draggable={false}
        />
    );
};
export const ButtonGroup = ({ className, ...props }: ComponentProps<'div'>): ReactNode => {
    return <div role="group" className={cx('ui-button-group', className)} {...props} />;
};
export const Fab = ({ className, ...props }: ButtonProps): ReactNode => {
    return <Button className={cx('ui-fab', className)} {...props} />;
};
export const ToggleButton = ({
    pressed,
    onPressedChange,
    onClick,
    ...props
}: ButtonProps & {
    pressed: boolean;
    onPressedChange: (pressed: boolean) => void;
}): ReactNode => {
    return (
        <Button
            {...props}
            aria-pressed={pressed}
            onClick={(e) => {
                onClick?.(e);
                if (!e.defaultPrevented) onPressedChange(!pressed);
            }}
        />
    );
};
export const Input = ({ className, ...props }: ComponentProps<'input'>): ReactNode => {
    return <input className={cx('ui-input', className)} {...props} />;
};
export const Textarea = ({ className, ...props }: ComponentProps<'textarea'>): ReactNode => {
    return <textarea className={cx('ui-textarea', className)} {...props} />;
};
export const TextareaAutosize = Textarea;
export const Select = ({ className, ...props }: ComponentProps<'select'>): ReactNode => {
    return <select className={cx('ui-select', className)} {...props} />;
};
export const NumberField = (props: Omit<ComponentProps<'input'>, 'type'>): ReactNode => {
    return <Input {...props} type="number" />;
};
export const Slider = (props: Omit<ComponentProps<'input'>, 'type'>): ReactNode => {
    return <Input {...props} type="range" />;
};
export const Checkbox = ({
    indeterminate = false,
    className,
    ref,
    ...props
}: Omit<ComponentProps<'input'>, 'type'> & { indeterminate?: boolean }): ReactNode => {
    const local = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (local.current) local.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return (
        <input
            {...props}
            type="checkbox"
            className={cx('ui-choice', className)}
            ref={(node) => {
                local.current = node;
                if (typeof ref === 'function') return ref(node);
                if (ref) ref.current = node;
            }}
        />
    );
};
export const Radio = ({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>): ReactNode => {
    return <input {...props} type="radio" className={cx('ui-choice', className)} />;
};
export const Switch = ({ className, ...props }: Omit<ComponentProps<'input'>, 'type' | 'role'>): ReactNode => {
    return <input {...props} type="checkbox" role="switch" className={cx('ui-switch', className)} />;
};
export const RadioGroup = ({
    legend,
    children,
    className,
    ...props
}: ComponentProps<'fieldset'> & { legend: ReactNode }): ReactNode => {
    return (
        <fieldset className={cx('ui-fieldset', className)} {...props}>
            <legend>{legend}</legend>
            {children}
        </fieldset>
    );
};
export const Field = ({
    label,
    hint,
    error,
    children,
    id: provided,
    className,
    ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true }) => ReactNode;
}): ReactNode => {
    const generated = useId();
    const id = provided ?? generated;
    const description =
        [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
    return (
        <div className={cx('ui-field', className)} {...props}>
            <label htmlFor={id}>{label}</label>
            {children({
                id,
                'aria-describedby': description,
                'aria-invalid': error ? true : undefined,
            })}
            {hint && <small id={`${id}-hint`}>{hint}</small>}
            {error && (
                <small className="ui-error" id={`${id}-error`}>
                    {error}
                </small>
            )}
        </div>
    );
};
export const TextField = ({
    label,
    hint,
    error,
    passwordManager,
    autoComplete,
    ...props
}: ComponentProps<'input'> & {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    /** Hint password-manager extensions; does not replace an explicit `autoComplete`. */
    passwordManager?: PasswordManagerPolicy;
}): ReactNode => {
    const pmProps = passwordManager
        ? passwordManagerInputProps(passwordManager, { autoComplete })
        : {};
    return (
        <Field label={label} hint={hint} error={error} id={props.id}>
            {(field) => (
                <Input
                    {...props}
                    {...field}
                    {...pmProps}
                    {...(autoComplete !== undefined ? { autoComplete } : {})}
                />
            )}
        </Field>
    );
};

export type { PasswordManagerPolicy } from './password-manager';
export { passwordManagerFormProps, passwordManagerInputProps } from './password-manager';
export const Rating = ({
    label,
    name,
    value,
    onValueChange,
    max = 5,
    disabled = false,
}: {
    label: string;
    name?: string;
    value: number;
    onValueChange: (value: number) => void;
    max?: number;
    disabled?: boolean;
}): ReactNode => {
    const id = useId();
    return (
        <fieldset className="ui-rating" disabled={disabled}>
            <legend>{label}</legend>
            {Array.from({ length: Math.max(1, Math.floor(max)) }, (_, i) => i + 1).map((n) => (
                <label key={n} htmlFor={`${id}-${String(n)}`}>
                    <input
                        id={`${id}-${String(n)}`}
                        type="radio"
                        name={name ?? id}
                        value={n}
                        checked={value === n}
                        onChange={() => {
                            onValueChange(n);
                        }}
                    />
                    <span aria-hidden="true" data-filled={n <= value}>
                        ★
                    </span>
                    <span className="ui-visually-hidden">
                        {n} of {max}
                    </span>
                </label>
            ))}
        </fieldset>
    );
};
