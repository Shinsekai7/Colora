import {describe, expect, it} from 'vitest';
import {cmyk, hex, rgb} from '../../src/color/index.js';
import {createController, resolveFormats} from '../../src/elements/controller.js';
import type {ControllerConfig} from '../../src/elements/controller.js';

const CONFIG: ControllerConfig = {
    formats: [hex, rgb],
    format: null,
    value: null,
    swatches: [],
    lockOpacity: false,
    disabled: false
};

const create = (config: Partial<ControllerConfig> = {}) => createController({...CONFIG, ...config});

describe('resolveFormats', () => {
    it('resolves ids and keeps custom formats', () => {
        expect(resolveFormats(['HEX', 'oklch', cmyk]).map(f => f.id)).toEqual(['hex', 'oklch', 'cmyk']);
    });

    it('skips unknown ids and falls back to the defaults', () => {
        expect(resolveFormats(['nope', 'rgb']).map(f => f.id)).toEqual(['rgb']);
        expect(resolveFormats(['nope']).map(f => f.id)).toEqual(['hex', 'rgb', 'hsl']);
        expect(resolveFormats([]).map(f => f.id)).toEqual(['hex', 'rgb', 'hsl']);
    });
});

describe('createController', () => {
    it('uses the value, or the default color', () => {
        expect(create({value: '#f00'}).getState().text).toBe('#FF0000');
        expect(create().getState().text).toBe('#42445A');
    });

    it('falls back to the default instead of throwing', () => {
        expect(create({value: 'nope'}).getState().text).toBe('#42445A');
        expect(create({value: 'rgb(0 0 0 / 0.5)', lockOpacity: true}).getState().text).toBe('#42445A');
    });

    it('selects the requested format if available', () => {
        expect(create({format: 'RGB'}).getState().format).toBe('rgb');
        expect(create({format: 'cmyk'}).getState().format).toBe('hex');
    });

    it('skips invalid swatches', () => {
        expect(create({swatches: ['#f00', 'nope', {h: 0, s: 0, v: 0}]}).getState().swatches).toHaveLength(2);
        expect(create({swatches: ['#f008'], lockOpacity: true}).getState().swatches).toHaveLength(0);
    });

    it('passes the disabled state', () => {
        expect(create({disabled: true}).getState().disabled).toBe(true);
    });

    it('keeps the colors and format when re-created', () => {
        const previous = create({value: '#f00'});
        previous.setFormat('rgb');
        previous.adjust({h: 120});

        const state = createController({...CONFIG, value: '#00f', formats: [rgb, hex]}, previous.getState()).getState();

        expect(state.format).toBe('rgb');
        expect(hex.stringify(state.saved!)).toBe('#FF0000');
        expect(hex.stringify(state.color)).toBe('#00FF00');
    });

    it('keeps a cleared color when re-created', () => {
        const previous = create();
        previous.setColor(null);

        expect(createController(CONFIG, previous.getState()).getState().saved).toBeNull();
    });

    it('drops the alpha channel when re-created with locked opacity', () => {
        const previous = create({value: 'rgb(255 0 0 / 0.5)'});
        const state = createController({...CONFIG, lockOpacity: true}, previous.getState()).getState();

        expect(state.saved?.a).toBe(1);
        expect(state.color.a).toBe(1);
    });
});
