import css from './picker.css?inline';

const SHELL = `
<div class="root" part="root">
  <span class="anchor" part="anchor">
    <slot name="trigger">
      <button class="trigger" part="trigger" type="button" aria-haspopup="dialog" aria-controls="panel"></button>
    </slot>
  </span>
  <div class="panel" part="panel" id="panel"></div>
</div>`;

const PANEL = `
<div class="sheet-header" part="sheet-header">
  <button class="sheet-close" part="sheet-close" type="button"></button>
</div>
<div class="selection" part="selection">
  <div class="preview" part="preview">
    <button class="saved" part="saved" type="button"></button>
    <div class="current" part="current"></div>
  </div>
  <div class="area" part="area" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100">
    <div class="thumb" part="thumb area-thumb"></div>
  </div>
  <div class="slider hue" part="slider hue" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="360">
    <div class="thumb" part="thumb hue-thumb"></div>
  </div>
  <div class="slider alpha" part="slider alpha" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100">
    <div class="thumb" part="thumb alpha-thumb"></div>
  </div>
</div>
<div class="swatches" part="swatches" role="group"></div>
<div class="controls" part="controls">
  <input class="input" part="input" type="text" spellcheck="false" autocomplete="off">
  <div class="formats" part="formats" role="radiogroup"></div>
  <button class="button save" part="button save" type="button"></button>
  <button class="button cancel" part="button cancel" type="button"></button>
  <button class="button clear" part="button clear" type="button"></button>
</div>`;

// Shared by all instances, created on first use
let shellTemplate: HTMLTemplateElement | undefined;
let panelTemplate: HTMLTemplateElement | undefined;
let sheet: CSSStyleSheet | undefined;

const createTemplate = (html: string) => Object.assign(document.createElement('template'), {innerHTML: html});

const query = (root: ParentNode) => <T extends HTMLElement = HTMLElement>(selector: string) => root.querySelector(selector) as T;

/** Fills the shadow root with the styles, the trigger and the still empty panel, see `createPanelContent`. */
export function createShadowContent(shadow: ShadowRoot) {
    shellTemplate ??= createTemplate(SHELL);

    if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
    }

    shadow.adoptedStyleSheets = [sheet];
    shadow.append(shellTemplate.content.cloneNode(true));

    const $ = query(shadow);

    return {
        root: $('.root'),
        anchor: $('.anchor'),
        trigger: $<HTMLButtonElement>('.trigger'),
        triggerSlot: $<HTMLSlotElement>('slot[name="trigger"]'),
        panel: $('.panel')
    };
}

/** Fills the panel with the controls. Popups only do that once they're first opened. */
export function createPanelContent(panel: HTMLElement) {
    panelTemplate ??= createTemplate(PANEL);
    panel.append(panelTemplate.content.cloneNode(true));

    const $ = query(panel);

    return {
        sheetClose: $<HTMLButtonElement>('.sheet-close'),
        preview: $('.preview'),
        saved: $<HTMLButtonElement>('.saved'),
        area: $('.area'),
        hue: $('.hue'),
        alpha: $('.alpha'),
        swatches: $('.swatches'),
        controls: $('.controls'),
        input: $<HTMLInputElement>('.input'),
        formats: $('.formats'),
        save: $<HTMLButtonElement>('.save'),
        cancel: $<HTMLButtonElement>('.cancel'),
        clear: $<HTMLButtonElement>('.clear')
    };
}

/** Always present: the trigger and the panel's container. */
export type Shell = ReturnType<typeof createShadowContent>;

/** The controls inside the panel. */
export type PanelContent = ReturnType<typeof createPanelContent>;
