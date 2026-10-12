import {afterEach, describe, expect, it, vi} from 'vitest';
import {commands, userEvent} from 'vitest/browser';
import {createPicker} from '../../src/state/index.js';
import {createArea, createSlider} from '../../src/interactions/controls.js';
import {createDrag} from '../../src/interactions/drag.js';
import type {Point} from '../../src/interactions/keys.js';

// Every fixture is 200 x 100 px with its top left corner at (50, 50)
const LEFT = 50;
const TOP = 50;

const fixture = () => {
    const element = document.createElement('div');
    element.tabIndex = 0;
    element.style.cssText = `position: fixed; left: ${LEFT}px; top: ${TOP}px; width: 200px; height: 100px`;
    document.body.append(element);
    return element;
};

/** Client coordinates for a relative position within the fixture. */
const at = (x: number, y: number): [number, number] => [LEFT + x * 200, TOP + y * 100];

const press = (x: number, y: number) => commands.mouse('down', ...at(x, y));
const move = (x: number, y: number) => commands.mouse('move', ...at(x, y));
const release = (x: number, y: number) => commands.mouse('up', ...at(x, y));

afterEach(async () => {
    await commands.mouse('up', 0, 0);
    document.body.replaceChildren();
});

describe('createDrag', () => {
    it('reports the position on press, move and release', async () => {
        const element = fixture();
        const points: Point[] = [];
        const onEnd = vi.fn();
        createDrag(element, {onMove: p => points.push(p), onEnd});

        await press(0.25, 0.5);
        await move(0.75, 0.25);
        expect(onEnd).not.toHaveBeenCalled();
        await release(0.75, 0.25);

        expect(points[0]).toEqual({x: 0.25, y: 0.5});
        expect(points.at(-1)).toEqual({x: 0.75, y: 0.25});
        expect(onEnd).toHaveBeenCalledOnce();
    });

    it('keeps tracking outside of the element and clamps the position', async () => {
        const element = fixture();
        const onMove = vi.fn();
        createDrag(element, {onMove});

        await press(0.5, 0.5);
        await commands.mouse('move', 400, 300);
        await commands.mouse('move', 5, 5);

        expect(onMove).toHaveBeenNthCalledWith(2, {x: 1, y: 1});
        expect(onMove).toHaveBeenLastCalledWith({x: 0, y: 0});
    });

    it('ignores moves without a pressed button', async () => {
        const element = fixture();
        const onMove = vi.fn();
        createDrag(element, {onMove});

        await move(0.5, 0.5);
        await press(0.5, 0.5);
        await release(0.5, 0.5);
        await move(0.1, 0.1);

        expect(onMove).toHaveBeenCalledTimes(2); // Press and release position
    });

    it('focuses the element', async () => {
        const element = fixture();
        createDrag(element, {onMove: vi.fn()});

        await press(0.5, 0.5);
        expect(document.activeElement).toBe(element);
    });

    it('ignores other mouse buttons', () => {
        const element = fixture();
        const onMove = vi.fn();
        createDrag(element, {onMove});

        element.dispatchEvent(new PointerEvent('pointerdown', {pointerType: 'mouse', button: 2, pointerId: 1, bubbles: true}));
        expect(onMove).not.toHaveBeenCalled();
    });

    it('ends on pointercancel', async () => {
        const element = fixture();
        const onEnd = vi.fn();
        createDrag(element, {onMove: vi.fn(), onEnd});

        await press(0.5, 0.5);
        element.dispatchEvent(new PointerEvent('pointercancel', {pointerId: 1, pointerType: 'mouse'}));
        await release(0.5, 0.5);

        expect(onEnd).toHaveBeenCalledOnce();
    });

    it('never reports NaN for elements without size', async () => {
        const element = fixture();
        element.style.width = '0';
        element.style.height = '0';
        element.style.padding = '10px'; // Still clickable, but the content box is empty
        element.style.boxSizing = 'content-box';

        const onMove = vi.fn();
        createDrag(element, {onMove});

        // getBoundingClientRect includes padding, so pretend it's empty instead
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(LEFT, TOP, 0, 0));
        await commands.mouse('down', LEFT + 5, TOP + 5);

        expect(onMove).toHaveBeenCalledWith({x: 0, y: 0});
    });

    it('disables touch scrolling and restores it on destroy', async () => {
        const element = fixture();
        element.style.touchAction = 'pan-y';
        const onMove = vi.fn();
        const drag = createDrag(element, {onMove});

        expect(element.style.touchAction).toBe('none');
        drag.destroy();
        expect(element.style.touchAction).toBe('pan-y');

        await press(0.5, 0.5);
        expect(onMove).not.toHaveBeenCalled();
    });
});

