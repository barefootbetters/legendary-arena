<script setup lang="ts">
/**
 * Gauntlet index panel (WP-343 / WP-345 / D-24131 §8a / D-24134) — every
 * set-gauntlet championship grouped by set. Each row shows per-player-count
 * claim chips (claimed counts link to their board; empty counts render inline
 * unclaimed state), and unclaimed gauntlets carry a challenge link that lands
 * on the leg's pinned loadout preview.
 */
import { computed, reactive } from "vue";
import type {
  GauntletIndexEntry,
  GauntletIndexSnapshot,
  SetDetails,
} from "../snapshots/snapshotClient";
import {
  buildCoverageMatrix,
  buildFixedCountTabs,
  buildGauntletDetails,
  buildPlayerCountTabs,
  buildRowChallengeUrl,
  findSetDetails,
  formatCardDisplayName,
  groupGauntletsBySet,
  pinShowcaseGauntlet,
  type CoverageMatrix,
  type GauntletDetails,
  type PlayerCountTab,
} from "./gauntletDisplay";
import {
  downloadGauntletPack,
  type GauntletDivision,
  type GauntletPackPlayerCount,
} from "./gauntletPackDownload";
import EmptyBoardCta from "../components/EmptyBoardCta.vue";

const props = defineProps<{
  index: GauntletIndexSnapshot | null;
  error: string | null;
}>();

const setGroups = computed(() => {
  if (props.index === null) {
    return [];
  }
  // why: WP-441 — pin the Core Set / Magneto showcase gauntlet to the front of
  // the grouped index. The pin is applied AFTER groupGauntletsBySet, so that
  // function's publisher-order-preserving contract is untouched.
  return pinShowcaseGauntlet(groupGauntletsBySet(props.index.gauntlets));
});

// why: WP-456 — the player counts the details reveal lists approved adversaries
// for (the SupportedPlayerCount range the gauntlet index keys on).
const DETAIL_PLAYER_COUNTS = [1, 2, 3, 4, 5];

// why: WP-456 — precompute each gauntlet's details once per index change (keyed
// by board name) rather than re-deriving inside the template on every render;
// the reveal template reads this map. buildGauntletDetails is pure and reads only
// the already-parsed snapshot entry (no API, no registry import).
const gauntletDetailsByBoard = computed<Map<string, GauntletDetails>>(() => {
  const detailsByBoard = new Map<string, GauntletDetails>();
  for (const setGroup of setGroups.value) {
    for (const gauntlet of setGroup.gauntlets) {
      detailsByBoard.set(
        gauntlet.board,
        buildGauntletDetails(gauntlet, DETAIL_PLAYER_COUNTS),
      );
    }
  }
  return detailsByBoard;
});

const EMPTY_GAUNTLET_DETAILS: GauntletDetails = { schemes: [], loadoutsByCount: [] };

/**
 * The precomputed details for one gauntlet row, for the reveal template.
 *
 * @param gauntlet The gauntlet index entry.
 * @returns Its details, or an empty shape if not yet computed.
 */
function gauntletDetails(gauntlet: GauntletIndexEntry): GauntletDetails {
  return gauntletDetailsByBoard.value.get(gauntlet.board) ?? EMPTY_GAUNTLET_DETAILS;
}

/** One gauntlet row's download-selector state (WP-441). */
interface GauntletDownloadSelection {
  playerCount: GauntletPackPlayerCount;
  division: GauntletDivision;
}

// why: per-row selector state keyed by the gauntlet's board name — the index
// renders up to 105 rows and each row carries its own count/division choice, so
// a single shared ref would apply one row's pick to every other row.
const rowSelections = reactive<Record<string, GauntletDownloadSelection>>({});

/** The player counts a gauntlet pack may target (D-24134 §2 / WP-370). */
const PLAYER_COUNT_OPTIONS: readonly GauntletPackPlayerCount[] = [1, 2, 3, 4, 5];

/** The two competitive divisions a gauntlet can be entered in (D-24260). */
const DIVISION_OPTIONS: readonly GauntletDivision[] = ["fixed", "open"];

