import {differenceEuclidean, toGamut} from 'culori';
import type {Color} from 'culori';
import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import {hsvToRgb} from '../../src/color/convert.js';
import {colorFunction} from '../../src/color/formats/color-function.js';
import {hwb} from '../../src/color/formats/hwb.js';
import {lab, lch} from '../../src/color/formats/lab.js';
import {oklab} from '../../src/color/formats/oklab.js';
import {parseColor} from '../../src/color/parse.js';
import type {ColorFormat, ParsedColor, RGB} from '../../src/color/types.js';

// Same as CSS: converts to sRGB and maps colors outside of it, see convert.test.ts
const culoriToRgb = toGamut('rgb', 'oklch', differenceEuclidean('oklab') as unknown as number, 0.02);

const unit = fc.double({min: 0, max: 1, noNaN: true});
const hue = fc.double({min: 0, max: 360, noNaN: true});

const rgbOf = (parsed: ParsedColor | null): RGB => {
    expect(parsed).not.toBeNull();
    return hsvToRgb((parsed as ParsedColor).color);
};

// Both binary-search the chroma of colors outside of sRGB, allow for slightly different end points
const expectLikeCulori = (parsed: ParsedColor | null, color: Color) => {
    const actual = rgbOf(parsed);
    const expected = culoriToRgb(color);

    expect(actual.r).toBeCloseTo(expected.r, 2);
    expect(actual.g).toBeCloseTo(expected.g, 2);
    expect(actual.b).toBeCloseTo(expected.b, 2);
};

describe('color()', () => {
    const spaces = [
        ['srgb', 'rgb'],
        ['srgb-linear', 'lrgb'],
        ['display-p3', 'p3'],
        ['a98-rgb', 'a98'],
        ['prophoto-rgb', 'prophoto'],
        ['rec2020', 'rec2020']
    ] as const;

    it.each(spaces)('converts %s like culori', (space, mode) => {
        fc.assert(fc.property(unit, unit, unit, (r, g, b) => {
            expectLikeCulori(colorFunction.parse(`color(${space} ${r} ${g} ${b})`), {mode, r, g, b});
        }));
    });

    it.each([['xyz', 'xyz65'], ['xyz-d65', 'xyz65'], ['xyz-d50', 'xyz50']] as const)('converts %s like culori', (space, mode) => {
        fc.assert(fc.property(unit, unit, unit, (x, y, z) => {
            expectLikeCulori(colorFunction.parse(`color(${space} ${x} ${y} ${z})`), {mode, x, y, z});
        }));
    });

    it('parses percentages and alpha', () => {
        const parsed = colorFunction.parse('color(display-p3 100% 50% 0% / 50%)');
        expect(parsed?.color.a).toBe(0.5);
        expectLikeCulori(parsed, {mode: 'p3', r: 1, g: 0.5, b: 0});
    });

    it('maps Display P3 red into sRGB', () => {
        const {r, g, b} = rgbOf(colorFunction.parse('color(display-p3 1 0 0)'));
        expect([r, g, b].every(c => c >= 0 && c <= 1)).toBe(true);
        expect(r).toBeCloseTo(1, 2);
    });

    it.each([
        'color(display-p3 1 0)',
        'color(display-p3 1.5 0 0)',
        'color(display-p3 -0.1 0 0)',
        'color(nope 1 0 0)',
        'color(1 0 0)',
        'color(constructor 1 0 0)',
        'color(display-p3 1 0 0 / 2)'
    ])('rejects %j', input => {
        expect(colorFunction.parse(input)).toBeNull();
    });
});

describe('lab() and lch()', () => {
    const lightness = fc.double({min: 0, max: 100, noNaN: true});
    const axis = fc.double({min: -125, max: 125, noNaN: true});
    const chroma = fc.double({min: 0, max: 150, noNaN: true});

    it('converts lab() like culori', () => {
        fc.assert(fc.property(lightness, axis, axis, (l, a, b) => {
            expectLikeCulori(lab.parse(`lab(${l} ${a} ${b})`), {mode: 'lab', l, a, b});
        }));
    });

    it('converts lch() like culori', () => {
        fc.assert(fc.property(lightness, chroma, hue, (l, c, h) => {
            expectLikeCulori(lch.parse(`lch(${l}% ${c} ${h}deg)`), {mode: 'lch', l, c, h});
        }));
    });

    it('parses percentages of the axes', () => {
        expectLikeCulori(lab.parse('lab(50% 40% -20%)'), {mode: 'lab', l: 50, a: 50, b: -25});
        expectLikeCulori(lch.parse('lch(50% 20% 90)'), {mode: 'lch', l: 50, c: 30, h: 90});
    });

    it.each(['lab(101 0 0)', 'lab(-1 0 0)', 'lab(50 0)', 'lab(50 1deg 0)', 'lab(50 1e300 0)', 'lch(50 -1 0)', 'lch(50 10 10%)', 'lch(50 1e300 0)'])('rejects %j', input => {
        expect(parseColor(input)).toBeNull();
    });
});

describe('oklab()', () => {
    const axis = fc.double({min: -0.4, max: 0.4, noNaN: true});

    it('converts like culori', () => {
        fc.assert(fc.property(unit, axis, axis, (l, a, b) => {
            expectLikeCulori(oklab.parse(`oklab(${l} ${a} ${b})`), {mode: 'oklab', l, a, b});
        }));
    });

    it('parses percentages', () => {
        expectLikeCulori(oklab.parse('oklab(50% 25% -25%)'), {mode: 'oklab', l: 0.5, a: 0.1, b: -0.1});
    });

    it.each(['oklab(1.1 0 0)', 'oklab(0.5 0)', 'oklab(0.5 0 0 / -1)'])('rejects %j', input => {
        expect(oklab.parse(input)).toBeNull();
    });
});

describe('hwb()', () => {
    const percent = fc.double({min: 0, max: 100, noNaN: true});

    it('converts like culori', () => {
        fc.assert(fc.property(hue, percent, percent, (h, w, b) => {
            expectLikeCulori(hwb.parse(`hwb(${h} ${w}% ${b}%)`), {mode: 'hwb', h, w: w / 100, b: b / 100});
        }));
    });

    it('keeps the hue', () => {
        expect(hwb.parse('hwb(200 20% 30%)')?.color.h).toBe(200);
    });

    it('turns whiteness and blackness above 100% into a gray', () => {
        expect(rgbOf(hwb.parse('hwb(0 60% 60%)'))).toEqual({r: 0.5, g: 0.5, b: 0.5});
    });

    it.each(['hwb(0 101% 0%)', 'hwb(0 0% -1%)', 'hwb(0 0%)'])('rejects %j', input => {
        expect(hwb.parse(input)).toBeNull();
    });
});

describe('parseColor', () => {
    const formats: [string, ColorFormat][] = [
        ['hwb(120 0% 0%)', hwb],
        ['lab(50 20 30)', lab],
        ['lch(50 20 30)', lch],
        ['oklab(0.5 0.1 0.1)', oklab],
        ['color(display-p3 0.5 0.5 0.5)', colorFunction]
    ];

    it.each(formats)('accepts %s by default', (input, format) => {
        expect(parseColor(input)?.format).toBe(format.id);
    });
});
