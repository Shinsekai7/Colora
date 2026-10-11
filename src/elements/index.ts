import {ColorPickerElement} from './picker-element.js';

export {ColorPickerElement} from './picker-element.js';
export type {Theme} from './picker-element.js';
export {DEFAULT_LABELS} from './labels.js';
export type {Labels} from './labels.js';
export type {Placement} from './attributes.js';

/** Registers `<colora-picker>`, does nothing if it's already registered or there's no DOM (SSR). */
export function define(name = 'colora-picker'): void {
    if (typeof customElements !== 'undefined' && !customElements.get(name)) {
        customElements.define(name, ColorPickerElement);
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'colora-picker': ColorPickerElement;
    }
}
