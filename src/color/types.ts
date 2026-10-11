/**
 * The picker's internal color model.
 * h: hue in degrees [0, 360], s/v: saturation and value in percent [0, 100], a: alpha [0, 1].
 */
export interface HSVA {
    readonly h: number;
    readonly s: number;
    readonly v: number;
    readonly a: number;
}

/**
 * sRGB color with channels in [0, 1].
 */
export interface RGB {
    readonly r: number;
    readonly g: number;
    readonly b: number;
}

/**
 * A component is "powerless" when the input did not define it, e.g. hue for a gray
 * or saturation for black (same term as CSS Color 4). Callers should keep their
 * previous value for those components so sliders don't jump; see `fillPowerless`.
 */
export interface Powerless {
    readonly h: boolean;
    readonly s: boolean;
}

export interface ParsedColor {
    /** Id of the format that matched the input. */
    readonly format: string;
    readonly color: HSVA;
    readonly powerless: Powerless;
}

export interface StringifyOptions {
    /** Decimal places for channel values. Defaults to 0. */
    readonly precision?: number;

    /** Emit the legacy comma syntax of CSS with an explicit alpha, e.g. `rgba(1, 2, 3, 1)`. Applies to rgb, hsl and hsv. */
    readonly legacy?: boolean;
}

export interface ColorFormat {
    readonly id: string;
    parse(input: string): ParsedColor | null;
    stringify?(color: HSVA, options?: StringifyOptions): string;
}

/** A format colors can also be displayed in. */
export interface OutputFormat extends ColorFormat {
    stringify(color: HSVA, options?: StringifyOptions): string;
}
