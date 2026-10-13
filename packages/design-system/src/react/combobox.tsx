'use client';
import { useId, type ReactNode } from 'react';
import { attachCombobox, type ComboboxOptions } from '../behaviours/combobox';
import { useController } from './use-controller';

export interface ComboboxProps extends ComboboxOptions {
    label: string;
    name?: string;
    placeholder?: string;
    description?: string;
    invalid?: boolean;
}
export const Combobox = ({ label, name, placeholder, description, invalid, ...options }: ComboboxProps): ReactNode => {
    const id = useId();
    const { root } = useController(attachCombobox, options);
    return (
        <div ref={root} data-ui-root="combobox" className="ui-field">
            <label htmlFor={id}>{label}</label>
            <input
                id={id}
                data-ui-part="input"
                className="ui-input"
                disabled
                role="combobox"
                aria-autocomplete="list"
                aria-expanded="false"
                aria-controls={`${id}-list`}
                aria-describedby={description ? `${id}-description` : undefined}
                aria-invalid={invalid || undefined}
                placeholder={placeholder}
                defaultValue={
                    options.inputValue ??
                    options.defaultInputValue ??
                    options.options.find((option) => option.value === (options.value ?? options.defaultValue))?.label ??
                    ''
                }
            />
            {description && <small id={`${id}-description`}>{description}</small>}
            <div
                id={`${id}-list`}
                data-ui-part="popup"
                className="ui-popup"
                popover="auto"
                role="listbox"
                aria-label={label}
            >
                {options.options.map((option) => (
                    <div
                        className="ui-option"
                        id={`${id}-option-${encodeURIComponent(option.value)}`}
                        role="option"
                        aria-selected="false"
                        data-ui-part="option"
                        data-ui-value={option.value}
                        key={option.value}
                    >
                        {option.label}
                    </div>
                ))}
                {!options.options.length && <p>{options.loading ? 'Loading…' : 'No results'}</p>}
            </div>
            <span data-ui-part="status" role="status" aria-live="polite" className="ui-visually-hidden" />
            {name && (
                <input
                    type="hidden"
                    name={name}
                    data-ui-part="value"
                    defaultValue={options.value ?? options.defaultValue ?? ''}
                    disabled={options.disabled}
                />
            )}
        </div>
    );
};
