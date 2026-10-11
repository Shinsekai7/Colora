import {hsvToRgb} from '../convert.js';
import type {OutputFormat} from '../types.js';
import {fromRgb} from './shared.js';

const HEX = /^#?([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i;

const toHex = (channel: number) => Math.round(channel * 255).toString(16).padStart(2, '0');

/** `#RGB`, `#RGBA`, `#RRGGBB` and `#RRGGBBAA`. The leading `#` is optional when parsing. */
export const hex: OutputFormat = {
    id: 'hex',

    parse(input) {
        const match = HEX.exec(input.trim());
        if (!match?.[1]) {
            return null;
        }

        let digits = match[1];
        if (digits.length <= 4) {
            digits = [...digits].map(d => d + d).join('');
        }

        const [r = 0, g = 0, b = 0, a = 255] = (digits.match(/../g) ?? []).map(v => parseInt(v, 16) / 255);
        return fromRgb('hex', {r, g, b}, a === 255 ? 1 : a);
    },

    stringify(color) {
        const {r, g, b} = hsvToRgb(color);
        const alpha = color.a < 1 ? toHex(color.a) : '';
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha}`.toUpperCase();
    }
};
