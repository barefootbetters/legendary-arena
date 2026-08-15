# WP-551 — Loadout Import Format Sniff

**Status:** Draft 2026-08-15
**Layer:** App (`apps/registry-viewer`) — single layer
**Depends on:** WP-291 / EC-323 / D-24075 (the LAGN importer) · WP-454 (the
Gauntlet Pack importer) · WP-245 / EC-276 (the MATCH-SETUP `Load JSON` box this
sits beside)
**Reserves:** EC-586 · D-24360
**Baseline:** `origin/main` @ `db3100e9460461497d69a12bb4d27f6c2963b37f`
**Lane:** Standard two-session (app-layer only; 3 code/test files).

---

## 1. Goal

When an operator pastes a file into the wrong one of the Loadout tab's three
adjacent JSON import boxes, tell them **which box it belongs in** — one
sentence — instead of dumping the wrong validator's field-level schema errors.

## 2. Assumes

- The Loadout tab has **three** import boxes, all taking JSON, stacked
  adjacently in `LoadoutBuilder.vue`:
  `📥 Load JSON` (MATCH-SETUP, `loadFromJson`, `onPasteImport` at `:710`),
  `📥 Load LAGN` (`parseLagnLoadout`, `applyLagnImport` at `:757`), and
  `📥 Load Gauntlet Pack` (`parseGauntletPack`, `applyGauntletPackImport` at
  `:899`) — DOM order top-to-bottom is JSON (`:1586`) / LAGN (`:1614`) / Pack
  (`:1641`). Their error sinks differ in SHAPE: `importErrors` is
  `Array<{field, message}>`, `lagnImportErrors` is `string[]`, and
  `gauntletPackError` is a single `string | null`.
