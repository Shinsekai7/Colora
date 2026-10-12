import {define} from '/src/elements/index.ts';

// Called explicitly: `sideEffects` in package.json only covers dist/, so a plain
// `import '/src/define.ts'` would be removed from the production build
define();

const SWATCHES = [
    '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
    '#2196f3', '#00bcd4', '#4caf50', '#ffeb3b', 'rgb(255 152 0 / 0.8)'
];

const DEFAULT_FORMATS = 'hex rgb hsl';

// Custom properties for a dark picker
const DARK = {
    '--cp-background': '#1f2128',
    '--cp-text': '#c9ccd3',
    '--cp-control-background': '#2c2f38',
    '--cp-shadow': '0 0.15em 1.5em 0 rgb(0 0 0 / 0.5)',
    '--cp-checkerboard': 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 0.5em 0.5em'
};

const form = document.getElementById('controls');
const stage = document.getElementById('stage');
const valueOutput = document.getElementById('value');
const eventList = document.getElementById('events');
const code = document.getElementById('code');
const placement = form.elements.placement;
const presentation = document.getElementById('presentation-control');

// Added to the page once configured, so the popup only builds its controls when first opened
const picker = document.createElement('colora-picker');
picker.setAttribute('value', '#5856d6');

// Shown with the "Linked input" trigger, the picker is linked to it
const textInput = document.createElement('input');
textInput.id = 'demo-color';
textInput.className = 'demo-input';
textInput.spellcheck = false;
textInput.setAttribute('aria-label', 'Color');

/** Reads the form into a configuration. */
function readConfig() {
    const data = new FormData(form);
    const shown = data.getAll('show');

    return {
        theme: data.get('theme'),
        popup: data.get('display') === 'popup',
        presentation: data.get('presentation'),
        linked: data.get('trigger') === 'input',
        dark: data.get('appearance') === 'dark',
        formats: data.getAll('formats'),
        buttons: data.getAll('buttons'),
        hidden: ['preview', 'hue', 'input'].filter(part => !shown.includes(part)),
        swatches: data.has('swatches'),
        opacity: data.has('opacity'),
        disabled: data.has('disabled'),
        placement: data.get('placement')
    };
}

/** Attributes for a configuration, defaults are left out. Boolean attributes have an empty value. */
function attributesOf(config) {
    const formats = config.formats.join(' ');

    const attributes = [
        ['for', config.linked ? 'color' : null],
        ['theme', config.theme !== 'horizontal' ? config.theme : null],
        ['popup', config.popup ? '' : null],
        ['presentation', config.popup && config.presentation !== 'auto' ? config.presentation : null],
        ['placement', config.popup && config.presentation !== 'sheet' && config.placement !== 'bottom' ? config.placement : null],
        ['formats', formats !== DEFAULT_FORMATS ? formats : null],
        ['buttons', config.buttons.length ? config.buttons.join(' ') : null],
        ['hide', config.hidden.length ? config.hidden.join(' ') : null],
        ['swatches', config.swatches ? SWATCHES.join(' ') : null],
        ['lock-opacity', config.opacity ? null : ''],
        ['disabled', config.disabled ? '' : null]
    ];

    return attributes.filter(([, value]) => value !== null);
}

function apply() {
    const config = readConfig();
    const attributes = new Map(attributesOf(config));

    for (const name of ['theme', 'popup', 'presentation', 'placement', 'formats', 'buttons', 'hide', 'swatches', 'lock-opacity', 'disabled']) {
        if (attributes.has(name)) {
            picker.setAttribute(name, attributes.get(name));
        } else {
            picker.removeAttribute(name);
        }
    }

    // The live input has its own id, the code uses a plainer one
    if (config.linked) {
        stage.prepend(textInput);
        picker.setAttribute('for', textInput.id);
    } else {
        picker.removeAttribute('for');
        textInput.remove();
    }

    // The picker's popup is in the top layer, the stage only gets darker for the inline one
    for (const [property, value] of Object.entries(DARK)) {
        if (config.dark) {
            picker.style.setProperty(property, value);
        } else {
            picker.style.removeProperty(property);
        }
    }

    stage.classList.toggle('dark', config.dark);
    presentation.disabled = !config.popup;
    placement.disabled = !config.popup || config.presentation === 'sheet';
    render(config);
}

