export interface Controller<Options> {
    update: (options: Options) => void;
    refresh: () => void;
    destroy: () => void;
}
export interface Request<T, Reason extends string> {
    value: T;
    reason: Reason;
    originalEvent?: Event;
}
export interface Visibility {
    show: (invoker?: HTMLElement) => void;
    hide: () => void;
}
const attachments = new WeakMap<HTMLElement, Set<string>>();
const rootSelector = '[data-ui-root],ui-menu,ui-popover,ui-tooltip,ui-tabs,ui-tree,ui-combobox,ui-dialog,ui-toast';
export function owned(root: HTMLElement, selector: string): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((el) => el.closest(rootSelector) === root);
}
export function part(root: HTMLElement, name: string): HTMLElement {
    const found = owned(root, `[data-ui-part="${name}"]`);
    if (found.length !== 1 || !found[0]) throw new Error(`Expected one ${name} part in ${root.localName}`);
    return found[0];
}
export function enabled(el: HTMLElement): boolean {
    return !el.matches(':disabled,[disabled],[aria-disabled="true"]');
}
export function unmodified(event: KeyboardEvent): boolean {
    return !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing;
}
export interface LifetimeControls {
    attr: (el: HTMLElement, name: string, value: string | null) => void;
    listen: (target: EventTarget, type: string, handler: (event: Event) => void, capture?: boolean) => void;
    destroy: () => void;
    cleanup: Array<() => void>;
    readonly alive: boolean;
}
/** Attribute restoration is conditional: later host writes always win. */
export function lifetime(root: HTMLElement, kind: string): LifetimeControls {
    if (!root.isConnected) throw new Error(`attach${kind} requires a connected root`);
    const set = attachments.get(root) ?? new Set<string>();
    if (set.has(kind)) throw new Error(`${kind} is already attached`);
    set.add(kind);
    attachments.set(root, set);
    const cleanup: (() => void)[] = [];
    const writes = new Map<HTMLElement, Map<string, { before: string | null; last: string | null }>>();
    let alive = true;
    function attr(el: HTMLElement, name: string, value: string | null): void {
        if (!alive) return;
        const fields = writes.get(el) ?? new Map<string, { before: string | null; last: string | null }>();
        const old = fields.get(name);
        fields.set(name, { before: old?.before ?? (old ? null : el.getAttribute(name)), last: value });
        writes.set(el, fields);
        if (el.getAttribute(name) === value) return;
        if (value === null) el.removeAttribute(name);
        else el.setAttribute(name, value);
    }
    attr(root, 'data-ui-root', kind);
    function listen(target: EventTarget, type: string, handler: (event: Event) => void, capture = false): void {
        target.addEventListener(type, handler, capture);
        cleanup.push(() => {
            target.removeEventListener(type, handler, capture);
        });
    }
    function destroy(): void {
        if (!alive) return;
        alive = false;
        cleanup.reverse().forEach((fn) => {
            fn();
        });
        for (const [el, fields] of writes) {
            for (const [name, { before, last }] of fields) {
                if (el.getAttribute(name) !== last) continue;
                if (before === null) el.removeAttribute(name);
                else el.setAttribute(name, before);
            }
        }
        writes.clear();
        cleanup.length = 0;
        set.delete(kind);
        if (!set.size) attachments.delete(root);
    }
    return {
        attr,
        listen,
        destroy,
        cleanup,
        get alive() {
            return alive;
        },
    };
}
export function requireId(el: HTMLElement): string {
    if (!el.id) throw new Error(`${el.localName} part requires a stable ID`);
    return el.id;
}

export type ChangeHandler<T> = ((request: T) => boolean) | ((request: T) => void);
