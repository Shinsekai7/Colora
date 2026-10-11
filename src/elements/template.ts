import css from './picker.css?inline';

const TEMPLATE = `
<div class="root" part="root">
  <span class="anchor" part="anchor">
    <slot name="trigger">
      <button class="trigger" part="trigger" type="button" aria-haspopup="dialog" aria-controls="panel"></button>
    </slot>
  </span>
  <div class="panel" part="panel" id="panel">
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
    </div>
  </div>
</div>`;

// Shared by all instances, created on first use
let template: HTMLTemplateElement | undefined;
let sheet: CSSStyleSheet | undefined;

/** Fills the shadow root with the picker's markup and styles, returns its elements. */
export function createShadowContent(shadow: ShadowRoot) {
    template ??= Object.assign(document.createElement('template'), {innerHTML: TEMPLATE});

    if (!sheet) {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
    }

    shadow.adoptedStyleSheets = [sheet];
    shadow.append(template.content.cloneNode(true));

    const $ = <T extends HTMLElement = HTMLElement>(selector: string) => shadow.querySelector(selector) as T;

    return {
        root: $('.root'),
        anchor: $('.anchor'),
        trigger: $<HTMLButtonElement>('.trigger'),
        triggerSlot: $<HTMLSlotElement>('slot[name="trigger"]'),
        panel: $('.panel'),
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

export type Elements = ReturnType<typeof createShadowContent>;
