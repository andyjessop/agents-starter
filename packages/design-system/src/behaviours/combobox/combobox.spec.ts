import { userEvent } from 'vitest/browser';
import { attachCombobox, type ComboboxController, type ComboboxOptions } from './index';

let cleanup: (() => void) | undefined;
afterEach(() => {
    cleanup?.();
});
function setup(overrides: Partial<ComboboxOptions> = {}): {
    form: HTMLFormElement;
    root: HTMLElement;
    input: HTMLInputElement;
    options: ComboboxOptions;
    controller: ComboboxController;
} {
    const form = document.createElement('form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();
    });
    document.body.append(form);
    form.innerHTML =
        '<div><label for="cb">Fruit</label><input id="cb" data-ui-part="input"><div id="results" data-ui-part="popup" popover="auto"><div id="a" data-ui-part="option" data-ui-value="a">Apple</div><div id="b" data-ui-part="option" data-ui-value="b">Banana</div></div><span data-ui-part="status"></span><input type="hidden" name="fruit" data-ui-part="value"></div><button type="button">Next</button>';
    const root = form.firstElementChild;
    if (!(root instanceof HTMLElement)) throw new Error('Missing root');
    const options: ComboboxOptions = {
        options: [
            { value: 'a', label: 'Apple' },
            { value: 'b', label: 'Banana' },
        ],
        ...overrides,
    };
    const controller = attachCombobox(root, options);
    cleanup = () => {
        controller.destroy();
        form.remove();
    };
    const input = form.querySelector('input');
    if (!input) throw new Error('Missing input');
    return { form, root, input, options, controller };
}
it('delays a controlled commit until the host accepts it', async () => {
    const request = vi.fn();
    const { input, controller, form, options } = setup({ value: 'a', inputValue: 'Apple', onValueChange: request });
    input.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ value: 'b', label: 'Banana', reason: 'select' }));
    expect(new FormData(form).get('fruit')).toBe('a');
    expect(input.value).toBe('Apple');
    controller.update({ ...options, value: 'b', inputValue: 'Banana' });
    expect(new FormData(form).get('fruit')).toBe('b');
    expect(request).toHaveBeenCalledTimes(1);
});
it('retains missing committed options and clears stale active descendants', async () => {
    const { input, controller, root, options, form } = setup({ defaultValue: 'a' });
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    root.querySelector('#a')?.remove();
    controller.update({ ...options, options: [{ value: 'b', label: 'Banana' }] });
    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
    expect(new FormData(form).get('fruit')).toBe('a');
});
it('ignores IME selection, keeps Home/End native and restores uncontrolled form defaults', async () => {
    const { input, controller, form } = setup({ defaultValue: 'a' });
    input.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    await userEvent.keyboard('{Enter}');
    expect(new FormData(form).get('fruit')).toBe('a');
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    await userEvent.keyboard('{Enter}');
    expect(new FormData(form).get('fruit')).toBe('b');
    form.reset();
    await Promise.resolve();
    expect(controller.getState().value).toBe('a');
    expect(input.value).toBe('Apple');
});
it('click selection survives blur and dispatches once', async () => {
    const request = vi.fn();
    const { input, root } = setup({ onValueChange: request });
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    const option = root.querySelector('#b');
    if (!(option instanceof HTMLElement)) throw new Error('Missing option');
    await userEvent.click(option);
    expect(input.value).toBe('Banana');
    expect(request).toHaveBeenCalledTimes(1);
});
