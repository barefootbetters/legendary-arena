<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  useEffectIndex,
  filterEntries,
  scopeLabel,
  statusLabel,
  type ScopeFilter,
  type StatusFilter,
} from '../../composables/useEffectIndex.js';
import type { EffectDesign, EffectIndexStatus } from '@legendary-arena/registry/schema';

const { summary, entries, error } = useEffectIndex();

const DISPLAY_CAP = 200;

// The five ledger statuses in fixed order (drives the summary chips + the filter row).
const STATUS_ORDER: readonly EffectIndexStatus[] = [
  'executable',
  'deferred',
  'condition',
  'unsupported',
  'unmarked',
];

const SCOPE_FILTERS: readonly ScopeFilter[] = ['all', 'hero', 'villain', 'mastermind'];
const STATUS_FILTERS: readonly StatusFilter[] = ['all', ...STATUS_ORDER];

const search = ref('');
const scopeFilter = ref<ScopeFilter>('all');
const statusFilter = ref<StatusFilter>('all');
const handlerOnly = ref(false);

const filteredEntries = computed(() =>
  filterEntries(entries.value, {
    search: search.value,
    scope: scopeFilter.value,
    status: statusFilter.value,
    handlerOnly: handlerOnly.value,
  }),
);

const displayedEntries = computed(() => filteredEntries.value.slice(0, DISPLAY_CAP));

/** Maps a status to its CSS modifier class for the colored badges. */
function statusClass(status: EffectIndexStatus): string {
  return `fx-${status}`;
}

/**
 * The Design column label (WP-491): the hero card design name(s) that print this
 * mechanic, comma-joined, or an em dash for a villain / unmarked-hero entry (which
 * omit `designs` — a villain's extId already names the card).
 */
function designLabel(designs: readonly EffectDesign[] | undefined): string {
  if (!designs || designs.length === 0) {
    return '—';
  }
  return designs.map((design) => design.name).join(', ');
}
</script>

