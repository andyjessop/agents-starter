export interface ToastMessage {
    message: string;
    kind?: 'info' | 'success' | 'warning' | 'error';
    urgent?: boolean;
    duration?: number;
    action?: { label: string; run: () => void };
}
export interface Toast extends ToastMessage {
    id: string;
}
export interface ToastStore {
    push: (message: ToastMessage) => string;
    dismiss: (id: string) => void;
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => readonly Toast[];
    pause: (id: string, reason: string, paused: boolean) => void;
    destroy: () => void;
}

/** Split a single sentence pair into Folio title + description when possible. */
export function toastCopy(message: string): { title: string; description?: string } {
    const match = /^(.*?[.!?])\s+(.+)$/.exec(message.trim());
    if (match?.[1] && match[2]) return { title: match[1], description: match[2] };
    return { title: message };
}
export function createToastStore(
    ownerDocument: Document | undefined = typeof document === 'undefined' ? undefined : document,
): ToastStore {
    const listeners = new Set<() => void>();
    type ToastRecord = {
        toast: Toast;
        remaining: number;
        started: number;
        timer?: ReturnType<typeof setTimeout>;
        pauses: Set<string>;
    };
    const records = new Map<string, ToastRecord>();
    let sequence = 0;
    let destroyed = false;
    let snapshot: readonly Toast[] = [];
    /** Newest first so each push lands at the top and older toasts shift down. Cap at three. */
    function visibleRecords(): ToastRecord[] {
        return [...records.values()].reverse().slice(0, 3);
    }
    function schedule(): void {
        const visible = visibleRecords();
        const now = Date.now();
        for (const record of records.values()) {
            if (record.timer !== undefined) {
                clearTimeout(record.timer);
                record.remaining = Math.max(0, record.remaining - (now - record.started));
                record.timer = undefined;
            }
            if (
                visible.includes(record) &&
                !record.pauses.size &&
                !ownerDocument?.hidden &&
                Number.isFinite(record.remaining)
            ) {
                record.started = now;
                record.timer = setTimeout(() => {
                    dismiss(record.toast.id);
                }, record.remaining);
            }
        }
    }
    function emit(): void {
        snapshot = visibleRecords().map((r) => r.toast);
        schedule();
        for (const listener of listeners) listener();
    }
    function dismiss(id: string): void {
        const record = records.get(id);
        if (!record || destroyed) return;
        clearTimeout(record.timer);
        records.delete(id);
        emit();
    }
    const visibility = (): void => {
        schedule();
    };
    ownerDocument?.addEventListener('visibilitychange', visibility);
    return {
        push(message) {
            if (destroyed) throw new Error('Toast store is destroyed');
            const id = `toast-${++sequence}`;
            records.set(id, {
                toast: { ...message, id },
                remaining: message.duration ?? (message.action || message.kind === 'error' ? Infinity : 5_000),
                started: 0,
                pauses: new Set(),
            });
            emit();
            return id;
        },
        dismiss,
        subscribe(listener) {
            if (destroyed) throw new Error('Toast store is destroyed');
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        getSnapshot: () => snapshot,
        pause(id, reason, paused) {
            const record = records.get(id);
            if (!record || destroyed) return;
            if (paused) record.pauses.add(reason);
            else record.pauses.delete(reason);
            schedule();
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            for (const record of records.values()) clearTimeout(record.timer);
            records.clear();
            listeners.clear();
            snapshot = [];
            ownerDocument?.removeEventListener('visibilitychange', visibility);
        },
    };
}
