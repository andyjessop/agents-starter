'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cx } from '../shared';
import { Button, type ButtonProps } from './controls';
import { Icon } from './display';

const CopyGlyph = (): ReactNode => (
    <Icon strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
);

const CopiedGlyph = (): ReactNode => (
    <Icon strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 9.5 17 19 7.5" />
    </Icon>
);

async function writeClipboard(text: string): Promise<void> {
    await navigator.clipboard.writeText(text);
}

/** How long the success tick stays visible before returning to the copy icon. */
const COPIED_FEEDBACK_MS = 2_000;

export type CopyButtonProps = Omit<ButtonProps, 'children' | 'aria-label' | 'onClick'> & {
    /** Text written to the clipboard when the button is activated. */
    value: string;
    /** Accessible name while idle. */
    label: string;
    /** Accessible name after a successful copy. Defaults to "Copied". */
    copiedLabel?: string;
    /** Override clipboard writing. Defaults to `navigator.clipboard.writeText`. */
    copyText?: (text: string) => Promise<void>;
    onCopied?: () => void;
    onCopyError?: (error: unknown) => void;
};

/**
 * Icon button that copies `value` and briefly swaps to a success tick.
 * Feedback lives on the control so hosts do not need a status line.
 */
export const CopyButton = ({
    value,
    label,
    copiedLabel = 'Copied',
    copyText,
    onCopied,
    onCopyError,
    className,
    variant = 'outline',
    tone,
    disabled,
    ...props
}: CopyButtonProps): ReactNode => {
    const [copied, setCopied] = useState(false);
    const [pending, setPending] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    if (value !== currentValue) {
        setCurrentValue(value);
        setCopied(false);
        setPending(false);
    }
    const latest = useRef({ copyText, onCopied, onCopyError, value });
    useEffect(() => {
        latest.current = { copyText, onCopied, onCopyError, value };
    });
    useEffect(() => {
        clearTimeout(resetTimer.current);
        resetTimer.current = undefined;
        return () => {
            clearTimeout(resetTimer.current);
        };
    }, [value]);
    return (
        <Button
            {...props}
            type="button"
            variant={variant}
            tone={copied ? 'success' : tone}
            disabled={disabled || pending}
            aria-label={copied ? copiedLabel : label}
            data-copied={copied || undefined}
            className={cx('ui-icon-button', 'ui-copy-button', className)}
            onClick={() => {
                const request = latest.current;
                setPending(true);
                const write = request.copyText?.(request.value) ?? writeClipboard(request.value);
                write
                    .then(() => {
                        clearTimeout(resetTimer.current);
                        setCopied(true);
                        resetTimer.current = setTimeout(() => {
                            resetTimer.current = undefined;
                            setCopied(false);
                        }, COPIED_FEEDBACK_MS);
                        request.onCopied?.();
                    })
                    .catch((error: unknown) => {
                        clearTimeout(resetTimer.current);
                        resetTimer.current = undefined;
                        setCopied(false);
                        request.onCopyError?.(error);
                    })
                    .finally(() => {
                        setPending(false);
                    })
                    .catch(() => undefined);
            }}
        >
            {copied ? <CopiedGlyph /> : <CopyGlyph />}
        </Button>
    );
};
