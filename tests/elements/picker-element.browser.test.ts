import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {commands, userEvent} from 'vitest/browser';
import {cmyk} from '../../src/color/index.js';
import {ColorPickerElement, define} from '../../src/elements/index.js';

beforeAll(() => define());

afterEach(async () => {
    ColorPickerElement.anchorPositioning = CSS.supports('anchor-name: --a');
    await commands.mouse('up', 0, 0);
    document.body.replaceChildren();
});

/** Creates `<colora-picker>` from an attribute string, e.g. `mount('popup theme="compact"')`. */
const mount = (attributes = '', container: HTMLElement = document.body) => {
    container.insertAdjacentHTML('beforeend', `<colora-picker ${attributes}></colora-picker>`);
    return container.lastElementChild as ColorPickerElement;
};

const part = <T extends HTMLElement = HTMLElement>(el: ColorPickerElement, selector: string) =>
    el.shadowRoot?.querySelector(selector) as T;

const parts = (el: ColorPickerElement, selector: string) =>
    [...(el.shadowRoot?.querySelectorAll<HTMLElement>(selector) ?? [])];

const center = (el: Element): [number, number] => {
    const {left, top, width, height} = el.getBoundingClientRect();
    return [left + width / 2, top + height / 2];
};

/** Clicks with the real mouse. */
const click = async (el: Element) => {
    await commands.mouse('down', ...center(el));
    await commands.mouse('up', ...center(el));
};

/** Records the element's events by type. */
const record = (el: EventTarget, types = ['input', 'change', 'cancel', 'open', 'close']) => {
    const log: string[] = [];
    types.forEach(type => el.addEventListener(type, () => log.push(type)));
    return log;
};

const isOpen = (el: ColorPickerElement) => part(el, '.panel').matches(':popover-open');

describe('attributes', () => {
    it('uses sensible defaults', () => {
        const el = mount();

        expect(el.value).toBe('#42445A');
        expect(el.formats.map(f => f.id)).toEqual(['hex', 'rgb', 'hsl']);
        expect(part(el, '.panel').getAttribute('role')).toBe('group');
        expect(part(el, '.panel').hasAttribute('popover')).toBe(false);
        expect(part(el, '.hue').getAttribute('aria-orientation')).toBe('vertical');
        expect(part<HTMLInputElement>(el, '.input').value).toBe('#42445A');
    });

    it('sets the color and format', () => {
        const el = mount('value="rgb(255 0 0)" format="hsl"');
        expect(el.value).toBe('hsl(0 100% 50%)');

        el.setAttribute('value', '#00f');
        expect(el.value).toBe('hsl(240 100% 50%)');
    });

    it('falls back to the default for invalid colors', () => {
        expect(mount('value="nope"').value).toBe('#42445A');
    });

    it('renders the formats', () => {
        const el = mount('formats="hex, rgb oklch nope"');
        expect(parts(el, '.format').map(b => b.textContent)).toEqual(['HEX', 'RGB', 'OKLCH']);

        el.setAttribute('formats', 'hsl');
        expect(part(el, '.formats').hidden).toBe(true);
        expect(el.value).toBe('hsl(235 15% 31%)');
    });

    it('renders swatches and skips invalid ones', () => {
        const el = mount('swatches="#f00 rgb(0, 255, 0) nope hsl(240 100% 50% / 0.5)"');
        expect(parts(el, '.swatch').map(s => s.getAttribute('aria-label'))).toEqual(['#FF0000', '#00FF00', '#0000FF80']);
    });

    it('shows buttons and hides parts', () => {
        const el = mount('buttons="save clear" hide="preview input"');

        expect(part(el, '.save').hidden).toBe(false);
        expect(part(el, '.cancel').hidden).toBe(true);
        expect(part(el, '.clear').hidden).toBe(false);
        expect(part(el, '.preview').hidden).toBe(true);
        expect(part(el, '.input').hidden).toBe(true);

        el.setAttribute('hide', 'input formats');
        el.removeAttribute('buttons');
        expect(part(el, '.preview').hidden).toBe(false);
        expect(part(el, '.controls').hidden).toBe(true);
    });

    it('locks the opacity', () => {
        const el = mount('value="rgb(255 0 0 / 0.5)" lock-opacity');

        expect(part(el, '.alpha').hidden).toBe(true);
        expect(el.value).toBe('#42445A');
    });

    it('drops the alpha channel when locking the opacity later', () => {
        const el = mount('value="rgb(255 0 0 / 0.5)"');
        el.setAttribute('lock-opacity', '');
        expect(el.value).toBe('rgb(255 0 0)');
    });

    it('lays out sliders per theme', () => {
        const el = mount('theme="compact"');
        expect(part(el, '.hue').getAttribute('aria-orientation')).toBe('horizontal');

        el.setAttribute('theme', 'horizontal');
        expect(part(el, '.alpha').getAttribute('aria-orientation')).toBe('vertical');
    });

    it('describes the sliders for assistive technology', () => {
        const el = mount('value="hsv(120 50% 25% / 0.5)"');

        expect(part(el, '.area').getAttribute('aria-valuetext')).toBe('50%, 25%');
        expect(part(el, '.hue').getAttribute('aria-valuetext')).toBe('120°');
        expect(part(el, '.alpha').getAttribute('aria-valuenow')).toBe('50');
    });
});

