# WP-559 — Hero Ledger `subsystem` Covered Status

**Status:** Draft 2026-08-16
**Layer:** Tooling + Coverage Feeds + Dashboard (no engine, no `G`, no gameplay)
**Depends on:** WP-548 / EC-583 / D-24357 (the status this extends) · WP-479 / D-24286 (the implementation being mis-reported)
**Reserves:** EC-594 · D-24368
**Baseline:** `origin/main` @ `040edfa3`
**Lane:** Standard two-session (crosses tooling + dashboard packages; the
Lightweight Lane requires a single package).

---

## 1. Goal

Stop `dashboard.legendary-arena.com/coverage` reporting shipped work as an
unfinished TODO. A hero card implemented by a subsystem other than the
`[effect:X]` pipeline currently renders **Unsupported**; it should render
**Subsystem**, the status WP-548 introduced for exactly this case but wired only
into the villain ledger.

## 2. Assumes

- **WP-548 / D-24357 created the `subsystem` status** and threaded it through the
  effect-index, the registry enum, and the dashboard's `CoverageStatus` union —
  but only `scripts/villain-mechanic-ledger.mjs` emits it. Verified on the
  baseline: that file contains 41 `subsystem` references,
  `scripts/hero-mechanic-ledger.mjs` contains **zero**.
- **WP-479 / D-24286 shipped `reveal-reorder`.**
  `packages/game-engine/src/moves/reorderChoice.resolve.ts` exists and the marker
  is parsed at `packages/game-engine/src/setup/heroAbility.setup.ts:272`. The
  mechanic is implemented; only its *reporting* is wrong.
- **`EFFECT_INDEX_STATUSES` already contains `subsystem`**
  (`packages/registry/src/schema.ts:765-777`) and is shared by the
  effect-implementation-index built from **both** ledgers. Verified: no registry
  contract change is required by this WP.
- **`apps/dashboard/src/types/coverage.ts` already has `subsystem`** in the
  `CoverageStatus` union and `STATUS` array (WP-548), but `LedgerByStatus`
  (`:58-64`) is a closed five-field interface without it.

## 3. Context

Surfaced 2026-08-16 from the **deployed** `/coverage` page, not from a test.
`core/spider-man` — "The Amazing Spider-Man" — lists mechanic `reveal-reorder`
with status **Unsupported**, WP `—`, Decision `—`, Handler `—`, as though nobody
had built it. WP-479 built it eight weeks ago.

**Root cause.** `reveal-reorder` is a **bare modifier marker**: `[keyword:reveal-reorder]`
with no `[effect:X]` tag (`heroAbility.setup.ts:265-290` documents this
deliberately). `statusForMechanic` (`scripts/hero-mechanic-ledger.mjs:291`) tests
`KNOWN_CONDITIONS` → `MVP_KEYWORDS` → `COMPOSITION_MARKERS` → `KNOWN_KEYWORDS`
and otherwise falls to a terminal `return 'unsupported'`. A subsystem-implemented
mechanic matches none of those buckets, so it lands in the same bucket as genuine
TODOs.

**Why the villain allowlist shape does not transfer.**
`scripts/coverage/subsystem-coverage.json` is **card-keyed**, and the villain
ledger lets `subsystem` replace only a would-be-`(unmarked)` row. That is sound
for villains: an unmarked villain card emits exactly one row for the whole card.
Heroes emit **one row per mechanic**, and ASM is the proof that card granularity
would be wrong — it carries two unsupported mechanics of which only one is
implemented:

| Card | Mechanic | Truth |
|---|---|---|
| `core/spider-man` | `reveal-reorder` | implemented (WP-479 / D-24286) |
| `core/spider-man` | `reveal-count` | genuinely unimplemented |

A card-keyed hero entry would clear both and hide a real TODO. The hero side
therefore needs **(card × mechanic)** granularity. This is the decision D-24368
locks.

**Scaffold (observed, `01.4 §Empirical Scaffold`).** This changes a CI-gated
derived artifact's classification, so the class applies. Prototyped on the
baseline — a `heroes` block in the allowlist plus a `subsystem` branch in
`statusForMechanic`:

- `core/spider-man` × `reveal-reorder` → **`subsystem`**; `reveal-count` correctly
  **stayed** `unsupported`; `co2e/spider-man` × `reveal-count` untouched.
- `byStatus.unsupported` 368 → **367**.
- **A defect the scaffold exposed:** the regenerated summary serialised
  `"subsystem": null`, and `totalRows` (651) no longer matched the sum of the
  buckets (650). The `summary.byStatus` initializer
  (`hero-mechanic-ledger.mjs`, the `{ executable: 0, deferred: 0, condition: 0,
  unsupported: 0, unmarked: 0 }` literal) has no `subsystem` key, so the
  accumulator writes to `undefined`. Fixing that initializer is in scope.
