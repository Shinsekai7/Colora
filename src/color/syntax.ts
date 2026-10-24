import {mod} from './math.js';

export type Unit = '' | '%' | 'deg' | 'rad' | 'grad' | 'turn';

export interface Arg {
    readonly value: number;
    readonly unit: Unit;
}

export interface FunctionCall {
    readonly name: string;
    readonly args: readonly Arg[];

    /** The leading keyword, if requested, e.g. the color space of `color(display-p3 1 0 0)`. */
    readonly keyword?: string;
}

const FUNCTION = /^([a-z-]+)(?:\s*\(|\s+)([^()]*?)\)?$/;
const ARGUMENT = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%|deg|rad|grad|turn)?$/;
const KEYWORD = /^[a-z][a-z\d-]*$/;

/**
 * Parses a function-like color notation such as `rgb(1 2 3 / 50%)`.
 * Besides CSS syntax this also accepts the more forgiving forms users tend to type,
 * e.g. `rgba(1, 2, 3, 0.5)`, `rgb 1 2 3` or a missing closing parenthesis.
 * Commas, whitespace and slashes are all treated as separators.
 * With `keyword`, the first argument must be a keyword instead of a number.
 */
export function parseFunction(input: string, names: readonly string[], keyword = false): FunctionCall | null {
    const match = FUNCTION.exec(input.trim().toLowerCase());
    if (!match) {
        return null;
    }

    const [, name = '', body = ''] = match;
    if (!names.includes(name) || !body.trim()) {
        return null;
    }

    const tokens = body.trim().split(/[\s,/]+/);
    const first = keyword ? tokens.shift() : undefined;

    if (keyword && !KEYWORD.test(first ?? '')) {
        return null;
    }

    const args: Arg[] = [];
    for (const token of tokens) {
        const arg = ARGUMENT.exec(token);
        if (!arg) {
            return null;
        }

        args.push({value: Number(arg[1]), unit: (arg[2] ?? '') as Unit});
    }

    return first === undefined ? {name, args} : {name, args, keyword: first};
}

/* Argument readers, each returns null if the argument is invalid or out of range. */

const inRange = (value: number, min: number, max: number): number | null =>
    Number.isFinite(value) && value >= min && value <= max ? value : null;

/** Hue in degrees. Values outside of [0, 360] wrap around like they do in CSS. */
export function readHue({value, unit}: Arg): number | null {
    const factors: Partial<Record<Unit, number>> = {'': 1, deg: 1, rad: 180 / Math.PI, grad: 0.9, turn: 360};
    const factor = factors[unit];

    if (factor === undefined || !Number.isFinite(value)) {
        return null;
    }

    const deg = value * factor;
    return deg >= 0 && deg <= 360 ? deg : mod(deg, 360);
}

/** Percentage in [0, 100], the percent sign is optional. */
export function readPercent({value, unit}: Arg): number | null {
    return unit === '' || unit === '%' ? inRange(value, 0, 100) : null;
}

/** A number in [0, max] or a percentage of it, normalized to [0, 1]. */
export function readFraction({value, unit}: Arg, max = 1): number | null {
    if (unit === '%') {
        const percent = inRange(value, 0, 100);
        return percent === null ? null : percent / 100;
    }

    if (unit === '') {
        const number = inRange(value, 0, max);
        return number === null ? null : number / max;
    }

    return null;
}

/** Any finite number, or a percentage of `reference`, e.g. the a and b axes of `lab()`. */
export function readNumber({value, unit}: Arg, reference: number): number | null {
    if (!Number.isFinite(value)) {
        return null;
    }

    return unit === '' ? value : unit === '%' ? (value / 100) * reference : null;
}

/** Optional alpha channel, defaults to 1. */
export function readAlpha(arg: Arg | undefined): number | null {
    return arg === undefined ? 1 : readFraction(arg);
}
