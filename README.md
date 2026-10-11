<h1 align="center">Colora</h1>

<h3 align="center">
    Flat, simple, hackable color picker as web component.
</h3>

<p align="center">
  <a href="https://www.npmjs.com/package/colora"><img
     alt="npm version"
     src="https://img.shields.io/npm/v/colora.svg?color=3498DB"></a>
  <img alt="No dependencies" src="https://img.shields.io/badge/dependencies-none-27ae60.svg">
</p>

<br>

### Features
* 🧩 A `<colora-picker>` element that works with any framework, or none
* 📝 Works in forms like a native input: `name`, `value`, `required`, reset
* 🎨 Three themes, restyled with CSS custom properties and `::part()`
* 🌈 HEX, RGB, HSL, HSV, OKLCH and CMYK, including CSS named colors
* 🔍 Color comparison, opacity and swatches
* 📱 Mouse, touch and pen through pointer events, popup always on top through the Popover API
* ♿ Accessible: labelled sliders, keyboard support, translatable
* 🧪 TypeScript, fully tested in a real browser, no dependencies

## Getting started

```shell
npm install colora
```

Register the element once, then use it anywhere:

```js
import 'colora/define';
```

```html
<colora-picker value="#42445a" popup></colora-picker>
```

All styles are part of the JavaScript, there's no stylesheet to include.

## Usage

```html
<!-- Inline -->
<colora-picker value="#42445a"></colora-picker>

<!-- A button opening the picker -->
<colora-picker value="#42445a" popup theme="nano"></colora-picker>

<!-- With your own button -->
<colora-picker popup>
    <button slot="trigger">Pick a color</button>
</colora-picker>

<!-- In a form, submitted as color=#42445A -->
<form>
    <colora-picker name="color" value="#42445a" required popup></colora-picker>
</form>

<!-- Everything -->
<colora-picker
    value="rgb(66 68 90)"
    theme="classic"
    formats="hex rgb hsl oklch"
    swatches="#f44336 #e91e63 rgb(156, 39, 176) hsl(262 52% 47% / 0.85)"
    buttons="save cancel clear"
    placement="bottom-start"
    popup>
</colora-picker>
```

```js
const picker = document.querySelector('colora-picker');

picker.addEventListener('input', () => console.log('changing', picker.currentValue));
picker.addEventListener('change', () => console.log('committed', picker.value));
```

### Attributes

| Attribute | Description |
|-----------|-------------|
| `value` | Initial color, any supported format or CSS color name. |
| `name` | Name for form submission. |
| `popup` | Shows a button that opens the picker in a popover, instead of showing it inline. |
| `placement` | Where the popup opens: `top`, `bottom` (default), `left` or `right`, optionally with `-start` or `-end`. Flips if there's no space. |
| `theme` | `classic` (default), `monolith` or `nano`. |
| `formats` | Formats the user can switch between, default `hex rgb hsl`. Available: `hex`, `rgb`, `hsl`, `hsv`, `oklch`, `cmyk`. |
| `format` | Initially selected format. |
| `swatches` | Colors to choose from, separated by spaces or commas. |
| `buttons` | Any of `save`, `cancel` and `clear`. With a save button, changes are only committed on save, and closing the popup reverts them. |
| `hide` | Parts to hide: `preview`, `area`, `hue`, `alpha`, `input`, `formats`. |
| `lock-opacity` | Keeps colors fully opaque, hides the opacity slider. |
| `disabled` | Can't be opened or changed. Also applies within a disabled `<fieldset>`. |
| `required` | A color must be selected for the form to be valid. |

### Properties and methods

