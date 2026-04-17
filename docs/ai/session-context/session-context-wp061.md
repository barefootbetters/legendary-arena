WP-065 is complete (commit bc23913). Key context for WP-061:

- 396 repo tests passing: 3 (packages/registry) + 376 (packages/game-engine)
  + 11 (packages/vue-sfc-loader) + 6 (apps/server). 0 failures.
- New Shared Tooling package `@legendary-arena/vue-sfc-loader` now available
  under `packages/vue-sfc-loader/`, letting `node:test` consumers import
  `.vue` SFCs directly via a Node 22 `module.register()` hook.
- Phase 6 continues. WP-061 dependencies (WP-028 UI State Contract and
  WP-065 Vue SFC Test Transform) are both complete.
- WP-061 is the next unblocked WP in the UI chain; WP-062 (Arena HUD) and
  WP-064 (Game Log & Replay Inspector) depend on WP-061.
- WP-061: Gameplay Client Bootstrap — creates `apps/arena-client/` as a
  new Vue 3 + Vite + Pinia + TypeScript SPA with a single `useUiStateStore()`
  slot and a `<BootstrapProbe />` wiring smoke test. Engine import is
  type-only. No HUD, routing, networking, or auth in this WP.

vue-sfc-loader package (WP-065) — what WP-061 will consume:

- Package name: `@legendary-arena/vue-sfc-loader` (private, workspace)
- Consumer entry point: the single `./register` subpath export
  (`@legendary-arena/vue-sfc-loader/register`). `.` and `./loader`
  subpaths are intentionally not exposed — if WP-061 wants the pure
  `compileVue` helper for custom tooling, it would need a WP-065-scoped
  amendment to add a `.` export; do not add it ad-hoc in WP-061.
- Canonical `NODE_OPTIONS` composition pattern (D-6507, locked):
  `NODE_OPTIONS="--import tsx --import @legendary-arena/vue-sfc-loader/register"`
  tsx **must** appear first; reversing the order breaks `<script lang="ts">`
  handling.
- `apps/arena-client/` should list `@legendary-arena/vue-sfc-loader` under
  `devDependencies` only — never `dependencies` (ARCHITECTURE.md
  Anti-Production-Bundle rule; Shared Tooling is test-time only).
- Vue version pin is `^3.4.27` in vue-sfc-loader's peerDependencies —
  `apps/arena-client/` should match (D-6502). `apps/registry-viewer/`
  already pins `vue@^3.4.27`.
- pnpm installed vue 3.5.30 against the `^3.4.27` pin; end-to-end tests
  pass with that resolution. If pnpm resolves a different Vue minor for
  `apps/arena-client/`, jsdom mount setup may need `SVGElement` and
  `MathMLElement` injected into globalThis (the WP-065 loader test does
  this explicitly).
- The vue-sfc-loader `build` is `tsc` only — no esbuild, rollup, swc, or
  babel. WP-061's test setup must not introduce a second TS loader
  beyond `tsx`; the existing `apps/registry-viewer/` test infrastructure
  (if any) should be mirrored, not extended.

Key artifacts produced by WP-065:

- `packages/vue-sfc-loader/src/compileVue.ts` — pure helper
  `compileVue(source, filename): { code, map? }`. Not exported from the
  package's exports map; reachable only through the loader hook.
- `packages/vue-sfc-loader/src/loader.ts` — Node 22 `load` hook; intercepts
  `.vue` URLs only; delegates all other extensions to `nextLoad`.
- `packages/vue-sfc-loader/src/register.ts` — two-line entry that calls
  `register('./loader.js', import.meta.url)` from `node:module`.
- `packages/vue-sfc-loader/test-fixtures/hello.vue` — reference SFC for
  vue-sfc-loader's own tests; not a shared fixture for consumers.
- `packages/vue-sfc-loader/README.md` — canonical `NODE_OPTIONS` pattern,
  worked example, debugging guide, cross-reference to EC-065 §Common
  Failure Smells.

Architectural patterns still in effect:

