// Runs in Node without a DOM, like server-side rendering in Next.js, Nuxt or SvelteKit
import {describe, expect, it} from 'vitest';

describe('without a DOM', () => {
    it('can import every entry point', async () => {
        expect(typeof HTMLElement).toBe('undefined');

        const lib = await import('../src/index.js');
        await import('../src/define.js');

        expect(lib.parseColor('#fff')?.format).toBe('hex');
        expect(lib.createPicker().getState().text).toBe('#42445A');
        expect(() => lib.define()).not.toThrow();
    });
});
