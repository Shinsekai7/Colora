import {sameColor} from '../color/index.js';
import type {HSVA, OutputFormat} from '../color/index.js';
import type {Disposable} from '../interactions/index.js';
import {DEFAULT_COLOR} from '../state/index.js';
import type {ColorInput, Picker, PickerState} from '../state/index.js';
import {parseList} from './attributes.js';
import {bindEvents, bindSliders} from './bindings.js';
import {createController, resolveFormats} from './controller.js';
import {DEFAULT_FORMATS, DEFAULT_LABELS} from './labels.js';
import type {Labels} from './labels.js';
import {Popup} from './popup.js';
import {renderFormats, renderLabels, renderState, renderVisibility} from './render.js';
import {createShadowContent} from './template.js';
import type {Elements} from './template.js';

export type Theme = 'horizontal' | 'vertical' | 'compact';

// Lets this module be imported on servers (SSR) where there's no DOM, the element is only usable in browsers
const BaseElement = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

/**
 * `<colora-picker>`, a form-associated color picker. Shown inline, or as a button
 * opening it in a popover with the `popup` attribute. See the README for all attributes.
 *
 * Events: `input` while the color changes, `change` when the value got committed,
 * `cancel` when reverted, and `open` / `close` for the popup.
 *
 * The element connects its parts: the controller holds the state (state/), which is rendered
 * by render.ts, changed through bindings.ts and shown as popup by popup.ts.
 */
export class ColorPickerElement extends BaseElement {
    static formAssociated = true;

    static observedAttributes = [
        'value', 'disabled', 'required', 'format', 'formats', 'swatches', 'buttons',
        'hide', 'lock-opacity', 'popup', 'placement', 'theme'
    ];

    static #anchorPositioning: boolean | undefined;

    /** Uses CSS anchor positioning where supported, set to false to always position the popup with JavaScript. */
    static get anchorPositioning(): boolean {
        // Evaluated lazily, a call at load time would prevent tree-shaking this class
        return ColorPickerElement.#anchorPositioning ??= typeof CSS !== 'undefined' && CSS.supports('anchor-name: --a');
    }

    static set anchorPositioning(value: boolean) {
        ColorPickerElement.#anchorPositioning = value;
    }

    readonly #internals = this.attachInternals();
    readonly #shadow = this.attachShadow({mode: 'open'});
    readonly #els: Elements;
    readonly #popup: Popup;

    #picker!: Picker;
    #sliders: Disposable | null = null;
    #formats: readonly (string | OutputFormat)[] | null = null;
    #swatches: readonly ColorInput[] | null = null;
    #i18n: Partial<Labels> = {};
    #formDisabled = false;

