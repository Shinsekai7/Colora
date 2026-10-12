import {cmyk, hex, hsl, hsv, oklch, rgb} from '../color/index.js';
import type {OutputFormat} from '../color/index.js';

/** Texts and accessible names used by the picker, see the `labels` property. */
export interface Labels {
    dialog: string;
    toggle: string;
    area: string;
    areaRole: string;
    hue: string;
    alpha: string;
    input: string;
    formats: string;
    swatches: string;
    saved: string;
    save: string;
    cancel: string;
    clear: string;

    /** Close button of the bottom sheet, see the `presentation` attribute. */
    close: string;
}

export const DEFAULT_LABELS: Readonly<Labels> = {
    dialog: 'Color picker',
    toggle: 'Choose color',
    area: 'Saturation and brightness',
    areaRole: '2D slider',
    hue: 'Hue',
    alpha: 'Opacity',
    input: 'Color value',
    formats: 'Color format',
    swatches: 'Swatches',
    saved: 'Revert to previous color',
    save: 'Save',
    cancel: 'Cancel',
    clear: 'Clear',
    close: 'Close'
};

/** Formats that can be referenced by id in the `formats` attribute. */
export const BUILTIN_FORMATS: Readonly<Record<string, OutputFormat>> = {hex, rgb, hsl, hsv, oklch, cmyk};

export const DEFAULT_FORMATS = 'hex rgb hsl';
