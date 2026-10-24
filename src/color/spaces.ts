import {fromLinear} from './convert.js';
import type {RGB} from './types.js';

/*
 * The other color spaces of CSS, converted to sRGB for parsing.
 * Results may be outside of [0, 1], see `mapToSrgb`. Matrices and transfer functions are from
 * https://www.w3.org/TR/css-color-4/#color-conversion-code
 */

type Vector = readonly [number, number, number];
type Matrix = readonly [Vector, Vector, Vector];

const multiply = (m: Matrix, [x, y, z]: Vector): Vector =>
    m.map(([a, b, c]) => a * x + b * y + c * z) as unknown as Vector;

const XYZ_D65_TO_LINEAR_SRGB: Matrix = [
    [12831 / 3959, -329 / 214, -1974 / 3959],
    [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
    [705 / 12673, -2585 / 12673, 705 / 667]
];

/** Bradford chromatic adaptation. */
const D50_TO_D65: Matrix = [
    [0.955473421488075, -0.02309845494876471, 0.06325924320057072],
    [-0.0283697093338637, 1.0099953980813041, 0.021041441191917323],
    [0.012314014864481998, -0.020507649298898964, 1.330365926242124]
];

const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

/** XYZ with a D65 white point to sRGB. */
export function xyzToRgb(xyz: Vector): RGB {
    const [r, g, b] = multiply(XYZ_D65_TO_LINEAR_SRGB, xyz).map(fromLinear) as unknown as Vector;
    return {r, g, b};
}

export const xyzD50ToRgb = (xyz: Vector): RGB => xyzToRgb(multiply(D50_TO_D65, xyz));

/** CIE Lab (D50), lightness in [0, 100]. */
export function labToRgb([l, a, b]: Vector): RGB {
    const EPSILON = 216 / 24389;
    const KAPPA = 24389 / 27;

    const fy = (l + 16) / 116;
    const fx = a / 500 + fy;
    const fz = fy - b / 200;
    const fromF = (f: number) => (f ** 3 > EPSILON ? f ** 3 : (116 * f - 16) / KAPPA);

    const [wx, wy, wz] = D50_WHITE;
    return xyzD50ToRgb([fromF(fx) * wx, (l > KAPPA * EPSILON ? fy ** 3 : l / KAPPA) * wy, fromF(fz) * wz]);
}

interface RgbSpace {
    toLinear(c: number): number;
    toXyz: Matrix;
    d50?: boolean;
}

const signed = (c: number, fn: (abs: number) => number) => Math.sign(c) * fn(Math.abs(c));

/** RGB spaces of `color()`, sRGB is handled separately. */
const RGB_SPACES: Readonly<Record<string, RgbSpace>> = {
    'display-p3': {
        toLinear: c => signed(c, abs => (abs <= 0.04045 ? abs / 12.92 : ((abs + 0.055) / 1.055) ** 2.4)),
        toXyz: [
            [608311 / 1250200, 189793 / 714400, 198249 / 1000160],
            [35783 / 156275, 247089 / 357200, 198249 / 2500400],
            [0, 32229 / 714400, 5220557 / 5000800]
        ]
    },
    'a98-rgb': {
        toLinear: c => signed(c, abs => abs ** (563 / 256)),
        toXyz: [
            [573536 / 994567, 263643 / 1420810, 187206 / 994567],
            [591459 / 1989134, 6239551 / 9945670, 374412 / 4972835],
            [53769 / 1989134, 351524 / 4972835, 4929758 / 4972835]
        ]
    },
    'prophoto-rgb': {
        toLinear: c => signed(c, abs => (abs <= 16 / 512 ? abs / 16 : abs ** 1.8)),
        toXyz: [
            [0.7977666449006423, 0.13518129740053308, 0.0313477341283922],
            [0.2880748288194013, 0.711835234241873, 0.00008993693872564],
            [0, 0, 0.8251046025104602]
        ],
        d50: true
    },
    rec2020: {
        toLinear: c => signed(c, abs => {
            const ALPHA = 1.09929682680944;
            const BETA = 0.018053968510807;
            return abs < BETA * 4.5 ? abs / 4.5 : ((abs + ALPHA - 1) / ALPHA) ** (1 / 0.45);
        }),
        toXyz: [
            [63426534 / 99577255, 20160776 / 139408157, 47086771 / 278816314],
            [26158966 / 99577255, 472592308 / 697040785, 8267143 / 139408157],
            [0, 19567812 / 697040785, 295819943 / 278816314]
        ]
    }
};

/** Converts the channels of `color(space r g b)` to sRGB, returns null for unknown spaces. */
export function colorSpaceToRgb(space: string, channels: Vector): RGB | null {
    const [r, g, b] = channels;

    switch (space) {
        case 'srgb':
            return {r, g, b};
        case 'srgb-linear':
            return {r: fromLinear(r), g: fromLinear(g), b: fromLinear(b)};
        case 'xyz':
        case 'xyz-d65':
            return xyzToRgb(channels);
        case 'xyz-d50':
            return xyzD50ToRgb(channels);
    }

    const rgbSpace = Object.hasOwn(RGB_SPACES, space) ? RGB_SPACES[space] : undefined;
    if (!rgbSpace) {
        return null;
    }

    const xyz = multiply(rgbSpace.toXyz, channels.map(rgbSpace.toLinear) as unknown as Vector);
    return rgbSpace.d50 ? xyzD50ToRgb(xyz) : xyzToRgb(xyz);
}
