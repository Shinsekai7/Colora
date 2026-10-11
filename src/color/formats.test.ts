import colorNames from 'color-name';
import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import {hsvToRgb} from './convert.js';
import {cmyk} from './formats/cmyk.js';
import {hex} from './formats/hex.js';
import {hsl} from './formats/hsl.js';
import {hsv} from './formats/hsv.js';
import {named, NAMED_COLORS} from './formats/named.js';
import {oklch} from './formats/oklch.js';
import {rgb} from './formats/rgb.js';
import type {HSVA, OutputFormat, ParsedColor} from './types.js';

// #42445A, the default color
const SLATE: HSVA = {h: 235, s: (24 / 90) * 100, v: (90 / 255) * 100, a: 1};

const toRgb255 = (color: HSVA) => {
    const {r, g, b} = hsvToRgb(color);
    return [r * 255, g * 255, b * 255];
};

const expectColor = (parsed: ParsedColor | null, expected: HSVA, digits = 6) => {
    expect(parsed).not.toBeNull();
    const color = (parsed as ParsedColor).color;

    toRgb255(color).forEach((channel, i) => expect(channel).toBeCloseTo(toRgb255(expected)[i] as number, digits));
    expect(color.a).toBeCloseTo(expected.a, digits);
};

describe('hex', () => {
    it.each(['#42445A', '#42445a', '42445a', ' #42445A '])('parses %s', input => {
        expectColor(hex.parse(input), SLATE);
        expect(hex.parse(input)?.format).toBe('hex');
    });

    it('parses short and alpha notations', () => {
        expectColor(hex.parse('#fff'), {h: 0, s: 0, v: 100, a: 1});
        expectColor(hex.parse('#FFFF'), {h: 0, s: 0, v: 100, a: 1});
        expectColor(hex.parse('#0008'), {h: 0, s: 0, v: 0, a: 0x88 / 255});
        expectColor(hex.parse('#42445A80'), {...SLATE, a: 128 / 255});
    });

    it.each(['', '#', '#12', '#12345', '#1234567', '#123456789', '#ggg', '##fff', '#fff;'])('rejects %j', input => {
        expect(hex.parse(input)).toBeNull();
    });

    it('stringifies', () => {
        expect(hex.stringify(SLATE)).toBe('#42445A');
        expect(hex.stringify({...SLATE, a: 0.5})).toBe('#42445A80');
        expect(hex.stringify({h: 0, s: 0, v: 0, a: 0})).toBe('#00000000');
    });
});

describe('rgb', () => {
    it.each([
        'rgb(66, 68, 90)',
        'rgb(66 68 90)',
        'rgba(66,68,90,1)',
        'RGB(66 68 90)',
        'rgb (66 68 90)',
        'rgb 66 68 90',
        'rgb(66 68 90',
        'rgb(25.882352941% 26.666666667% 35.294117647%)'
    ])('parses %s', input => {
        expectColor(rgb.parse(input), SLATE);
    });

    it.each(['rgb(66 68 90 / 0.5)', 'rgb(66 68 90 / .5)', 'rgba(66, 68, 90, 50%)', 'rgb(66 68 90 / 5e-1)'])(
        'parses the alpha channel of %s',
        input => expectColor(rgb.parse(input), {...SLATE, a: 0.5})
    );

    it.each([
        'rgb(256 0 0)',
        'rgb(-1 0 0)',
        'rgb(101% 0 0)',
        'rgb(1.2.3 0 0)',
        'rgb(1 2)',
        'rgb(1 2 3 4 5)',
        'rgb(1 2 3 / 1.5)',
        'rgb(1 2 3 / -0.5)',
        'rgb(1; 2; 3)',
        'rgb()',
        'rgb(1deg 2 3)',
        'rgb(1 2 3))',
        'rgbx(1 2 3)',
        'rgb1 2 3',
        'rgb(NaN 0 0)',
        'rgb(Infinity 0 0)',
        'rgb(1e400 0 0)',
        'hsl(1 2 3)'
    ])('rejects %j', input => {
        expect(rgb.parse(input)).toBeNull();
    });

    it('stringifies', () => {
        expect(rgb.stringify(SLATE)).toBe('rgb(66 68 90)');
        expect(rgb.stringify({...SLATE, a: 0.5})).toBe('rgb(66 68 90 / 0.5)');
        expect(rgb.stringify({...SLATE, a: 1 / 3})).toBe('rgb(66 68 90 / 0.333)');
        expect(rgb.stringify(SLATE, {legacy: true})).toBe('rgba(66, 68, 90, 1)');
    });

    it('applies the precision', () => {
        const color = {h: 200, s: 50, v: 50, a: 1}; // rgb(63.75 106.25 127.5)
        expect(rgb.stringify(color)).toBe('rgb(64 106 128)');
        expect(rgb.stringify(color, {precision: 2})).toBe('rgb(63.75 106.25 127.5)');
    });
});

