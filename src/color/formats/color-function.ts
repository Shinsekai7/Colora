import {colorSpaceToRgb} from '../spaces.js';
import {parseFunction, readAlpha, readFraction, readNumber} from '../syntax.js';
import type {ColorFormat} from '../types.js';
import {fromWideGamut} from './shared.js';

/**
 * `color(space c1 c2 c3 / alpha)` with the predefined color spaces of CSS, e.g. `color(display-p3 1 0 0)`.
 * RGB channels are in [0, 1], XYZ ones any number. Parse-only, gamut-mapped to sRGB.
 */
export const colorFunction: ColorFormat = {
    id: 'color',

    parse(input) {
        const fn = parseFunction(input, ['color'], true);
        if (!fn?.keyword || fn.args.length < 3 || fn.args.length > 4) {
            return null;
        }

        const xyz = fn.keyword.startsWith('xyz');
        const channels = fn.args.slice(0, 3).map(arg => (xyz ? readNumber(arg, 1) : readFraction(arg)));
        const a = readAlpha(fn.args[3]);
        const [c1, c2, c3] = channels;

        if (c1 == null || c2 == null || c3 == null || a === null) {
            return null;
        }

        const rgb = colorSpaceToRgb(fn.keyword, [c1, c2, c3]);
        return rgb && fromWideGamut('color', rgb, a);
    }
};
