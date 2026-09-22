/**
 * Endgame AI Coach — Model Eval Rubric Scorer (WP-737 / EC-774 / D-24559)
 *
 * Pure scoring for the operator-run coach model eval. `scoreCoachReport` checks a
 * model's report against a scenario's deterministic rubric; `summarizeCoachEvalRun`
 * totals a run. No I/O, no model call, no LLM judge — the same report always
 * scores the same way.
 *
 * Layer/boundary: server layer only — imports only the coach and eval types.
 */

import type { CoachReport } from './coach.types.js';
import type {
  CoachEvalResult,
  CoachEvalRunSummary,
  CoachEvalScenario,
} from './coachEval.types.js';

/** The fewest suggestions a report may carry (the coach prompt asks for 2-3). */
const MINIMUM_SUGGESTION_COUNT = 2;
/** The most suggestions a report may carry. */
const MAXIMUM_SUGGESTION_COUNT = 3;

/**
 * Escape every regular-expression metacharacter in a term so it matches literally
 * (hero names carry `.`, `!`, `?` and `-`).
 *
 * @param term The literal term.
 * @returns The term with metacharacters escaped.
 */
function escapeRegularExpression(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `text` contains `term` as a whole term, case-insensitively. Uses
 * lookarounds instead of `\b` so a term that starts or ends with punctuation
 * ("S.H.I.E.L.D.", "Hulk Smash!") still matches, while "Thor" never matches
 * inside "authority".
 *
 * @param text The text to search.
 * @param term The term to find.
 * @returns True when the term appears as a whole term.
 */
export function containsWholeTerm(text: string, term: string): boolean {
  const pattern = new RegExp(`(?<!\\w)${escapeRegularExpression(term)}(?!\\w)`, 'i');
  return pattern.test(text);
}

/**
 * Join every model-authored field of a report into one searchable text.
 *
 * @param report The model's report.
 * @returns The headline, heroFit, purchases, and suggestions, newline-joined.
 */
function collectReportText(report: CoachReport): string {
  const parts = [report.headline, report.heroFit, report.purchases];
  for (const suggestion of report.suggestions) {
    parts.push(suggestion);
  }
  return parts.join('\n');
}

/**
 * Check the report's global structure: the three prose fields are non-empty and
 * there are 2-3 non-empty suggestions.
 *
 * @param report The model's report.
 * @returns One full-sentence failure per broken structure rule.
 */
function checkReportStructure(report: CoachReport): string[] {
  const failures: string[] = [];
  if (report.headline.trim() === '') {
    failures.push('The structure rule failed: the headline is empty.');
  }
  if (report.heroFit.trim() === '') {
    failures.push('The structure rule failed: the heroFit section is empty.');
  }
  if (report.purchases.trim() === '') {
    failures.push('The structure rule failed: the purchases section is empty.');
  }
  const suggestionCount = report.suggestions.length;
  if (suggestionCount < MINIMUM_SUGGESTION_COUNT || suggestionCount > MAXIMUM_SUGGESTION_COUNT) {
    failures.push(
      `The structure rule failed: the report has ${suggestionCount} suggestions, but it must have ${MINIMUM_SUGGESTION_COUNT} to ${MAXIMUM_SUGGESTION_COUNT}.`,
    );
  }
  for (let i = 0; i < report.suggestions.length; i++) {
    if (report.suggestions[i].trim() === '') {
      failures.push(`The structure rule failed: suggestion ${i + 1} is empty.`);
    }
  }
  return failures;
}

/**
 * Check `mustMentionAny`: the report must contain at least one term from every
 * alternative list.
 *
 * @param scenario The scenario whose rubric to apply.
 * @param reportText The report's searchable text.
 * @returns One full-sentence failure per unmet alternative list.
 */
function checkMustMentionAny(scenario: CoachEvalScenario, reportText: string): string[] {
  const failures: string[] = [];
  for (const alternatives of scenario.rubric.mustMentionAny ?? []) {
    let hasAnyTerm = false;
    for (const term of alternatives) {
      if (containsWholeTerm(reportText, term)) {
        hasAnyTerm = true;
        break;
      }
    }
    if (!hasAnyTerm) {
      failures.push(
        `The mustMentionAny rule failed: the report mentions none of ${alternatives.map((term) => `"${term}"`).join(', ')}.`,
      );
    }
  }
  return failures;
}

/**
 * Check `mustNotMention`: the report must not contain any listed term.
 *
 * @param scenario The scenario whose rubric to apply.
 * @param reportText The report's searchable text.
 * @returns One full-sentence failure per forbidden term found.
 */
function checkMustNotMention(scenario: CoachEvalScenario, reportText: string): string[] {
  const failures: string[] = [];
  for (const term of scenario.rubric.mustNotMention ?? []) {
    if (containsWholeTerm(reportText, term)) {
      failures.push(
        `The mustNotMention rule failed: the report mentions "${term}", which is not in this match.`,
      );
    }
  }
  return failures;
}

/**
 * Score one model report against a scenario's rubric. Checks, in order: the global
 * structure, `mustMentionAny`, then `mustNotMention`.
 *
 * @param scenario The eval scenario the report was generated for.
 * @param report The model's report.
 * @returns The scenario's result; `isPassing` is true only with no failures.
 */
export function scoreCoachReport(
  scenario: CoachEvalScenario,
  report: CoachReport,
): CoachEvalResult {
  const reportText = collectReportText(report);
  const failures = [
    ...checkReportStructure(report),
    ...checkMustMentionAny(scenario, reportText),
    ...checkMustNotMention(scenario, reportText),
  ];
  return {
    scenarioId: scenario.id,
    isPassing: failures.length === 0,
    failures,
  };
}

/**
 * Total an eval run.
 *
 * @param results Every scenario result in the run.
 * @returns The total, passed, and failed counts.
 */
export function summarizeCoachEvalRun(
  results: readonly CoachEvalResult[],
): CoachEvalRunSummary {
  let passedCount = 0;
  let failedCount = 0;
  for (const result of results) {
    if (result.isPassing) {
      passedCount += 1;
    } else {
      failedCount += 1;
    }
  }
  return { totalCount: results.length, passedCount, failedCount };
}
