import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import {sameColor} from './compare.js';
import {cmyk} from './formats/cmyk.js';
import {defaultFormats, fillPowerless, normalizeHsva, parseColor} from './parse.js';

describe('parseColor', () => {
    it.each([
        ['#42445a', 'hex'],
        ['rgb(1 2 3)', 'rgb'],
        ['hsl(1 2% 3%)', 'hsl'],
        ['hsv(1 2% 3%)', 'hsv'],
        ['oklch(50% 0.1 20)', 'oklch'],
        ['red', 'named']
    ])('detects the format of %s', (input, format) => {
        expect(parseColor(input)?.format).toBe(format);
    });

    it('only uses the given formats', () => {
        expect(parseColor('device-cmyk(0 0 0 0)')).toBeNull();
        expect(parseColor('device-cmyk(0 0 0 0)', [...defaultFormats, cmyk])?.format).toBe('cmyk');
        expect(parseColor('#fff', [cmyk])).toBeNull();
    });

    it('rejects non-strings', () => {
        expect(parseColor(null as unknown as string)).toBeNull();
        expect(parseColor(42 as unknown as string)).toBeNull();
    });

    // Malformed numbers like "rgb(1.2.3, 0, 0)" must never turn into NaN channels
    it('never returns invalid values, whatever the input', () => {
        const names = fc.constantFrom('rgb', 'rgba', 'hsl', 'hsla', 'hsv', 'hsva', 'oklch', 'cmyk', 'device-cmyk', '#');
        const tokens = fc.oneof(
            fc.double().map(String),
            fc.integer({min: -1000, max: 1000}).map(String),
            fc.constantFrom('%', '/', ',', ' ', 'deg', 'turn', '.', '-', 'e', '(', ')', 'NaN', 'Infinity', '1e999')
        );

        const input = fc.oneof(
            fc.string(),
            fc.tuple(names, fc.array(tokens, {maxLength: 12})).map(([name, parts]) => `${name}(${parts.join(' ')})`),
            fc.tuple(names, fc.array(tokens, {maxLength: 12})).map(([name, parts]) => name + parts.join(''))
        );

        fc.assert(fc.property(input, str => {
            const parsed = parseColor(str, [...defaultFormats, cmyk]);

            if (parsed) {
                expect(normalizeHsva(parsed.color)).toEqual(parsed.color);
            }
        }), {numRuns: 2000});
    });
});

describe('fillPowerless', () => {
    const previous = {h: 200, s: 80, v: 50, a: 1};

    // Otherwise typing a gray would reset the hue slider to 0
    it('keeps the previous hue for grays', () => {
        const parsed = parseColor('#808080');
        expect(parsed?.powerless).toEqual({h: true, s: false});
        expect(fillPowerless(parsed!, previous)).toMatchObject({h: 200, s: 0});
    });

    it('keeps the previous hue and saturation for black', () => {
        expect(fillPowerless(parseColor('#000')!, previous)).toEqual({h: 200, s: 80, v: 0, a: 1});
    });

    it('keeps explicit components', () => {
        expect(fillPowerless(parseColor('#f00')!, previous)).toEqual({h: 0, s: 100, v: 100, a: 1});
        expect(fillPowerless(parseColor('hsv(10 0% 50%)')!, previous)).toEqual({h: 10, s: 0, v: 50, a: 1});
    });
});

describe('sameColor', () => {
    it('compares the rendered color', () => {
        expect(sameColor({h: 10, s: 0, v: 50, a: 1}, {h: 200, s: 0, v: 50, a: 1})).toBe(true);
        expect(sameColor({h: 10, s: 50, v: 50, a: 1}, {h: 10.01, s: 50, v: 50, a: 1})).toBe(true);
        expect(sameColor({h: 10, s: 50, v: 50, a: 1}, {h: 20, s: 50, v: 50, a: 1})).toBe(false);
        expect(sameColor({h: 10, s: 50, v: 50, a: 1}, {h: 10, s: 50, v: 50, a: 0.5})).toBe(false);
    });
});

describe('normalizeHsva', () => {
    it('accepts valid colors and defaults alpha to 1', () => {
        expect(normalizeHsva({h: 360, s: 100, v: 0})).toEqual({h: 360, s: 100, v: 0, a: 1});
    });

    it('wraps the hue', () => {
        expect(normalizeHsva({h: 400, s: 0, v: 0, a: 1})?.h).toBe(40);
        expect(normalizeHsva({h: -90, s: 0, v: 0, a: 1})?.h).toBe(270);
    });

    it.each([
        {h: NaN, s: 0, v: 0, a: 1},
        {h: Infinity, s: 0, v: 0, a: 1},
        {h: 0, s: 101, v: 0, a: 1},
        {h: 0, s: -1, v: 0, a: 1},
        {h: 0, s: 0, v: 100.1, a: 1},
        {h: 0, s: 0, v: 0, a: 1.5},
        {h: 0, s: 0, v: 0, a: NaN}
    ])('rejects %o', color => {
        expect(normalizeHsva(color)).toBeNull();
    });
});
