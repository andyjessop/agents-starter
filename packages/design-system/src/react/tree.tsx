'use client';
import { useId, type ReactNode } from 'react';
import { attachTree, type TreeOptions } from '../behaviours/tree';
import { useController } from './use-controller';

export interface TreeProps extends TreeOptions {
    label: string;
    children: ReactNode;
    className?: string;
}

export interface TreeItemProps {
    id: string;
    label: ReactNode;
    children?: ReactNode;
    leading?: ReactNode;
    href?: string;
    disabled?: boolean;
    selectable?: boolean;
}

export const Tree = ({ label, children, className, ...options }: TreeProps): ReactNode => {
    const { root } = useController(attachTree, options);
    return (
        <div ref={root} className={['ui-tree', className].filter(Boolean).join(' ')} aria-label={label}>
            <ul className="ui-tree-root">{children}</ul>
        </div>
    );
};

export const TreeItem = ({ id, label, children, leading, href, disabled, selectable = true }: TreeItemProps): ReactNode => {
    const instanceId = useId();
    const branch = children !== undefined;
    const content = (
        <>
            <span className="ui-tree-disclosure" aria-hidden="true">
                {branch ? '›' : null}
            </span>
            {leading ? (
                <span className="ui-tree-leading" aria-hidden="true">
                    {leading}
                </span>
            ) : null}
            <span className="ui-tree-label" data-ui-part="label">
                {label}
            </span>
        </>
    );
    return (
        <li className="ui-tree-node" role="none">
            {href && !disabled ? (
                <a
                    id={`${instanceId}-item`}
                    className="ui-tree-item"
                    data-ui-part="item"
                    data-ui-value={id}
                    data-ui-selectable={String(selectable)}
                    href={href}
                    aria-expanded={branch ? false : undefined}
                    aria-selected={false}
                    tabIndex={-1}
                >
                    {content}
                </a>
            ) : (
                <button
                    type="button"
                    id={`${instanceId}-item`}
                    className="ui-tree-item"
                    data-ui-part="item"
                    data-ui-value={id}
                    data-ui-selectable={String(selectable)}
                    disabled={disabled}
                    aria-expanded={branch ? false : undefined}
                    aria-selected={false}
                    tabIndex={-1}
                >
                    {content}
                </button>
            )}
            {branch ? (
                <ul
                    className="ui-tree-group"
                    data-ui-part="group"
                    data-ui-owner={id}
                    aria-labelledby={`${instanceId}-item`}
                    hidden
                >
                    {children}
                </ul>
            ) : null}
        </li>
    );
};
