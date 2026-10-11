// color-name ships without types, it's only used in tests
declare module 'color-name' {
    const colors: Record<string, [number, number, number]>;
    export default colors;
}