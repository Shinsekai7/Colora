import {parseColor} from '../color/index.js';
import type {ColorFormat} from '../color/index.js';
import type {Picker} from '../state/index.js';

export interface LinkedInputOptions {
    host: HTMLElement;
    picker(): Picker;

    /** Formats accepted when typing, those of the picker. */
    parsers(): readonly ColorFormat[];

    /** The element's value, in the selected format, `''` if cleared. */
    value(): string;

    /** Dispatches `input` or `change` on the element. */
    dispatch(type: 'input' | 'change'): void;

    /** Whether the picker is shown as popup, the input opens it then. */
    popup(): boolean;
}

// React and others track the value property, setting it through the prototype is what they notice
const setNativeValue = (input: HTMLInputElement, value: string) =>
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);

/**
 * Keeps an existing `<input>` in sync with the picker and lets it open the popup.
 * The input stays focused while the popup is open, so it can still be typed in.
 */
export class LinkedInput {
    readonly #options: LinkedInputOptions;
    #input: HTMLInputElement | null = null;
    #listeners: AbortController | null = null;
    #restore: (() => void) | null = null;

    /** Set while handling typing, the picker's resulting events must not overwrite the text. */
    #typing = false;

    /** Set while writing to the input, its resulting events are not typing. */
    #writing = false;

    /** The value at the last change event, to only emit one if it actually changed. */
    #committed = '';

    constructor(options: LinkedInputOptions) {
        this.#options = options;
    }

    get element(): HTMLInputElement | null {
        return this.#input;
    }

    link(input: HTMLInputElement | null) {
        if (input === this.#input) {
            return;
        }

        this.unlink();

        if (!input) {
            return;
        }

        const {host} = this.#options;
        const previous = {
            hasPopup: input.getAttribute('aria-haspopup'),
            expanded: input.getAttribute('aria-expanded')
        };

        this.#input = input;
        this.#restore = () => {
            restoreAttribute(input, 'aria-haspopup', previous.hasPopup);
            restoreAttribute(input, 'aria-expanded', previous.expanded);
        };

        this.update();

        const controller = new AbortController();
        const signal = controller.signal;
        this.#listeners = controller;

        input.addEventListener('input', () => this.#onType(), {signal});
        input.addEventListener('change', () => this.#onCommit(), {signal});
        input.addEventListener('click', () => this.#open(), {signal});
        input.addEventListener('keydown', event => this.#onKeyDown(event), {signal});
        input.addEventListener('focusout', event => this.#onFocusOut(event), {signal});
        host.addEventListener('focusout', event => this.#onFocusOut(event), {signal});

        // Changes made with the picker itself
        host.addEventListener('input', () => this.#write('input'), {signal});
        host.addEventListener('change', () => this.#write('change'), {signal});

        // The input is the source of truth, if empty the picker's value is the default
        if (input.value.trim() && this.#isValid(input.value)) {
            this.#options.picker().setColor(input.value);
        }

        this.#writeValue(this.#options.value());
        this.#committed = this.#options.value();
    }

    unlink() {
        this.#listeners?.abort();
        this.#listeners = null;
        this.#restore?.();
        this.#restore = null;
        this.#input = null;
    }

    /** Updates the accessibility attributes, e.g. after opening or closing. */
    update() {
        const input = this.#input;

        if (!input) {
            return;
        }

        if (this.#options.popup()) {
            input.setAttribute('aria-haspopup', 'dialog');
            input.setAttribute('aria-expanded', String(this.#options.picker().getState().open));
        } else {
            input.removeAttribute('aria-haspopup');
            input.removeAttribute('aria-expanded');
        }
    }

    #isValid(text: string) {
        return parseColor(text, this.#options.parsers()) !== null;
    }

    #open() {
        if (this.#options.popup()) {
            this.#options.picker().open();
        }
    }

    #onKeyDown(event: KeyboardEvent) {
        // Like a select or combobox
        if (event.key === 'ArrowDown' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            event.preventDefault();
            this.#open();
        }
    }

    /** The user typed, valid colors are applied right away. */
    #onType() {
        const input = this.#input;

        if (!input || this.#writing) {
            return;
        }

        const text = input.value.trim();
        const picker = this.#options.picker();
        const applied = text ? this.#isValid(text) && picker.setColor(text) : picker.setColor(null);

        if (applied) {
            this.#typing = true;
            this.#options.dispatch('input');
            this.#typing = false;
        }
    }

    /** The input lost focus or Enter was pressed: show the value as formatted by the picker. */
    #onCommit() {
        if (this.#writing) {
            return;
        }

        // Invalid text is replaced with the current value
        this.#writeValue(this.#options.value());

        if (this.#options.value() !== this.#committed) {
            this.#committed = this.#options.value();
            this.#typing = true;
            this.#options.dispatch('change');
            this.#typing = false;
        }
    }

    /** The color was changed with the picker, the input follows and emits the same event. */
    #write(type: 'input' | 'change') {
        const input = this.#input;

        if (!input || this.#typing) {
            return;
        }

        const value = this.#options.value();
        this.#writing = true;

        if (input.value !== value) {
            setNativeValue(input, value);
            input.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
        }

        if (type === 'change' && value !== this.#committed) {
            this.#committed = value;
            input.dispatchEvent(new Event('change', {bubbles: true}));
        }

        this.#writing = false;
    }

    #writeValue(value: string) {
        const input = this.#input;

        if (input && input.value !== value) {
            this.#writing = true;
            setNativeValue(input, value);
            this.#writing = false;
        }
    }

    /** Closes the popup once the focus moves somewhere else than the input or the picker. */
    #onFocusOut(event: FocusEvent) {
        const {host} = this.#options;
        const next = event.relatedTarget as Node | null;

        // Without a new target, e.g. a click on the page, the browser closes the popup itself
        if (next && next !== this.#input && next !== host && !host.contains(next)) {
            this.#options.picker().close();
        }
    }
}

function restoreAttribute(element: Element, name: string, value: string | null) {
    if (value === null) {
        element.removeAttribute(name);
    } else {
        element.setAttribute(name, value);
    }
}
