WP-061 is complete (commit 2e68530). Key context for WP-062:

- Repo test baseline: 409 tests passing (3 registry + 376 game-engine + 11
  vue-sfc-loader + 6 server + 13 arena-client). 0 failures. WP-062 must not
  regress any of these counts.
- New Client App package `@legendary-arena/arena-client` now exists under
  `apps/arena-client/` as a buildable, testable Vue 3 + Vite + Pinia
  + TypeScript SPA. 18 committed files. `pnpm --filter
  @legendary-arena/arena-client build / typecheck / test` all exit 0.
- Phase 6 continues. WP-062 dependency status (CORRECTED 2026-04-17 after
  WP-061 execution): WP-028 UIState contract ✅ complete, WP-029
  audience-filtered UIState ✅ complete, WP-061 client bootstrap ✅
  complete (commit 2e68530), **WP-048 PAR scoring ⬜ NOT complete** (still
  Draft per WORK_INDEX.md:736). An earlier draft of this session-context
  file claimed WP-048 complete — that claim was wrong and has been
  corrected here.

IMPORTANT — dependency gaps discovered during WP-061 execution that WP-062
pre-flight MUST resolve before returning READY:

1. **WP-048 is not complete** (see above). WP-062 §Dependencies lists WP-048;
   pre-flight for WP-062 returns BLOCKED until WP-048 ships (or WP-062 is
   descoped to drop the PAR-delta readout).
