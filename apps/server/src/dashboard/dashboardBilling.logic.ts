/**
 * Dashboard Billing + Revenue Endpoints — Query Logic (WP-373 / EC-402)
 *
 * Read-only aggregations over the Stripe tables (migration 012) that back the
 * dashboard's `/api/dash/metrics/billing/health` (+ sparklines), `/revenue`, and
 * `/metrics/revenue` feeds. No writes, no Stripe API calls.
 *
 * Data sources (verified WP-373):
 *   * webhook health   — `legendary.stripe_events.process_error` (non-null = a
 *                        failed webhook) over `received_at`.
 *   * intent health    — `legendary.stripe_checkout_sessions.intent_status`
 *                        (`expired`/`canceled` = abandoned) over `created_at`.
 *   * revenue amount   — the completed-checkout webhook envelope's
 *                        `amount_total` (Stripe minor units / cents) — the price
 *                        allowlist carries no amount and no column stores it.
 *
 * The rate math and day-bucket fill are pure and injectable (a fixed `nowMs`), so
 * they unit-test without a database; the SQL is exercised by the DB-gated
 * integration suite.
 *
 * Authority: WP-373; D-24168; D-19603 (rate invariants); D-20501 (SQL discipline).
 */

import type {
  BillingHealth,
  BillingHealthSparklines,
  BillingHealthSparklinePoint,
  DailyMetric,
  DatabaseClient,
  RevenueRecord,
} from './dashboardBilling.types.js';

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * A rate in `[0, 1]`. A zero denominator yields `0` (never `NaN`) — the D-19603
 * invariant so an empty window renders a clean 0% rather than a broken chart.
 *
 * @param count The numerator (failures / abandonments).
 * @param total The denominator (all events in the window).
 * @returns `count / total`, or `0` when `total` is `0`.
 */
export function computeRate(count: number, total: number): number {
  if (total === 0) {
    return 0;
  }
  return count / total;
}

/**
 * Convert a Stripe minor-unit amount (cents) to whole currency units (dollars),
 * matching the dashboard mock convention (`amount` in dollars).
 *
 * @param cents The integer minor-unit amount.
 * @returns The amount in whole currency units.
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** The window `[start, end)` for a trailing `days` span ending at `nowMs`. */
function computeWindow(days: number, nowMs: number): { start: Date; end: Date } {
  const end = new Date(nowMs);
  const start = new Date(nowMs - days * MILLISECONDS_PER_DAY);
  return { start, end };
}

