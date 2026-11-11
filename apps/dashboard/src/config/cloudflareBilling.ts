// why: manually-maintained Cloudflare billing snapshot, read from Cloudflare's
// metered-usage budget email and the account's billing page (no billing API is
// wired). Cloudflare bills R2 on a cycle that runs from the 23rd to the 22nd,
// not by calendar month. It feeds the Monetization page's Cloudflare panel,
// which labels it CACHED. Refresh workflow: when a cycle's invoice lands, mark
// that cycle `invoiced` with its final lines, add the new cycle-to-date row,
// and update CLOUDFLARE_BILLING_AS_OF.
//
// why: the Cloudflare account is shared with another business, and its bill is
// account-wide. Each cycle records the account total AND Legendary Arena's
// share; the panel headlines LA's share, because that is the cost on LA's
// books. Attribute per bucket with `wrangler r2 bucket info <name>` (size and
// default storage class) and `wrangler r2 bucket lifecycle list <name>`.

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
 * full cycle. `lines` and `projectedCycleCents` are account-wide;
 * `legendaryArenaCents` is the part of the account total LA caused.
 */
export interface CloudflareBillingCycle {
  readonly cycle: string;
  readonly status: 'invoiced' | 'cycle-to-date';
  readonly lines: readonly CloudflareBillLine[];
  readonly projectedCycleCents: number;
  readonly legendaryArenaCents: number;
  readonly attribution: string;
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
//             spend summary rounds to $10.25). Projected cycle cost $15.90.
//             Attribution, from `wrangler r2 bucket info` on 2026-11-11: LA's
//             buckets hold about 2.2 GB (legendary-images 1.63 GB, the DB
//             backups 0.56 GB, all Standard class, no IA lifecycle rules),
//             inside the account's 10 GB-month free tier, and LA's
//             operations are far under the 1M / 10M free tiers. Every billed
//             line comes from the other business's bucket: the only
//             Infrequent Access lifecycle rules on the account are its, and
//             its ~50 GB of Standard storage is what pushes the account past
//             the free tier. IA operations have no free tier and bill by the
//             million rounded up, so 457 Class A ops cost a full $9.00.
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
    legendaryArenaCents: 0,
    attribution:
      "Every billed line is another business's bucket on the shared account. Legendary Arena's R2 (about 2.2 GB, Standard class) stays inside the free tier.",
    note: 'Usage observed Oct 23 – Nov 11 (20 of 31 days).',
  },
];

/**
 * Sum a billing cycle's product lines into the account-wide total, in cents.
 */
export function sumCloudflareCycleCents(billingCycle: CloudflareBillingCycle): number {
  let totalCents = 0;
  for (const line of billingCycle.lines) {
    totalCents += line.cents;
  }
  return totalCents;
}
