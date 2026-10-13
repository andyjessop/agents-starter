import { StrictMode } from 'react';
import { render } from 'vitest-browser-react';

import { Popover } from './popover';

it('applies className to the root and popupClassName to the popup', async () => {
    const screen = await render(
        <StrictMode>
            <Popover
                label="Account"
                className="root-class"
                popupClassName="popup-class"
                trigger={<span>Open</span>}
            >
                <p>Panel body</p>
            </Popover>
        </StrictMode>,
    );
    const trigger = screen.getByRole('button', { name: 'Account' }).element();
    const root = trigger.parentElement;
    if (!(root instanceof HTMLElement)) {
        throw new Error('Missing popover root');
    }
    expect(root.classList.contains('root-class')).toBe(true);
    expect(root.classList.contains('popup-class')).toBe(false);

    const popup = root.querySelector('[data-ui-part="popup"]');
    if (!(popup instanceof HTMLElement)) {
        throw new Error('Missing popover popup');
    }
    expect(popup.classList.contains('popup-class')).toBe(true);
    expect(popup.classList.contains('ui-popover')).toBe(true);
    expect(popup.classList.contains('root-class')).toBe(false);
});
