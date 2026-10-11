import {computePosition, parsePlacement, toPositionArea} from './attributes.js';
import type {Elements} from './template.js';

export interface PopupOptions {
    host: HTMLElement;
    shadow: ShadowRoot;
    els: Elements;

    /** Value of the `placement` attribute. */
    placement(): string | null;

    /** Whether to use CSS anchor positioning, positions with JavaScript otherwise. */
    anchorPositioning(): boolean;

    /** The user clicked outside or pressed Escape. */
    onDismiss(): void;
}

/**
 * Shows the panel as popover next to the trigger: positioning, closing on clicks outside
 * and Escape, and returning the focus to the trigger.
 */
export class Popup {
    readonly #options: PopupOptions;
    #documentListeners: AbortController | null = null;

    constructor(options: PopupOptions) {
        this.#options = options;
    }

    /** Turns the panel into a popover, or back into an inline panel. */
    setEnabled(enabled: boolean) {
        const {panel} = this.#options.els;

        if (enabled) {
            panel.popover = 'manual';
            panel.setAttribute('role', 'dialog');
        } else {
            this.sync(false);
            panel.removeAttribute('popover');
            panel.setAttribute('role', 'group');
        }
    }

    /** Opens or closes the popover. */
    sync(open: boolean) {
        const {host, shadow, els: {panel, area}} = this.#options;

        if (!panel.popover || !host.isConnected || panel.matches(':popover-open') === open) {
            return;
        }

        if (open) {
            panel.showPopover();
            this.position();
            this.#listenToDocument(true);
            area.focus({preventScroll: true});
        } else {
            const hadFocus = shadow.activeElement !== null && panel.contains(shadow.activeElement);
            panel.hidePopover();
            this.#listenToDocument(false);

            // Deferred: if closed by a keydown handler (e.g. on Enter), focusing the trigger right away
            // would let the same key press activate it and reopen the popup
            if (hadFocus) {
                setTimeout(() => this.#trigger().focus({preventScroll: true}));
            }
        }
    }

    position() {
        const {els: {panel, anchor}, placement, anchorPositioning} = this.#options;
        const resolved = parsePlacement(placement());
        const fallback = !anchorPositioning();

        panel.classList.toggle('fallback-position', fallback);

        if (!fallback) {
            // The gap only applies towards the trigger, so start / end alignment stays flush
            const vertical = resolved.side === 'top' || resolved.side === 'bottom';
            panel.style.margin = vertical ? 'var(--cp-gap) 0' : '0 var(--cp-gap)';
            panel.style.setProperty('position-area', toPositionArea(resolved));
            return;
        }

        panel.style.margin = '';

        const gap = parseFloat(getComputedStyle(panel).getPropertyValue('--cp-gap')) || 8;
        const {width, height} = panel.getBoundingClientRect();
        const {x, y} = computePosition(
            anchor.getBoundingClientRect(),
            {width, height},
            {width: document.documentElement.clientWidth, height: document.documentElement.clientHeight},
            resolved,
            gap
        );

        panel.style.left = `${x}px`;
        panel.style.top = `${y}px`;
    }

    /** Removes listeners from the document, e.g. once the element is removed. */
    destroy() {
        this.#listenToDocument(false);
    }

    /** The slotted custom trigger, or the default one. */
    #trigger(): HTMLElement {
        const {triggerSlot, trigger} = this.#options.els;
        return (triggerSlot.assignedElements()[0] as HTMLElement | undefined) ?? trigger;
    }

    /** While open: close on clicks outside and Escape, keep the fallback position up to date. */
    #listenToDocument(listen: boolean) {
        this.#documentListeners?.abort();
        this.#documentListeners = null;

        if (!listen) {
            return;
        }

        const {host, onDismiss, anchorPositioning} = this.#options;
        const controller = new AbortController();
        const options = {capture: true, signal: controller.signal};
        this.#documentListeners = controller;

        document.addEventListener('pointerdown', event => {
            if (!event.composedPath().includes(host)) {
                onDismiss();
            }
        }, options);

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onDismiss();
            }
        }, options);

        if (!anchorPositioning()) {
            const reposition = () => this.position();
            window.addEventListener('resize', reposition, {signal: controller.signal, passive: true});
            document.addEventListener('scroll', reposition, {...options, passive: true});
        }
    }
}
