# WP-880 — `/coverage` Counts Every Card Type in a Set (Dashboard)

**Layer:** App (`apps/dashboard` only) · **Lane:** Standard two-session (more
files than the Lightweight Lane allows; changes a headline metric) ·
**Baseline:** `origin/main` @ `4fd75a15` (re-confirm at execution) ·
**Status:** BLOCKED on **WP-879 execution** (needs `scope: "scheme"` rows in the
index) and on **#3256** merging (it edits the same headline lines) ·
**User-Visible Surface:** dashboard.legendary-arena.com/coverage and `/vision`

## Goal

Make `/coverage` answer "is this set done?" across **every card type the set
has**: Heroes, Villains, Henchmen, Masterminds (Master Strike and Tactics) and
Schemes. Today it counts hero card × mechanic rows only. So Captain America
75th read "100%" while its four Schemes, two Masterminds and two Villain groups
were not in the number. #3256 relabelled the headline "hero cards only" as a
stopgap; this WP removes the need for the label.

## User-Visible Impact

On `/coverage?set=ca75`:

- **Headline:** reads "N% card abilities implemented — Captain America 75th".
- **Per-type line:** under the headline, for example
  "Heroes 25/25 · Villains & Henchmen 14/14 · Masterminds 10/10 · Schemes 14/14". The
  Scheme figure is whatever WP-879 emits and seeds for ca75: 14 rows under its locked map.
  Types the set does not have are omitted.
- **By set table:** shows the all-types Implemented % and a column per card type.
- **By card table:** lists every card ability in the set, with a **Type** column
  and a type filter. Jeff can drill from a Scheme figure below `n/n` straight to
  the rows that aren't done.
- **`/vision`:** the product-content coverage line reads "N% card abilities
  implemented".

## Assumes

- **WP-879 / D-24828 executed** (hard dep). The effect-implementation index
  carries `scope: "scheme"` rows, and `EFFECT_INDEX_ENTRY_SCOPES` is
  `["hero", "villain", "mastermind", "scheme"]`. Without it the Schemes column
  is empty and the headline silently excludes Schemes. **STOP if WP-879 is not
  `[x]`.**
- **#3256 merged or closed.** If merged, the headline ends ", hero cards only"
  with a sub-line naming the excluded types, and this WP replaces both. Either
  way, build on whatever headline `main` carries.
- **WP-484 / D-24289, WP-507 / D-24313, WP-867 / D-24810** (✅): the index joins
  the hero ledger (verbatim), the villain ledger (villains + henchmen), Tactics
  and Master Strikes. For the hero scope, the entries are the hero ledger rows
  one for one (863 = 863 at the baseline).
- **D-24827** (Active): "implemented" = Executable + Condition + Subsystem;
  Deferred, Unsupported and Unmarked are the to-dos. This WP keeps the formula
  and widens the row set. D-24829 records that widening.
- **The dashboard already bundles the index** for `/debug/effects`:
  - `apps/dashboard/src/composables/useEffectIndex.ts` exposes `entries`,
    `summary`, `cards` and `scopeLabel`;
  - the data is `src/data/effect-implementation-index.json` from
    `prebuild:effect-index` (gitignored);
  - `scopeLabel` is a separate export with singular labels ("Hero"). This WP adds
    its own plural `cardTypeLabel` with a local `assertNever`, since the existing
    ones are not exported;
  - `/coverage` today reads `useCoverageLedger.ts` (the hero ledger copy).
- Live-verify join: `useLiveVerify.entryForRow({ extId, mechanic })` keys on
  `${extId}|${mechanic}`. That matches hero and villain index entries, not
  mastermind or scheme ones (their live-verify keys use a different grammar).

## Context (Read First)

**Why.** On 2026-11-10 Jeff asked how Captain America 75th could read 100%
when he had never played Brainwash the Military, Change the Outcome of WWII,
Go Back in Time or the Enigma Code. The answer: those Schemes were never in
the number. He then asked for every card in the set to count, rather than
separate coverage pages per card type. This WP does that on the one page.

**Why the index, not more ledgers.** The index already is the all-card-types
table, with one entry shape and one status vocabulary. WP-879 adds its last
missing type. Reading it on `/coverage` adds no new data pipeline.

