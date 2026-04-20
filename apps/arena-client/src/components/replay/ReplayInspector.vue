<script lang="ts">
import { defineComponent, ref, computed, onMounted, watch, type PropType } from 'vue';
import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine';
import { useUiStateStore } from '../../stores/uiState';
import GameLogPanel from '../log/GameLogPanel.vue';

// why: defineComponent({ setup() { return {...} } }) is required here
// (not <script setup>) because the template references multiple non-prop
// bindings — currentIndex, total, lastIndex, positionLabel, currentLog,
// goFirst/goPrev/goNext/goLast/onScrub/onKeyDown handlers — and under
// vue-sfc-loader's separate-compile pipeline (P6-30 / P6-40 / D-6512)
// only props reach `_ctx` automatically through `<script setup>`. Bindings
// returned from setup() are placed on the instance proxy where the
// template can resolve them. This is the same failure mode WP-062's
// <ArenaHud />, <PlayerPanel />, and <ParDeltaReadout /> hit when first
// authored as <script setup>; the lesson is locked here on the first
// keyboard-stepper precedent in the repo.
//
// why: D-64NN — the inspector root carries tabindex="0" and mounts the
// keyboard listeners directly on the root element. This is the first
// keyboard-stepper precedent in the repo (WP-061 / WP-062 established
// none). Root-level focus + root-level listeners avoid per-control focus
// management churn (no ref-passing, no JS-side focus juggling) and
// preserve a deterministic screen-reader focus order: the inspector
// announces itself once when focused, and ArrowLeft/ArrowRight/Home/End
// then act on the inspector as a unit. Future stepper-style components
// (moves timeline, scenario selector, tutorial carousel) inherit this
// pattern.
//
// why: clamp-not-wrap on the index navigation. Stepping past index 0 or
// past sequence.snapshots.length - 1 is a no-op. Wrapping from last to
// first would present unrelated game state as "adjacent" (turn 1 right
// next to turn N), which is confusing UX for replay inspection. Clamping
// matches how scrubbers behave in every other replay/timeline tool —
// the user has a clear sense of "I am at the end" rather than getting
// teleported back to the start.
//
// why: enableAutoPlay is a forward-compatibility seam — the prop is
// declared so future packets can wire a play/pause control without a
// component-API break, but autoplay is NOT implemented in this packet
// (would push scope past one session per WP-064 §Out of Scope). The
// boolean is read but currently has no effect; tests confirm the prop
// is accepted without changing behavior.
export default defineComponent({
  name: 'ReplayInspector',
  components: { GameLogPanel },
  props: {
    sequence: {
      type: Object as PropType<ReplaySnapshotSequence>,
      required: true,
    },
    initialIndex: {
      type: Number,
      required: false,
      default: 0,
    },
    enableAutoPlay: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  setup(props) {
    const store = useUiStateStore();

    const total = computed(() => props.sequence.snapshots.length);
    const lastIndex = computed(() => Math.max(0, total.value - 1));

    function clamp(target: number): number {
      if (target < 0) {
        return 0;
      }
      if (target > lastIndex.value) {
        return lastIndex.value;
      }
      return target;
    }

    const initialClamped = clamp(props.initialIndex);
    const currentIndex = ref<number>(initialClamped);
    const isPlaying = ref<boolean>(false);

    function applyCurrent(): void {
      const snapshot = props.sequence.snapshots[currentIndex.value];
      if (snapshot !== undefined) {
        store.setSnapshot(snapshot);
      }
    }

    function setIndex(target: number): void {
      const next = clamp(target);
      if (next !== currentIndex.value) {
        currentIndex.value = next;
      }
    }

    function goFirst(): void {
      setIndex(0);
    }
    function goPrev(): void {
      setIndex(currentIndex.value - 1);
    }
    function goNext(): void {
      setIndex(currentIndex.value + 1);
    }
    function goLast(): void {
      setIndex(lastIndex.value);
    }

    function onScrub(event: Event): void {
      const target = event.target as HTMLInputElement | null;
      if (target === null) {
        return;
      }
      const parsed = Number(target.value);
      if (!Number.isFinite(parsed)) {
        return;
      }
      setIndex(parsed);
    }

    function onKeyDown(event: KeyboardEvent): void {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          goPrev();
          return;
        case 'ArrowRight':
          event.preventDefault();
          goNext();
          return;
        case 'Home':
          event.preventDefault();
          goFirst();
          return;
        case 'End':
          event.preventDefault();
          goLast();
          return;
        default:
          return;
      }
    }

    const positionLabel = computed<string>(
      () => `${currentIndex.value + 1} / ${total.value}`,
    );

    const currentLog = computed<readonly string[]>(() => {
      const snapshot = props.sequence.snapshots[currentIndex.value];
      if (snapshot === undefined) {
        return [];
      }
      // why: spread-copy the log array before passing it down. The fixture
      // loader hands back the same parsed sequence object across calls, so
      // every consumer sees the same `snapshots[i].log` reference. A defen-
      // sive copy here means a future consumer (spectator HUD, export
      // tool) cannot accidentally mutate the canonical fixture through a
      // child component that ignores the readonly type. Post-mortem
      // finding per WP-028 / D-2802 aliasing-prevention pattern.
      return [...snapshot.log];
    });

    onMounted(() => {
      applyCurrent();
    });

    watch(currentIndex, () => {
      applyCurrent();
    });

    return {
      currentIndex,
      isPlaying,
      total,
      lastIndex,
      positionLabel,
      currentLog,
      goFirst,
      goPrev,
      goNext,
      goLast,
      onScrub,
      onKeyDown,
    };
  },
});
</script>

<template>
  <section
    class="replay-inspector"
    data-testid="replay-inspector"
    tabindex="0"
    role="group"
    aria-label="Replay inspector"
    @keydown="onKeyDown"
  >
    <div class="controls">
      <button
        type="button"
        data-testid="replay-jump-first"
        aria-label="Jump to first snapshot"
        :disabled="currentIndex === 0"
        @click="goFirst"
      >
        ⏮
      </button>
      <button
        type="button"
        data-testid="replay-step-prev"
        aria-label="Step to previous snapshot"
        :disabled="currentIndex === 0"
        @click="goPrev"
      >
        ◀
      </button>
      <input
        type="range"
        data-testid="replay-scrub"
        aria-label="Scrub replay position"
        min="0"
        :max="lastIndex"
        step="1"
        :value="currentIndex"
        @input="onScrub"
      />
      <button
        type="button"
        data-testid="replay-step-next"
        aria-label="Step to next snapshot"
        :disabled="currentIndex === lastIndex"
        @click="goNext"
      >
        ▶
      </button>
      <button
        type="button"
        data-testid="replay-jump-last"
        aria-label="Jump to last snapshot"
        :disabled="currentIndex === lastIndex"
        @click="goLast"
      >
        ⏭
      </button>
      <span
        class="position"
        data-testid="replay-position"
        aria-label="Replay position"
        aria-live="polite"
      >
        {{ positionLabel }}
      </span>
    </div>
    <GameLogPanel :log="currentLog" />
  </section>
</template>

<style scoped>
.replay-inspector {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-foreground);
}

.replay-inspector:focus {
  outline: 3px solid var(--color-active-player);
  outline-offset: 2px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.controls button {
  padding: 0.25rem 0.5rem;
  font: inherit;
}

.controls input[type='range'] {
  flex: 1 1 auto;
}

.position {
  font-variant-numeric: tabular-nums;
  min-width: 4rem;
  text-align: right;
}
</style>
