'use client';
import { useId, type ReactNode } from 'react';
import { attachMenu, type MenuOptions } from '../behaviours/menu';
import { cx } from '../shared';
import { useController } from './use-controller';

export interface MenuAction {
    id: string;
    label: string;
    disabled?: boolean;
    /** Destructive action colour; matches the PRD `.danger-item` treatment. */
    tone?: 'danger';
}
export interface MenuProps extends MenuOptions {
    /** Accessible name for the menu and, when `trigger` is set, the trigger button. */
    label: string;
    items: readonly MenuAction[];
    /** Custom trigger content. Defaults to rendering `label` as the button text. */
    trigger?: ReactNode;
    className?: string;
    triggerClassName?: string;
    /** Trigger button variant. Omit for the default solid control look. */
    triggerVariant?: 'outline' | 'ghost';
}
export const Menu = ({
    label,
    items,
    trigger,
    className,
    triggerClassName,
    triggerVariant,
    ...options
}: MenuProps): ReactNode => {
    const id = useId();
    const { root } = useController(attachMenu, options);
    return (
        <div ref={root} data-ui-root="menu" className={className}>
            <button
                type="button"
                className={cx('ui-button', triggerClassName)}
                data-ui-part="trigger"
                data-variant={triggerVariant}
                disabled
                aria-haspopup="menu"
                aria-controls={id}
                aria-expanded="false"
                aria-label={trigger !== undefined ? label : undefined}
            >
                {trigger ?? label}
            </button>
            <div id={id} data-ui-part="popup" className="ui-popup" popover="auto" role="menu" aria-label={label}>
                {items.map((item) => (
                    <button
                        type="button"
                        className="ui-option"
                        role="menuitem"
                        tabIndex={-1}
                        data-ui-item={item.id}
                        data-tone={item.tone}
                        key={item.id}
                        disabled={item.disabled}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
