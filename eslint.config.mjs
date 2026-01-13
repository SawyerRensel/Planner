// eslint.config.mjs
import tsparser from "@typescript-eslint/parser";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import sdl from "@microsoft/eslint-plugin-sdl";
import importPlugin from "eslint-plugin-import";

export default [
  // TypeScript files configuration
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module"
      },
    },
    plugins: {
      "obsidianmd": obsidianmd,
      "@microsoft/sdl": sdl,
      "import": importPlugin,
    },
    rules: {
      // Obsidian plugin rules
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-file-manager-trash-file": "warn",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/ui/sentence-case": ["warn", {
        brands: ["Planner"],
        acronyms: ["OK", "ID", "UTC", "ISO"]
      }],

      // Microsoft SDL rules (no innerHTML)
      "@microsoft/sdl/no-document-write": "error",
      "@microsoft/sdl/no-inner-html": "error",

      // TypeScript rules
      "@typescript-eslint/no-explicit-any": ["error", { fixToUnknown: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { args: "none" }],
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/require-await": "off",

      // General rules
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-self-compare": "warn",
      "no-eval": "error",
      "no-implied-eval": "error",
      "prefer-const": "off",
      "no-implicit-globals": "error",
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],
      "no-alert": "error",
    },
  },
  // Ignore patterns
  {
    ignores: ["node_modules/**", "ref/**", "timeline-build/**", "main.js", "*.mjs"]
  }
];
