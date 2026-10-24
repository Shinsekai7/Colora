import {oklchToRgb} from '../convert.js';
import {mod} from '../math.js';
import {parseFunction, readAlpha, readFraction, readNumber} from '../syntax.js';
import type {ColorFormat} from '../types.js';
import {fromRgb} from './shared.js';

/** In CSS, 100% of a and b equals 0.4. */
const AB_PERCENT_REFERENCE = 0.4;

/** `oklab(L a b / alpha)`, lightness as number in [0, 1] or percentage. Parse-only, gamut-mapped to sRGB. */
export const oklab: ColorFormat = {
    id: 'oklab',

    parse(input) {
        const fn = parseFunction(input, ['oklab']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [lArg, aArg, bArg, alphaArg] = fn.args;
        const l = lArg && readFraction(lArg);
        const a = aArg && readNumber(aArg, AB_PERCENT_REFERENCE);
        const b = bArg && readNumber(bArg, AB_PERCENT_REFERENCE);
        const alpha = readAlpha(alphaArg);

        if (l == null || a == null || b == null || alpha === null) {
            return null;
        }

        const h = mod((Math.atan2(b, a) * 180) / Math.PI, 360);
        return fromRgb('oklab', oklchToRgb({l, c: Math.hypot(a, b), h}), alpha);
    }
};