/**
 * The current selection for a row, defaulting to solo (1) + fixed. A plain read
 * returns the default WITHOUT writing to the reactive store, so rendering never
 * mutates state (which would risk a render loop).
 */
function selectionFor(board: string): GauntletDownloadSelection {
  return rowSelections[board] ?? { playerCount: 1, division: "fixed" };
}

/** Records a row's player-count choice. */
function setPlayerCount(
  board: string,
  playerCount: GauntletPackPlayerCount,
): void {
  rowSelections[board] = { ...selectionFor(board), playerCount };
}

/** Records a row's division choice. */
function setDivision(board: string, division: GauntletDivision): void {
  rowSelections[board] = { ...selectionFor(board), division };
}

/** Reads the chosen player count off a count `<select>`'s change event. */
function onPlayerCountChange(board: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  setPlayerCount(board, Number(target.value) as GauntletPackPlayerCount);
}

/** Reads the chosen division off a division `<select>`'s change event. */
function onDivisionChange(board: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  setDivision(board, target.value as GauntletDivision);
}

/**
 * Builds and downloads the identity pack for a gauntlet row from its
 * `{ setAbbr, mastermindSlug }` and the selected count + division. No network
 * call — the pack is assembled client-side (WP-441).
 */
function downloadRowPack(gauntlet: GauntletIndexEntry): void {
  const selection = selectionFor(gauntlet.board);
  downloadGauntletPack({
    setAbbr: gauntlet.setAbbr,
    mastermindSlug: gauntlet.mastermindSlug,
    division: selection.division,
    playerCount: selection.playerCount,
  });
}

/** The per-count claim chips for one gauntlet row. */
function countChips(gauntlet: GauntletIndexEntry): PlayerCountTab[] {
  return buildPlayerCountTabs(gauntlet);
}

/**
 * The fixed-division claim chips for one gauntlet row — CLAIMED counts
 * only (WP-385). Rendering five more muted chips per row across a
 * 105-gauntlet index would be visual noise; the unclaimed fixed state
 * lives on the board panel's division toggle instead.
 */
function fixedChips(gauntlet: GauntletIndexEntry): PlayerCountTab[] {
  const claimedChips: PlayerCountTab[] = [];
  for (const tab of buildFixedCountTabs(gauntlet)) {
    if (tab.isClaimed) {
      claimedChips.push(tab);
    }
  }
  return claimedChips;
}

/** The chip label for one player count (e.g. `1p`, `2p`). */
function chipLabel(tab: PlayerCountTab): string {
  return `${tab.playerCount}p`;
}

/**
 * The challenge link for an unclaimed gauntlet's first leg, or `null` when
 * the index entry predates WP-344 (no `legs`) so no link renders.
 */
function firstLegChallengeUrl(gauntlet: GauntletIndexEntry): string | null {
  // why: WP-457 — thread the row's SELECTED player count (the same source the
  // Download control uses) into the challenge link, so the pinned approved
  // villains/henchmen and the URL count both match that count and the link opens
  // a qualifying builder. Previously the CTA pinned the solo (count-1) loadout
  // with no count, so the builder defaulted to 2 and judged a solo composition at
  // 2 players ("needs 2 villain groups — has 1").
  return buildRowChallengeUrl(gauntlet, selectionFor(gauntlet.board).playerCount);
}

/**
 * The published per-set roster for a set group's "Show set details" reveal
 * (WP-462), or `undefined` when the snapshot predates WP-461 (no `sets`) — the
 * reveal then does not render for that group. Renders the coverage flag verbatim.
 */
function setDetailsFor(setAbbr: string): SetDetails | undefined {
  return findSetDetails(props.index?.sets, setAbbr);
}

/** The comma-joined display names of a named-group roster (masterminds/schemes). */
function joinNames(groups: readonly { readonly name: string }[]): string {
  return groups.map((group) => group.name).join(", ");
}

