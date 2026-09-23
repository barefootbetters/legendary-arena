/**
 * Tests for the coach model eval pack (WP-737 / EC-774 / D-24559).
 *
 * Covers the pure rubric scorer (structure, mustMentionAny, mustNotMention, and
 * whole-term matching), the run summary, and the fixture set's self-consistency.
 * Canned reports only — the live client is never constructed and the API key env
 * var is never read, so these tests make zero paid calls.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import type { CoachReport } from './coach.types.js';
import type { CoachEvalCategory, CoachEvalScenario } from './coachEval.types.js';
import { COACH_EVAL_CATEGORIES } from './coachEval.types.js';
import { COACH_EVAL_SCENARIOS } from './coachEval.fixtures.js';
import {
  containsWholeTerm,
  scoreCoachReport,
  summarizeCoachEvalRun,
} from './coachEval.logic.js';

/** A scenario with a rubric exercising both term rules. */
const RUBRIC_SCENARIO: CoachEvalScenario = {
  id: 'rubric-test-scenario',
  category: 'hallucination-guard',
  description: 'A test scenario exercising both term rules.',
  summary: COACH_EVAL_SCENARIOS[0].summary,
  rubric: {
    mustMentionAny: [['Player 1', 'P1'], ['luck', 'lucky']],
    mustNotMention: ['Wolverine'],
  },
};

/** A report that satisfies RUBRIC_SCENARIO. */
const COMPLIANT_REPORT: CoachReport = {
  headline: 'A lucky, well-earned win.',
  heroFit: 'Captain America and Spider-Man fit the bank robbery well.',
  purchases: 'Player 1 bought Avengers Assemble! early, which paid off.',
  suggestions: ['Rescue bystanders sooner.', 'Pressure Red Skull earlier.'],
};

/**
 * Build a report from the compliant one with some fields replaced.
 *
 * @param overrides The fields to replace.
 * @returns The modified report.
 */
function withReportChanges(overrides: Partial<CoachReport>): CoachReport {
  return { ...COMPLIANT_REPORT, ...overrides };
}

/**
 * Assert a report fails RUBRIC_SCENARIO with a failure naming the given rule.
 *
 * @param report The report to score.
 * @param ruleName The rule name the failure sentence must contain.
 */
function assertFailsRule(report: CoachReport, ruleName: string): void {
  const result = scoreCoachReport(RUBRIC_SCENARIO, report);
  assert.equal(result.isPassing, false);
  assert.ok(
    result.failures.some((failure) => failure.includes(ruleName)),
    `Expected a failure naming the ${ruleName} rule, got: ${result.failures.join(' | ')}`,
  );
}

test('a compliant report passes with no failures', () => {
  const result = scoreCoachReport(RUBRIC_SCENARIO, COMPLIANT_REPORT);
  assert.equal(result.scenarioId, 'rubric-test-scenario');
  assert.equal(result.isPassing, true);
  assert.deepEqual(result.failures, []);
});

test('an empty headline fails the structure rule', () => {
  assertFailsRule(withReportChanges({ headline: '   ' }), 'structure');
});

test('an empty heroFit fails the structure rule', () => {
  assertFailsRule(withReportChanges({ heroFit: '' }), 'structure');
});

test('an empty purchases section fails the structure rule', () => {
  assertFailsRule(withReportChanges({ purchases: '' }), 'structure');
});

test('one suggestion fails the structure rule', () => {
  assertFailsRule(withReportChanges({ suggestions: ['Only one tip.'] }), 'structure');
});

test('four suggestions fail the structure rule', () => {
  assertFailsRule(withReportChanges({ suggestions: ['One.', 'Two.', 'Three.', 'Four.'] }), 'structure');
});

test('an empty suggestion fails the structure rule', () => {
  assertFailsRule(withReportChanges({ suggestions: ['A real tip.', ''] }), 'structure');
});

test('three suggestions pass the structure rule', () => {
  const result = scoreCoachReport(
    RUBRIC_SCENARIO,
    withReportChanges({ suggestions: ['One.', 'Two.', 'Three.'] }),
  );
  assert.equal(result.isPassing, true);
});

