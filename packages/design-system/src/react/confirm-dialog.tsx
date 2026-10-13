'use client';
import type { ReactNode } from 'react';
import { Button } from '../native/controls';
import { Dialog, type DialogProps } from './dialog';

export interface ConfirmDialogProps extends Omit<DialogProps, 'footer'> {
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    confirmPending?: boolean;
    pendingLabel?: string;
    statusMessage?: ReactNode;
}

/** Modal destructive confirmation: explicit cancel plus a danger-toned confirm action. */
export const ConfirmDialog = ({
    confirmLabel,
    cancelLabel = 'Cancel',
    onConfirm,
    confirmPending = false,
    pendingLabel = 'Pending',
    statusMessage,
    onOpenChange,
    children,
    ...dialogProps
}: ConfirmDialogProps): ReactNode => {
    return (
        <Dialog
            {...dialogProps}
            onOpenChange={onOpenChange}
            footer={
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={confirmPending}
                        onClick={() => onOpenChange?.(false)}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        type="button"
                        tone="danger"
                        aria-busy={confirmPending || undefined}
                        disabled={confirmPending}
                        onClick={onConfirm}
                    >
                        {confirmPending ? pendingLabel : confirmLabel}
                    </Button>
                </>
            }
        >
            {statusMessage ? (
                <div className="ui-dialog-status" role="status">
                    {statusMessage}
                </div>
            ) : null}
            {children}
        </Dialog>
    );
};
