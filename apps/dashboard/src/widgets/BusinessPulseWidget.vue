<script setup lang="ts">
// why: WP-791 / D-24653 — the Overview's first row answers "is the business
// making or losing money?": revenue, royalties, costs, net, and cash runway.
// Revenue is the live KPI, infra cost is the cached vendor-bill snapshot, and
// cash / other costs / royalty rate are the operator's own entries, stored in
// this browser only (the repo is public, so they are never committed).

import { computed, ref } from 'vue';
import { useFetch } from '../composables/useFetch.js';
import {
  useOperatingInputs,
  type OperatingInputsFormValues,
} from '../composables/useOperatingInputs.js';
import { fetchKpiSnapshots } from '../services/endpoints.js';
import { INFRA_COST_ACTUALS, INFRA_COST_ACTUALS_AS_OF } from '../config/infraCostActuals.js';
import { computeBusinessPulse, type MoneyCard, type RunwayCard } from '../utils/overviewPulse.js';

const kpiFetch = useFetch(fetchKpiSnapshots);
const { inputs, save } = useOperatingInputs();

// why: /api/dash/kpis serves revenue_30d in dollars (a float); the money row
// works in integer cents (D-19601) so royalties and net never drift by a
// fraction of a cent. Null while the KPI fetch is loading or has failed, so the
// row shows "—" instead of a $0 that would read as "no revenue".
const revenue30dCents = computed<number | null>(() => {
  if (kpiFetch.error.value !== null || kpiFetch.data.value === null) {
    return null;
  }
  const revenueSnapshot = kpiFetch.data.value.find((snapshot) => snapshot.id === 'revenue_30d');
  if (revenueSnapshot === undefined) {
    return null;
  }
  return Math.round(revenueSnapshot.value * 100);
});

// why: the actuals are month-to-date figures. Their sum is a full month's
// infra cost only while INFRA_COST_ACTUALS_AS_OF is a month-end date (it is the
// last day of the billing period); a mid-month refresh would understate Costs.
let infraMonthlyCents = 0;
for (const actual of INFRA_COST_ACTUALS) {
  infraMonthlyCents += actual.monthToDateCents;
}

const pulse = computed(() =>
  computeBusinessPulse({
    revenue30dCents: revenue30dCents.value,
    infraMonthlyCents,
    inputs: inputs.value,
  }),
);

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formats integer cents as dollars with two decimals. */
function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** Card text for a money card: never a zero standing in for missing data. */
function describeMoneyCard(card: MoneyCard): string {
  if (card.state === 'unavailable') {
    return '—';
  }
  if (card.state === 'not-entered') {
    return 'Not entered';
  }
  return formatCents(card.valueCents);
}

/** Card text for the runway card. */
function describeRunwayCard(card: RunwayCard): string {
  if (card.state === 'unavailable') {
    return '—';
  }
  if (card.state === 'not-entered') {
    return 'Not entered';
  }
  if (card.state === 'profitable') {
    return 'Profitable';
  }
  return `${card.months.toFixed(1)} months`;
}

const revenueSourceTag = computed(() => kpiFetch.source.value ?? '');

const royaltiesNote = computed(() => {
  const basisPoints = inputs.value.royaltyRateBasisPoints;
  if (basisPoints === null) {
    return 'set a royalty rate';
  }
  return `at ${(basisPoints / 100).toFixed(2)}% of revenue`;
});

const costsNote = computed(() =>
  pulse.value.costs.isInfraOnly ? 'infra only' : 'infra + other fixed costs',
);

const savedLabel = computed(() => {
  if (inputs.value.updatedAt === '') {
    return 'No operating inputs saved in this browser yet.';
  }
  return `Operating inputs saved ${inputs.value.updatedAt.slice(0, 10)}, in this browser only.`;
});

// ---------------------------------------------------------------------------
// Edit form
// ---------------------------------------------------------------------------

