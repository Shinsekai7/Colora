import {defaultFormats, fillPowerless, parseColor, sameColor} from '../color/index.js';
import type {HSVA, OutputFormat, ParsedColor} from '../color/index.js';
import type {Disposable} from '../interactions/index.js';
import {DEFAULT_COLOR} from '../state/index.js';
import type {ColorInput, Picker, PickerState} from '../state/index.js';
import {parseList} from './attributes.js';
import {bindEvents, bindSliders} from './bindings.js';
import {createController, resolveFormats} from './controller.js';
import {DEFAULT_FORMATS, DEFAULT_LABELS} from './labels.js';
import type {Labels} from './labels.js';
import {LinkedInput} from './linked-input.js';
import {Popup} from './popup.js';
import {renderFormats, renderPanel, renderPanelLabels, renderShell, renderShellLabels, renderVisibility} from './render.js';
import {createPanelContent, createShadowContent} from './template.js';
import type {PanelContent, Shell} from './template.js';

export type Theme = 'horizontal' | 'vertical' | 'compact';

// Lets this module be imported on servers (SSR) where there's no DOM, the element is only usable in browsers
const BaseElement = (typeof HTMLElement === 'undefined' ? class {} : HTMLElement) as typeof HTMLElement;

/** How long the copy button shows its check mark, in ms. */
const COPIED_DURATION = 1500;

/** The EyeDropper API, only available in Chromium. Not yet part of TypeScript's DOM types. */
type EyeDropperConstructor = new () => { open(): Promise<{ sRGBHex: string }> };

const eyeDropperApi = () => (globalThis as { EyeDropper?: EyeDropperConstructor }).EyeDropper;

/**
 * `<colora-picker>`, a form-associated color picker. Shown inline, or as a button
 * opening it in a popover with the `popup` attribute. See the README for all attributes.
 *
 * Events: `input` while the color changes, `change` when the value got committed,
 * `cancel` when reverted, and `open` / `close` for the popup.
 *
 * The element connects its parts: the controller holds the state (state/), which is rendered
 * by render.ts, changed through bindings.ts and shown as popup by popup.ts.
 * Popups only build their panel when first opened, so pages with many pickers stay light.
 */
export class ColorPickerElement extends BaseElement {
    static formAssociated = true;

