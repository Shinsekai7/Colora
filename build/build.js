// Builds the library into dist/, run with `pnpm build:lib`
import {rm} from 'node:fs/promises';
import {build} from 'vite';
import banner from 'vite-plugin-banner';
import pkg from '../package.json' with {type: 'json'};

const header = `/*! Colora ${pkg.version} MIT */`;

const config = (lib, output = {}) => ({
    configFile: false,
    logLevel: 'warn',
    plugins: [banner(header)],
    build: {
        emptyOutDir: false,
        sourcemap: true,
        lib,
        rolldownOptions: {output}
    }
});

await rm('dist', {recursive: true, force: true});

// ES modules for bundlers, shared code ends up in chunks
await build(config({
    entry: {index: 'src/index.ts', define: 'src/define.ts'},
    formats: ['es'],
    fileName: (_, name) => `${name}.mjs`
}, {chunkFileNames: 'chunks/[name]-[hash].mjs'}));

// Registers <colora-picker>, for a plain script tag
await build(config({
    entry: 'src/define.ts',
    name: 'Colora',
    formats: ['iife'],
    fileName: () => 'colora.min.js'
}));