- D-0301 (UI Consumes Projections Only) — arena-client renders
  `UIState`, never reaches into `G`.
- D-0302 (Single UIState, Multiple Audiences) — `filterUIStateForAudience`
  (WP-029) is the audience filter; arena-client consumes a filtered
  UIState, not the raw one.
- D-2801 through D-2804 — UI projection invariants (zone counts, not
  arrays; engine internals hidden; card display resolution separate).

Relevant decisions for WP-061:

- D-6501 — Shared Tooling classification for packages/vue-sfc-loader/
- D-6502 — Vue version pinning via peerDependencies (^3.4.27)
- D-6503 — apps/registry-viewer/ prior-shim disposition: none found
  (confirms arena-client has a clean starting point; no prior shim to
  consolidate)
- D-6506 — TS strategy outcome for vue-sfc-loader: Outcome B (TS remains
  after @vue/compiler-sfc.compileScript; internal transpileModule pass
  required)
- D-6507 — Canonical NODE_OPTIONS composition (tsx first, vue-sfc-loader
  second)
- D-6508 — Canonical TS loader name = tsx
- D-6509 — POSIX filename normalization for compiler identity
- D-6510 — Sourcemap tolerance = .vue path + non-zero line, not perfect
  column accuracy

Files WP-061 will need to read before coding:

- `apps/registry-viewer/package.json` — the layout precedent for a Vue 3
  + Vite SPA in this repo; arena-client should follow the same
  dependency structure (Vue, Vite, TypeScript ESLint, etc.) without
  copying unrelated client code.
- `apps/registry-viewer/tsconfig*.json` — strict TS baseline for Vue 3
  SPAs in this repo.
- `packages/vue-sfc-loader/README.md` — the `NODE_OPTIONS` pattern
  arena-client will adopt in its `test` script.
- `packages/game-engine/src/ui/uiState.types.ts` — `UIState` and the
  nine sub-types arena-client will type-only-import.
- `packages/game-engine/src/ui/uiState.build.ts` — not imported by
  arena-client at runtime (engine import is type-only), but useful
  reading to understand the UIState shape arena-client will fixture-load.
- `docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md` — the
  authoritative WP spec.

WP-065 lessons (propagated to 01.4 §Precedent Log):

- P6-26: code-category PS-# pattern extends to `packages/*` workspace
  packages, not just `packages/game-engine/src/*` subdirectories;
  D-6501 establishes the precedent (first Shared Tooling entry).
- P6-27: any file beyond the WP's explicit "Files Expected to Change"
  allowlist is a scope violation, not a "minor additive deviation" —
  execution summary §Deviations is for Implementation Order drift, not
  for ergonomic extras.
- P6-28: 01.6 mandatoriness rules override session-prompt "recommended"
  softening language — if 01.6 §When Post-Mortem Is Required criteria
  apply, run the post-mortem regardless of how the session prompt frames
  it.
- P6-29: execution-time empirical smoke test for version-sensitive
  external dependencies — lock both outcome branches in the session
  prompt, defer the smoke test to the first execution step, record the
  resolved outcome in DECISIONS.md.

Steps completed for WP-065:
0: N/A — first Shared Tooling WP; no prior session-context file
1: pre-flight (2026-04-17, READY TO EXECUTE; inline in originating
   session, not saved as a standalone artifact)
2: session-wp065-vue-sfc-loader.md (generated)
3: execution (2026-04-17, 11 new tests, 0 fail; 396 repo-wide, 0 fail)
4: post-mortem (1 scope-violation fix applied: deleted `src/index.ts`,
   removed `.` and `./loader` subpaths from package.json exports,
   stripped Programmatic API section from README, corrected STATUS.md
   file count)
5: pre-commit review (2026-04-17, Safe to commit as-is)
6: commit (bc23913 EC-065: add Vue SFC test loader for node:test
   consumers)
7: lessons learned (4 new Precedent Log entries P6-26 through P6-29 in
   01.4)
8: this file

Run pre-flight for WP-061 next.