/**
 * The accessible label for a villain/henchman coverage mark (WP-462). PER-SET
 * scoped per D-24279 — the flag means "this set's own gauntlets", never "any
 * gauntlet"; the ✓/✗ glyph is aria-hidden and this text carries the meaning.
 */
function coverageLabel(usedByGauntlets: boolean): string {
  return usedByGauntlets
    ? "used by this set's gauntlets"
    : "not used by this set's gauntlets";
}

// why: WP-464 — the coverage matrix is a Core-Set pilot; the render guard and the
// showcase pin both key on this abbr. `buildCoverageMatrix` itself is generic, so
// extending to another set is a one-constant change here plus a render tweak.
const MATRIX_COVERAGE_SET_ABBR = "core";

// why: WP-464 — the matrix's player count is its OWN per-set state, separate from
// the row download selector (`rowSelections`); a shared ref would cross-wire the
// two (and pull the download default off 1). Defaults to 2 (operator choice).
const matrixCountBySet = reactive<Record<string, number>>({});

/** The matrix's selected player count for a set, defaulting to 2. */
function matrixCountFor(setAbbr: string): number {
  return matrixCountBySet[setAbbr] ?? 2;
}

/** Records the matrix's player-count choice off its `<select>` change event. */
function onMatrixCountChange(setAbbr: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  matrixCountBySet[setAbbr] = Number(target.value);
}

// why: WP-464 — the Core coverage matrix, recomputed only when the grouped index
// or the matrix's own count changes. Null when the Core group or its SetDetails is
// absent (a pre-WP-461 snapshot), which suppresses the matrix render.
const coreCoverageMatrix = computed<CoverageMatrix | null>(() => {
  const coreGroup = setGroups.value.find(
    (group) => group.setAbbr === MATRIX_COVERAGE_SET_ABBR,
  );
  if (coreGroup === undefined) {
    return null;
  }
  const coreDetails = findSetDetails(props.index?.sets, MATRIX_COVERAGE_SET_ABBR);
  if (coreDetails === undefined) {
    return null;
  }
  return buildCoverageMatrix(
    coreGroup.gauntlets,
    coreDetails,
    matrixCountFor(MATRIX_COVERAGE_SET_ABBR),
  );
});

/**
 * Whether a matrix row begins a new mastermind block (for the group divider).
 *
 * @param rowIndex The row's index in the matrix.
 * @returns True for the first row and any row whose mastermind differs from the
 *   row above it.
 */
function isMatrixMastermindStart(rowIndex: number): boolean {
  const rows = coreCoverageMatrix.value?.rows ?? [];
  const currentRow = rows[rowIndex];
  const previousRow = rows[rowIndex - 1];
  if (currentRow === undefined) {
    return false;
  }
  if (previousRow === undefined) {
    return true;
  }
  return currentRow.mastermindSlug !== previousRow.mastermindSlug;
}
</script>

