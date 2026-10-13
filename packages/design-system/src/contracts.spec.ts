const nativeSources = import.meta.glob('./native/*', {
    query: '?raw',
    eager: true,
    import: 'default',
});

const styleSources = import.meta.glob('./styles/*.css', {
    query: '?raw',
    eager: true,
    import: 'default',
});

const popoverReactSource = import.meta.glob('./react/popover.tsx', {
    query: '?raw',
    eager: true,
    import: 'default',
});

describe('design-system contracts', () => {
    it('keeps the native entry free of Base UI', () => {
        for (const source of Object.values(nativeSources)) {
            expect(source).not.toContain('@base-ui/');
        }
    });

    it('resolves public CSS custom properties or supplies a fallback', () => {
        const css = Object.values(styleSources)
            .join('\n')
            .replace(/\/\*[\s\S]*?\*\//g, '');
        const declarations = new Set(
            [...css.matchAll(/(--[\w-]+)\s*:/g)].flatMap((match) => (match[1] === undefined ? [] : [match[1]])),
        );
        const unresolved = [...css.matchAll(/var\((--ui-[\w-]+)\s*\)/g)]
            .map((match) => match[1])
            .filter((customProperty): customProperty is string => customProperty !== undefined)
            .filter((customProperty) => !declarations.has(customProperty));

        expect(unresolved).toEqual([]);
    });

    it('pauses skeleton motion when the user prefers reduced motion', () => {
        const css = Object.values(styleSources).join('\n');
        expect(css).toContain('prefers-reduced-motion');
        expect(css).toContain('--ui-animation-play-state: paused');
        expect(css).toContain('animation-play-state: var(--ui-animation-play-state)');
    });

    it('places Popover className on the root and popupClassName on the popup', () => {
        const source = Object.values(popoverReactSource).join('\n');
        expect(source).toMatch(/data-ui-root="popover"[^>]*className=\{className\}/);
        expect(source).toMatch(/className=\{cx\('ui-popover',\s*popupClassName\)\}/);
        // Old popup-only className behaviour must not return.
        expect(source).not.toMatch(/data-ui-part="popup"[^>]*className=\{cx\('ui-popover',\s*className\)\}/);
    });
});
