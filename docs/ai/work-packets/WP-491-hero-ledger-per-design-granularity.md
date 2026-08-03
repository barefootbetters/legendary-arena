# WP-491 — Hero Ledger Design Attribution (which of a hero's cards carries each effect)

**Status:** Draft 2026-08-03 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `dashboard /debug/effects` **and** `dashboard /coverage` (both gain a **Design** column; D-24026 live-verification applies — the packet is not Done until the columns render on the deployed dashboard).
**Primary Layer:** Shared Tooling (the coverage/ledger generator scripts) + Registry (the `EffectImplementationIndexSchema` contract) + App (`apps/dashboard` — both viewers). Cross-surface but one indivisible vertical (see Context).
**Dependencies:** WP-484 / D-24289 (the `effect-implementation-index.json` + `EffectImplementationIndexSchema` this extends); WP-487 / D-24292 (the `/debug/effects` viewer); WP-259 / D-24035 (the `/coverage` viewer + its build-time-bundle copy of the hero ledger); WP-271 (the villain ledger whose per-card granularity motivated this).

---

## Goal

After this session, every hero mechanic ledger row carries an additive **`designs`** attribution — the list of card design(s) (`slug` + display `name`) whose printed ability carries that mechanic — so the generated Effect Implementation Index, the `/debug/effects` viewer, and the `/coverage` viewer can all answer *"which of a hero's ~4 physical card designs carries this effect?"*. Today every design of Black Widow (`core/black-widow`) collapses to one hero key with no way to tell which of the four card designs owns `attack-per-count` vs `defeat-with-bystander` vs `draw` — even though the source card data attributes them cleanly (`mission-accomplished` = `draw` + `rescue`; `dangerous-rescue` = `optional-ko-reward`; `covert-operation` = `attack-per-count`; `silent-sniper` = `defeat-with-bystander`). Villains already answer this (their ledger keys one row per individual card). This WP brings the same visibility to heroes by **adding an attribution field, not by re-partitioning rows**: the ledger keeps exactly one row per `(extId, mechanic)`, so every aggregate (the ledger summary, the `/coverage` metrics, the `card-mechanics.json` glossary feed) stays byte-identical, and each row simply gains the `designs` naming which card(s) it lives on. It authors **no new effect data and adds no second parser** — the design attribution is read verbatim from `registry.listCards()`, which already returns one entry per design.

## User-Visible Impact

An operator on `/debug/effects` or `/coverage` searching a hero (e.g. "Black Widow") sees a new **Design** column that names the specific card design each effect row belongs to — `Mission Accomplished` for the `draw`/`rescue` rows, `Silent Sniper` for `defeat-with-bystander`, and so on. Where one mechanic appears on more than one of a hero's designs (246 such hero×mechanic pairs across the corpus — e.g. `cyber-mod` on three Ghost Rider 2099 designs), the single row lists all of them. Villain rows (whose `extId` already identifies the individual card) show "—". No gameplay, player-facing, or public surface changes — both are internal operator/developer tools behind the existing dashboard auth gate. D-24026 live-verification applies (the columns must render on the deployed dashboard).

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The hero ledger exists and does NOT yet carry a `designs` column. schemaVersion is currently 1.
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); const r=d.rows[0]; if(d.cardType!=='hero'||d.schemaVersion!==1||('designs'in r)) process.exit(1); console.log('A_OK rows='+d.rows.length);"
# Expected: A_OK rows=<n>  (if `designs` already present, this WP already ran — STOP)

# B. The effect index exists and its entries do NOT yet carry `designs`.
node -e "const d=require('./data/metadata/effect-implementation-index.json'); if(d.version!==1||!Array.isArray(d.entries)||d.entries.some(e=>'designs'in e)) process.exit(1); console.log('B_OK entries='+d.entries.length);"
# Expected: B_OK entries=<n>

# C. EffectImplementationIndexSchema is exported from the browser-safe /schema subpath.
node -e "process.exit(require('./packages/registry/package.json').exports['./schema']?0:1)" && echo "C_OK"
# Expected: C_OK

# D. Both viewers are present (the surfaces this WP extends).
test -f apps/dashboard/src/pages/debug/EffectsPage.vue && test -f apps/dashboard/src/pages/coverage/CoveragePage.vue && test -f apps/dashboard/src/types/coverage.ts && echo "D_OK"
# Expected: D_OK

