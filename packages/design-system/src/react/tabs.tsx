'use client';
import { useId, useState, type ReactNode } from 'react';
import { attachTabs, type TabsOptions } from '../behaviours/tabs';
import { useController } from './use-controller';

export interface TabItem {
    value: string;
    label: ReactNode;
    content: ReactNode;
    disabled?: boolean;
}
export interface TabsProps extends TabsOptions {
    label: string;
    items: readonly TabItem[];
}
export const Tabs = ({ label, items, ...options }: TabsProps): ReactNode => {
    const id = useId();
    const { root } = useController(attachTabs, options);
    // SSR equivalents stay fixed after mount. Controllers own derived attributes.
    // Read-only SSR snapshot: selection mutations belong exclusively to the attached controller.
    // eslint-disable-next-line react/hook-use-state
    const [selected] = useState(
        options.value === undefined ? (options.defaultValue ?? items.find((i) => !i.disabled)?.value) : options.value,
    );
    return (
        <div ref={root} className="ui-tabs" data-ui-root="tabs">
            <div className="ui-tabs-list" data-ui-part="list" role="tablist" aria-label={label}>
                {items.map((item) => (
                    <button
                        type="button"
                        className="ui-tab"
                        data-ui-part="tab"
                        data-ui-value={item.value}
                        data-label={typeof item.label === 'string' ? item.label : undefined}
                        key={item.value}
                        id={`${id}-tab-${encodeURIComponent(item.value)}`}
                        disabled
                        data-ui-gated=""
                        data-ui-disabled={String(!!item.disabled)}
                        role="tab"
                        aria-controls={`${id}-panel-${encodeURIComponent(item.value)}`}
                        aria-selected={item.value === selected && !item.disabled}
                        tabIndex={item.value === selected && !item.disabled ? 0 : -1}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            {items.map((item) => (
                <div
                    className="ui-tab-panel"
                    role="tabpanel"
                    aria-labelledby={`${id}-tab-${encodeURIComponent(item.value)}`}
                    data-ui-part="panel"
                    data-ui-value={item.value}
                    key={item.value}
                    id={`${id}-panel-${encodeURIComponent(item.value)}`}
                    hidden={item.value !== selected}
                    tabIndex={0}
                >
                    {item.content}
                </div>
            ))}
        </div>
    );
};
