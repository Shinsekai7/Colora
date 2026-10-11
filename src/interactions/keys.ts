import {clamp} from '../color/math.js';

export interface Point {
    readonly x: number;
    readonly y: number;
}

export interface StepOptions {
    /** Step size for arrow keys, defaults to 1%. */
    step?: number;

    /** Step size for Page Up / Down and Shift + arrow keys, defaults to 10%. */
    largeStep?: number;
}

type KeyInput = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>;

/** All keys handled by `sliderKey` and `areaKey`. */
export const NAVIGATION_KEYS: readonly string[] = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'
];

// Keeps repeated steps from accumulating floating point errors, e.g. 0.07 + 0.01
const tidy = (value: number) => clamp(Math.round(value * 1e9) / 1e9);

const stepsOf = (event: KeyInput, {step = 0.01, largeStep = 0.1}: StepOptions) => ({
    small: event.shiftKey ? largeStep : step,
    large: largeStep
});

/** Shortcuts like Alt + Arrow (history navigation) are left to the browser. */
const isShortcut = (event: KeyInput) => event.altKey || event.ctrlKey || event.metaKey;

/**
 * Next value of a slider in [0, 1] for a key press, null if the key isn't handled.
 * Follows the ARIA slider pattern: Up / Right increase the value, Down / Left decrease it.
 */
export function sliderKey(event: KeyInput, value: number, options: StepOptions = {}): number | null {
    if (isShortcut(event)) {
        return null;
    }

    const {small, large} = stepsOf(event, options);

    switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
            return tidy(value + small);
        case 'ArrowDown':
        case 'ArrowLeft':
            return tidy(value - small);
        case 'PageUp':
            return tidy(value + large);
        case 'PageDown':
            return tidy(value - large);
        case 'Home':
            return 0;
        case 'End':
            return 1;
        default:
            return null;
    }
}

/**
 * Next position in a 2D area for a key press, null if the key isn't handled.
 * Coordinates are in [0, 1] with the origin at the top left, arrow keys move in their direction.
 * Home / End jump to the left / right edge, Page Up / Down move vertically in large steps.
 */
export function areaKey(event: KeyInput, {x, y}: Point, options: StepOptions = {}): Point | null {
    if (isShortcut(event)) {
        return null;
    }

    const {small, large} = stepsOf(event, options);

    switch (event.key) {
        case 'ArrowUp':
            return {x, y: tidy(y - small)};
        case 'ArrowDown':
            return {x, y: tidy(y + small)};
        case 'ArrowLeft':
            return {x: tidy(x - small), y};
        case 'ArrowRight':
            return {x: tidy(x + small), y};
        case 'PageUp':
            return {x, y: tidy(y - large)};
        case 'PageDown':
            return {x, y: tidy(y + large)};
        case 'Home':
            return {x: 0, y};
        case 'End':
            return {x: 1, y};
        default:
            return null;
    }
}