<template>
  <div class="panel gauntlet-index-panel">
    <h2 class="panel-title">Mastermind Gauntlets</h2>
    <p class="panel-subtitle">
      Defeat a mastermind under every scheme in its set to claim a board.
    </p>

    <div v-if="error" class="panel-error">
      <p>Data unavailable</p>
      <p class="error-detail">{{ error }}</p>
    </div>

    <div v-else-if="!index" class="panel-loading">
      <p>Loading gauntlets...</p>
    </div>

    <div v-else class="set-groups">
      <section
        v-for="setGroup of setGroups"
        :key="setGroup.setAbbr"
        class="set-group"
      >
        <h3 class="set-name">{{ setGroup.setName }}</h3>

        <!-- WP-462: per-SET details reveal — the set's FULL roster (every
             mastermind, scheme, villain, henchman), with villains/henchmen marked
             fought (✓) / not-fought (✗) by THIS set's gauntlets. Rendered from
             WP-461's already-published `sets` field (no API, no recompute); a
             native <details> so it is keyboard-accessible. Absent on a pre-WP-461
             snapshot → the reveal does not render. -->
        <details
          v-if="setDetailsFor(setGroup.setAbbr)"
          class="set-details"
        >
          <summary class="set-details-summary">Show set details</summary>
          <div class="set-details-body">
            <p class="set-details-legend">
              A set challenge fights every mastermind and scheme below.
              <span class="coverage-mark covered" aria-hidden="true">✓</span> a
              villain/henchman this set's gauntlets fight;
              <span class="coverage-mark uncovered" aria-hidden="true">✗</span> one
              in the set no gauntlet currently uses.
            </p>
            <div class="set-details-section">
              <span class="set-details-label">Masterminds</span>
              <span class="set-details-line">{{ joinNames(setDetailsFor(setGroup.setAbbr)?.masterminds ?? []) }}</span>
            </div>
            <div class="set-details-section">
              <span class="set-details-label">Schemes</span>
              <span class="set-details-line">{{ joinNames(setDetailsFor(setGroup.setAbbr)?.schemes ?? []) }}</span>
            </div>
            <div class="set-details-section">
              <span class="set-details-label">Villains</span>
              <ul class="set-details-groups">
                <li
                  v-for="villain of setDetailsFor(setGroup.setAbbr)?.villains ?? []"
                  :key="villain.slug"
                  class="set-details-group"
                >
                  <span
                    class="coverage-mark"
                    :class="villain.usedByGauntlets ? 'covered' : 'uncovered'"
                    aria-hidden="true"
                  >{{ villain.usedByGauntlets ? "✓" : "✗" }}</span>
                  <span>{{ villain.name }}</span>
                  <span class="visually-hidden"> — {{ coverageLabel(villain.usedByGauntlets) }}</span>
                </li>
              </ul>
            </div>
            <div class="set-details-section">
              <span class="set-details-label">Henchmen</span>
              <ul class="set-details-groups">
                <li
                  v-for="henchman of setDetailsFor(setGroup.setAbbr)?.henchmen ?? []"
                  :key="henchman.slug"
                  class="set-details-group"
                >
                  <span
                    class="coverage-mark"
                    :class="henchman.usedByGauntlets ? 'covered' : 'uncovered'"
                    aria-hidden="true"
                  >{{ henchman.usedByGauntlets ? "✓" : "✗" }}</span>
                  <span>{{ henchman.name }}</span>
                  <span class="visually-hidden"> — {{ coverageLabel(henchman.usedByGauntlets) }}</span>
                </li>
              </ul>
            </div>
          </div>
        </details>

        <ul class="gauntlet-list">
          <li
            v-for="gauntlet of setGroup.gauntlets"
            :key="gauntlet.board"
            class="gauntlet-row"
          >
            <span class="mastermind-name">{{ formatCardDisplayName(gauntlet.mastermindName) }}</span>
            <span class="leg-count">{{ gauntlet.legCount }} schemes</span>

            <div class="count-chips">
              <template
                v-for="chip of countChips(gauntlet)"
                :key="chip.playerCount"
              >
                <a
                  v-if="chip.isClaimed"
                  class="chip chip-claimed"
                  :href="`#/gauntlet/${chip.boardName}`"
                >{{ chipLabel(chip) }} ✓</a>
                <!-- why: an empty count has NO board file below one entry
                     (the WP-342 publisher writes boards only at >=1 complete
                     entry, D-24131 §7) — a link would 404, so the unclaimed
                     count renders inline muted state instead. -->
                <span
                  v-else
                  class="chip chip-unclaimed"
                  title="Unclaimed"
                >{{ chipLabel(chip) }}</span>
              </template>
              <!-- Fixed-division claim chips (WP-385): claimed counts only —
                   the championship marker on the index. -->
              <a
                v-for="chip of fixedChips(gauntlet)"
                :key="`fixed-${chip.playerCount}`"
                class="chip chip-fixed"
                :href="`#/gauntlet/${chip.boardName}`"
                title="Fixed-Pool Championship claimed"
              >★ {{ chipLabel(chip) }}</a>
            </div>

            <!-- Unclaimed gauntlet CTA: challenge the first leg on a pinned
                 loadout (D-24134 §6), or the shared play CTA on an old
                 snapshot that predates `legs`. -->
            <a
              v-if="gauntlet.entryCount === 0 && firstLegChallengeUrl(gauntlet) !== null"
              class="challenge-link"
              :href="firstLegChallengeUrl(gauntlet) ?? undefined"
              target="_blank"
              rel="noopener"
            >Challenge →</a>
            <EmptyBoardCta
              v-else-if="gauntlet.entryCount === 0"
              compact
            />

            <!-- Client-side gauntlet-pack download (WP-441): a compact
                 player-count + division selector defaulting to solo (1) +
                 fixed, and a button that builds and saves the identity pack.
                 No server call — the pack is assembled from this row's data. -->
            <div class="download-control">
              <select
                class="download-select"
                :value="selectionFor(gauntlet.board).playerCount"
                aria-label="Player count"
                @change="onPlayerCountChange(gauntlet.board, $event)"
              >
                <option
                  v-for="playerCount of PLAYER_COUNT_OPTIONS"
                  :key="playerCount"
                  :value="playerCount"
                >{{ playerCount }}p</option>
              </select>
              <select
                class="download-select"
                :value="selectionFor(gauntlet.board).division"
                aria-label="Division"
                @change="onDivisionChange(gauntlet.board, $event)"
              >
                <option
                  v-for="division of DIVISION_OPTIONS"
                  :key="division"
                  :value="division"
                >{{ division }}</option>
              </select>
              <button
                type="button"
                class="download-button"
                @click="downloadRowPack(gauntlet)"
              >Download Mastermind Gauntlet</button>
            </div>

            <!-- WP-456: per-mastermind details reveal — the schemes and the
                 approved villains/henchmen per player count a run must use to
                 qualify. Rendered from already-published snapshot data (no API);
                 a native <details> so it is keyboard-accessible. -->
            <details class="gauntlet-details">
              <summary class="gauntlet-details-summary">Show details</summary>
              <div class="gauntlet-details-body">
                <p class="gauntlet-details-schemes">
                  <strong>Schemes ({{ gauntletDetails(gauntlet).schemes.length }}):</strong>
                  {{ gauntletDetails(gauntlet).schemes.join(", ") }}
                </p>
                <!-- why: WP-459 — the per-count blocks flow into a responsive grid
                     (multiple columns where width allows), so the reveal is a
                     compact card instead of a tall single column. The Schemes line
                     above stays full-width. -->
                <div class="gauntlet-details-counts">
                  <div
                    v-for="countDetail of gauntletDetails(gauntlet).loadoutsByCount"
                    :key="countDetail.playerCount"
                    class="gauntlet-details-count"
                  >
                    <span class="gauntlet-details-count-label">{{ countDetail.playerCount }}-player approved adversaries</span>
                    <p v-if="countDetail.configs.length === 0" class="gauntlet-details-none">
                      Requirement not published for this player count.
                    </p>
                    <ul v-else class="gauntlet-details-configs">
                      <li
                        v-for="(config, configIndex) of countDetail.configs"
                        :key="configIndex"
                        class="gauntlet-details-config"
                      >
                        <span><strong>Villains:</strong> {{ config.villains.join(", ") }}</span>
                        <span><strong>Henchmen:</strong> {{ config.henchmen.join(", ") }}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </details>
          </li>
        </ul>

        <!-- WP-464: Core-Set gauntlet-coverage matrix — a per-leg launch grid at
             the bottom of the Core group. Rows = masterminds × schemes, columns =
             villains then henchmen; a ✓ links to that leg's cards-builder challenge
             at the selected count. Rendered from already-published data (no API);
             Core-only pilot (buildCoverageMatrix is generic). -->
        <details
          v-if="setGroup.setAbbr === 'core' && coreCoverageMatrix"
          class="coverage-matrix"
        >
          <summary class="coverage-matrix-summary">Show gauntlet coverage matrix</summary>
          <div class="coverage-matrix-body">
            <label class="coverage-matrix-count">
              <span>Player count</span>
              <select
                class="download-select"
                :value="matrixCountFor(setGroup.setAbbr)"
                aria-label="Coverage matrix player count"
                @change="onMatrixCountChange(setGroup.setAbbr, $event)"
              >
                <option
                  v-for="playerCount of PLAYER_COUNT_OPTIONS"
                  :key="playerCount"
                  :value="playerCount"
                >{{ playerCount }}p</option>
              </select>
            </label>
            <p class="coverage-matrix-legend">
              A ✓ marks a villain/henchman fought in that (mastermind × scheme) leg
              at {{ matrixCountFor(setGroup.setAbbr) }} players; click it to open that
              fight in the cards builder.
            </p>
            <div class="coverage-matrix-scroll">
              <table class="coverage-matrix-table">
                <thead>
                  <tr>
                    <th scope="col" class="coverage-matrix-corner">Scheme</th>
                    <!-- why: WP-466 — the adversary name rides its own span so the
                         CSS can rotate it 90° (writing-mode) and shrink each column
                         to ~one line-height, removing the horizontal scroll. -->
                    <th
                      v-for="column of coreCoverageMatrix.columns"
                      :key="`${column.kind}-${column.slug}`"
                      scope="col"
                      :class="['coverage-matrix-colhead', column.kind]"
                    ><span class="coverage-matrix-colhead-text">{{ column.name }}</span></th>
                  </tr>
                </thead>
                <tbody>
                  <!-- why: WP-466 — each mastermind is named ONCE as a group-header
                       row spanning the table, above its 8 scheme rows; the row-label
                       column then holds only the (wrappable) scheme name. -->
                  <template
                    v-for="(row, rowIndex) of coreCoverageMatrix.rows"
                    :key="`${row.mastermindSlug}-${row.schemeSlug}`"
                  >
                    <tr
                      v-if="isMatrixMastermindStart(rowIndex)"
                      class="coverage-matrix-mm-row"
                    >
                      <th
                        :colspan="coreCoverageMatrix.columns.length + 1"
                        scope="colgroup"
                        class="coverage-matrix-mm-header"
                      >{{ formatCardDisplayName(row.mastermindName) }}</th>
                    </tr>
                    <tr>
                      <th scope="row" class="coverage-matrix-rowhead">{{ formatCardDisplayName(row.schemeName) }}</th>
                      <td
                        v-for="(cell, columnIndex) of row.cells"
                        :key="columnIndex"
                        class="coverage-matrix-cell"
                      >
                        <a
                          v-if="cell.covered && cell.challengeUrl"
                          :href="cell.challengeUrl"
                          class="coverage-matrix-check"
                          target="_blank"
                          rel="noopener"
                        >
                          <span aria-hidden="true">✓</span>
                          <span class="visually-hidden">Play {{ formatCardDisplayName(row.schemeName) }} vs {{ coreCoverageMatrix.columns[columnIndex]?.name }} at {{ matrixCountFor(setGroup.setAbbr) }}-player</span>
                        </a>
                        <span v-else class="coverage-matrix-blank" aria-hidden="true">·</span>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </details>
      </section>
    </div>
  </div>
