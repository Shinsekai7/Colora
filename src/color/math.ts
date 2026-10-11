export const clamp = (value: number, min = 0, max = 1): number =>
    Math.min(Math.max(value, min), max);

/** Modulo that always returns a non-negative result. */
export const mod = (value: number, n: number): number => ((value % n) + n) % n;

export const round = (value: number, decimals = 0): number => {
    const factor = 10 ** decimals;
    const rounded = Math.round(value * factor) / factor;
    return rounded === 0 ? 0 : rounded; // Avoid "-0"
};

/** Formats a number for output, dropping trailing zeros. */
export const fmt = (value: number, decimals = 0): string => String(round(value, decimals));

export const approx = (a: number, b: number, epsilon = 1e-7): boolean => Math.abs(a - b) < epsilon;
