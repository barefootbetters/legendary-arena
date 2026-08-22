<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { UIGameOverState } from '@legendary-arena/game-engine';
// why: WP-583 — gradeForFinalScore is a runtime VALUE, so it needs its own value
// import; the `import type` above cannot carry it. The engine bands the number;
// the player-facing word comes from the client `gradeDisplay` helper (D-24392).
import { gradeForFinalScore } from '@legendary-arena/game-engine';
import { gradeLabel, gradeClass, gradeAriaText, buildGradeScale } from '../../vfx/gradeDisplay';
import { buildWorkedScoreCalc } from '../../vfx/scoreCalcDisplay';
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

    // why: WP-584 — render the score as a worked solution (formula → substituted
    // → products → result), not a flat list. The per-term weights are DERIVED
    // from the breakdown (product ÷ count) inside the helper, never hardcoded, so
    // the shown formula cannot drift from the engine's real weights (D-24393).
    const workedCalc = computed(() =>
      breakdown.value ? buildWorkedScoreCalc(breakdown.value) : null,
    );

    // why: WP-587 — the full grade scale (every band, its final-score range, and a
    // "you are here" marker) so the player sees what a B / A / Legendary needs, not
    // just their own grade. The engine ships the numeric bands (SCORE_GRADE_BANDS);
    // buildGradeScale owns the words + range formatting (D-24396 / D-24392 boundary).
    const gradeScale = computed(() => (grade.value ? buildGradeScale(grade.value) : null));

    return {
      hasPar,
      hasScores,
      gradeBadgeLabel,
      gradeBadgeClass,
      gradeBadgeAria,
      workedCalc,
      gradeScale,
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

      <!-- why: WP-584 — the score rendered as a worked solution (formula-first:
           symbolic formula → values substituted → products → result; then
           Final = Raw − PAR). All values are from the server-returned breakdown,
           rendered verbatim (never recomputed); the per-term weights are derived
           in `scoreCalcDisplay` (D-24393). Gated on the optional breakdown so an
           older record without one still shows the headline. -->
      <div
        v-if="workedCalc"
        class="score-worked"
        data-testid="arena-hud-score-breakdown"
        aria-label="score calculation"
      >
        <div class="worked-givens" aria-label="score inputs">
          <span v-for="given in workedCalc.givens" :key="given.label" class="worked-given">
            {{ given.label }} <strong>{{ given.value }}</strong>
          </span>
        </div>

        <div class="worked-block">
          <div class="worked-heading">Raw score</div>
          <div class="worked-line" aria-label="rawFormula">Raw = {{ workedCalc.formula }}</div>
          <div class="worked-line worked-indent" aria-label="rawSubstituted">= {{ workedCalc.substituted }}</div>
          <div class="worked-line worked-indent" aria-label="rawProducts">= {{ workedCalc.products }}</div>
          <div class="worked-line worked-indent worked-result" aria-label="rawResult">= {{ workedCalc.rawScore }}</div>
        </div>

        <!-- why: WP-587 — show where PAR came from (the same formula applied to the
             scenario's expected baseline), not just the final PAR value. Absent for
             records persisted before WP-587 (no parBaseline in the stored breakdown);
             the Final block below then still shows the verbatim PAR value. -->
        <div v-if="workedCalc.parDerivation" class="worked-block" data-testid="arena-hud-par-derivation">
          <div class="worked-heading">PAR for this scenario</div>
          <div class="worked-givens" aria-label="par baseline">
            <span class="worked-given">Expected escapes <strong>{{ workedCalc.parDerivation.baseline.escapes }}</strong></span>
            <span class="worked-given">Expected bystanders <strong>{{ workedCalc.parDerivation.baseline.bystanders }}</strong></span>
            <span class="worked-given">Expected VP <strong>{{ workedCalc.parDerivation.baseline.victoryPoints }}</strong></span>
          </div>
          <div class="worked-line" aria-label="parFormula">PAR = {{ workedCalc.parDerivation.formula }}</div>
          <div class="worked-line worked-indent" aria-label="parSubstituted">= {{ workedCalc.parDerivation.substituted }}</div>
          <div class="worked-line worked-indent worked-result" aria-label="parResult">= {{ workedCalc.parScore }}</div>
        </div>

        <div class="worked-block">
          <div class="worked-heading">Final score</div>
          <div class="worked-line" aria-label="finalSubstituted">Final = Raw − PAR = {{ workedCalc.finalSubstituted }}</div>
          <div class="worked-line worked-indent worked-result" aria-label="finalResult">= {{ workedCalc.finalScore }}</div>
        </div>
      </div>

      <!-- why: WP-587 — the grade scale: every band with its final-score range and a
           marker for the grade the player earned, so "Grade A" is legible in context
           (what a B / A / Legendary needs). Shown whenever a competitive score exists
           (grade needs only finalScore); independent of the optional breakdown. The
           current row is marked by TEXT ("← your score") + aria-current, not colour
           alone. -->
      <div
        v-if="gradeScale"
        class="grade-scale"
        data-testid="arena-hud-grade-scale"
        aria-label="grade scale"
      >
        <div class="worked-heading">Grade scale (final score vs PAR — lower is better)</div>
        <ul class="grade-scale-list">
          <li
            v-for="entry in gradeScale"
            :key="entry.grade"
            class="grade-scale-row"
            :class="{ 'grade-scale-row--current': entry.isCurrent }"
            :aria-current="entry.isCurrent ? 'true' : undefined"
          >
            <span class="grade-scale-label">{{ entry.label }}</span>
            <span class="grade-scale-range">{{ entry.range }}</span>
            <span v-if="entry.isCurrent" class="grade-scale-marker">← your score</span>
          </li>
        </ul>
      </div>
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

.par-breakdown {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.25rem 1rem;
  margin: 0.25rem 0 0;
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

/* why: WP-584 — the score rendered as a worked solution. The formula lines use a
   monospace face + tabular numerals so the arithmetic columns line up, the way a
   marked-up calculation reads. */
.score-worked {
  margin: 0.25rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.worked-givens {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.9rem;
  font-size: 0.8rem;
  color: var(--color-foreground);
  opacity: 0.85;
}

.worked-given strong {
  font-variant-numeric: tabular-nums;
}

.worked-heading {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.6;
  margin-bottom: 0.15rem;
}

.worked-line {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  line-height: 1.7;
  font-variant-numeric: tabular-nums;
  white-space: normal;
  overflow-wrap: anywhere;
}

.worked-indent {
  padding-left: 1.6rem;
}

.worked-result {
  font-weight: 700;
}

/* why: WP-587 — the grade scale. The current row is marked by TEXT ("← your
   score") + a left border, not colour alone, so it is legible with colours
   disabled or to a screen reader. */
.grade-scale {
  margin: 0.25rem 0 0;
}

.grade-scale-list {
  list-style: none;
  margin: 0.15rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.grade-scale-row {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.85rem;
  padding: 0.1rem 0.3rem;
  border-left: 3px solid transparent;
  font-variant-numeric: tabular-nums;
}

.grade-scale-row--current {
  border-left-color: var(--color-foreground);
  font-weight: 700;
  background: rgba(128, 128, 128, 0.12);
}

.grade-scale-label {
  min-width: 5.5rem;
}

.grade-scale-range {
  opacity: 0.8;
}

.grade-scale-marker {
  font-size: 0.8rem;
  opacity: 0.9;
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
