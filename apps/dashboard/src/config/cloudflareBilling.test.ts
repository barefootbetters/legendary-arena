import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUDFLARE_BILLING_CYCLES,
  CLOUDFLARE_REFRESH_STEPS,
  sumCloudflareCycleCents,
  type CloudflareBillingCycle,
} from './cloudflareBilling.js';

/**
 * Find a billing cycle by its label, failing loudly when it is missing.
 */
function findCycle(cycle: string): CloudflareBillingCycle {
  const found = CLOUDFLARE_BILLING_CYCLES.find((billingCycle) => billingCycle.cycle === cycle);
  assert.ok(found, `Expected "${cycle}" in CLOUDFLARE_BILLING_CYCLES.`);
  return found;
}

test('Oct 23 – Nov 22, 2026 cycle to date matches the budget email: $10.26, projected $15.90', () => {
  const cycle = findCycle('Oct 23 – Nov 22, 2026');
  assert.equal(cycle.status, 'cycle-to-date');
  assert.equal(sumCloudflareCycleCents(cycle), 1026);
  assert.equal(cycle.projectedCycleCents, 1590);
});

test("Legendary Arena's share of the Oct 23 – Nov 22, 2026 cycle is $0", () => {
  const cycle = findCycle('Oct 23 – Nov 22, 2026');
  assert.equal(cycle.legendaryArenaCents, 0);
});

test("Legendary Arena's share never exceeds the account-wide total", () => {
  for (const billingCycle of CLOUDFLARE_BILLING_CYCLES) {
    assert.ok(
      Number.isInteger(billingCycle.legendaryArenaCents) &&
        billingCycle.legendaryArenaCents >= 0 &&
        billingCycle.legendaryArenaCents <= sumCloudflareCycleCents(billingCycle),
      `${billingCycle.cycle} LA share ${billingCycle.legendaryArenaCents} must be whole cents between 0 and the account total.`,
    );
  }
});

test('a cycle-to-date projection is never below what has already been billed', () => {
  for (const billingCycle of CLOUDFLARE_BILLING_CYCLES) {
    assert.ok(
      billingCycle.projectedCycleCents >= sumCloudflareCycleCents(billingCycle),
      `${billingCycle.cycle} projects ${billingCycle.projectedCycleCents} cents, below its billed total.`,
    );
  }
});

test('the refresh steps name the files the update touches and every Legendary Arena bucket', () => {
  const allText = CLOUDFLARE_REFRESH_STEPS.map((step) => `${step.text} ${step.command ?? ''}`).join(
    ' ',
  );
  for (const expected of [
    'apps/dashboard/src/config/cloudflareBilling.ts',
    'apps/dashboard/src/config/cloudflareBilling.test.ts',
    'legendary-images',
    'legendary-arena-db-backups',
    'legendary-arena-db-backups-rehearsal',
  ]) {
    assert.ok(allText.includes(expected), `CLOUDFLARE_REFRESH_STEPS should mention "${expected}".`);
  }
});

test('every line is a whole, non-negative number of cents', () => {
  for (const billingCycle of CLOUDFLARE_BILLING_CYCLES) {
    for (const line of billingCycle.lines) {
      assert.ok(
        Number.isInteger(line.cents) && line.cents >= 0,
        `${billingCycle.cycle} ${line.product} must be whole non-negative cents, got ${line.cents}.`,
      );
    }
  }
});
