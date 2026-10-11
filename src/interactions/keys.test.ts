import {describe, expect, it} from 'vitest';
import {areaKey, sliderKey} from './keys.js';

const key = (key: string, modifiers: Partial<Record<'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey', boolean>> = {}) => ({
    key,
    shiftKey: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    ...modifiers
});

describe('sliderKey', () => {
    it.each([
        ['ArrowUp', 0.51],
        ['ArrowRight', 0.51],
        ['ArrowDown', 0.49],
        ['ArrowLeft', 0.49],
        ['PageUp', 0.6],
        ['PageDown', 0.4],
        ['Home', 0],
        ['End', 1]
    ])('handles %s', (name, expected) => {
        expect(sliderKey(key(name), 0.5)).toBeCloseTo(expected, 9);
    });

    it('takes large steps with shift', () => {
        expect(sliderKey(key('ArrowUp', {shiftKey: true}), 0.5)).toBeCloseTo(0.6, 9);
        expect(sliderKey(key('ArrowLeft', {shiftKey: true}), 0.5)).toBeCloseTo(0.4, 9);
    });

    it('uses custom step sizes', () => {
        expect(sliderKey(key('ArrowUp'), 0.5, {step: 0.05})).toBeCloseTo(0.55, 9);
        expect(sliderKey(key('PageDown'), 0.5, {largeStep: 0.25})).toBe(0.25);
    });

    it('stays within [0, 1]', () => {
        expect(sliderKey(key('ArrowUp'), 0.995)).toBe(1);
        expect(sliderKey(key('PageDown'), 0.05)).toBe(0);
    });

    it('does not accumulate floating point errors', () => {
        let value = 0;
        for (let i = 0; i < 8; i++) {
            value = sliderKey(key('ArrowUp'), value) as number;
        }

        expect(value).toBe(0.08);
    });

    it.each([
        key('a'),
        key('Tab'),
        key('Enter'),
        key('ArrowLeft', {altKey: true}),
        key('ArrowUp', {ctrlKey: true}),
        key('Home', {metaKey: true})
    ])('ignores $key with modifiers %o', event => {
        expect(sliderKey(event, 0.5)).toBeNull();
    });
});

describe('areaKey', () => {
    const center = {x: 0.5, y: 0.5};

    it.each([
        ['ArrowUp', {x: 0.5, y: 0.49}],
        ['ArrowDown', {x: 0.5, y: 0.51}],
        ['ArrowLeft', {x: 0.49, y: 0.5}],
        ['ArrowRight', {x: 0.51, y: 0.5}],
        ['PageUp', {x: 0.5, y: 0.4}],
        ['PageDown', {x: 0.5, y: 0.6}],
        ['Home', {x: 0, y: 0.5}],
        ['End', {x: 1, y: 0.5}]
    ])('handles %s', (name, expected) => {
        const point = areaKey(key(name), center);
        expect(point?.x).toBeCloseTo(expected.x, 9);
        expect(point?.y).toBeCloseTo(expected.y, 9);
    });

    it('takes large steps with shift', () => {
        expect(areaKey(key('ArrowRight', {shiftKey: true}), center)?.x).toBeCloseTo(0.6, 9);
    });

    it('stays within the area', () => {
        expect(areaKey(key('ArrowUp'), {x: 0.5, y: 0})).toEqual({x: 0.5, y: 0});
        expect(areaKey(key('ArrowRight'), {x: 1, y: 0.5})).toEqual({x: 1, y: 0.5});
    });

    it('ignores unknown keys and shortcuts', () => {
        expect(areaKey(key('x'), center)).toBeNull();
        expect(areaKey(key('ArrowUp', {altKey: true}), center)).toBeNull();
    });
});
