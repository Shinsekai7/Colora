import {createDrag} from './drag.js';
import type {Disposable} from './drag.js';
import {areaKey, NAVIGATION_KEYS, sliderKey} from './keys.js';
import type {Point, StepOptions} from './keys.js';

interface CommonOptions extends StepOptions {
    /**
     * Called once the user is done: on release, and after using the keyboard
     * when the key is released or the element loses focus.
     */
    onCommit?(): void;
}

export interface SliderOptions extends CommonOptions {
    orientation?: 'horizontal' | 'vertical';

    /** Puts 0 at the right / bottom instead of the left / top. */
    reverse?: boolean;

    /** Current value in [0, 1], used for keyboard steps. */
    getValue(): number;

    onInput(value: number): void;
}

export interface AreaOptions extends CommonOptions {
    /** Current position, origin at the top left, used for keyboard steps. */
    getValue(): Point;

    onInput(point: Point): void;
}

/**
 * Handles keyboard input on a focusable element. `handle` returns the next value or null.
 * Commits once the key is released, holding a key down only commits once.
 */
function createKeyboard<T>(
    element: HTMLElement,
    handle: (event: KeyboardEvent) => T | null,
    onInput: (value: T) => void,
    onCommit?: () => void
): Disposable {
    let active = false;

    const commit = () => {
        if (active) {
            active = false;
            onCommit?.();
        }
    };

    const keydown = (event: KeyboardEvent) => {
        const value = handle(event);

        if (value !== null) {
            event.preventDefault(); // Arrow keys and the like would scroll the page otherwise
            active = true;
            onInput(value);
        }
    };

    const keyup = (event: KeyboardEvent) => {
        if (NAVIGATION_KEYS.includes(event.key)) {
            commit();
        }
    };

    element.addEventListener('keydown', keydown);
    element.addEventListener('keyup', keyup);
    element.addEventListener('blur', commit);

    return {
        destroy() {
            element.removeEventListener('keydown', keydown);
            element.removeEventListener('keyup', keyup);
            element.removeEventListener('blur', commit);
        }
    };
}

const combine = (...disposables: Disposable[]): Disposable => ({
    destroy: () => disposables.forEach(d => d.destroy())
});

/** A one-dimensional slider, operated with pointer and keyboard. */
export function createSlider(element: HTMLElement, options: SliderOptions): Disposable {
    const {orientation = 'horizontal', reverse = false, getValue, onInput, onCommit} = options;

    return combine(
        createDrag(element, {
            onMove({x, y}) {
                const position = orientation === 'horizontal' ? x : y;
                onInput(reverse ? 1 - position : position);
            },
            onEnd: onCommit
        }),
        createKeyboard(element, event => sliderKey(event, getValue(), options), onInput, onCommit)
    );
}

/** A two-dimensional area, operated with pointer and keyboard. */
export function createArea(element: HTMLElement, options: AreaOptions): Disposable {
    const {getValue, onInput, onCommit} = options;

    return combine(
        createDrag(element, {onMove: onInput, onEnd: onCommit}),
        createKeyboard(element, event => areaKey(event, getValue(), options), onInput, onCommit)
    );
}
