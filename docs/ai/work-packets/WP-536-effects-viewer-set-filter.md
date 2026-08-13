# WP-536 — Set Filter on the Debug Effects Viewer (`/debug/effects`)

**Status:** Draft 2026-08-12 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `dashboard /debug/effects` (an additive control on the existing WP-487 page; D-24026 live-verification applies — the packet is not Done until the Set filter narrows rows on the deployed dashboard).
**Primary Layer:** App (`apps/dashboard`) only.
**Lane:** **Lightweight Lane** (D-24028) — single layer, 3 code/test files, strictly additive, no contract file, no determinism surface. See §Lane Eligibility.
**Dependencies:** WP-487 / D-24292 (the `/debug/effects` viewer + `useEffectIndex.ts` + `EffectImplementationIndexSchema` this filter extends); WP-484 / D-24289 (the generated `effect-implementation-index.json`, every entry of which already carries a `set` field).

---

## Goal

After this session, the `/debug/effects` Effect Implementation Index viewer carries a **Set filter** — a dropdown that narrows the entry table to a single card set (`core`, `co2e`, …) or `all` (the default, unchanged behavior). Every index entry already carries a `set` field; this WP adds a `SetFilter` type + a set branch to the existing `filterEntries` predicate + a `listSets` helper that enumerates the distinct sets present in the loaded index, and wires a `<select>` control into `EffectsPage.vue` that composes with the existing scope / status / has-handler / search filters (logical AND, same as today). It is the enabling step for driving **Core-set completion** off one filtered board: `set = core` + `status = unmarked|unsupported` renders the exact per-card worklist. The change authors no new effect data, adds no parser, and touches no engine / registry / server code — it is a pure additive UI filter over the CI-gated index the page already reads. Locked by no new D-entry (applies D-24292).

## User-Visible Impact

An operator on `/debug/effects` sees a new **Set** dropdown beside the existing Scope / Status / has-handler filters, defaulting to **All sets** (so the page renders exactly as it does today until the operator picks a set). Selecting a set (e.g. `core`) narrows the table to that set's card × mechanic rows, composing with the other filters. No change to any gameplay, player-facing, or public surface — this is an additive control on an internal operator/developer tool behind the existing dashboard auth gate. D-24026 live-verification applies (the filter must narrow rows on the deployed dashboard).

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The /debug/effects viewer + composable exist on main (WP-487)
test -f apps/dashboard/src/pages/debug/EffectsPage.vue && test -f apps/dashboard/src/composables/useEffectIndex.ts && test -f apps/dashboard/src/composables/useEffectIndex.test.ts && echo "A_OK"
# Expected: A_OK

# B. filterEntries + EffectIndexFilter + the scope/status filter types are present to extend
grep -q "export function filterEntries" apps/dashboard/src/composables/useEffectIndex.ts && grep -q "EffectIndexFilter" apps/dashboard/src/composables/useEffectIndex.ts && grep -q "handlerOnly" apps/dashboard/src/composables/useEffectIndex.ts && echo "B_OK"
# Expected: B_OK

# C. Every index entry carries a `set` field (the data this filter reads)
node -e "const d=require('./data/metadata/effect-implementation-index.json'); const missing=d.entries.filter(e=>typeof e.set!=='string'||e.set===''); process.exit(missing.length===0?0:1); " && echo "C_OK sets-present"
# Expected: C_OK sets-present

# D. No Set filter exists yet on the page (this WP introduces it)
grep -q "SetFilter\|setFilter" apps/dashboard/src/composables/useEffectIndex.ts apps/dashboard/src/pages/debug/EffectsPage.vue && echo "EXISTS" || echo "ABSENT"
# Expected: ABSENT (STOP and inspect provenance if EXISTS)

