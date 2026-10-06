/**
 * useOperatingInputs tests (WP-791 / EC-828) against a stubbed localStorage:
 * round-trip, every invalid read collapsing to all-null, replace-on-save,
 * blanks saved as null, and a throwing setItem reported as `false`.
 *
 * Money figures here are synthetic test values, not operator data.
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPERATING_INPUTS_STORAGE_KEY,
  readOperatingInputs,
  useOperatingInputs,
} from './useOperatingInputs.js';

/** Minimal in-memory localStorage; the node:test runtime has no DOM. */
class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

/** A storage whose every access throws, like a disabled or blocked store. */
class ThrowingStorage extends MemoryStorage {
  override getItem(): string | null {
    throw new Error('storage disabled');
  }

  override setItem(): void {
    throw new Error('quota exceeded');
  }
}

const FIXED_NOW = new Date('2026-10-02T12:00:00.000Z');
const EMPTY = {
  version: 1,
  cashBalanceCents: null,
  otherFixedMonthlyCents: null,
  royaltyRateBasisPoints: null,
  updatedAt: '',
};

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage() as unknown as Storage;
});

/** Stores a raw string under the operating-inputs key. */
function storeRaw(raw: string): void {
  localStorage.setItem(OPERATING_INPUTS_STORAGE_KEY, raw);
}

/** Stores a record with valid defaults, overridden per test. */
function storeRecord(overrides: Record<string, unknown>): void {
  storeRaw(
    JSON.stringify({
      version: 1,
      cashBalanceCents: 1_000,
      otherFixedMonthlyCents: 200,
      royaltyRateBasisPoints: 500,
      updatedAt: '2026-10-01T00:00:00.000Z',
      ...overrides,
    }),
  );
}

test('a saved record round-trips through storage in cents and basis points', () => {
  const { inputs, save } = useOperatingInputs({ now: () => FIXED_NOW });
  assert.deepEqual(inputs.value, EMPTY);

  const isSaved = save({
    cashBalanceDollars: 1000,
    otherFixedMonthlyDollars: 50,
    royaltyRatePercent: 10,
  });
  assert.equal(isSaved, true);

  const expected = {
    version: 1,
    cashBalanceCents: 100_000,
    otherFixedMonthlyCents: 5_000,
    royaltyRateBasisPoints: 1_000,
    updatedAt: FIXED_NOW.toISOString(),
  };
  assert.deepEqual(inputs.value, expected);
  assert.deepEqual(readOperatingInputs(), expected);
  assert.deepEqual(useOperatingInputs().inputs.value, expected);
});

test('fractional dollars and percents round to whole cents and basis points', () => {
  const { inputs, save } = useOperatingInputs({ now: () => FIXED_NOW });
  // 12.34 × 100 and 0.1 × 100 are not exact in floating point; rounding fixes both.
  save({ cashBalanceDollars: 12.34, otherFixedMonthlyDollars: 0.1, royaltyRatePercent: 7.25 });
  assert.equal(inputs.value.cashBalanceCents, 1234);
  assert.equal(inputs.value.otherFixedMonthlyCents, 10);
  assert.equal(inputs.value.royaltyRateBasisPoints, 725);
});

test('a missing key reads as all-null', () => {
  assert.deepEqual(readOperatingInputs(), EMPTY);
});

test('unparseable JSON and non-object payloads read as all-null', () => {
  for (const raw of ['{not json', '42', '"text"', '[1,2]', 'null']) {
    storeRaw(raw);
    assert.deepEqual(readOperatingInputs(), EMPTY, `raw ${raw}`);
  }
});

test('a wrong version reads as all-null', () => {
  storeRecord({ version: 2 });
  assert.deepEqual(readOperatingInputs(), EMPTY);
});

test('negative, non-integer, non-numeric, or missing fields read as all-null', () => {
  const invalidRecords: Record<string, unknown>[] = [
    { cashBalanceCents: -1 },
    { otherFixedMonthlyCents: 10.5 },
    { royaltyRateBasisPoints: -5 },
    { cashBalanceCents: '100' },
    { otherFixedMonthlyCents: undefined },
    { updatedAt: 7 },
  ];
  for (const overrides of invalidRecords) {
    storeRecord(overrides);
    assert.deepEqual(readOperatingInputs(), EMPTY, JSON.stringify(overrides));
  }
});

test('a royalty rate above 10000 basis points reads as all-null; 10000 is valid', () => {
  storeRecord({ royaltyRateBasisPoints: 10_001 });
  assert.deepEqual(readOperatingInputs(), EMPTY);

  storeRecord({ royaltyRateBasisPoints: 10_000 });
  assert.equal(readOperatingInputs().royaltyRateBasisPoints, 10_000);
});

test('a valid record with null fields keeps them null', () => {
  storeRecord({ cashBalanceCents: null, royaltyRateBasisPoints: null });
  const inputs = readOperatingInputs();
  assert.equal(inputs.cashBalanceCents, null);
  assert.equal(inputs.otherFixedMonthlyCents, 200);
  assert.equal(inputs.royaltyRateBasisPoints, null);
});

test('a throwing localStorage reads as all-null without throwing', () => {
  globalThis.localStorage = new ThrowingStorage() as unknown as Storage;
  assert.deepEqual(readOperatingInputs(), EMPTY);
  assert.deepEqual(useOperatingInputs().inputs.value, EMPTY);
});

test('save replaces the whole record and saves blank fields as null', () => {
  storeRecord({});
  const { inputs, save } = useOperatingInputs({ now: () => FIXED_NOW });
  assert.equal(inputs.value.cashBalanceCents, 1_000);

  save({ cashBalanceDollars: null, otherFixedMonthlyDollars: 3, royaltyRatePercent: null });
  const expected = {
    version: 1,
    cashBalanceCents: null,
    otherFixedMonthlyCents: 300,
    royaltyRateBasisPoints: null,
    updatedAt: FIXED_NOW.toISOString(),
  };
  assert.deepEqual(inputs.value, expected);
  assert.deepEqual(readOperatingInputs(), expected);
});

test('save stores out-of-range form values as null, never as invalid data', () => {
  const { inputs, save } = useOperatingInputs({ now: () => FIXED_NOW });
  save({ cashBalanceDollars: -5, otherFixedMonthlyDollars: Number.NaN, royaltyRatePercent: 101 });
  assert.equal(inputs.value.cashBalanceCents, null);
  assert.equal(inputs.value.otherFixedMonthlyCents, null);
  assert.equal(inputs.value.royaltyRateBasisPoints, null);
});

test('save returns false when setItem throws, and keeps the values for this session', () => {
  globalThis.localStorage = new ThrowingStorage() as unknown as Storage;
  const { inputs, save } = useOperatingInputs({ now: () => FIXED_NOW });
  const isSaved = save({
    cashBalanceDollars: 10,
    otherFixedMonthlyDollars: null,
    royaltyRatePercent: 5,
  });
  assert.equal(isSaved, false);
  assert.equal(inputs.value.cashBalanceCents, 1_000);
  assert.equal(inputs.value.royaltyRateBasisPoints, 500);
});
