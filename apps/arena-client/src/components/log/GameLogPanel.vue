<script lang="ts">
import {
  defineComponent,
  nextTick,
  onMounted,
  ref,
  watch,
  type PropType,
} from 'vue';
import { isPinnedToBottom } from './gameLogScroll';

// why: GameLogPanel renders the engine log verbatim in chronological (append)
// order — log authorship belongs to the engine (G.messages -> UIState.log via
// buildUIState); the client is not a second interpretation layer. It takes the
// log array as a prop instead of reading the store directly so component tests
// can mount it without a Pinia plugin; the container (ReplayInspector or HUD
// parent) forwards `snapshot.log`.
//
// why: WP-321 — the live HUD shows a COMPACT window (~5-6 lines; the panel
// scrolls) that STICKS to the bottom so the newest entry is always in view,
// while KEEPING chronological order — a multi-line event (fight -> rescue ->
// effect) must read cause-before-consequence, which a newest-first reversal
// would break (WP-320, abandoned pre-merge). The stick is POLITE: a new entry
// auto-scrolls only when the viewer is already pinned to the bottom, so a
// mid-game scroll-up to read history is not yanked back down.
//
// why: this component now runs setup logic (a template ref + a watcher), so per
// EC-132 §2 / D-6512 it uses the `defineComponent({ setup() { return {...} } })`
// form rather than a leaf `<script setup>` — under vue-sfc-loader's
// separate-compile pipeline a leaf `<script setup>` reliably exposes only props
// to the template, not arbitrary setup bindings.
export default defineComponent({
  name: 'GameLogPanel',
  props: {
    log: {
      type: Array as PropType<readonly string[]>,
      required: true,
    },
  },
  setup(props) {
    // why: the scroll viewport is the panel <section> (overflow-y: auto).
    const viewport = ref<HTMLElement | null>(null);

    // why: WP-321 — scroll to the newest (bottom) entry. Called after the DOM
    // has grown (via nextTick) so scrollHeight reflects the new content.
    function scrollToBottom(): void {
      const element = viewport.value;
      if (element !== null) {
        element.scrollTop = element.scrollHeight;
      }
    }

    // why: WP-321 — on a new log entry, stick to the bottom ONLY if the viewer
    // was already pinned there before the entry landed. The watcher runs with
    // the default 'pre' flush (before the component re-renders), so measuring
    // here reflects the pre-append scroll position; the actual scroll runs after
    // nextTick, once the new row exists in the DOM.
    watch(
      () => props.log.length,
      () => {
        const element = viewport.value;
        if (element === null) {
          return;
        }
        const wasPinned = isPinnedToBottom(
          element.scrollHeight,
          element.scrollTop,
          element.clientHeight,
        );
        if (!wasPinned) {
          return;
        }
        void nextTick(scrollToBottom);
      },
    );

    // why: WP-321 — start pinned to the newest entry (e.g. joining a match
    // mid-stream); the log may already be non-empty at mount.
    onMounted(() => {
      void nextTick(scrollToBottom);
    });

    return { viewport };
  },
});
</script>

<template>
  <section
    ref="viewport"
    class="game-log-panel"
    data-testid="game-log-panel"
  >
    <template v-if="log.length === 0">
      <p class="empty" role="status">Game log is empty.</p>
    </template>
    <template v-else>
      <ol class="entries" aria-live="polite">
        <!--
          // why: source-array index is a stable Vue :key for the life of a
          // single UIState. The engine log is append-only within a match —
          // entries are never reordered or deleted in place — so reusing the
          // index as a key cannot trigger spurious DOM thrash.
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
  /* why: WP-321 — a compact ~5-6 line window instead of the previous 20rem,
     which dominated the board. The panel scrolls (overflow-y: auto) and the
     component auto-scrolls to keep the newest entry in view. */
  max-height: 9rem;
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
