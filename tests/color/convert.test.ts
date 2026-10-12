import {converter, differenceEuclidean, toGamut} from 'culori';
import fc from 'fast-check';
import {describe, expect, it} from 'vitest';
import {cmykToRgb, hslToHsv, hsvToHsl, hsvToRgb, oklchToRgb, rgbToCmyk, rgbToHsv, rgbToOklch} from '../../src/color/convert.js';
import type {RGB} from '../../src/color/types.js';

const unit = fc.double({min: 0, max: 1, noNaN: true});
const anyRgb = fc.record({r: unit, g: unit, b: unit});
const anyHsv = fc.record({
    h: fc.double({min: 0, max: 360, noNaN: true}),
    s: fc.double({min: 0, max: 100, noNaN: true}),
    v: fc.double({min: 0, max: 100, noNaN: true})
});

// rgbToHsv treats differences below 1e-9 as noise
const expectRgbClose = (actual: RGB, expected: RGB, digits = 8) => {
    expect(actual.r).toBeCloseTo(expected.r, digits);
    expect(actual.g).toBeCloseTo(expected.g, digits);
    expect(actual.b).toBeCloseTo(expected.b, digits);
};

describe('hsv <-> rgb', () => {
    it.each([
        [{h: 0, s: 100, v: 100}, {r: 1, g: 0, b: 0}],
        [{h: 120, s: 100, v: 100}, {r: 0, g: 1, b: 0}],
        [{h: 240, s: 100, v: 100}, {r: 0, g: 0, b: 1}],
        [{h: 60, s: 100, v: 100}, {r: 1, g: 1, b: 0}],
        [{h: 360, s: 100, v: 100}, {r: 1, g: 0, b: 0}],
        [{h: 0, s: 0, v: 50}, {r: 0.5, g: 0.5, b: 0.5}],
        [{h: 0, s: 0, v: 0}, {r: 0, g: 0, b: 0}]
    ])('converts %o', (hsv, rgb) => {
        expectRgbClose(hsvToRgb(hsv), rgb);
    });

    it('converts #42445A', () => {
        const hsv = rgbToHsv({r: 66 / 255, g: 68 / 255, b: 90 / 255});
        expect(hsv.h).toBeCloseTo(235, 6);
        expect(hsv.s).toBeCloseTo(26.6667, 3);
        expect(hsv.v).toBeCloseTo(35.2941, 3);
    });

    it('reports no hue or saturation for grays', () => {
        expect(rgbToHsv({r: 0.5, g: 0.5, b: 0.5})).toEqual({h: 0, s: 0, v: 50});
        expect(rgbToHsv({r: 0, g: 0, b: 0})).toEqual({h: 0, s: 0, v: 0});
    });

    it('round-trips any rgb color', () => {
        fc.assert(fc.property(anyRgb, rgb => expectRgbClose(hsvToRgb(rgbToHsv(rgb)), rgb)));
    });

    it('returns hues in [0, 360)', () => {
        fc.assert(fc.property(anyRgb, rgb => {
            const {h} = rgbToHsv(rgb);
            expect(h).toBeGreaterThanOrEqual(0);
            expect(h).toBeLessThan(360);
        }));
    });
});

describe('hsv <-> hsl', () => {
    it.each([
        [{h: 0, s: 100, v: 100}, {h: 0, s: 100, l: 50}],
        [{h: 0, s: 0, v: 100}, {h: 0, s: 0, l: 100}],
        [{h: 0, s: 0, v: 0}, {h: 0, s: 0, l: 0}],
        [{h: 200, s: 50, v: 50}, {h: 200, s: 1 / 3 * 100, l: 37.5}]
    ])('converts %o', (hsv, expected) => {
        const hsl = hsvToHsl(hsv);
        expect(hsl.h).toBeCloseTo(expected.h, 9);
        expect(hsl.s).toBeCloseTo(expected.s, 9);
        expect(hsl.l).toBeCloseTo(expected.l, 9);
    });

    // Compared in rgb since saturation is undefined for black / white
    it('round-trips any color', () => {
        fc.assert(fc.property(anyHsv, hsv => {
            expectRgbClose(hsvToRgb(hslToHsv(hsvToHsl(hsv))), hsvToRgb(hsv));
        }));
    });
});

