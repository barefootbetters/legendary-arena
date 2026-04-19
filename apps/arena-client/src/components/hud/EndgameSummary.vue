<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { UIGameOverState } from '@legendary-arena/game-engine';

// why: the four literal leaf-name `aria-label`s on the PAR breakdown
// (`rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`) bind the
// HUD directly to the WP-067 drift test at
// `packages/game-engine/src/ui/uiState.types.drift.test.ts`. A rename of
// any of those fields must break the drift test AND this component's test
// in lockstep, preventing silent screen-reader regressions. The `par`
// block is absent on every runtime UIState today under D-6701 —
// `EndgameSummary` renders the outcome / reason / scores portion and omits
// the par block entirely until the payload-wiring WP lands.
// why: defineComponent form (not <script setup>) is required here because
// the template references computed bindings (`hasPar`, `hasScores`) that
// must be returned from `setup()` to reach `_ctx` under vue-sfc-loader's
// separate-compile pipeline (D-6512 / P6-30).
export default defineComponent({
  name: 'EndgameSummary',
  props: {
    gameOver: {
      type: Object as PropType<UIGameOverState>,
      required: true,
    },
  },
  setup(props) {
    // Guarded accessors for optional fields — fail-soft-for-optional per
    // the session prompt's failure-semantics rule.
    const hasPar = computed(() => 'par' in props.gameOver);
    const hasScores = computed(() => 'scores' in props.gameOver);
    return { hasPar, hasScores };
  },
});
</script>

<template>
  <section
    class="endgame-summary"
    data-testid="arena-hud-endgame"
    aria-label="endgame summary"
  >
    <header>
      <span class="outcome" aria-label="outcome">
        Outcome: {{ gameOver.outcome }}
      </span>
      <span class="reason" aria-label="reason">
        {{ gameOver.reason }}
      </span>
    </header>

    <dl v-if="hasPar && gameOver.par" class="par-breakdown">
      <div class="par-field">
        <dt>Raw score</dt>
        <dd aria-label="rawScore">{{ gameOver.par.rawScore }}</dd>
      </div>
      <div class="par-field">
        <dt>PAR score</dt>
        <dd aria-label="parScore">{{ gameOver.par.parScore }}</dd>
      </div>
      <div class="par-field">
        <dt>Final score</dt>
        <dd aria-label="finalScore">{{ gameOver.par.finalScore }}</dd>
      </div>
      <div class="par-field">
        <dt>Scoring config version</dt>
        <dd aria-label="scoringConfigVersion">
          {{ gameOver.par.scoringConfigVersion }}
        </dd>
      </div>
    </dl>

    <div v-if="hasScores && gameOver.scores" class="scores">
      <p class="scores-note">
        Final scores recorded ({{ gameOver.scores.players.length }} players).
      </p>
    </div>
  </section>
</template>

<style scoped>
.endgame-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--color-foreground);
}

header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.outcome {
  font-weight: 700;
  font-size: 1.2rem;
}

.par-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 1rem;
  margin: 0;
}

.par-field {
  display: flex;
  justify-content: space-between;
}

dt,
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
