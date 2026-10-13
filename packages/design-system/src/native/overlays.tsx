'use client';
import { type ComponentProps, type ReactNode } from 'react';

import { cx } from '../shared';
import { Popover } from '../react/popover';

export { Popover } from '../react/popover';

export const Accordion = ({
    title,
    children,
    className,
    ...props
}: Omit<ComponentProps<'details'>, 'title'> & { title: ReactNode }): ReactNode => {
    return (
        <details className={cx('ui-accordion', className)} {...props}>
            <summary>{title}</summary>
            <div className="ui-accordion-content">{children}</div>
        </details>
    );
};
export { Dialog, Drawer, type DialogProps } from '../react/dialog';
export { ConfirmDialog, type ConfirmDialogProps } from '../react/confirm-dialog';
export const PermanentDrawer = ({ className, ...props }: ComponentProps<'aside'>): ReactNode => {
    return <aside className={cx('ui-permanent-drawer', className)} {...props} />;
};
export const SpeedDial = ({ label, children }: { label: string; children: ReactNode }): ReactNode => {
    return (
        <Popover trigger={label} label={label} popupClassName="ui-speed-dial">
            {children}
        </Popover>
    );
};
