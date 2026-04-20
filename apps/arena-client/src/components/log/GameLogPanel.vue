<script setup lang="ts">
// why: GameLogPanel renders the engine log verbatim. Log authorship belongs
// to the engine (G.messages -> UIState.log via buildUIState); the client is
// not a second interpretation layer. The component takes the log array as
// a prop instead of reading the store directly so it stays a leaf SFC
// under vue-sfc-loader's separate-compile pipeline (props reach `_ctx`
// via $props in `<script setup>` form per the WP-062 leaf-component
// precedent), and so component tests can mount it without bringing up a
// Pinia plugin. The container (ReplayInspector or HUD parent) is
// responsible for forwarding `snapshot.log` from the store.
defineProps<{
  log: readonly string[];
}>();
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
          v-for="(entry, index) in log"
          :key="index"
          :data-index="index"
          data-testid="game-log-line"
        >
          {{ entry }}
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