- The three formats carry **mutually exclusive top-level discriminator pairs**,
  verified against the real schemas (not the importers' prose):
  MATCH-SETUP (`docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json`) requires
  `schemaVersion` + `composition` and is `additionalProperties: false`;
  a Gauntlet Pack (`packages/registry/src/gauntletPack.ts:97-102`) is
  `z.object({ pack_version, gauntlet }).strict()` — exactly two top-level keys;
  LAGN (`packages/lagn-spec/schemas/lagn-v1.json`) requires `lagn_version` +
  `setup` and declares no `composition`. **`setup` is truly absent from
  MATCH-SETUP** — its envelope field is `setupId`, not `setup`.
- **Near-miss that justifies pair-matching:** `schemaVersion` is ALSO used by
  `packages/registry/src/gauntletConfigs.ts:183` for a *different* artifact (a
  gauntlet **config**, not a pack). Single-key detection would misfire on it;
  requiring both keys of a pair does not.
- **One caveat:** LAGN is `additionalProperties: true`, so a third-party file
  could legally carry a second format's pair as well. Nothing this system
  produces does (the viewer's own exporter emits exactly its seven declared
  keys), but the contract locks a multi-match rule anyway — see §7.
- Each importer's current rejection behaviour is **correct** — the WP does not
  weaken any validation, only adds a pre-check that produces a better message.
- **Sequencing with WP-552.** Both were drafted in one SPEC PR and both touch
  `apps/registry-viewer`. Their **code files are disjoint** (`LoadoutBuilder.vue` + a new `lib/` helper vs
  `vite.config.ts` / `App.vue` / new `lib/` + `composables/` + `components/` files), so they may execute in either order — but they share five
  governance files (`DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`,
  `05-ROADMAP-MINDMAP.md`) and both run `pnpm roadmap:counts:write`. Execute
  **sequentially**; the second to land rebases onto the first, re-anchors its
  `DECISIONS.md` append on the newly-landed prior entry, and re-runs
  `roadmap:counts:write` (a stale derived count reddens the Dashboard gate and
  reads like an unrelated coverage failure).

## 3. Context

Observed live 2026-08-15, during the WP-549 verification. A LAGN file pasted
into `Load JSON` produced **nine** errors, ending:

> `root: The match setup document contains unknown field(s) (lagn_version,
> $schema, game_id, variant, player_count, setup, result) inside root that the
> schema does not permit.`

Every one of those lines is *correct* — it is the MATCH-SETUP validator
faithfully rejecting a non-MATCH-SETUP document. But none of it says the one
thing the operator needs: *use the box below*. The operator who hit it built
the application; a first-time user has no chance.

The information needed is already sitting in the error itself (`lagn_version`
appears in the "unknown fields" list), so the fix is not new knowledge — it is
surfacing what the validator already knows, before the dump.

**Why advisory, not auto-routing.** The obvious-seeming fix — detect the format
and just load it into the right importer — is deliberately **rejected**.
Silently loading a document into a box the operator did not choose is a worse
surprise than an error, especially since all three importers **replace** the
draft. A wrong-format paste is often a wrong-*file* paste; auto-loading it would
destroy the draft the operator was building. The sniff therefore only ever
changes the *message*.

**Single WP.** One helper, three call sites, one app. Splitting it per-box would
leave `main` with inconsistent messaging across three adjacent controls.

## 4. Scope (In)

- A new **pure** format-sniff helper reading the three top-level discriminators.
- Each of the three import handlers consults it **before** surfacing validator
  errors; on a foreign-but-recognized shape it emits one redirect sentence
  naming the correct box, in place of the field-level dump.
- Tests covering all six wrong-box permutations plus the unchanged paths.

## 5. Scope (Out)

- **No auto-routing and no auto-loading** — see §3. The sniff is advisory.
- **No change to any validator or its error text.** An unrecognized or malformed
  shape falls through to the existing errors **byte-identically**; no rejection
  path is weakened, and no previously-rejected document becomes accepted.
- No engine, server, registry, or `packages/lagn-spec` change.
- **Not** merging the three boxes into one auto-detecting importer. That is a
  larger UX question (it would change what "replace the draft" means per box)
  and is deliberately deferred.
- No change to the file-upload paths' accept filters.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `apps/registry-viewer/src/lib/loadoutImportFormat.ts` | **new** — the pure sniff + the redirect sentences |
| `apps/registry-viewer/src/lib/loadoutImportFormat.test.ts` | **new** — discriminator truth table, all six permutations |
| `apps/registry-viewer/src/components/LoadoutBuilder.vue` | three handlers consult the sniff before surfacing errors |

`01.5` runtime wiring: none anticipated.

## 7. Contract

**The sniff** takes the **raw text** and parses internally:
`sniffLoadoutImportFormat(rawText: string): LoadoutImportFormat`, returning one
of `match-setup` | `lagn` | `gauntlet-pack` | `unknown`. Parsing inside the
helper is what makes AC-4's "malformed/non-JSON → `unknown`" assertable at the
helper level at all; a pre-parsed parameter would push three `JSON.parse`
try/catch sites into `LoadoutBuilder.vue` instead. The exact signature, the box
union, and the exported `redirectSentenceFor(...)` lookup are locked in EC-586.
Detection is **positive-only** — a shape is claimed only when **both** keys of
its discriminator pair are present. Anything else is `unknown`.

**Multi-match rule (locked):** if a document satisfies **more than one** pair, the
result is `unknown`, not a precedence winner. A file that looks like two formats
is a file we cannot confidently redirect, and the real validator errors are more
useful than a coin-flip. This is reachable only via LAGN's
`additionalProperties: true`.

| Box | Receives | Behaviour |
|---|---|---|
| any | its own format | unchanged — loads as today |
| any | one of the other two | **one** redirect sentence naming the correct box; no validator dump |
| any | `unknown` / malformed / non-JSON | unchanged — the existing validator or parser errors, byte-identical |

The redirect sentence is a full sentence naming both what was detected and where
to put it (per `.claude/rules/code-style.md §Error Handling`). Its exact wording
is locked in EC-586.

## 8. Acceptance Criteria

> **Test-level note (locked).** `apps/registry-viewer` has **no SFC test
> harness** — its test script is `node --import tsx --test "src/**/*.test.ts"`
> with no `@vue/test-utils`, no `jsdom`, and no `vue-sfc-loader`; none of its 22
> test files imports a `.vue`. So every AC below is asserted at the **pure
> helper** level, and box-level behaviour is gated by the D-24026 live-verify.
> This mirrors what shipped WP-549 did for its own `LoadoutBuilder.vue` /
> `App.vue` changes. **Do not build an SFC harness for this WP.**

- **AC-1** The helper's redirect lookup returns the exact locked sentence for
  `(box: match-setup, detected: lagn)` — the pairing observed live.
- **AC-2** All six `(box, detected)` wrong-box pairings return their exact locked
  sentence; the helper exports the lookup so the truth table is fully covered.
- **AC-3** All three same-format pairings return **no** redirect (the box loads
  normally).
- **AC-4** The sniff returns `unknown` for: malformed/non-JSON, a partial pair
  (one key present), an empty object, and a document satisfying two pairs.
- **AC-5** Each handler consults the sniff and returns **before** its parser call
  on a redirect, so the `unknown` path reaches the existing validator errors
  unchanged — verified by reading the diff, and by AC-6's live check.
- **AC-6** *(D-24026 live-verify, not a unit test)* Pasting a LAGN into
  `Load JSON` shows one sentence, none of the nine schema errors, and **leaves the
  draft untouched** — no auto-load.
- **AC-7** `pnpm --filter registry-viewer test` + `typecheck`, `pnpm -r build`
  and `pnpm -r --no-bail test` all exit 0.

## 9. Verification Steps

1. `pnpm install && pnpm -r build` first (a fresh worktree has no `dist`), then
   `pnpm --filter registry-viewer test` — record the pre-change count.
   **Note the filter is `registry-viewer`, not `@legendary-arena/registry-viewer`.**
2. In the Loadout tab, paste a LAGN file into `Load JSON` — expect one sentence.
3. Paste a MATCH-SETUP document into `Load LAGN` — expect the mirror sentence.
4. Confirm the draft is untouched in both cases.

## 10. Definition of Done

- AC-1..AC-7 pass.
- D-24360 landed (Active); STATUS, WORK_INDEX, EC_INDEX flipped; mindmap
  `📝` → `✅` + `pnpm roadmap:counts:write`.
- Commit topology: `EC-586:` + `SPEC:`.
- `User-Visible Surface = the Registry Viewer Loadout tab` — **D-24026
  live-verify required**.

## Gate Record (Phase 1)

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-15) | Round 1 NOT READY on three blockers. PS-1: the ACs demanded SFC-level assertions this app cannot write (no `@vue/test-utils` / `jsdom` / `vue-sfc-loader`; none of its 22 test files imports a `.vue`) — the **same** failure WP-549's Gate Record already records; ACs restated at the pure-helper level with box behaviour demoted to the D-24026 live-verify. PS-2: `loadoutLagnImport.test.ts` was allowlisted for a job it cannot do (it tests the pure parser this WP never touches) — removed. PS-3: the MATCH-SETUP box renders `field: message`, so the locked sentence would have shown as `root: This looks like a LAGN file…`, reproducing the exact prefix §3 complains about — `field` now empty with the template omitting it. Also corrected stale handler line numbers (688/735/876 → 710/757/899, read against a pre-WP-549 revision), a discriminator gate that passed vacuously against JSDoc rather than schemas, and a missing governance carve-out on the diff gate. |
| | | **The central premise held.** Discriminator-pair exclusivity was verified against the real schemas: MATCH-SETUP is `additionalProperties: false`, the Gauntlet Pack is a `.strict()` two-key object, and `setup` is genuinely absent from MATCH-SETUP (its field is `setupId`). Two refinements followed: `schemaVersion` is also used by `gauntletConfigs.ts:183` for a different artifact (single-key matching would misfire; pair-matching does not), and LAGN's `additionalProperties: true` makes a two-pair document possible — so a multi-match now resolves to `unknown` rather than a precedence guess. |
| Copilot (`01.7`) | **RISK → resolved** (2026-08-15) | Cross-WP coupling with WP-552 was unstated in both packets: their code files are disjoint, but they share five governance files and both run `roadmap:counts:write`, so a parallel run collides and the second to land silently reddens the Dashboard gate. A sequential-execution note now sits in both WP §2 and both EC Before-Starting blocks. |
| Lint gate (`00.3`) | **PASS** | All 21 sections resolved; §17 triggered (Registry Viewer public surface) and answered in `## Vision Alignment`. |

