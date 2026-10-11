import {rgbToHsv} from '../convert.js';
import {fmt} from '../math.js';
import type {ParsedColor, RGB, StringifyOptions} from '../types.js';

/**
 * Builds a parse result for formats without their own hue (hex, rgb, ...).
 * Grays have no hue, and black has neither hue nor saturation.
 */
export function fromRgb(format: string, rgb: RGB, a: number): ParsedColor {
    const hsv = rgbToHsv(rgb);

    return {
        format,
        color: {...hsv, a},
        powerless: {h: hsv.s === 0, s: hsv.v === 0}
    };
}

/** Alpha keeps at least three decimals so 8-bit alpha values survive a round-trip. */
export const fmtAlpha = (a: number, {precision = 0}: StringifyOptions) => fmt(a, Math.max(precision, 3));

/**
 * Joins channels to either `name(a b c / alpha)` or, in legacy mode, `legacyName(a, b, c, alpha)`.
 * The alpha is omitted in modern syntax if fully opaque.
 */
export function serialize(
    name: string,
    legacyName: string,
    channels: string[],
    a: number,
    options: StringifyOptions
): string {
    const alpha = fmtAlpha(a, options);

    if (options.legacy) {
        return `${legacyName}(${[...channels, alpha].join(', ')})`;
    }

    return `${name}(${channels.join(' ')}${a < 1 ? ` / ${alpha}` : ''})`;
}
