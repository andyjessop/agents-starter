/* Browser-only shim for uPlot’s module-load Intl setup in test engines. */
/* eslint-disable n/no-unsupported-features/node-builtins */

function languageIsUsable(value: string): boolean {
    if (value === '' || value === 'undefined') return false;
    return Intl.NumberFormat.supportedLocalesOf([value]).length > 0;
}

if (!languageIsUsable(globalThis.navigator.language)) {
    Object.defineProperty(globalThis.navigator, 'language', {
        configurable: true,
        get: () => 'en-GB',
    });
}
