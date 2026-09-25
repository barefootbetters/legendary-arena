import { computed, type ComputedRef } from 'vue';
import coachEvalData from '../data/coach-eval.json';
import type { EvaluatorCoachEvalProjection, PipelineItem } from './useAgentPipeline.js';

// ============================================================================
// Evaluator-lane coach eval producer.
//
// Projects the slim coach-eval summary (copied by `prebuild:coach-eval` from the
// committed operator report `docs/ai/evaluations/coach-eval-latest.json`) into
// Evaluator-lane items. The AI coach is a paid Legendary-Pass feature; whether
// the current coach model still passes its scenario pack is a system-health fact
// the Evaluator reviews. Mirrors `useInspectorWikiLint`: a pure projection over
// an injected summary, with the lane type owned by `useAgentPipeline.ts`.
// ============================================================================

/** The meta tag carried by every coach-eval To Do item. */
const COACH_EVAL_META = 'Coach eval';

/** How many failed scenario ids a To Do item lists before summarising. */
const SCENARIO_IDS_SHOWN = 3;

// why: the Evaluator reviews quarterly (code-checks-and-balances.md §7); a coach
// run older than a quarter no longer says much about the model serving players.
export const COACH_EVAL_STALE_AFTER_DAYS = 90;

const MILLIS_PER_DAY = 86_400_000;

/** The exact operator command, shown when no run is recorded. */
export const COACH_EVAL_COMMAND =
  'pnpm --filter @legendary-arena/server coach:eval --model <id> --out docs/ai/evaluations/coach-eval-latest.json';

/** One failed scenario in the summary. */
export interface CoachEvalFailedScenario {
  readonly scenarioId: string;
  readonly failures: readonly string[];
}

/** The slim summary written by `apps/dashboard/scripts/build-coach-eval.mjs`. */
export type CoachEvalSummary =
  | { readonly status: 'missing' }
  | { readonly status: 'invalid'; readonly error: string }
  | {
      readonly status: 'ok';
      readonly model: string;
      readonly generatedAt: string | null;
      readonly totalCount: number;
      readonly passedCount: number;
      readonly failedCount: number;
      readonly failedScenarios: readonly CoachEvalFailedScenario[];
    };

/**
 * List scenario ids, showing at most `SCENARIO_IDS_SHOWN`.
 *
 * @param scenarioIds The failed scenario ids, in report order.
 * @returns e.g. `a, b, c +1 more`.
 */
function listScenarioIds(scenarioIds: readonly string[]): string {
  const shown = scenarioIds.slice(0, SCENARIO_IDS_SHOWN).join(', ');
  const hiddenCount = scenarioIds.length - SCENARIO_IDS_SHOWN;
  return hiddenCount > 0 ? `${shown} +${hiddenCount} more` : shown;
}

/**
 * Whole days between a run's timestamp and now, or `null` when unknown/unparseable.
 *
 * @param generatedAt The run's ISO timestamp.
 * @param nowMillis The current time in epoch milliseconds.
 * @returns The run's age in whole days.
 */
function ageInDays(generatedAt: string | null, nowMillis: number): number | null {
  if (generatedAt === null) {
    return null;
  }
  const runMillis = Date.parse(generatedAt);
  if (Number.isNaN(runMillis)) {
    return null;
  }
  return Math.floor((nowMillis - runMillis) / MILLIS_PER_DAY);
}

/**
 * Project a coach-eval summary into Evaluator-lane items.
 *
 * - `missing` → a To Do item with the exact command to run.
 * - `invalid` → a To Do item naming the problem.
 * - `ok` → an Active item with the model and totals; To Do items for failed
 *   scenarios and for a run older than `COACH_EVAL_STALE_AFTER_DAYS`.
 *
 * @param summary The slim coach-eval summary.
 * @param nowMillis The current time in epoch milliseconds (injected for tests).
 * @returns The Evaluator-lane projection.
 */
export function buildCoachEvalProjection(
  summary: CoachEvalSummary,
  nowMillis: number,
): EvaluatorCoachEvalProjection {
  if (summary.status === 'missing') {
    return {
      backlog: [
        {
          id: 'coach-eval-missing',
          label: `Coach eval: no run recorded — run ${COACH_EVAL_COMMAND} and commit the report`,
          meta: COACH_EVAL_META,
        },
      ],
      active: [],
    };
  }
  if (summary.status === 'invalid') {
    return {
      backlog: [
        {
          id: 'coach-eval-invalid',
          label: `Coach eval: the committed report could not be read — ${summary.error}`,
          meta: COACH_EVAL_META,
        },
      ],
      active: [],
    };
  }

  const backlog: PipelineItem[] = [];
  if (summary.failedCount > 0) {
    const scenarioIds = summary.failedScenarios.map((scenario) => scenario.scenarioId);
    const scenarios = summary.failedCount === 1 ? '1 scenario' : `${summary.failedCount} scenarios`;
    backlog.push({
      id: 'coach-eval-failures',
      label: `Coach eval: ${scenarios} failed on ${summary.model} — ${listScenarioIds(scenarioIds)}`,
      meta: COACH_EVAL_META,
    });
  }
  const age = ageInDays(summary.generatedAt, nowMillis);
  if (age !== null && age > COACH_EVAL_STALE_AFTER_DAYS) {
    backlog.push({
      id: 'coach-eval-stale',
      label: `Coach eval is ${age} days old — re-run it against the current COACH_MODEL`,
      meta: COACH_EVAL_META,
    });
  }

  const runDate = summary.generatedAt === null ? 'date unknown' : summary.generatedAt.slice(0, 10);
  return {
    backlog,
    active: [
      {
        id: 'coach-eval-latest',
        label: `Coach eval: ${summary.model} — ${summary.passedCount}/${summary.totalCount} scenarios passed`,
        meta: runDate,
      },
    ],
  };
}

/**
 * The Evaluator-lane coach eval projection for the Pipeline page.
 *
 * @param summary The summary to project; defaults to the build-time copy.
 * @param nowMillis The current time; defaults to `Date.now()`.
 * @returns A computed projection.
 */
export function useEvaluatorCoachEval(
  summary: CoachEvalSummary = coachEvalData as CoachEvalSummary,
  nowMillis: number = Date.now(),
): ComputedRef<EvaluatorCoachEvalProjection> {
  return computed(() => buildCoachEvalProjection(summary, nowMillis));
}