test('a report missing one mustMentionAny list fails that rule', () => {
  assertFailsRule(
    withReportChanges({ headline: 'A well-earned win.' }),
    'mustMentionAny',
  );
});

test('any alternative in a mustMentionAny list satisfies it', () => {
  const result = scoreCoachReport(
    RUBRIC_SCENARIO,
    withReportChanges({ purchases: 'P1 bought Avengers Assemble! early.' }),
  );
  assert.equal(result.isPassing, true);
});

test('a report naming a mustNotMention term fails that rule', () => {
  assertFailsRule(
    withReportChanges({ suggestions: ['Draft Wolverine next time.', 'Rescue more bystanders.'] }),
    'mustNotMention',
  );
});

test('isPassing is true exactly when there are no failures', () => {
  const failing = scoreCoachReport(RUBRIC_SCENARIO, withReportChanges({ headline: '' }));
  assert.equal(failing.isPassing, failing.failures.length === 0);
  const passing = scoreCoachReport(RUBRIC_SCENARIO, COMPLIANT_REPORT);
  assert.equal(passing.isPassing, passing.failures.length === 0);
});

test('whole-term matching: Thor does not match inside authority', () => {
  assert.equal(containsWholeTerm('The team showed real authority.', 'Thor'), false);
  assert.equal(containsWholeTerm('Thor carried the fight.', 'Thor'), true);
});

test('whole-term matching: Spider-Man matches Spider-Man, case-insensitively', () => {
  assert.equal(containsWholeTerm('Spider-Man swung in.', 'Spider-Man'), true);
  assert.equal(containsWholeTerm('spider-man swung in.', 'Spider-Man'), true);
});

test('whole-term matching: luck does not match lucky (the lists enumerate inflections)', () => {
  assert.equal(containsWholeTerm('A lucky draw.', 'luck'), false);
  assert.equal(containsWholeTerm('Pure luck.', 'luck'), true);
});

test('whole-term matching: a term edged with punctuation still matches', () => {
  assert.equal(containsWholeTerm('Recruit S.H.I.E.L.D. Officers.', 'S.H.I.E.L.D.'), true);
  assert.equal(containsWholeTerm('Play Hulk Smash! first.', 'Hulk Smash!'), true);
  assert.equal(containsWholeTerm('Take Dr. Doom down.', 'Dr. Doom'), true);
});

test('summarizeCoachEvalRun counts a mixed result set', () => {
  const summary = summarizeCoachEvalRun([
    { scenarioId: 'a', isPassing: true, failures: [] },
    { scenarioId: 'b', isPassing: false, failures: ['The structure rule failed: the headline is empty.'] },
    { scenarioId: 'c', isPassing: true, failures: [] },
  ]);
  assert.deepEqual(summary, { totalCount: 3, passedCount: 2, failedCount: 1 });
});

test('summarizeCoachEvalRun counts an empty run as all zero', () => {
  assert.deepEqual(summarizeCoachEvalRun([]), { totalCount: 0, passedCount: 0, failedCount: 0 });
});

test('the fixture set has at least 10 scenarios with unique ids', () => {
  assert.ok(COACH_EVAL_SCENARIOS.length >= 10);
  const ids = new Set(COACH_EVAL_SCENARIOS.map((scenario) => scenario.id));
  assert.equal(ids.size, COACH_EVAL_SCENARIOS.length);
});

test('every eval category has at least one scenario', () => {
  const coveredCategories = new Set(COACH_EVAL_SCENARIOS.map((scenario) => scenario.category));
  for (const category of COACH_EVAL_CATEGORIES) {
    assert.ok(coveredCategories.has(category), `No scenario covers the ${category} category.`);
  }
});

test('COACH_EVAL_CATEGORIES matches the CoachEvalCategory union exactly', () => {
  // A Record over the union forces every member to be listed here (and no
  // extras), so a union change without an array change fails at runtime below.
  const categoryPresence: Record<CoachEvalCategory, true> = {
    'baseline-win': true,
    'unlucky-loss': true,
    'lucky-win': true,
    'two-seat-contribution': true,
    solo: true,
    'hallucination-guard': true,
    'no-purchases': true,
    'pre-par-summary': true,
    tie: true,
    'five-players': true,
    'casual-match': true,
    'bot-ally': true,
  };
  assert.deepEqual([...COACH_EVAL_CATEGORIES].sort(), Object.keys(categoryPresence).sort());
  assert.equal(new Set(COACH_EVAL_CATEGORIES).size, COACH_EVAL_CATEGORIES.length);
});

