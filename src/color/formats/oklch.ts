import {hsvToRgb, oklchToRgb, rgbToOklch} from '../convert.js';
import {fmt} from '../math.js';
import {parseFunction, readAlpha, readFraction, readHue} from '../syntax.js';
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
        const h = hArg && readHue(hArg);
        const a = readAlpha(aArg);

        let c: number | null = null;
        if (cArg?.unit === '%' || (cArg?.unit === '' && cArg.value >= 0)) {
            c = cArg.unit === '%' ? (cArg.value / 100) * CHROMA_PERCENT_REFERENCE : cArg.value;
        }

        if (l == null || c === null || !Number.isFinite(c) || c < 0 || h == null || a === null) {
            return null;
        }

        return fromRgb('oklch', oklchToRgb({l, c, h}), a);
    },

    /** Chroma gets three more decimal places than lightness and hue as it's a lot smaller. */
    stringify(color, options = {}) {
        const {l, c, h} = rgbToOklch(hsvToRgb(color));
        const p = options.precision ?? 0;
        const alpha = color.a < 1 ? ` / ${fmtAlpha(color.a, options)}` : '';
        return `oklch(${fmt(l * 100, p)}% ${fmt(c, p + 3)} ${fmt(h, p)}${alpha})`;
    }
};