describe('rgb <-> cmyk', () => {
    it('converts #42445A', () => {
        const cmyk = rgbToCmyk({r: 66 / 255, g: 68 / 255, b: 90 / 255});
        expect(cmyk.c).toBeCloseTo(26.6667, 3);
        expect(cmyk.m).toBeCloseTo(24.4444, 3);
        expect(cmyk.y).toBeCloseTo(0, 9);
        expect(cmyk.k).toBeCloseTo(64.7059, 3);
    });

    it('converts black without dividing by zero', () => {
        expect(rgbToCmyk({r: 0, g: 0, b: 0})).toEqual({c: 0, m: 0, y: 0, k: 100});
    });

    it('round-trips any rgb color', () => {
        fc.assert(fc.property(anyRgb, rgb => expectRgbClose(cmykToRgb(rgbToCmyk(rgb)), rgb)));
    });
});

describe('rgb <-> oklch', () => {
    const culoriOklch = converter('oklch');
    // CSS uses deltaEOK (euclidean distance in OKLab), @types/culori wrongly types this parameter as number
    const culoriGamutMap = toGamut('rgb', 'oklch', differenceEuclidean('oklab') as unknown as number, 0.02);

    it('matches culori for rgb -> oklch', () => {
        fc.assert(fc.property(anyRgb, rgb => {
            const actual = rgbToOklch(rgb);
            const expected = culoriOklch({mode: 'rgb', ...rgb});

            expect(actual.l).toBeCloseTo(expected.l, 4);
            expect(actual.c).toBeCloseTo(expected.c, 4);

            // Hue is too unstable to compare for nearly gray colors
            if (expected.c > 0.01 && expected.h !== undefined) {
                const diff = Math.abs(actual.h - expected.h) % 360;
                expect(Math.min(diff, 360 - diff)).toBeLessThan(0.05);
            }
        }));
    });

    it('round-trips any rgb color', () => {
        fc.assert(fc.property(anyRgb, rgb => expectRgbClose(oklchToRgb(rgbToOklch(rgb)), rgb, 5)));
    });

    it('treats grays as achromatic', () => {
        expect(rgbToOklch({r: 0.5, g: 0.5, b: 0.5})).toMatchObject({c: 0, h: 0});
        expect(rgbToOklch({r: 1, g: 1, b: 1})).toMatchObject({c: 0, h: 0});
    });

    it('maps out-of-gamut colors like culori does (CSS Color 4 algorithm)', () => {
        const anyOklch = fc.record({
            l: fc.double({min: 0, max: 1, noNaN: true}),
            c: fc.double({min: 0, max: 0.5, noNaN: true}),
            h: fc.double({min: 0, max: 360, noNaN: true})
        });

        fc.assert(fc.property(anyOklch, color => {
            const actual = oklchToRgb(color);
            const expected = culoriGamutMap({mode: 'oklch', ...color});

            // Results always lie within sRGB
            for (const channel of [actual.r, actual.g, actual.b]) {
                expect(channel).toBeGreaterThanOrEqual(0);
                expect(channel).toBeLessThanOrEqual(1);
            }

            // Both binary-search for the chroma, allow for slightly different end points
            expectRgbClose(actual, expected, 2);
        }));
    });

    it('maps a saturated green into sRGB', () => {
        expectRgbClose(oklchToRgb({l: 0.7, c: 0.4, h: 150}), {r: 0, g: 0.7607, b: 0.2806}, 3);
    });

    it('clamps lightness to black and white', () => {
        expect(oklchToRgb({l: 1, c: 0.2, h: 30})).toEqual({r: 1, g: 1, b: 1});
        expect(oklchToRgb({l: 0, c: 0.2, h: 30})).toEqual({r: 0, g: 0, b: 0});
    });
});
