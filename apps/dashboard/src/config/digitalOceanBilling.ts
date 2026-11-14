// why: manually-maintained DigitalOcean billing snapshot, read from the
// DigitalOcean invoices in C:\pcloud\legendary-arena\ops\accounting\expenses2026
// and the account's billing page (no billing API is wired). DigitalOcean hosts
// the game server and its PostgreSQL on one droplet since the 2026-10-12
// cutover off Render. It feeds the Monetization page's DigitalOcean panel,
// which labels it CACHED. Refresh workflow: after each month's invoice (issued
// on the 1st), add that month as `invoiced`, replace the month-to-date row from
// the billing page, and update DIGITALOCEAN_BILLING_AS_OF.

/**
 * One product line on a DigitalOcean bill, in integer cents (D-19601
 * integer-cents discipline).
 */
export interface DigitalOceanBillLine {
  readonly product: string;
  readonly cents: number;
}

/**
 * One DigitalOcean billing month. `invoiced` months are final; a
 * `month-to-date` month is the billing page's running summary.
 */
export interface DigitalOceanBillingMonth {
  readonly month: string;
  readonly status: 'invoiced' | 'month-to-date';
  readonly lines: readonly DigitalOceanBillLine[];
  // why: account credits DigitalOcean applied to the month, as a positive
  // number of cents subtracted from usage to give the amount charged.
  readonly creditCents: number;
  readonly note: string;
}

// why: the date of the newest figure below (the billing page's November
// month-to-date summary, "November 1 - 04, 2026").
export const DIGITALOCEAN_BILLING_AS_OF = '2026-11-04';

export const DIGITALOCEAN_BILLING_URL = 'https://cloud.digitalocean.com/account/billing?i=bbafd2';

// why: matches the DigitalOcean line of `ledger.budget.byVendor` in
// dashboard.json ($35 a month).
export const DIGITALOCEAN_MONTHLY_BUDGET_CENTS = 3500;

// why: the s-2vcpu-4gb droplet lists at $24 a month and DigitalOcean caps
// hourly billing at 672 hours, so a full month of the droplet costs at most
// $24.00 before backups.
export const DIGITALOCEAN_DROPLET_MONTHLY_CAP_CENTS = 2400;

// why: sourcing, per month (newest first) —
//   2026-11 — billing page month-to-date summary, Nov 1–4: Droplets $2.57,
//             Droplet Backups $0.13. Payment due 2026-12-01.
//   2026-10 — invoice 560663798 (final, issued 2026-11-01, paid 2026-11-01):
//             Droplets $17.37 (la-rehearsal-01 s-2vcpu-4gb, 479 h from the
//             10-12 cutover, $17.11 + $0.01; la-drill-01, 7 h on 10-22, $0.25)
//             and Droplet Backups $0.28; usage $17.65 less a $5.00 credit,
//             $12.65 charged.
export const DIGITALOCEAN_BILLING_MONTHS: readonly DigitalOceanBillingMonth[] = [
  {
    month: 'November 2026',
    status: 'month-to-date',
    lines: [
      { product: 'Droplets', cents: 257 },
      { product: 'Droplet Backups', cents: 13 },
    ],
    creditCents: 0,
    note: 'Month to date, Nov 1–4. Payment due Dec 1.',
  },
  {
    month: 'October 2026',
    status: 'invoiced',
    lines: [
      { product: 'Droplets', cents: 1737 },
      { product: 'Droplet Backups', cents: 28 },
    ],
    creditCents: 500,
    note: 'Partial month from the Oct 12 cutover; includes a 7-hour drill droplet ($0.25). Paid Nov 1.',
  },
];

/**
 * Sum a billing month's product lines into its total usage, in cents.
 */
export function sumDigitalOceanUsageCents(billingMonth: DigitalOceanBillingMonth): number {
  let totalCents = 0;
  for (const line of billingMonth.lines) {
    totalCents += line.cents;
  }
  return totalCents;
}

/**
 * The amount charged for a billing month: usage less applied credits, never
 * below zero.
 */
export function digitalOceanChargedCents(billingMonth: DigitalOceanBillingMonth): number {
  return Math.max(0, sumDigitalOceanUsageCents(billingMonth) - billingMonth.creditCents);
}