</template>

<style scoped>
.panel {
  padding: 1.5rem;
}

.panel-title {
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
  color: var(--la-color-gold-bright);
}

.panel-subtitle {
  color: var(--la-color-text-secondary);
  margin: 0 0 1.25rem;
  font-size: 0.9rem;
}

.panel-error {
  padding: 1rem;
  background: rgba(255, 60, 60, 0.1);
  border: 1px solid rgba(255, 60, 60, 0.3);
  border-radius: 8px;
  text-align: center;
}

.error-detail {
  font-size: 0.85rem;
  color: var(--la-color-text-secondary);
  margin-top: 0.5rem;
}

.panel-loading {
  text-align: center;
  color: var(--la-color-text-secondary);
  padding: 2rem;
}

.set-group {
  margin-bottom: 1.5rem;
}

.set-name {
  font-size: 1.05rem;
  color: var(--la-color-text-secondary);
  border-bottom: 1px solid var(--la-color-border-subtle);
  padding-bottom: 0.35rem;
  margin: 0 0 0.5rem;
}

/* WP-462: per-set "Show set details" reveal */
.set-details {
  margin: 0 0 0.75rem;
}

.set-details-summary {
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--la-color-gold-bright);
}

.set-details-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--la-color-text-secondary);
}

.set-details-legend {
  margin: 0;
  font-size: 0.75rem;
  color: var(--la-color-text-muted);
}

