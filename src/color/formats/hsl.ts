import {hslToHsv, hsvToHsl} from '../convert.js';
import {fmt} from '../math.js';
import {parseFunction, readAlpha, readHue, readPercent} from '../syntax.js';
import type {OutputFormat} from '../types.js';
import {serialize} from './shared.js';

/** `hsl(h s% l% / a)`, the percent signs are optional when parsing. */
export const hsl: OutputFormat = {
    id: 'hsl',

    parse(input) {
        const fn = parseFunction(input, ['hsl', 'hsla']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [hArg, sArg, lArg, aArg] = fn.args;
        const h = hArg && readHue(hArg);
        const s = sArg && readPercent(sArg);
        const l = lArg && readPercent(lArg);
        const a = readAlpha(aArg);

        if (h == null || s == null || l == null || a === null) {
            return null;
        }

        // The hue is given explicitly, but saturation in HSV is undefined for black
        const hsv = hslToHsv({h, s, l});
        return {format: 'hsl', color: {...hsv, a}, powerless: {h: false, s: hsv.v === 0}};
    },

    stringify(color, options = {}) {
        const {h, s, l} = hsvToHsl(color);
        const p = options.precision;
        return serialize('hsl', 'hsla', [fmt(h, p), `${fmt(s, p)}%`, `${fmt(l, p)}%`], color.a, options);
    }
};
