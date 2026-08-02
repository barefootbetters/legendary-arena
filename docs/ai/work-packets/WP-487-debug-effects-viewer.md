# WP-487 — Debug Effects Viewer (`/debug/effects` on the Dashboard)

**Status:** Draft 2026-08-01 — awaiting execution. **Gates (drafting session): pre-flight READY · copilot PASS · lint SATISFIED (21/21)** — see Gate Verdicts below.
**User-Visible Surface:** `dashboard /debug/effects` (a new operator-dashboard page; D-24026 live-verification applies — the packet is not Done until the page renders on the deployed dashboard).
**Primary Layer:** App (`apps/dashboard`) only.
**Dependencies:** WP-484 / D-24289 (the generated `data/metadata/effect-implementation-index.json` + `EffectImplementationIndexSchema` — the data this viewer reads); WP-269 / D-24046 (the `card-mechanics.json` feed-consumer precedent); WP-259 / D-24035 (the `/coverage` build-time-bundle + `check-generated-data.mjs` precedent this mirrors).

---

## Goal

After this session, the operator dashboard serves a new **`/debug/effects`** page — a searchable, read-only view of the generated Effect Implementation Index (`data/metadata/effect-implementation-index.json`, WP-484). For every card × mechanic across both scopes (hero + villain) it renders the `scope`, `status`, `handler`, `wp`, and `decision` the index already carries, plus per-card grouping and a `summary` header — the single place the *"card X's printed ability didn't fire — which handler ran, and under which decision?"* question gets answered (the canonical *"Mystique's Escape didn't fire a Scheme Twist"* case). The page is the **third and final piece** of the ewiki `wiki/debug-effects.md` recommended direction (piece 1 = the generated index, shipped WP-484; piece 2 = runtime effect tracing, a separate future WP). It authors **no new effect data, adds no second parser, and touches no engine/registry/server code** — it is a pure read-only consumer of the CI-gated index, loaded via the same build-time-bundle path `/coverage` uses. Locked by D-24292.

## User-Visible Impact

An operator opening the dashboard sees a new **Debug Effects** nav entry → `/debug/effects`, a page listing every card × mechanic across both scopes with its `status`, executing `handler`, and governing `wp`/`decision`, filterable by scope/status/has-handler and searchable by card. It answers "which handler runs card X's effect, and under which decision?" in one place. No change to any gameplay, player-facing, or public surface — this is an internal operator/developer tool behind the existing dashboard auth gate. D-24026 live-verification applies (the page must render on the deployed dashboard).

---

## Assumes (Hard-Gate Preconditions — MUST PASS BEFORE EDIT)

Run each command from the repo root. If ANY produces output other than the stated expectation, this packet is **BLOCKED** — STOP and report; do not edit.

```bash
# A. The generated Effect Implementation Index exists and carries the locked contract (WP-484)
node -e "const d=require('./data/metadata/effect-implementation-index.json'); if(d.version!==1||d.scope!=='all'||!Array.isArray(d.entries)||typeof d.cards!=='object'||typeof d.summary!=='object') process.exit(1); console.log('A_OK entries='+d.entries.length+' cards='+Object.keys(d.cards).length);"
# Expected: A_OK entries=<n> cards=<m>

# B. EffectImplementationIndexSchema is exported from the browser-safe /schema subpath (data-only)
node -e "const p=require('./packages/registry/package.json'); if(!p.exports['./schema']) process.exit(1); console.log('B_OK', p.exports['./schema'].import);"
# Expected: B_OK ./dist/schema.js

# C. The dashboard host + the /coverage build-time-bundle precedent are present
test -f apps/dashboard/src/router/index.ts && test -f apps/dashboard/src/pages/coverage/CoveragePage.vue && test -f apps/dashboard/src/composables/useCoverageLedger.ts && test -f apps/dashboard/scripts/build-coverage-ledger.mjs && test -f apps/dashboard/scripts/check-generated-data.mjs && echo "C_OK"
# Expected: C_OK

# D. No /debug/effects route or effects page exists yet (this WP introduces it)
grep -q "debug/effects" apps/dashboard/src/router/index.ts && echo "EXISTS" || echo "ABSENT"
# Expected: ABSENT (STOP and inspect provenance if EXISTS)

# E. The registry workspace package + its browser-safe /schema subpath exist (the dep this WP
#    ADDS to apps/dashboard). The dashboard does NOT depend on the registry yet — adding that
#    workspace dep is IN SCOPE (see Scope (In)); do not treat its absence as a blocker.
test -d packages/registry && node -e "process.exit(require('./packages/registry/package.json').exports['./schema']?0:1)" && echo "E_OK"
# Expected: E_OK  (peer apps declare `@legendary-arena/registry: workspace:*`; this WP adds it to the dashboard)

# F. Governance docs exist
test -f docs/ai/DECISIONS.md && test -f docs/ai/ARCHITECTURE.md && echo "F_OK"
# Expected: F_OK
```

