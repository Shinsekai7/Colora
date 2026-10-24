# Changelog

All notable changes to Colora. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). Before 1.0, minor versions may contain breaking changes.

## [0.7.0] - 2026-10-24

### Fixed

- A popup that was linked to an input and then unlinked, e.g. by removing `for`, opened away from its own button: the input's position was still applied.

## [0.6.0] - 2026-10-24

### Added

- `copy` and `eyedropper` for the `buttons` attribute. Copying is announced to screen readers, and <kbd>Ctrl</kbd>+<kbd>C</kbd> (<kbd>Cmd</kbd>+<kbd>C</kbd> on macOS) copies the color from anywhere in the panel. The eyedropper is only shown in browsers that have one (Chromium) and keeps the opacity.
- `parseColor`, the text field and the `value` attribute read `hwb()`, `lab()`, `lch()`, `oklab()` and `color()` with the predefined color spaces `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz`, `xyz-d50` and `xyz-d65`. Colors outside of sRGB are mapped into it as specified by CSS. The formats are exported as `hwb`, `lab`, `lch`, `oklab` and `colorFunction`.
- `nameColor`, which describes a color in words, e.g. "dark grayish blue".
- The labels `saturation`, `brightness`, `copy`, `copied` and `eyeDropper`, and `colorName` to translate color names.
- The parts `copy` and `eyedropper`.

### Changed

- OKLCH output keeps 2 decimals by default, e.g. `oklch(39.39% 0.03722 280.49)` instead of `oklch(39% 0.037 280)`. Before, 90% of 8-bit colors turned into a different color when their OKLCH text was read back. Pass `precision: 0` for the old output.
- Screen readers hear named values and the color's name: the color area announces "Saturation 50%, Brightness 25%, dark grayish green" instead of "50%, 25%", the hue slider "120°, dark grayish green" instead of "120°", and swatches "red, #F44336" instead of "#F44336".

## [0.5.0] - 2026-10-12

### Changed

- Without a save button, popups compare with the color they were opened with, as every change is saved and the preview showed the same color twice. Clicking the previous color goes back to it.
- The `saved` label defaults to "Revert to previous color".
- Popups positioned with JavaScript keep a gap to the edges of the screen, e.g. those of linked inputs on phones.

## [0.4.0] - 2026-10-12

### Added

- The `for` attribute and `input` property link the picker to an existing `<input>`.
- On small touch screens the popup is a bottom sheet with bigger controls and a close button, see the `presentation` attribute, the `close` label and the parts `sheet-header` and `sheet-close`.

### Changed

- Popups only build their controls when first opened, so pages with many pickers stay light.
- A missing required value of a popup is reported at its button.
- <kbd>Escape</kbd> or a click outside closes the popup, and opening a picker closes other open popups on the page.

## [0.3.0] - 2026-10-12

No changes from 0.2.0.

## [0.2.0] - 2026-10-12

### Changed

- **Breaking:** the package is published as `@shinsekai/colora`.

## [0.1.0] - 2026-10-11

Initial release.

[0.7.0]: https://github.com/Shinsekai7/colora/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Shinsekai7/colora/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Shinsekai7/colora/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Shinsekai7/colora/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Shinsekai7/colora/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Shinsekai7/colora/compare/efd94e2...v0.2.0
[0.1.0]: https://github.com/Shinsekai7/colora/commit/efd94e2
