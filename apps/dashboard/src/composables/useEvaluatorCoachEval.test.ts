import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoachEvalProjection,
  useEvaluatorCoachEval,
  COACH_EVAL_COMMAND,
  COACH_EVAL_STALE_AFTER_DAYS,
  type CoachEvalSummary,
} from './useEvaluatorCoachEval.js';

const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const MILLIS_PER_DAY = 86_400_000;

/** A clean 13/13 `ok` summary run three days before NOW, with overrides applied. */
function makeOkSummary(
  overrides: Partial<Extract<CoachEvalSummary, { status: 'ok' }>> = {},
): CoachEvalSummary {
  return {
    status: 'ok',
    model: 'claude-sonnet-5',
    generatedAt: new Date(NOW - 3 * MILLIS_PER_DAY).toISOString(),
    totalCount: 13,
    passedCount: 13,
    failedCount: 0,
    failedScenarios: [],
    ...overrides,
  };
}

describe('useEvaluatorCoachEval', () => {
  it('should_prompt_the_operator_with_the_exact_command_when_no_run_is_recorded', () => {
    const projection = buildCoachEvalProjection({ status: 'missing' }, NOW);
    assert.deepEqual(projection.active, []);
    assert.equal(projection.backlog.length, 1);
    assert.equal(projection.backlog[0]!.id, 'coach-eval-missing');
    assert.ok(projection.backlog[0]!.label.includes(COACH_EVAL_COMMAND));
    assert.equal(projection.backlog[0]!.meta, 'Coach eval');
  });

  it('should_surface_an_unreadable_report_as_a_to_do_item', () => {
    const projection = buildCoachEvalProjection(
      { status: 'invalid', error: 'The coach eval report has no `model`.' },
      NOW,
    );
    assert.deepEqual(projection.active, []);
    assert.equal(projection.backlog[0]!.id, 'coach-eval-invalid');
    assert.ok(projection.backlog[0]!.label.includes('has no `model`'));
  });

  it('should_show_a_clean_recent_run_as_active_only', () => {
    const projection = buildCoachEvalProjection(makeOkSummary(), NOW);
    assert.deepEqual(projection.backlog, []);
    assert.deepEqual(projection.active, [
      {
        id: 'coach-eval-latest',
        label: 'Coach eval: claude-sonnet-5 — 13/13 scenarios passed',
        meta: '2026-09-22',
      },
    ]);
  });

  it('should_list_failed_scenarios_as_a_to_do_item', () => {
    const projection = buildCoachEvalProjection(
      makeOkSummary({
        passedCount: 9,
        failedCount: 4,
        failedScenarios: [
          { scenarioId: 'bot-ally-core-red-skull', failures: ['x'] },
          { scenarioId: 'casual-match-core', failures: ['y'] },
          { scenarioId: 'tie-core-red-skull', failures: ['z'] },
          { scenarioId: 'solo-core-red-skull', failures: ['w'] },
        ],
      }),
      NOW,
    );
    assert.deepEqual(projection.backlog, [
      {
        id: 'coach-eval-failures',
        label:
          'Coach eval: 4 scenarios failed on claude-sonnet-5 — bot-ally-core-red-skull, casual-match-core, tie-core-red-skull +1 more',
        meta: 'Coach eval',
      },
    ]);
    assert.equal(
      projection.active[0]!.label,
      'Coach eval: claude-sonnet-5 — 9/13 scenarios passed',
    );
  });

  it('should_use_the_singular_for_one_failed_scenario', () => {
    const projection = buildCoachEvalProjection(
      makeOkSummary({
        passedCount: 12,
        failedCount: 1,
        failedScenarios: [{ scenarioId: 'bot-ally-core-red-skull', failures: ['x'] }],
      }),
      NOW,
    );
    assert.equal(
      projection.backlog[0]!.label,
      'Coach eval: 1 scenario failed on claude-sonnet-5 — bot-ally-core-red-skull',
    );
  });

  it('should_flag_a_run_older_than_the_stale_threshold_but_not_one_at_it', () => {
    const atThreshold = buildCoachEvalProjection(
      makeOkSummary({
        generatedAt: new Date(NOW - COACH_EVAL_STALE_AFTER_DAYS * MILLIS_PER_DAY).toISOString(),
      }),
      NOW,
    );
    assert.deepEqual(atThreshold.backlog, []);

    const stale = buildCoachEvalProjection(
      makeOkSummary({
        generatedAt: new Date(
          NOW - (COACH_EVAL_STALE_AFTER_DAYS + 5) * MILLIS_PER_DAY,
        ).toISOString(),
      }),
      NOW,
    );
    assert.deepEqual(stale.backlog, [
      {
        id: 'coach-eval-stale',
        label: `Coach eval is ${COACH_EVAL_STALE_AFTER_DAYS + 5} days old — re-run it against the current COACH_MODEL`,
        meta: 'Coach eval',
      },
    ]);
  });

  it('should_show_date_unknown_and_skip_staleness_when_the_run_has_no_timestamp', () => {
    for (const generatedAt of [null, 'not-a-date']) {
      const projection = buildCoachEvalProjection(makeOkSummary({ generatedAt }), NOW);
      assert.deepEqual(projection.backlog, [], String(generatedAt));
      if (generatedAt === null) {
        assert.equal(projection.active[0]!.meta, 'date unknown');
      }
    }
  });

  it('should_project_an_injected_summary_through_the_composable', () => {
    const projection = useEvaluatorCoachEval({ status: 'missing' }, NOW).value;
    assert.deepEqual(
      projection.backlog.map((item) => item.id),
      ['coach-eval-missing'],
    );
  });

  it('should_read_the_build_time_summary_by_default', () => {
    const projection = useEvaluatorCoachEval().value;
    for (const item of [...projection.backlog, ...projection.active]) {
      assert.ok(item.id.startsWith('coach-eval-'), item.id);
    }
  });
});
