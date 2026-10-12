import {computePosition, parsePlacement, toPositionArea} from './attributes.js';
import type {Shell} from './template.js';

export interface PopupOptions {
    host: HTMLElement;
    els: Shell;

    /** The color area once the panel's content is built, it gets the focus when opening. */
    area(): HTMLElement | null;

    /** Value of the `placement` attribute. */
    placement(): string | null;

    /** Whether to use CSS anchor positioning, positions with JavaScript otherwise. */
    anchorPositioning(): boolean;

    /** A linked input, it opens the popup and the popup is placed next to it. */
    linked(): HTMLElement | null;

    /** Value of the `presentation` attribute. */
    presentation(): string | null;

    /**
     * The popup is about to open or close, e.g. through its trigger, a click outside or Escape.
     * Returns whether that's allowed, a disabled picker can't be opened.
     */
    onToggle(open: boolean): boolean;
}

/** Screens where `presentation="auto"` shows a bottom sheet: small touch screens. */
export const SHEET_QUERY = '(pointer: coarse) and (max-width: 640px)';

/** The focused element, also inside shadow roots. */
function deepActiveElement(): HTMLElement | null {
    let element = document.activeElement;

    while (element?.shadowRoot?.activeElement) {
        element = element.shadowRoot.activeElement;
    }

    return element instanceof HTMLElement && element !== document.body ? element : null;
}

/**
 * Shows the panel as popover next to the trigger. The browser handles closing on clicks outside
 * and Escape, returning the focus and stacking with other popovers (`popover="auto"`).
 */
export class Popup {
    readonly #options: PopupOptions;

    /** Listeners only needed while open, e.g. to follow the trigger when scrolling. */
    #openListeners: AbortController | null = null;

    /** Whether the popup was open when the pointer went down on the trigger, see #onTriggerClick. */
    #openAtPointerDown: boolean | null = null;

    /** Set while the popup is opened or closed by the browser, the state is already up to date then. */
    #toggling = false;

    /** The popup was opened through `sync`, the toggle event doesn't need to set it up again. */
    #openedHere = false;

    /** Where the focus goes back to when closing, see #onBeforeToggle. */
    #returnFocusTo: HTMLElement | null = null;
    #focusWasInside = false;

    /** Set during a click on a trigger, so the focus can go back to it. */
    #triggerClicked = false;