    constructor() {
        super();

        this.#els = createShadowContent(this.#shadow);
        this.#popup = new Popup({
            host: this,
            shadow: this.#shadow,
            els: this.#els,
            placement: () => this.getAttribute('placement'),
            anchorPositioning: () => ColorPickerElement.anchorPositioning,
            onDismiss: () => this.#picker.close()
        });

        bindEvents(this.#els, () => this.#picker);
        renderLabels(this.#els, this.i18n);
        this.#setup();
    }

    /* Public API */

    /** The saved color in the selected format, an empty string if cleared. */
    get value(): string {
        const {saved} = this.#picker.getState();
        return saved ? this.#picker.formatColor(saved) : '';
    }

    /** Sets the color without emitting events, an empty string clears it. */
    set value(value: string) {
        this.#picker.setColor(value === '' || value == null ? null : String(value));
    }

    /** The color currently being edited in the selected format, may differ from `value` until saved. */
    get currentValue(): string {
        return this.#picker.formatColor();
    }

    /** The saved color, null if cleared. */
    get color(): HSVA | null {
        return this.#picker.getState().saved;
    }

    /** The state controller, for anything not covered by this element. */
    get picker(): Picker {
        return this.#picker;
    }

    /** Formats to choose from, either ids of built-in formats or custom ones. Overrides the attribute. */
    get formats(): readonly OutputFormat[] {
        return this.#formatList();
    }

    set formats(formats: readonly (string | OutputFormat)[] | null) {
        this.#formats = formats;
        this.#setup();
    }

    /** Swatches, overrides the attribute. */
    get swatches(): readonly HSVA[] {
        return this.#picker.getState().swatches;
    }

    set swatches(swatches: readonly ColorInput[] | null) {
        this.#swatches = swatches;
        this.#setup();
    }

    /** Texts and accessible names, see `Labels`. */
    get i18n(): Readonly<Labels> {
        return {...DEFAULT_LABELS, ...this.#i18n};
    }

    set i18n(labels: Partial<Labels>) {
        this.#i18n = {...labels};
        renderLabels(this.#els, this.i18n);
    }

    get name(): string | null {
        return this.getAttribute('name');
    }

    get form(): HTMLFormElement | null {
        return this.#internals.form;
    }

    get validity(): ValidityState {
        return this.#internals.validity;
    }

    get validationMessage(): string {
        return this.#internals.validationMessage;
    }

    checkValidity(): boolean {
        return this.#internals.checkValidity();
    }

    reportValidity(): boolean {
        return this.#internals.reportValidity();
    }

    /** Opens the popup, like `input.showPicker()`. */
    showPicker(): void {
        if (this.#isPopup) {
            this.#picker.open();
        }
    }

    hidePicker(): void {
        this.#picker.close();
    }

    /* Lifecycle */

    attributeChangedCallback(name: string, previous: string | null, value: string | null) {
        if (previous === value) {
            return;
        }

        switch (name) {
            case 'value':
                if (value !== null) {
                    this.#picker.setColor(value);
                }
                break;
            case 'disabled':
                this.#picker.setDisabled(this.#isDisabled);
                break;
            case 'format':
                if (value !== null) {
                    this.#picker.setFormat(value.toLowerCase());
                }
                break;
            case 'formats':
            case 'swatches':
            case 'lock-opacity':
                this.#setup();
                break;
            case 'theme':
                this.#createSliders();
                break;
            case 'popup':
                this.#updateMode();
                break;
            case 'required':
                this.#updateForm();
                break;
            case 'placement':
                if (this.#picker.getState().open) {
                    this.#popup.position();
                }
                break;
            default: // buttons, hide
                this.#render(this.#picker.getState());
        }
    }

    disconnectedCallback() {
        this.#picker.close();
        this.#popup.destroy();
    }

    formResetCallback() {
        this.#picker.setColor(this.getAttribute('value') ?? DEFAULT_COLOR);
    }

    formDisabledCallback(disabled: boolean) {
        this.#formDisabled = disabled;
        this.#picker.setDisabled(this.#isDisabled);
    }

    formStateRestoreCallback(state: unknown) {
        if (typeof state === 'string') {
            this.value = state;
        }
    }

    /* Configuration */

    get #isPopup() {
        return this.hasAttribute('popup');
    }

    get #isDisabled() {
        return this.hasAttribute('disabled') || this.#formDisabled;
    }

    get #lockOpacity() {
        return this.hasAttribute('lock-opacity');
    }

    /** Changes are only committed with the save button, if present. */
    get #explicitSave() {
        return this.#tokens('buttons').includes('save');
    }

    get #theme(): Theme {
        const theme = this.getAttribute('theme');
        return theme === 'vertical' || theme === 'compact' ? theme : 'horizontal';
    }

    #tokens(attribute: string) {
        return parseList(this.getAttribute(attribute)).map(token => token.toLowerCase());
    }

    #formatList(): OutputFormat[] {
        return resolveFormats(this.#formats ?? parseList(this.getAttribute('formats') ?? DEFAULT_FORMATS));
    }

    /* Setup */

    /** (Re-)creates the controller from the configuration, keeping the current color and format. */
    #setup() {
        const previous = this.#picker as Picker | undefined;
        const picker = createController({
            formats: this.#formatList(),
            format: this.getAttribute('format'),
            value: this.getAttribute('value'),
            swatches: this.#swatches ?? parseList(this.getAttribute('swatches')),
            lockOpacity: this.#lockOpacity,
            disabled: this.#isDisabled
        }, previous?.getState());

        previous?.close();
        previous?.destroy();
        this.#picker = picker;
        this.#connect(picker);

        renderFormats(this.#els, this.#formatList());
        this.#createSliders();
        this.#updateMode();
    }

    /** Renders the controller's state and translates its events into DOM events. */
    #connect(picker: Picker) {
        picker.subscribe((state, prev) => this.#render(state, prev));

        picker.on('change', ({color}) => {
            if (!this.#explicitSave) {
                picker.setColor(color);
            }

            this.#dispatch('input', true);
        });

        picker.on('changeend', () => {
            if (!this.#explicitSave) {
                this.#dispatch('change');
            }
        });

        picker.on('save', () => this.#dispatch('change'));
        picker.on('cancel', () => this.#dispatch('cancel'));
        picker.on('open', () => this.#dispatch('open'));

        picker.on('close', () => {
            const {color, saved} = picker.getState();

            // Closing the popup without saving reverts the changes
            if (this.#explicitSave && saved && !sameColor(color, saved)) {
                picker.cancel();
            }

            this.#dispatch('close');
        });
    }

    #createSliders() {
        this.#sliders?.destroy();
        // The horizontal layout places the sliders next to the color area, so they run vertically
        this.#sliders = bindSliders(this.#els, () => this.#picker, this.#theme === 'horizontal' ? 'vertical' : 'horizontal');
    }

    #updateMode() {
        if (!this.#isPopup) {
            this.#picker.close();
        }

        this.#popup.setEnabled(this.#isPopup);
        this.#render(this.#picker.getState());
    }

    #render(state: PickerState, previous?: PickerState) {
        renderState(this.#els, state, previous);
        renderVisibility(this.#els, {hidden: this.#tokens('hide'), buttons: this.#tokens('buttons'), lockOpacity: this.#lockOpacity});
        this.#popup.sync(state.open);

        if (!previous || previous.saved !== state.saved || previous.format !== state.format) {
            this.#updateForm();
        }
    }

    #updateForm() {
        const {saved} = this.#picker.getState();
        this.#internals.setFormValue(saved ? this.value : null);

        if (this.hasAttribute('required') && !saved) {
            this.#internals.setValidity({valueMissing: true}, 'Please select a color.', this.#els.input);
        } else {
            this.#internals.setValidity({});
        }
    }

    #dispatch(type: string, composed = false) {
        this.dispatchEvent(new Event(type, {bubbles: true, composed}));
    }
}