describe('hsl', () => {
    it.each([
        ['hsl(0 100% 50%)', {h: 0, s: 100, v: 100, a: 1}],
        ['hsl(120deg 100% 25%)', {h: 120, s: 100, v: 50, a: 1}],
        ['hsl(0.5turn 100% 50%)', {h: 180, s: 100, v: 100, a: 1}],
        [`hsl(${Math.PI}rad 100% 50%)`, {h: 180, s: 100, v: 100, a: 1}],
        ['hsl(200grad 100% 50%)', {h: 180, s: 100, v: 100, a: 1}],
        ['hsl(-60 100% 50%)', {h: 300, s: 100, v: 100, a: 1}],
        ['hsl(420 100% 50%)', {h: 60, s: 100, v: 100, a: 1}],
        ['hsl 0 100 50', {h: 0, s: 100, v: 100, a: 1}],
        ['hsla(0, 100%, 50%, 0.3)', {h: 0, s: 100, v: 100, a: 0.3}],
        ['hsl(0 100% 50% / 30%)', {h: 0, s: 100, v: 100, a: 0.3}]
    ])('parses %s', (input, expected) => {
        expectColor(hsl.parse(input), expected);
    });

    it('keeps the given hue, even for grays', () => {
        expect(hsl.parse('hsl(200 0% 50%)')).toMatchObject({color: {h: 200}, powerless: {h: false, s: false}});
        expect(hsl.parse('hsl(200 50% 0%)')).toMatchObject({color: {h: 200}, powerless: {h: false, s: true}});
    });

    it.each(['hsl(0 101% 50%)', 'hsl(0 50% -1%)', 'hsl(0% 50% 50%)', 'hsl(0 50%)', 'hsl(0 50% 50% / 2)'])(
        'rejects %j',
        input => expect(hsl.parse(input)).toBeNull()
    );

    it('stringifies', () => {
        expect(hsl.stringify(SLATE)).toBe('hsl(235 15% 31%)');
        expect(hsl.stringify({...SLATE, a: 0.25})).toBe('hsl(235 15% 31% / 0.25)');
        expect(hsl.stringify(SLATE, {legacy: true})).toBe('hsla(235, 15%, 31%, 1)');
    });
});

describe('hsv', () => {
    it('parses', () => {
        expect(hsv.parse('hsv(200 50% 50%)')).toEqual({
            format: 'hsv',
            color: {h: 200, s: 50, v: 50, a: 1},
            powerless: {h: false, s: false}
        });

        expect(hsv.parse('hsva 10 20 5 0.5')?.color).toEqual({h: 10, s: 20, v: 5, a: 0.5});
    });

    it.each(['hsv(0 101% 50%)', 'hsv(0 50% 101)', 'hsva(0 50% 50% 1.1)'])('rejects %j', input => {
        expect(hsv.parse(input)).toBeNull();
    });

    it('stringifies', () => {
        const color = {h: 200, s: 50, v: 50, a: 1};
        expect(hsv.stringify(color)).toBe('hsv(200 50% 50%)');
        expect(hsv.stringify({...color, a: 0.25})).toBe('hsv(200 50% 50% / 0.25)');
        expect(hsv.stringify(color, {legacy: true})).toBe('hsva(200, 50%, 50%, 1)');
    });
});

describe('cmyk', () => {
    it.each([
        'device-cmyk(0.1 0.2 0.3 0.4)',
        'device-cmyk(10% 20% 30% 40%)',
        'device-cmyk(0.1, 0.2, 0.3, 0.4)',
        'DEVICE-CMYK(10% 0.2 30% 0.4)'
    ])('parses %s', input => {
        expect(cmyk.parse(input)?.format).toBe('cmyk');
        expectColor(cmyk.parse(input), {...(hex.parse('#8A7A6B')?.color as HSVA), a: 1}, 0);
    });

    it('parses the alpha channel', () => {
        expectColor(cmyk.parse('device-cmyk(0 0 0 1 / 0.5)'), {h: 0, s: 0, v: 0, a: 0.5});
    });

    it.each(['device-cmyk(1.1 0 0 0)', 'device-cmyk(101% 0 0 0)', 'device-cmyk(0 0 0)', 'device-cmyk(0 0 0 0 0 0)', 'cmyk(0 0 0 0)'])('rejects %j', input => {
        expect(cmyk.parse(input)).toBeNull();
    });

    it('stringifies', () => {
        expect(cmyk.stringify(SLATE)).toBe('device-cmyk(27% 24% 0% 65%)');
        expect(cmyk.stringify({...SLATE, a: 0.5})).toBe('device-cmyk(27% 24% 0% 65% / 0.5)');
        expect(cmyk.stringify({...SLATE, a: 0.5}, {legacy: true})).toBe('device-cmyk(27% 24% 0% 65% / 0.5)');
    });
});

