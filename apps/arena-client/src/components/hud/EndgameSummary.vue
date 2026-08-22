<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { UIGameOverState } from '@legendary-arena/game-engine';
// why: WP-583 — gradeForFinalScore is a runtime VALUE, so it needs its own value
// import; the `import type` above cannot carry it. The engine bands the number;
// the player-facing word comes from the client `gradeDisplay` helper (D-24392).
import { gradeForFinalScore } from '@legendary-arena/game-engine';
import { gradeLabel, gradeClass, gradeAriaText } from '../../vfx/gradeDisplay';
import type { MyCompetitiveScore } from '../../lib/api/competitionApi';

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
    // why: WP-578 — the server-computed competitive score for this match,
    // threaded from `useCompetitiveSubmitOnGameover` (PlayViewport). Optional:
    // `null` for guests, pending/failed submits, and non-scoring matches, in
    // which case the panel renders the outcome + VP summary unchanged.
    competitiveScore: {
      type: Object as PropType<MyCompetitiveScore | null>,
      default: null,
    },
  },
  setup(props) {
    // Guarded accessors for optional fields — fail-soft-for-optional per
    // the session prompt's failure-semantics rule.
    const hasPar = computed(() => 'par' in props.gameOver);
    const hasScores = computed(() => 'scores' in props.gameOver);

    // why: WP-583 — the grade needs only the always-present finalScore, so the
    // badge shows whenever a competitive score exists; the component breakdown
    // needs the optional scoreBreakdown and is gated separately below.
    const grade = computed(() =>
      props.competitiveScore ? gradeForFinalScore(props.competitiveScore.finalScore) : null,
    );
    const gradeBadgeLabel = computed(() => (grade.value ? gradeLabel(grade.value) : ''));
    const gradeBadgeClass = computed(() => (grade.value ? gradeClass(grade.value) : ''));
    const gradeBadgeAria = computed(() => (grade.value ? gradeAriaText(grade.value) : ''));

    // why: the full component breakdown the server already returned (rendered
    // verbatim; never recomputed client-side — WP-578 / D-24387). Null for an
    // older record that carries no breakdown; the headline still renders.
    const breakdown = computed(() => props.competitiveScore?.scoreBreakdown ?? null);

    return {
      hasPar,
      hasScores,
      gradeBadgeLabel,
      gradeBadgeClass,
      gradeBadgeAria,
      breakdown,
    };
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

    <!-- why: WP-578 — the competitive score the server computed for this match,
         shown to the player who earned it. `finalScore` is the ranked, PAR-
         relative, lower-is-better value; `rawScore` is supporting detail. Both
         are rendered verbatim (never recomputed client-side). Absent for guests,
         pending/failed submits, and non-scoring matches (prop is null). -->
    <section
      v-if="competitiveScore"
      class="competitive-score"
      data-testid="arena-hud-competitive-score"
      aria-label="competitive score"
    >
      <p class="competitive-score-headline">
        Competitive score:
        <strong aria-label="competitiveFinalScore">{{ competitiveScore.finalScore }}</strong>
        <span class="competitive-score-hint">(lower is better)</span>
        <!-- why: WP-583 — the grade badge conveys meaning by its TEXT label (not
             colour alone) and carries an aria-label, so it is legible to a screen
             reader; the class only tints it. -->
        <span
          class="grade-badge"
          :class="gradeBadgeClass"
          :aria-label="gradeBadgeAria"
          data-testid="arena-hud-grade-badge"
        >{{ gradeBadgeLabel }}</span>
      </p>
      <p class="competitive-score-detail">
        Raw score <span aria-label="competitiveRawScore">{{ competitiveScore.rawScore }}</span>
      </p>

      <!-- why: WP-583 — the full component breakdown the server already returned,
           rendered verbatim (never recomputed client-side). Gated on the optional
           scoreBreakdown so an older record without one still shows the headline. -->
      <dl
        v-if="breakdown"
        class="score-breakdown"
        data-testid="arena-hud-score-breakdown"
        aria-label="score breakdown"
      >
        <div class="breakdown-field">
          <dt>Rounds</dt>
          <dd aria-label="breakdownRounds">{{ breakdown.inputs.rounds }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Bystanders rescued</dt>
          <dd aria-label="breakdownBystandersRescued">{{ breakdown.inputs.bystandersRescued }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Victory points</dt>
          <dd aria-label="breakdownVictoryPoints">{{ breakdown.inputs.victoryPoints }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Villain escapes</dt>
          <dd aria-label="breakdownVillainEscapes">{{ breakdown.inputs.penaltyEventCounts.villainEscaped }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Bystanders lost</dt>
          <dd aria-label="breakdownBystandersLost">{{ breakdown.inputs.penaltyEventCounts.bystanderLost }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Scheme twists</dt>
          <dd aria-label="breakdownSchemeTwists">{{ breakdown.inputs.penaltyEventCounts.schemeTwistNegative }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Round cost</dt>
          <dd aria-label="breakdownRoundCost">{{ breakdown.weightedRoundCost }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Penalties</dt>
          <dd aria-label="breakdownPenaltyTotal">{{ breakdown.weightedPenaltyTotal }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Bystander bonus</dt>
          <dd aria-label="breakdownBystanderReward">−{{ breakdown.weightedBystanderReward }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>Victory-point bonus</dt>
          <dd aria-label="breakdownVictoryPointReward">−{{ breakdown.weightedVictoryPointReward }}</dd>
        </div>
        <div class="breakdown-field">
          <dt>PAR</dt>
          <dd aria-label="breakdownParScore">{{ breakdown.parScore }}</dd>
        </div>
      </dl>
    </section>

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

.competitive-score {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.competitive-score-headline {
  margin: 0;
  font-size: 1.05rem;
}

.competitive-score-headline strong {
  font-variant-numeric: tabular-nums;
}

.competitive-score-hint {
  font-size: 0.8rem;
  opacity: 0.75;
}

.competitive-score-detail {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

.par-breakdown,
.score-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 1rem;
  margin: 0.25rem 0 0;
}

.par-field,
.breakdown-field {
  display: flex;
  justify-content: space-between;
}

dt,
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

/* why: WP-583 — the grade badge. Meaning is carried by the text label; the
   background tint is decorative reinforcement only (never the sole signal),
   so the badge stays legible with colours disabled or to a screen reader. */
.grade-badge {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border-radius: 0.25rem;
  font-weight: 700;
  font-size: 0.85rem;
  line-height: 1.4;
  border: 1px solid currentColor;
}

.grade-badge--legendary {
  color: #b8860b;
  background: rgba(255, 215, 0, 0.16);
}

.grade-badge--a {
  color: #1a7f37;
  background: rgba(35, 197, 98, 0.16);
}

.grade-badge--b {
  color: #0a6bcb;
  background: rgba(31, 136, 219, 0.16);
}

.grade-badge--c {
  color: var(--color-foreground);
  background: rgba(128, 128, 128, 0.16);
}

.grade-badge--d {
  color: #bc4c00;
  background: rgba(219, 109, 40, 0.16);
}

.grade-badge--f {
  color: #cf222e;
  background: rgba(207, 34, 46, 0.16);
}
</style>
