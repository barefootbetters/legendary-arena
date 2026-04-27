<!--
  PrePlanStepList — passive reference display of the current pre-plan's
  ordered steps.

  Renders the empty-state literal when no plan exists. Otherwise lists
  every plan step in insertion order (no sorting, filtering, or
  de-duplication) and surfaces a terminal-state paragraph only when the
  plan's status is `'consumed'` or `'invalidated'`.

  Reads `usePreplanStore()` only. The header reads `current.playerId`
  directly; future viewer-vs-owner gating can introduce `useUiStateStore()`
  at the point a concrete consumer needs it.
-->
<script lang="ts">
import { defineComponent } from 'vue';
import { storeToRefs } from 'pinia';
import { usePreplanStore } from '../../stores/preplan';

// why: components must never mutate plan state directly. All
// transitions route through the preplan store's actions, and
// disruption events specifically route through
// applyDisruptionToStore in preplanLifecycle.ts. Reads are
// through storeToRefs so reactivity is preserved without exposing
// a mutation handle.

// why: explicit defineComponent({ setup() { return {...} } }) form per
// D-6512 — under WP-065's vue-sfc-loader separate-compile pipeline,
// script-setup top-level bindings are not exposed on the template's
// `_ctx`. Returning `current` from `setup()` places it on the instance
// proxy where the template can reach it.
export default defineComponent({
  name: 'PrePlanStepList',
  setup() {
    const store = usePreplanStore();
    const { current } = storeToRefs(store);
    return { current };
  },
});
</script>

<template>
  <p v-if="current === null" class="preplan-step-list__empty">
    No plan is active.
  </p>
  <section v-else class="preplan-step-list">
    <h3 class="preplan-step-list__header">
      Plan for player {{ current.playerId }}
    </h3>
    <ol class="preplan-step-list__steps">
      <li
        v-for="(step, index) in current.planSteps"
        :key="index"
      >
        {{ step.intent }}: {{ step.description }}
      </li>
    </ol>
    <p
      v-if="current.status !== 'active'"
      class="preplan-step-list__status"
    >
      Plan {{ current.status }}.
    </p>
  </section>
</template>

<style scoped>
.preplan-step-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
}

.preplan-step-list__empty {
  margin: 0;
  padding: 0.75rem 1rem;
  font-style: italic;
}

.preplan-step-list__header {
  margin: 0;
  font-size: 1rem;
}

.preplan-step-list__steps {
  margin: 0;
  padding-left: 1.5rem;
}

.preplan-step-list__steps li {
  padding: 0.125rem 0;
}

.preplan-step-list__status {
  margin: 0;
  font-style: italic;
  font-size: 0.85rem;
}
</style>