describe('properties', () => {
    it('sets and clears the value without events', () => {
        const el = mount();
        const log = record(el);

        el.value = 'red';
        expect(el.value).toBe('#FF0000');
        expect(el.color).toEqual({h: 0, s: 100, v: 100, a: 1});

        el.value = '';
        expect(el.value).toBe('');
        expect(el.color).toBeNull();
        expect(log).toEqual([]);
    });

    it('accepts custom formats and swatches', () => {
        const el = mount();
        el.formats = ['hex', cmyk];
        el.swatches = ['#f00', {h: 120, s: 100, v: 100}];

        expect(parts(el, '.format').map(b => b.textContent)).toEqual(['HEX', 'CMYK']);
        expect(el.swatches).toHaveLength(2);
    });

    it('keeps the color when the configuration changes', () => {
        const el = mount('value="#ff0000"');
        el.picker.adjust({h: 120});

        el.setAttribute('formats', 'rgb hex');
        expect(el.currentValue).toBe('#00FF00');
    });

    it('applies labels as text, never as HTML', () => {
        const el = mount('buttons="save"');
        el.i18n = {save: '<img src=x onerror=alert(1)>', hue: 'Tono'};

        expect(part(el, '.save').textContent).toBe('<img src=x onerror=alert(1)>');
        expect(part(el, '.save').children).toHaveLength(0);
        expect(part(el, '.hue').getAttribute('aria-label')).toBe('Tono');
    });
});

