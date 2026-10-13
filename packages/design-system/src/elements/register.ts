export function register(name: string, implementation: CustomElementConstructor): void {
    const previous = customElements.get(name);
    if (previous && previous !== implementation)
        throw new Error(`${name} already has an incompatible definition; load one installed version per document`);
    if (!previous) customElements.define(name, implementation);
}