/** Enumerate the UTC calendar days `YYYY-MM-DD` covered by `[start, end]` inclusive. */
function enumerateUtcDays(start: Date, end: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const lastMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  while (cursor.getTime() <= lastMs) {
    days.push(cursor.toISOString().split('T')[0] ?? '');
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Read a bigint-ish DB cell (pg returns bigint as string) as a JS number. */
function toCount(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Aggregate billing health over the trailing `days` window: webhook-failure rate
 * (from `stripe_events.process_error`) and checkout-intent-abandonment rate (from
 * `stripe_checkout_sessions.intent_status`).
 */
export async function getBillingHealth(
  database: DatabaseClient,
  days: number,
  nowMs: number = Date.now(),
): Promise<BillingHealth> {
  const { start, end } = computeWindow(days, nowMs);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const webhookResult = await database.query(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE process_error IS NOT NULL) AS failures
       FROM legendary.stripe_events
      WHERE received_at >= $1::timestamptz AND received_at < $2::timestamptz`,
    [startIso, endIso],
  );
  const intentResult = await database.query(
    `SELECT count(*) AS total,
            count(*) FILTER (WHERE intent_status IN ('expired', 'canceled')) AS abandoned
       FROM legendary.stripe_checkout_sessions
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
    [startIso, endIso],
  );

  const webhookRow = webhookResult.rows[0] ?? {};
  const intentRow = intentResult.rows[0] ?? {};
  const webhookTotal = toCount(webhookRow.total);
  const webhookFailures = toCount(webhookRow.failures);
  const intentTotal = toCount(intentRow.total);
  const intentAbandoned = toCount(intentRow.abandoned);

  return {
    windowStart: startIso,
    windowEnd: endIso,
    webhookFailureRate: computeRate(webhookFailures, webhookTotal),
    webhookFailureCount: webhookFailures,
    webhookTotalCount: webhookTotal,
    intentAbandonmentRate: computeRate(intentAbandoned, intentTotal),
    intentAbandonedCount: intentAbandoned,
    intentTotalCount: intentTotal,
  };
}

/** Fold per-day `{ day, total, numerator }` rows into a zero-filled rate sparkline. */
function buildSparkline(
  rows: ReadonlyArray<Record<string, unknown>>,
  numeratorKey: string,
  days: string[],
): BillingHealthSparklinePoint[] {
  const byDay = new Map<string, { total: number; numerator: number }>();
  for (const row of rows) {
    const day = String(row.day ?? '');
    byDay.set(day, {
      total: toCount(row.total),
      numerator: toCount(row[numeratorKey]),
    });
  }
  const points: BillingHealthSparklinePoint[] = [];
  for (const day of days) {
    const bucket = byDay.get(day);
    const total = bucket?.total ?? 0;
    const numerator = bucket?.numerator ?? 0;
    points.push({ date: day, rate: computeRate(numerator, total) });
  }
  return points;
}

/**
 * Per-UTC-day webhook-failure and intent-abandonment rates across the window.
 * Every day in the window is emitted (missing days render rate `0`).
 */
export async function getBillingHealthSparklines(
  database: DatabaseClient,
  days: number,
  nowMs: number = Date.now(),
): Promise<BillingHealthSparklines> {
  const { start, end } = computeWindow(days, nowMs);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const dayList = enumerateUtcDays(start, end);

  const webhookResult = await database.query(
    `SELECT to_char(received_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            count(*) AS total,
            count(*) FILTER (WHERE process_error IS NOT NULL) AS failures
       FROM legendary.stripe_events
      WHERE received_at >= $1::timestamptz AND received_at < $2::timestamptz
      GROUP BY 1`,
    [startIso, endIso],
  );
  const intentResult = await database.query(
    `SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            count(*) AS total,
            count(*) FILTER (WHERE intent_status IN ('expired', 'canceled')) AS abandoned
       FROM legendary.stripe_checkout_sessions
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
      GROUP BY 1`,
    [startIso, endIso],
  );

  return {
    webhook: buildSparkline(webhookResult.rows, 'failures', dayList),
    intent: buildSparkline(intentResult.rows, 'abandoned', dayList),
  };
}

/** Parse a jsonb `amount_total` text cell to an integer cent count, or null if invalid. */
function parseAmountCents(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  if (!/^[0-9]+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * The most recent completed purchases, newest first. Amount is read from the
 * `checkout.session.completed` webhook envelope's `amount_total` (cents → dollars);
 * a row with a missing/malformed `amount_total` is **skipped**, never zero-filled.
 * `source` is the purchase's entitlement key (falling back to `stripe`).
 */
export async function getRevenueRecords(
  database: DatabaseClient,
  limit: number,
): Promise<RevenueRecord[]> {
  const result = await database.query(
    `SELECT e.event_id AS id,
            to_char(e.received_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
            e.payload->'data'->'object'->>'amount_total' AS amount_total,
            upper(coalesce(e.payload->'data'->'object'->>'currency', 'usd')) AS currency,
            coalesce(s.entitlement_key, 'stripe') AS source
       FROM legendary.stripe_events e
       LEFT JOIN legendary.stripe_checkout_sessions s
         ON s.session_id = (e.payload->'data'->'object'->>'id')
      WHERE e.event_type = 'checkout.session.completed'
      ORDER BY e.received_at DESC
      LIMIT $1::int`,
    [limit],
  );

  const records: RevenueRecord[] = [];
  for (const row of result.rows) {
    const cents = parseAmountCents(row.amount_total);
    if (cents === null) {
      // why: skip-on-missing — a completed-checkout event without a parseable
      // amount_total is not fabricated into a $0 record that would distort totals.
      continue;
    }
    records.push({
      id: String(row.id ?? ''),
      date: String(row.date ?? ''),
      amount: centsToDollars(cents),
      source: String(row.source ?? 'stripe'),
      currency: String(row.currency ?? 'USD'),
    });
  }
  return records;
}

/**
 * Daily revenue totals (dollars) across the trailing `days` window, one point per
 * UTC day (missing days render `0`). Only numeric `amount_total` values are summed.
 */
export async function getRevenueDaily(
  database: DatabaseClient,
  days: number,
  nowMs: number = Date.now(),
): Promise<DailyMetric[]> {
  const { start, end } = computeWindow(days, nowMs);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const dayList = enumerateUtcDays(start, end);

  const result = await database.query(
    `SELECT to_char(received_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            sum((payload->'data'->'object'->>'amount_total')::bigint) AS cents
       FROM legendary.stripe_events
      WHERE event_type = 'checkout.session.completed'
        AND (payload->'data'->'object'->>'amount_total') ~ '^[0-9]+$'
        AND received_at >= $1::timestamptz AND received_at < $2::timestamptz
      GROUP BY 1`,
    [startIso, endIso],
  );

  const centsByDay = new Map<string, number>();
  for (const row of result.rows) {
    centsByDay.set(String(row.day ?? ''), toCount(row.cents));
  }
  const metrics: DailyMetric[] = [];
  for (const day of dayList) {
    metrics.push({ date: day, value: centsToDollars(centsByDay.get(day) ?? 0) });
  }
  return metrics;
}