describe('editing', () => {
    it('updates the value live while dragging, change on release', async () => {
        const el = mount('theme="vertical"');
        const log = record(el);
        const area = part(el, '.area');
        const {left, top, width, height} = area.getBoundingClientRect();

        // Press near the bottom left, then drag past the top right corner
        await commands.mouse('down', left + 1, top + height - 1);
        await commands.mouse('move', left + width + 20, top - 20);
        expect(el.value).toBe('#0015FF'); // Hue of #42445A, full saturation and brightness
        await commands.mouse('up', left + width + 20, top - 20);

        expect(log).toEqual(['input', 'input', 'change']);
    });

    it('steps with the keyboard', async () => {
        const el = mount('value="hsv(100 50% 50%)"');
        const log = record(el);
        part(el, '.hue').focus();

        await userEvent.keyboard('{ArrowUp}{End}');
        expect(el.color?.h).toBe(360);
        expect(log).toEqual(['input', 'change', 'input', 'change']);
    });

    it('accepts typed colors, without leaking the native input event', async () => {
        const el = mount('formats="hex rgb"');
        const log = record(el);
        const input = part<HTMLInputElement>(el, '.input');

        await click(input);
        input.select();
        await userEvent.keyboard('rgb(0 0 255)');

        expect(el.value).toBe('rgb(0 0 255)');
        expect(input.getAttribute('aria-invalid')).toBe('false');
        expect(log.filter(e => e === 'change')).toEqual([]);

        await userEvent.keyboard('{Enter}');
        expect(log.at(-1)).toBe('change');

        // One input event per keystroke that produced a new color: "rgb(0 0 2", "25" and "255"
        expect(log.filter(e => e === 'input')).toHaveLength(3);
    });

    it('marks invalid input and restores it on blur', async () => {
        const el = mount();
        const input = part<HTMLInputElement>(el, '.input');

        await click(input);
        input.select();
        await userEvent.keyboard('nope');
        expect(input.getAttribute('aria-invalid')).toBe('true');

        input.blur();
        expect(input.value).toBe('#42445A');
        expect(input.getAttribute('aria-invalid')).toBe('false');
    });

    it('switches formats with clicks and arrow keys', async () => {
        const el = mount('formats="hex rgb hsl"');
        const [, rgbButton] = parts(el, '.format');

        await click(rgbButton as HTMLElement);
        expect(el.value).toBe('rgb(66 68 90)');
        expect(rgbButton?.getAttribute('aria-checked')).toBe('true');

        await userEvent.keyboard('{ArrowRight}');
        expect(el.value).toBe('hsl(235 15% 31%)');
        expect(el.shadowRoot?.activeElement?.textContent).toBe('HSL');

        await userEvent.keyboard('{ArrowRight}');
        expect(el.value).toBe('#42445A');
    });

    it('selects swatches', async () => {
        const el = mount('swatches="#f00 #0f0"');
        const log = record(el);

        await click(parts(el, '.swatch')[1] as HTMLElement);
        expect(el.value).toBe('#00FF00');
        expect(parts(el, '.swatch')[1]?.classList.contains('active')).toBe(true);
        expect(log).toEqual(['input', 'change']);
    });

    it('clears', async () => {
        const el = mount('buttons="clear"');
        const log = record(el);

        await click(part(el, '.clear'));
        expect(el.value).toBe('');
        expect(log).toEqual(['change']);
    });
});

describe('with a save button', () => {
    it('only commits on save', async () => {
        const el = mount('buttons="save cancel" theme="compact"');
        const log = record(el);

        el.picker.adjust({h: 0, s: 100, v: 100});
        expect(el.value).toBe('#42445A');
        expect(el.currentValue).toBe('#FF0000');

        await click(part(el, '.save'));
        expect(el.value).toBe('#FF0000');
        expect(log).toEqual(['input', 'change']);
    });

    it('reverts with cancel and the saved color preview', async () => {
        const el = mount('buttons="save cancel"');
        el.picker.adjust({h: 0, s: 100, v: 100});

        await click(part(el, '.saved'));
        expect(el.currentValue).toBe('#42445A');

        el.picker.adjust({h: 0, s: 100, v: 100});
        await click(part(el, '.cancel'));
        expect(el.currentValue).toBe('#42445A');
    });

    it('reverts when the popup is closed without saving', async () => {
        const el = mount('popup buttons="save"');
        const log = record(el);

        el.showPicker();
        el.picker.adjust({h: 0, s: 100, v: 100});
        await userEvent.keyboard('{Escape}');

        expect(el.currentValue).toBe('#42445A');
        expect(log).toEqual(['open', 'input', 'cancel', 'close']);
    });
});

