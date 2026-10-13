import { useState, type ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import '../styles/index.css';
import { Button, Checkbox, NumberField, Rating, Select, Switch, ToggleButton } from './controls';
import { Table } from './layout';
import { Link } from './navigation';

const NativeForm = (): ReactNode => {
    const [pressed, setPressed] = useState(false);
    const [rating, setRating] = useState(2);
    return (
        <form
            aria-label="Native form"
            onSubmit={(event) => {
                event.preventDefault();
            }}
        >
            <label>
                Quantity
                <NumberField name="quantity" defaultValue={2} />
            </label>
            <label>
                Country
                <Select name="country" defaultValue="fr">
                    <option value="fr">France</option>
                </Select>
            </label>
            <label>
                <Checkbox name="updates" />
                Email updates
            </label>
            <label>
                <Switch name="enabled" defaultChecked />
                Enabled
            </label>
            <Rating label="Rating" name="rating" value={rating} onValueChange={setRating} />
            <ToggleButton pressed={pressed} onPressedChange={setPressed}>
                Pin
            </ToggleButton>
            <Button type="reset">Reset</Button>
            <Table>
                <caption>Example table</caption>
                <tbody>
                    <tr>
                        <th scope="row">Name</th>
                        <td>Alex</td>
                    </tr>
                </tbody>
            </Table>
        </form>
    );
};
it('preserves native submission, reset, labels and controlled button semantics', async () => {
    const screen = await render(<NativeForm />);
    await userEvent.click(screen.getByLabelText('Email updates'));
    await userEvent.click(screen.getByRole('button', { name: 'Pin', exact: true }));
    await expect
        .element(screen.getByRole('button', { name: 'Pin', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    const form = screen.getByRole('form', { name: 'Native form' }).element();
    if (!(form instanceof HTMLFormElement)) throw new Error('Missing form');
    const submitted = new FormData(form);
    expect(submitted.get('country')).toBe('fr');
    expect(submitted.get('quantity')).toBe('2');
    expect(submitted.get('updates')).toBe('on');
    expect(submitted.get('enabled')).toBe('on');
    expect(submitted.get('rating')).toBe('2');
    await userEvent.click(screen.getByRole('button', { name: 'Reset', exact: true }));
    expect(new FormData(form).has('updates')).toBe(false);
    await expect.element(screen.getByRole('table', { name: 'Example table' })).toBeVisible();
});

it('does not underline anchors that use the button class', async () => {
    const screen = await render(
        <a className="ui-button" href="#run">
            Run snapshot
        </a>,
    );
    const link = screen.getByRole('link', { name: 'Run snapshot', exact: true }).element();
    expect(getComputedStyle(link).textDecorationLine).toBe('none');
});

it('disallows native drag on buttons and links', async () => {
    const screen = await render(
        <>
            <Button>Save</Button>
            <a className="ui-button" href="#run">
                Run snapshot
            </a>
            <Link href="#docs">Docs</Link>
        </>,
    );
    const button = screen.getByRole('button', { name: 'Save', exact: true }).element();
    const buttonLink = screen.getByRole('link', { name: 'Run snapshot', exact: true }).element();
    const link = screen.getByRole('link', { name: 'Docs', exact: true }).element();
    expect(button).toHaveAttribute('draggable', 'false');
    expect(link).toHaveAttribute('draggable', 'false');
    // -webkit-user-drag is Chromium/WebKit only; Firefox leaves the computed value empty.
    for (const element of [buttonLink, link]) {
        const userDrag = getComputedStyle(element).getPropertyValue('-webkit-user-drag');
        expect(userDrag === '' || userDrag === 'none').toBe(true);
    }
});

it('does not keep the user-agent fieldset border', async () => {
    const screen = await render(
        <fieldset>
            <legend>Sections</legend>
        </fieldset>,
    );
    const fieldset = screen.getByRole('group', { name: 'Sections' }).element();
    expect(getComputedStyle(fieldset).borderTopWidth).toBe('0px');
    expect(getComputedStyle(fieldset).borderTopStyle).toBe('none');
});
