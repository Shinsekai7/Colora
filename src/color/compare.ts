import {hex} from './formats/hex.js';
import type {HSVA} from './types.js';

/**
 * True if both colors look the same, i.e. have the same 8-bit RGBA value.
 * Different HSV values can describe the same color, e.g. any hue with zero saturation.
 */
export const sameColor = (a: HSVA, b: HSVA): boolean => hex.stringify(a) === hex.stringify(b);
