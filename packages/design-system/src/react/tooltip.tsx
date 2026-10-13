'use client';
import { useId, type ReactNode } from 'react';
import { attachTooltip, type TooltipOptions } from '../behaviours/tooltip';
import { useController } from './use-controller';

export interface TooltipProps extends TooltipOptions {
    label: string;
    children: ReactNode;
}
export const Tooltip = ({ label, children, ...options }: TooltipProps): ReactNode => {
    const id = useId();
    const { root } = useController(attachTooltip, options);
    return (
        <span ref={root} data-ui-root="tooltip">
            <button type="button" className="ui-button" data-ui-part="trigger" aria-describedby={id}>
                {children}
            </button>
            <span id={id} data-ui-part="popup" role="tooltip" popover="manual" className="ui-tooltip">
                {label}
            </span>
        </span>
    );
};
