import {hsvToRgb, oklchToRgb, rgbToOklch} from '../convert.js';
import {fmt} from '../math.js';
import {parseFunction, readAlpha, readFraction, readHue, readNumber} from '../syntax.js';
import type {OutputFormat} from '../types.js';
import {fmtAlpha, fromRgb} from './shared.js';

/** In CSS, a chroma of 100% equals 0.4. */
const CHROMA_PERCENT_REFERENCE = 0.4;

/**
 * `oklch(L C H / a)`, lightness as number in [0, 1] or percentage.
 * Colors outside of sRGB are gamut-mapped by reducing their chroma.
 */
export const oklch: OutputFormat = {
    id: 'oklch',

    parse(input) {
        const fn = parseFunction(input, ['oklch']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [lArg, cArg, hArg, aArg] = fn.args;
        const l = lArg && readFraction(lArg);
        const c = cArg && readNumber(cArg, CHROMA_PERCENT_REFERENCE);
        const h = hArg && readHue(hArg);
        const a = readAlpha(aArg);

        if (l == null || c == null || c < 0 || h == null || a === null) {
            return null;
        }

        return fromRgb('oklch', oklchToRgb({l, c, h}), a);
    },

    /**
     * Chroma gets three more decimal places than lightness and hue as it's a lot smaller.
     * Defaults to a precision of 2, the lowest at which every 8-bit sRGB color survives a round-trip.
     */
    stringify(color, options = {}) {
        const {l, c, h} = rgbToOklch(hsvToRgb(color));
        const p = options.precision ?? 2;
        const alpha = color.a < 1 ? ` / ${fmtAlpha(color.a, options)}` : '';
        return `oklch(${fmt(l * 100, p)}% ${fmt(c, p + 3)} ${fmt(h, p)}${alpha})`;
    }
};
