import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import {defineConfig} from "eslint/config";

export default defineConfig([
    {
        ignores: ["**/node_modules/**", "**/dist/**"],
    },
    {
        files: ["**/*.{js,mjs,cjs}"],
        plugins: {js},
        extends: ["js/recommended"],
        languageOptions: {
            globals: globals.browser
        }
    },
    {
        files: ["**/*.{ts,mts}"],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        languageOptions: {
            globals: globals.browser
        }
    },
]);