    static observedAttributes = [
        'value', 'disabled', 'required', 'format', 'formats', 'swatches', 'buttons',
        'hide', 'lock-opacity', 'popup', 'placement', 'theme', 'for', 'presentation'
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
    readonly #shell: Shell;
    readonly #popup: Popup;
    readonly #linked: LinkedInput;

    #picker!: Picker;

    /** The color the popup was opened with, null while closed. See #reference. */
    #openedWith: HSVA | null = null;

    /** The panel's controls, null until built, see #render. */
    #content: PanelContent | null = null;
    #sliders: Disposable | null = null;
    #formats: readonly (string | OutputFormat)[] | null = null;
    #swatches: readonly ColorInput[] | null = null;
    #i18n: Partial<Labels> = {};
    #formDisabled = false;
    #copiedTimer: ReturnType<typeof setTimeout> | undefined;

    /** Set through the `input` property, overrides the `for` attribute. */
    #input: HTMLInputElement | null | undefined;

    constructor() {
        super();

        this.#shell = createShadowContent(this.#shadow);
        this.#linked = new LinkedInput({
            host: this,
            picker: () => this.#picker,
            parsers: () => [...defaultFormats, ...this.#formatList()],
            value: () => this.value,
            dispatch: type => this.#dispatch(type, type === 'input'),
            popup: () => this.#isPopup
        });

        this.#popup = new Popup({
            host: this,
            els: this.#shell,
            area: () => this.#content?.area ?? null,
            placement: () => this.getAttribute('placement'),
            anchorPositioning: () => ColorPickerElement.anchorPositioning,
            linked: () => this.#linked.element,
            presentation: () => this.getAttribute('presentation'),
            onToggle: open => {
                if (open) {
                    this.#picker.open();
                } else {
                    this.#picker.close();
                }

                // False if it can't be opened, e.g. while disabled
                return this.#picker.getState().open === open;
            }
        });

        renderShellLabels(this.#shell, this.i18n);
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
        renderShellLabels(this.#shell, this.i18n);

        if (this.#content) {
            renderPanelLabels(this.#content, this.i18n);
            // Without a previous state, so the swatches get named again
            this.#render(this.#picker.getState());
        }
    }

    /** The linked input, see the `for` attribute. Setting it overrides the attribute, `null` unlinks it. */
    get input(): HTMLInputElement | null {
        return this.#linked.element;
    }

    set input(input: HTMLInputElement | null) {
        this.#input = input;
        this.#link();
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
                this.#popup.updatePlacement();
                break;
            case 'presentation':
                this.#popup.updatePresentation();
                break;
            case 'for':
                this.#link();
                break;
            default: // buttons, hide
                this.#render(this.#picker.getState());
        }
    }

    connectedCallback() {
        this.#link();

        // Inline pickers are only built once connected: `createElement`, used by frameworks, has no attributes yet
        if (!this.#content && !this.#isPopup) {
            this.#render(this.#picker.getState());
        }
    }

    disconnectedCallback() {
        this.#picker.close();
        this.#popup.destroy();
        this.#linked.link(null);
        this.#popup.updateLink();
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

    /** Links the input from the `input` property or the `for` attribute. */
    #link() {
        if (!this.isConnected) {
            return;
        }

        const id = this.getAttribute('for');
        let input = this.#input;

        if (input === undefined && id) {
            const root = this.getRootNode() as Document | ShadowRoot;
            const found = root.getElementById(id);
            input = found instanceof HTMLInputElement ? found : null;

            // While the page is loading, the input may come after the picker
            if (!input && document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.#link(), {once: true});
            }
        }

        this.#linked.link(input ?? null);
        this.#popup.updateLink();
        this.#linked.update();
    }

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

        if (this.#content) {
            renderFormats(this.#content, this.#formatList());
            this.#createSliders();
        }

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
        picker.on('open', () => {
            this.#openedWith = picker.getState().color;
            this.#dispatch('open');
        });

        picker.on('close', () => {
            const {color, saved} = picker.getState();

            // Closing the popup without saving reverts the changes
            if (this.#explicitSave && saved && !sameColor(color, saved)) {
                picker.cancel();
            }

            this.#openedWith = null;

            this.#dispatch('close');
        });
    }

    /**
     * The color the preview compares with: the saved one. Without a save button every change is saved,
     * so popups use the color they were opened with instead.
     */
    #reference(state: PickerState): HSVA | null {
        return this.#explicitSave ? state.saved : this.#openedWith ?? state.saved;
    }

    /** Goes back to the reference color, like a change made by the user. */
    #revert() {
        const target = this.#openedWith;

        if (this.#explicitSave || !target) {
            this.#picker.cancel();
            return;
        }

        this.#picker.adjust(target);
        this.#picker.adjustEnd();
    }

    /** Copies the color being edited. The copy button shows a check mark for a moment, screen readers announce it. */
    async #copy() {
        const content = this.#content;

        try {
            await navigator.clipboard.writeText(this.currentValue);
        } catch {
            return; // Denied, e.g. on insecure origins
        }

        if (!content) {
            return;
        }

        clearTimeout(this.#copiedTimer);
        content.copy.classList.add('copied');
        content.status.textContent = this.i18n.copied;

        this.#copiedTimer = setTimeout(() => {
            content.copy.classList.remove('copied');
            content.status.textContent = '';
        }, COPIED_DURATION);
    }

    /** Lets the user pick a color from the screen, like a change made with the sliders. Keeps the opacity. */
    async #pickFromScreen() {
        const EyeDropper = eyeDropperApi();

        if (!EyeDropper || this.#picker.getState().disabled) {
            return;
        }

        let parsed: ParsedColor | null;
        try {
            parsed = parseColor((await new EyeDropper().open()).sRGBHex);
        } catch {
            return; // Cancelled with Escape
        }

        if (parsed) {
            const {h, s, v} = fillPowerless(parsed, this.#picker.getState().color);
            this.#picker.adjust({h, s, v});
            this.#picker.adjustEnd();
        }
    }

    /** Fills the panel with its controls. */
    #build(): PanelContent {
        const content = createPanelContent(this.#shell.panel);
        this.#content = content;

        bindEvents(this.#shell.panel, content, () => this.#picker, {
            revert: () => this.#revert(),
            copy: () => void this.#copy(),
            pickFromScreen: () => void this.#pickFromScreen()
        });
        renderPanelLabels(content, this.i18n);
        renderFormats(content, this.#formatList());
        this.#createSliders();

        // Lets the color area get the focus when opening
        this.#popup.updateLink();
        return content;
    }

    #createSliders() {
        if (!this.#content) {
            return;
        }

        this.#sliders?.destroy();
        // The horizontal layout places the sliders next to the color area, so they run vertically
        this.#sliders = bindSliders(this.#content, () => this.#picker, this.#theme === 'horizontal' ? 'vertical' : 'horizontal');
    }

    #updateMode() {
        if (!this.#isPopup) {
            this.#picker.close();
        }

        this.#popup.setEnabled(this.#isPopup);
        this.#render(this.#picker.getState());
    }

    #render(state: PickerState, previous?: PickerState) {
        renderShell(this.#shell, state);

        // Inline pickers need their controls once shown, popups once they open
        let content = this.#content;
        let previousContent = previous;

        if (!content && (state.open || (!this.#isPopup && this.isConnected))) {
            content = this.#build();
            previousContent = undefined;
        }

        if (content) {
            renderPanel(content, state, this.#reference(state), this.i18n, previousContent);
            renderVisibility(content, {
                hidden: this.#tokens('hide'),
                buttons: this.#tokens('buttons'),
                lockOpacity: this.#lockOpacity,
                canPickFromScreen: !!eyeDropperApi()
            });
        }

        this.#linked?.update();
        this.#popup.sync(state.open);

        if (!previous || previous.saved !== state.saved || previous.format !== state.format) {
            this.#updateForm();
        }
    }

    #updateForm() {
        const {saved} = this.#picker.getState();
        this.#internals.setFormValue(saved ? this.value : null);

        if (this.hasAttribute('required') && !saved) {
            // The trigger, as the input is hidden in the closed popup
            const anchor = this.#isPopup ? this.#shell.trigger : this.#content?.input;
            this.#internals.setValidity({valueMissing: true}, 'Please select a color.', anchor);
        } else {
            this.#internals.setValidity({});
        }
    }

    #dispatch(type: string, composed = false) {
        this.dispatchEvent(new Event(type, {bubbles: true, composed}));
    }
}
