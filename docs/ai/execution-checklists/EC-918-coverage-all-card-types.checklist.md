# EC-918 — `/coverage` Counts Every Card Type in a Set (Execution Checklist)

**Source:** docs/ai/work-packets/WP-880-coverage-all-card-types.md
**Layer:** App (`apps/dashboard`)

## Before Starting
- [ ] **WP-879 is `[x]` in WORK_INDEX** and the index carries `scope: "scheme"` rows. If not, STOP.
- [ ] **#3256 is merged or closed.** Build on whatever headline `main` carries. If merged, that
      is ", hero cards only" plus the excluded-types sub-line, both replaced here. If #3256 is
      still open, STOP.
- [ ] Re-confirm `origin/main` HEAD (draft baseline `4fd75a15`); record dashboard pass count.
- [ ] Rebuild the registry dist, then run the dashboard `build` once (writes the gitignored
      `src/data/*.json`, incl. `effect-implementation-index.json`) before typecheck/tests.
- [ ] Record the hero baseline for the execution summary (draft: Core 51/51, all sets 546/863).
      It is NOT written into any test.

## Locked Values (do not re-derive)
- `summarizeEntries(entries)` returns a full `LedgerSummary`: `totalRows`, `byStatus`, and
  `distinctMechanics` (the number of distinct `mechanic` values, excluding the `(unmarked)` sentinel).
- Every percent = `summaryImplementedPercent(summarizeEntries(...))` from `useCoverageLedger.ts`
  (D-24827). No second copy of the formula or the rounding.
- `AllTypesSetCoverageEntry = { abbr, name, summary: LedgerSummary, percentImplemented, byType:
  CardTypeCoverage[] }`. By set keeps Rows and the six status columns, and adds per-type columns.
- By card filters with `useEffectIndex.filterEntries`, with scope as the Type filter.
- Headline sub-line: `per card × ability row — {totalRows} rows · {distinctMechanics} distinct abilities`.
- Breakdown order = `EFFECT_INDEX_ENTRY_SCOPES`; zero-row scopes omitted.
- `cardTypeLabel`: `hero`→`Heroes`, `villain`→`Villains & Henchmen`,
  `mastermind`→`Masterminds`, `scheme`→`Schemes`; exhaustive switch + `assertNever`.
- Headline label: `card abilities implemented — {set name}` (or `— all sets`).
- `/vision` line: `${percent}% card abilities implemented · ${unsupported} unsupported`.
- By mechanic heading suffix: `— Heroes` (data source unchanged).

## Guardrails
- Parity test: `summarizeEntries(heroScopeEntries)` deep-equals `summarizeRows(ledgerRows)` on a
  shared fixture that includes an `(unmarked)` hero row. No literal counts in tests.
- Index load failure is never silent. `/coverage` shows `useEffectIndex().error` in a `cov-error`
  banner ("Effect index failed to load: …") and hides the all-types headline and per-type line;
  `/vision` drops its coverage line. One test injects a failing index.
- A Core or ca75 headline below 100% because WP-879 left a Scheme line `unmarked` is CORRECT.
  Never seed, edit or filter rows to reach 100%.
- Dashboard reads the bundled index only: no new data file, no network, no edit to `src/data`.
- Live-verify cell keeps `entryForRow`; mastermind/scheme rows render "—" (no new join).
- Unmarked / Deferred / Unsupported count as to-dos in every scope, Schemes included.
- No engine / registry / generator / server / persistence / card-data change.
- Prettier clean; dashboard `test:coverage` floors hold.

## Required `// why:` Comments
- `useCardCoverage`: reuses D-24827's `implementedRowCount` so one formula governs every scope.
- Legend / headline: an `unmarked` Scheme means "not audited yet" (WP-879 seed), so it counts against the set.
- By mechanic stays hero-only (mechanic tokens and provenance are hero-ledger concepts).
- `Villains & Henchmen` is one scope (the index has no card-type split).

## Files to Produce
- `apps/dashboard/src/composables/useCardCoverage.ts` — **NEW**
- `apps/dashboard/src/composables/useCardCoverage.test.ts` — **NEW**
- `apps/dashboard/src/pages/coverage/CoveragePage.vue`
- `apps/dashboard/src/pages/vision/VisionRoadmapPage.vue`
- `apps/dashboard/src/types/coverage.ts`
- `wiki/dashboard.md`, `wiki/debug-effects.md`, `wiki/card-effect-system.md` (the one-line
  `/coverage` descriptions)
- In `CoveragePage.vue`, also update the stale hero-only copy: the page subtitle, the legend row
  definition, the Rows column definition, the By set note, and the Unmarked definition (add
  "Masterminds/Schemes: not audited").

## After Completing
- [ ] Dashboard typecheck, lint, `test:coverage`, `format:check`, `build` all 0.
- [ ] Local preview: `?set=core` and `?set=ca75` per-type lines per AC-1 / AC-2;
      `?set=anni` Schemes `0/n`; By card Type filter works; no console errors.
- [ ] `git diff --name-only` = allowlist + governance.
- [ ] D-24829 landed Active; one-line D-24827 scope note; WORK_INDEX `[x]`; EC_INDEX `Done`;
      mindmap `✅` + `roadmap:counts:write`; `STATUS.md`.
- [ ] D-24026 live-verify: read the live chunk(s) carrying the new label and the bundled index rows,
      via the CF Access token. The shared chunk's name is not guaranteed.

## Common Failure Smells
- A hero, villain or mastermind figure dropped below its baseline → the formula or the scope
  filter drifted. (A Scheme figure below `n/n` is not this smell.)
- Hero numbers moved → the hero scope is double-counted or filtered differently from the ledger.
- Schemes column empty everywhere → WP-879 not executed / stale `src/data` index.
- `vue-tsc` error on `cardTypeLabel` → a scope added to the enum without a case.