2. **Even after WP-048 lands, WP-062 cannot consume its fields directly.**
   WP-048 §Out of Scope states verbatim: "No UI changes — scoring produces
   data, not display." WP-048 emits `ScoreBreakdown.{rawScore, parScore,
   finalScore}` inside `LeaderboardEntry`, NOT on `UIGameOverState`. WP-062
   assumes these fields are on `UIGameOverState` — they will not be.
   A missing intermediate WP is required ("Project ScoreBreakdown + live
   progress counters into UIState / UIGameOverState") before WP-062 can
   execute against real engine types.
3. **Several UIState field names WP-062 asserts do not exist in the engine
   today.** Specifically: `bystandersRescued`, `escapedVillains`,
   `schemeTwists`, `mastermindTacticsRemaining`, `mastermindTacticsDefeated`,
   `finalScore`, `parBaseline`, `rawScore`. Some have sibling fields under
   different names (`UISchemeState.twistCount`, `UIMastermindState
   .tacticsRemaining` / `.tacticsDefeated`, `FinalScoreSummary.winner`,
   `PlayerScoreBreakdown.totalVP`); others (`bystandersRescued`,
   `escapedVillains`) have no engine home. WP-062 pre-flight must either
   (a) reconcile the aria-label field names to the engine's actual names,
   or (b) depend on the intermediate UIState-extension WP in #2.

**Resolution path drafted and reviewed:** [WP-067 — UIState Projection
of PAR Scoring & Progress Counters](../work-packets/WP-067-uistate-par-projection-and-progress-counters.md)
was drafted 2026-04-17 and passed the 00.3 lint gate on the same day
(promoted to ✅ Reviewed in WORK_INDEX.md). Its execution contract lives
at [EC-068](../execution-checklists/EC-068-uistate-par-projection-and-progress-counters.checklist.md);
commits use the `EC-068:` prefix. Scope:

- Adds `UIProgressCounters { bystandersRescued, escapedVillains }` as
  `UIState.progress` (non-optional)
- Adds `UIParBreakdown { rawScore, parScore, finalScore,
  scoringConfigVersion }` as optional `UIGameOverState.par` (populated
  only at `phase === 'end'` when the match was PAR-configured)
- Aggregates `bystandersRescued` from players' victory piles at
  projection time (no new G counter introduced)
- Ships three WP-061 fixture type-conformance edits (single `progress`
  key addition per fixture) — scope-amended during lint-gate review to
  keep `pnpm -r test` green across the non-optional-field change. This
  means WP-062 does **not** need to update `mid-turn.json`,
  `endgame-win.json`, or `endgame-loss.json` for the `progress` field;
  they will already contain it after WP-067 lands. WP-062 may still
  choose to **extend** the fixtures with `gameOver.par` for PAR-render
  tests, but that is a WP-062-specific addition, not conformance.
- Depends on WP-028 (complete) and WP-048 (still Draft); lint-gate
  review completed ahead of WP-048 execution so WP-067 is ready to run
  the moment WP-048 lands.

Blocker #4 (base.css allowlist) is independent of WP-067 and remains on
the WP-062 side.

Sequencing options the human author must decide at WP-062 pre-flight:
- **Option A:** Execute WP-048 → WP-067 → WP-062 (strict chain, PAR
  render supported from day one).
- **Option B:** Execute a descoped WP-067 (progress counters only, drop
  the PAR portion) now; WP-062 ships with em-dash for PAR; WP-048 and a
  PAR-only follow-up land later.
- **Option C:** Descope WP-062 to drop the PAR-delta readout entirely;
  execute only the progress-counter portion of WP-067; WP-048 and a
  HUD PAR amendment land later as a pair.
- WP-062 is the next unblocked UI WP in the chain; WP-064 (Game Log &
  Replay Inspector) depends on WP-061 and WP-063 (replay snapshot
  producer). WP-063 does NOT depend on WP-061 and is parallel-safe with
  WP-062.
- WP-062: Arena HUD & Scoreboard — fixed (non-floating) HUD comprising
  `<TurnPhaseBanner />`, `<SharedScoreboard />`, `<ParDeltaReadout />`,
  `<PlayerPanelList />`, `<EndgameSummary />`. Consumes UIState projections
  via the WP-061 store; no engine runtime import, no registry access, no
  networking.

arena-client surface (WP-061) — what WP-062 will consume:

- Pinia store factory: `useUiStateStore()` from
  `apps/arena-client/src/stores/uiState.ts`. Exposes exactly one state
  field `snapshot: UIState | null` and exactly one action
  `setSnapshot(next: UIState | null)`. No getters, no additional state,
  no additional actions — the contract is frozen for every subsequent UI
  packet. WP-062 must NOT add additional state fields or actions to this
  store. If WP-062 needs derived view state (selectors, memoized
  computeds, audience-filter wrappers), those belong in new composables
  or new stores, not mutations to `uiState.ts`. Any divergence requires a
  DECISIONS.md entry.
- Fixture loader: `loadUiStateFixture(name: FixtureName): UIState` from
  `apps/arena-client/src/fixtures/uiState/index.ts`. FixtureName union is
  `'mid-turn' | 'endgame-win' | 'endgame-loss'`. `isFixtureName(string):
  candidate is FixtureName` is a type guard. Single code path — no
  environment branching. WP-062 should consume fixtures unchanged; if a
  new fixture shape is needed for HUD testing, add a new committed JSON
  + typed re-export rather than mutating the three bootstrap fixtures.
- Typed fixture layer: `apps/arena-client/src/fixtures/uiState/typed.ts`.
  Applies `satisfies UIState` per imported JSON. Never `as UIState`. Any
  new fixture in WP-062 must follow this pattern (D-6514).
- Wiring probe: `<BootstrapProbe />` at
  `apps/arena-client/src/components/BootstrapProbe.vue`. Authored in
  explicit `defineComponent({ setup() { return {...} } })` form per
  D-6512 — load-bearing under vue-sfc-loader separate-compile. WP-062
  HUD components that ship with `node:test` tests AND use setup-scope
  bindings in their templates MUST follow this form (see P6-30 in 01.4
  Precedent Log). Components using only `defineProps` may continue to use
  `<script setup>`.
- jsdom setup helper: `apps/arena-client/src/testing/jsdom-setup.ts`.
  Side-effect module installing `window`, `document`, `HTMLElement`,
  `Element`, `Node`, `SVGElement`, `MathMLElement`, `navigator` via
  `Object.defineProperty` (navigator is a read-only getter under Node
  22+, so plain assignment throws). EVERY component test that calls
  `mount()` must import this module as its FIRST line. WP-062 must
  reuse this helper, not duplicate it. Modifying it is out of scope for
  WP-062 unless a genuinely new global is required (with a DECISIONS.md
  entry).
- Dev URL harness: `main.ts` contains a single
  `if (import.meta.env.DEV) { ... }` branch parsing `?fixture=` from
  `window.location.search`. Unique DCE marker
  `__WP061_DEV_FIXTURE_HARNESS__` is the grep target for production-build
  verification (not the fixture names — JSON imports survive
  minification). WP-062 must not add additional dev-only URL query
  parameters unless they match this DCE-guarded pattern (and grep target
  for any new marker string must target `dist/assets/*.js`, not
  `dist/**` — see D-6513 / P6-31).
- Base styles: `apps/arena-client/src/styles/base.css`. Defines
  `--color-foreground`, `--color-background`, `--color-focus-ring` with
  numeric contrast-ratio comments for both light and dark
  `prefers-color-scheme`. WP-062 HUD components should consume these
  tokens rather than introducing new hex values inline; if HUD needs
  additional tokens (e.g., `--color-attack`, `--color-recruit`,
  `--color-villain`, `--color-hero-slot`), add them to `base.css` with
  documented contrast ratios against both background tokens.
- Package-level locks: `vue@^3.4.27` (pnpm resolves 3.5.30 — WP-065
  precedent), `pinia@^2.1.7`, `jsdom@^24.1.0`, `@vue/test-utils@^2.4.6`,
  `tsx@^4.15.7`, `vue-tsc@^2.0.19`, `@vitejs/plugin-vue@^5.0.5`,
  `vite@^5.3.1`. `@legendary-arena/vue-sfc-loader` and
  `@legendary-arena/game-engine` in devDependencies only (never
  dependencies — anti-production-bundle rule, D-6501).
- Test script: direct `--import` CLI flags, no `NODE_OPTIONS`, no
  `cross-env` (D-6517): `node --import tsx --import
  @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`.
  WP-062 must use the same script composition.

Key architectural patterns still in effect:

- D-0301 — UI Consumes Projections Only. WP-062 renders UIState, never
  reaches into G.
- D-0302 — Single UIState, Multiple Audiences. `filterUIStateForAudience`
  (WP-029) is the audience filter; arena-client consumes a filtered
  UIState, not the raw one. WP-062's spectator-facing HUD may need to
  call this filter.
- D-2801 through D-2804 — UI projection invariants (zone counts, not
  arrays; engine internals hidden; card display resolution separate).
- D-6501 — Shared Tooling classification for `packages/vue-sfc-loader/`.
- D-6502 — Vue version pinning via peerDependencies (^3.4.27).
- D-6507 — Canonical `--import` composition (tsx first, vue-sfc-loader
  second).
- D-6511 — Client App classification for `apps/arena-client/` (the row
  in 02-CODE-CATEGORIES.md). WP-062 files also belong to the `client-app`
  category.
- D-6512 — BootstrapProbe `defineComponent({ setup() {...} })` form
  under vue-sfc-loader separate-compile. WP-062 component authoring
  follows P6-30.
- D-6513 — DCE-marker absence verification scope: `dist/assets/*.js`,
  not `dist/**`.
- D-6514 — `satisfies UIState` for JSON fixtures; omit optional fields
  under `exactOptionalPropertyTypes: true`.
- D-6515 — `build.sourcemap: true` is the client-app default.
- D-6516 — No `vue-router` in `apps/arena-client/`. WP-062 continues
  single-mount; if HUD needs route-like URL state, use
  `URLSearchParams` directly (same pattern as the `?fixture=` harness).
- D-6517 — Direct `--import` test-script composition; no `NODE_OPTIONS`,
  no `cross-env`.

Relevant decisions for WP-062:

- D-0301 — UI consumes projections only (re-read for HUD rendering
  discipline).
- D-0302 — spectator audience filter (re-read; WP-062 HUD may present
  the spectator view).
- D-2801 through D-2804 — UIState invariants.
- D-6512 — component authoring form under vue-sfc-loader.
- D-6514 — fixture validation strategy.
- D-6516 — no router; use `URLSearchParams` for any URL-driven state.
- (New in WP-062 execution, expected): DECISIONS.md entry for the HUD
  layout approach (fixed vs floating), for any new color tokens added
  to base.css, and for the PAR-delta read-out composable contract.

Files WP-062 will need to read before coding:

- `apps/arena-client/src/stores/uiState.ts` — the store shape the HUD
  consumes.
- `apps/arena-client/src/fixtures/uiState/index.ts` and `typed.ts` — the
  loader contract and the `satisfies UIState` discipline.
- `apps/arena-client/src/components/BootstrapProbe.vue` — the canonical
  Composition-API + setup()-return form that HUD components with
  setup-scope template bindings must follow.
- `apps/arena-client/src/testing/jsdom-setup.ts` — the jsdom helper HUD
  component tests must import first.
- `apps/arena-client/src/styles/base.css` — the token contract HUD
  components must extend, not replace.
- `packages/game-engine/src/ui/uiState.types.ts` — the UIState fields HUD
  must render (already read during WP-061; re-read for HUD-specific
  fields like scheme, economy, mastermind).
- `packages/game-engine/src/ui/uiState.filter.ts` (WP-029) — the
  `filterUIStateForAudience` function for spectator HUD.
- `packages/game-engine/src/scoring/scoring.types.ts` — FinalScoreSummary
  for `<EndgameSummary />`.
- `docs/ai/work-packets/WP-062-arena-hud-and-scoreboard.md` — the
  authoritative WP spec (not yet read this session).
- `docs/ai/execution-checklists/EC-NNN-*.checklist.md` — the EC that
  governs WP-062 execution (must be located during pre-flight; EC-062
  slot history needs to be verified against the EC-061 → EC-067
  retargeting precedent before commit-prefix is locked).
- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` §Precedent Log
  Phase 6 continued — Gameplay Client Bootstrap (WP-061) — NEW P6-30,
  P6-31, P6-32 entries MUST be consulted before WP-062 session prompt
  is generated. They are the concrete traps WP-062 must avoid.

WP-061 lessons (propagated to 01.4 §Precedent Log):

- P6-30: `<script setup>` + vue-sfc-loader separate-compile
  incompatibility for template-binding of setup-scope refs; the
  `defineComponent({ setup() { return {...} } })` form is the compliant
  pattern when a component ships with a `node:test` test AND uses
  setup-scope bindings in its template. Props-only components may
  continue to use `<script setup>`.
- P6-31: Sourcemap carve-out for DCE-marker verification when
  `build.sourcemap: true` is enabled — scope the grep target to
  `dist/assets/*.js`, not `dist/**`. Encode in session prompt from
  the start.
- P6-32: DECISIONS.md ↔ 02-CODE-CATEGORIES.md asymmetry must be
  checked on BOTH sides during pre-flight — a one-sided PS-1 leaves a
  governance referential-integrity hole the session prompt's Gate must
  catch.

Steps completed for WP-061:
0: session-context-wp061.md (loaded at session start)
1: pre-flight (2026-04-17, READY TO EXECUTE; inline in originating
   session, not saved as a standalone artifact)
2: session-wp061-gameplay-client-bootstrap.md (generated pre-session)
3: execution (2026-04-17, 13 new tests, 0 fail; 409 repo-wide, 0 fail)
4: post-mortem (clean — no post-mortem fixes; one execution-time
   decision documented as D-6512 during execution, not during
   post-mortem)
5: pre-commit review (2026-04-17, Safe to commit as-is, with
   procedural caveat that review ran in the same session as
   execution at user's explicit request)
6: commit (2e68530 EC-067: add apps/arena-client Vue 3 gameplay
   client bootstrap)
7: lessons learned (3 new Precedent Log entries P6-30, P6-31, P6-32
   in 01.4)
8: this file

Run pre-flight for WP-062 next.
