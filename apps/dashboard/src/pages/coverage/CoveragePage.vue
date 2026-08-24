<script setup lang="ts">
import { computed, ref } from 'vue';
import { useCoverageLedger, statusLabel } from '../../composables/useCoverageLedger.js';
import { useInPlayCoverage } from '../../composables/useInPlayCoverage.js';
import { useParFidelity } from '../../composables/useParFidelity.js';
import ParSweetSpotChart from '../../components/charts/ParSweetSpotChart.vue';
import type { LedgerRow, LedgerStatus, RuntimeObservedEntry } from '../../types/coverage.js';
import type { ParFidelityRow } from '../../types/parFidelity.js';

const {
  summary,
  rows,
  mechanics,
  percentExecutable,
  error,
  runtimeObservedByMechanic,
  runtimeObservedSummary,
} = useCoverageLedger();

// The second headline (WP-274 / D-24050): obs-weighted, ledger-gated in-play
// hollow resolution — answers "how much of what actually breaks games in play
// have we fixed?", unlike the mechanic-counted `%-executable` headline.
const { percentResolved, resolvedObs, totalObs } = useInPlayCoverage();

const DISPLAY_CAP = 100;

// why: the closed WP-257 hollow-reason set, in canonical order — drives the
// dominant-reason badge label on the runtime-observed overlay.
const HOLLOW_REASONS = ['no-handler', 'unsupported-keyword', 'parse-unrecognized'] as const;

/** Maps a ledger status to its CSS modifier class for the colored badges. */
function statusClass(status: LedgerStatus): string {
  return `cov-${status}`;
}

/**
 * The Design column label (WP-491): the card design name(s) that print this
 * mechanic, comma-joined, or an em dash when there is no carrying design (an
 * `(unmarked)` row, or an older schemaVersion-1 ledger without the field).
 */
function designLabel(designs: LedgerRow['designs']): string {
  if (!designs || designs.length === 0) {
    return '—';
  }
  return designs.map((design) => design.name).join(', ');
}

/** The runtime-observed entry for a mechanic, or undefined if never hit in play. */
function runtimeObservedFor(mechanic: string): RuntimeObservedEntry | undefined {
  return runtimeObservedByMechanic.value[mechanic];
}

/** The most-hit hollow reason for an entry (drives the overlay badge label). */
function dominantReason(entry: RuntimeObservedEntry): string {
  let topReason: string = HOLLOW_REASONS[0];
  let topCount = -1;
  for (const reason of HOLLOW_REASONS) {
    if (entry.byReason[reason] > topCount) {
      topCount = entry.byReason[reason];
      topReason = reason;
    }
  }
  return topReason;
}

// By-card index (the debugging lookup): status filter + free-text search over
// card name / ext_id / mechanic, capped so the table stays responsive.
const statusFilter = ref<LedgerStatus | 'all'>('unsupported');
const search = ref('');

const filteredRows = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const result = [];
  for (const row of rows.value) {
    if (statusFilter.value !== 'all' && row.status !== statusFilter.value) {
      continue;
    }
    if (needle !== '') {
      const haystack = `${row.heroName} ${row.extId} ${row.mechanic}`.toLowerCase();
      if (!haystack.includes(needle)) {
        continue;
      }
    }
    result.push(row);
  }
  return result;
});

const displayedRows = computed(() => filteredRows.value.slice(0, DISPLAY_CAP));

const STATUS_FILTERS: readonly (LedgerStatus | 'all')[] = [
  'unsupported',
  'condition',
  'unmarked',
  'deferred',
  // why (WP-559 / D-24368): implemented by a subsystem other than the [effect:X]
  // pipeline — done, not a TODO. Sits beside `executable` at the resolved end.
  'subsystem',
  'executable',
  'all',
];

// PAR Fidelity panel (WP-598 / D-24407): the WP-597 sweep rendered — summary
// tiles + a ranked too-easy table + a click-to-expand per-scenario sweet-spot
// curve. Read-only diagnostic; NOT competitive PAR.
const {
  rows: parRows,
  summary: parSummary,
  getProfile: getParProfile,
  error: parError,
} = useParFidelity();