# E. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "E_OK"
# Expected: E_OK
```

If A or B fails, WP-487's viewer is not on `main` as assumed — STOP and reconcile before extending it.

---

## Context (Read First)

- `apps/dashboard/src/composables/useEffectIndex.ts` (WP-487) — the host. It already exports `EffectIndexFilter` (`search` / `scope` / `status` / `handlerOnly`), the `filterEntries(entries, filter)` predicate (a `for...of` with one guard per dimension), a `DEFAULT_FILTER` object, and the `ScopeFilter` / `StatusFilter` union types. This WP adds a `set` dimension mirroring `handlerOnly`'s exact shape.
- `apps/dashboard/src/pages/debug/EffectsPage.vue` (WP-487) — the page. `scope` / `status` use **filter-button rows** (small closed unions of ~3–5 values); `search` uses a text input. The Set dimension is **not** a small closed union — the index carries ~41 distinct sets — so it renders as a **`<select>` dropdown**, not a button row.
- `data/metadata/effect-implementation-index.json` (WP-484) — every entry has a `set` string (`core`, `co2e`, `2099`, …). The distinct set list is data-driven and open-ended; new card sets appear here without a code change.
- `ScopeFilter` / `StatusFilter` are `<union> | 'all'` closed unions anchored by exhaustive `switch` label functions. **`SetFilter` is deliberately different** — `string | 'all'` (an open union), because the set space is data (registered card sets), not a closed drift-tested engine vocabulary. This contrast is the one `// why:` this WP requires.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the dashboard app reads a build-time-bundled JSON only; it imports the registry `/schema` subpath (already present from WP-487) and never the game engine / server / persistence layer. This WP adds no import.

---

## Scope (In)

- Modify `apps/dashboard/src/composables/useEffectIndex.ts`:
  - Add `export type SetFilter = string | 'all'` — an **open** union (contrast: `ScopeFilter` / `StatusFilter` are closed). Add the `// why:` explaining the open-vs-closed distinction.
  - Add `set: SetFilter` to the `EffectIndexFilter` interface and `set: 'all'` to `DEFAULT_FILTER`.
  - Add one guard to `filterEntries`, mirroring the `scope`/`status` guards exactly: `if (filter.set !== 'all' && entry.set !== filter.set) { continue; }`.
  - Add `export function listSets(entries: readonly EffectIndexEntry[]): readonly string[]` — the sorted, de-duplicated list of `set` values present in the loaded index, for the dropdown options. Pure, `for...of` accumulation into a `Set`, then a sorted array; no `.reduce()`.
- Modify `apps/dashboard/src/pages/debug/EffectsPage.vue`:
  - Add a `setFilter = ref<SetFilter>('all')` and a **Set `<select>` dropdown** in the filter row, populated from `listSets(entries.value)` with a leading **All sets** (`'all'`) option, styled to match the existing controls.
  - Thread `set: setFilter.value` into the existing `filterEntries(...)` call in the `filteredEntries` computed.
- Modify `apps/dashboard/src/composables/useEffectIndex.test.ts`:
  - Add `filterEntries` set-partition cases (a set narrows to that set; `'all'` is a no-op; set composes with a status filter — logical AND).
  - Add a `listSets` case (distinct + sorted; empty entries → empty list).

## Out of Scope

- **`/coverage`** (`CoveragePage.vue` / `useCoverageLedger.ts`) — the hero-only ledger board stays the cross-set mechanic-grind surface; it gets no Set filter here. Adding one there is a separate future WP if wanted.
- **A default other than `'all'`** — the page must render unchanged until the operator picks a set. No "remember last set", no URL-param persistence, no default-to-`core`.
- **Closing the set space into a drift-tested union** — `SetFilter` is intentionally `string | 'all'`; sets are data. No `SET_NAMES` canonical array, no drift test.
- **Any engine / registry / server / registry-viewer / arena-client file, the WP-484 transform, `effect-implementation-index.json`, `EffectImplementationIndexSchema`, or either mechanic ledger** — no schema change, no regenerated artifact, no new dependency, no lockfile change.
- **Mastermind / scheme coverage gaps** — the index's mastermind/scheme representation limits (per-mastermind resolvers invisible to markers; schemes absent from the index) are real but out of this WP; this is filtering, not data completeness.

---

## Files Expected to Change

- `apps/dashboard/src/composables/useEffectIndex.ts` — **modified** (add `SetFilter` type + `set` field on `EffectIndexFilter` + `DEFAULT_FILTER.set` + the `filterEntries` set guard + the `listSets` helper)
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **modified** (add the `setFilter` ref + the Set `<select>` dropdown + thread `set` into `filterEntries`)
- `apps/dashboard/src/composables/useEffectIndex.test.ts` — **modified** (set-filter partition cases + `listSets` cases)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip the WP-536 node `📝` → `✅`; then `pnpm roadmap:counts:write`)
- `docs/ai/STATUS.md` — **modified** (Done entry)

**3 code/test files (all modified, all under `apps/dashboard`) + governance.** No new file, no new dependency, no lockfile change, no generated-artifact regen. Single layer (App); **Lightweight Lane** (two-commit topology `EC-571:` + `SPEC:`).

