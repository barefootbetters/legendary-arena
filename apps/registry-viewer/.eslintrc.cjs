// why: enforces a11y regressions can't silently land — pairs with the
// existing ARIA work (role="dialog"/aria-modal in ImageLightbox,
// role="status"/aria-live on the loading region, aria-label on
// interactive controls). Keeps rules at "recommended" for both Vue 3
// and vuejs-accessibility; tighten later if false-positives warrant.
/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:vuejs-accessibility/recommended',
    '@vue/eslint-config-typescript',
  ],
  rules: {
    // why: card data comes from untyped JSON with permissive Zod schemas;
    // narrow `any` elimination belongs in a typed-data WP, not here.
    '@typescript-eslint/no-explicit-any': 'off',
    // why: Vue 3 allows single-word component names when they clearly read
    // as custom (App.vue is the canonical root). No risk of clashing with
    // native HTML elements in this project.
    'vue/multi-word-component-names': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.config.ts', '*.config.js'],
};
