# @legendary-arena/vue-sfc-loader

A Node module-loader hook that compiles Vue 3 Single-File Components
(`.vue`) on the fly so they can be imported directly by `node:test`.

This package is **tests-only**. Runtime SFC handling in Vite for
`pnpm dev` and `pnpm build` is unchanged — `@vitejs/plugin-vue` remains
the runtime transform. This loader exists so consumer `.test.ts` files
can write `import HelloWorld from './HelloWorld.vue'` and mount it with
`@vue/test-utils` under `node:test` + `jsdom`.

---

## Install

This package is private and lives inside the `legendary-arena`
monorepo. Add it as a `devDependency` of the consuming app:

```jsonc
{
  "devDependencies": {
    "@legendary-arena/vue-sfc-loader": "workspace:*"
  }
}
```

Never add this package to `dependencies`. The Shared Tooling layer is
test-time only; production bundles must not ship the loader.

---

## Canonical `NODE_OPTIONS` composition

Consumers opt in by setting `NODE_OPTIONS` before `node:test`:

```sh
NODE_OPTIONS="--import tsx --import @legendary-arena/vue-sfc-loader/register"
```

The order is fixed and load-bearing:

1. `tsx` first — so consumer `.test.ts` files are TypeScript-transformed.
2. `@legendary-arena/vue-sfc-loader/register` second — so `.vue`
   imports are SFC-compiled by this package.

Reversing the order breaks `<script lang="ts">` handling in unrelated
ways: Node's loader chain does not re-transform the string returned
from `load()`, so `.vue` source emitted with TS still in it would not
be picked up by `tsx` after the fact. This loader therefore emits
JavaScript only and relies on `tsx` to handle the surrounding
`.test.ts` consumers.

---

## Worked example

**`button.vue`**

```vue
<script setup lang="ts">
defineProps<{ label: string }>();
</script>
<template>
  <button>{{ label }}</button>
</template>
```

**`button.test.ts`**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import Button from './button.vue';

test('renders the label', () => {
  const wrapper = mount(Button, { props: { label: 'Click' } });
  assert.equal(wrapper.text(), 'Click');
});
```

**`package.json`**

```jsonc
{
  "scripts": {
    "test": "node --import tsx --import @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts"
  }
}
```

---

## Debugging

Set `DEBUG=vue-sfc-loader` to emit a one-line summary per compiled
`.vue` file to stderr:

```
compiled <file> template=<0|1> script=<0|1> styleStripped=<N> customStripped=<N> bytesIn=<N> bytesOut=<N>
```

Silent otherwise.

If a test stack trace points at compiled output instead of the `.vue`
file path, the inline sourcemap comment is likely missing or the
filename argument to the compiler was not set. See the Troubleshooting
section below.

---

## Known limitations

- **No `<style>` rendering.** Style blocks are stripped at compile
  time. `jsdom` does not compute styles and component tests assert on
  text and accessibility, not visual presentation.
- **No custom blocks** (`<i18n>`, `<docs>`, etc.). Stripped silently at
  test time; production Vite handles them.
- **No HMR.** HMR is a dev-server concern, not a test concern.
- **No Vue 2.** Vue 3 only.
- **Sourcemap tolerance is path + line number.** Template and script
  map merging is non-trivial; this loader does not attempt perfect
  column accuracy.

---

## Troubleshooting

For a quick diagnostic of the most common failure modes (loader
ordering, TS pass, peer-dependency misconfiguration), see the **Common
Failure Smells** table in
`docs/ai/execution-checklists/EC-065-vue-sfc-loader.checklist.md`.

Highlights:

- **`SyntaxError: Unexpected token` in a `.test.ts` consumer** —
  `tsx` is missing from `NODE_OPTIONS` or is ordered *after*
  `vue-sfc-loader`. Put `--import tsx` first.
- **`SyntaxError` inside compiled SFC output on `<script lang="ts">`** —
  this loader returned TypeScript instead of JavaScript. Check the
  installed version of `@vue/compiler-sfc`; if it no longer emits
  plain JS, `compileVue` should invoke the internal
  `typescript.transpileModule` pass. Never try to let an outer TS
  loader catch up — Node's loader chain does not re-transform.
- **Determinism flakes on Windows-only or Linux-only CI** — the
  filename passed to the compiler `id` was not POSIX-normalized.
  `compileVue` normalizes internally; if you are building a custom
  loader that calls `compileVue`, pass whatever filename you like —
  normalization happens inside.
- **`@vue/test-utils.mount()` fails with `instanceof` / component-identity
  errors** — pnpm installed a second copy of Vue. This package declares
  `vue` and `@vue/compiler-sfc` as `peerDependencies` and must never be
  listed under `dependencies`.
- **Stack trace points at compiled output instead of `.vue`** — the
  sourcemap comment is missing or the filename argument to the
  compiler was not set.

---

## Layer

This package is classified as **Shared Tooling** (see D-6501 in
`docs/ai/DECISIONS.md` and the Shared Tooling row in
`docs/ai/ARCHITECTURE.md §Layer Boundary`). It is consumed only by
`apps/*` test scripts. It never imports `boardgame.io`, the game
engine, the registry, or any app-layer runtime code.
