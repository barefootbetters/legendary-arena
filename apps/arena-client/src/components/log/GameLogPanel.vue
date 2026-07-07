<script lang="ts">
import { computed, defineComponent, type PropType } from 'vue';

// why: GameLogPanel renders the engine log verbatim. Log authorship belongs
// to the engine (G.messages -> UIState.log via buildUIState); the client is
// not a second interpretation layer. The component takes the log array as
// a prop instead of reading the store directly so component tests can mount it
// without bringing up a Pinia plugin; the container (ReplayInspector or HUD
// parent) forwards `snapshot.log` from the store.
//
// why: WP-320 — this component now derives display order via a `computed`, so
// per the EC-132 §2 SFC authoring rule (D-6512) it uses the
// `defineComponent({ setup() { return {...} } })` form rather than
// `<script setup>`: under vue-sfc-loader's separate-compile pipeline a leaf
// `<script setup>` reliably exposes only props to the template, not arbitrary
// setup bindings, so `displayEntries` must be an explicit setup return.
export default defineComponent({
  name: 'GameLogPanel',
  props: {
    log: {
      type: Array as PropType<readonly string[]>,
      required: true,
    },
    // why: WP-320 — the live HUD wants a newest-first feed (the latest entry on
    // top, older entries pushed down). Default false preserves chronological
    // (oldest-first) order for the replay inspector + pre-plan notification,
    // which are read top-to-bottom.
    newestFirst: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    // why: WP-320 — pair each entry with its ORIGINAL append-order index so the
    // :key stays stable regardless of display direction (the engine log is
    // append-only, so an entry's original index never changes once assigned);
    // only the DISPLAY order reverses. Keying by original index lets Vue move
    // existing rows rather than rebuild the list when a new entry lands on top.
    const displayEntries = computed<{ text: string; index: number }[]>(() => {
      const withIndex = props.log.map((text, index) => ({ text, index }));
      return props.newestFirst ? withIndex.slice().reverse() : withIndex;
    });
    return { displayEntries };
  },
});
</script>

<template>
  <section class="game-log-panel" data-testid="game-log-panel">
    <template v-if="log.length === 0">
      <p class="empty" role="status">Game log is empty.</p>
    </template>
    <template v-else>
      <ol class="entries" aria-live="polite">
        <!--
          // why: source-array index is a stable Vue :key for the life of a
          // single UIState. The engine log is append-only within a match —
          // entries are never reordered or deleted in place — so reusing
          // the index as a key cannot trigger spurious DOM thrash. When
          // the parent swaps to a different UIState (e.g., the inspector
          // moves to a new index), Vue tears down the existing list and
          // rebuilds it; key stability only matters within a single render
          // cycle of the same log.
        -->
        <li
          v-for="item in displayEntries"
          :key="item.index"
          :data-index="item.index"
          data-testid="game-log-line"
        >
          {{ item.text }}
        </li>
      </ol>
    </template>
  </section>
</template>

<style scoped>
.game-log-panel {
  display: flex;
  flex-direction: column;
  max-height: 20rem;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-foreground);
}

.empty {
  margin: 0;
  font-style: italic;
  color: var(--color-foreground);
}

.entries {
  margin: 0;
  padding-left: 1.5rem;
  font-variant-numeric: tabular-nums;
}

.entries li {
  padding: 0.125rem 0;
}
</style>
