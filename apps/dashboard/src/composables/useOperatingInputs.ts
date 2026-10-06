import { ref, type Ref } from 'vue';
import type { OperatingInputs } from '../utils/overviewPulse.js';

// why: D-24653 — the repository is public, so the operator's cash balance,
// fixed costs, and royalty rate can never be committed as config (the way infra
// vendor spend is). They live only in this browser's localStorage under one key;
// no default, sample, or placeholder value for them exists in source.
export const OPERATING_INPUTS_STORAGE_KEY = 'la-dashboard-operating-inputs';

const MAX_ROYALTY_BASIS_POINTS = 10000;

/**
 * The edit form's values, in the units the operator types: dollars and a
 * percent. `null` is a blank field ("not entered").
 */
export interface OperatingInputsFormValues {
  readonly cashBalanceDollars: number | null;
  readonly otherFixedMonthlyDollars: number | null;
  readonly royaltyRatePercent: number | null;
}

interface UseOperatingInputsOptions {
  now?: () => Date;
}

interface UseOperatingInputsReturn {
  inputs: Ref<OperatingInputs>;
  save: (formValues: OperatingInputsFormValues) => boolean;
}

/** The "nothing entered" record: every field null. */
function emptyOperatingInputs(): OperatingInputs {
  return {
    version: 1,
    cashBalanceCents: null,
    otherFixedMonthlyCents: null,
    royaltyRateBasisPoints: null,
    updatedAt: '',
  };
}

/** True for `null` or a non-negative integer no larger than `maximum`. */
function isValidStoredField(value: unknown, maximum: number): boolean {
  if (value === null) {
    return true;
  }
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= maximum;
}

/**
 * Validates a parsed payload. Any wrong version, missing field, or out-of-range
 * value rejects the whole record — a half-valid record would show figures the
 * operator never entered together.
 */
function parseStoredRecord(parsed: unknown): OperatingInputs | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const candidate = parsed as Record<string, unknown>;
  const isValid =
    candidate.version === 1 &&
    isValidStoredField(candidate.cashBalanceCents, Number.MAX_SAFE_INTEGER) &&
    isValidStoredField(candidate.otherFixedMonthlyCents, Number.MAX_SAFE_INTEGER) &&
    isValidStoredField(candidate.royaltyRateBasisPoints, MAX_ROYALTY_BASIS_POINTS) &&
    typeof candidate.updatedAt === 'string';
  if (!isValid) {
    return null;
  }
  return {
    version: 1,
    cashBalanceCents: candidate.cashBalanceCents as number | null,
    otherFixedMonthlyCents: candidate.otherFixedMonthlyCents as number | null,
    royaltyRateBasisPoints: candidate.royaltyRateBasisPoints as number | null,
    updatedAt: candidate.updatedAt as string,
  };
}

/**
 * Reads the stored record. A missing key, unparseable JSON, an invalid record,
 * or a throwing / absent localStorage all read as the empty record; this never
 * throws.
 */
export function readOperatingInputs(): OperatingInputs {
  let raw: string | null;
  try {
    raw = localStorage.getItem(OPERATING_INPUTS_STORAGE_KEY);
  } catch {
    // why: storage can be disabled (privacy mode, blocked site data) or absent;
    // the money row must still render, with every input "Not entered".
    return emptyOperatingInputs();
  }
  if (raw === null) {
    return emptyOperatingInputs();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    // why: a corrupt stored value is treated as nothing entered rather than
    // crashing the Overview; the next save overwrites it.
    return emptyOperatingInputs();
  }
  return parseStoredRecord(parsed) ?? emptyOperatingInputs();
}

/** Dollars → integer cents; blank, negative, or non-finite → `null`. */
function dollarsToCents(dollars: number | null): number | null {
  if (dollars === null || !Number.isFinite(dollars) || dollars < 0) {
    return null;
  }
  return Math.round(dollars * 100);
}

/** Percent → integer basis points; blank or outside 0..100 → `null`. */
function percentToBasisPoints(percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent) || percent < 0) {
    return null;
  }
  const basisPoints = Math.round(percent * 100);
  if (basisPoints > MAX_ROYALTY_BASIS_POINTS) {
    return null;
  }
  return basisPoints;
}

/**
 * The operator's operating inputs, read once from localStorage and replaced on
 * every `save`.
 *
 * @param options.now Injectable clock for `updatedAt`; production omits it.
 */
export function useOperatingInputs(options?: UseOperatingInputsOptions): UseOperatingInputsReturn {
  const now = options?.now ?? (() => new Date());
  const inputs = ref<OperatingInputs>(readOperatingInputs());

  /**
   * Writes the whole record from the form — never merged with the previous
   * record, so a cleared field really clears. Returns `false` when the write
   * fails, so the caller can tell the operator the entry will not survive a
   * reload. The in-memory value updates either way, for this session.
   */
  function save(formValues: OperatingInputsFormValues): boolean {
    const record: OperatingInputs = {
      version: 1,
      cashBalanceCents: dollarsToCents(formValues.cashBalanceDollars),
      otherFixedMonthlyCents: dollarsToCents(formValues.otherFixedMonthlyDollars),
      royaltyRateBasisPoints: percentToBasisPoints(formValues.royaltyRatePercent),
      updatedAt: now().toISOString(),
    };
    inputs.value = record;
    try {
      localStorage.setItem(OPERATING_INPUTS_STORAGE_KEY, JSON.stringify(record));
      return true;
    } catch {
      // why: quota exceeded, storage disabled, or no storage at all — the
      // failure is reported through the return value (the widget shows "Not
      // saved — browser storage unavailable"), not thrown.
      return false;
    }
  }

  return { inputs, save };
}
