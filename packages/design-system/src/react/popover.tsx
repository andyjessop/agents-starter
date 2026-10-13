'use client';
import { useId, useImperativeHandle, type Ref, type ReactNode } from 'react';
import { attachPopover, type PopoverOptions } from '../behaviours/popover';
import type { Visibility } from '../internal/controller';
import { cx } from '../shared';
import { useController } from './use-controller';

export interface PopoverProps extends PopoverOptions {
    label: string;
    trigger: ReactNode;
    children: ReactNode;
    className?: string;
    popupClassName?: string;
    triggerClassName?: string;
    triggerVariant?: 'outline' | 'ghost';
    ref?: Ref<Visibility>;
}
export const Popover = ({
    label,
    trigger,
    children,
    className,
    popupClassName = '',
    triggerClassName,
    triggerVariant,
    ref,
    ...options
}: PopoverProps): ReactNode => {
    const id = useId();
    const { root, handle } = useController(attachPopover, options);
    useImperativeHandle(ref, () => ({ show: () => handle.current?.show(), hide: () => handle.current?.hide() }), [
        handle,
    ]);
    return (
        <div ref={root} data-ui-root="popover" className={className}>
            <button
                className={cx('ui-button', triggerClassName)}
                type="button"
                data-ui-part="trigger"
                data-variant={triggerVariant}
                disabled
                aria-controls={id}
                aria-expanded="false"
                aria-label={label}
            >
                {trigger}
            </button>
            <div
                id={id}
                className={cx('ui-popover', popupClassName)}
                data-ui-part="popup"
                popover="auto"
                aria-label={label}
            >
                {children}
            </div>
        </div>
    );
};
