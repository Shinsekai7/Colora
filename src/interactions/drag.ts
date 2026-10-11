import {clamp} from '../color/math.js';
import type {Point} from './keys.js';

export interface DragOptions {
    /** Called with the pointer position relative to the element, in [0, 1]. Also called on press. */
    onMove(point: Point): void;

    /** Called once the pointer is released or the drag gets interrupted. */
    onEnd?(): void;
}

export interface Disposable {
    destroy(): void;
}

/**
 * Lets the user drag within an element using mouse, touch or pen.
 * Uses pointer capture, so the pointer is tracked even outside the element or window.
 */
export function createDrag(element: HTMLElement, {onMove, onEnd}: DragOptions): Disposable {
    let pointerId: number | null = null;

    const positionOf = (event: PointerEvent): Point => {
        const {left, top, width, height} = element.getBoundingClientRect();

        return {
            x: width ? clamp((event.clientX - left) / width) : 0,
            y: height ? clamp((event.clientY - top) / height) : 0
        };
    };

    const down = (event: PointerEvent) => {
        // Ignore additional fingers and anything but the primary mouse button
        if (pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
            return;
        }

        // Prevents text selection, which also prevents focusing, so that's done manually
        event.preventDefault();
        element.focus({preventScroll: true});

        pointerId = event.pointerId;
        element.setPointerCapture(pointerId);
        onMove(positionOf(event));
    };

    const move = (event: PointerEvent) => {
        if (event.pointerId === pointerId) {
            onMove(positionOf(event));
        }
    };

    const end = (event: PointerEvent) => {
        if (event.pointerId === pointerId) {
            pointerId = null;
            onEnd?.();
        }
    };

    // Without this, touch devices would scroll the page instead
    const previousTouchAction = element.style.touchAction;
    element.style.touchAction = 'none';

    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
    element.addEventListener('lostpointercapture', end);

    return {
        destroy() {
            element.removeEventListener('pointerdown', down);
            element.removeEventListener('pointermove', move);
            element.removeEventListener('pointerup', end);
            element.removeEventListener('pointercancel', end);
            element.removeEventListener('lostpointercapture', end);
            element.style.touchAction = previousTouchAction;

            if (pointerId !== null && element.hasPointerCapture(pointerId)) {
                element.releasePointerCapture(pointerId);
            }

            pointerId = null;
        }
    };
}