## Vision Alignment

Required by `00.3 §17.1` — this touches a **Registry Viewer
(cards.legendary-arena.com) public surface (Vision §10a)**.

**Vision clauses touched:** §10a (Registry Viewer).

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
Vision §10a names **Players** ("browse all cards… explore comic-accurate
gameplay themes") and **Contributors** ("inspect card data quality, validate set
health") among the viewer's audiences. An error message that names the right
control serves both; a nine-line schema dump serves neither. The change is
strictly additive to comprehension and removes no diagnostic detail from the
paths that genuinely need it.

**Non-Goal proximity check:** none of NG-1..NG-7 are crossed. No monetization,
no gating, no paid surface, no mechanical advantage; the importers remain free
and unauthenticated.

**Determinism preservation:** N/A per §17.2's trigger — no scoring, replay, RNG,
or simulation surface. This changes a client-side error message only.

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS |
| 2 | Non-Negotiable Constraints Block | PASS — §5 + EC Guardrails (advisory-only, no weakened validation) |
| 3 | Prerequisites (`## Assumes`) | PASS — §2, all shipped |
| 4 | Context References | PASS — §3 quotes the live error |
| 5 | Output Completeness | PASS — §6, three code/test files |
| 6 | Naming Consistency | PASS — discriminator names quoted from the real formats |
| 7 | Dependency Discipline | PASS — WP-291 and WP-454 both shipped |
| 8 | Architectural Boundaries | PASS — `apps/registry-viewer` only |
| 9 | Windows Compatibility | N/A — no path or shell work |
| 10 | Environment Variable Hygiene | N/A |
| 11 | Authentication Clarity | N/A — unauthenticated surface, unchanged |
| 12 | Test Quality | PASS — AC-1..AC-6; baseline count recorded in §9 step 1 |
| 13 | Commands and Verification | PASS — §9, incl. the corrected pnpm filter |
| 14 | Acceptance Criteria Quality | PASS — every AC assertable; AC-4/AC-5 pin byte-identical fall-through |
| 15 | Definition of Done | PASS — §10 |
| 15.1 | User-visible verification (D-24026) | PASS — §10 |
| 16 | Code Style | PASS — one pure helper, positive-only detection, full-sentence errors per §Error Handling |
| 17 | Vision Alignment | PASS — the section above, clause §10a |
| 18 | Prose-vs-Grep Discipline | PASS — no grep-based gate whose token appears in prose |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA pinned in the header |
| 20 | Funding Surface Gate | N/A |
| 21 | API Catalog Update (D-11804) | N/A — no HTTP endpoint, no `apps/server` library function |
