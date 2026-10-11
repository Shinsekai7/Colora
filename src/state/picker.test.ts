import {afterEach, describe, expect, it, vi} from 'vitest';
import {cmyk, hex, hsv, rgb} from '../color/index.js';
import type {HSVA} from '../color/index.js';
import {createPicker} from './picker.js';
import type {Picker, PickerEvents} from './types.js';

const toHex = (color: HSVA | null) => color && hex.stringify(color);

/** Records all events in order as `[type, hex color, source]`. */
const record = (picker: Picker) => {
    const log: unknown[][] = [];
    const types: (keyof PickerEvents)[] = ['change', 'changeend', 'save', 'clear', 'cancel', 'open', 'close'];

    for (const type of types) {
        picker.on(type, (payload: unknown) => {
            const {color, source} = (payload ?? {}) as { color?: HSVA | null; source?: string };
            log.push([type, ...(color === undefined ? [] : [toHex(color)]), ...(source ? [source] : [])]);
        });
    }

    return log;
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('createPicker', () => {
    it('uses sensible defaults', () => {
        const state = createPicker().getState();

        expect(toHex(state.color)).toBe('#42445A');
        expect(state.saved).toEqual(state.color);
        expect(state).toMatchObject({
            format: 'hex',
            text: '#42445A',
            textValid: true,
            swatches: [],
            open: false,
            disabled: false
        });
    });

    it('starts without a saved color for null', () => {
        const state = createPicker({color: null}).getState();
        expect(state.saved).toBeNull();
        expect(toHex(state.color)).toBe('#42445A');
    });

    it('uses the format of the initial color', () => {
        expect(createPicker({color: 'rgb(255 0 0)'}).getState()).toMatchObject({format: 'rgb', text: 'rgb(255 0 0)'});
        expect(createPicker({color: 'red'}).getState().format).toBe('hex');
        expect(createPicker({color: 'rgb(255 0 0)', format: 'hsl'}).getState().text).toBe('hsl(0 100% 50%)');
    });

    it('accepts HSVA objects', () => {
        expect(createPicker({color: {h: 0, s: 100, v: 100}}).getState().color).toEqual({h: 0, s: 100, v: 100, a: 1});
    });

    it('parses swatches', () => {
        const {swatches} = createPicker({swatches: ['#f00', {h: 120, s: 100, v: 100}]}).getState();
        expect(swatches.map(toHex)).toEqual(['#FF0000', '#00FF00']);
    });

    it('accepts input in custom formats', () => {
        const picker = createPicker({formats: [hex, cmyk]});
        expect(picker.setColor('device-cmyk(0 1 1 0)')).toBe(true);
        expect(toHex(picker.getState().color)).toBe('#FF0000');
    });

    it('only accepts input in the given parsers', () => {
        const picker = createPicker({parsers: [hex]});
        expect(picker.setColor('rgb(0 0 0)')).toBe(false);
    });

    it('starts closed if disabled', () => {
        expect(createPicker({open: true}).getState().open).toBe(true);
        expect(createPicker({open: true, disabled: true}).getState().open).toBe(false);
    });

    it.each([
        [{color: 'nope'}, 'Invalid color: "nope".'],
        [{color: {h: NaN, s: 0, v: 0}}, 'Invalid color'],
        [{color: 'rgb(0 0 0 / 0.5)', lockOpacity: true}, 'Invalid color'],
        [{swatches: ['#fff', 'nope']}, 'Invalid swatch: "nope".'],
        [{format: 'cmyk'}, 'Unknown format "cmyk".'],
        [{formats: []}, 'At least one output format is required.']
    ])('throws for invalid options %o', (options, message) => {
        expect(() => createPicker(options)).toThrow(message);
    });
});

describe('setColor', () => {
    it('sets the current and saved color', () => {
        const picker = createPicker();

        expect(picker.setColor('#ff0000')).toBe(true);
        expect(toHex(picker.getState().color)).toBe('#FF0000');
        expect(toHex(picker.getState().saved)).toBe('#FF0000');
        expect(picker.getState().text).toBe('#FF0000');
    });

    it('can keep the saved color', () => {
        const picker = createPicker();
        picker.setColor('#ff0000', {save: false});

        expect(toHex(picker.getState().color)).toBe('#FF0000');
        expect(toHex(picker.getState().saved)).toBe('#42445A');
    });

    it('clears the saved color for null', () => {
        const picker = createPicker();
        expect(picker.setColor(null)).toBe(true);
        expect(picker.getState().saved).toBeNull();
        expect(toHex(picker.getState().color)).toBe('#42445A');
    });

    it('does not change the format', () => {
        const picker = createPicker();
        picker.setColor('rgb(255 0 0)');
        expect(picker.getState()).toMatchObject({format: 'hex', text: '#FF0000'});
    });

    it('does not emit events', () => {
        const picker = createPicker();
        const log = record(picker);

        picker.setColor('#f00');
        picker.setColor(null);
        expect(log).toEqual([]);
    });

    it('keeps the hue for grays', () => {
        const picker = createPicker({color: 'hsv(200 50% 50%)'});
        picker.setColor('#808080');
        expect(picker.getState().color.h).toBe(200);
    });

    it.each(['nope', 'rgb(1.2.3, 0, 0)', {h: 400, s: 101, v: 0}, {h: NaN, s: 0, v: 0}])(
        'rejects %o without changing anything',
        input => {
            const picker = createPicker();
            const before = picker.getState();

            expect(picker.setColor(input)).toBe(false);
            expect(picker.getState()).toBe(before);
        }
    );

    // A rejected color must not leave the controller in a broken state
    it('keeps working after an invalid color', () => {
        const picker = createPicker();
        picker.setColor({h: 400, s: 101, v: 0});
        picker.adjust({h: 120});
        expect(picker.getState().color.h).toBe(120);
    });

    it('rejects transparency if the opacity is locked', () => {
        const picker = createPicker({lockOpacity: true});
        expect(picker.setColor('rgb(0 0 0 / 0.5)')).toBe(false);
        expect(picker.setColor('rgb(0 0 0)')).toBe(true);
    });

    it('works while disabled', () => {
        const picker = createPicker({disabled: true});
        expect(picker.setColor('#f00')).toBe(true);
    });
});

describe('adjust', () => {
    it('changes individual components and emits change events', () => {
        const picker = createPicker({color: 'hsv(0 100% 100%)'});
        const log = record(picker);

        picker.adjust({h: 120});
        picker.adjust({a: 0.5});

        expect(picker.getState().color).toEqual({h: 120, s: 100, v: 100, a: 0.5});
        expect(picker.getState().text).toBe('#00FF0080');
        expect(log).toEqual([['change', '#00FF00', 'slider'], ['change', '#00FF0080', 'slider']]);
    });

    it('clamps values and ignores invalid ones', () => {
        const picker = createPicker({color: 'hsv(10 50% 50%)'});
        picker.adjust({h: 400, s: -5, v: NaN, a: 2});
        expect(picker.getState().color).toEqual({h: 360, s: 0, v: 50, a: 1});
    });

    it('does nothing if the color stays the same', () => {
        const picker = createPicker({color: 'hsv(10 50% 50%)'});
        const log = record(picker);
        const before = picker.getState();

        picker.adjust({h: 10});
        picker.adjust({});

        expect(picker.getState()).toBe(before);
        expect(log).toEqual([]);
    });

    it('ignores alpha if the opacity is locked', () => {
        const picker = createPicker({lockOpacity: true});
        picker.adjust({a: 0.5});
        expect(picker.getState().color.a).toBe(1);
    });

    it('emits changeend once after changes', () => {
        const picker = createPicker({color: 'hsv(0 100% 100%)'});
        const log = record(picker);

        picker.adjustEnd();
        picker.adjust({h: 120});
        picker.adjust({h: 240});
        picker.adjustEnd();
        picker.adjustEnd();

        expect(log).toEqual([
            ['change', '#00FF00', 'slider'],
            ['change', '#0000FF', 'slider'],
            ['changeend', '#0000FF', 'slider']
        ]);
    });
});

describe('text input', () => {
    it('updates the color but keeps the text as typed', () => {
        const picker = createPicker();
        const log = record(picker);

        expect(picker.inputText('#f00')).toBe(true);
        expect(picker.getState()).toMatchObject({text: '#f00', textValid: true});
        expect(toHex(picker.getState().color)).toBe('#FF0000');
        expect(log).toEqual([['change', '#FF0000', 'text']]);
    });

    it('marks invalid text without changing the color', () => {
        const picker = createPicker();
        const log = record(picker);

        expect(picker.inputText('#f0')).toBe(false);
        expect(picker.getState()).toMatchObject({text: '#f0', textValid: false});
        expect(toHex(picker.getState().color)).toBe('#42445A');
        expect(log).toEqual([]);
    });

    it('switches to the typed format if available', () => {
        const picker = createPicker();

        picker.inputText('rgb(255 0 0)');
        expect(picker.getState().format).toBe('rgb');

        // Not an output format
        picker.inputText('blue');
        expect(picker.getState().format).toBe('rgb');
    });

    it('keeps the hue when typing grays', () => {
        const picker = createPicker({color: 'hsv(200 50% 50%)'});
        picker.inputText('#000');
        expect(picker.getState().color).toEqual({h: 200, s: 50, v: 0, a: 1});
    });

    it('reformats the text and emits changeend on commit', () => {
        const picker = createPicker();
        const log = record(picker);

        picker.inputText('#f00');
        picker.inputText('#ff0000');
        picker.commitText();

        expect(picker.getState().text).toBe('#FF0000');
        expect(log).toEqual([['change', '#FF0000', 'text'], ['changeend', '#FF0000', 'text']]);
    });

    it('restores the text if it was invalid', () => {
        const picker = createPicker();
        const log = record(picker);

        picker.inputText('#f0');
        picker.commitText();

        expect(picker.getState()).toMatchObject({text: '#42445A', textValid: true});
        expect(log).toEqual([]);
    });

    it('ends a pending change from another source first', () => {
        const picker = createPicker();
        const log = record(picker);

        picker.inputText('#f00');
        picker.adjust({h: 120});

        expect(log).toEqual([
            ['change', '#FF0000', 'text'],
            ['changeend', '#FF0000', 'text'],
            ['change', '#00FF00', 'slider']
        ]);
    });
});

describe('swatches', () => {
    it('selects a swatch', () => {
        const picker = createPicker({swatches: ['#f00']});
        const log = record(picker);

        expect(picker.selectSwatch(0)).toBe(true);
        expect(toHex(picker.getState().color)).toBe('#FF0000');
        expect(toHex(picker.getState().saved)).toBe('#42445A');
        expect(log).toEqual([['change', '#FF0000', 'swatch'], ['changeend', '#FF0000', 'swatch']]);
    });

    it('rejects unknown indices', () => {
        const picker = createPicker({swatches: ['#f00']});
        expect(picker.selectSwatch(1)).toBe(false);
        expect(picker.selectSwatch(-1)).toBe(false);
    });

    it('keeps the hue for gray and black swatches', () => {
        const picker = createPicker({color: 'hsv(200 50% 50%)', swatches: ['#808080', '#000']});

        picker.selectSwatch(0);
        expect(picker.getState().color).toMatchObject({h: 200, s: 0});

        picker.adjust({s: 50});
        picker.selectSwatch(1);
        expect(picker.getState().color).toEqual({h: 200, s: 50, v: 0, a: 1});
    });

    it('adds and removes swatches', () => {
        const picker = createPicker();

        expect(picker.addSwatch('#f00')).toBe(true);
        expect(picker.addSwatch({h: 120, s: 100, v: 100})).toBe(true);
        expect(picker.addSwatch('nope')).toBe(false);
        expect(picker.getState().swatches.map(toHex)).toEqual(['#FF0000', '#00FF00']);

        expect(picker.removeSwatch(0)).toBe(true);
        expect(picker.removeSwatch(5)).toBe(false);
        expect(picker.getState().swatches.map(toHex)).toEqual(['#00FF00']);
    });

    it('rejects transparent swatches if the opacity is locked', () => {
        expect(createPicker({lockOpacity: true}).addSwatch('#f008')).toBe(false);
    });
});

describe('formats', () => {
    it('switches the format', () => {
        const picker = createPicker({formats: [hex, rgb, hsv]});

        expect(picker.setFormat('hsv')).toBe(true);
        expect(picker.getState()).toMatchObject({format: 'hsv', text: 'hsv(235 27% 35%)'});
        expect(picker.setFormat('hsl')).toBe(false);
        expect(picker.getState().format).toBe('hsv');
    });

    it('applies the stringify options', () => {
        const picker = createPicker({color: 'rgb(0 0 0 / 0.5)', stringify: {legacy: true}});
        expect(picker.getState().text).toBe('rgba(0, 0, 0, 0.5)');
    });

    it('formats any color', () => {
        const picker = createPicker();
        expect(picker.formatColor()).toBe('#42445A');
        expect(picker.formatColor({h: 0, s: 100, v: 100, a: 1}, 'rgb')).toBe('rgb(255 0 0)');
        expect(() => picker.formatColor(undefined, 'cmyk')).toThrow('Unknown format "cmyk".');
    });
});

describe('save, cancel and clear', () => {
    it('saves the current color', () => {
        const picker = createPicker();
        const log = record(picker);

        picker.adjust({h: 0, s: 100, v: 100});
        picker.save();

        expect(toHex(picker.getState().saved)).toBe('#FF0000');
        expect(log).toEqual([['change', '#FF0000', 'slider'], ['save', '#FF0000']]);
    });

    it('reverts to the saved color on cancel', () => {
        const picker = createPicker();
        picker.adjust({h: 0, s: 100, v: 100});

        const log = record(picker);
        picker.cancel();

        expect(toHex(picker.getState().color)).toBe('#42445A');
        expect(picker.getState().text).toBe('#42445A');
        expect(log).toEqual([['cancel', '#42445A']]);
    });

    it('keeps the current color on cancel if nothing was saved', () => {
        const picker = createPicker({color: null});
        picker.adjust({h: 0, s: 100, v: 100});
        picker.cancel();
        expect(toHex(picker.getState().color)).toBe('#FF0000');
    });

    it('clears the saved color', () => {
        const picker = createPicker();
        const log = record(picker);

        picker.clear();

        expect(picker.getState().saved).toBeNull();
        expect(log).toEqual([['save', null], ['clear']]);
    });
});

describe('open and close', () => {
    it('opens, closes and toggles', () => {
        const picker = createPicker();
        const log = record(picker);

        expect(picker.open()).toBe(true);
        expect(picker.open()).toBe(false);
        expect(picker.getState().open).toBe(true);
        expect(picker.close()).toBe(true);
        expect(picker.close()).toBe(false);
        expect(picker.toggle()).toBe(true);
        expect(picker.toggle()).toBe(true);

        expect(picker.getState().open).toBe(false);
        expect(log).toEqual([['open'], ['close'], ['open'], ['close']]);
    });
});

describe('disabled', () => {
    it('closes and cannot be opened', () => {
        const picker = createPicker({open: true});
        const log = record(picker);

        picker.setDisabled(true);
        expect(picker.getState()).toMatchObject({open: false, disabled: true});
        expect(picker.open()).toBe(false);

        picker.setDisabled(false);
        expect(picker.open()).toBe(true);
        expect(log).toEqual([['close'], ['open']]);
    });

    it('ignores user actions', () => {
        const picker = createPicker({swatches: ['#f00'], disabled: true});
        const log = record(picker);
        const before = picker.getState();

        picker.adjust({h: 120});
        picker.inputText('#fff');
        picker.selectSwatch(0);
        picker.save();
        picker.cancel();
        picker.clear();

        expect(picker.getState()).toBe(before);
        expect(log).toEqual([]);
    });
});

describe('subscribe', () => {
    it('is called with the new and previous state', () => {
        const picker = createPicker();
        const listener = vi.fn();
        const initial = picker.getState();

        picker.subscribe(listener);
        picker.open();

        expect(listener).toHaveBeenCalledOnce();
        expect(listener).toHaveBeenCalledWith(picker.getState(), initial);
        expect(initial.open).toBe(false); // Previous states are never mutated
    });

    it('is not called if nothing changed', () => {
        const picker = createPicker();
        const listener = vi.fn();

        picker.subscribe(listener);
        picker.close();
        picker.setFormat('hex');
        picker.setColor('#42445A');

        expect(listener).not.toHaveBeenCalled();
    });

    it('sees the new state when events are emitted', () => {
        const picker = createPicker();
        let saved: HSVA | null = null;

        picker.on('save', () => (saved = picker.getState().saved));
        picker.adjust({h: 0, s: 100, v: 100});
        picker.save();

        expect(toHex(saved)).toBe('#FF0000');
    });

    it('unsubscribes', () => {
        const picker = createPicker();
        const listener = vi.fn();

        picker.subscribe(listener)();
        picker.open();

        expect(listener).not.toHaveBeenCalled();
    });

    it('reports errors without breaking the action', () => {
        const reportError = vi.fn();
        vi.stubGlobal('reportError', reportError);

        const picker = createPicker();
        picker.subscribe(() => {
            throw new Error('oops');
        });

        expect(picker.open()).toBe(true);
        expect(picker.getState().open).toBe(true);
        expect(reportError).toHaveBeenCalledOnce();
    });
});

describe('events', () => {
    it('removes listeners with off and the returned function', () => {
        const picker = createPicker();
        const first = vi.fn();
        const second = vi.fn();

        picker.on('open', first);
        picker.on('close', second)();
        picker.off('open', first);
        picker.toggle();
        picker.toggle();

        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();
    });
});

describe('destroy', () => {
    // Methods must not throw after destroy()
    it('removes all listeners but keeps working', () => {
        const picker = createPicker();
        const listener = vi.fn();

        picker.subscribe(listener);
        picker.on('open', listener);
        picker.destroy();

        expect(picker.open()).toBe(true);
        expect(picker.setColor('#fff')).toBe(true);
        expect(listener).not.toHaveBeenCalled();
    });
});
