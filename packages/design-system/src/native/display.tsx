'use client';
import { useState, type ComponentProps, type ReactNode } from 'react';

import { cx, type Tone } from '../shared';
import { Button } from './controls';

export const Avatar = ({
    src,
    alt,
    fallback,
    className,
    ...props
}: Omit<ComponentProps<'span'>, 'children'> & {
    src?: string;
    alt: string;
    fallback: ReactNode;
}): ReactNode => {
    const [failed, setFailed] = useState<string>();
    return (
        <span className={cx('ui-avatar', className)} {...props}>
            {src && failed !== src ? (
                <img
                    src={src}
                    alt={alt}
                    onError={() => {
                        setFailed(src);
                    }}
                />
            ) : (
                <span role="img" aria-label={alt}>
                    {fallback}
                </span>
            )}
        </span>
    );
};
export const Badge = ({
    className,
    tone = 'accent',
    ...props
}: ComponentProps<'span'> & { tone?: Tone }): ReactNode => {
    return <span className={cx('ui-badge', className)} data-tone={tone} {...props} />;
};
export const Chip = ({
    children,
    onDelete,
    deleteLabel,
    className,
    ...props
}: ComponentProps<'span'> &
    ({ onDelete?: never; deleteLabel?: never } | { onDelete: () => void; deleteLabel: string })): ReactNode => {
    return (
        <span className={cx('ui-chip', className)} {...props}>
            {children}
            {onDelete && (
                <Button variant="ghost" aria-label={deleteLabel} onClick={onDelete}>
                    ×
                </Button>
            )}
        </span>
    );
};
export const Alert = ({
    className,
    tone = 'info',
    action,
    children,
    ...props
}: ComponentProps<'div'> & { tone?: Tone; action?: ReactNode }): ReactNode => {
    let glyph = 'i';
    if (tone === 'success') glyph = '✓';
    else if (tone === 'warning') glyph = '!';
    else if (tone === 'danger') glyph = '×';
    return (
        <div className={cx('ui-alert', className)} data-tone={tone} {...props}>
            <span className="ui-alert-icon" aria-hidden="true">
                {glyph}
            </span>
            <div className="ui-alert-body">{children}</div>
            {action ? <div className="ui-alert-action">{action}</div> : null}
        </div>
    );
};
export const Backdrop = ({ className, ...props }: ComponentProps<'div'>): ReactNode => {
    return <div aria-hidden="true" className={cx('ui-backdrop', className)} {...props} />;
};
export const Skeleton = ({ className, ...props }: ComponentProps<'span'>): ReactNode => {
    return <span aria-hidden="true" className={cx('ui-skeleton', className)} {...props} />;
};
export const Progress = ({ className, label, ...props }: ComponentProps<'progress'> & { label: string }): ReactNode => {
    return <progress aria-label={label} className={cx('ui-progress', className)} {...props} />;
};
export const CircularProgress = ({
    value,
    max = 100,
    label,
}: {
    value?: number;
    max?: number;
    label: string;
}): ReactNode => {
    const validMax = max > 0 ? max : 100;
    const percent = value === undefined ? undefined : Math.max(0, Math.min(100, (value / validMax) * 100));
    return (
        <svg
            className="ui-circular-progress"
            viewBox="0 0 40 40"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={validMax}
            aria-valuenow={value === undefined ? undefined : Math.max(0, Math.min(validMax, value))}
            data-indeterminate={value === undefined}
        >
            <circle className="ui-progress-track" cx="20" cy="20" r="16" />
            <circle
                className="ui-progress-value"
                cx="20"
                cy="20"
                r="16"
                pathLength="100"
                strokeDasharray={`${percent ?? 25} 100`}
            />
        </svg>
    );
};
export const Icon = ({
    className,
    children,
    label,
    ...props
}: ComponentProps<'svg'> & { label?: string }): ReactNode => {
    return (
        <svg
            viewBox="0 0 24 24"
            className={cx('ui-icon', className)}
            role={label ? 'img' : undefined}
            aria-label={label}
            aria-hidden={label ? undefined : true}
            {...props}
        >
            {children}
        </svg>
    );
};
const EmptyGlyph = (): ReactNode => (
    <Icon>
        <rect x="4" y="6" width="16" height="13" rx="2" />
        <path d="M4 10h16" />
    </Icon>
);
export const Empty = ({
    className,
    icon = <EmptyGlyph />,
    title,
    description,
    action,
    children,
    ...props
}: Omit<ComponentProps<'div'>, 'title'> & {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    icon?: ReactNode;
}): ReactNode => {
    return (
        <div className={cx('ui-empty', className)} {...props}>
            {icon ? (
                <div className="ui-empty-icon" aria-hidden="true">
                    {icon}
                </div>
            ) : null}
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
            {action ? <div className="ui-empty-action">{action}</div> : null}
            {children}
        </div>
    );
};

export type StatCardProps = {
    label: string;
    value: ReactNode;
    description: ReactNode;
    icon?: ReactNode;
    /** When set with `link`, the card is an interactive summary that navigates. */
    href?: string;
    link?: string;
    ariaLabel?: string;
    unavailable?: boolean;
    className?: string;
};

export const StatCards = ({ className, ...props }: ComponentProps<'div'>): ReactNode => {
    return <div className={cx('ui-stat-cards', className)} {...props} />;
};

export const StatCard = ({
    label,
    value,
    description,
    icon,
    href,
    link,
    ariaLabel,
    unavailable = false,
    className,
}: StatCardProps): ReactNode => {
    const summary = (
        <>
            <div className="ui-stat-card-summary">
                <div className="ui-stat-card-heading">
                    {icon ? <span className="ui-stat-card-icon">{icon}</span> : null}
                    <span className="ui-stat-card-label">{label}</span>
                </div>
                <strong className={cx('ui-stat-card-value', unavailable && 'ui-stat-card-unavailable')}>{value}</strong>
                <p
                    className="ui-stat-card-description"
                    title={typeof description === 'string' ? description : undefined}
                >
                    {description}
                </p>
            </div>
            {href && link ? (
                <span className="ui-stat-card-link">
                    <span className="ui-stat-card-destination">
                        <span>{link}</span>
                    </span>
                    <span
                        className="ui-button ui-icon-button"
                        data-variant="outline"
                        data-tone="accent"
                        aria-hidden="true"
                    >
                        <Icon strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M13 6l6 6-6 6" />
                        </Icon>
                    </span>
                </span>
            ) : null}
        </>
    );
    if (href && link) {
        return (
            <a className={cx('ui-stat-card', className)} href={href} aria-label={ariaLabel ?? link}>
                {summary}
            </a>
        );
    }
    return (
        <article className={cx('ui-stat-card', className)} aria-label={ariaLabel ?? label}>
            {summary}
        </article>
    );
};