If A or B fails, WP-484's artifact/schema is not on `main` as assumed — STOP and reconcile before building a consumer.

---

## Context (Read First)

- `data/metadata/effect-implementation-index.json` (WP-484 / D-24289) — the data source. Top-level `{ version:1, scope:"all", generatedAt, summary:{totalEntries,byScope,byStatus}, entries:[{extId,name,set,scope,mechanic,status,handler,wp,decision}], cards:{extId:{scope,mechanics[]}} }`. `handler`/`wp`/`decision` are verbatim ledger pass-throughs (`""` on `unsupported`/`unmarked` rows). This WP renders it verbatim; it computes no new provenance.
- `packages/registry/src/schema.ts` `EffectImplementationIndexSchema` (+ inferred `EffectImplementationIndex` / `EffectImplementationEntry` types) — the data-only Zod contract, exported via the browser-safe `@legendary-arena/registry/schema` subpath. The viewer imports the schema (for a defensive `safeParse` at load) and the inferred types — never the registry barrel (which pulls Node built-ins and breaks the Vite build), and never the game engine.
- `apps/dashboard/src/pages/coverage/CoveragePage.vue` + `apps/dashboard/src/composables/useCoverageLedger.ts` — the closest HOST precedent. `/coverage` renders a committed coverage artifact via a **build-time bundle copy** (not R2, not mock-mode): `useCoverageLedger.ts` statically imports `../data/coverage-ledger.json`. Mirror this composable→page shape.
- `apps/dashboard/scripts/build-coverage-ledger.mjs` — the build-time copy precedent. It copies canonical committed artifacts from the repo root into gitignored `apps/dashboard/src/data/*.json` (the dashboard cannot statically import a file outside its package root), writing an empty stub on failure so a missing artifact never aborts the build. The new copy script mirrors this exactly for the effect index.
- `apps/dashboard/scripts/check-generated-data.mjs` — the `pretest` guard that fails legibly when a gitignored `src/data/*.json` build output is missing (fresh clone / worktree). The new bundled file is added to its `GENERATED_DATA_FILES` list.
- `apps/dashboard/src/router/index.ts` — the Vue Router routes table; `/coverage` and `/debug` are sibling children of the auth-gated `AppLayout`. The new `debug/effects` route is added here.
- `apps/dashboard/src/layouts/AppLayout.vue` — the dashboard nav; a link to `/debug/effects` is added here for discoverability.
- `wiki/debug-effects.md` (landed on `main` via #1153) — the authority page that places this viewer on the dashboard beside `/coverage` and `/debug`, and scopes it to the static index (runtime traces are a separate future piece). Context, not a hard code dependency.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the dashboard app may consume the registry `/schema` subpath (a downward App→Registry data import); it must not import the game engine or reach the server/persistence layer. This viewer reads a committed JSON bundle only.

---

## Scope (In)

- Add `apps/dashboard/scripts/build-effect-index.mjs` — a build-time copy script mirroring `build-coverage-ledger.mjs`: copies the repo-root `data/metadata/effect-implementation-index.json` into gitignored `apps/dashboard/src/data/effect-implementation-index.json`, validating that it parses and writing an empty-index stub (with an `error` field) on any read/parse failure so the build never aborts.
- Add `@legendary-arena/registry` (`workspace:*`) to `apps/dashboard/package.json` `dependencies` (+ `pnpm install`, which regenerates the tracked root `pnpm-lock.yaml` — that regenerated lockfile MUST be committed, or CI's `pnpm install --frozen-lockfile` fails). This pulls in the browser-safe `@legendary-arena/registry/schema` subpath the composable imports for `safeParse` + the inferred types. It is a **new** App→Registry data dependency (the dashboard does not declare it today); a downward, browser-safe (zod-only) import that `registry-viewer` and `apps/server` already declare the same way (`workspace:*`). (`apps/arena-client` deliberately does NOT depend on the registry — architecture.md forbids a registry runtime import there — so it is not the precedent.)
- Add `apps/dashboard/src/composables/useEffectIndex.ts` — statically imports the bundled `../data/effect-implementation-index.json`, validates it once with `EffectImplementationIndexSchema.safeParse` (never throws — an invalid/missing bundle yields an empty index + a load-error flag, the `/coverage` empty-state posture). Because the schema is `.strict()`, the copy script's empty-stub carries a top-level `error` key that fails `safeParse` by design; the composable therefore surfaces the human-readable load-error message from a loose `{ error?: string }` view of the **raw import**, not from `safeParse` output (and falls back to a generic full-sentence message when a corrupt real bundle fails with no `error` key). It exposes an optional injection seam — `useEffectIndex(options?: { index?: EffectImplementationIndex })`, defaulting to the bundled static import, mirroring `useCoverageLedger(options?: { ledger? })` — so the empty/error branch is reachable in `node:test` without module mocking. Exposes read-only computed refs: the `summary`, the `entries[]`, the `cards{}` join, and derived helpers for the page's search/filter (by `extId`/`name`, by `scope`, by `status`, by whether a `handler` is present).
- Add `apps/dashboard/src/composables/useEffectIndex.test.ts` — composable-level `node:test` coverage (the dashboard's test convention — no page-level test): the composable loads the committed index, the summary tallies match, the scope/status filters partition correctly, and the empty/error path is handled.
- Add `apps/dashboard/src/pages/debug/EffectsPage.vue` — the `/debug/effects` page: a `summary` header (totals by scope + status), a text search box, `scope`/`status`/has-handler filters, and a table of `entries` showing `extId` · `name` · `set` · `scope` · `mechanic` · `status` · `handler` · `wp` · `decision`, mirroring `CoveragePage.vue`'s structure and the dashboard's existing styling. Blank `handler`/`wp`/`decision` render as a neutral "—" (surfacing "no handler ran"), never fabricated.
- Modify `apps/dashboard/src/router/index.ts` — add a `{ path: 'debug/effects', name: 'debug-effects', component: () => import('../pages/debug/EffectsPage.vue') }` child route beside the existing `debug` route.
- Modify `apps/dashboard/src/layouts/AppLayout.vue` — add a nav link to the new route for discoverability.
- Modify `apps/dashboard/package.json` — add `build-effect-index.mjs` into the `build` chain (after `build-coverage-ledger.mjs`) and a `prebuild:effect-index` convenience script, mirroring `prebuild:coverage`.
- Modify `apps/dashboard/scripts/check-generated-data.mjs` — add `src/data/effect-implementation-index.json` (remedy: `pnpm --filter @legendary-arena/dashboard prebuild:effect-index`) to `GENERATED_DATA_FILES`.
- Modify `apps/dashboard/.gitignore` — add the line `src/data/effect-implementation-index.json` (the `.gitignore` is per-file, not a `src/data/*` glob — it lists `coverage-ledger.json` etc. individually, so the new build output must be added explicitly or it would be committed).
- Reserve and land D-24292 (host + read-only-derived + build-time-bundle load-path + trace-deferred lock).

## Out of Scope

- Any `packages/game-engine`, `packages/registry`, `apps/server`, `apps/registry-viewer`, or `apps/arena-client` file — no engine read, no schema change, no new endpoint, no cross-app edit. The viewer consumes the existing `data/metadata/effect-implementation-index.json` + `EffectImplementationIndexSchema` only.
- **Runtime effect tracing** — the structured per-dispatch `[EFFECT]` trace described in the Debug Effects page (piece 2 of the direction) is a separate future WP. This viewer renders the static index only; it shows no live per-seat traces.
- **Descriptor-level / per-ability-line granularity** — the index is per card × mechanic (the ledger granularity); a finer descriptor→handler drill-down is a WP-484-deferred future refinement, not consumed here.
- **Regenerating or modifying the index** — this WP never runs the WP-484 transform, never edits `effect-implementation-index.json`, `EffectImplementationIndexSchema`, or either mechanic ledger. It reads the committed artifact read-only.
- **Fetching the index from R2** — the dashboard convention is the build-time bundle copy (`/coverage`), not a runtime R2 fetch. The published R2 copy at `images.legendary-arena.com/metadata/effect-implementation-index.json` is unchanged and unused by this page.
- **Cross-linking to Play Diagnostics / the hollow detector / `/coverage`** — deep-links between debugging surfaces are a nicety, not this slice; the page stands alone over the index.
- **New analytics/mock-mode plumbing** — the page uses the build-time static import (like `/coverage`), not the dashboard's `useFetch` + `*Mocks.ts` live-analytics path.
- **Auth/role changes** — the page inherits the existing `AppLayout` auth gate; no new route-meta or role logic.

---

## Files Expected to Change

- `apps/dashboard/scripts/build-effect-index.mjs` — **new** (build-time copy of the root index into gitignored `src/data`, empty-stub-on-failure; mirrors `build-coverage-ledger.mjs`)
- `apps/dashboard/src/composables/useEffectIndex.ts` — **new** (static import + `EffectImplementationIndexSchema.safeParse` + read-only computed refs / filters)
- `apps/dashboard/src/composables/useEffectIndex.test.ts` — **new** (`node:test` composable coverage; dashboard test convention)
- `apps/dashboard/src/pages/debug/EffectsPage.vue` — **new** (the `/debug/effects` searchable table + summary)
- `apps/dashboard/src/router/index.ts` — **modified** (add the `debug/effects` child route)
- `apps/dashboard/src/layouts/AppLayout.vue` — **modified** (add the nav link)
- `apps/dashboard/package.json` — **modified** (add the `@legendary-arena/registry` `workspace:*` dep; `build` chain + `prebuild:effect-index`)
- `apps/dashboard/scripts/check-generated-data.mjs` — **modified** (add the new `src/data` file to the guard)
- `apps/dashboard/.gitignore` — **modified** (add `src/data/effect-implementation-index.json`; per-file, mirroring `coverage-ledger.json`)
- `pnpm-lock.yaml` — **modified** (regenerated by `pnpm install` when the `@legendary-arena/registry` `workspace:*` dep is added to the dashboard; the tracked lockfile must be committed or CI's `pnpm install --frozen-lockfile` fails)
- `docs/ai/DECISIONS.md` — **modified** (land D-24292)
- `docs/ai/STATUS.md` — **modified** (Done entry)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (status flip)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (status flip)
- `docs/05-ROADMAP-MINDMAP.md` — **modified** (flip the WP-487 node `📝` → `✅`; then `pnpm roadmap:counts:write`)

**Not committed (gitignored build output, mirrors `coverage-ledger.json`):** `apps/dashboard/src/data/effect-implementation-index.json` — produced by `build-effect-index.mjs`, imported statically by the composable, **added to** the dashboard `.gitignore` by this WP (the `.gitignore` is per-file, so the new build output must be listed explicitly — see the `.gitignore` allowlist entry above).

10 producer/config files (4 new + 6 modified — 9 under `apps/dashboard`, plus the root `pnpm-lock.yaml` the dep addition regenerates) + 5 governance. The page, composable, copy script, route, nav, the registry dep, the `package.json`/`.gitignore`/lockfile wiring, and the freshness guard form one indivisible deliverable — a page with no route is dead, a static import with no copy script fails the build, a `safeParse` with no registry dep fails to resolve, a `package.json` dep with no committed lockfile fails `--frozen-lockfile` CI — so the bundle is justified inline per the §5 file-count guidance. Single layer (App); standard two-session lane (>4 code files + two runtime-wiring touches — router + nav).

---

## Contract (Locked by D-24292)

The viewer is a **read-only consumer** of the WP-484 contract; it introduces **no new persisted or published contract**. What D-24292 locks:

- **Host:** the page lives at dashboard route `/debug/effects` (child `name: 'debug-effects'`), beside `/coverage` and `/debug`, under the existing `AppLayout` auth gate. It is a dashboard page, never a registry-viewer / arena-client / server surface.
- **Data source & load path:** the single source is `data/metadata/effect-implementation-index.json` (WP-484). It is consumed via a **build-time bundle copy** into gitignored `apps/dashboard/src/data/effect-implementation-index.json` and a **static import** in the composable — the `/coverage` (`build-coverage-ledger.mjs` + `useCoverageLedger.ts`) precedent — NOT a runtime R2 fetch and NOT the analytics mock-mode path. The bundled file is a build output (gitignored), guarded by `check-generated-data.mjs`.
- **Read-only / no second parser:** the viewer authors no effect data, computes no `status`/`handler`/`wp`/`decision`, and adds no parser. It renders the index verbatim and validates it with the existing `EffectImplementationIndexSchema.safeParse` at load — imported via a **new `@legendary-arena/registry` `workspace:*` dep** on `apps/dashboard` (the browser-safe `/schema` subpath; the dashboard's first registry dep, a downward App→Registry data import). A missing/invalid bundle yields an empty index + a visible load-error state (never a throw, never a fabricated value) — the `/coverage` empty-state posture. Because the schema is `.strict()`, the copy script's empty-stub `error` key intentionally fails `safeParse`; the load-error message is read from the raw import, not the `safeParse` result. Blank `handler`/`wp`/`decision` render as a neutral "—", the honest "no handler ran" signal.
- **Deferred (each a separate future WP):** runtime effect tracing (piece 2 of the ewiki direction); descriptor-level / per-ability-line granularity; any deep-link integration with Play Diagnostics / the hollow detector; any R2-fetch variant.

### Determinism / persistence

N/A to gameplay. The viewer touches no `G`/`ctx`/RNG/replay/scoring surface, persists nothing, and reads a static committed artifact. The build-time copy is deterministic (a byte copy of the committed source, empty-stub only on read failure).

### Code-style / output discipline

Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names, `for...of` over branching `.reduce()`, `// why:` comments where required (see the EC), full-sentence error/empty-state messages. ESM only, Node v22+; the copy script is `.mjs` with `node:`-prefixed built-in imports. The session output emits **full file contents** for every new/modified file — no diffs, no snippets.

---

## Acceptance Criteria

1. `pnpm --filter @legendary-arena/dashboard prebuild:effect-index` copies `data/metadata/effect-implementation-index.json` to `apps/dashboard/src/data/effect-implementation-index.json`; the copy is byte-equal to the source (trailing newline normalized) and is gitignored.
2. `build-effect-index.mjs` writes an empty-index stub (with an `error` field) and exits 0 when the source is missing/unparseable — the build never aborts (mirrors `build-coverage-ledger.mjs`).
3. `check-generated-data.mjs` lists `src/data/effect-implementation-index.json` with the `prebuild:effect-index` remedy; `pretest` fails legibly (naming that remedy) when the bundle is absent and exits 0 when present.
4. `useEffectIndex.ts` statically imports the bundled index (default) and validates it once with `EffectImplementationIndexSchema.safeParse`; on failure it exposes an empty index + a load-error flag and never throws. It accepts an optional injected index (`useEffectIndex(options?: { index? })`, the `useCoverageLedger` seam) for testability, and surfaces the raw `error` message (or a generic full-sentence fallback when none is present) rather than a blank banner.
5. `useEffectIndex` exposes read-only refs: `summary` (totals + byScope + byStatus), the full `entries[]`, the `cards{}` join, and filter helpers by text (`extId`/`name`), `scope`, `status`, and has-handler — the composable computes no new provenance.
6. `/debug/effects` renders a summary header, a search box, `scope`/`status`/has-handler filters, and a table with columns `extId`, `name`, `set`, `scope`, `mechanic`, `status`, `handler`, `wp`, `decision`; blank `handler`/`wp`/`decision` show a neutral "—".
7. The `debug/effects` route resolves (child `name: 'debug-effects'`) and `AppLayout` shows a nav link to it; both sit under the existing auth gate (no new role/meta).
8. `apps/dashboard/package.json` declares `@legendary-arena/registry: workspace:*`, and the page/composable import `@legendary-arena/registry/schema` (schema + inferred types) — NOT the registry barrel and NOT `@legendary-arena/game-engine`; `grep` for both in the new/modified dashboard source finds no barrel/engine import.
9. `useEffectIndex.test.ts` passes: summary tallies match the loaded entries, scope/status filters partition correctly, and the empty/error path is covered by injecting a `safeParse`-failing index via the `useEffectIndex({ index })` seam (no module mocking) — keeping the dashboard branch/function coverage thresholds attainable.
10. `pnpm --filter @legendary-arena/dashboard test` and `pnpm --filter @legendary-arena/dashboard build` exit 0; the dashboard coverage thresholds (lines 90 / branches 80 / functions 88) still hold.
11. `pnpm -r build` and `pnpm -r --no-bail test` exit 0; no `packages/game-engine`, `packages/registry`, `apps/server`, `apps/registry-viewer`, or `apps/arena-client` file is modified.

---

## Verification Steps

```bash
# 1. Copy script + byte-equality + gitignored
pnpm --filter @legendary-arena/dashboard prebuild:effect-index
node -e "const a=require('fs').readFileSync('data/metadata/effect-implementation-index.json','utf8').replace(/\r\n/g,'\n'); const b=require('fs').readFileSync('apps/dashboard/src/data/effect-implementation-index.json','utf8').replace(/\r\n/g,'\n'); if(a.trim()!==b.trim())process.exit(1); console.log('byte-equal OK');"
git check-ignore apps/dashboard/src/data/effect-implementation-index.json && echo "gitignored OK"
# Expected: byte-equal OK / gitignored OK

# 2. Freshness guard lists the new file
grep -n "effect-implementation-index.json" apps/dashboard/scripts/check-generated-data.mjs
# Expected: a GENERATED_DATA_FILES entry with the prebuild:effect-index remedy

# 3. No barrel / no engine import in the new dashboard source
grep -rnE "from ['\"]@legendary-arena/registry['\"]|@legendary-arena/game-engine" apps/dashboard/src/composables/useEffectIndex.ts apps/dashboard/src/pages/debug/EffectsPage.vue
# Expected: NO MATCH (schema comes from @legendary-arena/registry/schema, engine never imported)

# 4. Route registered
grep -n "debug/effects" apps/dashboard/src/router/index.ts
# Expected: the debug/effects child route line

# 5. Composable tests
pnpm --filter @legendary-arena/dashboard test 2>&1 | tail -5
# Expected: exit 0; useEffectIndex tests pass

# 6. Dashboard build + coverage thresholds
pnpm --filter @legendary-arena/dashboard build 2>&1 | tail -3
pnpm --filter @legendary-arena/dashboard test:coverage 2>&1 | tail -5
# Expected: both exit 0

# 7. No cross-package file touched
git diff --name-only | grep -E '^(packages/(game-engine|registry)|apps/(server|registry-viewer|arena-client))/' ; echo "hits above (expect none)"

# 8. Lockfile committed + frozen install clean (the registry dep regenerated pnpm-lock.yaml)
pnpm install --frozen-lockfile 2>&1 | tail -2
# Expected: exit 0 (no lockfile drift — the regenerated pnpm-lock.yaml is committed)

# 9. Full build/test
pnpm -r build && pnpm -r --no-bail test
# Expected: both exit 0

# 10. Live render (post-deploy; D-24026): load the deployed dashboard /debug/effects,
#    confirm the summary + table render, a search/filter narrows rows, and a
#    known executable villain (e.g. Cyber-Nostra / hero-deck-top-to-escape) shows
#    its <file>#<primitive> handler while an unmarked row shows "—".
```

---

## Definition of Done (Binary Gate — ALL must pass)

- [ ] All preconditions (A–F) passed before the edit
- [ ] All 11 Acceptance Criteria pass
- [ ] All 10 Verification Steps produce the expected output (Step 10 is the post-deploy live check)
- [ ] `/debug/effects` renders the summary + the `extId/name/set/scope/mechanic/status/handler/wp/decision` table; blank provenance shows "—", never fabricated
- [ ] The composable loads the bundled index via static import + `EffectImplementationIndexSchema.safeParse`, empty/error state on failure (never throws)
- [ ] The copy script + `check-generated-data.mjs` guard + `package.json` build wiring mirror the `/coverage` precedent; `src/data/effect-implementation-index.json` is gitignored
- [ ] No barrel / no `@legendary-arena/game-engine` import in the new dashboard source (schema via the `/schema` subpath)
- [ ] Dashboard build + test + coverage thresholds green; no `packages/game-engine` / `packages/registry` / `apps/server` / `apps/registry-viewer` / `apps/arena-client` file modified
- [ ] `docs/ai/STATUS.md` Done entry names WP-487 + the page, and records the D-24026 live-verify as operator-pending (`User-Visible Surface = dashboard /debug/effects`)
- [ ] `docs/ai/DECISIONS.md` D-24292 landed (host + read-only-derived + build-time-bundle load-path + trace-deferred lock); Status flips to Active
- [ ] WORK_INDEX + EC_INDEX rows flipped to Done; `docs/05-ROADMAP-MINDMAP.md` WP-487 node flipped `📝` → `✅`, `pnpm roadmap:counts:write` run, `roadmap:counts:check` exits 0
- [ ] Commit prefix `EC-522:` for code, `SPEC:` for governance close
- [ ] D-24026 live-verification: `/debug/effects` confirmed rendering on the deployed dashboard (operator-pending; the packet is not user-Done until this passes)

---

## Gate Verdicts (drafting session)

### Pre-Flight (`01.4`) — verdict: **READY TO EXECUTE** (2026-08-01, after three adversarial re-verify rounds)

Dependencies verified empirically against the actual repo, not asserted: the WP-484 index (`data/metadata/effect-implementation-index.json`, 1362 entries / 1029 cards) is on `main`; `EffectImplementationIndexSchema` is exported from the browser-safe `@legendary-arena/registry/schema` subpath (zod-only, `./dist/schema.js`); the `/coverage` build-time-bundle precedent (`useCoverageLedger.ts` + `build-coverage-ledger.mjs` + `check-generated-data.mjs` + the router + `AppLayout`) all exist and work as the WP claims. The independent pre-flight caught — and this WP now fixes — three allowlist gaps execution would otherwise have been forced to touch: (1) `apps/dashboard/.gitignore` is per-file, so the new build output must be added there explicitly; (2) the dashboard did not yet depend on `@legendary-arena/registry`, so the `safeParse` lock requires adding the `workspace:*` dep; and (3) that dep regenerates the tracked `pnpm-lock.yaml`, which CI's `--frozen-lockfile` requires committed. All three are now in the closed allowlist. Layer boundary holds (downward App→Registry, `/schema` subpath only — no barrel, no game-engine). **Empirical Scaffold N/A** — additive new input path (a brand-new page over an existing artifact); it tightens no existing validation path with pre-existing fixtures. **Mutation Boundary N/A** — no `G`/move mutation (a read-only dashboard page).

### Copilot (`01.7`) — verdict: **PASS** (2026-08-01, after one RISK round)

No BLOCK across the failure-mode lens. Separation of concerns / layer boundary (App→Registry `/schema` subpath only; no engine/barrel/server), determinism/persistence (no `G`/RNG/replay; deterministic build copy; nothing persisted), contract fidelity (renders the index verbatim; closed `scope`/`status` unions honored in the schema, not recomputed; no second parser), the load-honesty rule (blank `handler`/`wp`/`decision` → "—", never fabricated — locked in AC-6 + guardrails + a `// why:` + a failure smell), scope/governance (11 AC, closed allowlist, two-commit topology, D-24292 lock, User-Visible Surface + D-24026), and error handling (never-throws; `.strict()`/error-key handling) all cleared. The copilot RISK — the composable needed a `useEffectIndex(options?: { index? })` injection seam (mirroring `useCoverageLedger`) for the empty/error branch to be reachable under the dashboard coverage thresholds, plus reading the off-contract `error` key through a loose view with a generic full-sentence fallback — was folded into the EC Locked Values, the composable spec, AC-4/AC-9, and the failure smells; the re-verify confirmed PASS with no new inconsistency.

### Lint Gate (`00.3`) — verdict: **SATISFIED** (21/21)

- **§1 Structure** — PASS (all required sections; Out of Scope lists 7 exclusions; constraints folded into Goal/Scope/Contract/EC-Guardrails per the living convention of WP-471..475).
- **§2 Non-Negotiable Constraints** — PASS (Contract §Code-style / output discipline cites `00.6-code-style.md` + the full-file-contents / ESM / Node v22+ output discipline).
- **§3 Assumes** — PASS (preconditions A–F with exact expected output; the added registry dep framed as in-scope, not a false blocker).
- **§4 Context** — PASS (the WP-484 index, the schema, the `/coverage` composable + page + both build scripts, the router + `AppLayout`, ARCHITECTURE layer boundary — all specific). 00.2 N/A — renders WP-484's already-governed index verbatim; defines no new data shape.
- **§5 Files Expected to Change** — PASS (closed 10-file producer/config allowlist incl. `.gitignore` / `package.json` / `pnpm-lock.yaml` + the gitignored build output marked not-committed; bundling justified inline).
- **§6 Naming** — PASS (route `debug-effects`; the 9-field entry set matches the WP-484 contract; no invented names).
- **§7 Dependencies** — PASS (adds `@legendary-arena/registry: workspace:*` — exact name + range + lockfile output; no new external npm dep).
- **§8 Architectural Boundaries** — PASS (App→Registry `/schema` subpath only; barrel + game-engine forbidden in Out-of-Scope + EC guardrail + Verification-3 grep).
- **§9 Windows Compatibility** — PASS (`.mjs` + `pnpm --filter` + `node -e` via the Bash tool, established convention).
- **§10 Env Vars** — N/A (build-time static import; no runtime fetch, no new browser env var).
- **§11 Auth** — N/A (inherits the existing `AppLayout` auth gate; no new role/meta).
- **§12 Test Quality** — PASS (`node:test` composable coverage; no network/DB/boardgame.io; the injection seam makes the invariant branches reachable).
- **§13 Verification Commands** — PASS (all `pnpm`/`node`; exact with expected output; steps 1–10, live-render is 10).
- **§14 Acceptance Criteria** — PASS (11 binary, observable, file-specific).
- **§15 Definition of Done** — PASS (STATUS + DECISIONS D-24292 + WORK_INDEX + EC_INDEX + ROADMAP-MINDMAP + scope-boundary check; a `## User-Visible Impact` section + the D-24026 live-verify item for a user-visible surface).
- **§16 Code Style** — PASS (`for...of`, `// why:` locations in the EC, full-sentence errors, `/schema` named import).
- **§17 Vision Alignment** — present (§10 / §22; No conflict; NG-1..NG-8 proximity checked; determinism-preservation line).
- **§18 Prose-vs-Grep** — PASS (Verification-3 greps the two new dashboard source files, not this doc; no self-trip).
- **§19 Bridge-vs-HEAD** — commit-time discipline; STATUS authored at execution against live HEAD.
- **§20 Funding Surface Gate** — N/A (internal operator tooling; no §20.1 trigger; authority WP-097 / D-9701 / D-9801).
- **§21 API Catalog** — N/A (no HTTP endpoint, no `apps/server/src/**` library fn; reads a build-time bundle).

No ❌ FAIL triggers. Gate satisfied.

## Vision Alignment

**Vision clauses touched:** §10 (card data / effect semantics — read-only, rendered not computed), §22 (determinism — the viewer touches no `G`/RNG/replay surface; the build copy is a deterministic byte copy).

**Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The page is a read-only projection of an existing committed, CI-gated artifact into an operator-only dashboard view — it changes no card semantics, adds no gameplay behavior, and authors no new effect data.

**Non-Goal proximity check:** none of NG-1..NG-8 are crossed — the viewer is an internal developer/operator debugging surface carrying no monetization, persuasion, pay-to-win, or competitive-integrity surface.

**Determinism preservation:** the viewer is replay-irrelevant — it reads a static committed JSON, touches no `G`/`ctx`/RNG/scoring/replay surface, and the build-time copy is a deterministic byte copy (empty-stub only on read failure).

## Funding Surface Gate

**N/A — no funding surface touched.** No §20.1 trigger: no navigation/registry-viewer funding affordance, no profile/account funding attribution, no tournament-funding integration, no user-visible funding copy. Internal operator-dashboard debugging tooling only. (Authority chain per §20 form: WP-097, D-9701, D-9801.)

## API Catalog Update

**N/A — no API surface touched.** Per lint §21.4: no HTTP endpoint and no `apps/server/src/**` library function added or modified. The page reads a build-time-bundled static JSON; `docs/ai/REFERENCE/api-endpoints.md` is unaffected.
