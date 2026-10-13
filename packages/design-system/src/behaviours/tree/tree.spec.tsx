import { StrictMode, useState } from 'react';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { Tree, TreeItem } from '../../react/tree';
import { TreeElement } from '../../elements/tree';
import { attachTree, type TreeExpansionRequest } from './index';

const cleanups: (() => void)[] = [];
afterEach(() => {
    cleanups
        .splice(0)
        .reverse()
        .forEach((cleanup) => {
            cleanup();
        });
});

function markup(host: 'direct' | 'element'): string {
    const tag = host === 'element' ? 'ui-tree' : 'div';
    return `<${tag} aria-label="Resources">
        <ul>
            <li><button data-ui-part="item" data-ui-value="projects"><span data-ui-part="label">Projects</span></button>
                <ul data-ui-part="group" data-ui-owner="projects">
                    <li><button data-ui-part="item" data-ui-value="project-a"><span data-ui-part="label">Project A</span></button>
                        <ul data-ui-part="group" data-ui-owner="project-a">
                            <li><button data-ui-part="item" data-ui-value="item-a"><span data-ui-part="label">Item A</span></button></li>
                        </ul>
                    </li>
                </ul>
            </li>
            <li><button data-ui-part="item" data-ui-value="connections"><span data-ui-part="label">Connections</span></button></li>
        </ul>
    </${tag}>`;
}

const ReactTree = ({ selected }: { selected: (id: string) => void }) => {
    const [expandedIds, setExpandedIds] = useState<readonly string[]>([]);
    const updateExpanded = ({ id, expanded }: TreeExpansionRequest): void => {
        setExpandedIds((current) => (expanded ? [...current, id] : current.filter((value) => value !== id)));
    };
    return (
        <Tree
            label="Resources"
            expandedIds={expandedIds}
            onExpandedChange={updateExpanded}
            onSelectionChange={({ id }) => selected(id)}
        >
            <TreeItem id="projects" label="Projects">
                <TreeItem id="project-a" label="Project A">
                    <TreeItem id="item-a" label="Item A" href="/items/item-a" />
                </TreeItem>
            </TreeItem>
            <TreeItem id="connections" label="Connections" />
        </Tree>
    );
};

async function setup(host: 'direct' | 'react' | 'element', selected: (id: string) => void): Promise<HTMLElement> {
    if (host === 'react') {
        const screen = await render(
            <StrictMode>
                <ReactTree selected={selected} />
            </StrictMode>,
        );
        return screen.getByRole('tree', { name: 'Resources' }).element();
    }
    const wrapper = document.createElement('section');
    wrapper.innerHTML = markup(host);
    document.body.append(wrapper);
    cleanups.push(() => {
        wrapper.remove();
    });
    const root = wrapper.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('Missing tree root');
    let expandedIds: readonly string[] = [];
    const expanded = (request: TreeExpansionRequest): void => {
        expandedIds = request.expanded
            ? [...expandedIds, request.id]
            : expandedIds.filter((id) => id !== request.id);
        if (root instanceof TreeElement) root.options = { expandedIds };
        else controller.update({ expandedIds, onExpandedChange: expanded, onSelectionChange: ({ id }) => selected(id) });
    };
    if (root instanceof TreeElement) {
        root.options = { expandedIds };
        root.addEventListener('ui-expanded-request', (event) => {
            if (event instanceof CustomEvent) expanded(event.detail as TreeExpansionRequest);
        });
        root.addEventListener('ui-selection-request', (event) => {
            if (event instanceof CustomEvent) selected((event.detail as { id: string }).id);
        });
    }
    const controller =
        root instanceof TreeElement
            ? undefined
            : attachTree(root, {
                  expandedIds,
                  onExpandedChange: expanded,
                  onSelectionChange: ({ id }) => selected(id),
              });
    if (controller) cleanups.push(controller.destroy);
    await Promise.resolve();
    return root;
}

it('marks ancestor items with data-ui-selected-path when selectedId is set', () => {
    const wrapper = document.createElement('section');
    wrapper.innerHTML = markup('direct');
    document.body.append(wrapper);
    cleanups.push(() => {
        wrapper.remove();
    });
    const root = wrapper.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('Missing tree root');
    const controller = attachTree(root, {
        expandedIds: ['projects', 'project-a'],
        selectedId: 'item-a',
    });
    cleanups.push(controller.destroy);

    expect(root.querySelector('[data-ui-value="item-a"]')).toHaveAttribute('aria-selected', 'true');
    expect(root.querySelector('[data-ui-value="item-a"]')).not.toHaveAttribute('data-ui-selected-path');
    expect(root.querySelector('[data-ui-value="project-a"]')).toHaveAttribute('data-ui-selected-path', '');
    expect(root.querySelector('[data-ui-value="projects"]')).toHaveAttribute('data-ui-selected-path', '');
    expect(root.querySelector('[data-ui-value="connections"]')).not.toHaveAttribute('data-ui-selected-path');
});

for (const host of ['direct', 'react', 'element'] as const) {
    describe(`tree ${host}`, () => {
        it('expands with pointer and keyboard, moves through visible items and selects the label', async () => {
            const selected = vi.fn();
            const root = await setup(host, selected);
            const projects = root.querySelector<HTMLElement>('[data-ui-value="projects"]');
            const project = root.querySelector<HTMLElement>('[data-ui-value="project-a"]');
            const item = root.querySelector<HTMLElement>('[data-ui-value="item-a"]');
            if (!projects || !project || !item) throw new Error('Missing tree items');
            if (host === 'react') expect(item).toHaveAttribute('href', '/items/item-a');

            await userEvent.click(projects);
            expect(projects).toHaveAttribute('aria-expanded', 'true');
            projects.focus();
            await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}');
            expect(item).toHaveFocus();
            await userEvent.keyboard('{Enter}');
            expect(selected).toHaveBeenCalledWith('item-a');

            selected.mockClear();
            const label = projects.querySelector<HTMLElement>('[data-ui-part="label"]');
            if (!label) throw new Error('Missing tree label');
            await userEvent.click(label);
            expect(selected).not.toHaveBeenCalled();
            expect(projects).toHaveAttribute('aria-expanded', 'false');

            const projectLabel = project.querySelector<HTMLElement>('[data-ui-part="label"]');
            if (!projectLabel) throw new Error('Missing project label');
            await userEvent.click(projectLabel);
            expect(selected).toHaveBeenCalledWith('project-a');
            expect(project).toHaveAttribute('aria-expanded', 'true');

            selected.mockClear();
            await userEvent.click(project);
            expect(project).toHaveAttribute('aria-expanded', 'false');
            selected.mockClear();
            await userEvent.click(project);
            expect(project).toHaveAttribute('aria-expanded', 'true');
            selected.mockClear();
            await userEvent.click(projectLabel);
            expect(selected).toHaveBeenCalledWith('project-a');
            expect(project).toHaveAttribute('aria-expanded', 'true');
        });
    });
}