describe('popup', () => {
    it('opens with the trigger and focuses the color area', async () => {
        const el = mount('popup');
        const trigger = part(el, '.trigger');
        const log = record(el);

        await click(trigger);
        expect(isOpen(el)).toBe(true);
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(part(el, '.panel').getAttribute('role')).toBe('dialog');
        expect(el.shadowRoot?.activeElement).toBe(part(el, '.area'));

        // Clicking the trigger again closes it, instead of closing and immediately reopening
        await click(trigger);
        expect(isOpen(el)).toBe(false);
        expect(log).toEqual(['open', 'close']);
    });

    it('closes on Escape and returns the focus to the trigger', async () => {
        const el = mount('popup');
        const log = record(el);

        await click(part(el, '.trigger'));
        await userEvent.keyboard('{Escape}');

        expect(isOpen(el)).toBe(false);
        expect(el.picker.getState().open).toBe(false);
        expect(el.shadowRoot?.activeElement).toBe(part(el, '.trigger'));
        expect(log).toEqual(['open', 'close']);
    });

    it('returns the focus to where it was when opened with showPicker()', async () => {
        const el = mount('popup');
        const button = document.createElement('button');
        document.body.append(button);
        button.focus();

        el.showPicker();
        expect(el.shadowRoot?.activeElement).toBe(part(el, '.area'));

        await userEvent.keyboard('{Escape}');
        expect(document.activeElement).toBe(button);
    });

    // Regression: the Enter key press that closed the popup also activated the trigger, reopening it
    it('stays closed when closed from a keydown handler', async () => {
        const el = mount('popup');
        await click(part(el, '.trigger'));

        const input = part<HTMLInputElement>(el, '.input');
        input.addEventListener('keydown', e => e.key === 'Enter' && el.hidePicker());
        input.focus();

        await userEvent.keyboard('{Enter}');
        expect(el.shadowRoot?.activeElement).toBe(part(el, '.trigger'));
        expect(isOpen(el)).toBe(false);
    });

    it('closes on clicks outside only', async () => {
        const el = mount('popup');
        await click(part(el, '.trigger'));

        await click(part(el, '.hue'));
        expect(isOpen(el)).toBe(true);

        await commands.mouse('down', 5, 600);
        await commands.mouse('up', 5, 600);
        expect(isOpen(el)).toBe(false);
        expect(el.picker.getState().open).toBe(false);
    });

    it('closes other popups when opened', async () => {
        const first = mount('popup');
        const second = mount('popup');

        await click(part(first, '.trigger'));
        await click(part(second, '.trigger'));

        expect(isOpen(first)).toBe(false);
        expect(first.picker.getState().open).toBe(false);
        expect(isOpen(second)).toBe(true);
    });

    it('stays inside a popover of the page', async () => {
        const menu = document.createElement('div');
        menu.popover = 'auto';
        document.body.append(menu);
        menu.showPopover();

        const el = mount('popup', menu);
        await click(part(el, '.trigger'));
        expect(isOpen(el)).toBe(true);
        expect(menu.matches(':popover-open')).toBe(true);

        // Escape closes the innermost popover first
        await userEvent.keyboard('{Escape}');
        expect(isOpen(el)).toBe(false);
        expect(menu.matches(':popover-open')).toBe(true);
    });

    it('closes after saving', async () => {
        const el = mount('popup buttons="save"');
        el.showPicker();

        await click(part(el, '.save'));
        expect(isOpen(el)).toBe(false);
    });

    it('supports a custom trigger', async () => {
        const el = mount('popup');
        el.innerHTML = '<button slot="trigger">Pick a color</button>';

        await click(el.querySelector('button') as HTMLElement);
        expect(isOpen(el)).toBe(true);

        await userEvent.keyboard('{Escape}');
        await expect.poll(() => document.activeElement).toBe(el.querySelector('button'));
    });

    it('closes with a custom trigger in browsers without showPopover({source})', async () => {
        // Without a source, the browser doesn't know the trigger and closes the popup as soon as it's pressed
        const showPopover = HTMLElement.prototype.showPopover;
        HTMLElement.prototype.showPopover = function () {
            showPopover.call(this);
        };

        try {
            const el = mount('popup');
            el.innerHTML = '<button slot="trigger">Pick a color</button>';
            const button = el.querySelector('button') as HTMLElement;

            await click(button);
            expect(isOpen(el)).toBe(true);

            await click(button);
            expect(isOpen(el)).toBe(false);
            expect(el.picker.getState().open).toBe(false);
        } finally {
            HTMLElement.prototype.showPopover = showPopover;
        }
    });

    it('cannot be opened with a custom trigger while disabled', async () => {
        const el = mount('popup disabled');
        el.innerHTML = '<button slot="trigger">Pick a color</button>';

        await click(el.querySelector('button') as HTMLElement);
        expect(isOpen(el)).toBe(false);
    });

    it('cannot be opened while disabled', async () => {
        const el = mount('popup disabled');

        expect(part<HTMLButtonElement>(el, '.trigger').disabled).toBe(true);
        expect(part(el, '.panel').inert).toBe(true);
        el.showPicker();
        expect(isOpen(el)).toBe(false);

        el.removeAttribute('disabled');
        el.showPicker();
        expect(isOpen(el)).toBe(true);

        el.setAttribute('disabled', '');
        expect(isOpen(el)).toBe(false);
    });

    it('switches between popup and inline', () => {
        const el = mount('popup');
        el.showPicker();

        el.removeAttribute('popup');
        expect(part(el, '.panel').hasAttribute('popover')).toBe(false);
        expect(part(el, '.panel').checkVisibility()).toBe(true);
        expect(part(el, '.anchor').checkVisibility()).toBe(false);
    });

    it('stops listening to the document once removed', async () => {
        const el = mount('popup');
        const close = vi.fn();
        el.addEventListener('close', close);
        el.showPicker();

        el.remove();
        expect(close).toHaveBeenCalledOnce();

        await commands.mouse('down', 5, 600);
        await commands.mouse('up', 5, 600);
        await userEvent.keyboard('{Escape}');
        expect(close).toHaveBeenCalledOnce();
    });

    describe.each([true, false])('positioning (anchor positioning: %s)', anchorPositioning => {
        const open = (attributes: string, style: string) => {
            ColorPickerElement.anchorPositioning = anchorPositioning;
            const el = mount(`popup ${attributes}`);
            el.style.cssText = `position: fixed; ${style}`;
            el.showPicker();
            return {trigger: part(el, '.anchor').getBoundingClientRect(), panel: part(el, '.panel').getBoundingClientRect()};
        };

        it('places the panel below the trigger', () => {
            const {trigger, panel} = open('theme="compact"', 'left: 150px; top: 20px');

            expect(panel.top).toBeCloseTo(trigger.bottom + 8, 0);
            expect(panel.left + panel.width / 2).toBeCloseTo(trigger.left + trigger.width / 2, 0);
        });

        it('aligns to the start', () => {
            const {trigger, panel} = open('theme="compact" placement="bottom-start"', 'left: 150px; top: 20px');
            expect(panel.left).toBeCloseTo(trigger.left, 0);
        });

        it('flips above the trigger if there is no space below', () => {
            const {trigger, panel} = open('theme="compact"', 'left: 150px; bottom: 20px');
            expect(panel.bottom).toBeCloseTo(trigger.top - 8, 0);
        });
    });
});

