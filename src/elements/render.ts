import {hex, hsvToRgb, sameColor} from '../color/index.js';
import type {HSVA, OutputFormat} from '../color/index.js';
import type {PickerState} from '../state/index.js';
import type {Labels} from './labels.js';
import type {PanelContent, Shell} from './template.js';

const rgbString = (color: HSVA, alpha = color.a) => {
    const {r, g, b} = hsvToRgb(color);
    return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${alpha})`;
};

const percent = (value: number) => `${Math.round(value)}%`;

function setAria(element: HTMLElement, now: number, text: string) {
    element.setAttribute('aria-valuenow', String(now));
    element.setAttribute('aria-valuetext', text);
}

/** Renders the state on the trigger. Visuals are driven by custom properties on the root, see picker.css. */
export function renderShell(shell: Shell, state: PickerState) {
    const {root, trigger, panel} = shell;
    const {color, saved} = state;

    root.style.setProperty('--cp-hue', String(color.h));
    root.style.setProperty('--cp-s', String(color.s / 100));
    root.style.setProperty('--cp-v', String(color.v / 100));
    root.style.setProperty('--cp-a', String(color.a));
    root.style.setProperty('--cp-color', rgbString(color));
    root.style.setProperty('--cp-color-opaque', rgbString(color, 1));
    root.style.setProperty('--cp-saved', saved ? rgbString(saved) : 'transparent');

    trigger.classList.toggle('cleared', !saved);
    trigger.disabled = state.disabled;
    trigger.setAttribute('aria-expanded', String(state.open));
    panel.inert = state.disabled;
}

/**
 * Renders the state on the panel's controls. Swatches are only re-created if they changed since `previous`.
 * The preview compares the color with `reference`, see the element.
 */
export function renderPanel(content: PanelContent, state: PickerState, reference: HSVA | null, labels: Labels, previous?: PickerState) {
    const {preview, area, hue, alpha, input, formats, swatches} = content;
    const {color} = state;
    const name = labels.colorName(color);

    preview.style.setProperty('--cp-reference', reference ? rgbString(reference) : 'transparent');

    setAria(area, Math.round(color.s), `${labels.saturation} ${percent(color.s)}, ${labels.brightness} ${percent(color.v)}, ${name}`);
    setAria(hue, Math.round(color.h), `${Math.round(color.h)}°, ${name}`);
    setAria(alpha, Math.round(color.a * 100), percent(color.a * 100));

    // Only touch the input if needed, so the caret doesn't jump while typing
    if (input.value !== state.text) {
        input.value = state.text;
    }

    input.setAttribute('aria-invalid', String(!state.textValid));

    for (const button of formats.querySelectorAll<HTMLElement>('.format')) {
        const checked = button.dataset.format === state.format;
        button.setAttribute('aria-checked', String(checked));
        button.tabIndex = checked ? 0 : -1;
    }

    if (state.swatches !== previous?.swatches) {
        swatches.replaceChildren(...state.swatches.map(swatch => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'swatch';
            button.part.add('swatch');
            button.style.setProperty('--cp-swatch-color', rgbString(swatch));
            // The hex code tells apart swatches with the same name
            button.setAttribute('aria-label', `${labels.colorName(swatch)}, ${hex.stringify(swatch)}`);
            return button;
        }));
    }

    state.swatches.forEach((swatch, index) => {
        const active = sameColor(swatch, color);
        const button = swatches.children[index] as HTMLElement;
        button.classList.toggle('active', active);
        button.part.toggle('swatch-active', active);
    });
}

/** Re-creates the format buttons, their selection is rendered by `renderState`. */
export function renderFormats(content: PanelContent, formats: readonly OutputFormat[]) {
    content.formats.replaceChildren(...formats.map(format => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'format';
        button.part.add('format');
        button.setAttribute('role', 'radio');
        button.dataset.format = format.id;
        button.textContent = format.id.toUpperCase();
        return button;
    }));
}

export interface Visibility {
    /** Tokens of the `hide` attribute. */
    hidden: readonly string[];

    /** Tokens of the `buttons` attribute. */
    buttons: readonly string[];

    lockOpacity: boolean;

    /** Whether the browser has an eyedropper, only Chromium does. */
    canPickFromScreen: boolean;
}

export function renderVisibility(content: PanelContent, {hidden, buttons, lockOpacity, canPickFromScreen}: Visibility) {
    const {preview, area, hue, alpha, input, formats, copy, eyeDropper, save, cancel, clear, controls} = content;

    preview.hidden = hidden.includes('preview');
    area.hidden = hidden.includes('area');
    hue.hidden = hidden.includes('hue');
    alpha.hidden = hidden.includes('alpha') || lockOpacity;
    input.hidden = hidden.includes('input');
    formats.hidden = hidden.includes('formats') || formats.children.length < 2;
    copy.hidden = !buttons.includes('copy');
    eyeDropper.hidden = !buttons.includes('eyedropper') || !canPickFromScreen;
    save.hidden = !buttons.includes('save');
    cancel.hidden = !buttons.includes('cancel');
    clear.hidden = !buttons.includes('clear');
    controls.hidden = [input, formats, copy, eyeDropper, save, cancel, clear].every(el => el.hidden);
}

/** Sets the accessible names of the trigger and the popup. */
export function renderShellLabels({trigger, panel}: Shell, labels: Labels) {
    trigger.setAttribute('aria-label', labels.toggle);
    panel.setAttribute('aria-label', labels.dialog);
}

/** Sets texts and accessible names of the panel's controls. Uses textContent and attributes only, never HTML. */
export function renderPanelLabels(content: PanelContent, labels: Labels) {
    const {area, hue, alpha, input, formats, swatches, saved, copy, eyeDropper, save, cancel, clear, sheetClose} = content;

    area.setAttribute('aria-label', labels.area);
    area.setAttribute('aria-roledescription', labels.areaRole);
    hue.setAttribute('aria-label', labels.hue);
    alpha.setAttribute('aria-label', labels.alpha);
    input.setAttribute('aria-label', labels.input);
    formats.setAttribute('aria-label', labels.formats);
    swatches.setAttribute('aria-label', labels.swatches);
    saved.setAttribute('aria-label', labels.saved);

    // Icon buttons, the title shows their name on hover
    for (const [button, label] of [[copy, labels.copy], [eyeDropper, labels.eyeDropper]] as const) {
        button.setAttribute('aria-label', label);
        button.title = label;
    }

    save.textContent = labels.save;
    cancel.textContent = labels.cancel;
    clear.textContent = labels.clear;
    sheetClose.textContent = labels.close;
}
