import {describe, expect, it} from 'vitest';
import {computePosition, parseList, parsePlacement, toPositionArea} from '../../src/elements/attributes.js';

describe('parseList', () => {
    it.each([
        [null, []],
        ['', []],
        ['  ', []],
        ['hex rgb', ['hex', 'rgb']],
        ['hex,rgb, hsl', ['hex', 'rgb', 'hsl']],
        ['#f00 rgb(1, 2, 3), hsl(1 2% 3% / 0.5)', ['#f00', 'rgb(1, 2, 3)', 'hsl(1 2% 3% / 0.5)']],
        ['rgb(1, 2, 3', ['rgb(1, 2, 3']],
        ['a) b', ['a)', 'b']]
    ])('parses %j', (input, expected) => {
        expect(parseList(input)).toEqual(expected);
    });
});

describe('parsePlacement', () => {
    it.each([
        ['bottom', {side: 'bottom', align: 'center'}],
        ['top-start', {side: 'top', align: 'start'}],
        [' left-end ', {side: 'left', align: 'end'}],
        ['middle', {side: 'bottom', align: 'center'}],
        ['bottom-middle', {side: 'bottom', align: 'center'}],
        [null, {side: 'bottom', align: 'center'}]
    ])('parses %j', (input, expected) => {
        expect(parsePlacement(input)).toEqual(expected);
    });
});

describe('toPositionArea', () => {
    it.each([
        ['bottom', 'block-end'],
        ['bottom-start', 'block-end span-inline-end'],
        ['bottom-end', 'block-end span-inline-start'],
        ['top', 'block-start'],
        ['left-start', 'inline-start span-block-end'],
        ['right-end', 'inline-end span-block-start']
    ])('maps %s', (placement, expected) => {
        expect(toPositionArea(parsePlacement(placement))).toBe(expected);
    });
});

describe('computePosition', () => {
    const viewport = {width: 1000, height: 800};
    const panel = {width: 200, height: 100};
    const anchor = {left: 400, top: 300, width: 40, height: 20};
    const place = (placement: string, a = anchor) => computePosition(a, panel, viewport, parsePlacement(placement), 8);

    it.each([
        ['bottom', {x: 320, y: 328}],
        ['bottom-start', {x: 400, y: 328}],
        ['bottom-end', {x: 240, y: 328}],
        ['top', {x: 320, y: 192}],
        ['left', {x: 192, y: 260}],
        ['right-start', {x: 448, y: 300}]
    ])('places the panel %s', (placement, expected) => {
        expect(place(placement)).toEqual(expected);
    });

    it('flips if there is no space', () => {
        expect(place('bottom', {...anchor, top: 750})).toEqual({x: 320, y: 642});
        expect(place('top', {...anchor, top: 10})).toEqual({x: 320, y: 38});
        expect(place('right', {...anchor, left: 900})).toEqual({x: 692, y: 260});
    });

    it('stays on the preferred side if neither fits', () => {
        expect(computePosition(anchor, {width: 200, height: 700}, viewport, parsePlacement('bottom'))).toMatchObject({y: 328});
    });

    it('keeps the panel within the viewport, the gap away from its edges', () => {
        expect(place('bottom', {...anchor, left: 0})).toMatchObject({x: 8});
        expect(place('bottom', {...anchor, left: 980})).toMatchObject({x: 792});
    });

    // E.g. on phones
    it('centers panels nearly as wide as the viewport', () => {
        expect(computePosition({...anchor, left: 0}, {width: 990, height: 100}, viewport, parsePlacement('bottom-start'))).toMatchObject({x: 5});
    });
});
