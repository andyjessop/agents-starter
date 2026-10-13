import type { ComponentProps, ReactNode } from 'react';

import { cx, type ThemeStyle } from '../shared';

type DivProps = Omit<ComponentProps<'div'>, 'style'> & { style?: ThemeStyle };
export const Box = ({ className, ...props }: DivProps): ReactNode => {
    return <div className={cx('ui-box', className)} {...props} />;
};
export const Container = ({ className, ...props }: DivProps): ReactNode => {
    return <div className={cx('ui-container', className)} {...props} />;
};
export const Stack = ({
    className,
    direction = 'column',
    ...props
}: DivProps & { direction?: 'row' | 'column' }): ReactNode => {
    return <div className={cx('ui-stack', className)} data-direction={direction} {...props} />;
};
export const Grid = ({ className, ...props }: DivProps): ReactNode => {
    return <div className={cx('ui-grid', className)} {...props} />;
};
export const Paper = ({ className, ...props }: DivProps): ReactNode => {
    return <div className={cx('ui-paper', className)} {...props} />;
};
export const Card = ({ className, ...props }: ComponentProps<'article'>): ReactNode => {
    return <article className={cx('ui-card', className)} {...props} />;
};
export const AppBar = ({ className, ...props }: ComponentProps<'header'>): ReactNode => {
    return <header className={cx('ui-app-bar', className)} {...props} />;
};
export const Divider = ({ className, ...props }: ComponentProps<'hr'>): ReactNode => {
    return <hr className={cx('ui-divider', className)} {...props} />;
};
export const ImageList = ({ className, ...props }: ComponentProps<'ul'>): ReactNode => {
    return <ul className={cx('ui-image-list', className)} {...props} />;
};
export const Timeline = ({ className, ...props }: ComponentProps<'ol'>): ReactNode => {
    return <ol className={cx('ui-timeline', className)} {...props} />;
};
export const List = ({ className, ...props }: ComponentProps<'ul'>): ReactNode => {
    return <ul className={cx('ui-list', className)} {...props} />;
};
export const ListItem = ({ className, ...props }: ComponentProps<'li'>): ReactNode => {
    return <li className={cx('ui-item', className)} {...props} />;
};
export const Table = ({ className, ...props }: ComponentProps<'table'>): ReactNode => {
    return <table className={cx('ui-table', className)} {...props} />;
};
export const Typography = ({
    as: Tag = 'p',
    variant = 'body',
    className,
    ...props
}: ComponentProps<'p'> & {
    as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    variant?: 'body' | 'caption' | 'label' | 'heading' | 'display';
}): ReactNode => {
    return <Tag className={cx('ui-type', className)} data-variant={variant} {...props} />;
};
export const Theme = ({
    scheme,
    density,
    className,
    ...props
}: DivProps & {
    scheme?: 'auto' | 'light' | 'dark';
    density?: 'compact' | 'comfortable' | 'spacious';
}): ReactNode => {
    return (
        <div
            data-ui-scope=""
            data-ui-theme={scheme}
            data-ui-density={density}
            className={cx('ui-theme', className)}
            {...props}
        />
    );
};
export const VisuallyHidden = ({ children }: { children: ReactNode }): ReactNode => {
    return <span className="ui-visually-hidden">{children}</span>;
};
