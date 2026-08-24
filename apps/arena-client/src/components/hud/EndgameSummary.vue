<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { UIGameOverState } from '@legendary-arena/game-engine';
// why: WP-583 — gradeForFinalScore is a runtime VALUE, so it needs its own value
// import; the `import type` above cannot carry it. The engine bands the number;
// the player-facing word comes from the client `gradeDisplay` helper (D-24392).
import { gradeForFinalScore } from '@legendary-arena/game-engine';
import { gradeLabel, gradeClass, gradeAriaText, buildGradeScale } from '../../vfx/gradeDisplay';
import { buildWorkedScoreCalc, buildLuckRead } from '../../vfx/scoreCalcDisplay';
import type { MyCompetitiveScore } from '../../lib/api/competitionApi';
import EndgameCoachPanel from './EndgameCoachPanel.vue';

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
  // why: WP-595 — the Legendary-Pass AI coach panel, rendered inside the
  // competitive-score section when a scored record with a replay hash exists.
  components: { EndgameCoachPanel },
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
      breakdown.value
        ? buildWorkedScoreCalc(breakdown.value, props.competitiveScore?.seatIdentities)
        : null,
    );

    // why: WP-593 — the objective luck-of-the-draw read (favorable / even /
    // difficult shuffle), computed deterministically from the breakdown's actual
    // adversity vs the scenario's PAR expectation. Absent for older records with no
    // WP-591 adversity baseline; the opinionated hero/purchase coaching is a
    // separate Pass-gated LLM feature (WP-B), not built here.
    const luckRead = computed(() =>
      breakdown.value ? buildLuckRead(breakdown.value) ?? null : null,
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
      luckRead,
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
      <!-- why: WP-593 — the raw score as a two-sided ledger: penalties that raised
           it (worse) and rewards that lowered it (better), netting to the raw score.
           A restyle of the same values the worked formula below shows (never
           recomputed). Falls back to the plain figure for a record with no
           breakdown (rawLedger comes from the breakdown). -->
      <div
        v-if="workedCalc"
        class="raw-ledger"
        data-testid="arena-hud-raw-ledger"
        aria-label="raw score ledger"
      >
        <div class="raw-ledger-side raw-ledger-penalties">
          <div class="raw-ledger-heading">Penalties <span class="raw-ledger-sign">(raise score)</span></div>
          <div v-if="workedCalc.rawLedger.penalties.length === 0" class="raw-ledger-row raw-ledger-none">
            <span class="raw-ledger-label">None</span>
            <span class="raw-ledger-amount">0</span>
          </div>
          <div v-for="line in workedCalc.rawLedger.penalties" :key="line.label" class="raw-ledger-row">
            <span class="raw-ledger-label">{{ line.label }}</span>
            <span class="raw-ledger-amount">+{{ line.amount }}</span>
          </div>
          <div class="raw-ledger-row raw-ledger-subtotal">
            <span class="raw-ledger-label">Subtotal</span>
            <span class="raw-ledger-amount">+{{ workedCalc.rawLedger.penaltyTotal }}</span>
          </div>
        </div>
        <div class="raw-ledger-side raw-ledger-earned">
          <div class="raw-ledger-heading">Earned <span class="raw-ledger-sign">(lower score)</span></div>
          <div v-if="workedCalc.rawLedger.earned.length === 0" class="raw-ledger-row raw-ledger-none">
            <span class="raw-ledger-label">None</span>
            <span class="raw-ledger-amount">0</span>
          </div>
          <div v-for="line in workedCalc.rawLedger.earned" :key="line.label" class="raw-ledger-row">
            <span class="raw-ledger-label">{{ line.label }}</span>
            <span class="raw-ledger-amount">−{{ line.amount }}</span>
          </div>
          <div class="raw-ledger-row raw-ledger-subtotal">
            <span class="raw-ledger-label">Subtotal</span>
            <span class="raw-ledger-amount">−{{ workedCalc.rawLedger.earnedTotal }}</span>
          </div>
        </div>
        <div class="raw-ledger-net">
          <span class="raw-ledger-net-label">Raw score</span>
          <span class="raw-ledger-net-value" aria-label="competitiveRawScore">{{ workedCalc.rawLedger.total }}</span>
        </div>
      </div>
      <p v-else class="competitive-score-detail">
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

        <!-- why: WP-588 — break the team-total reward terms (Bystanders, VP) down by
             player so each seat sees their own contribution. A display-only split of
             the same totals — the per-player VP and bystanders sum to the team figures
             used in the raw calc above. Absent for records persisted before WP-588. -->
        <div v-if="workedCalc.perPlayer" class="worked-block" data-testid="arena-hud-per-player">
          <div class="worked-heading">By player</div>
          <div class="per-player-grid" aria-label="per-player scoring">
            <div v-for="row in workedCalc.perPlayer" :key="row.label" class="per-player-row">
              <span class="per-player-name">{{ row.label }}</span>
              <span class="per-player-stat"><strong>{{ row.victoryPoints }}</strong> VP</span>
              <span class="per-player-stat"><strong>{{ row.bystandersRescued }}</strong> bystanders</span>
            </div>
          </div>
        </div>

        <!-- why: WP-587 — show where PAR came from (the same formula applied to the
             scenario's expected baseline), not just the final PAR value. Absent for
             records persisted before WP-587 (no parBaseline in the stored breakdown);
             the Final block below then still shows the verbatim PAR value. -->
        <div v-if="workedCalc.parDerivation" class="worked-block" data-testid="arena-hud-par-derivation">
          <div class="worked-heading">PAR for this scenario</div>
          <div class="worked-givens" aria-label="par baseline">
            <span class="worked-given">Expected escapes <strong>{{ workedCalc.parDerivation.baseline.escapes }}</strong></span>
            <span v-if="workedCalc.parDerivation.baseline.twists > 0" class="worked-given">Expected twists <strong>{{ workedCalc.parDerivation.baseline.twists }}</strong></span>
            <span class="worked-given">Expected bystanders <strong>{{ workedCalc.parDerivation.baseline.bystanders }}</strong></span>
            <span class="worked-given">Expected VP <strong>{{ workedCalc.parDerivation.baseline.victoryPoints }}</strong></span>
          </div>
          <div class="worked-line" aria-label="parFormula">PAR = {{ workedCalc.parDerivation.formula }}</div>
          <div class="worked-line worked-indent" aria-label="parSubstituted">= {{ workedCalc.parDerivation.substituted }}</div>
          <div class="worked-line worked-indent worked-result" aria-label="parResult">= {{ workedCalc.parScore }}</div>
          <!-- why: WP-588 — name what sets PAR. It is keyed on the scenario identity
               (ScenarioKey = scheme::mastermind::villain-groups) and calibrated from the
               scheme, mastermind, and villain-group difficulties — NOT the henchmen. -->
          <p class="par-basis" aria-label="parBasis">
            Set by this scenario — its scheme, mastermind, and villain groups.
          </p>
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
        <!-- why: WP-588 — a horizontal, colour-coded scale (wider, not a tall list) so
             the whole ladder reads at a glance and the earned band stands out. Colour is
             REINFORCEMENT: the current cell also carries a text marker ("your score") +
             aria-current, so it is legible with colours disabled or to a screen reader. -->
        <ol class="grade-scale-strip">
          <li
            v-for="entry in gradeScale"
            :key="entry.grade"
            class="grade-scale-cell"
            :class="['grade-scale-cell--' + entry.grade, { 'grade-scale-cell--current': entry.isCurrent }]"
            :aria-current="entry.isCurrent ? 'true' : undefined"
          >
            <span class="grade-scale-label">{{ entry.label }}</span>
            <span class="grade-scale-range">{{ entry.range }}</span>
            <span v-if="entry.isCurrent" class="grade-scale-you">your score</span>
          </li>
        </ol>
      </div>

      <!-- why: WP-593 — the objective "luck of the draw" read: how much adversity
           the match dealt (scheme twists / villain escapes / bystanders lost) versus
           what this scenario's PAR expects, banded into favorable / even / difficult
           and framed encouragingly. Deterministic from the breakdown (never from deck
           order, which the engine never projects). Absent for older records with no
           WP-591 adversity baseline. The opinionated hero/purchase coaching is a
           separate Pass-gated LLM feature (WP-B), not shown here. -->
      <div
        v-if="luckRead"
        class="luck-read"
        :class="'luck-read--' + luckRead.verdict"
        data-testid="arena-hud-luck-read"
        aria-label="luck of the draw"
      >
        <div class="worked-heading">Luck of the draw</div>
        <p class="luck-headline" aria-label="luckHeadline">{{ luckRead.headline }}</p>
        <p class="luck-detail">{{ luckRead.detail }}</p>
        <div class="luck-deltas" aria-label="luck adversity">
          <span v-for="delta in luckRead.deltas" :key="delta.label" class="luck-delta">
            {{ delta.label }}: <strong>{{ delta.actual }}</strong> vs {{ delta.expected }} expected
          </span>
        </div>
      </div>

      <!-- why: WP-595 — the Legendary-Pass AI coach. Pass holders get on-demand
           coaching (hero fit / purchases / tips); non-Pass holders get a locked-
           teaser upsell. Rendered only when the scored record carries a replay
           hash (the coach endpoint's key); the panel resolves Pass status itself. -->
      <EndgameCoachPanel
        v-if="competitiveScore && competitiveScore.replayHash"
        :replay-hash="competitiveScore.replayHash"
      />
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

/* why: WP-593 — the raw score as a two-sided ledger. Two columns (penalties |
   earned) on a shared grid so the amounts align, with a full-width net row below.
   Colour reinforces sign (penalties warm, earned cool) but each side is also
   labelled, so the meaning survives with colours disabled. */
.raw-ledger {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.4rem 0.8rem;
  margin: 0.35rem 0 0.1rem;
  padding: 0.5rem 0.6rem;
  border: 1px solid color-mix(in srgb, var(--color-foreground) 18%, transparent);
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}

.raw-ledger-side {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.raw-ledger-heading {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
  margin-bottom: 0.1rem;
}

.raw-ledger-sign {
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.75;
  font-size: 0.68rem;
}

.raw-ledger-row {
  display: flex;
  justify-content: space-between;
  gap: 0.6rem;
  font-size: 0.82rem;
  line-height: 1.5;
}

.raw-ledger-label {
  min-width: 0;
  overflow-wrap: anywhere;
  opacity: 0.9;
}

.raw-ledger-amount {
  font-weight: 600;
  white-space: nowrap;
}

.raw-ledger-none .raw-ledger-label,
.raw-ledger-none .raw-ledger-amount {
  opacity: 0.55;
  font-weight: 400;
}

.raw-ledger-penalties .raw-ledger-amount {
  color: #bc4c00;
}

.raw-ledger-earned .raw-ledger-amount {
  color: #1a7f37;
}

.raw-ledger-subtotal {
  margin-top: 0.1rem;
  padding-top: 0.15rem;
  border-top: 1px solid color-mix(in srgb, var(--color-foreground) 14%, transparent);
  font-weight: 700;
}

.raw-ledger-subtotal .raw-ledger-label {
  opacity: 0.75;
  font-weight: 600;
}

.raw-ledger-net {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 0.35rem;
  border-top: 2px solid color-mix(in srgb, var(--color-foreground) 22%, transparent);
}

.raw-ledger-net-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.raw-ledger-net-value {
  font-size: 1.15rem;
  font-weight: 700;
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

/* why: WP-588 — the per-player split of the reward terms. A display-only
   reconciliation of the team totals (VP + bystanders sum to the raw calc). */
.per-player-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 1.2rem;
  margin-top: 0.15rem;
}

.per-player-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  font-size: 0.85rem;
}

.per-player-name {
  font-weight: 700;
  min-width: 4.5rem;
}

.per-player-stat {
  opacity: 0.9;
  font-variant-numeric: tabular-nums;
}

.per-player-stat strong {
  font-variant-numeric: tabular-nums;
}

/* why: WP-588 — names what sets PAR (the scenario's scheme, mastermind, and
   villain groups). Quiet supporting copy under the PAR derivation. */
.par-basis {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
  opacity: 0.75;
  font-style: italic;
}

/* why: WP-588 — the grade scale as a horizontal, colour-coded strip (wider, not a
   tall list). Each cell's colour is its grade; the earned cell is emphasised by a
   thicker border + a heavier tint AND a text marker ("your score") + aria-current,
   so colour is reinforcement, never the sole signal. */
.grade-scale {
  margin: 0.4rem 0 0;
}

.grade-scale-strip {
  list-style: none;
  margin: 0.3rem 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.grade-scale-cell {
  flex: 1 1 4.5rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.08rem;
  padding: 0.35rem 0.2rem 0.3rem;
  border-radius: 6px;
  border: 1px solid transparent;
  border-top: 4px solid var(--grade-color, #888);
  background: color-mix(in srgb, var(--grade-color, #888) 12%, transparent);
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.grade-scale-cell--legendary { --grade-color: #b8860b; }
.grade-scale-cell--a { --grade-color: #1a7f37; }
.grade-scale-cell--b { --grade-color: #0a6bcb; }
.grade-scale-cell--c { --grade-color: #6b7280; }
.grade-scale-cell--d { --grade-color: #bc4c00; }
.grade-scale-cell--f { --grade-color: #cf222e; }

.grade-scale-cell--current {
  border-color: var(--grade-color, #888);
  border-width: 2px;
  border-top-width: 4px;
  background: color-mix(in srgb, var(--grade-color, #888) 26%, transparent);
  font-weight: 700;
}

.grade-scale-label {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--grade-color, var(--color-foreground));
}

.grade-scale-range {
  font-size: 0.72rem;
  opacity: 0.85;
  white-space: nowrap;
}

.grade-scale-you {
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-weight: 700;
  color: var(--grade-color, var(--color-foreground));
}

/* why: WP-593 — the luck-of-the-draw read. A tinted card whose accent conveys the
   verdict (favorable cool-green, difficult warm-orange, even neutral), reinforced
   by the headline text so it reads without colour. */
.luck-read {
  margin: 0.5rem 0 0;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--luck-color, #888);
  border-left: 4px solid var(--luck-color, #888);
  background: color-mix(in srgb, var(--luck-color, #888) 10%, transparent);
}

.luck-read--favorable { --luck-color: #1a7f37; }
.luck-read--average { --luck-color: #6b7280; }
.luck-read--difficult { --luck-color: #bc4c00; }

.luck-headline {
  margin: 0.1rem 0 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--luck-color, var(--color-foreground));
}

.luck-detail {
  margin: 0.15rem 0 0;
  font-size: 0.82rem;
  opacity: 0.9;
  line-height: 1.45;
}

.luck-deltas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.9rem;
  margin-top: 0.3rem;
  font-size: 0.75rem;
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

.luck-delta strong {
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
