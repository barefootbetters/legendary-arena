/**
 * Overview "business first" math (WP-791 / D-24653).
 *
 * Pure functions behind the Overview's money row, engagement strip, and the
 * Server / DR drill health cards. Every input is passed in — the caller supplies
 * `nowMs`, the fetched payloads, and the operator's stored inputs — so nothing
 * here reads a clock, browser storage, or the network, and every branch is unit
 * tested without mounting Vue.
 */

import type {
  ApiError,
  KpiStatus,
  MatchRecord,
  PlayerRecord,
  RuntimeHealthSnapshot,
  ServiceResponse,
} from '../types/index.js';
import type { DrillResult, DrReadiness } from '../services/drReadinessMocks.js';
import { computeRuntimeHealthStatus, type RuntimeHealthStatus } from './runtimeHealth.js';
import { formatUptime } from './format.js';

/**
 * The operator's operating inputs, as stored under the
 * `la-dashboard-operating-inputs` localStorage key. Money is integer cents and
 * the royalty rate is integer basis points (0..10000); `null` means "not
 * entered". `updatedAt` is the ISO-8601 time of the last save ('' when nothing
 * has been saved).
 */
export interface OperatingInputs {
  readonly version: 1;
  readonly cashBalanceCents: number | null;
  readonly otherFixedMonthlyCents: number | null;
  readonly royaltyRateBasisPoints: number | null;
  readonly updatedAt: string;
}

/** A money-row card: a cents value, not yet entered, or not available. */
export type MoneyCard =
  | { readonly state: 'value'; readonly valueCents: number }
  | { readonly state: 'not-entered' }
  | { readonly state: 'unavailable' };

/**
 * The Costs card is always a value (infra actuals are always present).
 * `isInfraOnly` is true when the operator has not entered other fixed costs.
 */
export interface CostsCard {
  readonly state: 'value';
  readonly valueCents: number;
  readonly isInfraOnly: boolean;
}

/** The Cash runway card adds a `profitable` state (net ≥ 0, nothing burning). */
export type RunwayCard =
  | { readonly state: 'value'; readonly months: number }
  | { readonly state: 'profitable' }
  | { readonly state: 'not-entered' }
  | { readonly state: 'unavailable' };

/** The five money-row cards, in display order. */
export interface BusinessPulse {
  readonly revenue: MoneyCard;
  readonly royalties: MoneyCard;
  readonly costs: CostsCard;
  readonly net: MoneyCard;
  readonly runway: RunwayCard;
}

/** Inputs to `computeBusinessPulse`. */
export interface BusinessPulseInput {
  /** `revenue_30d` in cents; `null` while the KPI fetch is loading or failed. */
  readonly revenue30dCents: number | null;
  /** Sum of the infra vendor actuals for one month, in cents. */
  readonly infraMonthlyCents: number;
  readonly inputs: OperatingInputs;
}

/**
 * Builds the money row. Precedence on every card is
 * `unavailable` > `not-entered` > `profitable` > `value`, so missing data is
 * never shown as a zero and runway never divides by a non-negative net.
 *
 * @param input - revenue, infra costs, and the operator's inputs.
 * @returns one discriminated result per card.
 */
export function computeBusinessPulse(input: BusinessPulseInput): BusinessPulse {
  const { revenue30dCents, infraMonthlyCents, inputs } = input;

  const otherFixedCents = inputs.otherFixedMonthlyCents;
  const costsCents = infraMonthlyCents + (otherFixedCents ?? 0);
  const costs: CostsCard = {
    state: 'value',
    valueCents: costsCents,
    isInfraOnly: otherFixedCents === null,
  };

  if (revenue30dCents === null) {
    return {
      revenue: { state: 'unavailable' },
      royalties: { state: 'unavailable' },
      costs,
      net: { state: 'unavailable' },
      runway: { state: 'unavailable' },
    };
  }

  const revenue: MoneyCard = { state: 'value', valueCents: revenue30dCents };
  const rateBasisPoints = inputs.royaltyRateBasisPoints;
  if (rateBasisPoints === null) {
    return {
      revenue,
      royalties: { state: 'not-entered' },
      costs,
      net: { state: 'not-entered' },
      runway: { state: 'not-entered' },
    };
  }

  const royaltiesCents = Math.round((revenue30dCents * rateBasisPoints) / 10000);
  const netCents = revenue30dCents - royaltiesCents - costsCents;
  return {
    revenue,
    royalties: { state: 'value', valueCents: royaltiesCents },
    costs,
    net: { state: 'value', valueCents: netCents },
    runway: computeRunway(netCents, inputs.cashBalanceCents),
  };
}