| | Description |
|-|-------------|
| `value` | The committed color in the selected format, `''` if cleared. Setting it doesn't emit events, `''` clears the color. |
| `currentValue` | The color being edited, differs from `value` until saved if there's a save button. |
| `color` | The committed color as `{h, s, v, a}`, `null` if cleared. |
| `formats` | Like the attribute, also accepts custom formats. |
| `swatches` | Like the attribute, as array. |
| `i18n` | Texts and accessible names, see [Translations](#translations). |
| `picker` | The underlying state controller, see [Building your own UI](#building-your-own-ui). |
| `showPicker()`, `hidePicker()` | Opens or closes the popup. |
| `form`, `validity`, `checkValidity()`, `reportValidity()` | Like on native inputs. |

### Events

| Event | Description |
|-------|-------------|
| `input` | The color is being changed. |
| `change` | The value was committed: after a change without save button, or when saved or cleared. |
| `cancel` | Changes were reverted. |
| `open`, `close` | The popup was opened or closed. |

Like native inputs, setting `value` or attributes doesn't emit events.

### Keyboard

The color area and sliders are focusable: arrow keys move by 1%, with <kbd>Shift</kbd> or <kbd>Page Up</kbd> / <kbd>Page Down</kbd> by 10%, <kbd>Home</kbd> and <kbd>End</kbd> jump to the ends.
The format buttons are a radio group switched with arrow keys. <kbd>Escape</kbd> closes the popup.

## Styling

Themes can be adjusted with custom properties:

```css
colora-picker {
    --cp-font-family: inherit;
    --cp-background: #1e1f24;
    --cp-text: #c8cad0;
    --cp-control-background: #2c2e35;
    --cp-accent: #7c5cff;       /* Save button, selected format */
    --cp-accent-text: #fff;
    --cp-danger: #f44250;       /* Cancel and clear buttons */
    --cp-radius: 0.15em;
    --cp-shadow: 0 0.15em 1.5em 0 rgb(0 0 0 / 0.1);
    --cp-focus: rgb(124 92 255 / 0.75);
    --cp-gap: 8px;              /* Distance between button and popup */
}
```

Anything else can be styled through parts:

```css
colora-picker::part(panel) { width: 20em; }
colora-picker::part(swatch) { border-radius: 50%; }
```

Parts: `trigger`, `panel`, `selection`, `preview`, `saved`, `current`, `area`, `slider`, `hue`, `alpha`, `thumb`, `swatches`, `swatch`, `swatch-active`, `controls`, `input`, `formats`, `format`, `button`, `save`, `cancel`, `clear`.

## Translations

```js
picker.i18n = {
    dialog: 'Selector de culori',
    toggle: 'Alege culoare',
    area: 'Saturație și luminozitate',
    hue: 'Nuanţă',
    alpha: 'Opacitate',
    input: 'Valoarea culorii',
    save: 'Salvează',
    cancel: 'Anulează',
    clear: 'Golește'
};
```

See `DEFAULT_LABELS` for all keys.

## Colors

The color utilities can be used on their own:

```js
import {parseColor, fillPowerless, oklch, rgb} from 'colora';

const parsed = parseColor('rebeccapurple'); // {format: 'named', color: {h: 270, s: 66.67, v: 60, a: 1}, ...}
rgb.stringify(parsed.color);                // 'rgb(102 51 153)'
oklch.stringify(parsed.color);              // 'oklch(44% 0.16 303)'
rgb.stringify(parsed.color, {legacy: true}) // 'rgba(102, 51, 153, 1)'
```

Invalid input, including out-of-range values, returns `null`. Colors outside of sRGB, like `oklch(70% 0.4 150)`, are mapped into sRGB as specified by CSS.
A format is an object with `parse` and `stringify`, so custom formats can be passed to `formats` as well.

## Building your own UI

The picker is built from parts that can be used separately:

* `createPicker(options)`: the headless state of a color picker, without any DOM. Holds the current and saved color, the text of the input, swatches and the open state, and emits typed events. Suited for building the picker in React, Vue, Svelte and the like.
* `createSlider(element, options)`, `createArea(element, options)`: pointer and keyboard handling for sliders and 2D areas.

```js
import {createPicker, createSlider} from 'colora';

const picker = createPicker({color: '#42445a'});
picker.subscribe(state => render(state));

createSlider(hueElement, {
    getValue: () => picker.getState().color.h / 360,
    onInput: value => picker.adjust({h: value * 360}),
    onCommit: () => picker.adjustEnd()
});
```

All of it is typed, see the declarations for details.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. The popup uses the [Popover API](https://caniuse.com/mdn-api_htmlelement_popover) and is positioned with CSS anchor positioning where supported,
with a JavaScript fallback otherwise.

## Contributing

```shell
pnpm install
pnpm exec playwright install chromium # Once, for browser tests
pnpm dev                               # Demo on http://localhost:5173
pnpm test                              # Unit tests in Node, everything else in Chromium
pnpm typecheck
pnpm lint
pnpm build:lib
```

See the [contributing guide](.github/CONTRIBUTING.md) for more.
