'use client';
import { useEffect, useRef, type RefObject } from 'react';
import type { Controller } from '../internal/controller';

export function useController<O, C extends Controller<O>>(
    attach: (root: HTMLElement, options: O) => C,
    options: O,
): { root: RefObject<HTMLDivElement | null>; handle: RefObject<C | null> } {
    for (const key of [
        'open',
        'role',
        'tabIndex',
        'aria-controls',
        'aria-expanded',
        'aria-activedescendant',
        'aria-selected',
    ]) {
        if (options && typeof options === 'object' && key in options)
            throw new Error(`${key} is owned by the controller and cannot be supplied to this wrapper`);
    }
    const root = useRef<HTMLDivElement>(null);
    const handle = useRef<C | null>(null);
    const latest = useRef(options);
    useEffect(() => {
        latest.current = options;
    });
    useEffect(() => {
        if (!root.current) return;
        handle.current = attach(root.current, latest.current);
        return () => {
            handle.current?.destroy();
            handle.current = null;
        };
    }, [attach]);
    useEffect(() => {
        handle.current?.update(options);
    });
    return { root, handle };
}
