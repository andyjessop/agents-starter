'use client';
import { useState, useMemo, type ComponentProps, type ReactNode } from 'react';

import { Button, Checkbox, Input } from '../native/controls';
import { Table } from '../native/layout';
import { Accordion } from '../native/overlays';

export interface TransferItem {
    id: string;
    label: string;
}
export const TransferList = ({
    items,
    value,
    onValueChange,
    label = 'Transfer items',
}: {
    items: TransferItem[];
    value: string[];
    onValueChange: (value: string[]) => void;
    label?: string;
}): ReactNode => {
    const [selected, setSelected] = useState<string[]>([]);
    const toggle = (id: string): void => {
        setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
    };
    const move = (toRight: boolean): void => {
        const ids = selected.filter((id) => items.some((i) => i.id === id) && value.includes(id) !== toRight);
        onValueChange(toRight ? [...new Set([...value, ...ids])] : value.filter((id) => !ids.includes(id)));
        setSelected([]);
    };
    return (
        <section className="ui-transfer" aria-label={label}>
            {[false, true].map((right) => (
                <fieldset className="ui-paper" key={String(right)}>
                    <legend>{right ? 'Selected' : 'Available'}</legend>
                    {items
                        .filter((i) => value.includes(i.id) === right)
                        .map((i) => (
                            <label className="ui-transfer-item" key={i.id} htmlFor={`transfer-${i.id}`}>
                                <Checkbox
                                    id={`transfer-${i.id}`}
                                    checked={selected.includes(i.id)}
                                    onChange={() => {
                                        toggle(i.id);
                                    }}
                                />
                                {i.label}
                            </label>
                        ))}
                    <Button
                        variant="outline"
                        disabled={!selected.some((id) => value.includes(id) === right)}
                        onClick={() => {
                            move(!right);
                        }}
                    >
                        {right ? 'Remove selected' : 'Add selected'}
                    </Button>
                </fieldset>
            ))}
        </section>
    );
};
export interface Column<T> {
    key: string;
    header: string;
    value: (row: T) => string | number;
    render?: (row: T) => ReactNode;
    sortable?: boolean;
}

const sortDirection = (
    sort: { key: string; direction: 1 | -1 } | undefined,
    key: string,
): 'ascending' | 'descending' | undefined => {
    if (sort?.key !== key) {
        return undefined;
    }
    if (sort.direction === 1) {
        return 'ascending';
    }
    return 'descending';
};
/** Semantic table with sorting and pagination; not a virtualised ARIA grid. */
export const DataTable = <T,>({
    rows,
    columns,
    rowKey,
    caption,
    pageSize = 10,
}: {
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string;
    caption: string;
    pageSize?: number;
}): ReactNode => {
    const [sort, setSort] = useState<{ key: string; direction: 1 | -1 }>();
    const [page, setPage] = useState(0);
    const size = Math.max(1, Math.floor(pageSize));
    const sorted = useMemo(() => {
        const column = columns.find((c) => c.key === sort?.key);
        if (!column || !sort) {
            return rows;
        }
        return [...rows].sort((left, right) => {
            const leftValue = column.value(left);
            const rightValue = column.value(right);
            const comparison =
                typeof leftValue === 'number' && typeof rightValue === 'number'
                    ? leftValue - rightValue
                    : String(leftValue).localeCompare(String(rightValue));
            return comparison * sort.direction;
        });
    }, [rows, columns, sort]);
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(page, pages - 1);
    return (
        <div className="ui-data-table">
            {/* Scrollable overflow region must be keyboard-reachable. */}
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="ui-table-scroll" tabIndex={0} role="region" aria-label={caption}>
                <Table>
                    <caption>{caption}</caption>
                    <thead>
                        <tr>
                            {columns.map((c) => (
                                <th key={c.key} scope="col" aria-sort={sortDirection(sort, c.key)}>
                                    {c.sortable ? (
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                setSort({
                                                    key: c.key,
                                                    direction: sort?.key === c.key && sort.direction === 1 ? -1 : 1,
                                                });
                                                setPage(0);
                                            }}
                                        >
                                            {c.header}
                                        </Button>
                                    ) : (
                                        c.header
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.slice(current * size, (current + 1) * size).map((row) => (
                            <tr key={rowKey(row)}>
                                {columns.map((c) => (
                                    <td key={c.key}>{c.render?.(row) ?? c.value(row)}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
            <nav aria-label={`${caption} pages`} className="ui-pagination">
                <Button
                    variant="outline"
                    disabled={current === 0}
                    onClick={() => {
                        setPage(current - 1);
                    }}
                >
                    Previous
                </Button>
                <span role="status">
                    Page {current + 1} of {pages}
                </span>
                <Button
                    variant="outline"
                    disabled={current === pages - 1}
                    onClick={() => {
                        setPage(current + 1);
                    }}
                >
                    Next
                </Button>
            </nav>
        </div>
    );
};
export interface TreeNode {
    id: string;
    label: string;
    href?: string;
    children?: TreeNode[];
}
function renderTreeNode(node: TreeNode): ReactNode {
    if (node.children?.length)
        return (
            <Accordion title={node.label}>
                {node.href && (
                    <a className="ui-link" href={node.href}>
                        Open {node.label}
                    </a>
                )}
                {renderTreeNodes(node.children)}
            </Accordion>
        );
    if (node.href)
        return (
            <a className="ui-link" href={node.href}>
                {node.label}
            </a>
        );
    return node.label;
}
function renderTreeNodes(nodes: TreeNode[]): ReactNode {
    return (
        <ul>
            {nodes.map((node) => (
                <li key={node.id}>{renderTreeNode(node)}</li>
            ))}
        </ul>
    );
}
/** Native disclosure navigation, intentionally not an ARIA tree widget. */
export const TreeView = ({ nodes, label }: { nodes: TreeNode[]; label: string }): ReactNode => (
    <nav aria-label={label} className="ui-tree">
        {renderTreeNodes(nodes)}
    </nav>
);

export const DatePicker = (props: Omit<ComponentProps<'input'>, 'type'>): ReactNode => {
    return <Input {...props} type="date" />;
};
export const TimePicker = (props: Omit<ComponentProps<'input'>, 'type'>): ReactNode => {
    return <Input {...props} type="time" />;
};
export const DateTimePicker = (props: Omit<ComponentProps<'input'>, 'type'>): ReactNode => {
    return <Input {...props} type="datetime-local" />;
};
export const BarChart = ({ data, label }: { data: { label: string; value: number }[]; label: string }): ReactNode => {
    const maximum = Math.max(1, ...data.map((d) => Math.abs(d.value)));
    return (
        <figure className="ui-chart">
            <figcaption>{label}</figcaption>
            <table>
                <tbody>
                    {data.map((d) => (
                        <tr key={d.label}>
                            <th scope="row">{d.label}</th>
                            <td>
                                <svg aria-hidden="true" viewBox="0 0 100 10" preserveAspectRatio="none">
                                    <rect width={(Math.abs(d.value) / maximum) * 100} height="10" />
                                </svg>
                                <span>{d.value}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </figure>
    );
};
/** Multi-column visual masonry. DOM reading order is column-major. */
export const Masonry = ({ children }: { children: ReactNode }): ReactNode => {
    return <div className="ui-masonry">{children}</div>;
};