**What stays hero-only, and says so.** Three sections are inherently hero-ledger
views:
- the **By mechanic** worklist (mechanic tokens and provenance are hero-ledger
  concepts);
- the **in-play hollows** headline (already labelled "all sets (not
  set-scoped)");
- the Core live-verify section.

They keep their data source. The By mechanic heading gains "— Heroes" so it
can't be read as the whole set.

**What "Schemes 0/15" will mean.** Outside Core and Captain America 75th, Scheme
rows read `unmarked`: not audited, per WP-879. They count as to-dos, which drags
those sets' all-types % down. That is the honest reading ("nobody has shown
these work"), and it is what Jeff asked to see. The legend says so explicitly.

## Scope (In)

- **New `apps/dashboard/src/composables/useCardCoverage.ts`** (pure helpers +
  a composable over `useEffectIndex().entries`):
  - `summarizeEntries(entries)` → a full `LedgerSummary` (`totalRows`,
    `byStatus`, and `distinctMechanics` = the distinct `mechanic` values in the
    selection, **excluding the `(unmarked)` sentinel**, as `summarizeRows` does). That way `implementedRowCount` and `summaryImplementedPercent`
    (D-24827, `useCoverageLedger.ts`) are reused unchanged and type-check.
  - `buildCardTypeBreakdown(entries)` → an ordered list of `{ scope, label,
    implemented, total }`, in `EFFECT_INDEX_ENTRY_SCOPES` order, omitting
    scopes with zero rows.
  - `buildAllTypesSetBreakdown(entries, setNames)` → `AllTypesSetCoverageEntry[]`,
    where each entry is `{ abbr, name, summary: LedgerSummary, percentImplemented,
    byType: CardTypeCoverage[] }`. Same release order as `buildSetBreakdown`.
  - `cardTypeLabel(scope)`: an exhaustive switch returning the plural labels
    `Heroes` / `Villains & Henchmen` / `Masterminds` / `Schemes`.
