import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';
import {mouse} from './test.commands.js';

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    name: 'unit',
                    include: ['src/**/*.test.ts'],
                    exclude: ['src/**/*.browser.test.ts'],
                    setupFiles: ['build/test.setup.ts'],
                    environment: 'node'
                }
            },
            {
                test: {
                    name: 'browser',
                    include: ['src/**/*.browser.test.ts'],
                    browser: {
                        enabled: true,
                        headless: true,
                        provider: playwright(),
                        instances: [{browser: 'chromium'}],
                        commands: {mouse}
                    }
                }
            }
        ]
    }
});
