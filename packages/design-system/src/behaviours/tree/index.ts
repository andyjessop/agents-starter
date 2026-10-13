import {
    enabled,
    lifetime,
    owned,
    unmodified,
    type ChangeHandler,
    type Controller,
} from '../../internal/controller';

export type TreeExpansionReason = 'pointer' | 'keyboard';
export type TreeSelectionReason = 'pointer' | 'keyboard';

export interface TreeExpansionRequest {
    id: string;
    expanded: boolean;
    reason: TreeExpansionReason;
    originalEvent: Event;
}

export interface TreeSelectionRequest {
    id: string;
    reason: TreeSelectionReason;
    originalEvent: Event;
}

export interface TreeOptions {
    expandedIds?: readonly string[];
    selectedId?: string | null;
    onExpandedChange?: ChangeHandler<TreeExpansionRequest>;
    onSelectionChange?: ChangeHandler<TreeSelectionRequest>;
}

const ITEM_SELECTOR = '[data-ui-part="item"]';
const GROUP_SELECTOR = '[data-ui-part="group"]';

export function attachTree(root: HTMLElement, initial: TreeOptions = {}): Controller<TreeOptions> {
    const life = lifetime(root, 'tree');
    let options = initial;
    let items: HTMLElement[] = [];
    let itemsById = new Map<string, HTMLElement>();
    let groupsByOwner = new Map<string, HTMLElement>();
    let focusId: string | undefined;

    function selectedPathOwnerIds(selectedId: string | null | undefined): Set<string> {
        const owners = new Set<string>();
        if (!selectedId) return owners;
        let item = itemsById.get(selectedId);
        while (item) {
            const group = item.parentElement?.closest<HTMLElement>(GROUP_SELECTOR);
            if (!group) break;
            const ownerId = group.dataset.uiOwner;
            if (!ownerId) break;
            owners.add(ownerId);
            item = itemsById.get(ownerId);
        }
        return owners;
    }

    function visibleItems(): HTMLElement[] {
        const visible: HTMLElement[] = [];
        const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
            acceptNode(node) {
                if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_SKIP;
                if (node !== root && node.matches('[data-ui-root]')) return NodeFilter.FILTER_REJECT;
                if (node.matches(`${GROUP_SELECTOR}[hidden]`)) return NodeFilter.FILTER_REJECT;
                return node.matches(ITEM_SELECTOR) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            },
        });
        for (let node = walker.nextNode(); node; node = walker.nextNode())
            if (node instanceof HTMLElement) visible.push(node);
        return visible;
    }

    function refresh(): void {
        if (!life.alive) return;
        items = owned(root, ITEM_SELECTOR);
        const groups = owned(root, GROUP_SELECTOR);
        const nextItemsById = new Map<string, HTMLElement>();
        const nextGroupsByOwner = new Map<string, HTMLElement>();
        for (const group of groups) {
            const owner = group.dataset.uiOwner;
            if (!owner || nextGroupsByOwner.has(owner)) throw new Error('Tree groups require unique data-ui-owner identifiers');
            nextGroupsByOwner.set(owner, group);
            life.attr(group, 'role', 'group');
        }
        for (const item of items) {
            const id = item.dataset.uiValue;
            if (!id || nextItemsById.has(id)) throw new Error('Tree items require unique data-ui-value identifiers');
            nextItemsById.set(id, item);
        }
        itemsById = nextItemsById;
        groupsByOwner = nextGroupsByOwner;

        const expanded = new Set(options.expandedIds ?? []);
        const selectedPathOwners = selectedPathOwnerIds(options.selectedId);
        for (const item of items) {
            const id = item.dataset.uiValue;
            if (!id) continue;
            const group = groupsByOwner.get(id);
            const branch = group !== undefined;
            life.attr(item, 'role', 'treeitem');
            life.attr(item, 'aria-expanded', branch ? String(expanded.has(id)) : null);
            life.attr(item, 'aria-selected', String(id === options.selectedId));
            life.attr(item, 'data-ui-selected-path', selectedPathOwners.has(id) ? '' : null);
            life.attr(item, 'data-ui-expanded', branch && expanded.has(id) ? '' : null);
            if (group) life.attr(group, 'hidden', expanded.has(id) ? null : '');
        }

        const visible = visibleItems().filter(enabled);
        if (!visible.some((item) => item.dataset.uiValue === focusId))
            focusId = visible.find((item) => item.dataset.uiValue === options.selectedId)?.dataset.uiValue ?? visible[0]?.dataset.uiValue;
        for (const item of items) life.attr(item, 'tabindex', item.dataset.uiValue === focusId && enabled(item) ? '0' : '-1');
        life.attr(root, 'role', 'tree');
    }

    function focus(item: HTMLElement | undefined): void {
        if (!item) return;
        focusId = item.dataset.uiValue;
        refresh();
        item.focus();
    }

    function requestExpansion(item: HTMLElement, reason: TreeExpansionReason, event: Event): void {
        requestExpansionState(
            item,
            item.getAttribute('aria-expanded') !== 'true',
            reason,
            event,
        );
    }

    function requestExpansionState(
        item: HTMLElement,
        expanded: boolean,
        reason: TreeExpansionReason,
        event: Event,
    ): void {
        const id = item.dataset.uiValue;
        if (!id || !groupsByOwner.has(id) || !enabled(item)) return;
        const currentlyExpanded = item.getAttribute('aria-expanded') === 'true';
        if (currentlyExpanded === expanded) return;
        options.onExpandedChange?.({ id, expanded, reason, originalEvent: event });
    }

    function requestSelection(item: HTMLElement, reason: TreeSelectionReason, event: Event): void {
        const id = item.dataset.uiValue;
        if (!id || !enabled(item) || item.dataset.uiSelectable === 'false') return;
        options.onSelectionChange?.({ id, reason, originalEvent: event });
    }

    life.listen(root, 'click', (event) => {
        const target = event.target;
        const item = target instanceof Element ? target.closest<HTMLElement>(ITEM_SELECTOR) : null;
        if (!item || !items.includes(item) || !enabled(item)) return;
        focusId = item.dataset.uiValue;
        const id = item.dataset.uiValue ?? '';
        const branch = groupsByOwner.has(id);
        const onLabel =
            target instanceof Element && Boolean(target.closest('[data-ui-part="label"]'));
        if (onLabel) {
            if (item.dataset.uiSelectable === 'false') {
                if (branch) requestExpansion(item, 'pointer', event);
            } else {
                requestSelection(item, 'pointer', event);
                if (branch && item.getAttribute('aria-expanded') !== 'true')
                    requestExpansionState(item, true, 'pointer', event);
            }
            return;
        }
        if (branch) {
            event.preventDefault();
            requestExpansion(item, 'pointer', event);
        } else requestSelection(item, 'pointer', event);
    });

    life.listen(root, 'keydown', (event) => {
        if (!(event instanceof KeyboardEvent) || !unmodified(event)) return;
        const current = items.find((item) => item === root.ownerDocument.activeElement);
        if (!current) return;
        const visible = visibleItems().filter(enabled);
        const index = visible.indexOf(current);
        let next: HTMLElement | undefined;
        if (event.key === 'ArrowDown') next = visible[index + 1];
        if (event.key === 'ArrowUp') next = visible[index - 1];
        if (event.key === 'Home') [next] = visible;
        if (event.key === 'End') next = visible.at(-1);
        if (event.key === 'ArrowRight') {
            const id = current.dataset.uiValue ?? '';
            if (groupsByOwner.has(id) && current.getAttribute('aria-expanded') !== 'true')
                requestExpansion(current, 'keyboard', event);
            else {
                const group = groupsByOwner.get(id);
                next = group
                    ? Array.from(group.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).find(enabled)
                    : undefined;
            }
        }
        if (event.key === 'ArrowLeft') {
            const id = current.dataset.uiValue ?? '';
            if (groupsByOwner.has(id) && current.getAttribute('aria-expanded') === 'true')
                requestExpansion(current, 'keyboard', event);
            else {
                const parentGroup = current.parentElement?.parentElement?.closest<HTMLElement>(GROUP_SELECTOR);
                next = parentGroup ? itemsById.get(parentGroup.dataset.uiOwner ?? '') : undefined;
            }
        }
        if (event.key === 'Enter') {
            const id = current.dataset.uiValue ?? '';
            if (groupsByOwner.has(id) && current.getAttribute('aria-expanded') !== 'true')
                requestExpansion(current, 'keyboard', event);
            else if (current.dataset.uiSelectable === 'false') requestExpansion(current, 'keyboard', event);
            else requestSelection(current, 'keyboard', event);
        }
        if (event.key === ' ') {
            if (groupsByOwner.has(current.dataset.uiValue ?? '')) requestExpansion(current, 'keyboard', event);
            else requestSelection(current, 'keyboard', event);
        }
        if (next || ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' '].includes(event.key))
            event.preventDefault();
        focus(next);
    });

    try {
        refresh();
    } catch (error: unknown) {
        life.destroy();
        throw error;
    }

    return {
        refresh,
        destroy: life.destroy,
        update(next) {
            if (!life.alive) return;
            options = next;
            refresh();
        },
    };
}
