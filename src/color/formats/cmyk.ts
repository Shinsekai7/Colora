import {cmykToRgb, hsvToRgb, rgbToCmyk} from '../convert.js';
import {fmt} from '../math.js';
import {parseFunction, readAlpha, readFraction} from '../syntax.js';
import type {OutputFormat} from '../types.js';
import {fmtAlpha, fromRgb} from './shared.js';

/**
 * `device-cmyk(c m y k / a)` from CSS Color 5, channels are numbers in [0, 1] or percentages.
 *
 * Not part of the default formats: without a color profile CMYK is only a rough approximation.
 */
export const cmyk: OutputFormat = {
    id: 'cmyk',

    parse(input) {
        const fn = parseFunction(input, ['device-cmyk']);
        if (!fn || fn.args.length < 4 || fn.args.length > 5) {
            return null;
        }

        const [c, m, y, k] = fn.args.slice(0, 4).map(arg => readFraction(arg));
        const a = readAlpha(fn.args[4]);

        if (c == null || m == null || y == null || k == null || a === null) {
            return null;
        }

        return fromRgb('cmyk', cmykToRgb({c: c * 100, m: m * 100, y: y * 100, k: k * 100}), a);
    },

    /** Always uses the modern syntax, the `legacy` option doesn't apply. */
    stringify(color, options = {}) {
        const {c, m, y, k} = rgbToCmyk(hsvToRgb(color));
        const channels = [c, m, y, k].map(v => `${fmt(v, options.precision)}%`);
        return `device-cmyk(${channels.join(' ')}${color.a < 1 ? ` / ${fmtAlpha(color.a, options)}` : ''})`;
    }
};