/**
 * Runway once net is known: not entered without a cash balance, profitable when
 * nothing is burning, else months of cash at the current monthly burn.
 */
function computeRunway(netCents: number, cashBalanceCents: number | null): RunwayCard {
  if (cashBalanceCents === null) {
    return { state: 'not-entered' };
  }
  if (netCents >= 0) {
    return { state: 'profitable' };
  }
  const months = cashBalanceCents / -netCents;
  return { state: 'value', months: Math.round(months * 10) / 10 };
}

/** One engagement card's count, and whether the feed behind it was truncated. */
export interface EngagementCount {
  readonly count: number;
  readonly isCapped: boolean;
  /** `"<count>"`, or `"<count>+"` when the feed hit its server-side limit. */
  readonly displayValue: string;
}

/** The three engagement cards; a card is `null` when its feed has no data. */
export interface Engagement {
  readonly matchesStarted: EngagementCount | null;
  readonly matchesFinished: EngagementCount | null;
  readonly activePlayers: EngagementCount | null;
}

/** Inputs to `computeEngagement`; a feed is `null` while loading or failed. */
export interface EngagementInput {
  readonly matches: readonly MatchRecord[] | null;
  readonly players: readonly PlayerRecord[] | null;
  readonly nowMs: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;
const ENGAGEMENT_WINDOW_DAYS = 7;

// why: D-24169 — /api/dash/matches returns at most 50 rows ordered by
// updated_at DESC, and /api/dash/players at most 100 ordered by created_at DESC.
// Neither order is the timestamp being counted (startedAt / lastActive), so a
// full feed can hide in-window rows past the limit and no window test can prove
// completeness: a full feed always reads "<count>+". The server also skips match
// rows without an initial_state AFTER its LIMIT, so a truncated feed can arrive
// short of 50; that undercount is not detectable here.
const MATCH_FEED_LIMIT = 50;
const PLAYER_FEED_LIMIT = 100;

/**
 * Counts matches and players over the trailing 7 days, inclusive at both ends.
 * Records with an empty or unparseable timestamp are excluded.
 *
 * @param input - the two feeds and the injected current time.
 * @returns one count per engagement card.
 */
export function computeEngagement(input: EngagementInput): Engagement {
  const { matches, players, nowMs } = input;
  const windowStartMs = nowMs - ENGAGEMENT_WINDOW_DAYS * MILLISECONDS_PER_DAY;

  let matchesStarted: EngagementCount | null = null;
  let matchesFinished: EngagementCount | null = null;
  if (matches !== null) {
    const matchCounts = countMatchesInWindow(matches, windowStartMs, nowMs);
    const isMatchFeedCapped = matches.length >= MATCH_FEED_LIMIT;
    matchesStarted = buildEngagementCount(matchCounts.started, isMatchFeedCapped);
    matchesFinished = buildEngagementCount(matchCounts.finished, isMatchFeedCapped);
  }

  let activePlayers: EngagementCount | null = null;
  if (players !== null) {
    let activeCount = 0;
    for (const player of players) {
      if (isInWindow(player.lastActive, windowStartMs, nowMs)) {
        activeCount += 1;
      }
    }
    activePlayers = buildEngagementCount(activeCount, players.length >= PLAYER_FEED_LIMIT);
  }

  return { matchesStarted, matchesFinished, activePlayers };
}

/** Counts matches started in the window, and those of them that finished. */
function countMatchesInWindow(
  matches: readonly MatchRecord[],
  windowStartMs: number,
  nowMs: number,
): { started: number; finished: number } {
  let started = 0;
  let finished = 0;
  for (const match of matches) {
    if (!isInWindow(match.startedAt, windowStartMs, nowMs)) {
      continue;
    }
    started += 1;
    // why: D-24169 maps only heroes-win / scheme-wins to an outcome; a tie is
    // projected as 'in_progress', so ties count as unfinished here. A known
    // undercount — hence the "Finished with a winner" label.
    if (match.outcome !== 'in_progress') {
      finished += 1;
    }
  }
  return { started, finished };
}

/** True when the timestamp parses and falls in [windowStartMs, nowMs]. */
function isInWindow(timestamp: string, windowStartMs: number, nowMs: number): boolean {
  if (timestamp === '') {
    return false;
  }
  const parsedMs = Date.parse(timestamp);
  if (!Number.isFinite(parsedMs)) {
    return false;
  }
  return parsedMs >= windowStartMs && parsedMs <= nowMs;
}

/** Wraps a count with its cap flag and display string. */
function buildEngagementCount(count: number, isCapped: boolean): EngagementCount {
  return { count, isCapped, displayValue: isCapped ? `${count}+` : String(count) };
}

/** What a `useFetch` call exposes, narrowed to what the card builders read. */
export interface FetchedCardInput<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly source: ServiceResponse<T>['source'] | null;
}