describe('building the panel', () => {
    const controls = (el: ColorPickerElement) => part(el, '.panel').childElementCount;

    it('happens right away for inline pickers', () => {
        expect(controls(mount())).toBeGreaterThan(0);
    });

    it('waits for the first opening for popups', async () => {
        const el = mount('popup value="#f00"');
        expect(controls(el)).toBe(0);

        // The trigger works without the panel
        expect(part(el, '.trigger').getAttribute('aria-label')).toBe('Choose color');
        expect(getComputedStyle(part(el, '.root')).getPropertyValue('--cp-color')).toBe('rgb(255 0 0 / 1)');

        await click(part(el, '.trigger'));
        expect(controls(el)).toBeGreaterThan(0);
        expect(el.shadowRoot?.activeElement).toBe(part(el, '.area'));
    });

    it('applies everything set before', () => {
        const el = mount('popup theme="compact" hide="input" buttons="save" formats="hex oklch"');
        el.value = '#00f';
        el.swatches = ['#f00', '#0f0'];
        el.i18n = {hue: 'Tono'};
        el.showPicker();

        expect(part(el, '.hue').getAttribute('aria-label')).toBe('Tono');
        expect(part(el, '.hue').getAttribute('aria-orientation')).toBe('horizontal');
        expect(part(el, '.hue').getAttribute('aria-valuenow')).toBe('240');
        expect(part(el, '.input').hidden).toBe(true);
        expect(part(el, '.save').hidden).toBe(false);
        expect(parts(el, '.format').map(button => button.textContent)).toEqual(['HEX', 'OKLCH']);
        expect(parts(el, '.swatch')).toHaveLength(2);
    });

    it('keeps the panel after closing', () => {
        const el = mount('popup');
        el.showPicker();
        const area = part(el, '.area');

        el.hidePicker();
        el.showPicker();
        expect(part(el, '.area')).toBe(area);
    });

    // Frameworks create the element first and set the attributes afterwards
    it('waits for the attributes of created elements', () => {
        const popup = document.createElement('colora-picker') as ColorPickerElement;
        popup.setAttribute('popup', '');
        document.body.append(popup);
        expect(controls(popup)).toBe(0);

        const inline = document.createElement('colora-picker') as ColorPickerElement;
        inline.setAttribute('swatches', '#f00');
        expect(controls(inline)).toBe(0);

        document.body.append(inline);
        expect(controls(inline)).toBeGreaterThan(0);
        expect(parts(inline, '.swatch')).toHaveLength(1);
    });

    it('happens when switching to inline', () => {
        const el = mount('popup');
        el.removeAttribute('popup');
        expect(controls(el)).toBeGreaterThan(0);
    });

    it('happens when opened through a linked input', async () => {
        document.body.insertAdjacentHTML('beforeend', '<input id="color">');
        const el = mount('popup for="color"');
        expect(controls(el)).toBe(0);

        await click(document.getElementById('color') as HTMLElement);
        expect(isOpen(el)).toBe(true);
        expect(controls(el)).toBeGreaterThan(0);
    });

    it('does not happen when opening is prevented', () => {
        const el = mount('popup disabled');
        el.showPicker();
        expect(controls(el)).toBe(0);
    });
});

