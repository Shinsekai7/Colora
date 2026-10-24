import {colorFunction} from './formats/color-function.js';
import {hex} from './formats/hex.js';
import {hsl} from './formats/hsl.js';
import {hsv} from './formats/hsv.js';
import {hwb} from './formats/hwb.js';
import {lab, lch} from './formats/lab.js';
import {named} from './formats/named.js';
import {oklab} from './formats/oklab.js';
import {oklch} from './formats/oklch.js';
import {rgb} from './formats/rgb.js';
import {mod} from './math.js';
import type {ColorFormat, HSVA, ParsedColor} from './types.js';

/** Formats `parseColor` accepts by default: all of CSS, plus hsv. */
export const defaultFormats: readonly ColorFormat[] = [hex, rgb, hsl, hsv, hwb, lab, lch, oklab, oklch, colorFunction, named];

/**
 * Parses a color string using the first format that accepts it.
 * Returns null for anything invalid, including out-of-range channels.
 */
export function parseColor(input: string, formats: readonly ColorFormat[] = defaultFormats): ParsedColor | null {
    if (typeof input !== 'string') {
        return null;
    }

    for (const format of formats) {
        const parsed = format.parse(input);

        if (parsed) {
            return parsed;
        }
    }

    return null;
}

/**
 * Resolves the components a parsed color left undefined by taking them from the previous color,
 * e.g. parsing `#808080` keeps the previously selected hue instead of resetting it to 0.
 */
export function fillPowerless({color, powerless}: ParsedColor, previous: HSVA): HSVA {
    return {
        ...color,
        h: powerless.h ? previous.h : color.h,
        s: powerless.s ? previous.s : color.s
    };
}

/**
 * Validates a color coming from outside, e.g. a public API call.
 * Hue wraps around, anything else out of range (or NaN) is rejected.
 */
export function normalizeHsva({h, s, v, a = 1}: { h: number; s: number; v: number; a?: number }): HSVA | null {
    const values = [h, s, v, a];

    if (!values.every(Number.isFinite) || s < 0 || s > 100 || v < 0 || v > 100 || a < 0 || a > 1) {
        return null;
    }

    return {h: h >= 0 && h <= 360 ? h : mod(h, 360), s, v, a};
}
