import js from '@eslint/js'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', '.opencode/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'off',
      // Los Set/Map/URLSearchParams locales no son estado reactivo de la UI.
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
  {
    // Svelte 5 runes en módulos .svelte.ts
    files: ['**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['src/routes/Instrucciones.svelte'],
    rules: {
      // instructions.md es contenido propio del repo, no input de usuario
      'svelte/no-at-html-tags': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