/** A health card's text and status chip (`null` = no chip). */
export interface HealthCardView {
  readonly valueLabel: string;
  readonly status: KpiStatus | null;
}

type ApiErrorKind = 'auth' | 'unreachable' | 'unknown';

const AUTH_ERROR_CODES: readonly string[] = ['unauthorized', 'forbidden', '401', '403'];

/**
 * Classifies a dashboard `ApiError`. It carries no HTTP status, but
 * `normalizeError` falls back to the status string for `code` when the body has
 * none, and marks 5xx / network / timeout as `retryable`.
 */
function classifyApiError(error: ApiError): ApiErrorKind {
  if (error.code !== undefined && AUTH_ERROR_CODES.includes(error.code)) {
    return 'auth';
  }
  if (error.retryable === true) {
    return 'unreachable';
  }
  return 'unknown';
}

const RUNTIME_STATUS_TO_KPI_STATUS: Readonly<Record<RuntimeHealthStatus, KpiStatus>> = {
  healthy: 'on-track',
  watch: 'needs-attention',
  saturated: 'off-track',
};

const NO_VALUE: HealthCardView = { valueLabel: '—', status: null };

/**
 * The Server card: uptime plus the same event-loop grading System Health uses.
 *
 * @param input - the runtime-health fetch result.
 * @returns the card text and chip.
 */
export function describeServerCard(input: FetchedCardInput<RuntimeHealthSnapshot>): HealthCardView {
  if (input.error !== null) {
    if (classifyApiError(input.error) === 'unreachable') {
      return { valueLabel: 'Unreachable', status: 'off-track' };
    }
    // why: a 401/403 is the operator's dashboard sign-in failing, not the game
    // server being down, so it must not paint the Server card red; an
    // unclassifiable error is equally no evidence either way.
    return NO_VALUE;
  }
  if (input.data === null) {
    return NO_VALUE;
  }
  const valueLabel = `Up · ${formatUptime(input.data.uptimeSeconds)}`;
  if (input.source === 'MOCK') {
    return { valueLabel, status: null };
  }
  return {
    valueLabel,
    status: RUNTIME_STATUS_TO_KPI_STATUS[computeRuntimeHealthStatus(input.data)],
  };
}

/** PASS / FAIL / Unknown, matching the DR Readiness widget's result chip. */
function describeDrillResult(result: DrillResult): string {
  if (result === 'pass') {
    return 'PASS';
  }
  if (result === 'fail') {
    return 'FAIL';
  }
  return 'Unknown';
}

/**
 * The DR drill card: the last drill date + result, graded on the overdue flag.
 *
 * @param input - the DR-readiness fetch result.
 * @returns the card text and chip.
 */
export function describeDrDrillCard(input: FetchedCardInput<DrReadiness>): HealthCardView {
  if (input.error !== null || input.data === null) {
    return NO_VALUE;
  }
  const readiness = input.data;
  if (input.source === 'MOCK') {
    // why: VITE_USE_MOCKS dev mode — show the mock value but never a verdict
    // (the INFRA #2562 rule). Checked before the payload's own `source`, which
    // the mock factory also sets to 'mock'.
    if (readiness.lastDrill === null) {
      return { valueLabel: 'None recorded', status: null };
    }
    const mockLabel = `${readiness.lastDrill.date} · ${describeDrillResult(readiness.lastDrill.result)}`;
    return { valueLabel: mockLabel, status: null };
  }
  if (readiness.source === 'mock') {
    // why: production has no DASH_GITHUB_TOKEN, so the server answers with its
    // placeholder payload (no drill, not overdue). Showing that as "On track"
    // would be a fabricated verdict; the feed is simply not connected.
    return { valueLabel: 'Not connected', status: null };
  }
  if (readiness.lastDrill === null) {
    return { valueLabel: 'None recorded', status: null };
  }
  return {
    valueLabel: `${readiness.lastDrill.date} · ${describeDrillResult(readiness.lastDrill.result)}`,
    status: readiness.overdue ? 'off-track' : 'on-track',
  };
}