- **`apps/dashboard/src/composables/useCardCoverage.test.ts`:** NEW.
- **`apps/dashboard/src/pages/coverage/CoveragePage.vue`:**
  - **Headline:** reads `{{ percent }}% card abilities implemented — {{ Set }}`,
    or "— all sets", where `percent = summaryImplementedPercent(summarizeEntries(entriesInSet))`.
    The per-type line replaces the #3256 ", hero cards only" suffix and its
    sub-line. The row-count sub-line becomes "per card × ability row —
    {{ totalRows }} rows · {{ distinctMechanics }} distinct abilities".
  - **Status chips and legend:** recount over all types. The legend states
    the formula, the per-type list, and that an `unmarked` Scheme means "not
    audited yet".
  - **By set:** switches to `buildAllTypesSetBreakdown`. It keeps the Rows
    column and the six status columns, now over all types (D-24827 §2 keeps
    each status shown separately). It also keeps the Implemented % column and
    adds one `implemented/total` column per card type.
  - **Stale copy in the same file** — each of these still describes hero rows only:
    - the page subtitle ("Every hero card × mechanic … Source:
      hero-mechanic-ledger.json");
    - the legend's row definition ("one hero card × one mechanic");
    - the Rows column definition;
    - the By set note ("Every card set with hero ledger rows");
    - the Unmarked definition, which gains "for Masterminds and Schemes: no
      curated provenance yet, i.e. not audited".
  - **Set selector:** lists the sets present in the index, a superset of the
    hero ledger's.
  - **By card:** the row source becomes the index entries:
    - filtering uses `useEffectIndex.filterEntries`, with scope as the Type
      filter plus status, set and search, instead of re-implementing
      `filteredRows`;
    - a **Type** column (`cardTypeLabel`) and type filter buttons sit beside
      the status ones;
    - the status button counts reflect set + type;
    - the empty-filter fallback `watch` re-checks when the type changes.
    Card shows `name`; Design shows `designs` (heroes only, "—" otherwise).
    The live-verify cell keeps `entryForRow`, which matches hero and villain
    entries; mastermind and scheme rows show "—".
  - **By mechanic:** heading gains "— Heroes"; data source unchanged.
- **Index load failure:** `CoveragePage.vue` shows `useEffectIndex().error` in a
  `cov-error` banner ("Effect index failed to load: …") and hides the all-types
  headline and per-type line while it is set. One `useCardCoverage` test injects
  a failing index.
- **`apps/dashboard/src/pages/vision/VisionRoadmapPage.vue`:** drops the coverage
  line when the index errors. Otherwise the coverage line
  reads `${percent}% card abilities implemented · ${unsupported} unsupported`,
  both from all types.
- **`apps/dashboard/src/types/coverage.ts`:** add the `CardTypeCoverage` and
  `AllTypesSetCoverageEntry` types.
- **`wiki/dashboard.md`:** the `/coverage` row and the headline paragraph
  describe all card types and D-24829.
- **`wiki/debug-effects.md`** and **`wiki/card-effect-system.md`:** update their
  one-line `/coverage` descriptions ("the ledger rendered as … by-card index")
  to match.

## Out of Scope

- Any change to the index, the schema, the generator or the overlays (WP-879).
- Auditing or seeding Scheme provenance beyond WP-879's 12 Schemes.
- Joining mastermind or scheme rows to the live-verify record (different key
  grammar; its own follow-up).
- Splitting Villains from Henchmen. The index's `villain` scope holds both and
  has no `cardType` field. A split needs either a schema change or an
  extId-prefix rule (`henchman-`), and is its own follow-up.
- The By mechanic worklist, the in-play hollows headline, and the PAR / Core
  live-verify sections. Their data is unchanged; only the By mechanic heading
  label changes.
- Separate per-type coverage pages.

## Files Expected to Change

| File | Change |
|---|---|
| `apps/dashboard/src/composables/useCardCoverage.ts` | **NEW** — all-types rollups over index entries |
| `apps/dashboard/src/composables/useCardCoverage.test.ts` | **NEW** — summary, breakdown order and omission, set breakdown, label switch, formula reuse |
| `apps/dashboard/src/pages/coverage/CoveragePage.vue` | headline, per-type line, chips, legend, By set, set selector and By card read the index; By mechanic heading "— Heroes" |
| `apps/dashboard/src/pages/vision/VisionRoadmapPage.vue` | coverage line → all types |
| `apps/dashboard/src/types/coverage.ts` | `CardTypeCoverage`, `AllTypesSetCoverageEntry` |
| `wiki/dashboard.md` | `/coverage` description + headline paragraph |
| `wiki/debug-effects.md` | one-line `/coverage` description |
| `wiki/card-effect-system.md` | one-line `/coverage` description |

Governance (not counted): `WORK_INDEX.md`, `EC_INDEX.md`,
`05-ROADMAP-MINDMAP.md`, `DECISIONS.md` (D-24829 lands at execution;
D-24827 gets a one-line "scope widened by D-24829" note), `STATUS.md`.

## Non-Negotiable Constraints

- **One formula.** "Implemented" is `implementedRowCount` from
  `useCoverageLedger.ts` (D-24827), applied to index entries, with no second
  copy. Unmarked, Deferred and Unsupported are to-dos in every scope.
- **Hero numbers do not move.** For the hero scope, the all-types code must
  reproduce the hero-ledger figures exactly. A unit test asserts that
  `summarizeEntries(heroScopeEntries)` deep-equals `summarizeRows(ledgerRows)`
  on a shared fixture that includes an `(unmarked)` hero row. The literal counts (Core 51/51, all sets 546/863 at the
  baseline) go in the execution summary only, never in a test.
- **Exhaustive scope handling.** `cardTypeLabel` is an exhaustive switch with
  `assertNever`; no scope is treated as an open string.
- The dashboard reads the bundled index only. No new data file, no edit to the
  gitignored `src/data/*.json`, no network fetch.
- No engine, registry, generator, server, `G`, persistence or card-data change.
- **Repo-wide standing constraints:** `.claude/rules/code-style.md` (JSDoc,
  full names, `// why:`, functions on one screen); Prettier clean; dashboard
  coverage floors (`test:coverage`) hold.

## Contract

- **Headline:** `percentImplemented(set) = summaryImplementedPercent(summarizeEntries(entriesInSet))`,
  over all scopes. For `set = 'all'`, use every entry. There is no second copy
  of the formula or the rounding.
- **Breakdown order:** `buildCardTypeBreakdown` order = `EFFECT_INDEX_ENTRY_SCOPES`.
  A scope with no rows in the selection is omitted.
- **Labels:** Heroes, Villains & Henchmen, Masterminds, Schemes.

## Vision Alignment

- **§2 Content Authenticity:** shows which printed card text is actually
  honoured, across every card type.
- **§14 Explicit Decisions, No Silent Drift:** a set-completion number that
  states what it counts.

No conflict: this WP preserves all touched clauses. It touches no determinism,
NG-1..8, monetization, PvP or identity surface.

## Funding Surface Gate

N/A.

## API Catalog Update

N/A — dashboard-only, no `apps/server` endpoint.

## Acceptance Criteria

1. `/coverage?set=core`: the per-type line shows Heroes 51/51, Villains &
   Henchmen 36/36, Masterminds 20/20 and Schemes `s/k`.
   - `k` is the number of Core scheme rows WP-879 emits; `s` is how many of
     those it seeded `executable`.
   - The headline reads 100% if and only if WP-879 left no Core line unmarked.
   - A Core figure below 100% because of an unevidenced Scheme line is correct,
     not a defect.
2. `/coverage?set=ca75`: the per-type line shows Heroes 25/25, Villains &
   Henchmen 14/14, Masterminds 10/10 and Schemes `s/k`. Here `k` = 14 under
   WP-879's locked map, and the same 100% rule applies.
3. A set whose Schemes are unaudited (e.g. `anni`) shows Schemes `0/n`, and its
   all-types % is below its hero-only %.
4. Hero-scope parity: `summarizeEntries(heroScopeEntries)` deep-equals
   `summarizeRows(ledgerRows)` on a shared fixture that includes an
   `(unmarked)` hero row.
5. By set lists every set in the index, in release order, with all-types % and
   per-type columns.
6. By card lists scheme, mastermind and villain rows with the right Type, and
   filtering by Type and Status narrows correctly.
7. `/vision` coverage line reads "card abilities implemented".
8. `pnpm --filter @legendary-arena/dashboard` typecheck, lint, `test:coverage`,
   `format:check` and `build` all 0.
9. When the index fails to load, `/coverage` shows a `cov-error` banner and
   hides the all-types headline and per-type line, and `/vision` drops its
   coverage line. Neither shows a silent 0%.

## Verification Steps

1. Rebuild deps first (`pnpm --filter @legendary-arena/registry build`); then
   run the dashboard `build` (writes `src/data`), typecheck, lint,
   `test:coverage` and `format:check`.
2. Local preview: `/coverage?set=core`, `?set=ca75`, `?set=anni` and all sets.
   Read the headline, the per-type line, the By set row and a Type-filtered
   By card table. No console errors.
3. `git diff --name-only` = the allowlist + governance.
4. **D-24026 live-verify (post-deploy):**
   - With the CF Access service token, read the live chunk(s) carrying the new
     label and the bundled index rows. Vite may emit one shared chunk for both
     routes, and its name isn't guaranteed.
   - Confirm the label, and that the bundled ca75 rows tally as in AC-2.
   - `/vision` now also loads the ~1 MB index. Vite only warns on chunk size.

## Definition of Done

- [ ] All Acceptance Criteria met; dashboard gates green.
- [ ] `git diff --name-only` matches the allowlist.
- [ ] D-24829 landed Active; D-24827 noted; WORK_INDEX `[x]`; EC_INDEX `Done`;
      mindmap `📝`→`✅`; `roadmap:counts:check` 0; `STATUS.md` close-out.
- [ ] Two-commit topology (`EC-918:` impl + `SPEC:` close).
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Reserved Decision (lands at execution)

**D-24829** — The `/coverage` headline, status chips, By set table and By card
table count every card type in the effect-implementation index:
- Heroes;
- Villains & Henchmen (one scope);
- Masterminds (Master Strike + Tactics);
- Schemes (WP-879).

They use D-24827's implemented formula unchanged. Per-type figures show beside
the headline. The By mechanic worklist and the in-play headline stay hero-only,
and are labelled so. Chosen over separate per-type coverage pages, so one set
has one completion number. It supersedes the scope (not the formula) of D-24827.

## Lint Gate Self-Review (00.3)

All 21 sections resolved, each PASS or a justified N/A.

| § | Section | Verdict |
|---|---|---|
| 1 | Structure | PASS |
| 2 | Constraints | PASS — one formula, hero parity pinned, exhaustive scope switch |
| 3 | Assumes | PASS — WP-879 hard dep and #3256 sequencing explicit |
| 4 | Context | PASS — Jeff's ask, why the index, what stays hero-only, what unaudited Schemes do to the % |
| 5 | Files | PASS — 8 files: 2 new, 2 one-line wiki edits |
| 6 | Naming | PASS — `useCardCoverage`, `summarizeEntries`, `buildCardTypeBreakdown`, `buildAllTypesSetBreakdown`, `cardTypeLabel` |
| 7 | Dependency Discipline | BLOCKED on WP-879 execution — merges as a `[ ]` placeholder per 01.0a "Blocking drafts" |
| 8 | Boundaries | PASS — dashboard only, reads the bundled index |
| 9 | Windows | N/A |
| 10 | Env | N/A |
| 11 | Auth | N/A |
| 12 | Test Quality | PASS — parity pin plus omission, order and set-breakdown tests |
| 13 | Verification | PASS |
| 14 | AC Quality | PASS — 9 testable ACs |
| 15 | DoD | PASS |
| 16 | Code Style | PASS |
| 17 | Vision | PASS — §2 and §14; no conflict |
| 18 | Prose-vs-Grep | PASS — section headings, composables and the live-verify key grep-verified at `4fd75a15` |
| 19 | Bridge-vs-HEAD | PASS — baseline recorded; #3256 sequencing named |
| 20 | Funding Gate | N/A |
| 21 | API Catalog | N/A |

## Pre-flight (01.4)

**Verdict: READY TO EXECUTE, once its dependencies clear.** It is BLOCKED on
WP-879 execution and on #3256 being resolved, which are known and expected.

- The first pass, 2026-11-10 at baseline `4fd75a15`, found two blocking text
  items. Both were fixed in this draft:
  - **PS-1:** `summarizeEntries` now returns a full `LedgerSummary`, and every
    percent goes through `summaryImplementedPercent`, so there is no second
    formula. The headline sub-line text is locked.
  - **PS-2:** AC-1 and AC-2 no longer promise 100%. Scheme figures read `s/k`
    from what WP-879 seeds, and a sub-100% caused by an unevidenced Scheme line
    is stated to be correct.
- Refinements folded in:
  - RS-1: By set keeps the status columns.
  - RS-2: parity is checked by deep equality on a fixture, with no literal counts.
  - RS-3: the stale copy in `CoveragePage.vue` is enumerated.
  - RS-4: By card reuses `filterEntries`.
  - RS-5: the Assumes text describes the `useEffectIndex` API correctly.
  - RS-6: the shared-chunk live-verify wording, plus the index-size note.
  - RS-7: Vision §2 and §14.
  - RS-8: #3256 may be merged or closed.
  - RS-9: the henchman split wording.
  - RS-10: two wiki one-liners added to the allowlist.
- Confirmed against the index:
  - Hero scope equals the hero ledger exactly: 863 = 863.
  - Today's all-types figures are Core 107/107, ca75 49/49, all sets 849/2193 =
    38.7%, against 63.3% hero-only.

## Copilot Check (01.7)

**Verdict: PASS** after one HOLD round, which made two fixes:
- **F:** `distinctMechanics` excludes the `(unmarked)` sentinel, as
  `summarizeRows` does, and the parity fixture includes an `(unmarked)` hero row.
- **G:** an index load failure shows a `cov-error` banner and hides the
  all-types headline. `/vision` drops its line instead of showing a silent 0%
  (new AC-9).

The cross-WP contract is consistent with WP-879: scope `scheme`, 14 ca75 rows,
and `unmarked` meaning not audited. EC-918 has 62 counted lines (limit 100).
