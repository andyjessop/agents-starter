import { attachDialog } from './index';

const releases: (() => void)[] = [];
afterEach(() => {
    releases
        .splice(0)
        .reverse()
        .forEach((fn) => {
            fn();
        });
});

function host(markup: string): HTMLElement {
    const root = document.createElement('section');
    document.body.append(root);
    root.innerHTML = markup;
    releases.push(() => {
        root.remove();
    });
    return root;
}

function get(root: HTMLElement, selector: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
}

it('focuses the first content field when opening without initialFocus', () => {
    const root = host(
        `<button id="invoker">Open</button>
         <dialog class="ui-dialog ui-dialog-sectioned" aria-label="New case">
           <div class="ui-dialog-heading">
             <h2>New case</h2>
             <button type="button" data-ui-part="close" aria-label="Close">Close</button>
           </div>
           <div class="ui-dialog-content">
             <label>Customer name <input id="name" /></label>
           </div>
           <div class="ui-dialog-footer">
             <button type="button">Cancel</button>
             <button type="submit">Create case</button>
           </div>
         </dialog>`,
    );
    const dialog = get(root, 'dialog');
    const modal = attachDialog(dialog);
    releases.push(modal.destroy);
    modal.show(get(root, '#invoker'));
    expect(document.activeElement).toBe(get(root, '#name'));
});

it('focuses the footer cancel control when content has no fields', () => {
    const root = host(
        `<button id="invoker">Open</button>
         <dialog class="ui-dialog ui-dialog-sectioned" aria-label="Expire case">
           <div class="ui-dialog-heading">
             <h2>Expire case</h2>
             <button type="button" data-ui-part="close" aria-label="Close">Close</button>
           </div>
           <div class="ui-dialog-content">
             <p>Expiry prevents further work on this case.</p>
           </div>
           <div class="ui-dialog-footer">
             <button type="button" id="cancel">Cancel</button>
             <button type="button" id="confirm">Expire case</button>
           </div>
         </dialog>`,
    );
    const dialog = get(root, 'dialog');
    const modal = attachDialog(dialog);
    releases.push(modal.destroy);
    modal.show(get(root, '#invoker'));
    expect(document.activeElement).toBe(get(root, '#cancel'));
});

it('honours an explicit initialFocus over the content field', () => {
    const root = host(
        `<button id="invoker">Open</button>
         <dialog class="ui-dialog ui-dialog-sectioned" aria-label="Edit">
           <div class="ui-dialog-heading">
             <h2 id="title" tabindex="-1">Edit</h2>
             <button type="button" data-ui-part="close" aria-label="Close">Close</button>
           </div>
           <div class="ui-dialog-content">
             <input id="name" />
           </div>
         </dialog>`,
    );
    const dialog = get(root, 'dialog');
    const title = get(root, '#title');
    const modal = attachDialog(dialog, { initialFocus: title });
    releases.push(modal.destroy);
    modal.show(get(root, '#invoker'));
    expect(document.activeElement).toBe(title);
});
