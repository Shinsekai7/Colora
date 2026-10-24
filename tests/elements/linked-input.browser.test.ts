import {afterEach, beforeAll, describe, expect, it} from 'vitest';
import {commands, userEvent} from 'vitest/browser';
import {ColorPickerElement, define} from '../../src/elements/index.js';

beforeAll(() => define());

afterEach(async () => {
    ColorPickerElement.anchorPositioning = CSS.supports('anchor-name: --a');
    await commands.mouse('up', 0, 0);
    document.body.replaceChildren();
});

/** An input followed by a picker linked to it. */
const mount = (inputValue = '', attributes = 'popup') => {
    document.body.insertAdjacentHTML('beforeend', `
        <input id="color" name="color" value="${inputValue}" style="position: fixed; left: 150px; top: 20px; width: 160px">
        <button id="other" style="position: fixed; left: 400px; top: 20px">Other</button>
        <colora-picker for="color" ${attributes}></colora-picker>
    `);

    return {
        input: document.getElementById('color') as HTMLInputElement,
        el: document.querySelector('colora-picker') as ColorPickerElement
    };
};

const part = <T extends HTMLElement = HTMLElement>(el: ColorPickerElement, selector: string) =>
    el.shadowRoot?.querySelector(selector) as T;

const isOpen = (el: ColorPickerElement) => part(el, '.panel').matches(':popover-open');

const click = async (el: Element) => {
    const {left, top, width, height} = el.getBoundingClientRect();
    await commands.mouse('down', left + width / 2, top + height / 2);
    await commands.mouse('up', left + width / 2, top + height / 2);
};

const record = (target: EventTarget, types: string[]) => {
    const log: string[] = [];
    types.forEach(type => target.addEventListener(type, () => log.push(type)));
    return log;
};

describe('linking', () => {
    it('takes the color of the input', () => {
        const {el, input} = mount('#ff0000');

        expect(el.input).toBe(input);
        expect(el.value).toBe('#FF0000');
    });

    it('writes its value into an empty input', () => {
        const {input} = mount('', 'popup value="rebeccapurple"');
        expect(input.value).toBe('#663399');
    });

    it('replaces the default trigger and describes the popup', () => {
        const {el, input} = mount('#ff0000');

        expect(part(el, '.anchor').checkVisibility()).toBe(false);
        expect(input.getAttribute('aria-haspopup')).toBe('dialog');
        expect(input.getAttribute('aria-expanded')).toBe('false');
    });

    it('can be set as property', () => {
        const {el} = mount('#ff0000');
        el.setAttribute('for', 'nope');
        expect(el.input).toBeNull();

        const other = document.createElement('input');
        other.value = '#00ff00';
        document.body.append(other);

        el.input = other;
        expect(el.input).toBe(other);
        expect(el.value).toBe('#00FF00');
    });

    it('restores the input when unlinked', () => {
        const {el, input} = mount('#ff0000');
        input.setAttribute('aria-expanded', 'custom');
        el.removeAttribute('for');

        expect(el.input).toBeNull();
        expect(input.hasAttribute('aria-haspopup')).toBe(false);
        expect(input.style.getPropertyValue('anchor-name')).toBe('');
        expect(part(el, '.anchor').checkVisibility()).toBe(true);
    });

    it('only keeps the values in sync when inline', async () => {
        const {el, input} = mount('#ff0000', '');

        expect(input.hasAttribute('aria-haspopup')).toBe(false);
        await click(input);
        expect(el.picker.getState().open).toBe(false);

        await click(part(el, '.area'));
        expect(input.value).toBe(el.value);
    });
});

