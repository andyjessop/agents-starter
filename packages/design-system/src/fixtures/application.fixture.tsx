import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import {
    Button,
    Combobox,
    Dialog,
    Menu,
    Popover,
    Tabs,
    TextField,
    Theme,
    Tooltip,
    ToastViewport,
    createToastStore,
} from '../index';
import type { Visibility } from '../behaviours/dialog';

/** Representative consumer used by interaction tests and the bundle budget. */
export const ApplicationFixture = (): ReactNode => {
    const [country, setCountry] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const store = useMemo(() => createToastStore(), []);
    const dialog = useRef<Visibility>(null);
    useEffect(
        () => () => {
            store.destroy();
        },
        [store],
    );
    return (
        <Theme scheme="light">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    store.push({ message: 'Saved' });
                }}
            >
                <TextField label="Name" name="name" />
                <Combobox
                    label="Country"
                    name="country"
                    value={country}
                    inputValue={query}
                    options={['France', 'Finland', 'Germany']
                        .filter((label) => label.toLowerCase().includes(query.toLowerCase()))
                        .map((label) => ({ value: label, label }))}
                    onValueChange={({ value, label }) => {
                        setCountry(value);
                        setQuery(label);
                    }}
                    onInputValueChange={({ value }) => {
                        setQuery(value);
                    }}
                />
                <Button type="submit">Save</Button>
            </form>
            <Menu
                label="Actions"
                items={[{ id: 'notify', label: 'Notify' }]}
                onAction={() => store.push({ message: 'Saved' })}
            />
            <Button onClick={(event) => dialog.current?.show(event.currentTarget)}>Open dialog</Button>
            <Dialog ref={dialog} title="Edit profile">
                <TextField label="Display name" />
                <Button onClick={() => dialog.current?.hide()}>Done</Button>
            </Dialog>
            <Popover label="Details" trigger="Details">
                Additional information
            </Popover>
            <Tooltip label="Supplementary information">Help</Tooltip>
            <Tabs
                label="Profile"
                items={[
                    { value: 'overview', label: 'Overview', content: 'Profile overview' },
                    { value: 'disabled', label: 'Disabled', disabled: true, content: 'Unavailable' },
                    { value: 'activity', label: 'Activity', content: 'Recent activity' },
                ]}
            />
            <ToastViewport store={store} />
        </Theme>
    );
};
