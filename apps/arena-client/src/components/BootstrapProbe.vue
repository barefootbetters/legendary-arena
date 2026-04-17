<script lang="ts">
import { defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStateStore } from '../stores/uiState';

// why: this component is a wiring probe for WP-061, not a feature. Real HUD
// components arrive in WP-062 (Arena HUD); deliberately minimal here so that
// every subsequent UI packet starts from a known-good bootstrap contract
// rather than a smoke-test scaffold that has accrued responsibility.

// why: explicit `defineComponent({ setup() { return {...} } })` is used instead
// of `<script setup>` sugar because WP-065's vue-sfc-loader compiles the
// template as a separate render function (`inlineTemplate: false`). In that
// mode, script-setup top-level bindings are NOT exposed on the template's
// `_ctx`, so `{{ snapshot.game.phase }}` would render against an undefined
// proxy. Returning the binding explicitly from `setup()` places it on the
// instance proxy where `_ctx` can reach it. Vite's `@vitejs/plugin-vue` uses
// the inlined-template path and handles `<script setup>` correctly; this
// form is needed only because the `node:test`-side loader uses the
// separate-compile pipeline. Recorded as D-6512. Do NOT modify
// `packages/vue-sfc-loader/**` in this packet — that restriction is
// load-bearing per EC-067.
export default defineComponent({
  name: 'BootstrapProbe',
  setup() {
    const store = useUiStateStore();
    const { snapshot } = storeToRefs(store);
    return { snapshot };
  },
});
</script>

<template>
  <p v-if="snapshot === null" aria-label="no snapshot loaded">
    No UIState loaded.
  </p>
  <p v-else aria-label="current game phase">
    Phase: {{ snapshot.game.phase }}
  </p>
</template>
