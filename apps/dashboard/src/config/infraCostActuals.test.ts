import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  INFRA_COST_ACTUALS,
  INFRA_COST_ACTUALS_AS_OF,
  fetchInfraCostActuals,
} from './infraCostActuals.js';
import { INFRA_COST_BUDGETS } from './infraCostBudgets.js';
import { useInfraCostWatchdog } from '../composables/useInfraCostWatchdog.js';
import { INFRA_COST_VENDORS } from '../types/index.js';

test('INFRA_COST_ACTUALS carries exactly one figure for every canonical vendor', () => {
  assert.equal(INFRA_COST_ACTUALS.length, INFRA_COST_VENDORS.length);
  const vendorsWithActuals = INFRA_COST_ACTUALS.map((actual) => actual.vendor);
  for (const vendor of INFRA_COST_VENDORS) {
    assert.ok(
      vendorsWithActuals.includes(vendor),
      `vendor ${vendor} is missing an actual in INFRA_COST_ACTUALS`,
    );
  }
});

test('every actual is a non-negative integer cent amount', () => {
  for (const actual of INFRA_COST_ACTUALS) {
    assert.ok(
      Number.isInteger(actual.monthToDateCents),
      `${actual.vendor} monthToDateCents must be an integer`,
    );
    assert.ok(
      actual.monthToDateCents >= 0,
      `${actual.vendor} monthToDateCents must be non-negative`,
    );
  }
});

test('INFRA_COST_ACTUALS_AS_OF is a YYYY-MM-DD date string', () => {
  assert.match(INFRA_COST_ACTUALS_AS_OF, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(Date.parse(INFRA_COST_ACTUALS_AS_OF)));
});

test('fetchInfraCostActuals returns a CACHED snapshot with one dated entry per vendor', () => {
  const response = fetchInfraCostActuals();
  assert.equal(response.source, 'CACHED');
  assert.equal(response.updatedAt, Date.parse(INFRA_COST_ACTUALS_AS_OF));
  assert.equal(response.data.length, INFRA_COST_ACTUALS.length);
  for (const entry of response.data) {
    assert.equal(entry.date, INFRA_COST_ACTUALS_AS_OF);
    assert.equal(entry.currency, 'USD');
    const matchingActual = INFRA_COST_ACTUALS.find((actual) => actual.vendor === entry.vendor);
    assert.ok(matchingActual, `entry vendor ${entry.vendor} has no matching actual`);
    assert.equal(entry.amountCents, matchingActual.monthToDateCents);
  }
});

test('the snapshot feeds useInfraCostWatchdog to each vendor exact month-to-date', () => {
  const watchdog = useInfraCostWatchdog(() => fetchInfraCostActuals(), INFRA_COST_BUDGETS);
  const mtdByVendor = watchdog.mtdByVendor.value;
  for (const actual of INFRA_COST_ACTUALS) {
    assert.equal(
      mtdByVendor[actual.vendor],
      actual.monthToDateCents,
      `${actual.vendor} month-to-date should match its actual exactly`,
    );
  }
  // why: total MTD is the sum of the four real figures — the load-bearing
  // "are we within budget?" number the panel exists to answer.
  let expectedTotal = 0;
  for (const actual of INFRA_COST_ACTUALS) {
    expectedTotal += actual.monthToDateCents;
  }
  assert.equal(watchdog.totalMtdCents.value, expectedTotal);
});