    constructor(options: PopupOptions) {
        this.#options = options;
        const {panel, anchor} = options.els;

        panel.addEventListener('beforetoggle', event => this.#onBeforeToggle(event));
        panel.addEventListener('toggle', event => this.#onToggle(event));
        anchor.addEventListener('pointerdown', () => this.#openAtPointerDown = this.#isOpen, {capture: true});
        anchor.addEventListener('click', event => this.#onTriggerClick(event));
    }

    /** Whether the popup is shown as bottom sheet, see `SHEET_QUERY` for `presentation="auto"`. */
    get #isSheet() {
        switch (this.#options.presentation()) {
            case 'sheet':
                return true;
            case 'popover':
                return false;
            default:
                // On phones the keyboard of a linked input would compete with a sheet for the space
                return !this.#options.linked() && typeof matchMedia === 'function' && matchMedia(SHEET_QUERY).matches;
        }
    }

    get #isOpen() {
        return this.#options.els.panel.matches(':popover-open');
    }

    /** Turns the panel into a popover, or back into an inline panel. */
    setEnabled(enabled: boolean) {
        const {panel, trigger} = this.#options.els;
        this.updateLink(enabled);

        if (enabled) {
            panel.popover = 'auto';
            panel.setAttribute('role', 'dialog');

            // Lets the browser toggle the popover with the default trigger and treat it as its invoker
            trigger.popoverTargetElement = panel;
            this.updatePlacement();
        } else {
            this.sync(false);
            panel.removeAttribute('popover');
            panel.setAttribute('role', 'group');
            trigger.popoverTargetElement = null;
        }
    }

    /**
     * Applies a linked input: it replaces the trigger, the popup is anchored to it,
     * and the focus stays in it when the popup opens, so it can still be typed in.
     */
    updateLink(enabled = !!this.#options.els.panel.popover) {
        const {els: {root}, linked} = this.#options;
        const link = linked();
        const area = this.#options.area();

        root.classList.toggle('linked', !!link);

        // The browser focuses it when opening, and only then returns the focus when closing
        if (area) {
            area.autofocus = enabled && !link;
        }

        this.updatePlacement();
    }

    /**
     * Whether the position is set with JavaScript. A linked input is outside the shadow root,
     * where CSS anchor names can't be referenced, so it's always positioned that way.
     */
    get #positionedByScript() {
        return !this.#isSheet && (!this.#options.anchorPositioning() || !!this.#options.linked());
    }

    /** Opens or closes the popover to match the state, e.g. after `showPicker()`. */
    sync(open: boolean) {
        const {host, els: {panel}} = this.#options;

        if (this.#toggling || !panel.popover || !host.isConnected || this.#isOpen === open) {
            return;
        }

        if (open) {
            // The source makes the trigger the invoker, also for custom slotted triggers
            panel.showPopover({source: this.#trigger()});

            // The toggle event comes later, set up right away so e.g. the position is correct immediately
            this.#afterOpen();
            this.#openedHere = true;
        } else {
            panel.hidePopover();
        }
    }

    /**
     * Applies the `presentation` and `placement` attributes.
     * With CSS anchor positioning, the browser keeps the position up to date.
     */
    updatePlacement() {
        const {els: {panel, anchor}, placement} = this.#options;
        const resolved = parsePlacement(placement());
        const sheet = this.#isSheet;
        const fallback = this.#positionedByScript;

        panel.classList.toggle('sheet', sheet);
        panel.classList.toggle('fallback-position', fallback);

        // The sheet is placed by its styles, at the bottom of the screen
        if (sheet) {
            panel.style.margin = '';
            panel.style.removeProperty('position-area');
            panel.style.left = '';
            panel.style.top = '';
            return;
        }

        if (!fallback) {
            // The gap only applies towards the trigger, so start / end alignment stays flush
            const vertical = resolved.side === 'top' || resolved.side === 'bottom';
            panel.style.margin = vertical ? 'var(--cp-gap) 0' : '0 var(--cp-gap)';
            panel.style.setProperty('position-area', toPositionArea(resolved));
            return;
        }

        panel.style.margin = '';

        if (!this.#isOpen) {
            return;
        }

        const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--cp-gap')) || 8;
        const {width, height} = panel.getBoundingClientRect();
        const {x, y} = computePosition(
            (this.#options.linked() ?? anchor).getBoundingClientRect(),
            {width, height},
            {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight},
            resolved,
            gap
        );

        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
    }

    /** After the `presentation` attribute changed, also while open. */
    updatePresentation() {
        this.updatePlacement();

        if (this.#isOpen) {
            this.#listenWhileOpen(true);
        }
    }

    /** Removes listeners from the document, e.g. once the element is removed. */
    destroy() {
        this.#listenWhileOpen(false);
    }

    /** The linked input, the slotted custom trigger, or the default one. */
    #trigger(): HTMLElement {
        const {triggerSlot, trigger} = this.#options.els;
        return this.#options.linked() ?? (triggerSlot.assignedElements()[0] as HTMLElement | undefined) ?? trigger;
    }

    /**
     * Keeps the state in sync when the browser opens or closes the popover, or cancels it.
     * Also remembers where the focus has to go back to: browsers don't do that for popovers in shadow roots.
     */
    #onBeforeToggle(event: ToggleEvent) {
        const open = event.newState === 'open';
        const focused = deepActiveElement();

        if (open) {
            this.#returnFocusTo = this.#triggerClicked ? this.#trigger() : focused;
        } else {
            this.#focusWasInside = !!focused && this.#options.els.panel.contains(focused);
        }

        this.#toggling = true;
        const allowed = this.#options.onToggle(open);
        this.#toggling = false;

        // Only opening can be canceled
        if (!allowed && open) {
            event.preventDefault();
        }
    }

    /**
     * Opened by the browser, e.g. with the trigger. Opening through `sync` already did the setup.
     * Runs after the event that closed the popup, so e.g. the Enter key that closed it can't reach the trigger.
     */
    #onToggle(event: ToggleEvent) {
        if (event.newState === 'open' && !this.#openedHere) {
            this.#afterOpen();
        } else if (event.newState === 'closed') {
            this.#listenWhileOpen(false);

            // Like native popovers: only if the focus was inside, e.g. not after clicking somewhere else
            if (this.#focusWasInside && this.#returnFocusTo?.isConnected) {
                this.#returnFocusTo.focus({preventScroll: true});
            }

            this.#returnFocusTo = null;
            this.#focusWasInside = false;
        }

        this.#openedHere = false;
    }

    /** The browser already focused the color area (`autofocus`). */
    #afterOpen() {
        this.updatePlacement();
        this.#listenWhileOpen(true);
    }

    /**
     * Custom slotted triggers. The default trigger is handled by the browser.
     * Where `showPopover({source})` isn't supported, the browser doesn't know the trigger and closes
     * the popover as soon as it's pressed, so its state from before the press is used.
     */
    #onTriggerClick(event: MouseEvent) {
        const wasOpen = this.#openAtPointerDown ?? this.#isOpen;
        this.#openAtPointerDown = null;

        // The default trigger toggles the popover after all click listeners ran, so this has to last until then
        this.#triggerClicked = true;
        setTimeout(() => this.#triggerClicked = false);

        if (event.composedPath().includes(this.#options.els.trigger)) {
            return;
        }

        this.#options.onToggle(!wasOpen);
    }

    /**
     * While open: switches between sheet and popover when the screen changes, e.g. when rotating a tablet,
     * and follows the trigger when it's positioned with JavaScript.
     */
    #listenWhileOpen(listen: boolean) {
        this.#openListeners?.abort();
        this.#openListeners = null;

        if (!listen) {
            return;
        }

        const controller = new AbortController();
        const {signal} = controller;
        const reposition = () => this.updatePlacement();
        this.#openListeners = controller;

        if (typeof matchMedia === 'function') {
            matchMedia(SHEET_QUERY).addEventListener('change', () => {
                this.updatePlacement();
                this.#listenWhileOpen(true);
            }, {signal});
        }

        if (this.#positionedByScript) {
            window.addEventListener('resize', reposition, {signal, passive: true});
            document.addEventListener('scroll', reposition, {capture: true, signal, passive: true});
        }
    }
}
