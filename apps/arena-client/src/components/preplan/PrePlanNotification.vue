<!--
  PrePlanNotification — banner that surfaces the most recent disruption
  to the viewer's pre-plan.

  Renders nothing when the store carries no notification. Otherwise renders
  a single alert region with the human-readable message, the source-player
  attribution, an optional card paragraph, and a dismiss button.

  The alert region uses `role="alert"` and `aria-live="assertive"`. This
  diverges from WP-064's GameLogPanel idiom (`aria-live="polite"`) because
  a disruption invalidates the viewer's planned actions — screen readers
  must interrupt to prevent the viewer from acting on a plan that no longer
  applies. Recorded as D-5901.
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

// why: explicit defineComponent({ setup() { return {...} } }) is used
// instead of <script setup> sugar per D-6512 — under WP-065's vue-sfc-
// loader separate-compile pipeline (`inlineTemplate: false`), script-
// setup top-level bindings are NOT exposed on the template's `_ctx`,
// so `{{ lastNotification.message }}` would render against an undefined
// proxy. Returning the bindings from `setup()` places them on the
// instance proxy where `_ctx` can reach them.
export default defineComponent({
  name: 'PrePlanNotification',
  setup() {
    const store = usePreplanStore();
    const { lastNotification } = storeToRefs(store);
    function dismiss(): void {
      store.dismissNotification();
    }
    return { lastNotification, dismiss };
  },
});
</script>

<template>
  <div
    v-if="lastNotification !== null"
    role="alert"
    aria-live="assertive"
    class="preplan-notification"
  >
    <p class="preplan-notification__message">{{ lastNotification.message }}</p>
    <p class="preplan-notification__source">
      From player {{ lastNotification.sourcePlayerId }}
    </p>
    <p
      v-if="lastNotification.affectedCardExtId"
      class="preplan-notification__card"
    >
      {{ lastNotification.affectedCardExtId }}
    </p>
    <button
      type="button"
      class="preplan-notification__dismiss"
      @click="dismiss"
    >
      Dismiss
    </button>
  </div>
</template>

<style scoped>
/* why: hudColors.ts does not currently cover alert surfaces, so literal
   hex values are used here. A future shared-tokens WP can replace these
   without changing the component's structural contract. */
.preplan-notification {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  border: 1px solid #b00020;
  background: #fff5f5;
  color: #b00020;
  border-radius: 0.5rem;
}

.preplan-notification__message {
  margin: 0;
  font-weight: 600;
}

.preplan-notification__source {
  margin: 0;
  font-size: 0.85rem;
}

.preplan-notification__card {
  margin: 0;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.preplan-notification__dismiss {
  align-self: flex-start;
  margin-top: 0.5rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid #b00020;
  background: transparent;
  color: #b00020;
  border-radius: 0.25rem;
  cursor: pointer;
}
</style>