describe('opening', () => {
    it('opens on click and keeps the focus in the input', async () => {
        const {el, input} = mount('#ff0000');

        await click(input);
        expect(isOpen(el)).toBe(true);
        expect(input.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(input);

        // Clicking the input again keeps it open
        await click(input);
        expect(isOpen(el)).toBe(true);
    });

    it('opens with the down arrow', async () => {
        const {el, input} = mount('#ff0000');
        input.focus();

        await userEvent.keyboard('{ArrowDown}');
        expect(isOpen(el)).toBe(true);
    });

    it('closes when the focus moves on, but not into the popup', async () => {
        const {el, input} = mount('#ff0000');
        await click(input);

        part(el, '.hue').focus();
        expect(isOpen(el)).toBe(true);

        (document.getElementById('other') as HTMLElement).focus();
        expect(isOpen(el)).toBe(false);
    });

    // The button between input and picker in the document comes after the popup
    it('moves the focus from the input into the popup with Tab', async () => {
        const {el, input} = mount('#ff0000');
        await click(input);

        await userEvent.keyboard('{Tab}');
        expect(isOpen(el)).toBe(true);
        expect(part(el, '.panel').contains(el.shadowRoot?.activeElement as Node)).toBe(true);
    });

    it('closes on Escape and keeps the focus in the input', async () => {
        const {el, input} = mount('#ff0000');
        await click(input);

        await userEvent.keyboard('{Escape}');
        expect(isOpen(el)).toBe(false);
        expect(document.activeElement).toBe(input);
    });

    it('follows the input when the page scrolls', async () => {
        const {el, input} = mount('#ff0000', 'popup placement="bottom-start" theme="compact"');
        input.style.position = 'absolute';
        input.style.top = '200px';
        document.body.style.height = '3000px';

        await click(input);
        window.scrollTo(0, 100);
        await new Promise(requestAnimationFrame);

        const box = input.getBoundingClientRect();
        expect(part(el, '.panel').getBoundingClientRect().top).toBeCloseTo(box.bottom + 8, 0);

        document.body.style.height = '';
        window.scrollTo(0, 0);
    });

    describe.each([true, false])('positioning (anchor positioning: %s)', anchorPositioning => {
        it('places the popup below the input', async () => {
            ColorPickerElement.anchorPositioning = anchorPositioning;
            const {el, input} = mount('#ff0000', 'popup placement="bottom-start" theme="compact"');
            await click(input);

            const box = input.getBoundingClientRect();
            const panel = part(el, '.panel').getBoundingClientRect();
            expect(panel.top).toBeCloseTo(box.bottom + 8, 0);
            expect(panel.left).toBeCloseTo(box.left, 0);
        });

        it('places the popup below its own button after unlinking', async () => {
            ColorPickerElement.anchorPositioning = anchorPositioning;
            // Away from the edge of the screen, where the popup would keep a gap
            const {el, input} = mount('#ff0000', 'popup placement="bottom-start" theme="compact" style="position: fixed; left: 100px; top: 100px"');
            await click(input);
            await userEvent.keyboard('{Escape}');

            el.removeAttribute('for');
            el.showPicker();

            const box = part(el, '.trigger').getBoundingClientRect();
            const panel = part(el, '.panel').getBoundingClientRect();
            expect(panel.top).toBeCloseTo(box.bottom + 8, 0);
            expect(panel.left).toBeCloseTo(box.left, 0);
        });

        it('places the popup below the input after opening it from its own button', async () => {
            ColorPickerElement.anchorPositioning = anchorPositioning;
            const {el, input} = mount('#ff0000', 'popup placement="bottom-start" theme="compact"');
            el.input = null;
            el.showPicker();
            el.hidePicker();

            el.input = input;
            await click(input);

            const box = input.getBoundingClientRect();
            const panel = part(el, '.panel').getBoundingClientRect();
            expect(panel.top).toBeCloseTo(box.bottom + 8, 0);
            expect(panel.left).toBeCloseTo(box.left, 0);
        });
    });
});

describe('syncing', () => {
    it('applies typed colors right away', async () => {
        const {el, input} = mount('#ff0000');
        const log = record(el, ['input', 'change']);

        input.focus();
        input.select();
        await userEvent.keyboard('#00f');

        expect(el.value).toBe('#0000FF');
        expect(input.value).toBe('#00f');
        expect(log).toContain('input');
        expect(log).not.toContain('change');
    });

    it('formats the text and emits change when leaving the input', async () => {
        const {el, input} = mount('#ff0000');
        const log = record(el, ['change']);

        input.focus();
        input.select();
        await userEvent.keyboard('blue');
        input.blur();

        expect(input.value).toBe('#0000FF');
        expect(log).toEqual(['change']);
    });

    it('restores the value after invalid text', async () => {
        const {el, input} = mount('#ff0000');

        input.focus();
        input.select();
        await userEvent.keyboard('nope');
        expect(el.value).toBe('#FF0000');

        input.blur();
        expect(input.value).toBe('#FF0000');
    });

    it('clears the color with an empty input', async () => {
        const {el, input} = mount('#ff0000');

        input.focus();
        input.select();
        await userEvent.keyboard('{Backspace}');
        input.blur();

        expect(el.value).toBe('');
        expect(input.value).toBe('');
    });

    it('writes picked colors into the input and emits its events', async () => {
        const {el, input} = mount('#ff0000', 'popup swatches="#00ff00"');
        const log = record(input, ['input', 'change']);
        const seen: string[] = [];
        input.addEventListener('input', () => seen.push(input.value));

        await click(input);
        await click(part(el, '.swatch'));

        expect(input.value).toBe('#00FF00');
        expect(seen).toEqual(['#00FF00']);
        expect(log).toEqual(['input', 'change']);
    });

    // React tracks the value property, changes have to go through the native setter to be noticed
    it('sets the value through the native setter', async () => {
        const {el, input} = mount('#ff0000', 'popup swatches="#00ff00"');
        const before = input.value;
        let tracked = before;

        Object.defineProperty(input, 'value', {
            configurable: true,
            get: () => tracked,
            set: value => (tracked = value)
        });

        await click(input);
        await click(part(el, '.swatch'));

        // The tracker above is bypassed, the native value changed
        expect(tracked).toBe(before);
        delete (input as {value?: string}).value;
        expect(input.value).toBe('#00FF00');
    });

    it('only writes the saved color with a save button', async () => {
        const {el, input} = mount('#ff0000', 'popup buttons="save" swatches="#00ff00"');

        await click(input);
        await click(part(el, '.swatch'));
        expect(input.value).toBe('#FF0000');

        await click(part(el, '.save'));
        expect(input.value).toBe('#00FF00');
    });
});
