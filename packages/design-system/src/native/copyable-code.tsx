'use client';
import { type ReactNode } from 'react';

import { cx } from '../shared';
import { CopyButton } from './copy-button';

function detectMultiline(value: string): boolean {
    return value.includes('\n');
}

export type CopyableCodeProps = {
    /** Text written to the clipboard when the copy control is activated. */
    value: string;
    /** Accessible name for the copy control while idle. */
    label: string;
    /** When omitted, layout follows whether `value` contains a newline. */
    multiline?: boolean;
    /** Optional visible content; defaults to monospace `value` (inline) or a `pre` (multiline). */
    children?: ReactNode;
    className?: string;
};

/**
 * Monospace or code-like value in a sunken surface with a ghost copy control in the top-right corner.
 */
export const CopyableCode = ({
    value,
    label,
    multiline,
    children,
    className,
}: CopyableCodeProps): ReactNode => {
    const isMultiline = multiline ?? detectMultiline(value);
    const layout = isMultiline ? 'block' : 'inline';

    const copyControl = (
        <CopyButton
            className="ui-copyable-code-action"
            variant="ghost"
            value={value}
            label={label}
        />
    );

    return (
        <div className={cx('ui-copyable-code', className)} data-layout={layout}>
            {isMultiline ? (
                <>
                    {copyControl}
                    <pre className="ui-copyable-code-body">{value}</pre>
                </>
            ) : (
                <>
                    <code className="ui-copyable-code-body">{children ?? value}</code>
                    {copyControl}
                </>
            )}
        </div>
    );
};