.set-details-section {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.set-details-label {
  color: var(--la-color-text-primary);
  font-weight: 600;
}

.set-details-line {
  overflow-wrap: anywhere;
}

.set-details-groups {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.15rem 0.85rem;
}

.set-details-group {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  /* why: WP-462 — min-width:0 + overflow-wrap let a long group name wrap inside
     its grid column instead of forcing a wide track (horizontal scroll). */
  min-width: 0;
  overflow-wrap: anywhere;
}

.coverage-mark {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* why: WP-462 — the ✓/✗ glyph difference (not colour) plus the visually-hidden
   per-set-scoped label carry the meaning; colour is a secondary cue only. */
.coverage-mark.covered {
  color: var(--la-color-gold-bright);
}

.coverage-mark.uncovered {
  color: var(--la-color-text-muted);
}

/* why: WP-462 — screen-reader-only text so the coverage mark's meaning ("used by
   this set's gauntlets" / "not used…") is announced without a visible label;
   `title` alone is not reliably exposed to AT or keyboards. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.gauntlet-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.gauntlet-row {
  display: flex;
  align-items: center;
  /* why: WP-459 — wrap so the `flex-basis: 100%` details reveal takes its OWN
     full-width line below the row's top-line items, instead of being squeezed
     into the leftover ~208px of a nowrap row (which forced the tall single
     column). The top-line items already fit on one line, so only the reveal
     wraps below. */
  flex-wrap: wrap;
  gap: 1rem;
  padding: 0.45rem 0.25rem;
  border-bottom: 1px solid rgba(26, 26, 46, 0.6);
}

.mastermind-name {
  flex: 1;
  color: var(--la-color-text-primary);
}

.leg-count {
  color: var(--la-color-text-muted);
  font-size: 0.85rem;
}

/* Per-count claim chips */
.count-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.chip {
  padding: 0.15rem 0.5rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}

.chip-claimed {
  color: var(--la-color-gold-bright);
  border: 1px solid rgba(255, 215, 0, 0.4);
}

.chip-claimed:hover {
  background: rgba(255, 215, 0, 0.12);
}

.chip-unclaimed {
  color: var(--la-color-border-strong);
  border: 1px dashed var(--la-color-border-subtle);
}

.chip-fixed {
  color: var(--la-color-gold-bright);
  border: 1px solid rgba(255, 215, 0, 0.7);
  background: rgba(255, 215, 0, 0.08);
  font-weight: 600;
}

.chip-fixed:hover {
  background: rgba(255, 215, 0, 0.18);
}

.challenge-link {
  color: var(--la-color-gold-bright);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
}

.challenge-link:hover {
  text-decoration: underline;
}

/* Gauntlet-pack download control (WP-441) */
.download-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.download-select {
  padding: 0.15rem 0.35rem;
  border-radius: 6px;
  border: 1px solid var(--la-color-border-subtle);
  background: transparent;
  color: var(--la-color-text-primary);
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.download-button {
  padding: 0.2rem 0.7rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 215, 0, 0.4);
  background: transparent;
  color: var(--la-color-gold-bright);
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}

.download-button:hover {
  background: rgba(255, 215, 0, 0.12);
}

/* WP-456: per-mastermind gauntlet details reveal */
.gauntlet-details {
  flex-basis: 100%;
  margin-top: 0.35rem;
  /* why: WP-460 — no divider ABOVE the reveal panel; the row's own
     `border-bottom` is the horizontal divider, and it sits BELOW the expanded
     "Show details" panel (the reveal wraps onto the row's own line). */
}

.gauntlet-details-summary {
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--la-color-gold-bright);
}