- **A derived-feed cascade the scaffold exposed:** `effect-index:check` went
  **stale (exit 1)** and needed `pnpm effect-index` to return to 0. The
  regenerated file is `data/metadata/effect-implementation-index.json` (note:
  `data/metadata/`, not `docs/ai/coverage/`). `ledger:villains:check` and
  `mechanics:metadata:check` were unaffected (exit 0).
- `pnpm -r --no-bail test`: **zero failures** across all 12 packages, so no test
  fixture migration folds into scope.

Prototype discarded; baseline re-verified green.

## 4. Scope (In)

- Add a hero block to `scripts/coverage/subsystem-coverage.json` at
  `(card × mechanic)` granularity, alongside the untouched card-keyed villain
  block.
- Teach `scripts/hero-mechanic-ledger.mjs` to emit `subsystem` for allowlisted
  pairs, **and** add `subsystem: 0` to the `summary.byStatus` initializer.
- Seed exactly one row: `core/spider-man` × `reveal-reorder` →
  `setup:reveal-reorder-modifier`, WP-479, D-24286.
- Regenerate `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` **and**
  `data/metadata/effect-implementation-index.json`.
- Widen `LedgerByStatus` with `subsystem`; add the bucket, count chip, filter
  entry and CSS class to `CoveragePage.vue`.
- Land `D-24368`.

## 5. Scope (Out)

- **No villain-side change.** `villain-mechanic-ledger.mjs` and the allowlist's
  existing `cards` block are byte-unchanged; the villain ledger must keep reading
  the file exactly as it does today.
- **No registry contract change.** `EFFECT_INDEX_STATUSES` already carries
  `subsystem` (verified). A comment there scopes it to "a villain card"; updating
  that sentence for accuracy is permitted, widening the enum is not.
- **No engine, `G`, gameplay, or determinism change.** `reveal-reorder` itself is
  not touched.
- **No card-data edit.**
- **No allowlist entry whose implementation is not merged** — the file records
  shipped coverage only, per WP-548's curation rule.
- **No second hero mechanic.** `reveal-reorder` is the only bare modifier marker
  on the hero side at this baseline (verified by grep); adding speculative rows
  would re-introduce the over-claim WP-548 avoided.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `scripts/coverage/subsystem-coverage.json` | hero block, `(card × mechanic)` |
| `scripts/hero-mechanic-ledger.mjs` | `subsystem` branch + `byStatus` initializer |
| `docs/ai/coverage/hero-mechanic-ledger.json` / `.csv` | regenerated |
| `data/metadata/effect-implementation-index.json` | regenerated (cascade) |
| `apps/dashboard/src/types/coverage.ts` | `LedgerByStatus.subsystem` |
| `apps/dashboard/src/pages/coverage/CoveragePage.vue` | bucket + chip + filter + CSS |
| `packages/registry/src/schema.ts` | comment accuracy only (optional) |
| `docs/ai/DECISIONS.md` + indices + mindmap + STATUS | governance |

## 7. Contract

- The `subsystem` status is a **two-ledger** contract. Villain entries are
  card-keyed and replace a would-be-`(unmarked)` row; hero entries are
  `(card × mechanic)`-keyed and replace a would-be-`unsupported` row for that
  pair only.
- A card may hold a `subsystem` row and an `unsupported` row simultaneously; that
  is the correct representation, not a conflict.
- `summary.totalRows` MUST equal the sum of `summary.byStatus`.

## 8. Acceptance Criteria

- **AC-1** — the regenerated hero ledger reports
  `core/spider-man` × `reveal-reorder` with status `subsystem`, and its `wp` /
  `decision` / `handler` columns are populated from the allowlist (no `—`).
- **AC-2** — `core/spider-man` × `reveal-count` is still `unsupported`. (The
  granularity guard: a card-keyed implementation passes AC-1 and fails this.)
- **AC-3** — `summary.byStatus.subsystem` is an integer (not `null`), and
  `summary.totalRows` equals the sum of all `byStatus` values.
