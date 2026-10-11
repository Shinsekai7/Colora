import type {ColorFormat, HSVA, OutputFormat, StringifyOptions} from '../color/index.js';
import type {Listener} from './emitter.js';

export type {OutputFormat};

/** A color string or an HSVA object, alpha defaults to 1. */
export type ColorInput = string | { h: number; s: number; v: number; a?: number };

/** Which part of the UI changed the color. */
export type ChangeSource = 'slider' | 'text' | 'swatch';

export interface PickerOptions {
    /** Initial color, `null` starts without a saved color. Defaults to `#42445A`. */
    color?: ColorInput | null;

    /** Formats the user can switch between. Defaults to hex, rgb, hsl and oklch. */
    formats?: readonly OutputFormat[];

    /** Id of the initial format. Defaults to the format of `color` if available, otherwise the first one. */
    format?: string;

    /** Formats accepted as input. Defaults to all standard formats plus everything in `formats`. */
    parsers?: readonly ColorFormat[];

    swatches?: readonly ColorInput[];

    /** Keeps the alpha channel at 1, colors with transparency are rejected. */
    lockOpacity?: boolean;

    /** Used for the text representation of colors. */
    stringify?: StringifyOptions;

    disabled?: boolean;
    open?: boolean;
}

export interface PickerState {
    /** The color currently being edited. */
    readonly color: HSVA;

    /** The last saved color, `null` if cleared. */
    readonly saved: HSVA | null;

    /** Id of the selected output format. */
    readonly format: string;

    /**
     * Content of the text field. Follows the color, except while the user is typing:
     * then it holds exactly what they typed until `commitText` is called.
     */
    readonly text: string;

    /** False while `text` is not a valid color. */
    readonly textValid: boolean;

    readonly swatches: readonly HSVA[];
    readonly open: boolean;
    readonly disabled: boolean;
}

export interface PickerEvents {
    /** The color is being changed by the user. */
    change: { color: HSVA; source: ChangeSource };

    /** The user finished changing the color, e.g. released a slider or left the text field. */
    changeend: { color: HSVA; source: ChangeSource };

    /** The color has been saved, `null` if it was cleared. */
    save: { color: HSVA | null };

    clear: void;

    /** The user reverted to the saved color. */
    cancel: { color: HSVA };

    open: void;
    close: void;
}

export interface Picker {
    getState(): PickerState;

    /** Called after every state change, meant for rendering. Returns a function to unsubscribe. */
    subscribe(listener: (state: PickerState, previous: PickerState) => void): () => void;

    /** Listens to user-facing events. Returns a function to remove the listener. */
    on<K extends keyof PickerEvents>(type: K, listener: Listener<PickerEvents[K]>): () => void;
    off<K extends keyof PickerEvents>(type: K, listener: Listener<PickerEvents[K]>): void;

    /**
     * Sets the color, like setting `input.value` this doesn't emit any events.
     * `null` clears the saved color. Returns false if the color is invalid.
     * @param options.save Also update the saved color, true by default.
     */
    setColor(color: ColorInput | null, options?: { save?: boolean }): boolean;

    /** Changes individual components, e.g. from a slider. Out-of-range values are clamped. */
    adjust(changes: Partial<HSVA>): void;

    /** Ends a series of `adjust` calls, e.g. when a slider is released. */
    adjustEnd(): void;

    /** Updates the text field. Returns false if the text is not a valid color (yet). */
    inputText(text: string): boolean;

    /** The user left the text field: the text is reformatted to match the color. */
    commitText(): void;

    selectSwatch(index: number): boolean;
    addSwatch(color: ColorInput): boolean;
    removeSwatch(index: number): boolean;

    /** Changes the output format. Returns false if there's no format with the given id. */
    setFormat(id: string): boolean;

    save(): void;

    /** Reverts the color to the saved one. */
    cancel(): void;

    /** Clears the saved color. */
    clear(): void;

    open(): boolean;
    close(): boolean;
    toggle(): boolean;

    /** A disabled picker can't be opened and ignores user actions, `setColor` still works. */
    setDisabled(disabled: boolean): void;

    /** Stringifies a color, by default the current one in the selected format. */
    formatColor(color?: HSVA, format?: string): string;

    /** Removes all listeners. */
    destroy(): void;
}