---

## Lane Eligibility (Lightweight Lane, D-24028)

**Structural (provisional, at draft) — all hold:**

1. Single layer, single app (`apps/dashboard`) — no layer crossing. ✅
2. 3 code/test files; **zero** runtime-wiring files (the page + route + nav already exist from WP-487). ✅
3. No `01.6` trigger — no new contract, abstraction, builder, runtime-wiring category, or code category (an additive filter dimension). ✅
4. No new contract file (`.types.ts` / `.validate.ts` / `.gating.ts`). ✅
5. Zero D-entries (applies D-24292). ✅
6. Surface is narrow UX (a filter control) — none of the barred surfaces (scoring / PAR / leaderboards / identity / multiplayer sync / monetization / RNG / determinism / persistence). ✅

**Empirical (confirmed at govern-close by the executor):** strictly additive (7); zero determinism impact, `finalStateHash` N/A (8); the 3-file budget holds at the final `git diff --name-only` (9).

**Mandatory scaffold (the lane's empirical-independence safeguard):** the executor's FIRST step is to prototype the change and run `pnpm --filter @legendary-arena/dashboard test:coverage`, recording the observed result, before confirming eligibility. (Not a validation-tightening change, so no pre-existing-fixture-break class is expected — but the scaffold run is still required to pass the lane per `01.0a §Lightweight Lane`.)

---

## Contract (applies D-24292; locks no new D)

- **Filter composition:** the Set filter is one more AND-guard on the existing `filterEntries` predicate — an entry survives only if it matches `search` AND `scope` AND `status` AND `handlerOnly` AND `set`. Order among guards is irrelevant (all are `continue`-on-miss).
- **`SetFilter = string | 'all'`** — an **open** union. Sets are registered card data, not a closed engine vocabulary; there is deliberately no `SET_NAMES` canonical array and no drift test (contrast `ScopeFilter` / `StatusFilter`).
- **Options are data-driven:** the dropdown lists only the sets actually present in the loaded index (`listSets(entries)`), sorted, with a leading `'all'`. A set with zero entries never appears; a newly-registered set appears automatically when the regenerated index carries it — no code change.
- **Default `'all'`:** the page renders identically to its pre-WP state until the operator selects a set. Purely additive.

### Determinism / persistence

N/A to gameplay. The filter touches no `G` / `ctx` / RNG / replay / scoring surface, persists nothing, and reads the static committed index the page already loads. `finalStateHash` unaffected.

### Code-style / output discipline

Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names, `for...of` over `.reduce()` in `listSets`, the required `// why:` on the open-vs-closed `SetFilter` distinction, full-sentence empty-state text. ESM only, Node v22+. The session output emits **full file contents** for every modified file — no diffs, no snippets.

---

## Acceptance Criteria

1. `useEffectIndex.ts` exports `SetFilter = string | 'all'` with a `// why:` explaining the open-union choice (sets are data, not a closed drift-tested union like `ScopeFilter`/`StatusFilter`).
2. `EffectIndexFilter` gains a `set: SetFilter` field and `DEFAULT_FILTER` gains `set: 'all'`; `filterEntries` skips an entry when `filter.set !== 'all' && entry.set !== filter.set`, and this guard composes (AND) with the existing scope / status / handlerOnly / search guards.
3. `listSets(entries)` returns the distinct `set` values present, sorted ascending, with no duplicates; empty entries → empty array; it uses `for...of` accumulation, never `.reduce()`.
4. `/debug/effects` renders a **Set `<select>`** in the filter row (a dropdown, not a button row), populated from `listSets(entries.value)` with a leading **All sets** option; selecting a set narrows the table and composes with the other filters; default is `'all'` (page unchanged until a set is chosen).
5. `useEffectIndex.test.ts` covers: a set narrows to that set, `'all'` is a no-op, set + status compose (AND), and `listSets` is distinct + sorted; all pass.
6. No new import in any dashboard file (no engine, no registry barrel, no new dependency); `grep` for `@legendary-arena/game-engine` and a bare `@legendary-arena/registry` import in the two modified source files finds no new match.
7. `pnpm --filter @legendary-arena/dashboard test`, `test:coverage`, and `build` exit 0; the dashboard coverage thresholds (lines 90 / branches 80 / functions 88) still hold.
8. `pnpm -r build` and `pnpm -r --no-bail test` exit 0; no file outside `apps/dashboard` (+ governance docs) is modified — in particular no `packages/**`, `apps/server`, `apps/registry-viewer`, `apps/arena-client` file, no `pnpm-lock.yaml`, no `effect-implementation-index.json`, no mechanic ledger.

---

## Verification Steps

```bash
# 1. SetFilter type + filterEntries guard present
grep -nE "export type SetFilter|set: SetFilter|filter.set !== 'all'" apps/dashboard/src/composables/useEffectIndex.ts
# Expected: the type, the interface field, and the guard line

# 2. listSets is distinct + sorted, no reduce
grep -n "export function listSets" apps/dashboard/src/composables/useEffectIndex.ts
grep -c "\.reduce(" apps/dashboard/src/composables/useEffectIndex.ts
# Expected: listSets present; reduce count unchanged from before (no new reduce)

# 3. No new engine / barrel import in the modified source
grep -rnE "@legendary-arena/game-engine|from ['\"]@legendary-arena/registry['\"]" apps/dashboard/src/composables/useEffectIndex.ts apps/dashboard/src/pages/debug/EffectsPage.vue
# Expected: NO MATCH (schema still via @legendary-arena/registry/schema only, unchanged from WP-487)

# 4. Composable tests (incl. the new set cases)
pnpm --filter @legendary-arena/dashboard test 2>&1 | tail -5
# Expected: exit 0; set-filter + listSets cases pass

# 5. Dashboard build + coverage thresholds
pnpm --filter @legendary-arena/dashboard build 2>&1 | tail -3
pnpm --filter @legendary-arena/dashboard test:coverage 2>&1 | tail -5
# Expected: both exit 0; thresholds hold

# 6. No file outside apps/dashboard (+ governance) touched
git diff --name-only | grep -vE '^(apps/dashboard/|docs/)' ; echo "hits above (expect none)"

# 7. Full build/test
pnpm -r build && pnpm -r --no-bail test
# Expected: both exit 0

# 8. Live narrow (post-deploy; D-24026): open the deployed /debug/effects, pick
#    Set = core, confirm the table narrows to core rows only and composing with
#    Status = unmarked shows the Core hollow worklist; pick All sets → full table returns.
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All preconditions (A–E) passed before the edit
- [ ] Mandatory scaffold run recorded (the lane's empirical-independence step): the change prototyped + `pnpm --filter @legendary-arena/dashboard test:coverage` observed green
- [ ] All 8 Acceptance Criteria pass
- [ ] All 8 Verification Steps produce the expected output (Step 8 is the post-deploy live check)
- [ ] `/debug/effects` renders the Set dropdown; selecting a set narrows the table and composes with the other filters; default `'all'` leaves the page unchanged
- [ ] `SetFilter` is `string | 'all'` (open union) with the required `// why:`; no `SET_NAMES` array / drift test added
- [ ] No new import / dependency / lockfile change; no file outside `apps/dashboard` (+ governance) modified
- [ ] Dashboard build + test + coverage thresholds green
- [ ] `docs/ai/STATUS.md` Done entry names WP-536 + the Set filter, records the D-24026 live-verify as operator-pending (`User-Visible Surface = dashboard /debug/effects`)
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-536 node flipped `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-571:` for code, `SPEC:` for governance close (two-commit topology)
- [ ] D-24026 live-verification: the Set filter confirmed narrowing rows on the deployed dashboard (operator-pending; the packet is not user-Done until this passes)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-12)

