import {clamp} from '../color/math.js';
import {defaultFormats, fillPowerless, hex, hsl, normalizeHsva, oklch, parseColor, rgb} from '../color/index.js';
import type {ColorFormat, HSVA} from '../color/index.js';
import {callSafely, createEmitter} from './emitter.js';
import type {ChangeSource, ColorInput, OutputFormat, Picker, PickerEvents, PickerOptions, PickerState} from './types.js';

export const DEFAULT_COLOR = '#42445A';
export const DEFAULT_OUTPUT_FORMATS: readonly OutputFormat[] = [hex, rgb, hsl, oklch];

const BLACK: HSVA = {h: 0, s: 0, v: 0, a: 1};
const RANGES = {h: 360, s: 100, v: 100, a: 1} as const;

const sameHsva = (a: HSVA, b: HSVA) => a.h === b.h && a.s === b.s && a.v === b.v && a.a === b.a;

/**
 * Takes hue (and saturation for black) from the previous color if the next one doesn't have any,
 * so the sliders don't jump when e.g. a gray swatch is selected.
 */
const keepHue = (next: HSVA, previous: HSVA): HSVA => {
    if (next.v === 0) {
        return {...next, h: previous.h, s: previous.s};
    }

    return next.s === 0 ? {...next, h: previous.h} : next;
};