test('every seat label is in the production Player N form and playerCount matches the seats', () => {
  for (const scenario of COACH_EVAL_SCENARIOS) {
    assert.equal(scenario.summary.perPlayer.length, scenario.summary.playerCount, scenario.id);
    scenario.summary.perPlayer.forEach((seat, index) => {
      assert.equal(seat.label, `Player ${index + 1}`, scenario.id);
    });
  }
});

test('each category-specific scenario has the shape its category promises', () => {
  for (const scenario of COACH_EVAL_SCENARIOS) {
    const summary = scenario.summary;
    if (scenario.category === 'solo') {
      assert.equal(summary.playerCount, 1, scenario.id);
    }
    if (scenario.category === 'five-players') {
      assert.equal(summary.playerCount, 5, scenario.id);
    }
    if (scenario.category === 'tie') {
      assert.equal(summary.outcome, 'tie', scenario.id);
    }
    if (scenario.category === 'pre-par-summary') {
      assert.equal(summary.adversityExpected, undefined, scenario.id);
    }
    // why: WP-751 / D-24576 — a casual summary has none of the four PAR fields (they
    // are omitted, never zeroed), exactly as buildCasualCoachMatchSummary emits it.
    if (scenario.category === 'casual-match') {
      for (const field of ['rawScore', 'finalScore', 'grade', 'adversityExpected']) {
        assert.equal(field in summary, false, `${scenario.id} must omit ${field}`);
      }
    }
    if (scenario.category === 'no-purchases') {
      assert.ok(summary.perPlayer.some((seat) => seat.acquiredCards.length === 0), scenario.id);
    }
    if (scenario.category === 'two-seat-contribution') {
      assert.equal(summary.playerCount, 2, scenario.id);
      assert.notEqual(summary.perPlayer[0].villainsDefeated, summary.perPlayer[1].villainsDefeated, scenario.id);
    }
    if (scenario.category === 'bot-ally') {
      assert.equal(summary.playerCount, 2, scenario.id);
      assert.equal(summary.perPlayer[0].isBotAlly, false, `${scenario.id} seat 1 must be the human.`);
      assert.equal(summary.perPlayer[1].isBotAlly, true, `${scenario.id} seat 2 must be the bot ally.`);
    }
  }
});

test('every fixture seat carries an explicit isBotAlly, as production summaries do', () => {
  for (const scenario of COACH_EVAL_SCENARIOS) {
    let botSeatCount = 0;
    for (const seat of scenario.summary.perPlayer) {
      assert.equal(typeof seat.isBotAlly, 'boolean', `${scenario.id} ${seat.label} is missing isBotAlly.`);
      if (seat.isBotAlly === true) {
        botSeatCount += 1;
      }
    }
    const expectedBotSeats = scenario.category === 'bot-ally' ? 1 : 0;
    assert.equal(botSeatCount, expectedBotSeats, `${scenario.id} has an unexpected number of bot seats.`);
  }
});

test('every hallucination-guard decoy is absent from its own summary', () => {
  for (const scenario of COACH_EVAL_SCENARIOS) {
    if (scenario.category !== 'hallucination-guard') {
      continue;
    }
    const decoys = scenario.rubric.mustNotMention ?? [];
    assert.ok(decoys.length >= 3, `${scenario.id} needs at least 3 decoy names.`);
    const summary = scenario.summary;
    const summaryNames = [
      summary.scheme,
      summary.mastermind,
      ...summary.villainGroups,
      ...summary.henchmanGroups,
      ...summary.heroes,
    ];
    for (const seat of summary.perPlayer) {
      summaryNames.push(...seat.acquiredCards);
    }
    const summaryText = summaryNames.join('\n');
    for (const decoy of decoys) {
      assert.equal(
        containsWholeTerm(summaryText, decoy),
        false,
        `${scenario.id} lists the decoy ${decoy}, but it appears in the summary.`,
      );
    }
  }
});