Dependencies verified empirically against the repo, not asserted: the `/debug/effects` viewer (`EffectsPage.vue`) + `useEffectIndex.ts` (with `filterEntries`, `EffectIndexFilter`, `handlerOnly`, `ScopeFilter`/`StatusFilter`) + `useEffectIndex.test.ts` are on `main` (WP-487); the effect index carries a non-empty `set` string on every entry (checked over `effect-implementation-index.json`). The change is a single new guard mirroring the existing `scope`/`status`/`handlerOnly` guards plus a data-driven dropdown — no contract file, no schema touch, no new dependency, no engine/registry/server edit. Layer boundary holds (App-only; no new import). **Empirical Scaffold N/A as a blocker** — additive filter dimension, not a validation-tightening change with pre-existing fixtures; the lane's mandatory-scaffold run is still the executor's first step and is called out in the DoD. **Mutation Boundary N/A** — read-only dashboard page, no `G`/move mutation.

### Copilot (`01.7`) — verdict: **PASS** (targeted self-review, Lightweight Lane)

Per the lane's collapsed copilot (eligibility confirmation + scaffold-result confirmation, not the 30-mode audit). Layer boundary (App-only, no new import), determinism/persistence (none — read-only filter over a static bundle), contract fidelity (renders the index verbatim; the filter narrows, never recomputes), scope/governance (8 AC, closed 3-file allowlist, two-commit topology, applies D-24292 with no new D), and the open-vs-closed `SetFilter` design decision (documented in Context + Contract + a required `// why:`) all clear. RISK noted and folded: the dropdown must source options from `listSets(entries)` (only sets present), not a hardcoded set list, or a newly-registered set would be missing — locked in AC-3/AC-4 and the Contract.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all required sections; Out of Scope lists 5 exclusions).
- **§2 Non-Negotiable Constraints** — PASS (Contract §Code-style / output discipline cites `00.6-code-style.md` + the full-file-contents / ESM / Node v22+ discipline).
- **§3 Assumes** — PASS (preconditions A–E with exact expected output).
- **§4 Context** — PASS (the WP-487 composable + page, the index `set` field, the open-vs-closed union contrast, the ARCHITECTURE layer boundary — all specific). 00.2 N/A — renders WP-484's already-governed index verbatim; defines no new data shape.
- **§5 Files Expected to Change** — PASS (closed 3-file code allowlist + governance; no bundling — nothing new is created).
- **§6 Naming** — PASS (`SetFilter` / `setFilter` / `listSets` mirror `ScopeFilter`/`scopeFilter`; the entry `set` field matches the WP-484 contract; no invented names).
- **§7 Dependencies** — PASS (adds **no** dependency — a deliberate contrast to WP-487, which added the registry dep; no lockfile change).
- **§8 Architectural Boundaries** — PASS (App-only; no new import; barrel + game-engine still forbidden and grep-checked in Verification-3).
- **§9 Windows Compatibility** — PASS (`pnpm --filter` + `node -e` + `grep` via the Bash tool, established convention).
- **§10 Env Vars** — N/A (build-time static import; no runtime fetch, no new browser env var).
- **§11 Auth** — N/A (inherits the existing `AppLayout` auth gate; no new role/meta).
- **§12 Test Quality** — PASS (`node:test` composable coverage; no network/DB/boardgame.io; the new cases partition on real filter behavior).
- **§13 Verification Commands** — PASS (all `pnpm`/`node`/`grep`; exact with expected output; live-narrow is step 8).
- **§14 Acceptance Criteria** — PASS (8 binary, observable, file-specific).
- **§15 Definition of Done** — PASS (STATUS + WORK_INDEX + EC_INDEX + ROADMAP-MINDMAP + scope-boundary check; a `## User-Visible Impact` section + the D-24026 live-verify item for a user-visible surface; no new D by design).
- **§16 Code Style** — PASS (`for...of` in `listSets`, the required `// why:` location, full-sentence empty-state, `/schema` import unchanged).
- **§17 Vision Alignment** — present (§Vision Alignment below; No conflict; NG-1..NG-8 proximity checked; determinism-preservation line).
- **§18 Prose-vs-Grep** — PASS (Verification greps the two modified source files, not this doc; no self-trip).
- **§19 Bridge-vs-HEAD** — commit-time discipline; STATUS authored at execution against live HEAD.
- **§20 Funding Surface Gate** — N/A (internal operator tooling; no §20.1 trigger; authority WP-097 / D-9701 / D-9801).
- **§21 API Catalog** — N/A (no HTTP endpoint, no `apps/server/src/**` library fn; reads a build-time bundle).

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Vision clauses touched:** §10 (card data / effect semantics — read-only, filtered not computed), §22 (determinism — the viewer touches no `G`/RNG/replay surface).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The Set filter is a read-only UI narrowing of an existing committed, CI-gated artifact in an operator-only dashboard view — it changes no card semantics, adds no gameplay behavior, and authors no new effect data.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed — an internal developer/operator debugging filter carrying no monetization, persuasion, pay-to-win, or competitive-integrity surface.

**Determinism preservation:** replay-irrelevant — the page reads a static committed JSON and touches no `G`/`ctx`/RNG/scoring/replay surface.

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger: no navigation/registry-viewer funding affordance, no profile/account funding attribution, no tournament-funding integration, no user-visible funding copy. Internal operator-dashboard debugging tooling only. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. The page reads a build-time-bundled static JSON; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