describe('forms', () => {
    const form = (attributes: string) => {
        const formElement = document.createElement('form');
        document.body.append(formElement);
        return {form: formElement, el: mount(`name="color" ${attributes}`, formElement)};
    };

    it('submits the value', () => {
        const {form: f, el} = form('value="#f00"');
        expect(new FormData(f).get('color')).toBe('#FF0000');

        el.value = '';
        expect(new FormData(f).has('color')).toBe(false);
    });

    it('validates required values', () => {
        const {el} = form('required');
        expect(el.checkValidity()).toBe(true);

        el.value = '';
        expect(el.checkValidity()).toBe(false);
        expect(el.validity.valueMissing).toBe(true);

        el.removeAttribute('required');
        expect(el.checkValidity()).toBe(true);
    });

    // The input is hidden in the closed popup
    it('reports missing popup values at the trigger', () => {
        const {el} = form('popup required value=""');
        el.value = '';

        expect(el.reportValidity()).toBe(false);
        expect(el.shadowRoot?.activeElement).toBe(part(el, '.trigger'));
    });

    it('resets to the value attribute', () => {
        const {form: f, el} = form('value="#f00"');
        el.value = '#00f';

        f.reset();
        expect(el.value).toBe('#FF0000');
    });

    it('is disabled with its fieldset', () => {
        const {form: f, el} = form('popup');
        const fieldset = document.createElement('fieldset');
        fieldset.append(el);
        f.append(fieldset);

        fieldset.disabled = true;
        el.showPicker();
        expect(isOpen(el)).toBe(false);
        expect(el.picker.getState().disabled).toBe(true);

        fieldset.disabled = false;
        expect(el.picker.getState().disabled).toBe(false);
    });
});