/** Shows the value and the code for the current configuration. */
function render(config = readConfig()) {
    valueOutput.textContent = picker.value || '(cleared)';
    renderCode(config);
}

/* Code */

const token = (text, type) => ({text, type});

function codeLines(config) {
    const attributes = attributesOf(config);

    // A linked input holds the color itself
    if (picker.value && !config.linked) {
        attributes.unshift(['value', picker.value]);
    }

    const attributeTokens = ([name, value]) => value === ''
        ? [token(name, 'attr')]
        : [token(name, 'attr'), token('="'), token(value, 'value'), token('"')];

    const lines = [
        [token('<script', 'tag'), token(' '), token('type', 'attr'), token('="'), token('module', 'value'), token('"'), token('>', 'tag')],
        [token('    import '), token("'@shinsekai/colora/define'", 'value'), token(';')],
        [token('</script>', 'tag')],
        []
    ];

    if (config.linked) {
        const inputAttributes = [['id', 'color'], ['name', 'color'], ['value', picker.value]];
        lines.push([
            token('<input', 'tag'),
            ...inputAttributes.flatMap(attribute => [token(' '), ...attributeTokens(attribute)]),
            token('>', 'tag')
        ]);
    }

    if (attributes.length <= 1) {
        lines.push([
            token('<colora-picker', 'tag'),
            ...attributes.flatMap(attribute => [token(' '), ...attributeTokens(attribute)]),
            token('></colora-picker>', 'tag')
        ]);
    } else {
        lines.push([token('<colora-picker', 'tag')]);
        attributes.forEach((attribute, index) => lines.push([
            token('    '),
            ...attributeTokens(attribute),
            ...(index === attributes.length - 1 ? [token('>', 'tag')] : [])
        ]));
        lines.push([token('</colora-picker>', 'tag')]);
    }

    if (config.dark) {
        lines.push([], [token('<style>', 'tag')], [token('    colora-picker {')]);

        for (const [property, value] of Object.entries(DARK)) {
            lines.push([token('        '), token(property, 'attr'), token(': '), token(value, 'value'), token(';')]);
        }

        lines.push([token('    }')], [token('</style>', 'tag')]);
    }

    return lines;
}

let codeText = '';

function renderCode(config) {
    const lines = codeLines(config);
    codeText = lines.map(line => line.map(t => t.text).join('')).join('\n');

    code.replaceChildren(...lines.flatMap((line, index) => [
        ...line.map(({text, type}) => {
            if (!type) {
                return document.createTextNode(text);
            }

            const span = document.createElement('span');
            span.className = `tok-${type}`;
            span.textContent = text;
            return span;
        }),
        ...(index < lines.length - 1 ? [document.createTextNode('\n')] : [])
    ]));
}

/* Events */

function logEvent(type) {
    const last = eventList.firstElementChild;

    // Repeated input events while dragging are counted instead of listed one by one
    if (last?.dataset.type === type) {
        last.dataset.count = String(Number(last.dataset.count) + 1);
        last.textContent = `${type} ×${last.dataset.count}`;
        return;
    }

    const item = document.createElement('li');
    item.dataset.type = type;
    item.dataset.count = '1';
    item.textContent = type;
    eventList.prepend(item);

    while (eventList.children.length > 6) {
        eventList.lastElementChild.remove();
    }
}

for (const type of ['input', 'change', 'cancel', 'open', 'close']) {
    picker.addEventListener(type, () => {
        logEvent(type);
        render();
    });
}

/* Controls */

form.addEventListener('change', event => {
    const {target} = event;

    // At least one format has to stay selected
    if (target.name === 'formats' && !form.querySelector('input[name="formats"]:checked')) {
        target.checked = true;
    }

    apply();
});

/* Copy buttons */

async function copy(button, text) {
    const label = button.textContent;

    try {
        await navigator.clipboard.writeText(text);
        button.textContent = 'Copied!';
        button.classList.add('copied');
    } catch {
        button.textContent = 'Copy failed';
    }

    setTimeout(() => {
        button.textContent = label;
        button.classList.remove('copied');
    }, 1500);
}

document.getElementById('copy-code').addEventListener('click', event => copy(event.currentTarget, codeText));

for (const button of document.querySelectorAll('[data-copy]')) {
    button.addEventListener('click', () => copy(button, button.dataset.copy));
}

apply();
stage.append(picker);
