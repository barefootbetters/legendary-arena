<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { UIState, UIGameOverState } from '@legendary-arena/game-engine';

// why: em-dash rendering when the `par` key is absent is load-bearing,
// NOT a style choice. Under D-6701 (`buildParBreakdown` returns `undefined`
// unconditionally today), `gameOver.par` is ABSENT on every runtime UIState
// — the dominant path today. Zero is a valid engine value, and `par`
// absent is NOT the same as `finalScore === 0`. The HUD must not synthesize
// a zero client-side to fill the absent case; that would hide the "no
// scoring payload yet" state behind a misleading neutral zero.
// why: D-6701 safe-skip citation — the HUD ships today against the absent
// case. The follow-up WP that wires the PAR payload (ReplayResult →
// buildUIState) requires zero edits to this component because the present-
// branch logic already handles a defined `UIParBreakdown`.
// why: defineComponent form (not <script setup>) is required here because
// the template references computed bindings (`hasParBreakdown`, `arrowIcon`,
// `toneClass`) which must be returned from `setup()` to reach `_ctx` under
// vue-sfc-loader's separate-compile pipeline (D-6512 / P6-30).
export default defineComponent({
  name: 'ParDeltaReadout',
  props: {
    phase: {
      type: String as PropType<UIState['game']['phase']>,
      required: true,
    },
    gameOver: {
      type: Object as PropType<UIGameOverState | undefined>,
      required: false,
      default: undefined,
    },
  },
  setup(props) {
    const hasParBreakdown = computed(() => {
      const over = props.gameOver;
      if (over === undefined) {
        return false;
      }
      return 'par' in over && over.par !== undefined;
    });

    const finalScore = computed<number | null>(() => {
      const over = props.gameOver;
      if (over === undefined || over.par === undefined) {
        return null;
      }
      return over.par.finalScore;
    });

    const arrowIcon = computed<string>(() => {
      const score = finalScore.value;
      if (score === null || score === 0) {
        return '';
      }
      if (score < 0) {
        return '\u25BC';
      }
      return '\u25B2';
    });

    const toneClass = computed<string>(() => {
      const score = finalScore.value;
      if (score === null) {
        return 'tone-absent';
      }
      if (score < 0) {
        return 'tone-under';
      }
      if (score > 0) {
        return 'tone-over';
      }
      return 'tone-neutral';
    });

    return { hasParBreakdown, arrowIcon, toneClass };
  },
});
</script>

<template>
  <section
    class="par-delta-readout"
    data-testid="arena-hud-par-delta"
    :class="toneClass"
  >
    <span class="label">PAR delta</span>
    <template v-if="hasParBreakdown && gameOver && gameOver.par">
      <span class="value" aria-label="finalScore">
        {{ gameOver.par.finalScore }}
      </span>
      <span v-if="arrowIcon" class="icon" aria-hidden="true">
        {{ arrowIcon }}
      </span>
    </template>
    <template v-else>
      <span class="value value-absent" aria-label="finalScore">—</span>
    </template>
  </section>
</template>

<style scoped>
.par-delta-readout {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
}

.label {
  font-size: 0.85rem;
}

.value {
  font-size: 1.5rem;
  font-variant-numeric: tabular-nums;
}

.tone-under .value {
  color: var(--color-par-negative);
}

.tone-over .value {
  color: var(--color-par-positive);
}

.tone-neutral .value,
.tone-absent .value {
  color: var(--color-foreground);
}
</style>