describe('createSlider', () => {
    const slider = (options: Partial<Parameters<typeof createSlider>[1]> = {}) => {
        const element = fixture();
        let value = 0.5;
        const onInput = vi.fn((v: number) => (value = v));
        const onCommit = vi.fn();
        const instance = createSlider(element, {getValue: () => value, onInput, onCommit, ...options});
        return {element, onInput, onCommit, instance};
    };

    it.each([
        [{}, 0.25],
        [{reverse: true}, 0.75],
        [{orientation: 'vertical' as const}, 0.6],
        [{orientation: 'vertical' as const, reverse: true}, 0.4]
    ])('maps the pointer position with %o', async (options, expected) => {
        const {onInput, onCommit} = slider(options);

        await press(0.25, 0.6);
        await release(0.25, 0.6);

        expect(onInput.mock.lastCall?.[0]).toBeCloseTo(expected, 9);
        expect(onCommit).toHaveBeenCalledOnce();
    });

    it('steps with the keyboard and commits on key release', async () => {
        const {element, onInput, onCommit} = slider();
        element.focus();

        await userEvent.keyboard('{ArrowRight}{ArrowRight}');
        expect(onInput.mock.calls.map(([v]) => v)).toEqual([0.51, 0.52]);
        expect(onCommit).toHaveBeenCalledTimes(2);

        await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}{End}');
        expect(onInput.mock.calls.map(([v]) => v)).toEqual([0.51, 0.52, 0.42, 1]);
    });

    it('commits once while a key is held down', async () => {
        const {element, onInput, onCommit} = slider();
        element.focus();

        await userEvent.keyboard('{ArrowUp>3}');
        expect(onInput).toHaveBeenCalledTimes(3);
        expect(onCommit).not.toHaveBeenCalled();

        await userEvent.keyboard('{/ArrowUp}');
        expect(onCommit).toHaveBeenCalledOnce();
    });

    it('commits when losing focus while a key is held down', async () => {
        const {element, onCommit} = slider();
        element.focus();

        await userEvent.keyboard('{ArrowUp>}');
        element.blur();
        expect(onCommit).toHaveBeenCalledOnce();
    });

    it('prevents scrolling for handled keys only', async () => {
        const {element} = slider();
        const prevented: Record<string, boolean> = {};
        document.addEventListener('keydown', e => (prevented[e.key] = e.defaultPrevented));
        element.focus();

        await userEvent.keyboard('{ArrowDown}{PageDown}a');
        expect(prevented).toEqual({ArrowDown: true, PageDown: true, a: false});
    });

    it('stops listening on destroy', async () => {
        const {element, onInput, instance} = slider();
        instance.destroy();
        element.focus();

        await userEvent.keyboard('{ArrowUp}');
        await press(0.5, 0.5);
        expect(onInput).not.toHaveBeenCalled();
    });
});

describe('createArea', () => {
    it('reports pointer and keyboard input', async () => {
        const element = fixture();
        let value: Point = {x: 0, y: 0};
        const onInput = vi.fn((p: Point) => (value = p));
        const onCommit = vi.fn();
        createArea(element, {getValue: () => value, onInput, onCommit});

        await press(0.2, 0.4);
        await release(0.2, 0.4);
        expect(value).toEqual({x: 0.2, y: 0.4});

        await userEvent.keyboard('{ArrowUp}{ArrowRight}{Home}');
        expect(value.x).toBe(0);
        expect(value.y).toBeCloseTo(0.39, 9);
        expect(onCommit).toHaveBeenCalledTimes(4);
    });
});

describe('with the picker state', () => {
    it('drives a hue slider', async () => {
        const picker = createPicker({color: 'hsv(0 100% 100%)'});
        const events: string[] = [];
        picker.on('change', ({color}) => events.push(`change ${Math.round(color.h)}`));
        picker.on('changeend', ({color}) => events.push(`changeend ${Math.round(color.h)}`));

        createSlider(fixture(), {
            getValue: () => picker.getState().color.h / 360,
            onInput: value => picker.adjust({h: value * 360}),
            onCommit: () => picker.adjustEnd()
        });

        await press(0.5, 0.5);
        await move(0.25, 0.5);
        await release(0.25, 0.5);
        await userEvent.keyboard('{ArrowLeft}');

        expect(events).toEqual(['change 180', 'change 90', 'changeend 90', 'change 86', 'changeend 86']);
    });
});
