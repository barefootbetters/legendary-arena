// why: manually-maintained infrastructure cost actuals — the real month-to-date
// spend per vendor, read from each vendor's billing dashboard. This is the
// LIVE-data source for the Infra Cost Watchdog panel, replacing the mock
// factory. It is NOT auto-fetched (no vendor billing API is wired), so the
// widget labels it `CACHED` (a stored snapshot), not `LIVE`. Monthly refresh
// workflow: read the vendor bills, update the figures below + the AS_OF date.

import {
  INFRA_COST_VENDORS,
  type InfraCostEntry,
  type InfraCostVendor,
  type ServiceResponse,
} from '../types/index.js';

/**
 * One vendor's month-to-date spend, in integer cents (D-19601 integer-cents
 * discipline — the composable arithmetic stays in cents to avoid float drift).
 */
export interface InfraCostActual {
  readonly vendor: InfraCostVendor;
  readonly monthToDateCents: number;
}

// why: the snapshot date these actuals were read from the vendor bills, as a
// YYYY-MM-DD string. It anchors the freshness badge ("CACHED · N days ago") and
// is the `date` stamped on every derived entry so `useInfraCostWatchdog` reads
// the calendar month/day from it (the composable parses this string, never a
// wall clock). Update it every time the figures below are refreshed.
export const INFRA_COST_ACTUALS_AS_OF = '2026-07-27';

// why: month-to-date spend per vendor as of INFRA_COST_ACTUALS_AS_OF, read from
// the vendor billing dashboards. Sourcing, per vendor:
//   render     — the Render bill's compute + pipeline: legendary-arena-server
//                ($15.14) + pipeline minutes ($5.00). The Postgres datastore is
//                billed on the same Render account but tracked as its own vendor
//                line below, matching the panel's separate Postgres budget.
//   postgres   — the Render-managed legendary-arena-db datastore ($9.64).
//   cloudflare — $0: Zero Trust Teams Free + R2 entirely within free-tier limits
//                (0.21 of 10 GB-months storage, ops under the free ceilings, no
//                egress fees), confirmed from the Cloudflare billing dashboard.
//                (The barefootbetters.com Pro plan is a different project.)
//   hanko      — $0: Starter plan (0 of 10,000 MAU, 0 of 2 projects), confirmed
//                from the Hanko Cloud billing page.
// All four figures are real: Render + Postgres exact-dollar from the bill,
// Cloudflare + Hanko confirmed $0 on their free tiers.
// Order mirrors the canonical INFRA_COST_VENDORS array.
export const INFRA_COST_ACTUALS: readonly InfraCostActual[] = [
  { vendor: 'render', monthToDateCents: 2014 },
  { vendor: 'cloudflare', monthToDateCents: 0 },
  { vendor: 'postgres', monthToDateCents: 964 },
  { vendor: 'hanko', monthToDateCents: 0 },
];

// why: fail-loud drift check at module load, mirroring INFRA_COST_BUDGETS — if a
// vendor is added to the canonical union without an actual here, the widget
// would silently omit that vendor's cost. Better to crash the import.
if (INFRA_COST_ACTUALS.length !== INFRA_COST_VENDORS.length) {
  throw new Error(
    `INFRA_COST_ACTUALS length (${INFRA_COST_ACTUALS.length}) does not match ` +
      `INFRA_COST_VENDORS length (${INFRA_COST_VENDORS.length}); add or remove a ` +
      `vendor actual so every vendor in the canonical union has a figure.`,
  );
}

/**
 * Build the Infra Cost Watchdog response from INFRA_COST_ACTUALS. Emits one
 * InfraCostEntry per vendor, dated INFRA_COST_ACTUALS_AS_OF with that vendor's
 * month-to-date cents, so `useInfraCostWatchdog` sums each vendor's exact MTD
 * and derives the (linear) end-of-month projection from the snapshot's day of
 * month. `source: 'CACHED'` marks a stored manual snapshot — not live-polled,
 * not mock. No parameters: these actuals are date-fixed, not range-derived
 * (the operator's date-range picker does not reshape a monthly bill).
 */
export function fetchInfraCostActuals(): ServiceResponse<readonly InfraCostEntry[]> {
  const entries: InfraCostEntry[] = [];
  for (const actual of INFRA_COST_ACTUALS) {
    entries.push({
      vendor: actual.vendor,
      date: INFRA_COST_ACTUALS_AS_OF,
      amountCents: actual.monthToDateCents,
      currency: 'USD',
    });
  }
  return {
    data: entries,
    source: 'CACHED',
    // why: freshness anchors to the snapshot date (parsed once here, not in the
    // pure composable), so the badge reads "CACHED · N days ago" — honest about
    // how stale the manually-entered figures are.
    updatedAt: Date.parse(INFRA_COST_ACTUALS_AS_OF),
  };
}