.gauntlet-details-body {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.4rem;
  font-size: 0.8rem;
  color: var(--la-color-text-secondary);
}

.gauntlet-details-schemes {
  margin: 0;
}

/* why: WP-459 — lay the per-count blocks in a responsive grid so they flow into
   multiple columns on a wide row and collapse to one column on narrow viewports,
   replacing the tall single-column stack that produced ~40 rows of whitespace. */
.gauntlet-details-counts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
  gap: 0.3rem 0.85rem;
}

.gauntlet-details-count {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  /* why: WP-459 — min-width:0 + overflow-wrap let a long adversary name wrap
     inside its column instead of forcing a wide track (horizontal scroll). */
  min-width: 0;
  overflow-wrap: anywhere;
}

.gauntlet-details-count-label {
  color: var(--la-color-text-primary);
  font-weight: 600;
}

.gauntlet-details-none {
  margin: 0;
  font-style: italic;
  opacity: 0.75;
}

.gauntlet-details-configs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.gauntlet-details-config {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

/* WP-464: Core-Set gauntlet-coverage matrix */
.coverage-matrix {
  margin: 0.75rem 0 0.25rem;
}

.coverage-matrix-summary {
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--la-color-gold-bright);
}

.coverage-matrix-body {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.coverage-matrix-count {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--la-color-text-secondary);
}

