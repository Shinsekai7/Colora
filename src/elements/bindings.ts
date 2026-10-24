import {createArea, createSlider} from '../interactions/index.js';
import type {Disposable} from '../interactions/index.js';
import type {Picker} from '../state/index.js';
import type {PanelContent} from './template.js';

/** Actions handled by the element. */
export interface PanelActions {
    /** Called by the saved color in the preview. */
    revert(): void;

    /** Copy button, and Ctrl/Cmd+C outside of the text field. */
    copy(): void;

    /** Eyedropper button. */
    pickFromScreen(): void;
}

/**
 * Forwards clicks and keys on buttons, input, formats and swatches to the controller.
 * The controller is passed as getter as it's re-created when the configuration changes.
 * Listeners live on the shadow content, so they don't need to be removed.
 */
export function bindEvents(panel: HTMLElement, content: PanelContent, picker: () => Picker, actions: PanelActions) {
    const {sheetClose, saved, input, formats, swatches, copy, eyeDropper, save, cancel, clear} = content;

    saved.addEventListener('click', () => actions.revert());
    copy.addEventListener('click', () => actions.copy());
    eyeDropper.addEventListener('click', () => actions.pickFromScreen());

    // The text field copies its selection natively
    panel.addEventListener('keydown', event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && event.target !== input) {
            event.preventDefault();
            actions.copy();
        }
    });

    input.addEventListener('input', event => {
        // The native event would escape the shadow root, the element dispatches its own
        event.stopPropagation();
        picker().inputText(input.value);
    });

    input.addEventListener('blur', () => picker().commitText());
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            picker().commitText();
        }
    });

    formats.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('.format');

        if (button?.dataset.format) {
            picker().setFormat(button.dataset.format);
        }
    });

    // Radio group: arrow keys move the selection
    formats.addEventListener('keydown', event => {
        const buttons = [...formats.querySelectorAll<HTMLElement>('.format')];
        const index = buttons.indexOf(event.target as HTMLElement);
        const offset = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[event.key];

        if (index !== -1 && offset) {
            event.preventDefault();
            const next = buttons[(index + offset + buttons.length) % buttons.length] as HTMLElement;
            picker().setFormat(next.dataset.format as string);
            next.focus();
        }
    });

    swatches.addEventListener('click', event => {
        const button = (event.target as Element).closest<HTMLElement>('.swatch');

        if (button) {
            picker().selectSwatch([...swatches.children].indexOf(button));
        }
    });

    const closeAfter = (action: (p: Picker) => void) => () => {
        action(picker());
        picker().close();
    };

    save.addEventListener('click', closeAfter(p => p.save()));
    cancel.addEventListener('click', closeAfter(p => p.cancel()));
    clear.addEventListener('click', closeAfter(p => p.clear()));
    sheetClose.addEventListener('click', () => picker().close());
}

/**
 * Makes the color area and sliders draggable and keyboard accessible.
 * Vertical sliders have 0 at the bottom, so arrow keys move them in their direction.
 */
export function bindSliders(content: PanelContent, picker: () => Picker, orientation: 'horizontal' | 'vertical'): Disposable {
    const {area, hue, alpha} = content;
    const vertical = orientation === 'vertical';
    const color = () => picker().getState().color;
    const onCommit = () => picker().adjustEnd();

    hue.setAttribute('aria-orientation', orientation);
    alpha.setAttribute('aria-orientation', orientation);

    const controls = [
        createArea(area, {
            getValue: () => ({x: color().s / 100, y: 1 - color().v / 100}),
            onInput: ({x, y}) => picker().adjust({s: x * 100, v: (1 - y) * 100}),
            onCommit
        }),
        createSlider(hue, {
            orientation,
            reverse: vertical,
            getValue: () => color().h / 360,
            onInput: value => picker().adjust({h: value * 360}),
            onCommit
        }),
        createSlider(alpha, {
            orientation,
            reverse: vertical,
            getValue: () => color().a,
            onInput: value => picker().adjust({a: value}),
            onCommit
        })
    ];

    return {destroy: () => controls.forEach(control => control.destroy())};
}