export function createPicker(options: PickerOptions = {}): Picker {
    const formats = options.formats ?? DEFAULT_OUTPUT_FORMATS;
    const parsers: readonly ColorFormat[] =
        options.parsers ?? [...defaultFormats, ...formats.filter(f => !defaultFormats.includes(f))];
    const lockOpacity = options.lockOpacity ?? false;
    const stringifyOptions = options.stringify ?? {};

    if (!formats.length) {
        throw new Error('At least one output format is required.');
    }

    const findFormat = (id: string | undefined) => formats.find(f => f.id === id);

    const stringify = (color: HSVA, formatId: string) => {
        const format = findFormat(formatId);

        if (!format) {
            throw new Error(`Unknown format "${formatId}".`);
        }

        return format.stringify(color, stringifyOptions);
    };

    /** Validates a color, undefined components of strings are taken from `previous`. */
    const resolve = (input: ColorInput, previous: HSVA): { color: HSVA; format?: string } | null => {
        let color: HSVA | null = null;
        let format: string | undefined;

        if (typeof input === 'string') {
            const parsed = parseColor(input, parsers);

            if (parsed) {
                color = fillPowerless(parsed, previous);
                format = parsed.format;
            }
        } else if (input && typeof input === 'object') {
            color = normalizeHsva(input);
        }

        return color && !(lockOpacity && color.a !== 1) ? {color, format} : null;
    };

    const resolveOrThrow = (input: ColorInput, what: string) => {
        const resolved = resolve(input, BLACK);

        if (!resolved) {
            throw new Error(`Invalid ${what}: ${JSON.stringify(input)}.`);
        }

        return resolved;
    };

    /* Initial state */

    const initial = options.color === null ? null : resolveOrThrow(options.color ?? DEFAULT_COLOR, 'color');
    const initialColor = initial?.color ?? resolveOrThrow(DEFAULT_COLOR, 'color').color;

    if (options.format !== undefined && !findFormat(options.format)) {
        throw new Error(`Unknown format "${options.format}".`);
    }

    const initialFormat = options.format ?? findFormat(initial?.format)?.id ?? (formats[0] as OutputFormat).id;
    const disabled = options.disabled ?? false;

    let state: PickerState = {
        color: initialColor,
        saved: initial?.color ?? null,
        format: initialFormat,
        text: stringify(initialColor, initialFormat),
        textValid: true,
        swatches: (options.swatches ?? []).map(swatch => resolveOrThrow(swatch, 'swatch').color),
        open: !disabled && (options.open ?? false),
        disabled
    };

    const subscribers = new Set<(state: PickerState, previous: PickerState) => void>();
    const events = createEmitter<PickerEvents>();

    /** Source of the last change that didn't get its `changeend` yet. */
    let pending: ChangeSource | null = null;

    const update = (patch: Partial<PickerState>) => {
        const keys = Object.keys(patch) as (keyof PickerState)[];

        if (keys.every(key => Object.is(patch[key], state[key]))) {
            return;
        }

        const previous = state;
        state = {...state, ...patch};

        for (const subscriber of [...subscribers]) {
            callSafely(() => subscriber(state, previous), undefined);
        }
    };

    /** Patch for a new current color, the text follows it. */
    const withColor = (color: HSVA): Partial<PickerState> & { color: HSVA } => ({
        color,
        text: stringify(color, state.format),
        textValid: true
    });

    const endChange = () => {
        if (pending) {
            const source = pending;
            pending = null;
            events.emit('changeend', {color: state.color, source});
        }
    };

    const change = (patch: Partial<PickerState> & { color: HSVA }, source: ChangeSource) => {
        if (pending !== source) {
            endChange();
        }

        update(patch);
        pending = source;
        events.emit('change', {color: state.color, source});
    };

    const picker: Picker = {
        getState: () => state,

        subscribe(listener) {
            subscribers.add(listener);
            return () => subscribers.delete(listener);
        },

        on: events.on,
        off: events.off,

        setColor(input, {save = true} = {}) {
            if (input === null) {
                update({saved: null});
                return true;
            }

            const resolved = resolve(input, state.color);
            if (!resolved) {
                return false;
            }

            const {color} = resolved;
            const keepSaved = !save || (state.saved && sameHsva(color, state.saved));

            update({
                ...(sameHsva(color, state.color) ? {} : withColor(color)),
                saved: keepSaved ? state.saved : color
            });

            return true;
        },

        adjust(changes) {
            if (state.disabled) {
                return;
            }

            const next = {...state.color};
            for (const key of ['h', 's', 'v', 'a'] as const) {
                const value = changes[key];

                if (value !== undefined && Number.isFinite(value) && !(key === 'a' && lockOpacity)) {
                    next[key] = clamp(value, 0, RANGES[key]);
                }
            }

            if (!sameHsva(next, state.color)) {
                change(withColor(next), 'slider');
            }
        },

        adjustEnd() {
            if (pending === 'slider') {
                endChange();
            }
        },

        inputText(text) {
            if (state.disabled) {
                return false;
            }

            const resolved = resolve(text, state.color);
            if (!resolved) {
                update({text, textValid: false});
                return false;
            }

            // Switch to the format the user typed in, if available
            const format = findFormat(resolved.format)?.id ?? state.format;
            const patch = {text, textValid: true, format};

            if (sameHsva(resolved.color, state.color)) {
                update(patch);
            } else {
                change({...patch, color: resolved.color}, 'text');
            }

            return true;
        },

        commitText() {
            update({text: stringify(state.color, state.format), textValid: true});

            if (pending === 'text') {
                endChange();
            }
        },

        selectSwatch(index) {
            const swatch = state.swatches[index];

            if (state.disabled || !swatch) {
                return false;
            }

            const color = keepHue(swatch, state.color);
            if (!sameHsva(color, state.color)) {
                change(withColor(color), 'swatch');
                endChange();
            }

            return true;
        },

        addSwatch(input) {
            const resolved = resolve(input, BLACK);

            if (resolved) {
                update({swatches: [...state.swatches, resolved.color]});
            }

            return !!resolved;
        },

        removeSwatch(index) {
            if (!(index in state.swatches)) {
                return false;
            }

            update({swatches: state.swatches.filter((_, i) => i !== index)});
            return true;
        },

        setFormat(id) {
            if (!findFormat(id)) {
                return false;
            }

            update({format: id, text: stringify(state.color, id), textValid: true});
            return true;
        },

        save() {
            if (!state.disabled) {
                update({saved: state.color});
                events.emit('save', {color: state.color});
            }
        },

        cancel() {
            if (state.disabled) {
                return;
            }

            const color = state.saved ?? state.color;
            if (!sameHsva(color, state.color)) {
                update(withColor(color));
            }

            events.emit('cancel', {color});
        },

        clear() {
            if (!state.disabled) {
                update({saved: null});
                events.emit('save', {color: null});
                events.emit('clear', undefined);
            }
        },

        open() {
            if (state.disabled || state.open) {
                return false;
            }

            update({open: true});
            events.emit('open', undefined);
            return true;
        },

        close() {
            if (!state.open) {
                return false;
            }

            update({open: false});
            events.emit('close', undefined);
            return true;
        },

        toggle: () => (state.open ? picker.close() : picker.open()),

        setDisabled(value) {
            if (value) {
                picker.close();
            }

            update({disabled: value});
        },

        formatColor: (color = state.color, format = state.format) => stringify(color, format),

        destroy() {
            subscribers.clear();
            events.clear();
        }
    };

    return picker;
}
