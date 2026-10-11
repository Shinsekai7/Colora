import {clamp, mod} from './math.js';
import type {RGB} from './types.js';

/** Channel differences below this are treated as floating point noise. */
const EPSILON = 1e-9;

export interface HSV {
    h: number;
    s: number;
    v: number;
}

export interface HSL {
    h: number;
    s: number;
    l: number;
}

export interface CMYK {
    c: number;
    m: number;
    y: number;
    k: number;
}

export interface OKLCH {
    /** Lightness in [0, 1]. */
    l: number;
    c: number;
    h: number;
}

interface OKLab {
    l: number;
    a: number;
    b: number;
}

/* HSV (h in degrees, s/v in percent) <-> sRGB */

export function hsvToRgb({h, s, v}: HSV): RGB {
    const sat = s / 100;
    const val = v / 100;
    const channel = (n: number) => {
        const k = mod(n + h / 60, 6);
        return val - val * sat * clamp(Math.min(k, 4 - k), 0, 1);
    };

    return {r: channel(5), g: channel(3), b: channel(1)};
}

export function rgbToHsv({r, g, b}: RGB): HSV {
    const max = Math.max(r, g, b);
    const delta = max - Math.min(r, g, b);

    if (max < EPSILON) {
        return {h: 0, s: 0, v: 0};
    }

    if (delta < EPSILON) {
        return {h: 0, s: 0, v: max * 100};
    }

    let h: number;
    if (max === r) {
        h = mod((g - b) / delta, 6);
    } else if (max === g) {
        h = (b - r) / delta + 2;
    } else {
        h = (r - g) / delta + 4;
    }

    return {h: h * 60, s: (delta / max) * 100, v: max * 100};
}

/* HSV <-> HSL (h in degrees, s/v/l in percent) */

export function hsvToHsl({h, s, v}: HSV): HSL {
    const sat = s / 100;
    const val = v / 100;
    const l = val * (1 - sat / 2);
    const sl = l < EPSILON || l > 1 - EPSILON ? 0 : (val - l) / Math.min(l, 1 - l);
    return {h, s: sl * 100, l: l * 100};
}

export function hslToHsv({h, s, l}: HSL): HSV {
    const sat = s / 100;
    const lig = l / 100;
    const v = lig + sat * Math.min(lig, 1 - lig);
    const sv = v < EPSILON ? 0 : 2 * (1 - lig / v);
    return {h, s: sv * 100, v: v * 100};
}

/* sRGB <-> CMYK (naive conversion without color profile, all channels in percent) */

export function rgbToCmyk({r, g, b}: RGB): CMYK {
    const k = 1 - Math.max(r, g, b);

    if (k > 1 - EPSILON) {
        return {c: 0, m: 0, y: 0, k: 100};
    }

    return {
        c: ((1 - r - k) / (1 - k)) * 100,
        m: ((1 - g - k) / (1 - k)) * 100,
        y: ((1 - b - k) / (1 - k)) * 100,
        k: k * 100
    };
}

export function cmykToRgb({c, m, y, k}: CMYK): RGB {
    const key = 1 - k / 100;
    return {
        r: (1 - c / 100) * key,
        g: (1 - m / 100) * key,
        b: (1 - y / 100) * key
    };
}

/* sRGB <-> OKLCH, see https://bottosson.github.io/posts/oklab/ */

const toLinear = (c: number) => {
    const abs = Math.abs(c);
    return abs <= 0.04045 ? c / 12.92 : Math.sign(c) * ((abs + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (c: number) => {
    const abs = Math.abs(c);
    return abs <= 0.0031308 ? c * 12.92 : Math.sign(c) * (1.055 * abs ** (1 / 2.4) - 0.055);
};

function rgbToOklab({r, g, b}: RGB): OKLab {
    const lr = toLinear(r);
    const lg = toLinear(g);
    const lb = toLinear(b);

    const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
    const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
    const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

    return {
        l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
}

function oklabToRgb({l: L, a, b: B}: OKLab): RGB {
    const l = (L + 0.3963377774 * a + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * B) ** 3;

    return {
        r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
        g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
        b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
    };
}

const oklchToOklab = ({l, c, h}: OKLCH): OKLab => ({
    l,
    a: c * Math.cos((h * Math.PI) / 180),
    b: c * Math.sin((h * Math.PI) / 180)
});

/** Chroma below this is treated as gray, its hue is meaningless. */
const ACHROMATIC_CHROMA = 1e-6;

export function rgbToOklch(rgb: RGB): OKLCH {
    const {l, a, b} = rgbToOklab(rgb);
    const c = Math.hypot(a, b);

    return c < ACHROMATIC_CHROMA ?
        {l, c: 0, h: 0} :
        {l, c, h: mod((Math.atan2(b, a) * 180) / Math.PI, 360)};
}

const deltaEOK = (x: OKLab, y: OKLab) => Math.hypot(x.l - y.l, x.a - y.a, x.b - y.b);

const inGamut = ({r, g, b}: RGB) =>
    r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1;

const clipRgb = ({r, g, b}: RGB): RGB => ({r: clamp(r), g: clamp(g), b: clamp(b)});

/**
 * Converts OKLCH to sRGB, mapping out-of-gamut colors into the sRGB gamut by
 * reducing chroma, as specified by CSS Color 4.
 * See https://www.w3.org/TR/css-color-4/#gamut-mapping
 */
export function oklchToRgb(origin: OKLCH): RGB {
    if (origin.l >= 1) {
        return {r: 1, g: 1, b: 1};
    }

    if (origin.l <= 0) {
        return {r: 0, g: 0, b: 0};
    }

    const rgb = oklabToRgb(oklchToOklab(origin));
    if (inGamut(rgb)) {
        return rgb;
    }

    const JND = 0.02;
    const EPS = 0.0001;

    let clipped = clipRgb(rgb);
    if (deltaEOK(rgbToOklab(clipped), oklchToOklab(origin)) < JND) {
        return clipped;
    }

    let min = 0;
    let max = origin.c;
    let minInGamut = true;

    while (max - min > EPS) {
        const chroma = (min + max) / 2;
        const current = oklchToOklab({...origin, c: chroma});
        const currentRgb = oklabToRgb(current);

        if (minInGamut && inGamut(currentRgb)) {
            min = chroma;
            continue;
        }

        clipped = clipRgb(currentRgb);
        const e = deltaEOK(rgbToOklab(clipped), current);

        if (e < JND) {
            if (JND - e < EPS) {
                return clipped;
            }

            minInGamut = false;
            min = chroma;
        } else {
            max = chroma;
        }
    }

    return clipped;
}
