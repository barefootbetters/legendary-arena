WP-067 is complete (commits 9a9c3cf SPEC + 1d709e5 EC-068). WP-061 is also
complete (commit 2e68530). Key context for WP-062:

- Repo test baseline: **442 tests passing** (3 registry + 409 game-engine
  + 11 vue-sfc-loader + 6 server + 13 arena-client). 0 failures. WP-062
  must not regress any of these counts. Engine baseline is **409 / 101
  suites** (was 396/98 before WP-067; +13 tests / +3 suites delivered).
- Phase 6 dependency status (CORRECTED 2026-04-17 after WP-067 commit):
  WP-028 UIState contract ✅ complete, WP-029 audience-filtered UIState
  ✅ complete, WP-061 client bootstrap ✅ complete (commit 2e68530),
  **WP-048 PAR scoring ✅ complete** (commit 2587bbb), **WP-067 UIState
  PAR projection ✅ complete** (commit 1d709e5). All four upstream
  dependencies the WP-062 spec lists are now satisfied; the previous
  blocker chain is fully resolved.
- WP-062: Arena HUD & Scoreboard — fixed (non-floating) HUD comprising
  `<TurnPhaseBanner />`, `<SharedScoreboard />`, `<ParDeltaReadout />`,
  `<PlayerPanelList />`, `<EndgameSummary />`. Consumes UIState
  projections via the WP-061 store; no engine runtime import, no
  registry access, no networking.

Important — D-6701 safe-skip changes WP-062's PAR-render path:

WP-067 shipped `UIGameOverState.par?: UIParBreakdown` as a TYPE-LEVEL
contract, but the runtime body of `buildParBreakdown(G, ctx)` in
`packages/game-engine/src/ui/uiState.build.ts` is `return undefined;`
unconditionally per D-6701. The `gameOver.par` field is therefore
ALWAYS absent at runtime today, even when `phase === 'end'` and
`G.activeScoringConfig` is defined. WP-062's `<ParDeltaReadout />` must
treat `gameOver.par === undefined` as the dominant runtime case and
render an em-dash (or equivalent "PAR not available" affordance) — never
zero, never `NaN`, never throw. The four field names `rawScore`,
`parScore`, `finalScore`, `scoringConfigVersion` are pinned by the
`uiState.types.drift.test.ts` drift test; aria-labels in
`<ParDeltaReadout />` MUST bind to those four exact names so the
follow-up WP that wires the payload (modifies only the
`buildParBreakdown` body) does not require any HUD edits. Do NOT add a
phase or config check inside `<ParDeltaReadout />` — the engine owns the
gating; the HUD reads `gameOver?.par` and renders accordingly.

New artifacts shipped by WP-067 — what WP-062 will consume:

- `UIProgressCounters { bystandersRescued: number; escapedVillains: number }`
  exported from `packages/game-engine/src/ui/uiState.types.ts` and
  re-exported from the package barrel. **Required** field on every
  `UIState` (including during `phase === 'lobby'` when both counters
  are 0). WP-062's `<SharedScoreboard />` reads
  `uiState.progress.bystandersRescued` and `uiState.progress.escapedVillains`
  directly — no helper needed. Field names are pinned by the drift
  test; rename = compile failure.
- `UIParBreakdown { rawScore, parScore, finalScore, scoringConfigVersion }`
  exported from the same module. Optional (`par?:`) on
  `UIGameOverState`. Always undefined at runtime today (D-6701
  safe-skip).
- `LegendaryGameState.activeScoringConfig?: ScenarioScoringConfig` — new
  optional field on G (D-6702). Runtime-only, never persisted. WP-062
  does NOT read this field directly (engine internal); the HUD reads
  the projection (`gameOver.par`) only.
- `buildInitialGameState(config, registry, context, scoringConfig?)` —
  new 4th positional optional parameter (D-6703). WP-062 does NOT call
  `buildInitialGameState` (engine internal); only mentioned here for
  completeness.
- Three WP-061 fixture JSONs (`mid-turn.json`, `endgame-win.json`,
  `endgame-loss.json`) gained a single `progress` top-level key with
  realistic counter values (4/1, 9/2, 1/8 respectively). WP-062 does
  NOT need to add the `progress` key — already present. WP-062 may add
  NEW fixtures for HUD scenarios (e.g., a fixture exercising large
  bystander counts for layout overflow tests); each new fixture must
  follow the `satisfies UIState` typed-loader pattern (D-6514).

