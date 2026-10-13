import type { ComponentProps, ReactNode } from 'react';

import { cx } from '../shared';

export const Link = ({ className, children, ...props }: ComponentProps<'a'>): ReactNode => {
    return (
        <a className={cx('ui-link', className)} {...props} draggable={false}>
            {children}
        </a>
    );
};
export const Breadcrumbs = ({ children, className, ...props }: ComponentProps<'nav'>): ReactNode => {
    return (
        <nav aria-label="Breadcrumbs" className={cx('ui-breadcrumbs', className)} {...props}>
            <ol>{children}</ol>
        </nav>
    );
};
export const BottomNavigation = ({ className, ...props }: ComponentProps<'nav'>): ReactNode => {
    return <nav aria-label="Primary" className={cx('ui-bottom-navigation', className)} {...props} />;
};
export const Pagination = ({
    page,
    count,
    href,
    label = 'Pagination',
}: {
    page: number;
    count: number;
    href: (page: number) => string;
    label?: string;
}): ReactNode => {
    const total = Math.max(1, Math.floor(count));
    const current = Math.max(1, Math.min(total, page));
    const pages = [...new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total))].sort(
        (a, b) => a - b,
    );
    return (
        <nav className="ui-pagination" aria-label={label}>
            {current > 1 && (
                <Link href={href(current - 1)} rel="prev">
                    Previous
                </Link>
            )}
            {pages.map((n, i) => {
                const previous = pages[i - 1];
                return (
                    <span key={n}>
                        {i > 0 && previous !== undefined && n - previous > 1 && <span aria-hidden="true">…</span>}
                        <Link href={href(n)} aria-label={`Page ${n}`} aria-current={n === current ? 'page' : undefined}>
                            {n}
                        </Link>
                    </span>
                );
            })}
            {current < total && (
                <Link href={href(current + 1)} rel="next">
                    Next
                </Link>
            )}
        </nav>
    );
};
export const Stepper = ({
    steps,
    current,
    label = 'Progress',
}: {
    steps: ReactNode[];
    current: number;
    label?: string;
}): ReactNode => {
    return (
        <ol className="ui-stepper" aria-label={label}>
            {steps.map((step, i) => (
                <li
                    key={typeof step === 'string' || typeof step === 'number' ? String(step) : `step-${String(i)}`}
                    aria-current={i === current ? 'step' : undefined}
                    data-complete={i < current}
                >
                    <span className="ui-step-marker" aria-hidden="true">
                        {i < current ? '✓' : i + 1}
                    </span>
                    {step}
                    {i < current && <span className="ui-visually-hidden"> (complete)</span>}
                </li>
            ))}
        </ol>
    );
};
