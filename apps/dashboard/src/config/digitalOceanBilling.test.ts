import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGITALOCEAN_BILLING_MONTHS,
  digitalOceanChargedCents,
  sumDigitalOceanUsageCents,
  type DigitalOceanBillingMonth,
} from './digitalOceanBilling.js';

/**
 * Find a billing month by its label, failing loudly when it is missing.
 */
function findMonth(month: string): DigitalOceanBillingMonth {
  const found = DIGITALOCEAN_BILLING_MONTHS.find((billingMonth) => billingMonth.month === month);
  assert.ok(found, `Expected "${month}" in DIGITALOCEAN_BILLING_MONTHS.`);
  return found;
}

test('October 2026 matches invoice 560663798: $17.65 usage, $12.65 charged', () => {
  const october = findMonth('October 2026');
  assert.equal(october.status, 'invoiced');
  assert.equal(sumDigitalOceanUsageCents(october), 1765);
  assert.equal(digitalOceanChargedCents(october), 1265);
});

test('November 2026 month to date matches the billing page: $2.70', () => {
  const november = findMonth('November 2026');
  assert.equal(november.status, 'month-to-date');
  assert.equal(sumDigitalOceanUsageCents(november), 270);
  assert.equal(digitalOceanChargedCents(november), 270);
});

test('a credit larger than usage charges zero, not a negative amount', () => {
  const month: DigitalOceanBillingMonth = {
    month: 'test',
    status: 'invoiced',
    lines: [{ product: 'Droplets', cents: 300 }],
    creditCents: 500,
    note: 'test month',
  };
  assert.equal(digitalOceanChargedCents(month), 0);
});

test('every line is a whole, non-negative number of cents', () => {
  for (const billingMonth of DIGITALOCEAN_BILLING_MONTHS) {
    for (const line of billingMonth.lines) {
      assert.ok(
        Number.isInteger(line.cents) && line.cents >= 0,
        `${billingMonth.month} ${line.product} must be whole non-negative cents, got ${line.cents}.`,
      );
    }
  }
});
