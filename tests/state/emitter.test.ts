import {afterEach, describe, expect, it, vi} from 'vitest';
import {createEmitter} from '../../src/state/emitter.js';

interface Events {
    a: number;
    b: string;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('createEmitter', () => {
    it('calls listeners of the emitted type', () => {
        const emitter = createEmitter<Events>();
        const a = vi.fn();
        const b = vi.fn();

        emitter.on('a', a);
        emitter.on('b', b);
        emitter.emit('a', 1);

        expect(a).toHaveBeenCalledWith(1);
        expect(b).not.toHaveBeenCalled();
    });

    it('removes listeners with off and the returned function', () => {
        const emitter = createEmitter<Events>();
        const first = vi.fn();
        const second = vi.fn();

        emitter.on('a', first);
        const remove = emitter.on('a', second);

        emitter.off('a', first);
        remove();
        emitter.emit('a', 1);

        expect(first).not.toHaveBeenCalled();
        expect(second).not.toHaveBeenCalled();
    });

    it('ignores removing unknown listeners', () => {
        expect(() => createEmitter<Events>().off('a', vi.fn())).not.toThrow();
    });

    it('allows listeners to remove themselves while being called', () => {
        const emitter = createEmitter<Events>();
        const second = vi.fn();

        const remove = emitter.on('a', () => remove());
        emitter.on('a', second);
        emitter.emit('a', 1);
        emitter.emit('a', 2);

        expect(second).toHaveBeenCalledTimes(2);
    });

    it('reports errors without skipping other listeners', () => {
        const reportError = vi.fn();
        vi.stubGlobal('reportError', reportError);

        const emitter = createEmitter<Events>();
        const error = new Error('oops');
        const second = vi.fn();

        emitter.on('a', () => {
            throw error;
        });
        emitter.on('a', second);

        expect(() => emitter.emit('a', 1)).not.toThrow();
        expect(second).toHaveBeenCalled();
        expect(reportError).toHaveBeenCalledWith(error);
    });

    it('removes everything on clear', () => {
        const emitter = createEmitter<Events>();
        const listener = vi.fn();

        emitter.on('a', listener);
        emitter.clear();
        emitter.emit('a', 1);

        expect(listener).not.toHaveBeenCalled();
    });
});
