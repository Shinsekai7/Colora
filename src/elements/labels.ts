import {cmyk, hex, hsl, hsv, nameColor, oklch, rgb} from '../color/index.js';
import type {HSVA, OutputFormat} from '../color/index.js';

/** Texts and accessible names used by the picker, see the `i18n` property. */
export interface Labels {
    dialog: string;
    toggle: string;
    area: string;
    areaRole: string;

    /** The color area's axes, announced with its value. */
    saturation: string;
    brightness: string;

    hue: string;
    alpha: string;
    input: string;
    formats: string;
    swatches: string;
    saved: string;
    copy: string;

    /** Announced after copying. */
    copied: string;

    eyeDropper: string;
    save: string;
    cancel: string;
    clear: string;

    /** Close button of the bottom sheet, see the `presentation` attribute. */
    close: string;

    /** Names a color for screen readers, e.g. "dark blue". Announced by the color area, the hue slider and the swatches. */
    colorName: (color: HSVA) => string;
}

export const DEFAULT_LABELS: Readonly<Labels> = {
    dialog: 'Color picker',
    toggle: 'Choose color',
    area: 'Saturation and brightness',
    areaRole: '2D slider',
    saturation: 'Saturation',
    brightness: 'Brightness',
    hue: 'Hue',
    alpha: 'Opacity',
    input: 'Color value',
    formats: 'Color format',
    swatches: 'Swatches',
    saved: 'Revert to previous color',
    copy: 'Copy color',
    copied: 'Copied',
    eyeDropper: 'Pick a color from the screen',
    save: 'Save',
    cancel: 'Cancel',
    clear: 'Clear',
    close: 'Close',
    colorName: nameColor
};

/** Formats that can be referenced by id in the `formats` attribute. */
export const BUILTIN_FORMATS: Readonly<Record<string, OutputFormat>> = {hex, rgb, hsl, hsv, oklch, cmyk};

export const DEFAULT_FORMATS = 'hex rgb hsl';