.coverage-matrix-legend {
  margin: 0;
  font-size: 0.75rem;
  color: var(--la-color-text-muted);
}

/* why: WP-464 — the safety-net wrapper scrolls a wide matrix horizontally rather
   than overflowing the page; 11 columns fit most viewports, small screens scroll
   the table as a unit. */
.coverage-matrix-scroll {
  overflow-x: auto;
}

.coverage-matrix-table {
  border-collapse: collapse;
  font-size: 0.75rem;
  color: var(--la-color-text-secondary);
}

.coverage-matrix-table th,
.coverage-matrix-table td {
  padding: 0.2rem 0.45rem;
  text-align: center;
  white-space: nowrap;
}

.coverage-matrix-corner {
  text-align: left;
  vertical-align: bottom;
  color: var(--la-color-text-muted);
  font-weight: 600;
}

/* why: WP-466 — rotate the adversary name 90° (writing-mode) so each of the 11
   columns is only ~one line-height wide; the header row grows taller instead,
   which is cheap vertical space and is what removes the horizontal scroll. */
.coverage-matrix-colhead {
  color: var(--la-color-text-primary);
  font-weight: 600;
  vertical-align: bottom;
  padding: 0.2rem 0.15rem;
}

.coverage-matrix-colhead-text {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  white-space: nowrap;
  line-height: 1.1;
}

/* why: WP-464 — henchman columns are distinguished from villains without relying
   on colour alone (italic + a lighter weight). */
.coverage-matrix-colhead.henchman .coverage-matrix-colhead-text {
  color: var(--la-color-text-secondary);
  font-style: italic;
}

/* why: WP-466 — a long scheme name wraps to two lines and the column is
   width-capped, so the row-label column stays narrow (was `nowrap`). */
.coverage-matrix-rowhead {
  text-align: left;
  white-space: normal;
  max-width: 9rem;
  overflow-wrap: anywhere;
  line-height: 1.15;
  color: var(--la-color-text-secondary);
}

/* why: WP-466 — the mastermind is named ONCE per block as a full-width header row
   (replacing the per-row repetition); its top border opens the group. */
.coverage-matrix-mm-header {
  text-align: left;
  padding-top: 0.5rem;
  color: var(--la-color-gold-bright);
  font-weight: 700;
  border-top: 1px solid var(--la-color-border-subtle);
}

.coverage-matrix-check {
  color: var(--la-color-gold-bright);
  text-decoration: none;
  font-weight: 700;
}

.coverage-matrix-check:hover {
  text-decoration: underline;
}

.coverage-matrix-blank {
  color: var(--la-color-border-strong);
}
</style>