# E. The villain ledger already carries per-card granularity (the parity reference).
node -e "const d=require('./docs/ai/coverage/villain-mechanic-ledger.json'); if(d.cardType!=='villain'||!('cardName'in d.rows[0])) process.exit(1); console.log('E_OK');"
# Expected: E_OK

# F. registry listCards() surfaces per-design name + slug for a hero (the data the fix reads). REQUIRES pnpm -r build.
node --input-type=module -e "import {createRegistryFromLocalFiles} from './packages/registry/dist/index.js'; const r=await createRegistryFromLocalFiles({metadataDir:'./data/metadata',cardsDir:'./data/cards'}); const s=r.listCards().filter(c=>c.cardType==='hero'&&c.extId==='core/black-widow').map(c=>c.slug); if(new Set(s).size<4||!s.includes('silent-sniper')) process.exit(1); console.log('F_OK designs='+s.join(','));"
# Expected: F_OK designs=... (four distinct design slugs incl. silent-sniper)

# G. Governance + data-requirements docs exist.
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && test -f docs/ai/REFERENCE/00.2-data-requirements.md && echo "G_OK"
# Expected: G_OK
```

If A or B fails the assumed baseline is wrong — STOP and reconcile before editing. F requires the registry `dist` built (`pnpm -r build`).

---

## Context (Read First)

- **The design attribution exists in the input and is thrown away at one line.** `scripts/hero-mechanic-ledger.mjs` → `buildLedger()` merges every hero card design's `abilities` into a single array keyed only by `card.extId`, then `extractMechanics()` flattens the merged set. `registry.listCards()` returns one entry **per design** (each with its own `slug`, `name`, `abilities` — `packages/registry/src/shared.ts` hero loop). This WP builds a per-`(extId, mechanic)` → **designs** map from the per-design entries, then attaches the `designs` list to the row the generator already emits.
- **Additive attribution, NOT a row re-partition — this is the load-bearing design choice.** The ledger keeps **one row per `(extId, mechanic)`**; it does NOT emit one row per design. That matters because the hero ledger feeds **three** consumers, and re-partitioning rows would corrupt all three:
  - `data/metadata/card-mechanics.json` (via `scripts/build-card-mechanics-metadata.mjs` → registry-viewer glossary, D-24046) — reads rows into `(slug, extId)` Sets; unchanged row identity → **byte-identical**.
  - `/coverage` (via `apps/dashboard/scripts/build-coverage-ledger.mjs` → `useCoverageLedger.ts` → `CoveragePage.vue`) — its `buildMechanicDictionary` counts **rows** per mechanic and `executablePercent` divides by `summary.totalRows`; unchanged row identity → **every metric unchanged**, and its by-card table row key `${extId}-${mechanic}` stays unique → **no duplicate-key bug**.
  - The effect index (`build-effect-implementation-index.mjs`) — one entry per ledger row; unchanged row identity → summary/join unchanged.
  A per-design-row approach would have created **246** duplicate `(extId, mechanic)` rows (mechanics that appear on 2+ designs of one hero — e.g. `cyber-mod` on three Ghost Rider 2099 designs), producing duplicate Vue keys in **both** viewers and inflating the `/coverage` mechanic counts. The `designs`-list approach collapses those into one row that lists every carrying design — strictly cleaner.
- **The source data attributes cleanly (no card-data edit).** In `data/cards/core.json` each hero's `cards[]` holds the designs with the `[keyword:X]` markers on their own ability lines (verified for Black Widow). The attribution is read from `listCards()`; no `data/cards/**` or marker change.
- **Unmarked stays hero-level (operator ruling 2026-08-03).** A `(unmarked)` row is emitted only when a hero has zero markers across all designs (the existing 46-hero behavior); it is hero-level, so its `designs` is the empty list `[]`. This deliberately does NOT introduce per-design unmarked rows — doing so would grow the registry-viewer glossary's `unmarked` bucket from 46 to ~231 cards (185 heroes mix a marked design with a text-but-unmarked design), a downstream feed semantic shift the operator declined. Marked mechanics get the `designs` attribution; unmarked stays exactly as today.
- **The index self-validates against a `.strict()` schema.** `scripts/build-effect-implementation-index.mjs` calls `EffectImplementationIndexSchema.safeParse` on its own output, so the new `designs` field MUST be added to `EffectImplementationEntrySchema` in the same change as the generator, or the regenerated index fails its own self-validation. Schema + generator ship together.
- **The index invariants are untouched.** Rows stay one per `(extId, mechanic)`, so `superRefine` (entry↔`cards{}` join by `(extId, mechanic)`, summary recompute) is unaffected — `designs` is a per-entry attribute the join never reads. `cards{}`, `summary`, and the top-level `version: z.literal(1)` are unchanged.
- **`designs` is an array (247+ cases need it).** 246 hero×mechanic pairs carry a mechanic on 2+ designs, so a single-design field would be lossy. Each row's `designs` is a slug-sorted array of `{ slug, name }`.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the registry schema is a data-only zod contract (`/schema` subpath, no engine import); the dashboard consumes it downward (App→Registry); the ledger/index generators are build-time tooling reading registry+engine `dist` one-way. No layer edge is reversed.
- **Why one WP, not a data-then-viewer split:** the operator's question is only answered when the design reaches the screen (they named both `/debug/effects` and `/coverage`). The ledger column, the index field, and the two viewer columns are one indivisible deliverable; per the §5 file-count guidance the bundle is justified inline. Determinism-neutral (build-time generated artifacts only).

---

## Scope (In)

- **Modify `scripts/hero-mechanic-ledger.mjs`** — build, per hero, a map from each normalized mechanic to the **sorted set of design `{slug, name}`** whose abilities carry that mechanic's marker (iterate the hero's per-design `listCards()` entries; reuse the existing `normalizeMechanicToken`/`reduceParameterizedKeyword`/`foldMechanicFamily` pipeline per design so a design's mechanics classify identically to today's merged set). Keep the row set **one per `(extId, mechanic)`** exactly as today; add a **`designs`** array field to each row (`[]` for the hero-level `(unmarked)` row). Keep composition-marker status classified by the hero-deck's `buildHeroAbilityHooks` `resolvedMarkers` (per-deck, unchanged). Sort each row's `designs` by slug for byte-stability; the existing row sort is unchanged. Add a `designs` column to the CSV (pipe-joined design slugs; empty for unmarked). Bump `SCHEMA_VERSION` `1 → 2` (the row shape gained a column).
- **Regenerate `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv`** via `pnpm ledger:heroes`; commit them. `pnpm ledger:heroes:check` must pass. The row **count** is unchanged; only the new `designs` column is added.
- **Modify `packages/registry/src/schema.ts`** — add `EffectDesignSchema = z.object({ slug: z.string().min(1), name: z.string().min(1) }).strict()` and an **optional** `designs: z.array(EffectDesignSchema).min(1).optional()` field on `EffectImplementationEntrySchema` (present ⇒ non-empty); export the inferred `EffectDesign` type. Additive/backward-compatible: an index without `designs` still validates (villain + unmarked-hero entries omit it). No change to `EffectImplementationCardEntrySchema`, `summary`, or `version: z.literal(1)`.
- **Modify `packages/registry/src/schema.effectImplementationIndex.test.ts`** — add cases: an entry WITH a valid non-empty `designs` passes; an entry WITHOUT `designs` still passes; a `designs` that is empty `[]`, or whose element is missing `slug`/`name` or carries an extra key, is rejected.
- **Modify `scripts/build-effect-implementation-index.mjs`** — in `normalizeRow`, when `scope === 'hero'` and the row's `designs` is non-empty, set `designs: row.designs` (verbatim); villain and unmarked-hero rows omit it. No sort-key change (rows stay one per `(extId, mechanic)`).
- **Regenerate `data/metadata/effect-implementation-index.json`** via `pnpm effect-index`; commit it. `pnpm effect-index:check` must pass; the file self-validates against the schema.
- **Modify `apps/dashboard/src/pages/debug/EffectsPage.vue`** — add a **Design** column (header + cell) after the Card column, rendering the entry's `designs` joined by name (`"—"` when absent — villains + unmarked hero rows). The row `:key` is unchanged (rows are unique per `(extId, mechanic)`).
- **Modify `apps/dashboard/src/composables/useEffectIndex.ts`** — include the design names in the free-text search haystack so an operator can search by design; no other behavior change (the `designs` field flows through the entry type automatically).
- **Modify `apps/dashboard/src/composables/useEffectIndex.test.ts`** — add assertions: a hero fixture entry carries `designs` with `slug`/`name`; a villain fixture entry omits it; the search filter matches a design name.
- **Modify `apps/dashboard/src/types/coverage.ts`** — add an optional `designs?: { slug: string; name: string }[]` to `LedgerRow` (the copied hero-ledger row now carries it).
- **Modify `apps/dashboard/src/pages/coverage/CoveragePage.vue`** — add a **Design** column (header + cell) after the Card column in the by-card table, rendering `row.designs` joined by name (`"—"` when empty). The row `:key` is unchanged. No metric/summary/worklist change (row identity is unchanged).
- **Reserve and land D-24297** (the design-attribution contract lock).

## Out of Scope

- **Re-partitioning the ledger to one row per design** — explicitly NOT done; the row set stays one per `(extId, mechanic)` so the ledger summary, `/coverage` metrics, and `card-mechanics.json` all stay byte-identical. `designs` is an additive attribution field.
- **Per-design `(unmarked)` rows** — unmarked stays hero-level (operator ruling); no new `(extId, unmarked)` pairs, so the registry-viewer glossary's `unmarked` bucket is unchanged (stays 46).
- **`card-mechanics.json` / `build-card-mechanics-metadata.mjs`** — not modified; its Set-based read ignores the new `designs` column, so its output is byte-identical (this WP only *confirms* its `:check` stays green after regen).
- **The villain ledger / villain effect data** — unchanged; villains already carry per-card granularity, so villain index entries omit `designs`.
- **Re-keying the hero `extId`** — the hero `extId` stays `core/black-widow` (the loadout/composition id + `cards{}` join key). `designs` is an additive field, never a replacement id.
- **`/coverage` metrics, worklist, and summary** — the by-mechanic dictionary (`buildMechanicDictionary`), `executablePercent`, and `summary` are unchanged (row identity is unchanged); only an additive Design column is added to the by-card table.
- **Card data / markers / the engine / server / arena-client / registry-viewer** — no `data/cards/**`, `scripts/convert-cards/**`, marker-apply pass, `packages/game-engine`, `apps/server`, `apps/arena-client`, or `apps/registry-viewer` file. No `G`/`ctx`/RNG/replay/scoring/persistence surface.
- **`cards{}` per-design grouping / new filters / descriptor-level drill-down** — the index `cards{}` stays a per-`extId` summary; no new filter control, no per-ability-line granularity.

---

## Files Expected to Change

- `scripts/hero-mechanic-ledger.mjs` — **modified** (per-mechanic→designs map; additive `designs` row column; CSV column; `SCHEMA_VERSION` 1→2; row count unchanged)
- `docs/ai/coverage/hero-mechanic-ledger.json` + `.csv` — **regenerated** (`pnpm ledger:heroes`)
- `packages/registry/src/schema.ts` — **modified** (`EffectDesignSchema` + optional `designs` on the entry + inferred type)
- `packages/registry/src/schema.effectImplementationIndex.test.ts` — **modified** (designs accept/reject/absent cases)
- `scripts/build-effect-implementation-index.mjs` — **modified** (pass `designs` through for hero entries; villain/unmarked omit)
- `data/metadata/effect-implementation-index.json` — **regenerated** (`pnpm effect-index`)
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **modified** (Design column; row key unchanged)
- `apps/dashboard/src/composables/useEffectIndex.ts` — **modified** (design names in search haystack)
- `apps/dashboard/src/composables/useEffectIndex.test.ts` — **modified** (designs assertions)
- `apps/dashboard/src/types/coverage.ts` — **modified** (`LedgerRow.designs?`)
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` — **modified** (Design column; row key unchanged)
- `docs/ai/DECISIONS.md` — **modified** (land D-24297)
- `docs/ai/STATUS.md` — **modified** (Done entry)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip the WP-491 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

**Not committed (gitignored build outputs, rebuilt by the dashboard build):** `apps/dashboard/src/data/effect-implementation-index.json` (WP-487 copy) and `apps/dashboard/src/data/coverage-ledger.json` (WP-259 copy) — both carry `designs` automatically via their generic byte-copy scripts; no copy-script or `.gitignore` change.

11 source/artifact files (2 scripts + 1 registry schema + 1 schema test + 5 dashboard files) + 3 regenerated artifacts (hero ledger json/csv + the index) + 5 governance. The ledger attribution column, the schema field, the index pass-through, and the two viewer columns are one indivisible deliverable — an attribution field neither viewer shows answers nothing, and a viewer column with no `designs` in its feed has nothing to read — so the bundle is justified inline per the §5 file-count guidance. Cross-surface (Shared-Tooling scripts + Registry schema + App); standard two-session lane (schema-contract change + two regenerated CI-gated artifacts + >4 files — NOT lightweight-lane eligible).

---

## Contract (Locked by D-24297)

What D-24297 locks:

- **Ledger row identity is unchanged; `designs` is additive.** The hero mechanic ledger keeps **one row per `(extId, mechanic)`**. Each row gains a **`designs`** array — the slug-sorted `{slug, name}` of the design(s) whose abilities carry that mechanic — `[]` for the hero-level `(unmarked)` row. `SCHEMA_VERSION` is 2. `extId` stays the hero composition id; `heroName` stays the hero group name; unmarked stays hero-level.
- **Index `designs` field:** `EffectImplementationEntrySchema` gains an **optional** `designs: EffectDesign[]` (`.min(1)` when present; `EffectDesign = {slug, name}`, both `.min(1)`, `.strict()`). Populated for **hero-scope** entries whose ledger row has ≥1 design; **omitted** for villain-scope entries and hero `(unmarked)` rows. No `cards{}`, `summary`, or top-level `version` change (`version` stays `1`).
- **Aggregate preservation:** because row identity is unchanged, the ledger `summary`, the `/coverage` metrics (`buildMechanicDictionary` counts, `executablePercent`, `summary`), and `card-mechanics.json` are all byte-identical after regeneration. This is a hard invariant, verified by AC.
- **Read-only / no new data:** every `designs` value is read verbatim from `registry.listCards()` design entries; no `status`/`handler`/`wp`/`decision`/design value is authored, inferred, or fabricated; no second parser; no card-data edit.
- **Viewers:** `/debug/effects` and `/coverage` each render a **Design** column showing the row's `designs` joined by name (blank/absent → `"—"`). Row keys are unchanged (rows remain unique per `(extId, mechanic)`). The design names are searchable on `/debug/effects`.

### Determinism / persistence

N/A to gameplay. The ledger, the index, and both viewers touch no `G`/`ctx`/RNG/replay/scoring/persistence surface. The ledger and index are deterministic build-time artifacts (byte-stable given the in-repo card data; the `designs` array is slug-sorted). No `finalStateHash` / `PRE_WP080_HASH` re-pin.

### Code-style / output discipline

Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names, `for...of` over branching `.reduce()`, `// why:` comments where required (see the EC), full-sentence error messages. ESM only, Node v22+; the scripts are `.mjs` with `node:`-prefixed built-in imports. The session output emits **full file contents** for every modified script/schema/vue/test file (the regenerated JSON/CSV artifacts are generator output, not hand-authored).

---

## Acceptance Criteria

1. `pnpm ledger:heroes` regenerates `hero-mechanic-ledger.{json,csv}` with `schemaVersion: 2`; every row carries a `designs` array (slug-sorted); the **row count is unchanged** from the pre-WP ledger (one row per `(extId, mechanic)`); `pnpm ledger:heroes:check` exits 0 and a second run is byte-stable.
2. Black Widow (`core/black-widow`) rows carry the correct designs: `draw` + `rescue` → `[mission-accomplished]`; `optional-ko-reward` → `[dangerous-rescue]`; `attack-per-count` → `[covert-operation]`; `defeat-with-bystander` → `[silent-sniper]` (verified by a grep/query of the regenerated ledger). A multi-design case (e.g. `2099/ghost-rider-2099` `cyber-mod`) lists all carrying designs in one row, each design **exactly once** even when the mechanic is printed on more than one ability line of that design — e.g. `cyber-specter` prints `[keyword:Cyber-Mod]` twice yet appears once in the row's `designs` (deduped by slug; reusing the per-design `extractMechanics()` Set achieves this).
3. The hero-level `(unmarked)` row is unchanged in count (still fired only when a hero has zero markers across all designs) and carries `designs: []`; the ledger `summary` block is byte-identical to the pre-WP ledger.
4. `EffectImplementationEntrySchema` accepts an entry with a valid non-empty `designs`, accepts an entry with no `designs`, and rejects an empty `designs: []` / a `designs` element missing `slug`/`name` / an element with an extra key; `pnpm --filter @legendary-arena/registry test` exits 0.
5. `pnpm effect-index` regenerates `data/metadata/effect-implementation-index.json` with `version: 1`; hero entries whose ledger row has ≥1 design carry `designs`, villain entries and hero `(unmarked)` entries omit it; `pnpm effect-index:check` exits 0 and the index self-validates.
6. The index `superRefine` invariants hold on the regenerated file (`summary.totalEntries` = `entries.length`; `byScope`/`byStatus` tallies match; entry↔`cards{}` join holds) — all unchanged because row identity is unchanged.
7. `card-mechanics.json` is **byte-identical** after `node scripts/build-card-mechanics-metadata.mjs` (`git diff --exit-code` = 0); its `:check` exits 0.
8. `/debug/effects` renders a **Design** column: hero rows show the design name(s) (e.g. "Silent Sniper"), villain + unmarked-hero rows show `"—"`; the design name is matched by the search box; no Vue duplicate-key warning appears.
9. `/coverage` renders a **Design** column in the by-card table (hero design name(s), else `"—"`); its headline metrics, by-mechanic worklist, and `summary` are **unchanged** (row identity unchanged); no Vue duplicate-key warning.
10. `pnpm --filter @legendary-arena/dashboard test` + `build` exit 0 and the dashboard coverage thresholds still hold; `useEffectIndex.test.ts` asserts a hero entry carries `designs` and a villain entry omits it.
11. `pnpm -r build` and `pnpm -r --no-bail test` exit 0; no `packages/game-engine`, `apps/server`, `apps/arena-client`, or `apps/registry-viewer` file is modified, `docs/ai/coverage/villain-mechanic-ledger.json` is unchanged, and no `finalStateHash` / `PRE_WP080_HASH` re-pin occurs (replay/sentinel suites green with no oracle edit).

---

## Verification Steps

```bash
# 0. Build first (the ledger generator imports registry + engine dist)
pnpm -r build

# 1. Regenerate the hero ledger; row COUNT unchanged, designs added (AC-1)
node -e "global.__pre=require('./docs/ai/coverage/hero-mechanic-ledger.json').rows.length; console.log('pre rows='+global.__pre);"
pnpm ledger:heroes && pnpm ledger:heroes:check
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); console.log('post rows='+d.rows.length+' schemaVersion='+d.schemaVersion+' hasDesigns='+('designs'in d.rows[0]));"
# Expected: post rows == pre rows; schemaVersion=2; hasDesigns=true; :check exit 0

# 2. Black Widow attribution (AC-2)
node -e "const d=require('./docs/ai/coverage/hero-mechanic-ledger.json'); for(const r of d.rows.filter(r=>r.extId==='core/black-widow')) console.log(r.mechanic,'->',(r.designs||[]).map(x=>x.slug).join(','));"
# Expected: draw->mission-accomplished, rescue->mission-accomplished, optional-ko-reward->dangerous-rescue,
#           attack-per-count->covert-operation, defeat-with-bystander->silent-sniper

# 3. Summary byte-identical (AC-3) — compare summary block pre/post on a clean checkout diff
git diff docs/ai/coverage/hero-mechanic-ledger.json | grep -E '^[-+].*"totalRows"|"byStatus"' ; echo "summary drift above (expect none)"

# 4. Registry schema tests (AC-4)
pnpm --filter @legendary-arena/registry test 2>&1 | tail -5

# 5. Regenerate index + gate + designs presence (AC-5/6)
pnpm effect-index && pnpm effect-index:check
node -e "const d=require('./data/metadata/effect-implementation-index.json'); const h=d.entries.filter(e=>e.scope==='hero'&&e.designs); const v=d.entries.filter(e=>e.scope==='villain'); if(v.some(e=>'designs'in e)) process.exit(1); if(h.some(e=>!Array.isArray(e.designs)||e.designs.length===0||e.designs.some(x=>!x.slug||!x.name))) process.exit(1); console.log('index OK hero-with-designs='+h.length+' villain='+v.length);"

# 6. card-mechanics.json byte-identical (AC-7)
node scripts/build-card-mechanics-metadata.mjs && git diff --exit-code data/metadata/card-mechanics.json ; echo "card-mechanics unchanged (expect 0)"

# 7. Dashboard build/test/coverage (AC-10)
pnpm --filter @legendary-arena/dashboard test 2>&1 | tail -5
pnpm --filter @legendary-arena/dashboard build 2>&1 | tail -3

# 8. No out-of-scope file touched (AC-11)
git diff --name-only | grep -E '^(packages/game-engine|apps/(server|arena-client|registry-viewer))/|villain-mechanic-ledger' ; echo "hits above (expect none)"

# 9. Full build/test + no re-pin (AC-11)
pnpm -r build && pnpm -r --no-bail test
# Expected: both exit 0; replay/sentinel suites green with no oracle edit

# 10. Live render (post-deploy; D-24026): load the deployed dashboard /debug/effects AND /coverage,
#     search "Black Widow", confirm the Design column names the four designs on both pages and
#     villain rows show "—", with no duplicate-key console warning.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All preconditions (A–G) passed before the edit
- [ ] All 11 Acceptance Criteria pass
- [ ] All 10 Verification Steps produce the expected output (Step 10 is the post-deploy live check)
- [ ] The hero ledger carries `designs` (`schemaVersion: 2`) with the **row count and summary unchanged**; Black Widow's four designs are correctly attributed
- [ ] `EffectImplementationEntrySchema` carries the optional `designs`; the index populates it for marked hero entries and omits it for villain + unmarked entries; both freshness gates green
- [ ] `card-mechanics.json` + `villain-mechanic-ledger.json` are byte-identical; `/coverage` metrics unchanged; no engine/server/arena-client/registry-viewer file modified
- [ ] `/debug/effects` **and** `/coverage` show the Design column (hero design name(s), else `"—"`) with no duplicate-key warning; dashboard build/test/coverage green
- [ ] No `finalStateHash` / `PRE_WP080_HASH` re-pin (replay/sentinel suites green with no oracle edit)
- [ ] `docs/ai/STATUS.md` Done entry names WP-491 + both Design columns, records the D-24026 live-verify as operator-pending (`User-Visible Surface = dashboard /debug/effects + /coverage`)
- [ ] `docs/ai/DECISIONS.md` D-24297 landed (design-attribution contract); Status flips to Active
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-491 node flipped `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-526:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: both Design columns confirmed rendering on the deployed dashboard (operator-pending; the packet is not user-Done until this passes)

---

## Gate Verdicts (drafting session)

The first-round gates ran against an earlier per-design-**rows** draft and surfaced two real defects (both verified empirically): (1) the `/coverage` consumer was wrongly scoped out, with the identical duplicate-key bug the WP fixed for `/debug/effects` and headline metrics that shift with row growth; (2) `card-mechanics.json` was NOT actually unchanged, because per-design `(unmarked)` rows would inject new `(extId, unmarked)` pairs from 185 mixed heroes, growing the registry-viewer glossary bucket 46→~231. The WP was redesigned to **Approach Q** — keep one row per `(extId, mechanic)` and add an additive `designs` attribution array — which keeps row identity (and therefore every aggregate) byte-identical and dissolves both defects. All three gates were then re-run independently against the revision.

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-03, re-run)

All preconditions A–G verified empirically against the built repo. The crux — "row identity unchanged → aggregates byte-identical" — was confirmed against the actual consumer code: `build-card-mechanics-metadata.mjs` reads rows into `(slug, extId)` Sets (ignores `designs`) → `card-mechanics.json` byte-identical; `useCoverageLedger.buildMechanicDictionary` counts by `row.mechanic` and `executablePercent` divides by `summary.totalRows` → `/coverage` metrics unchanged; both viewers' row keys stay unique per `(extId, mechanic)` → no duplicate-key regression. The schema addition is additive/`.strict()`-safe (`superRefine` never reads `designs`); no consumer gates on `schemaVersion`; no missed hero-ledger consumer (`runtime-observed-hollows.mjs` never reads it; `check-generated-data.mjs` checks existence only). Two RS execution-ordering constraints (already locked in the EC): **RS-1** — after editing `schema.ts`, rebuild the registry dist BEFORE `pnpm effect-index` (the generator self-validates against the dist); **RS-2** — the per-`(extId, mechanic)`→designs map must apply the full `normalizeMechanicToken → reduceParameterizedKeyword → foldMechanicFamily` pipeline per design (raw parameterized tokens like `optional-ko-reward:rescue` must reduce to the committed row key `optional-ko-reward`, else attribution is empty). Empirical Scaffold N/A (an optional key added to a strict schema loosens, never newly-rejects; the schema-test reject cases are fresh fixtures). Mutation Boundary N/A (no `G`/move mutation).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-03, re-run; prior BLOCK dissolved)

The revision genuinely resolves the prior BLOCK — the `card-mechanics.json`-byte-identical and `/coverage`-metrics-unchanged claims are now TRUE (verified against the consumer code, not asserted). `designs`-as-array is correct and necessary (246 hero×mechanic pairs carry a mechanic on 2+ designs — e.g. `cyber-mod` on three Ghost Rider 2099 designs); the contract is additive/`.strict()`-safe and `exactOptionalPropertyTypes`-clean (omit-for-villain/unmarked, never `undefined`); determinism/layer/no-re-pin all hold; the allowlist is closed and complete (incl. `/coverage`); the EC "Common Failure Smells" now point at the right invariant. One scope-neutral HOLD (finding 7) — pin the within-design dedup so a design that prints a mechanic on 2+ lines appears once — was applied in-place (AC-2 + EC Locked Values / failure smell; the per-design `extractMechanics()` Set already dedups). No fabrication: every `designs` value is a verbatim registry `slug`/`name` pass-through.

### Lint Gate (`00.3`) — verdict: **SATISFIED (21/21)** (2026-08-03, re-run)

18 PASS, 3 N/A (§10 env, §11 auth, §19 bridge-vs-HEAD — correctly declared). Both prior FAILs resolved: the header no longer pre-claims a passing verdict, and §4 carries the 00.2 disposition below. §5 Files Expected to Change cross-checks identically against the EC Files to Produce (11 source/artifact + 5 governance, incl. `CoveragePage.vue` + `types/coverage.ts`). All named symbols verified real in the repo; the new `EffectDesignSchema`/`designs`/`EffectDesign` correctly absent (no fabrication). Non-blocking observations (operator's call, not fixes): the `## Contract` heading serves the §2 Non-Negotiable-Constraints role per the WP-485..490 house convention; the `bash` verification blocks use repo-standard Git-Bash idioms.

## Lint Gate Self-Review

All 21 sections resolved (18 PASS / 3 N/A) per the re-run above.

- **§4 00.2 disposition:** **N/A — derived-artifact schema; `designs.{slug,name}` pass the registry card `slug`/`name` through verbatim; introduces no card-data or match-setup field.** `docs/ai/REFERENCE/00.2-data-requirements.md` is cited in precondition G and here for this disposition.
- **§10 (env vars):** N/A — build-time generation + static bundles; no env var introduced.
- **§11 (auth):** N/A — both viewers inherit the existing `AppLayout` auth gate; no new role/meta.
- **§19 (bridge-vs-HEAD):** N/A for lint — commit-time discipline (the STATUS entry is authored at execution against live HEAD).
- **§17 / §20 / §21:** present and resolved in their dedicated sections below.
- All remaining sections (§1–§3, §5–§9, §12–§16, §18) PASS as detailed in the Gate Verdicts.

## Vision Alignment

**Vision clauses touched:** §10 (card data / effect semantics — the ledger is a derived, read-only artifact gaining an attribution column; no card semantics change), §22 (determinism — build-time generated artifacts + a data-only schema field + two dashboard columns; no `G`/RNG/replay surface).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` It adds a verbatim attribution field to a derived artifact and surfaces it in operator-only views — it changes no card semantics, adds no gameplay behavior, authors no new effect data, and (by keeping row identity unchanged) alters no existing aggregate.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed — the ledger + viewers are internal developer/operator debugging surfaces carrying no monetization, persuasion, pay-to-win, or competitive-integrity surface.

**Determinism preservation:** replay-irrelevant — the ledger and index are deterministic build-time artifacts (byte-stable given the in-repo card data; `designs` slug-sorted), and the viewers read static bundles; no `G`/`ctx`/RNG/scoring/replay surface is touched, so no hash oracle moves.

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger: no navigation/registry-viewer funding affordance, no profile/account funding attribution, no tournament-funding integration, no user-visible funding copy. Internal operator-dashboard debugging tooling only. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. The change is build-time generator + data-only schema field + two dashboard columns reading build-time bundles; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