<template>
  <div class="effects-page">
    <header class="page-header">
      <h1>Debug Effects</h1>
      <p class="subtitle">
        Every card × mechanic across hero, villain, and mastermind scopes — the "which handler runs
        this card's effect, and under which decision?" index. Source:
        <code>data/metadata/effect-implementation-index.json</code> (a verbatim join of the hero +
        villain mechanic ledgers and the mastermind-tactic feed by <code>pnpm effect-index</code>;
        CI-gated). Read-only.
      </p>
    </header>

    <p v-if="error" class="fx-error">Effect Implementation Index failed to load: {{ error }}</p>

    <section class="summary">
      <div class="headline">
        <span class="headline-num">{{ summary.totalEntries }}</span>
        <span class="headline-label">card × mechanic rows</span>
        <span class="headline-sub"
          >{{ summary.byScope.hero }} hero · {{ summary.byScope.villain }} villain ·
          {{ summary.byScope.mastermind }} mastermind</span
        >
      </div>
      <div class="summary-chips">
        <div
          v-for="status in STATUS_ORDER"
          :key="status"
          class="count-chip"
          :class="statusClass(status)"
        >
          <span class="count-num">{{ summary.byStatus[status] }}</span
          ><span>{{ statusLabel(status) }}</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>Effect implementation index</h2>
      <div class="controls">
        <div class="filter-group">
          <span class="filter-label">Scope</span>
          <div class="filter-buttons">
            <button
              v-for="filter in SCOPE_FILTERS"
              :key="filter"
              type="button"
              :class="{ active: scopeFilter === filter }"
              @click="scopeFilter = filter"
            >
              {{ filter === 'all' ? 'All' : scopeLabel(filter) }}
            </button>
          </div>
        </div>
        <div class="filter-group">
          <span class="filter-label">Status</span>
          <div class="filter-buttons">
            <button
              v-for="filter in STATUS_FILTERS"
              :key="filter"
              type="button"
              :class="{ active: statusFilter === filter }"
              @click="statusFilter = filter"
            >
              {{ filter === 'all' ? 'All' : statusLabel(filter) }}
            </button>
          </div>
        </div>
        <button
          type="button"
          class="handler-toggle"
          :class="{ active: handlerOnly }"
          @click="handlerOnly = !handlerOnly"
        >
          {{ handlerOnly ? '✓ ' : '' }}Has handler only
        </button>
        <input
          v-model="search"
          type="search"
          placeholder="Search card or ext_id…"
          class="search-input"
        />
      </div>
      <p class="block-note">
        Showing {{ displayedEntries.length }} of {{ filteredEntries.length }} matching rows.
        <span v-if="filteredEntries.length > displayedEntries.length"
          >Refine the search to narrow.</span
        >
        A blank handler / WP / decision (<span class="mono">—</span>) is a real "no handler ran"
        signal from an unsupported or unmarked row — never fabricated.
      </p>
      <table class="fx-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Design</th>
            <th>Set</th>
            <th>Scope</th>
            <th>Mechanic</th>
            <th>Status</th>
            <th>Handler</th>
            <th>WP</th>
            <th>Decision</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in displayedEntries" :key="`${entry.extId}-${entry.mechanic}`">
            <td>
              <span class="card-name">{{ entry.name }}</span>
              <span class="mono dim ext">{{ entry.extId }}</span>
            </td>
            <!-- why: WP-491 — the hero card design(s) printing this mechanic; "—" for
                 a villain / unmarked entry (no per-design attribution). -->
            <td>{{ designLabel(entry.designs) }}</td>
            <td class="mono dim">{{ entry.set }}</td>
            <td>
              <span class="badge" :class="`fx-scope-${entry.scope}`">{{
                scopeLabel(entry.scope)
              }}</span>
            </td>
            <td class="mono">{{ entry.mechanic }}</td>
            <td>
              <span class="badge" :class="statusClass(entry.status)">{{
                statusLabel(entry.status)
              }}</span>
            </td>
            <td class="mono dim handler">{{ entry.handler || '—' }}</td>
            <td class="mono dim">{{ entry.wp || '—' }}</td>
            <td class="mono dim">{{ entry.decision || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.effects-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.page-header h1 {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  color: var(--p-text-color);
}

.subtitle {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.subtitle code,
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
}

.fx-error {
  color: var(--p-red-500, #ef4444);
  font-size: 0.9rem;
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1.5rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 1rem 1.25rem;
}

.headline {
  display: flex;
  flex-direction: column;
}

.headline-num {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-text-color);
  line-height: 1;
}

.headline-label {
  font-size: 0.85rem;
  color: var(--p-text-color);
}

.headline-sub {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.summary-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.count-chip {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--p-content-border-color);
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.count-num {
  font-size: 1.1rem;
  font-weight: 700;
  color: currentColor;
}

.block {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 1rem 1.25rem;
}

.block h2 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: var(--p-text-color);
}

.block-note {
  margin: 0.5rem 0 0.75rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
  margin-bottom: 0.5rem;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.filter-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--p-text-muted-color);
}

.filter-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-buttons button,
.handler-toggle {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  background: transparent;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--p-text-muted-color);
}

.filter-buttons button.active,
.handler-toggle.active {
  background: var(--p-primary-color);
  color: var(--p-primary-contrast-color);
  border-color: var(--p-primary-color);
}

.search-input {
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  background: var(--p-content-background);
  color: var(--p-text-color);
  font-size: 0.8rem;
  min-width: 14rem;
  flex: 1;
}

.fx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.fx-table th {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.fx-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
  vertical-align: top;
}

.dim {
  color: var(--p-text-muted-color);
}

.handler {
  word-break: break-all;
}

.card-name {
  display: block;
}

.ext {
  display: block;
}

.badge {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  border: 1px solid currentColor;
  white-space: nowrap;
}

/* why: status colors use PrimeVue Aura palette tokens with hex fallbacks so the
   badges stay legible in light + dark themes (the /coverage precedent). */
.fx-executable {
  color: var(--p-green-500, #22c55e);
}
.fx-unsupported {
  color: var(--p-red-500, #ef4444);
}
.fx-unmarked {
  color: var(--p-amber-500, #f59e0b);
}
.fx-deferred {
  color: var(--p-blue-500, #3b82f6);
}
.fx-condition {
  color: var(--p-cyan-500, #06b6d4);
}

/* Scope badges — a distinct channel from status color. */
.fx-scope-hero {
  color: var(--p-indigo-500, #6366f1);
}
.fx-scope-villain {
  color: var(--p-purple-500, #a855f7);
}
.fx-scope-mastermind {
  color: var(--p-amber-500, #f59e0b);
}
</style>
