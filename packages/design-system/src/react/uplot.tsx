'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import './ensure-navigator-language';
import UPlotLib, { type AlignedData, type Options } from 'uplot';
import '../styles/charts.css';

export { UPlotLib };
export type { AlignedData, Options as UPlotOptions };
export type UPlotInstance = UPlotLib;

export type UPlotProps = {
    options: Omit<Options, 'width' | 'height'> & Partial<Pick<Options, 'width' | 'height'>>;
    data: AlignedData;
    className?: string;
    /** When true (default), data updates reset scales. */
    resetScales?: boolean;
    onCreate?: (plot: UPlotLib) => void;
    onDelete?: (plot: UPlotLib) => void;
};

/**
 * Thin React host for a uPlot instance. Owns create/destroy, ResizeObserver sizing,
 * and setData updates. Callers own options identity when the series structure changes.
 */
export const UPlot = ({ options, data, className, resetScales = true, onCreate, onDelete }: UPlotProps): ReactNode => {
    const rootRef = useRef<HTMLDivElement>(null);
    const plotRef = useRef<UPlotLib | null>(null);
    const latest = useRef({ options, data, resetScales, onCreate, onDelete });

    useEffect(() => {
        latest.current = { options, data, resetScales, onCreate, onDelete };
    });

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const destroy = (): void => {
            const plot = plotRef.current;
            if (!plot) return;
            latest.current.onDelete?.(plot);
            plot.destroy();
            plotRef.current = null;
        };

        const ensurePlot = (width: number, height: number): void => {
            const { current } = plotRef;
            if (current) {
                current.setSize({ width, height });
                return;
            }
            const plot = new UPlotLib({ ...latest.current.options, width, height }, latest.current.data, root);
            plotRef.current = plot;
            latest.current.onCreate?.(plot);
        };

        const syncSize = (): void => {
            const width = Math.floor(root.clientWidth);
            const height = Math.floor(root.clientHeight);
            if (width < 1 || height < 1) return;
            ensurePlot(width, height);
        };

        syncSize();
        const observer = new ResizeObserver(syncSize);
        observer.observe(root);
        return () => {
            observer.disconnect();
            destroy();
        };
    }, [options]);

    useEffect(() => {
        plotRef.current?.setData(data, resetScales);
    }, [data, resetScales]);

    return <div ref={rootRef} className={className} />;
};
