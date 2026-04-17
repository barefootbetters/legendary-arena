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
    // why: disabled under EC-102 — these two cosmetic whitespace rules
    // produced ~270 of the 307 lint warnings/errors in the EC-101 baseline.
    // None are semantic. Re-enable behind a dedicated formatting WP if the
    // team adopts a single-line-style convention.
    'vue/max-attributes-per-line': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    // why: EC-104 — force all dev-only logging through `devLog` (which is
    // gated by `DEBUG_VIEWER` and stripped from prod by DCE). `warn`/`error`
    // remain allowed for genuine user-facing failure messages.
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  overrides: [
    // why: EC-104 — `devLog.ts` and `debugMode.ts` are the approved
    // `console.*` exit points for the viewer. They are the only files
    // permitted to call `console.log`/`groupCollapsed`/`groupEnd`; every
    // other file must route through `devLog`.
    {
      files: ['src/lib/devLog.ts', 'src/lib/debugMode.ts'],
      rules: { 'no-console': 'off' },
    },
  ],
  ignorePatterns: ['dist/', 'node_modules/', '*.config.ts', '*.config.js'],
};
