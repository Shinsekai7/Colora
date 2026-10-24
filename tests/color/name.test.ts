import {describe, expect, it} from 'vitest';
import {nameColor} from '../../src/color/name.js';
import {parseColor} from '../../src/color/parse.js';
import type {ParsedColor} from '../../src/color/types.js';

const name = (input: string) => nameColor((parseColor(input) as ParsedColor).color);

describe('nameColor', () => {
    it.each([
        ['red', 'red'],
        ['orange', 'orange'],
        ['yellow', 'yellow'],
        ['lime', 'green'],
        ['cyan', 'cyan'],
        ['blue', 'blue'],
        ['rebeccapurple', 'dark purple'],
        ['magenta', 'magenta'],
        ['hotpink', 'pink']
    ])('names the hue of %s', (input, expected) => expect(name(input)).toBe(expected));

    it.each([
        ['black', 'black'],
        ['#333', 'dark gray'],
        ['gray', 'gray'],
        ['silver', 'light gray'],
        ['white', 'white']
    ])('names the gray %s', (input, expected) => expect(name(input)).toBe(expected));

    it.each([
        ['navy', 'dark blue'],
        ['pink', 'light pink'],
        ['#42445A', 'dark grayish blue'],
        ['sienna', 'brown'],
        ['olive', 'olive']
    ])('describes shade and tone of %s', (input, expected) => expect(name(input)).toBe(expected));

    it('ignores alpha', () => {
        expect(name('#0000ff80')).toBe('blue');
    });
});
