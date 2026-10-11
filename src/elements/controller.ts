import {sameColor} from '../color/index.js';
import type {HSVA, OutputFormat} from '../color/index.js';
import {createPicker, DEFAULT_COLOR} from '../state/index.js';
import type {ColorInput, Picker, PickerState} from '../state/index.js';
import {parseList} from './attributes.js';
import {BUILTIN_FORMATS, DEFAULT_FORMATS} from './labels.js';

/** Resolves ids of built-in formats, unknown ones are skipped. Falls back to the default formats. */
export function resolveFormats(list: readonly (string | OutputFormat)[]): OutputFormat[] {
    const formats = list
        .map(format => (typeof format === 'string' ? BUILTIN_FORMATS[format.toLowerCase()] : format))
        .filter((format): format is OutputFormat => !!format);

    return formats.length ? formats : resolveFormats(parseList(DEFAULT_FORMATS));
}

export interface ControllerConfig {
    formats: readonly OutputFormat[];

    /** Requested format id, ignored if not available. */
    format: string | null;

    /** Initial color, invalid ones fall back to the default. */
    value: string | null;

    /** Invalid ones are skipped. */
    swatches: readonly ColorInput[];

    lockOpacity: boolean;
    disabled: boolean;
}

/**
 * Creates the controller for the element's configuration. Never throws, invalid values are ignored.
 * When re-created because the configuration changed, the current and saved color and the format are kept.
 */
export function createController(config: ControllerConfig, previous?: PickerState): Picker {
    const {formats, lockOpacity} = config;
    const requestedFormat = previous?.format ?? config.format?.toLowerCase();

    const options = {
        formats,
        format: formats.some(f => f.id === requestedFormat) ? requestedFormat : undefined,
        lockOpacity,
        disabled: config.disabled
    };

    const opaque = (color: HSVA | null) => color && lockOpacity ? {...color, a: 1} : color;
    const initial = previous ? opaque(previous.saved) : config.value ?? DEFAULT_COLOR;

    let picker: Picker;
    try {
        picker = createPicker({...options, color: initial});
    } catch {
        picker = createPicker({...options, color: DEFAULT_COLOR});
    }

    if (previous && !sameColor(previous.color, picker.getState().color)) {
        picker.setColor(opaque(previous.color) as HSVA, {save: false});
    }

    for (const swatch of config.swatches) {
        picker.addSwatch(swatch);
    }

    return picker;
}