const isEditing = ref(false);
const isSaveFailed = ref(false);
// why: `<input type="number">` v-model yields a number, or '' when blank.
const cashField = ref<string | number>('');
const otherCostsField = ref<string | number>('');
const royaltyRateField = ref<string | number>('');

/** Converts a stored integer (cents or basis points) to the form's units. */
function toFormField(storedHundredths: number | null): string {
  return storedHundredths === null ? '' : String(storedHundredths / 100);
}

/** Opens the form, prefilled with what is stored now. */
function startEditing(): void {
  cashField.value = toFormField(inputs.value.cashBalanceCents);
  otherCostsField.value = toFormField(inputs.value.otherFixedMonthlyCents);
  royaltyRateField.value = toFormField(inputs.value.royaltyRateBasisPoints);
  isEditing.value = true;
}

/** A form field as a number; blank → null; garbage → NaN (caught below). */
function parseFormField(raw: string | number): number | null {
  if (typeof raw === 'number') {
    return raw;
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  return Number(trimmed);
}

const formValues = computed<OperatingInputsFormValues>(() => ({
  cashBalanceDollars: parseFormField(cashField.value),
  otherFixedMonthlyDollars: parseFormField(otherCostsField.value),
  royaltyRatePercent: parseFormField(royaltyRateField.value),
}));

/** True for a blank field or a finite number ≥ 0. */
function isNonNegativeOrBlank(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

const formProblem = computed(() => {
  const values = formValues.value;
  if (
    !isNonNegativeOrBlank(values.cashBalanceDollars) ||
    !isNonNegativeOrBlank(values.otherFixedMonthlyDollars)
  ) {
    return 'Amounts must be numbers of 0 or more (or left blank).';
  }
  const rate = values.royaltyRatePercent;
  if (!isNonNegativeOrBlank(rate) || (rate !== null && rate > 100)) {
    return 'The royalty rate must be between 0 and 100 (or left blank).';
  }
  return '';
});

/** Saves the whole form; keeps the form open with a warning if storage fails. */
function handleSave(): void {
  if (formProblem.value !== '') {
    return;
  }
  const isSaved = save(formValues.value);
  isSaveFailed.value = !isSaved;
  if (isSaved) {
    isEditing.value = false;
  }
}
</script>

<template>
  <section class="widget business-pulse" aria-label="Business pulse">
    <header class="widget-header">
      <h3>Business pulse</h3>
      <button v-if="!isEditing" type="button" class="edit-button" @click="startEditing">
        Edit operating inputs
      </button>
    </header>

    <div class="card-row">
      <article class="pulse-card" aria-label="Revenue (30d)">
        <span class="card-label">Revenue (30d)</span>
        <span v-if="revenueSourceTag" class="card-source">{{ revenueSourceTag }}</span>
        <span class="card-value">{{ describeMoneyCard(pulse.revenue) }}</span>
        <span class="card-note">from the revenue KPI</span>
      </article>

      <article class="pulse-card" aria-label="Royalties (30d)">
        <span class="card-label">Royalties (30d)</span>
        <span class="card-source">LOCAL</span>
        <span class="card-value">{{ describeMoneyCard(pulse.royalties) }}</span>
        <span class="card-note">{{ royaltiesNote }}</span>
      </article>

      <article class="pulse-card" aria-label="Costs (monthly)">
        <span class="card-label">Costs (monthly)</span>
        <span class="card-source">CACHED · as of {{ INFRA_COST_ACTUALS_AS_OF }}</span>
        <span class="card-value">{{ describeMoneyCard(pulse.costs) }}</span>
        <span class="card-note">{{ costsNote }}</span>
      </article>

      <article class="pulse-card" aria-label="Net (monthly)">
        <span class="card-label">Net (monthly)</span>
        <span class="card-source">LOCAL</span>
        <span class="card-value">{{ describeMoneyCard(pulse.net) }}</span>
        <span class="card-note">revenue − royalties − costs</span>
      </article>

      <article class="pulse-card" aria-label="Cash runway">
        <span class="card-label">Cash runway</span>
        <span class="card-source">LOCAL</span>
        <span class="card-value">{{ describeRunwayCard(pulse.runway) }}</span>
        <span class="card-note">cash ÷ monthly net burn</span>
      </article>
    </div>

    <form v-if="isEditing" class="inputs-form" @submit.prevent="handleSave">
      <label class="form-field">
        <span>Cash balance ($)</span>
        <input v-model="cashField" type="number" min="0" step="0.01" inputmode="decimal" />
      </label>
      <label class="form-field">
        <span>Other fixed monthly costs ($)</span>
        <input v-model="otherCostsField" type="number" min="0" step="0.01" inputmode="decimal" />
      </label>
      <label class="form-field">
        <span>Royalty rate (%)</span>
        <input
          v-model="royaltyRateField"
          type="number"
          min="0"
          max="100"
          step="0.01"
          inputmode="decimal"
        />
      </label>
      <div class="form-actions">
        <button type="submit" class="save-button" :disabled="formProblem !== ''">Save</button>
        <button type="button" class="cancel-button" @click="isEditing = false">Cancel</button>
      </div>
      <p v-if="formProblem" class="form-problem" role="alert">{{ formProblem }}</p>
      <p class="form-hint">
        Stored in this browser only — never sent to the server or committed. Leave a field blank for
        "Not entered". Other fixed costs are costs beyond infra (subscriptions, domains, …).
      </p>
    </form>

    <p v-if="isSaveFailed" class="save-failed" role="alert">
      Not saved — browser storage unavailable
    </p>
    <p class="saved-label">{{ savedLabel }}</p>
  </section>
</template>

<style scoped>
.widget {
  background: var(--p-surface-card, var(--p-content-background));
  border: 1px solid var(--p-surface-border, var(--p-content-border-color));
  border-radius: 8px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.widget-header h3 {
  margin: 0;
  font-size: 0.9rem;
  color: var(--p-text-color);
}

.edit-button,
.save-button,
.cancel-button {
  font-size: 0.78rem;
  padding: 0.3rem 0.7rem;
  border-radius: 4px;
  border: 1px solid var(--p-content-border-color);
  background: transparent;
  color: var(--p-text-color);
  cursor: pointer;
}

.save-button {
  background: var(--p-primary-color);
  border-color: var(--p-primary-color);
  color: var(--p-primary-contrast-color, #ffffff);
  font-weight: 600;
}

.save-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

@media (max-width: 1199px) {
  .card-row {
    grid-template-columns: 1fr;
  }
}

.pulse-card {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.6rem 0.9rem;
  background: var(--p-content-background, var(--p-surface-card));
  border: 1px solid var(--p-content-border-color, var(--p-surface-border));
  border-radius: 6px;
}

.card-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--p-text-muted-color);
}

.card-source {
  align-self: flex-start;
  font-size: 0.6rem;
  font-weight: 600;
  background: var(--p-surface-border, var(--p-content-border-color));
  color: var(--p-text-color);
  padding: 0.05rem 0.3rem;
  border-radius: 3px;
}

.card-value {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--p-text-color);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.card-note {
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

.inputs-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px dashed var(--p-content-border-color);
  border-radius: 6px;
}

@media (max-width: 899px) {
  .inputs-form {
    grid-template-columns: 1fr;
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.form-field input {
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  background: var(--p-content-background);
  color: var(--p-text-color);
  font-size: 0.9rem;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.5rem;
}

.form-problem,
.save-failed {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--p-red-500, var(--p-text-color));
}

.form-hint {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.72rem;
  color: var(--p-text-muted-color);
}

.saved-label {
  margin: 0;
  font-size: 0.72rem;
  font-style: italic;
  color: var(--p-text-muted-color);
}
</style>
