import {parseFunction, readAlpha, readHue, readPercent} from '../syntax.js';
import type {ColorFormat} from '../types.js';

/** `hwb(h w% b% / a)`, whiteness and blackness. Parse-only. */
export const hwb: ColorFormat = {
    id: 'hwb',

    parse(input) {
        const fn = parseFunction(input, ['hwb', 'hwba']);
        if (!fn || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const [hArg, wArg, bArg, aArg] = fn.args;
        const h = hArg && readHue(hArg);
        const w = wArg && readPercent(wArg);
        const b = bArg && readPercent(bArg);
        const a = readAlpha(aArg);

        if (h == null || w == null || b == null || a === null) {
            return null;
        }

        // Whiteness and blackness adding up to more than 100% are scaled down to a gray
        const sum = Math.max(w + b, 100);
        const v = 100 - (b / sum) * 100;
        const s = v === 0 ? 0 : (1 - w / sum / (v / 100)) * 100;

        // Like hsl(), the hue is given explicitly
        return {format: 'hwb', color: {h, s: Math.max(s, 0), v, a}, powerless: {h: false, s: v === 0}};
    }
};
