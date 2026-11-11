// why: manually-maintained Cloudflare billing snapshot, read from Cloudflare's
// metered-usage budget email and the account's billing page (no billing API is
// wired). Cloudflare bills R2 on a cycle that runs from the 23rd to the 22nd,
// not by calendar month. It feeds the Monetization page's Cloudflare panel,
// which labels it CACHED. Refresh workflow: when a cycle's invoice lands, mark
// that cycle `invoiced` with its final lines, add the new cycle-to-date row,
// and update CLOUDFLARE_BILLING_AS_OF.

/**
 * One product line on a Cloudflare bill. `usage` is the billable quantity as
 * the bill prints it; `cents` is the line's cost in integer cents (D-19601
 * integer-cents discipline).
 */
export interface CloudflareBillLine {
  readonly product: string;
  readonly usage: string;
  readonly cents: number;
}

/**
 * One Cloudflare billing cycle. `invoiced` cycles are final; a `cycle-to-date`
 * cycle is the running metered summary, with Cloudflare's projection for the
 * full cycle.
 */
export interface CloudflareBillingCycle {
  readonly cycle: string;
  readonly status: 'invoiced' | 'cycle-to-date';
  readonly lines: readonly CloudflareBillLine[];
  readonly projectedCycleCents: number;
  readonly note: string;
}

// why: the last day of usage the newest figure below covers (the budget email's
// "Usage observed Oct 23 - Nov 11, 2026").
export const CLOUDFLARE_BILLING_AS_OF = '2026-11-11';

export const CLOUDFLARE_BILLING_URL = 'https://dash.cloudflare.com/?to=/:account/billing';

// why: matches the Cloudflare line of `ledger.budget.byVendor` in
// dashboard.json ($50 a month).
export const CLOUDFLARE_MONTHLY_BUDGET_CENTS = 5000;

// why: sourcing, per cycle (newest first) —
//   2026-10-23 to 2026-11-22 — the "Metered usage has reached your configured
//             budget" email, usage observed Oct 23 – Nov 11 (20 of 31 days).
//             The paid lines sum to $10.26 (the email's "Current total"; its
//             spend summary rounds to $10.25). Projected cycle cost $15.90,
//             average $0.51 a day. Standard-class R2 stayed inside the free
//             tier: 28.18 GB-months storage (10 included, 19 billed), 17.27k
//             Class A ops (1M included), 84.03k Class B ops (10M included).
//             Infrequent Access operations have no free tier and bill by the
//             million rounded up, so 457 Class A ops cost a full $9.00 and one
//             Class B op a full $0.90.
export const CLOUDFLARE_BILLING_CYCLES: readonly CloudflareBillingCycle[] = [
  {
    cycle: 'Oct 23 – Nov 22, 2026',
    status: 'cycle-to-date',
    lines: [
      { product: 'R2 Infrequent Access – Class A Operations', usage: '457 ops', cents: 900 },
      { product: 'R2 Infrequent Access – Class B Operations', usage: '1 op', cents: 90 },
      { product: 'R2 Data Storage', usage: '19 GB-months billed', cents: 29 },
      { product: 'R2 Infrequent Access – Storage', usage: '6 GB-months', cents: 6 },
      { product: 'R2 Infrequent Access – Data Retrieval', usage: '1 GB', cents: 1 },
    ],
    projectedCycleCents: 1590,
    note: 'Usage observed Oct 23 – Nov 11 (20 of 31 days). Standard R2 operations stayed inside the free tier.',
  },
];

/**
 * Sum a billing cycle's product lines into its total, in cents.
 */
export function sumCloudflareCycleCents(billingCycle: CloudflareBillingCycle): number {
  let totalCents = 0;
  for (const line of billingCycle.lines) {
    totalCents += line.cents;
  }
  return totalCents;
}
