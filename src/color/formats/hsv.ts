import {fmt} from '../math.js';
import {parseFunction, readAlpha, readHue, readPercent} from '../syntax.js';
import type {OutputFormat} from '../types.js';
import {serialize} from './shared.js';

/** `hsv(h s% v% / a)`. Not part of CSS, but the picker's native model. */
export const hsv: OutputFormat = {
    id: 'hsv',

    parse(input) {
        const fn = parseFunction(input, ['hsv', 'hsva']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [hArg, sArg, vArg, aArg] = fn.args;
        const h = hArg && readHue(hArg);
        const s = sArg && readPercent(sArg);
        const v = vArg && readPercent(vArg);
        const a = readAlpha(aArg);

        if (h == null || s == null || v == null || a === null) {
            return null;
        }

        return {format: 'hsv', color: {h, s, v, a}, powerless: {h: false, s: false}};
    },

    stringify(color, options = {}) {
        const p = options.precision;
        const channels = [fmt(color.h, p), `${fmt(color.s, p)}%`, `${fmt(color.v, p)}%`];
        return serialize('hsv', 'hsva', channels, color.a, options);
    }
};