Forced cascade discovered during WP-067 execution that WP-062 must
not reproduce or break:

- `packages/game-engine/src/ui/uiState.filter.ts:137` constructs a
  `UIState` literal: `const result: UIState = { ..., progress:
  { ...uiState.progress } }`. This passthrough was added in the
  EC-068 commit as a forced cascade (the new required `progress`
  field broke the existing filter literal). WP-062 must NOT modify
  this filter; if WP-062's audience-filtered HUD consumes
  `filterUIStateForAudience`, the projection roundtrips
  `progress` unchanged (counters are public; no redaction needed).
  See P6-33 below for the broader pattern.

WP-067 lessons propagated to 01.4 §Precedent Log (MUST be consulted
before WP-062 session prompt is generated):

- **P6-33: Required-field promotion on a public projection type forces
  a literal-constructor audit.** If WP-062 promotes any field to
  required on `UIState`, `UIPlayerState`, `UIGameOverState`, or any
  other top-level projection / DTO type, run the literal-constructor
  sweep BEFORE locking the WP-062 allowlist:
  ```pwsh
  Select-String -Path packages, apps -Pattern ": UIState\s*=\s*\{" -Recurse
  ```
  Every match is a compile-blocker site that must be added to the
  allowlist with a single-line passthrough. WP-062 is unlikely to
  promote any field to required (HUD components READ projections, they
  don't widen them), but if it does, this sweep is mandatory.
- **P6-34: Pre-flight READY verdict must verify pre-flight edits are
  committed, not just applied.** WP-062's pre-flight will likely
  produce DECISIONS.md entries (HUD layout decision, color-token
  additions, PAR-delta composable contract — at minimum), EC updates,
  and possibly REFERENCE doc updates. Before printing READY, WP-062
  pre-flight MUST run `git status --short` and confirm zero
  uncommitted modifications to those governance files. The cleanest
  workflow is: apply governance edits, commit them under a `SPEC:`
  prefix, then print READY with the SPEC commit hash as the new
  base. WP-062's session prompt then references the SPEC hash, not
  the pre-pre-flight base.
- **P6-35: 01.6 post-mortem must run before commit (step 4 before
  step 6).** WP-062 introduces a new long-lived abstraction (HUD
  composables) and consumes a new contract (UIProgressCounters /
  UIParBreakdown), so 01.6 is MANDATORY per 01.6 §When Post-Mortem
  Is Required. The session prompt's implementation order step that
  invokes 01.6 must be encoded as a literal STOP gate; the formal
  10-section 01.6 output must be produced BEFORE the commit step is
  invoked. An informal in-line summary is NOT a substitute.

arena-client surface (WP-061) — what WP-062 will consume:

- Pinia store factory: `useUiStateStore()` from
  `apps/arena-client/src/stores/uiState.ts`. Exposes exactly one state
  field `snapshot: UIState | null` and exactly one action
  `setSnapshot(next: UIState | null)`. No getters, no additional
  state, no additional actions — the contract is frozen for every
  subsequent UI packet. WP-062 must NOT add additional state fields
  or actions to this store. If WP-062 needs derived view state
  (selectors, memoized computeds, audience-filter wrappers), those
  belong in new composables or new stores, not mutations to
  `uiState.ts`. Any divergence requires a DECISIONS.md entry.
- Fixture loader: `loadUiStateFixture(name: FixtureName): UIState`
  from `apps/arena-client/src/fixtures/uiState/index.ts`. FixtureName
  union is `'mid-turn' | 'endgame-win' | 'endgame-loss'`.
  `isFixtureName(string): candidate is FixtureName` is a type guard.
  Single code path — no environment branching. WP-062 should consume
  fixtures unchanged; if a new fixture shape is needed for HUD
  testing, add a new committed JSON + typed re-export rather than
  mutating the three bootstrap fixtures.
- Typed fixture layer:
  `apps/arena-client/src/fixtures/uiState/typed.ts`. Applies
  `satisfies UIState` per imported JSON. Never `as UIState`. Any new
  fixture in WP-062 must follow this pattern (D-6514).
- Wiring probe: `<BootstrapProbe />` at
  `apps/arena-client/src/components/BootstrapProbe.vue`. Authored in
  explicit `defineComponent({ setup() { return {...} } })` form per
  D-6512 — load-bearing under vue-sfc-loader separate-compile. WP-062
  HUD components that ship with `node:test` tests AND use setup-scope
  bindings in their templates MUST follow this form (see P6-30 in
  01.4 Precedent Log). Components using only `defineProps` may
  continue to use `<script setup>`.
- jsdom setup helper: `apps/arena-client/src/testing/jsdom-setup.ts`.
  Side-effect module installing `window`, `document`, `HTMLElement`,
  `Element`, `Node`, `SVGElement`, `MathMLElement`, `navigator` via
  `Object.defineProperty` (navigator is a read-only getter under Node
  22+, so plain assignment throws). EVERY component test that calls
  `mount()` must import this module as its FIRST line. WP-062 must
  reuse this helper, not duplicate it. Modifying it is out of scope
  for WP-062 unless a genuinely new global is required (with a
  DECISIONS.md entry).
- Dev URL harness: `main.ts` contains a single
  `if (import.meta.env.DEV) { ... }` branch parsing `?fixture=` from
  `window.location.search`. Unique DCE marker
  `__WP061_DEV_FIXTURE_HARNESS__` is the grep target for
  production-build verification (not the fixture names — JSON
  imports survive minification). WP-062 must not add additional
  dev-only URL query parameters unless they match this DCE-guarded
  pattern (and grep target for any new marker string must target
  `dist/assets/*.js`, not `dist/**` — see D-6513 / P6-31).
- Base styles: `apps/arena-client/src/styles/base.css`. Defines
  `--color-foreground`, `--color-background`, `--color-focus-ring`
  with numeric contrast-ratio comments for both light and dark
  `prefers-color-scheme`. WP-062 HUD components should consume these
  tokens rather than introducing new hex values inline; if HUD needs
  additional tokens (e.g., `--color-attack`, `--color-recruit`,
  `--color-villain`, `--color-hero-slot`), add them to `base.css`
  with documented contrast ratios against both background tokens.
- Package-level locks: `vue@^3.4.27` (pnpm resolves 3.5.30 — WP-065
  precedent), `pinia@^2.1.7`, `jsdom@^24.1.0`,
  `@vue/test-utils@^2.4.6`, `tsx@^4.15.7`, `vue-tsc@^2.0.19`,
  `@vitejs/plugin-vue@^5.0.5`, `vite@^5.3.1`.
  `@legendary-arena/vue-sfc-loader` and
  `@legendary-arena/game-engine` in devDependencies only (never
  dependencies — anti-production-bundle rule, D-6501).
- Test script: direct `--import` CLI flags, no `NODE_OPTIONS`, no
  `cross-env` (D-6517): `node --import tsx --import
  @legendary-arena/vue-sfc-loader/register --test src/**/*.test.ts`.
  WP-062 must use the same script composition.

Key architectural patterns still in effect:

- D-0301 — UI Consumes Projections Only. WP-062 renders UIState,
  never reaches into G. Reaffirmed by WP-067 (PAR projection lives
  in `buildUIState`, not in the HUD).
- D-0302 — Single UIState, Multiple Audiences. `filterUIStateForAudience`
  (WP-029) is the audience filter; arena-client consumes a filtered
  UIState, not the raw one. WP-062's spectator-facing HUD may need
  to call this filter. The filter now passes `progress` through
  unchanged (counters are public; no audience redaction).
- D-2801 through D-2804 — UI projection invariants (zone counts,
  not arrays; engine internals hidden; card display resolution
  separate).
- D-6501 — Shared Tooling classification for `packages/vue-sfc-loader/`.
- D-6502 — Vue version pinning via peerDependencies (^3.4.27).
- D-6507 — Canonical `--import` composition (tsx first,
  vue-sfc-loader second).
- D-6511 — Client App classification for `apps/arena-client/` (the
  row in 02-CODE-CATEGORIES.md). WP-062 files also belong to the
  `client-app` category.
- D-6512 — BootstrapProbe `defineComponent({ setup() {...} })` form
  under vue-sfc-loader separate-compile. WP-062 component authoring
  follows P6-30.
- D-6513 — DCE-marker absence verification scope:
  `dist/assets/*.js`, not `dist/**`.
- D-6514 — `satisfies UIState` for JSON fixtures; omit optional
  fields under `exactOptionalPropertyTypes: true`.
- D-6515 — `build.sourcemap: true` is the client-app default.
- D-6516 — No `vue-router` in `apps/arena-client/`. WP-062 continues
  single-mount; if HUD needs route-like URL state, use
  `URLSearchParams` directly (same pattern as the `?fixture=`
  harness).
- D-6517 — Direct `--import` test-script composition; no
  `NODE_OPTIONS`, no `cross-env`.
- **D-6701 — `UIParBreakdown` ships as type-level contract with
  safe-skip payload.** `buildParBreakdown(G, ctx)` body is
  `return undefined;` unconditionally at MVP. WP-062's
  `<ParDeltaReadout />` must render em-dash for `gameOver.par ===
  undefined` (the dominant runtime case) and bind aria-labels to
  `rawScore` / `parScore` / `finalScore` / `scoringConfigVersion`
  verbatim so the follow-up WP that supplies the payload requires
  zero HUD changes.
- **D-6702 — `G.activeScoringConfig` added by WP-067, not WP-048.**
  Runtime-only optional field; WP-062 does NOT read this directly.
- **D-6703 — `buildInitialGameState` gains a 4th positional optional
  `scoringConfig` parameter.** WP-062 does NOT call
  `buildInitialGameState`.

Relevant decisions for WP-062:

- D-0301 — UI consumes projections only (re-read for HUD rendering
  discipline).
- D-0302 — spectator audience filter (re-read; WP-062 HUD may
  present the spectator view).
- D-2801 through D-2804 — UIState invariants.
- D-6512 — component authoring form under vue-sfc-loader.
- D-6514 — fixture validation strategy.
- D-6516 — no router; use `URLSearchParams` for any URL-driven
  state.
- D-6701 — PAR safe-skip body and HUD rendering implications (CRITICAL
  for `<ParDeltaReadout />`).
- (New in WP-062 execution, expected): DECISIONS.md entry for the HUD
  layout approach (fixed vs floating), for any new color tokens added
  to base.css, and for the PAR-delta read-out composable contract.

Files WP-062 will need to read before coding:

- `apps/arena-client/src/stores/uiState.ts` — the store shape the HUD
  consumes.
- `apps/arena-client/src/fixtures/uiState/index.ts` and `typed.ts` —
  the loader contract and the `satisfies UIState` discipline.
- `apps/arena-client/src/components/BootstrapProbe.vue` — the
  canonical Composition-API + setup()-return form that HUD
  components with setup-scope template bindings must follow.
- `apps/arena-client/src/testing/jsdom-setup.ts` — the jsdom helper
  HUD component tests must import first.
- `apps/arena-client/src/styles/base.css` — the token contract HUD
  components must extend, not replace.
- `packages/game-engine/src/ui/uiState.types.ts` — the UIState
  fields HUD must render. **Re-read for the new
  `UIProgressCounters` and `UIParBreakdown` types added by WP-067.**
- `packages/game-engine/src/ui/uiState.build.ts` — re-read for the
  new `buildProgressCounters` and `buildParBreakdown` helpers and
  the conditional-spread wire pattern. WP-062 does not modify this
  file but must understand the safe-skip body to render PAR
  correctly.
- `packages/game-engine/src/ui/uiState.filter.ts` (WP-029) — the
  `filterUIStateForAudience` function for spectator HUD. **Re-read
  for the WP-067 forced cascade `progress: { ...uiState.progress }`
  passthrough.**
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` (NEW
  WP-067) — the drift test that pins all 6 new field names. Read
  to understand which names are non-negotiable for HUD aria-labels.
- `packages/game-engine/src/scoring/scoring.types.ts` —
  `FinalScoreSummary` for `<EndgameSummary />`.
- `packages/game-engine/src/scoring/parScoring.types.ts` (WP-048) —
  `ScenarioScoringConfig` and `ScoreBreakdown` for PAR semantics
  reference. WP-062 does NOT import this directly (HUD reads
  projections only); read for understanding.
- `docs/ai/work-packets/WP-062-arena-hud-and-scoreboard.md` — the
  authoritative WP spec. Note: any references in WP-062 to
  `bystandersRescued` / `escapedVillains` / `rawScore` / `parScore`
  / `finalScore` / `scoringConfigVersion` are now SATISFIED by
  WP-067; WP-062 reads them via projection. WP-062 should also be
  re-checked for any references to other field names that don't
  exist in the engine (the WP-061 session-context noted
  `schemeTwists`, `mastermindTacticsRemaining`,
  `mastermindTacticsDefeated`, `parBaseline` as non-existent — these
  remain non-existent after WP-067 and need WP-062 spec
  reconciliation against the actual engine field names
  `UISchemeState.twistCount`, `UIMastermindState.tacticsRemaining`,
  `UIMastermindState.tacticsDefeated`).
- `docs/ai/execution-checklists/EC-NNN-*.checklist.md` — the EC
  that governs WP-062 execution (must be located during pre-flight;
  EC-062 slot history needs to be verified against the EC-061 →
  EC-067 retargeting precedent before commit-prefix is locked.
  Note: EC-068 is now consumed by WP-067; the next free slot is
  likely EC-069 if a per-WP retargeting is needed).
- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` §Precedent Log —
  P6-30, P6-31, P6-32 (WP-061) AND P6-33, P6-34, P6-35 (WP-067)
  MUST be consulted before WP-062 session prompt is generated.
  They are the concrete traps WP-062 must avoid.
- `docs/ai/DECISIONS.md` — D-6701, D-6702, D-6703 (new in WP-067).

Steps completed for WP-067:
0: session-context-wp067.md (loaded at session start)
1: pre-flight (2026-04-17, READY TO EXECUTE; pre-flight governance
   edits to DECISIONS.md, EC-068, WP-067, 03.1-DATA-SOURCES.md were
   APPLIED to the working tree but NOT committed at READY time —
   resolved at execution time via user-authorized commit-split. See
   P6-34 for the prevention rule.)
2: session-wp067-uistate-par-projection-and-progress-counters.md
   (generated pre-session)
3: execution (2026-04-17, +13 new tests / +3 new suites; 442
   repo-wide, 0 fail; engine 409/101)
4: post-mortem (executed retroactively at user request — WP COMPLETE
   verdict, no fixes applied; informal in-line summary preceded the
   formal 10-section run. See P6-35 for the prevention rule.)
5: pre-commit review (executed retroactively at user request — Safe
   to commit as-is, with procedural caveat that the review ran in
   the same session as execution by the implementer rather than in
   a separate gatekeeper session)
6: commit (two commits: 9a9c3cf SPEC: WP-067 pre-flight +
   D-6701/D-6702/D-6703 + EC-068 + 03.1 row, then 1d709e5 EC-068:
   WP-067 UIState progress counters + PAR breakdown safe-skip)
7: lessons learned (3 new Precedent Log entries P6-33, P6-34, P6-35
   in 01.4)
8: this file

Steps completed for WP-061 (carried forward from prior session):
0: session-context-wp061.md (loaded at WP-061 session start)
1: pre-flight (2026-04-17, READY TO EXECUTE; inline in originating
   session, not saved as a standalone artifact)
2: session-wp061-gameplay-client-bootstrap.md (generated pre-session)
3: execution (2026-04-17, 13 new tests, 0 fail; 409 repo-wide, 0
   fail at WP-061 close)
4: post-mortem (clean — no post-mortem fixes; one execution-time
   decision documented as D-6512 during execution, not during
   post-mortem)
5: pre-commit review (2026-04-17, Safe to commit as-is, with
   procedural caveat that review ran in the same session as
   execution at user's explicit request)
6: commit (2e68530 EC-067: add apps/arena-client Vue 3 gameplay
   client bootstrap)
7: lessons learned (3 Precedent Log entries P6-30, P6-31, P6-32 in
   01.4)
8: session-context-wp062.md (this file, originally written
   2026-04-17 ahead of WP-067; rewritten 2026-04-17 after WP-067
   landed)

---

WP-067 chat-only intelligence (folded in 2026-04-17 after a follow-up
question; not surfaced earlier in this file). Six items the WP-067
implementer flagged as load-bearing for WP-062 specifically:

1. **`gameOver.par` is *absent*, not present-as-undefined.** Because of
   the conditional-spread pattern (`...(par !== undefined ? { par } :
   {})`) in `buildUIState`, the `par` key is literally omitted from the
   `gameOver` object when `buildParBreakdown` returns `undefined` —
   which is always, today, per D-6701. WP-062's `<ParDeltaReadout />`
   tests should assert `!('par' in gameOver)`, NOT `gameOver.par ===
   undefined`. The two look equivalent but differ for `Object.keys()`
   iteration, `JSON.stringify` output, and Vue template `v-if`
   semantics. The exact assertion form is in
   `packages/game-engine/src/ui/uiState.build.par.test.ts` test 3.
   Vue templates: `v-if="gameOver?.par"` works; `v-if="'par' in
   gameOver"` is more explicit and survives the future payload-wiring
   WP unchanged.

2. **`progress` is required on *every* UIState — even during
   `phase === 'lobby'`.** `<SharedScoreboard />` will receive
   `{ bystandersRescued: 0, escapedVillains: 0 }` during lobby, not
   `progress: undefined`. Don't gate the scoreboard on `phase ===
   'play'`; render the zeroed counters from the start. The same
   applies for `phase === 'setup'` and `phase === 'end'` — the field
   is always present.

3. **The fixture progress values picked during WP-067 (4/1, 9/2, 1/8
   for mid-turn / endgame-win / endgame-loss) are illustrative, not
   motivated by realistic gameplay distributions.** Don't anchor
   visual designs on them ("layout must fit 9 rescued bystanders").
   If WP-062 needs realistic upper-bound numbers for layout-stress
   tests, add NEW fixtures with motivated numbers — don't retrofit
   visual-design assumptions onto the three bootstrap fixtures.

4. **EC-068 is now consumed by WP-067; next free EC slot is EC-069.**
   The EC-066 → EC-067 → EC-068 retargeting precedent suggests WP-062
   may need to claim EC-069 rather than EC-062. Lock the EC prefix
   during WP-062 pre-flight before generating the session prompt;
   verify against `EC_INDEX.md`.

5. **Pre-commit review (workflow step 5) is supposed to be a
   *separate-session gatekeeper*, not in-session self-review.** WP-067
   ran step 5 in-session at user request — that was a procedural
   deviation. WP-062 should plan for a literal new session for
   step 5; the implementer cannot independently audit their own work.
   01.6 post-mortem (step 4) DOES run in the same session as
   execution per its own §Workflow Position, so do not conflate the
   two: post-mortem in-session is correct; pre-commit review
   in-session is a deviation.

6. **The `void gameState; void ctx;` pattern** inside
   `buildParBreakdown` (in `packages/game-engine/src/ui/uiState.build.ts`)
   is the documented pattern for "must accept parameters per spec but
   cannot use them in the safe-skip body". Useful if WP-062 ships any
   composable that holds a stable signature for a future-payload
   contract while currently returning a fixed value (e.g., a PAR-delta
   computed-getter that takes the gameOver projection but always
   returns em-dash today). It's not a TS necessity — `tsconfig` does
   not enforce `noUnusedParameters` — but it documents intent and
   future-proofs against the rule being enabled later.

Bonus engineering pattern (item 7, also chat-only):
**When a forced cascade outside the allowlist is discovered during
execution, escalate via `AskUserQuestion` with three named options:
recommended path / stop-and-amend / unsafe-bypass.** This was the
resolution path for both the `uiState.filter.ts` cascade and the
pre-flight commit-split during WP-067. Don't guess, don't silently
proceed, and don't just stop without offering an option chain — the
user's time is best spent picking from a curated list.

Run pre-flight for WP-062 next.

---

WP-068 execution session lessons (folded in 2026-04-18 from the
Preferences Foundation session; MUST be consulted before WP-062 session
prompt is generated or executed). Four items landed in 01.4 Precedent
Log as P6-36 through P6-39; two items are branch-mechanical and
relevant only to the WP-062 next-session start.

**Branch and base-commit update (supersedes the earlier header):**

- Branch for WP-062 execution is `wp-062-arena-hud`, cut from `main` at
  `1d709e5` on 2026-04-18. It is **not** the `wp-068-preferences-foundation`
  branch — that branch carries WP-068's 17 new registry-viewer tests and
  must not be conflated with this one. WP-068's work will merge to `main`
  separately from WP-062.
- The new execution base commit is `97e70ad SPEC: WP-062 governance
  cleanup + WP-068 lessons-learned propagation`. This commit lands the
  four Gate #2 governance files (WP-062 packet, EC-069 checklist,
  copilot-wp062 check, session-wp062 invocation), the EC-069 and EC-070
  rows in EC_INDEX.md, and the P6-36..P6-39 additions to 01.4. WP-062's
  session prompt should reference `97e70ad` as the execution base (not
  `1d709e5`), and the invocation's Gate #3 `git log --oneline -10` check
  should allow `97e70ad` as the most recent commit before execution begins.
- Gate #2 (governance files committed) is now **clear** at `97e70ad`.
  Gate #3 (upstream dependencies) inherits from the `1d709e5` ancestor:
  `2587bbb` EC-048, `2e68530` EC-067, `bc23913` EC-065 all still present.
- Repo test baseline on `wp-062-arena-hud` at `97e70ad`: **442 passing
  / 0 failing** (3 registry + 409 game-engine + 11 vue-sfc-loader + 6
  server + 13 arena-client). The registry-viewer 0 → 17 jump from
  WP-068 is NOT present on this branch; do not expect it during Gate #3
  verification.

**P6-36: Commit-prefix hook enforcement (load-bearing for WP-062
commit step).**

- The `.githooks/commit-msg` hook rejects any subject prefix other
  than `EC-###:` / `SPEC:` / `INFRA:`. `WP-###:` is rejected outright.
  The WP-062 invocation already locks `EC-069:` — that is the only
  acceptable code-commit prefix for this WP. Do NOT let any
  mid-session improvisation (e.g., "lightweight commit for a small
  fix") introduce a `WP-062:` or other prefix; the hook will reject
  it and the CI mirror (`.github/workflows/commit-hygiene.yml`) will
  reject it on PR.
- If mid-session execution discovers a need for a SPEC-shaped
  correction (e.g., a DECISIONS.md entry surfaced during post-mortem
  that must be added separately from the execution commit), the
  correct prefix is `SPEC:`, committed in its own commit alongside
  but not bundled with the `EC-069:` execution commit.
- The WP-068 session hit this rule by accident: session-context
  offered `WP-068:` as a "lightweight" Option B. The hook rejected
  it; resolution required drafting a minimum-ceremony EC alongside
  execution. WP-062 already has EC-069 fully drafted, so this is a
  confirmation, not a pivot path.

**P6-37: Test-infrastructure scope (applies only if WP-062 adds a
first-test-ever to any app — not expected).**

- `apps/arena-client/` already has 13 tests with a working
  `node:test` script (inherited from WP-061), so WP-062 does not
  introduce first-tests-in-an-app and does not trigger this
  precedent's scope-widening rule. The HUD test files WP-062 adds
  (five `.test.ts` under `apps/arena-client/src/components/hud/`)
  run against the existing `test` script — no `package.json`
  `scripts` or `devDependencies` changes are expected.
- If a mid-session discovery does require extending the test script
  (unlikely), treat the additions as implicit scope per P6-37 and
  document the deviation in STATUS.md and the commit body. Do NOT
  add new test-runner devDeps or test-script entries silently.

**P6-38: Governance index file dirty-tree hold (applies to WP-062
DoD step that updates EC_INDEX.md and WORK_INDEX.md).**

- EC_INDEX.md is **clean** at `97e70ad` — EC-069 has its Draft row
  and EC-070 has its Done row. WP-062's DoD will flip EC-069 from
  Draft to Done with `Executed 2026-04-18 at commit <hash>` per the
  EC-067 / EC-068 format. That edit is clean because EC_INDEX.md has
  no pre-existing unrelated modifications on this branch.
- WORK_INDEX.md on this branch has pre-existing unrelated modifications
  (WP-079 content from the other developer's in-flight work). When
  WP-062's DoD step flips the WP-062 checkbox from `[ ]` to `[x]`,
  selective staging will be required — the same `git stash push
  --keep-index -- <path>` dance that the WP-068 session used to
  isolate its WP-068 checkbox flip from pre-existing WP-079 edits in
  WORK_INDEX.md. See the bottom of this section for the recipe.
- DECISIONS.md on this branch also carries pre-existing modifications.
  If WP-062 pre-flight produces new decisions (HUD layout choice,
  color-token additions, PAR-delta composable contract), they must be
  committed under a separate `SPEC:` prefix commit on top of
  `97e70ad` BEFORE the `EC-069:` execution commit lands — per P6-34.
  Do NOT bundle a DECISIONS.md edit into the EC-069 execution commit.

**P6-39: Corruption-safe loader distinction (not applicable to
WP-062).**

- WP-062 HUD components are read-only projections with no persistence
  layer, no fallback logic, and no corruption-safe state to load. The
  precedent is logged for future persistence-layer WPs (e.g., WP-074
  DataSource preferences).

**Residual dirty tree state (WP-062 execution must not stage or
modify any of these):**

- `.claude/settings.local.json` (local tool config)
- `docs/ai/DECISIONS.md` (pre-existing WP-079 work)
- `docs/ai/DECISIONS_INDEX.md` (pre-existing)
- `docs/ai/work-packets/WORK_INDEX.md` (pre-existing WP-079 content)
- Untracked files: Monrovia surveys (4), content/themes conflicted
  JSONs (with pCloud `[conflicted]` marker — per memory, pCloud sync
  can create these), MOVE_LOG_FORMAT.md, WP-079 packet, forensics
  invocations and session-context, WP-067/WP-068 invocations,
  WP-048 invocation, session-context-wp067, session-context-wp079,
  license letters, one-pager, upper-deck-licensing-contacts.md

**Stash state at WP-062 session start:** `stash@{0}` on this branch
carries pre-existing WP-068-branch dirty-tree modifications that
conflicted during the branch-cut on 2026-04-18. It includes
DECISIONS.md and WORK_INDEX.md content divergent from `main`'s
versions. WP-062 execution must NOT pop this stash — it is retained
for the WP-068 / WP-079 owners to reconcile separately. Leave
`git stash list` output alone.

**Selective-staging recipe (for WP-062 DoD step that flips
WORK_INDEX.md and STATUS.md while pre-existing modifications sit in
WORK_INDEX.md):**

```pwsh
# Stash the pre-existing WORK_INDEX.md modifications only
git stash push --keep-index -- docs/ai/work-packets/WORK_INDEX.md

# Now WORK_INDEX.md reflects main's version. Apply the WP-062
# checkbox flip via the Edit tool. Then stage and commit:
git add docs/ai/work-packets/WORK_INDEX.md  # stages the flip only

# After the EC-069 execution commit lands:
git stash pop

# The pre-existing WP-079 modifications are restored to the
# working tree but not to the commit. They remain dirty for the
# WP-079 owner to handle.
```

This is the exact pattern the WP-068 session used; it works cleanly
when the pre-existing modifications and the WP-062 flip are in
different regions of the file (different lines or hunks). If they
overlap (WP-062 flip + pre-existing edit on the same line), stash
pop will conflict — in that case, resolve via
`git checkout --theirs` or `--ours` and raise the conflict via
`AskUserQuestion` per item 7 in the chat-only intelligence section.

---

WP-062 executing session starts with:

1. Load this file (session-context-wp062.md).
2. Checkout branch `wp-062-arena-hud` at commit `97e70ad`.
3. `git status --short` — confirm no modifications to the four Gate
   #2 governance files; confirm the residual dirty tree matches the
   list above; confirm `stash@{0}` is retained and do not touch it.
4. `pnpm -r test` — confirm 442 passing / 0 failing on this branch.
5. Read `docs/ai/invocations/session-wp062-arena-hud-scoreboard.md`
   (the session prompt) end-to-end.
6. Read `docs/ai/execution-checklists/EC-069-arena-hud-scoreboard.checklist.md`
   (the execution authority).
7. Execute per the session prompt. All gates (#1 EC slot, #2
   governance committed, #3 upstream green, #4 category inheritance)
   are pre-cleared as of `97e70ad`.
