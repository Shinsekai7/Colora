/**
 * Splits a list attribute at whitespace and commas, except within parentheses,
 * so `"#f00, rgb(0, 0, 0) hsl(0 0% 0%)"` gives three colors.
 */
export function parseList(value: string | null): string[] {
    const items: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of value ?? '') {
        if (char === '(') {
            depth++;
        } else if (char === ')') {
            depth = Math.max(0, depth - 1);
        }

        if (depth === 0 && (char === ',' || /\s/.test(char))) {
            if (current) {
                items.push(current);
            }

            current = '';
        } else {
            current += char;
        }
    }

    return current ? [...items, current] : items;
}

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Align = 'start' | 'center' | 'end';
export type Placement = Side | `${Side}-start` | `${Side}-end`;

export const DEFAULT_PLACEMENT: Placement = 'bottom';

export function parsePlacement(value: string | null): { side: Side; align: Align } {
    const match = /^(top|bottom|left|right)(?:-(start|end))?$/.exec(value?.trim() ?? '');

    if (!match) {
        return parsePlacement(DEFAULT_PLACEMENT);
    }

    return {side: match[1] as Side, align: (match[2] as Align | undefined) ?? 'center'};
}

/** CSS `position-area` for a placement, used where anchor positioning is supported. */
export function toPositionArea({side, align}: { side: Side; align: Align }): string {
    const vertical = side === 'top' || side === 'bottom';
    const main = {top: 'block-start', bottom: 'block-end', left: 'inline-start', right: 'inline-end'}[side];
    const cross = vertical ? 'inline' : 'block';

    switch (align) {
        case 'start':
            return `${main} span-${cross}-end`;
        case 'end':
            return `${main} span-${cross}-start`;
        default:
            return main;
    }
}

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

/**
 * Fallback positioning for browsers without CSS anchor positioning.
 * Places the panel next to the anchor, flips it to the other side if it doesn't fit
 * and keeps it within the viewport.
 */
export function computePosition(
    anchor: Rect,
    panel: { width: number; height: number },
    viewport: { width: number; height: number },
    {side, align}: { side: Side; align: Align },
    gap = 8
): { x: number; y: number } {
    const vertical = side === 'top' || side === 'bottom';

    // Position along the main axis, flipped if there's only space on the other side
    const mainAxis = (start: number, anchorSize: number, panelSize: number, viewportSize: number, before: boolean) => {
        const above = start - gap - panelSize;
        const below = start + anchorSize + gap;
        const fitsAbove = above >= 0;
        const fitsBelow = below + panelSize <= viewportSize;

        if (before) {
            return fitsAbove || !fitsBelow ? above : below;
        }

        return fitsBelow || !fitsAbove ? below : above;
    };

    // Position along the cross axis, kept within the viewport and the gap away from its edges where there's room
    const crossAxis = (start: number, anchorSize: number, panelSize: number, viewportSize: number) => {
        const position = align === 'start' ? start : align === 'end' ? start + anchorSize - panelSize : start + (anchorSize - panelSize) / 2;
        const margin = Math.min(gap, Math.max(0, (viewportSize - panelSize) / 2));
        return Math.max(margin, Math.min(position, viewportSize - panelSize - margin));
    };

    return vertical ? {
        x: crossAxis(anchor.left, anchor.width, panel.width, viewport.width),
        y: mainAxis(anchor.top, anchor.height, panel.height, viewport.height, side === 'top')
    } : {
        x: mainAxis(anchor.left, anchor.width, panel.width, viewport.width, side === 'left'),
        y: crossAxis(anchor.top, anchor.height, panel.height, viewport.height)
    };
}
