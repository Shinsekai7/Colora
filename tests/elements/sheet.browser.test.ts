import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {commands} from 'vitest/browser';
import {ColorPickerElement, define} from '../../src/elements/index.js';
import {SHEET_QUERY} from '../../src/elements/popup.js';

beforeAll(() => define());

afterEach(async () => {
    vi.unstubAllGlobals();
    await commands.mouse('up', 0, 0);
    document.body.replaceChildren();
});

const mount = (attributes = '') => {
    document.body.insertAdjacentHTML('beforeend', `<colora-picker popup ${attributes}></colora-picker>`);
    return document.body.lastElementChild as ColorPickerElement;
};

const part = <T extends HTMLElement = HTMLElement>(el: ColorPickerElement, selector: string) =>
    el.shadowRoot?.querySelector(selector) as T;

const isOpen = (el: ColorPickerElement) => part(el, '.panel').matches(':popover-open');
const isSheet = (el: ColorPickerElement) => part(el, '.panel').classList.contains('sheet');

const click = async (el: Element) => {
    const {left, top, width, height} = el.getBoundingClientRect();
    await commands.mouse('down', left + width / 2, top + height / 2);
    await commands.mouse('up', left + width / 2, top + height / 2);
};

/** Pretends to be a phone (or not) for `presentation="auto"`. */
const stubScreen = (phone: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone && query === SHEET_QUERY,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
}));

describe('sheet', () => {
    it('is shown at the bottom over the full width', async () => {
        const el = mount('presentation="sheet"');
        await click(part(el, '.trigger'));

        expect(isSheet(el)).toBe(true);

        // Waits for the slide-in animation
        await expect.poll(() => part(el, '.panel').getBoundingClientRect().bottom).toBeCloseTo(innerHeight, 0);
        const box = part(el, '.panel').getBoundingClientRect();
        expect(box.left).toBe(0);
        expect(box.width).toBeCloseTo(document.documentElement.clientWidth, 0);
    });

    it('has a close button that returns the focus', async () => {
        const el = mount('presentation="sheet"');
        await click(part(el, '.trigger'));

        const close = part(el, '.sheet-close');
        expect(close.checkVisibility()).toBe(true);
        expect(close.textContent).toBe('Close');

        close.click();
        expect(isOpen(el)).toBe(false);
        expect(el.picker.getState().open).toBe(false);
        await expect.poll(() => el.shadowRoot?.activeElement).toBe(part(el, '.trigger'));
    });

    it('translates the close button', async () => {
        const el = mount('presentation="sheet"');
        el.i18n = {close: 'Cerrar'};
        await click(part(el, '.trigger'));
        expect(part(el, '.sheet-close').textContent).toBe('Cerrar');
    });

    it('closes when tapping above it', async () => {
        const el = mount('presentation="sheet" theme="compact"');
        await click(part(el, '.trigger'));
        await expect.poll(() => part(el, '.panel').getBoundingClientRect().bottom).toBeCloseTo(innerHeight, 0);

        await commands.mouse('down', 20, 10);
        await commands.mouse('up', 20, 10);
        expect(isOpen(el)).toBe(false);
    });

    it('uses touch-sized controls', async () => {
        const el = mount('presentation="sheet"');
        await click(part(el, '.trigger'));

        expect(part(el, '.area .thumb').getBoundingClientRect().width).toBe(28);

        // Smaller fonts make iOS zoom in when the field is focused
        expect(parseFloat(getComputedStyle(part(el, '.input')).fontSize)).toBeGreaterThanOrEqual(16);
    });

    it.each(['horizontal', 'vertical', 'compact'])('keeps the thumbs on screen with the %s theme', async theme => {
        // Red and opaque puts the hue thumb at the start and the opacity thumb at the end
        const el = mount(`presentation="sheet" theme="${theme}" value="#f00"`);
        await click(part(el, '.trigger'));
        await expect.poll(() => part(el, '.panel').getBoundingClientRect().bottom).toBeCloseTo(innerHeight, 0);

        for (const thumb of el.shadowRoot?.querySelectorAll('.slider .thumb') ?? []) {
            const {left, right} = thumb.getBoundingClientRect();
            expect(left).toBeGreaterThanOrEqual(0);
            expect(right).toBeLessThanOrEqual(document.documentElement.clientWidth);
        }
    });
});

describe('popover', () => {
    it('has no close button', async () => {
        const el = mount('presentation="popover"');
        await click(part(el, '.trigger'));

        expect(isSheet(el)).toBe(false);
        expect(part(el, '.sheet-close').checkVisibility()).toBe(false);
    });
});

describe('presentation="auto"', () => {
    it('shows a sheet on phones', async () => {
        stubScreen(true);
        const el = mount();

        await click(part(el, '.trigger'));
        expect(isSheet(el)).toBe(true);
    });

    it('shows a popover elsewhere', async () => {
        stubScreen(false);
        const el = mount();

        await click(part(el, '.trigger'));
        expect(isSheet(el)).toBe(false);
    });

    // The phone's keyboard would compete with the sheet for the space
    it('keeps a popover for linked inputs', async () => {
        stubScreen(true);
        document.body.insertAdjacentHTML('beforeend', '<input id="color" value="#f00">');
        const el = mount('for="color"');

        await click(document.getElementById('color') as HTMLElement);
        expect(isOpen(el)).toBe(true);
        expect(isSheet(el)).toBe(false);
    });

    it('can be changed while open', async () => {
        const el = mount('presentation="popover"');
        await click(part(el, '.trigger'));

        el.setAttribute('presentation', 'sheet');
        expect(isSheet(el)).toBe(true);
        expect(isOpen(el)).toBe(true);
    });
});
