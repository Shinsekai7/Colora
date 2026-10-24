import {hsvToRgb, rgbToOklch} from './convert.js';
import type {HSVA} from './types.js';

/** Where each hue ends in OKLCH, in degrees. Pink also covers the reds below 10°. */
const HUES: readonly (readonly [number, string])[] = [
    [10, 'pink'],
    [40, 'red'],
    [80, 'orange'],
    [120, 'yellow'],
    [170, 'green'],
    [225, 'cyan'],
    [290, 'blue'],
    [320, 'purple'],
    [345, 'magenta'],
    [360, 'pink']
];

/** Chroma below this reads as gray. */
const GRAY_CHROMA = 0.03;

/** Chroma below this reads as muted, e.g. "grayish blue". */
const MUTED_CHROMA = 0.08;

/**
 * Describes a color in plain English for screen readers, e.g. "dark grayish blue".
 * Based on OKLCH, so the names follow how light and colorful a color looks. Ignores alpha.
 */
export function nameColor(color: HSVA): string {
    const {l, c, h} = rgbToOklch(hsvToRgb(color));

    if (c < GRAY_CHROMA) {
        if (l < 0.15) {
            return 'black';
        }

        if (l > 0.97) {
            return 'white';
        }

        return l < 0.45 ? 'dark gray' : l < 0.75 ? 'gray' : 'light gray';
    }

    let hue = HUES.find(([end]) => h < end)?.[1] ?? 'pink';

    // Dark oranges and yellows look like different colors
    if (l < 0.6 && h >= 40 && h < 100) {
        hue = 'brown';
    } else if (l < 0.65 && h >= 100 && h < 120) {
        hue = 'olive';
    }

    // Saturated yellows and greens are light by nature, only pale ones are called light
    const light = l > 0.85 && c < 0.15;
    const shade = l < 0.45 ? 'dark ' : light ? 'light ' : '';
    const tone = c < MUTED_CHROMA && !light ? 'grayish ' : '';
    return `${shade}${tone}${hue}`;
}
