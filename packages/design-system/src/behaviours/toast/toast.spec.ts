import { createToastStore, toastCopy } from './index';

afterEach(() => {
    vi.useRealTimers();
});
it('splits title and description from a sentence pair', () => {
    expect(toastCopy('Wallet added. Import started.')).toEqual({
        title: 'Wallet added.',
        description: 'Import started.',
    });
    expect(toastCopy('Saved')).toEqual({ title: 'Saved' });
});
it('shows newest first, retains remaining timeout and combines pause reasons', () => {
    vi.useFakeTimers();
    const store = createToastStore();
    const first = store.push({ message: 'First' });
    const second = store.push({ message: 'Second', kind: 'error' });
    const third = store.push({ message: 'Third', action: { label: 'Undo', run: () => undefined } });
    const fourth = store.push({ message: 'Fourth' });
    expect(store.getSnapshot().map((t) => t.id)).toEqual([fourth, third, second]);
    expect(store.getSnapshot().map((t) => t.id)).not.toContain(first);
    vi.advanceTimersByTime(2_000);
    store.pause(fourth, 'hover', true);
    store.pause(fourth, 'focus', true);
    vi.advanceTimersByTime(10_000);
    store.pause(fourth, 'hover', false);
    vi.advanceTimersByTime(5_000);
    expect(store.getSnapshot()[0]?.id).toBe(fourth);
    store.pause(fourth, 'focus', false);
    vi.advanceTimersByTime(2_999);
    expect(store.getSnapshot()[0]?.id).toBe(fourth);
    vi.advanceTimersByTime(1);
    expect(store.getSnapshot().map((t) => t.id)).toEqual([third, second, first]);
    store.destroy();
    expect(vi.getTimerCount()).toBe(0);
});
it('stores are isolated and destruction removes timers and subscriptions', () => {
    vi.useFakeTimers();
    const a = createToastStore();
    const b = createToastStore();
    const notify = vi.fn();
    a.subscribe(notify);
    a.push({ message: 'A' });
    b.push({ message: 'B' });
    a.destroy();
    vi.advanceTimersByTime(5_000);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(b.getSnapshot()).toEqual([]);
    expect(() => a.push({ message: 'No' })).toThrow('destroyed');
    b.destroy();
});