describe('oklch', () => {
    const red: HSVA = {h: 0, s: 100, v: 100, a: 1};

    it.each(['oklch(62.796% 0.25768 29.234)', 'oklch(0.62796 0.25768 29.234)', 'oklch(62.796% 64.42% 29.234deg)'])(
        'parses %s',
        input => expectColor(oklch.parse(input), red, 1)
    );

    it('gamut-maps colors outside of sRGB', () => {
        const parsed = oklch.parse('oklch(0.7 0.4 150)');
        const [r = NaN, g = NaN, b = NaN] = toRgb255(parsed?.color as HSVA);

        expect(r).toBeCloseTo(0, 3);
        expect(g / 255).toBeCloseTo(0.7607, 3);
        expect(b / 255).toBeCloseTo(0.2806, 3);
    });

    it('marks the hue of grays as powerless', () => {
        expect(oklch.parse('oklch(50% 0 120)')?.powerless).toEqual({h: true, s: false});
    });

    it.each(['oklch(0.5 -0.1 0)', 'oklch(150% 0.1 0)', 'oklch(0.5 0.1)', 'oklch(0.5 0.1deg 0)'])('rejects %j', input => {
        expect(oklch.parse(input)).toBeNull();
    });

    it('stringifies', () => {
        expect(oklch.stringify(SLATE)).toBe('oklch(39% 0.037 280)');
        expect(oklch.stringify({...SLATE, a: 0.5})).toBe('oklch(39% 0.037 280 / 0.5)');
        expect(oklch.stringify({h: 0, s: 0, v: 100, a: 1})).toBe('oklch(100% 0 0)');
    });
});

describe('named', () => {
    it('contains every CSS color keyword', () => {
        const expected = Object.fromEntries(
            Object.entries(colorNames).map(([name, [r, g, b]]) => [name, [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')])
        );

        const {transparent, ...actual} = NAMED_COLORS;
        expect(actual).toEqual(expected);
        expect(transparent).toBe('00000000');
    });

    it.each(['rebeccapurple', 'RebeccaPurple', '  rebeccapurple '])('parses %j', input => {
        expect(named.parse(input)?.format).toBe('named');
        expectColor(named.parse(input), hex.parse('#663399')?.color as HSVA);
    });

    it('parses transparent', () => {
        expect(named.parse('transparent')).toMatchObject({color: {a: 0}, powerless: {h: true, s: true}});
    });

    it.each(['notacolor', 'constructor', 'toString', '__proto__', ''])('rejects %j', input => {
        expect(named.parse(input)).toBeNull();
    });
});

describe('all formats', () => {
    const anyColor = fc.record({
        h: fc.double({min: 0, max: 360, noNaN: true}),
        s: fc.double({min: 0, max: 100, noNaN: true}),
        v: fc.double({min: 0, max: 100, noNaN: true}),
        a: fc.double({min: 0, max: 1, noNaN: true})
    });

    const formats: [OutputFormat, number][] = [[hex, 0.5 + 1e-9], [rgb, 1e-3], [hsl, 1e-3], [hsv, 1e-3], [cmyk, 1e-3], [oklch, 1e-2]];

    it.each(formats)('parses its own output: $id', (format, tolerance) => {
        fc.assert(fc.property(anyColor, fc.boolean(), (color, legacy) => {
            const parsed = format.parse(format.stringify(color, {precision: 6, legacy}));

            expect(parsed).not.toBeNull();
            const actual = toRgb255((parsed as ParsedColor).color);
            toRgb255(color).forEach((channel, i) => expect(Math.abs(channel - (actual[i] as number))).toBeLessThan(tolerance));

            expect(Math.abs((parsed as ParsedColor).color.a - color.a)).toBeLessThan(format === hex ? 0.5 / 255 + 1e-9 : 1e-6);
        }));
    });
});
