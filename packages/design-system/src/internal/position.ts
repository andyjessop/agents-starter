export interface PositionOptions {
    side?: 'top' | 'bottom' | 'left' | 'right';
    align?: 'start' | 'center' | 'end';
}
/** Bounded fixed-position fallback; CSS anchors remain an unshipped enhancement. */
export function positionPopup(
    anchor: HTMLElement,
    popup: HTMLElement,
    options: PositionOptions,
    close: () => void,
): () => void {
    const view = anchor.ownerDocument.defaultView;
    if (!view) return () => undefined;
    const win: Window = view;
    let frame = 0;
    let stopped = false;
    const original = new Map<string, string>();
    const written = new Map<string, string>();
    function style(key: string, value: string): void {
        if (!original.has(key)) original.set(key, popup.style.getPropertyValue(key));
        popup.style.setProperty(key, value);
        written.set(key, value);
    }
    function update(): void {
        frame = 0;
        if (stopped) return;
        const a = anchor.getBoundingClientRect();
        const viewport = win.visualViewport;
        const left = viewport?.offsetLeft ?? 0;
        const top = viewport?.offsetTop ?? 0;
        const width = viewport?.width ?? win.innerWidth;
        const height = viewport?.height ?? win.innerHeight;
        let clipped = a.bottom <= top || a.top >= top + height || a.right <= left || a.left >= left + width;
        for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
            const css = win.getComputedStyle(parent);
            if (!/(auto|scroll|hidden|clip)/.test(css.overflow + css.overflowX + css.overflowY)) continue;
            const rect = parent.getBoundingClientRect();
            if (a.bottom <= rect.top || a.top >= rect.bottom || a.right <= rect.left || a.left >= rect.right)
                clipped = true;
        }
        if (!anchor.isConnected || !popup.isConnected || !a.width || !a.height || clipped) {
            close();
            return;
        }
        // Resolve arbitrary CSS lengths through computed margins/padding, not parseFloat(rem/calc()).
        style('margin', 'var(--ui-popup-gap, 6px)');
        style('padding-top', 'var(--ui-popup-viewport-padding, 8px)');
        const css = win.getComputedStyle(popup);
        const gap = parseFloat(css.marginTop) || 0;
        const pad = parseFloat(css.paddingTop) || 0;
        popup.style.setProperty('padding-top', original.get('padding-top') ?? '');
        written.set('padding-top', original.get('padding-top') ?? '');
        style('margin', '0px');
        style('position', 'fixed');
        style('right', 'auto');
        style('bottom', 'auto');
        style('position-area', 'none');
        style('max-width', `${Math.max(0, width - pad * 2)}px`);
        style('max-height', `${Math.max(0, height - pad * 2)}px`);
        style('overflow', 'auto');
        const b = popup.getBoundingClientRect();
        let side = options.side ?? 'bottom';
        const available = {
            top: a.top - top,
            bottom: top + height - a.bottom,
            left: a.left - left,
            right: left + width - a.right,
        };
        const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
        const required = (side === 'top' || side === 'bottom' ? b.height : b.width) + gap + pad;
        if (available[side] < required && available[opposite[side]] > available[side]) side = opposite[side];
        const vertical = side === 'top' || side === 'bottom';
        let align = options.align ?? 'start';
        if (vertical && win.getComputedStyle(anchor).direction === 'rtl' && align !== 'center')
            align = align === 'start' ? 'end' : 'start';
        let x = a.left;
        let y = a.top;
        if (align === 'center') {
            x += (a.width - b.width) / 2;
            y += (a.height - b.height) / 2;
        }
        if (align === 'end') {
            x = a.right - b.width;
            y = a.bottom - b.height;
        }
        let px = x;
        let py = y;
        if (!vertical) px = side === 'left' ? a.left - b.width - gap : a.right + gap;
        if (vertical) py = side === 'top' ? a.top - b.height - gap : a.bottom + gap;
        style('left', `${Math.max(left + pad, Math.min(px, left + width - b.width - pad))}px`);
        style('top', `${Math.max(top + pad, Math.min(py, top + height - b.height - pad))}px`);
    }
    function schedule(): void {
        if (!frame && !stopped) frame = win.requestAnimationFrame(update);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(anchor);
    observer.observe(popup);
    win.addEventListener('scroll', schedule, true);
    win.addEventListener('resize', schedule);
    win.visualViewport?.addEventListener('resize', schedule);
    win.visualViewport?.addEventListener('scroll', schedule);
    update();
    return () => {
        stopped = true;
        win.cancelAnimationFrame(frame);
        observer.disconnect();
        win.removeEventListener('scroll', schedule, true);
        win.removeEventListener('resize', schedule);
        win.visualViewport?.removeEventListener('resize', schedule);
        win.visualViewport?.removeEventListener('scroll', schedule);
        for (const [key, last] of written)
            if (popup.style.getPropertyValue(key) === last) popup.style.setProperty(key, original.get(key) ?? '');
    };
}