- **AC-4** — `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
  `pnpm ledger:villains:check` and `pnpm mechanics:metadata:check` all exit 0
  after regeneration.
- **AC-5** — `git diff --exit-code scripts/villain-mechanic-ledger.mjs` returns 0,
  and the allowlist's `cards` block is unchanged (`git diff` shows additions
  only).
- **AC-6** — `/coverage` shows a Subsystem bucket whose count is 1, the filter
  chip selects it, and the `Unsupported` tile reads 367.
- **AC-7** — `pnpm -r --no-bail test` green across all packages; `vue-tsc` clean
  for the dashboard.

## 9. Verification Steps

1. `pnpm -r build` then `pnpm ledger:heroes && pnpm effect-index` — regenerate
   before testing (a stale build reports the pre-regeneration copy; see §3).
2. Run the four `:check` gates in AC-4.
3. `pnpm -r --no-bail test`.
4. Inspect the regenerated ledger for the three rows in AC-1 / AC-2 / AC-3.
5. **D-24026 live-verification (REQUIRED):** after deploy, confirm on
   `dashboard.legendary-arena.com/coverage` that `core/spider-man` ×
   `reveal-reorder` no longer reads Unsupported and the Subsystem bucket renders.

## 10. Definition of Done

- AC-1 … AC-7 satisfied.
- D-24368 landed.
- WORK_INDEX / EC_INDEX / mindmap / STATUS updated; `roadmap:counts:check` and
  `ledger:numbers:check` exit 0.
- D-24026 live-verification recorded (this WP has a real user-visible surface).
- `01.6` post-mortem assessed — expected **not** triggered (it extends an
  existing status to a second consumer; no new contract, abstraction, or
  category).

## Vision Alignment

Required by `00.3 §17.1` — **card data / content semantics** (Vision §1, §2, §10)
via the mechanic ledger, and a **dashboard public surface**.

**Vision clauses touched:** §1, §2, §10, §14.

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
§14 (Explicit Decisions, No Silent Drift) is the load-bearing one — a coverage
surface that reports shipped work as unbuilt is silent drift between the code and
its own index, and this removes it. §1 / §2 are unaffected: no rule or card
semantic changes, only how implemented coverage is reported.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed. No monetization,
paid surface, gating, or persuasive mechanic; the dashboard is an internal
operator surface.

**Determinism preservation:** N/A per §17.2's trigger — no scoring, replay, RNG,
or simulation surface. The ledger is a build-time derived artifact; the
regeneration is byte-stable by the existing composite sort, and no engine, `G`,
or gameplay path is touched.

## Gate Record (Phase 1)

**WP class:** Infrastructure & Verification (coverage tooling + its dashboard
consumer; no `G` mutation, no move, no phase).

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-16) | Dependencies verified on `main`: WP-548 (`subsystem` status, 41 villain refs vs 0 hero) and WP-479 (`reorderChoice.resolve.ts` + marker at `heroAbility.setup.ts:272`) both merged. Contract verification: `EFFECT_INDEX_STATUSES` already contains `subsystem`, so no registry widening — checked at source rather than assumed. **Empirical Scaffold: run**, and it changed the scope twice — it exposed the `byStatus` initializer defect (`"subsystem": null`, totalRows 651 vs buckets 650) and the `effect-index:check` cascade (exit 1 until `pnpm effect-index`), neither of which was in the reservation text. Zero test failures, so no fixture migration. |
| Copilot (`01.7`) | **PASS** (2026-08-16) | Two RISKs closed in-text: (1) reusing the villain card-keyed shape would clear ASM's genuinely-unsupported `reveal-count` — AC-2 exists solely to fail that implementation; (2) regenerating the hero ledger without the effect-index would red `main` on a gate not named in the reservation — AC-4 pins all four gates. |
| Lint gate (`00.3`) | **PASS** | 21/21 below; §17 triggered and answered. |

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS — all 10 sections in template order |
| 2 | Non-Negotiable Constraints Block | PASS — §5 (no villain-side change, no enum widening, no engine edit, no unmerged allowlist row) + EC Guardrails |
| 3 | Prerequisites (`## Assumes`) | PASS — §2; every claim cites a file:line read at baseline `040edfa3` |
| 4 | Context References | PASS — §3 carries the live `/coverage` observation, the classifier fall-through, the two-mechanic ASM table, and the scaffold output |
| 5 | Output Completeness | PASS — §6; the regen set was determined empirically, not guessed |
| 6 | Naming Consistency | PASS — reuses `subsystem` and the WP-548 allowlist field names verbatim |
| 7 | Dependency Discipline | PASS — WP-548 and WP-479 both merged |
| 8 | Architectural Boundaries | PASS — tooling + dashboard only; no engine/registry contract change; the ledger scripts already import built `dist` as before |
| 9 | Windows Compatibility | PASS — no new shell/path work |
| 10 | Environment Variable Hygiene | N/A — no env read |
| 11 | Authentication Clarity | N/A — no auth surface |
| 12 | Test Quality | PASS — AC-2 is the granularity guard, AC-3 pins the arithmetic the scaffold caught, AC-5 pins the villain side byte-identical |
| 13 | Commands and Verification | PASS — §9; step 1 encodes the regenerate-then-rebuild ordering |
| 14 | Acceptance Criteria Quality | PASS — AC-1..AC-7 independently checkable; AC-5 is `git diff --exit-code` |
| 15 | Definition of Done | PASS — §10, binary, includes the D-24026 gate |
| 16 | Code Style | PASS — one guard clause in an existing classifier; no `.reduce()`; JSON allowlist mirrors the existing block's shape |
| 17 | Vision Alignment | PASS — triggered; block cites §1, §2, §10, §14 with the determinism line answered as N/A |
| 18 | Prose-vs-Grep Discipline | PASS — AC-5's greps are scoped to named paths |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA in the header; all citations read at that commit |
| 20 | Funding Surface Gate | N/A — internal operator dashboard, no funding surface |
| 21 | API Catalog Update | N/A — no `apps/server` endpoint added or changed |
