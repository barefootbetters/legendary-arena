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
// why: 2026-10-31 is the last day of the October billing period, so the
// composable's linear end-of-month projection equals the full-month actual, and
// Business Pulse can read the sum as a full month's infra cost.
export const INFRA_COST_ACTUALS_AS_OF = '2026-10-31';

// why: month-to-date spend per vendor as of INFRA_COST_ACTUALS_AS_OF, read from
// the vendor bills in C:\pcloud\legendary-arena\ops\accounting\expenses2026.
// October 2026 is the cutover month (2026-10-12), so both hosts billed.
// Sourcing, per vendor:
//   digitalocean — invoice 560663798 (Oct 12–31, issued and paid 2026-11-01):
//                  Droplets $17.37 + Droplet Backups $0.28 = $17.65 usage. A
//                  $5.00 account credit made the charge $12.65; usage is
//                  recorded here so the figure is the month's real run cost.
//   render       — Render invoice 0SPQWPNF-0007 (Oct 1–31, issued 2026-11-02),
//                  Servers line: 283 h to the cutover, $32.36. Static sites
//                  $0.00. The invoice total is $71.12 with the line below.
//   postgres     — the same invoice's PostgresDB line: 521 h (kept running to
//                  about 2026-10-22 after the cutover), $38.76.
//   cloudflare   — $0: carried from the 2026-07-27 billing-dashboard check (Zero
//                  Trust Teams Free + R2 within free-tier limits). Cloudflare
//                  bills R2 on a 23rd-to-22nd cycle; the Oct 23 – Nov 22 cycle
//                  is $10.26 to Nov 11 (R2 Infrequent Access operations), shown
//                  on the Monetization page's Cloudflare panel
//                  (config/cloudflareBilling.ts). Its October slice is not
//                  broken out, so October stays $0 here.
//   hanko        — $0: carried from the 2026-07-27 Hanko Cloud billing check
//                  (Starter plan). NOT re-checked for October.
// October total: $88.77. From November only DigitalOcean bills for hosting;
// render and postgres read $0 and can leave the vendor union after that.
// Order mirrors the canonical INFRA_COST_VENDORS array.
export const INFRA_COST_ACTUALS: readonly InfraCostActual[] = [
  { vendor: 'digitalocean', monthToDateCents: 1765 },
  { vendor: 'render', monthToDateCents: 3236 },
  { vendor: 'cloudflare', monthToDateCents: 0 },
  { vendor: 'postgres', monthToDateCents: 3876 },
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