// The scenario whose curve is expanded (null = none); clicking a row toggles it.
const expandedScenario = ref<string | null>(null);
function toggleScenario(scenarioKey: string): void {
  expandedScenario.value = expandedScenario.value === scenarioKey ? null : scenarioKey;
}

/** Win rate as a whole-percent string for the table. */
function winPercentLabel(row: ParFidelityRow): string {
  return `${Math.round(row.winRate * 100)}%`;
}

/**
 * The too-easy severity class for a row — drives the win-rate cell color. A near-
 * always-win scenario reads as the too-easy signal (red, like unsupported); a
 * zero-win scenario is the engine's hardest (green, like executable/resolved).
 */
function winRateClass(row: ParFidelityRow): string {
  if (row.winRate >= 0.9) {
    return 'cov-unsupported';
  }
  if (row.winRate === 0) {
    return 'cov-executable';
  }
  return 'dim';
}
</script>

<template>
  <div class="coverage-page">
    <header class="page-header">
      <h1>Mechanic Coverage</h1>
      <p class="subtitle">
        Every hero card × mechanic — the authoring worklist and the bug→code index. Source:
        <code>docs/ai/coverage/hero-mechanic-ledger.json</code> (regenerated by
        <code>pnpm ledger:heroes</code>; CI-gated). Updates on every mechanic WP.
      </p>
    </header>

    <p v-if="error" class="cov-error">Coverage ledger failed to load: {{ error }}</p>

    <section class="summary">
      <div class="headline">
        <span class="headline-num">{{ percentExecutable }}%</span>
        <span class="headline-label">hero mechanics executable</span>
        <!-- why (WP-561 / D-24370): the two headlines are NOT comparable percentages of
             the same thing. This one is ROW-weighted (share of card x mechanic rows);
             its neighbour is OBSERVATION-weighted (share of in-play hollow observations).
             Saying so stops the pair reading as a before/after of one measure. -->
        <span class="headline-sub"
          >per card × mechanic row — {{ summary.distinctMechanics }} distinct mechanics ·
          {{ summary.totalRows }} rows</span
        >
      </div>
      <div class="headline">
        <span class="headline-num">{{ percentResolved }}%</span>
        <span class="headline-label">in-play hollows resolved</span>
        <span class="headline-sub"
          >weighted by how often it bites in play — {{ resolvedObs }} /
          {{ totalObs }} observations</span
        >
      </div>
      <div class="summary-chips">
        <div class="count-chip cov-executable">
          <span class="count-num">{{ summary.byStatus.executable }}</span
          ><span>Executable</span>
        </div>
        <div class="count-chip cov-deferred">
          <span class="count-num">{{ summary.byStatus.deferred }}</span
          ><span>Deferred</span>
        </div>
        <div class="count-chip cov-condition">
          <span class="count-num">{{ summary.byStatus.condition }}</span
          ><span>Condition</span>
        </div>
        <div class="count-chip cov-unsupported">
          <span class="count-num">{{ summary.byStatus.unsupported }}</span
          ><span>Unsupported</span>
        </div>
        <div class="count-chip cov-unmarked">
          <span class="count-num">{{ summary.byStatus.unmarked }}</span
          ><span>Unmarked</span>
        </div>
        <div class="count-chip cov-subsystem">
          <span class="count-num">{{ summary.byStatus.subsystem ?? 0 }}</span
          ><span>Subsystem</span>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>By card — debugging index</h2>
      <div class="controls">
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
        <input
          v-model="search"
          type="search"
          placeholder="Search card or mechanic…"
          class="search-input"
        />
      </div>
      <p class="block-note">
        Showing {{ displayedRows.length }} of {{ filteredRows.length }} matching rows.
        <span v-if="filteredRows.length > displayedRows.length">Refine the search to narrow.</span>
      </p>
      <table class="cov-table">
        <thead>
          <tr>
            <th>Card</th>
            <th>Design</th>
            <th>Set</th>
            <th>Mechanic</th>
            <th>Status</th>
            <th>WP</th>
            <th>Decision</th>
            <th>Handler</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in displayedRows" :key="`${row.extId}-${row.mechanic}`">
            <td>
              <span class="card-name">{{ row.heroName }}</span>
              <span class="mono dim ext">{{ row.extId }}</span>
            </td>
            <!-- why: WP-491 — the card design(s) that print this mechanic; "—" for a
                 villain-less/unmarked row (hero-level, no carrying design). -->
            <td>{{ designLabel(row.designs) }}</td>
            <td class="mono dim">{{ row.set }}</td>
            <td class="mono">{{ row.mechanic }}</td>
            <td>
              <span class="badge" :class="statusClass(row.status)">{{
                statusLabel(row.status)
              }}</span>
            </td>
            <td class="mono dim">{{ row.wp || '—' }}</td>
            <!-- why: WP-496 — the DECISIONS.md id governing this mechanic, mirroring the
                 by-mechanic table + /debug/effects; "—" for an unattributed row (never fabricated). -->
            <td class="mono dim">{{ row.decision || '—' }}</td>
            <td class="mono dim handler">{{ row.handler || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="block">
      <h2>By mechanic — the implementation worklist</h2>
      <p class="block-note">
        One row per mechanic (implementing one clears every card using it). Unsupported first.
        <span class="runtime-note">
          The <strong>Observed in play</strong> column overlays <em>runtime-observed</em> hollows —
          mechanics actually hit during a fixed-seed deterministic sim sweep ({{
            runtimeObservedSummary.distinctMechanics
          }}
          distinct · {{ runtimeObservedSummary.totalObservations }} observations). Static status
          answers "unsupported in theory?"; this answers "did it bite a player in play?"
        </span>
      </p>
      <table class="cov-table">
        <thead>
          <tr>
            <th>Mechanic</th>
            <th>Status</th>
            <th>Observed in play</th>
            <th class="num">Cards</th>
            <th>WP</th>
            <th>Decision</th>
            <th>Handler</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in mechanics" :key="entry.mechanic">
            <td class="mono">{{ entry.mechanic }}</td>
            <td>
              <span class="badge" :class="statusClass(entry.status)">{{
                statusLabel(entry.status)
              }}</span>
            </td>
            <td>
              <span
                v-if="runtimeObservedFor(entry.mechanic)"
                class="badge cov-runtime"
                :title="`hit ${runtimeObservedFor(entry.mechanic)!.hitCount}× in play · last seen turn ${runtimeObservedFor(entry.mechanic)!.lastSeenTurn}`"
              >
                ⚡ {{ runtimeObservedFor(entry.mechanic)!.hitCount }}× ·
                {{ dominantReason(runtimeObservedFor(entry.mechanic)!) }}
              </span>
              <span v-else class="not-observed">not observed in play</span>
            </td>
            <td class="num">{{ entry.cardCount }}</td>
            <td class="mono dim">{{ entry.wp || '—' }}</td>
            <td class="mono dim">{{ entry.decision || '—' }}</td>
            <td class="mono dim handler">{{ entry.handler || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="block">
      <h2>PAR Fidelity — scenario difficulty (sweet-spot diagnostic)</h2>
      <p class="block-note">
        The empirical turns-vs-score sweep (WP-597) rendered: which scenarios the current engine
        makes too easy, and which it cannot yet win. Source:
        <code>data/par/profile/v1/</code> (regenerated by
        <code>node scripts/generate-par-profiles.mjs</code>).
        <span class="runtime-note">
          A <strong>fidelity diagnostic</strong>, NOT a competitive PAR baseline — the engine is
          under-built, so this measures a different, easier game than the printed rules. Click a
          scenario to expand its per-turn score curve.
        </span>
      </p>

      <p v-if="parError" class="cov-error">PAR fidelity data failed to load: {{ parError }}</p>

      <div class="summary par-summary">
        <div class="headline">
          <span class="headline-num">{{ parSummary.winnablePercent }}%</span>
          <span class="headline-label">scenarios winnable</span>
          <span class="headline-sub"
            >{{ parSummary.winnableCount }} / {{ parSummary.scenariosSwept }} swept ·
            {{ parSummary.sample }} games each</span
          >
        </div>
        <div class="summary-chips">
          <div class="count-chip cov-unsupported">
            <span class="count-num">{{ parSummary.tooEasyCount }}</span
            ><span>Too easy (≥90% win)</span>
          </div>
          <div class="count-chip cov-executable">
            <span class="count-num">{{ parSummary.unwinnableCount }}</span
            ><span>Unwinnable (0% win)</span>
          </div>
        </div>
      </div>

      <table class="cov-table par-table">
        <thead>
          <tr>
            <th class="num">Rank</th>
            <th>Scenario</th>
            <th class="num">Win %</th>
            <th class="num">First win turn</th>
            <th class="num">Stuck</th>
            <th>Monotone</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="row in parRows" :key="row.scenarioKey">
            <tr
              class="par-row"
              :class="{ expanded: expandedScenario === row.scenarioKey }"
              @click="toggleScenario(row.scenarioKey)"
            >
              <td class="num">{{ row.tooEasyRank }}</td>
              <td class="mono">{{ row.scenarioKey }}</td>
              <td class="num" :class="winRateClass(row)">{{ winPercentLabel(row) }}</td>
              <td class="num">{{ row.minWinningTurn ?? '—' }}</td>
              <td class="num">{{ row.stuckAtCapCount }}</td>
              <td>{{ row.monotoneImproving ? 'yes' : 'no' }}</td>
            </tr>
            <tr v-if="expandedScenario === row.scenarioKey" class="par-chart-row">
              <td colspan="6">
                <ParSweetSpotChart
                  v-if="getParProfile(row.scenarioKey)"
                  :profile="getParProfile(row.scenarioKey)!"
                />
                <span v-else class="not-observed">No profile bundled for this scenario.</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.coverage-page {
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

.cov-error {
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
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  color: var(--p-text-color);
}

.block-note {
  margin: 0 0 0.75rem;
  font-size: 0.78rem;
  color: var(--p-text-muted-color);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.filter-buttons {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.filter-buttons button {
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 4px;
  background: transparent;
  font-size: 0.78rem;
  cursor: pointer;
  color: var(--p-text-muted-color);
}

.filter-buttons button.active {
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
}

.cov-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.cov-table th {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color);
  font-weight: 600;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.cov-table td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--p-content-border-color);
  color: var(--p-text-color);
  vertical-align: top;
}

.cov-table .num {
  text-align: right;
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
   badges stay legible in light + dark themes. `currentColor` drives the border. */
.cov-executable {
  color: var(--p-green-500, #22c55e);
}
.cov-unsupported {
  color: var(--p-red-500, #ef4444);
}
.cov-unmarked {
  color: var(--p-amber-500, #f59e0b);
}

/* why (WP-559): subsystem is a RESOLVED state (implemented elsewhere), so it reads
   green-adjacent like executable rather than amber/red like the TODO buckets. */
.cov-subsystem {
  color: var(--p-teal-500, #14b8a6);
}
.cov-deferred {
  color: var(--p-blue-500, #3b82f6);
}
.cov-condition {
  color: var(--p-cyan-500, #06b6d4);
}
/* why (WP-548): `subsystem` is a COVERED/done state (a card implemented by a
   non-[effect:X] subsystem) — a distinct done colour (teal). No hero ledger row
   carries it today (it is villain-only), so this badge is inert here; defined for
   union completeness so a future subsystem-covered hero renders correctly. */
.cov-subsystem {
  color: var(--p-teal-500, #14b8a6);
}
.status-condition {
  color: var(--p-cyan-500, #06b6d4);
}

/* why (WP-259): the runtime-observed overlay is a DISTINCT visual channel from
   the four static-status colors — a filled purple badge (not an outlined status
   badge) so "actually hit in play" reads as its own signal at a glance. */
.cov-runtime {
  color: var(--p-purple-500, #a855f7);
  border-color: var(--p-purple-500, #a855f7);
  background: color-mix(in srgb, var(--p-purple-500, #a855f7) 15%, transparent);
}

.not-observed {
  font-size: 0.72rem;
  font-style: italic;
  color: var(--p-text-muted-color);
}

.runtime-note {
  display: block;
  margin-top: 0.35rem;
}

/* PAR Fidelity panel (WP-598) */
.par-summary {
  margin-bottom: 0.75rem;
}

.par-row {
  cursor: pointer;
}

.par-row:hover {
  background: color-mix(in srgb, var(--p-primary-color) 6%, transparent);
}

.par-row.expanded {
  background: color-mix(in srgb, var(--p-primary-color) 10%, transparent);
}

.par-chart-row td {
  padding: 0.5rem 0.6rem 1rem;
}
</style>
