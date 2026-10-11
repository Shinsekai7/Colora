import {hsvToRgb} from '../convert.js';
import {fmt} from '../math.js';
import {parseFunction, readAlpha, readFraction} from '../syntax.js';
import type {OutputFormat} from '../types.js';
import {fromRgb, serialize} from './shared.js';

/** `rgb(r g b / a)`, channels are numbers in [0, 255] or percentages. */
export const rgb: OutputFormat = {
    id: 'rgb',

    parse(input) {
        const fn = parseFunction(input, ['rgb', 'rgba']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [r, g, b] = fn.args.slice(0, 3).map(arg => readFraction(arg, 255));
        const a = readAlpha(fn.args[3]);

        if (r == null || g == null || b == null || a === null) {
            return null;
        }

        return fromRgb('rgb', {r, g, b}, a);
    },

    stringify(color, options = {}) {
        const {r, g, b} = hsvToRgb(color);
        const channels = [r, g, b].map(c => fmt(c * 255, options.precision));
        return serialize('rgb', 'rgba', channels, color.a, options);
    }
};
