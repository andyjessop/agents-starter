'use client';
import { useSyncExternalStore, type ReactNode } from 'react';
import { toastCopy, type ToastStore, type Toast } from '../behaviours/toast';
import { Button } from '../native/controls';
import { Icon } from '../native/display';
import type { Tone } from '../shared';

export { createToastStore, toastCopy } from '../behaviours/toast';
const empty: readonly Toast[] = [];

function toastTone(kind: Toast['kind']): Tone {
    if (kind === 'error') return 'danger';
    if (kind === 'warning') return 'warning';
    if (kind === 'info') return 'info';
    return 'success';
}

function toastGlyph(tone: Tone): string {
    if (tone === 'danger') return '×';
    if (tone === 'warning') return '!';
    if (tone === 'info') return 'i';
    return '✓';
}

export const ToastViewport = ({ store, label = 'Notifications' }: { store: ToastStore; label?: string }): ReactNode => {
    const messages = useSyncExternalStore(store.subscribe, store.getSnapshot, () => empty);
    return (
        <section className="ui-toast-viewport" aria-label={label}>
            <div className="ui-visually-hidden" aria-live="polite" aria-atomic="true">
                {messages
                    .filter((t) => !t.urgent)
                    .map((t) => t.message)
                    .join('. ')}
            </div>
            <div className="ui-visually-hidden" aria-live="assertive" aria-atomic="true">
                {messages
                    .filter((t) => t.urgent)
                    .map((t) => t.message)
                    .join('. ')}
            </div>
            {messages.map((t) => {
                const tone = toastTone(t.kind);
                const { title, description } = toastCopy(t.message);
                return (
                    <div
                        className="ui-toast"
                        data-tone={tone}
                        key={t.id}
                        onPointerEnter={() => {
                            store.pause(t.id, 'hover', true);
                        }}
                        onPointerLeave={() => {
                            store.pause(t.id, 'hover', false);
                        }}
                        onFocus={() => {
                            store.pause(t.id, 'focus', true);
                        }}
                        onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) store.pause(t.id, 'focus', false);
                        }}
                    >
                        <span className="ui-toast-icon" aria-hidden="true">
                            {toastGlyph(tone)}
                        </span>
                        <div className="ui-toast-body">
                            <strong className="ui-toast-title">{title}</strong>
                            {description ? <p className="ui-toast-message">{description}</p> : null}
                        </div>
                        <div className="ui-toast-actions">
                            {t.action && (
                                <Button variant="outline" type="button" onClick={t.action.run}>
                                    {t.action.label}
                                </Button>
                            )}
                            <Button
                                className="ui-icon-button"
                                variant="ghost"
                                type="button"
                                aria-label={`Dismiss ${t.message}`}
                                onClick={() => {
                                    store.dismiss(t.id);
                                }}
                            >
                                <Icon>
                                    <path d="m6 6 12 12M18 6 6 18" />
                                </Icon>
                            </Button>
                        </div>
                    </div>
                );
            })}
        </section>
    );
};
