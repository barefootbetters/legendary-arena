/**
 * Dashboard DR Readiness — Pure derivation (WP-517 / EC-552)
 *
 * `deriveDrReadiness(issues, referenceDate)` turns the `DR drill due — <Month>
 * <Year>` GitHub issues into the `DrReadiness` projection. It is PURE: the
 * reference date is injected by the caller (the route supplies the wall clock;
 * the unit test supplies a fixed date), so this module reads no clock and no
 * network and its output is fully determined by its inputs. That is what lets
 * the derivation be tested with fixture issues against a fixed date without a
 * month-boundary flake.
 *
 * Authority: WP-517 §6/§Derivation; EC-552 Locked Values + Guardrails; D-24330.
 */

import type { DrReadiness, DrillIssue, DrillResult } from './dashboardDrReadiness.types.js';

/**
 * Exact title prefix a drill issue carries. The separator is an EM DASH
 * (U+2014), matching `dr-drill-reminder.yml`'s ``DR drill due — ${monthName}
 * ${year}`` — a plain hyphen would match zero issues.
 */
const DR_DRILL_TITLE_PREFIX = 'DR drill due — ';

/**
 * Full English month names in calendar order (index 0 = January). Matches the
 * workflow's `now.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })`,
 * so `MONTH_NAMES.indexOf(name)` recovers the 0-based month from a title.
 */
const MONTH_NAMES: readonly string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A 0-based year+month pair, comparable as `year * 12 + month`. */
interface YearMonth {
  readonly year: number;
  readonly month: number;
}

/**
 * Parse a drill issue title into its `{ year, month }`, or `null` when the title
 * is not a `DR drill due — <MonthName> <Year>` string. A non-matching title
 * (some other issue that happened to be returned) parses to `null` and is
 * dropped from the derivation.
 */
function parseTitleYearMonth(title: string): YearMonth | null {
  if (!title.startsWith(DR_DRILL_TITLE_PREFIX)) {
    return null;
  }
  const remainder = title.slice(DR_DRILL_TITLE_PREFIX.length).trim();
  const lastSpaceIndex = remainder.lastIndexOf(' ');
  if (lastSpaceIndex === -1) {
    return null;
  }
  const monthName = remainder.slice(0, lastSpaceIndex).trim();
  const yearText = remainder.slice(lastSpaceIndex + 1).trim();
  const month = MONTH_NAMES.indexOf(monthName);
  if (month === -1) {
    return null;
  }
  if (!/^\d{4}$/.test(yearText)) {
    return null;
  }
  return { year: Number(yearText), month };
}

/** Collapse a `YearMonth` to a single comparable ordinal (months since year 0). */
function toMonthOrdinal(yearMonth: YearMonth): number {
  return yearMonth.year * 12 + yearMonth.month;
}

/**
 * Read the `- [ ] Drill passed` checkbox from a drill issue body:
 *   - `- [x] Drill passed` (or `[X]`) → `pass`
 *   - `- [ ] Drill passed`           → `fail`
 *   - line absent                    → `unknown`
 *
 * Tolerant of leading whitespace and extra spaces inside the brackets; anchored
 * to the exact `Drill passed` label the workflow writes.
 */
function readDrillResult(body: string | null): DrillResult {
  if (body === null) {
    return 'unknown';
  }
  const checkboxPattern = /^\s*-\s*\[\s*([ xX])\s*\]\s*Drill passed\s*$/m;
  const match = checkboxPattern.exec(body);
  if (match === null) {
    return 'unknown';
  }
  const mark = match[1];
  return mark === 'x' || mark === 'X' ? 'pass' : 'fail';
}

/** Format a `Date` as the UTC `YYYY-MM-DD` calendar date. */
function toUtcIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * The 1st of the month AFTER `referenceDate`, as a UTC `YYYY-MM-DD` string.
 * `Date.UTC` rolls December over to the next January automatically.
 */
export function computeNextDue(referenceDate: Date): string {
  const nextMonthFirst = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1),
  );
  return toUtcIsoDate(nextMonthFirst);
}

/**
 * Derive the DR-readiness projection from live drill issues (`source: 'github'`).
 *
 * - Drops pull requests and any title that is not a `DR drill due — …` string.
 * - `overdue` = any OPEN drill issue whose title month is earlier than the
 *   injected reference month.
 * - `lastDrill` = the newest CLOSED drill issue (by `closedAt`), with `date` =
 *   its close date and `result` from its `Drill passed` checkbox; `null` when
 *   none has closed.
 * - `nextDue` = the 1st of the month after the reference date (UTC).
 */
export function deriveDrReadiness(issues: readonly DrillIssue[], referenceDate: Date): DrReadiness {
  // why: GitHub's issues endpoint returns pull requests alongside issues, and
  // the repo has unrelated issues; keep only real issues whose title is a drill
  // title so neither pollutes the derivation.
  const drillIssues = issues.filter(
    (issue) => !issue.isPullRequest && parseTitleYearMonth(issue.title) !== null,
  );

  const referenceOrdinal = toMonthOrdinal({
    year: referenceDate.getUTCFullYear(),
    month: referenceDate.getUTCMonth(),
  });

  let overdue = false;
  for (const issue of drillIssues) {
    if (issue.state !== 'open') {
      continue;
    }
    const titleYearMonth = parseTitleYearMonth(issue.title);
    if (titleYearMonth !== null && toMonthOrdinal(titleYearMonth) < referenceOrdinal) {
      overdue = true;
      break;
    }
  }

  let newestClosed: DrillIssue | null = null;
  for (const issue of drillIssues) {
    if (issue.state !== 'closed' || issue.closedAt === null) {
      continue;
    }
    if (newestClosed === null || issue.closedAt > (newestClosed.closedAt ?? '')) {
      newestClosed = issue;
    }
  }

  const lastDrill =
    newestClosed === null || newestClosed.closedAt === null
      ? null
      : {
          date: newestClosed.closedAt.slice(0, 10),
          result: readDrillResult(newestClosed.body),
        };

  return {
    lastDrill,
    nextDue: computeNextDue(referenceDate),
    overdue,
    source: 'github',
  };
}

/**
 * The mock-first fallback payload (`source: 'mock'`): no overdue drill, no last
 * drill, and the same `nextDue` the live path would compute for the reference
 * date. Served when `DASH_GITHUB_TOKEN` is absent/invalid or a GitHub fetch
 * fails — so the admin tile renders in every environment without ever 500-ing.
 */
export function buildMockDrReadiness(referenceDate: Date): DrReadiness {
  return {
    lastDrill: null,
    nextDue: computeNextDue(referenceDate),
    overdue: false,
    source: 'mock',
  };
}
