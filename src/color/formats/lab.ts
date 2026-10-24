import {labToRgb} from '../spaces.js';
import {parseFunction, readAlpha, readHue, readNumber, readPercent} from '../syntax.js';
import type {ColorFormat} from '../types.js';
import {fromWideGamut} from './shared.js';

/** In CSS, 100% of a and b equals 125, and 100% of chroma 150. */
const AB_PERCENT_REFERENCE = 125;
const CHROMA_PERCENT_REFERENCE = 150;

/** `lab(L a b / alpha)`, CIE Lab with lightness in [0, 100]. Parse-only, gamut-mapped to sRGB. */
export const lab: ColorFormat = {
    id: 'lab',

    parse(input) {
        const fn = parseFunction(input, ['lab']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [lArg, aArg, bArg, alphaArg] = fn.args;
        const l = lArg && readPercent(lArg);
        const a = aArg && readNumber(aArg, AB_PERCENT_REFERENCE);
        const b = bArg && readNumber(bArg, AB_PERCENT_REFERENCE);
        const alpha = readAlpha(alphaArg);

        if (l == null || a == null || b == null || alpha === null) {
            return null;
        }

        return fromWideGamut('lab', labToRgb([l, a, b]), alpha);
    }
};

/** `lch(L C H / alpha)`, the polar form of `lab()`. Parse-only, gamut-mapped to sRGB. */
export const lch: ColorFormat = {
    id: 'lch',

    parse(input) {
        const fn = parseFunction(input, ['lch']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [lArg, cArg, hArg, alphaArg] = fn.args;
        const l = lArg && readPercent(lArg);
        const c = cArg && readNumber(cArg, CHROMA_PERCENT_REFERENCE);
        const h = hArg && readHue(hArg);
        const alpha = readAlpha(alphaArg);

        if (l == null || c == null || c < 0 || h == null || alpha === null) {
            return null;
        }

        const rad = (h * Math.PI) / 180;
        return fromWideGamut('lch', labToRgb([l, c * Math.cos(rad), c * Math.sin(rad)]), alpha);
    }
};
