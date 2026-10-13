'use client';
import { useId, useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import { attachDialog, type DialogOptions } from '../behaviours/dialog';
import { Button } from '../native/controls';
import { Icon } from '../native/display';
import type { Controller, Visibility } from '../internal/controller';

export interface DialogProps extends DialogOptions {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    className?: string;
    closeLabel?: string;
    /** When set, the host owns open state; dismiss UI calls onOpenChange(false) and open drives show/hide. */
    open?: boolean;
    invokerId?: string;
    ref?: Ref<Visibility>;
}
export const Dialog = ({
    title,
    description,
    children,
    footer,
    className = '',
    closeLabel = 'Close',
    open,
    invokerId,
    ref,
    ...options
}: DialogProps): ReactNode => {
    const id = useId();
    const root = useRef<HTMLDialogElement>(null);
    const handle = useRef<(Controller<DialogOptions> & Visibility) | null>(null);
    const controlled = options.controlled ?? open !== undefined;
    const latest = useRef({ ...options, controlled });
    latest.current = { ...options, controlled };
    useLayoutEffect(() => {
        if (root.current) handle.current = attachDialog(root.current, latest.current);
        return () => {
            handle.current?.destroy();
            handle.current = null;
        };
    }, []);
    useLayoutEffect(() => {
        handle.current?.update(latest.current);
        const api = handle.current;
        if (!api) return;
        if (open !== undefined) {
            if (open) {
                const invoker = invokerId ? document.getElementById(invokerId) : null;
                api.show(invoker instanceof HTMLElement ? invoker : undefined);
            } else {
                api.hide();
            }
            return;
        }
        if (!controlled) return;
        const invoker = invokerId ? document.getElementById(invokerId) : null;
        api.show(invoker instanceof HTMLElement ? invoker : undefined);
        return () => {
            api.hide();
        };
    }, [open, invokerId, controlled]);
    useImperativeHandle(
        ref,
        () => ({ show: (invoker) => handle.current?.show(invoker), hide: () => handle.current?.hide() }),
        [],
    );
    return (
        <dialog
            ref={root}
            data-ui-root="dialog"
            className={`ui-dialog ui-dialog-sectioned ${className}`}
            aria-labelledby={`${id}-title`}
            aria-describedby={description ? `${id}-description` : undefined}
        >
            <div className="ui-dialog-heading">
                <h2 id={`${id}-title`}>{title}</h2>
                <Button data-ui-part="close" className="ui-icon-button" variant="ghost" aria-label={closeLabel}>
                    <Icon>
                        <path d="m6 6 12 12M18 6 6 18" />
                    </Icon>
                </Button>
            </div>
            <div className="ui-dialog-content">
                {description && <p id={`${id}-description`}>{description}</p>}
                {children}
            </div>
            {footer !== undefined && footer !== null && <div className="ui-dialog-footer">{footer}</div>}
        </dialog>
    );
};
export const Drawer = ({ className = '', ...props }: DialogProps): ReactNode => {
    return <Dialog {...props} className={`ui-drawer ${className}`} />;
};
