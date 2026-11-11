import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOUDFLARE_BILLING_CYCLES,
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

test('a cycle-to-date projection is never below what has already been billed', () => {
  for (const billingCycle of CLOUDFLARE_BILLING_CYCLES) {
    assert.ok(
      billingCycle.projectedCycleCents >= sumCloudflareCycleCents(billingCycle),
      `${billingCycle.cycle} projects ${billingCycle.projectedCycleCents} cents, below its billed total.`,
    );
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
