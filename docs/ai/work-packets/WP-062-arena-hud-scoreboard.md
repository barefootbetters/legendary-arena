# WP-062 — Arena HUD & Scoreboard (Client Projection View)

**Status:** Ready
**Primary Layer:** Client UI (Vue 3 SPA — `apps/arena-client/`)
**Dependencies:** WP-061 (gameplay client bootstrap, commit `2e68530`),
WP-028 (UIState), WP-029 (spectator view model — confirms HUD-visible
subset), WP-048 (PAR scoring, commit `2587bbb`), WP-067 (UIState PAR
projection + progress counters, commit `1d709e5`). **All dependencies
complete as of 2026-04-17.**
**EC:** EC-069 (next free slot; see preflight §EC Slot Lock)

---

## Session Context

WP-028 locked `UIState` as the sole engine→UI projection. WP-029 added
permission-filtered spectator views at the type level. WP-048 defined PAR
and the scoring fields whose live deltas the HUD surfaces. WP-061
(bootstrap) provides the Vue 3 SPA skeleton, the Pinia store holding the
current `UIState`, and committed fixtures for deterministic rendering.
This packet adds the first on-screen presentation of those projections: a
fixed (non-floating) HUD rendering turn/phase state, per-player zone
counts, shared counters (bystanders rescued, escapes, scheme twists,
mastermind tactics), and live PAR delta. No engine changes. No windowing.
No theming system.

---

## Goal

After this session, `apps/arena-client/` renders an `<ArenaHud />` Vue 3
component tree that subscribes to a `UIState` snapshot (Pinia store, from
WP-061) and displays: (1) a turn/phase/stage banner, (2) a per-player
panel showing the active player and zone counts from `UIPlayerState`,
(3) a shared-state scoreboard (bystanders rescued, escaped villains,
scheme twists, mastermind tactics remaining/defeated), (4) a live PAR
delta readout, and (5) an endgame summary panel driven by
`UIGameOverState`. The HUD never reads `G`, never imports from
`@legendary-arena/game-engine` runtime, and is fully testable against the
committed `UIState` fixtures from WP-061.

---

## Assumes

- **Repo test baseline: 442 tests passing** (3 registry + 409
  game-engine + 11 vue-sfc-loader + 6 server + 13 arena-client), 0
  failures, as of commit `1d709e5`. WP-062 must not regress any of
  these counts. Engine baseline is **409 tests / 101 suites**.
- WP-067 (UIState PAR projection + progress counters) complete
  (commits `9a9c3cf` SPEC + `1d709e5` EC-068 on main). Specifically:
  - `UIState.progress` is required, of type `UIProgressCounters`
  - `UIGameOverState.par?` is optional, of type `UIParBreakdown`
  - `buildParBreakdown` returns `undefined` unconditionally
    (D-6701 safe-skip); `par` key is ABSENT at runtime today
  - `uiState.filter.ts` passes `progress` through unchanged
  - Drift test pins all six new field names
- WP-048 (PAR scenario scoring types) complete (commit `2587bbb`).
  WP-062 does NOT import WP-048 types directly — the HUD consumes
  `UIParBreakdown` from the UI projection only.
- WP-061 (gameplay client bootstrap) complete (commit 2e68530 on
  main).
  Specifically:
  - `apps/arena-client/` is a working Vue 3 + Pinia + Vite SPA
  - `useUiStateStore()` returns a Pinia Options API store instance where
    `snapshot: UIState | null` is a **reactive state field** (NOT a `Ref`)
    and `setSnapshot(next: UIState | null)` is the single action.
    **Correct access patterns inside components:**
    - Template auto-unwrap: `store.snapshot.game.phase` (works directly).
    - Script-side Ref wrapping: `const { snapshot } = storeToRefs(store)`
      then `snapshot.value` in script scope.
    - Plain destructuring `const { snapshot } = store` **breaks reactivity**
      — do not use. (An earlier draft of this WP said
      `snapshot: Ref<UIState | null>`; that was wrong and has been
      corrected here per WP-061 execution.)
  - `loadUiStateFixture(name)` and three `UIState` fixtures (`mid-turn`,
    `endgame-win`, `endgame-loss`) are committed; `isFixtureName(candidate)`
    is a type guard over the `FixtureName` union
- WP-028 complete: `UIState`, `UIPlayerState`, `UICityState`, `UIHQState`,
  `UIMastermindState`, `UISchemeState`, `UITurnEconomyState`,
  `UIGameOverState` are exported from `@legendary-arena/game-engine` as
  types
- WP-029 complete: spectator-filtered `UIState` shape is confirmed
  identical at the HUD-visible subset (no HUD-breaking gaps)
- WP-048 + WP-067 complete: `UIGameOverState.par?: UIParBreakdown`
  exports the four fields `rawScore`, `parScore`, `finalScore`,
  `scoringConfigVersion` (pinned by
  `uiState.types.drift.test.ts`). Under D-6701 the `par` key is
  absent at runtime today; there is no live PAR-delta field during
  `phase === 'play'`.
- `pnpm --filter @legendary-arena/arena-client build` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — UI consumes
  projections only; no runtime engine import from a client app
- `docs/ai/ARCHITECTURE.md — MVP Gameplay Invariants` — `UIState` is the
  only state the UI sees
- `docs/01-VISION.md §Primary Goal 3 (Player Trust & Fairness)` — the HUD
  must display exactly what the engine reports; no derived or inferred
  values
- `docs/01-VISION.md §17 Accessibility & Inclusivity` — keyboard
  navigation, screen-reader labels, high-contrast mode, color-blind-safe
  indicators
- `docs/01-VISION.md §20–26 PAR scoring` — the HUD is the primary surface
  for PAR delta; presentation must preserve determinism (no interpolated
  or estimated values)
- `docs/01-VISION.md §Heroic Values in Scoring` — bystanders rescued is
  the strongest positive action; the HUD must visually emphasize it
  relative to penalty counters
- `docs/ai/DECISIONS.md D-0301` — UI consumes projections only
- `docs/ai/DECISIONS.md D-0302` — single UIState, multiple audiences
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — exact shape of every projection field
- `docs/ai/work-packets/WP-029-spectator-permissions-view-models.md` —
  HUD-visible subset equivalence
- `docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md` —
  PAR field names on `UIGameOverState`
- `docs/ai/work-packets/WP-061-gameplay-client-bootstrap.md` — the store
  and fixture conventions this packet relies on
- `apps/registry-viewer/CLAUDE.md` — prior-art Vue 3 SPA conventions used
  in this repo (Composition API, no barrel re-exports, flat component
  folder)
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 6 (`// why:` comments), Rule 13 (ESM only), Rule 14 (field names
  match the data contract verbatim — do NOT rename `bystandersRescued` to
  `rescued`, etc.)

---

## Preflight (Must Pass Before Coding)

> **BLOCKER CHAIN RESOLVED (2026-04-18).** The four blockers propagated
> into this WP by the WP-061 executor (2026-04-17) are now all
> addressed by upstream landings and by the in-spec edits applied in
> this preflight pass. None of them remains open. They are preserved
> here as historical context; do **not** reintroduce them.
>
> 1. **RESOLVED — WP-048 shipped.** `EC-048: add PAR scenario scoring
>    types, pure helpers, and tests` (commit `2587bbb`, 2026-04-17)
>    landed the `ScenarioScoringConfig` / `ScoreBreakdown` /
>    `LeaderboardEntry` contract. WP-048 deliberately produces no UI
>    projection on its own — resolved by blocker #2.
> 2. **RESOLVED — WP-067 added the UIState projection bridge.**
>    `EC-068: WP-067 UIState progress counters + PAR breakdown
>    safe-skip` (commit `1d709e5`, 2026-04-17) added:
>    - `UIProgressCounters { bystandersRescued, escapedVillains }` as a
>      **required** top-level `UIState.progress` field — present on
>      every `UIState` including during `phase === 'lobby'` where both
>      values are zero.
>    - `UIParBreakdown { rawScore, parScore, finalScore,
>      scoringConfigVersion }` as an **optional** `UIGameOverState.par`
>      field. Per **D-6701**, the runtime body of `buildParBreakdown`
>      in `uiState.build.ts` is `return undefined;` unconditionally —
>      so `gameOver.par` is ALWAYS absent at runtime today. A follow-up
>      WP wires the payload; WP-062 ships the HUD against the absent
>      case as the dominant path.
>    - Drift test `uiState.types.drift.test.ts` pins all six new field
>      names; renames break compile.
> 3. **RESOLVED — Field names swapped to real engine shape.** Every
>    §Scope subsection and Locked Contract Values table in this WP now
>    reads exclusively from field paths that exist in
>    `packages/game-engine/src/ui/uiState.types.ts`:
>    - `snapshot.progress.bystandersRescued` (was: top-level
>      `bystandersRescued`)
>    - `snapshot.progress.escapedVillains` (was: top-level
>      `escapedVillains`)
>    - `snapshot.scheme.twistCount` (was: `schemeTwists`)
>    - `snapshot.mastermind.tacticsRemaining` (was:
>      `mastermindTacticsRemaining`)
>    - `snapshot.mastermind.tacticsDefeated` (was:
>      `mastermindTacticsDefeated`)
>    - `snapshot.gameOver.par.rawScore` (was: top-level `rawScore`)
>    - `snapshot.gameOver.par.parScore` (was: `parBaseline` — no such
>      field ever existed)
>    - `snapshot.gameOver.par.finalScore` (was: `finalScore`)
>    - `snapshot.gameOver.par.scoringConfigVersion` (NEW — pinned by
>      WP-067 drift test; must have an aria-label)
>
>    Every `aria-label` asserted by HUD tests is the **literal leaf
>    field name** (verbatim, no paraphrasing) — e.g.,
>    `aria-label="bystandersRescued"`, `aria-label="twistCount"`,
>    `aria-label="tacticsRemaining"`, `aria-label="finalScore"`.
>    **`FinalScoreSummary.winner` and `PlayerScoreBreakdown.totalVP`
>    are out of scope for this HUD** — `<EndgameSummary />` renders
>    `gameOver.outcome` / `gameOver.reason` / the PAR breakdown only.
> 4. **RESOLVED — `base.css` is now in §Files Expected to Change.**
>    `apps/arena-client/src/styles/base.css` is listed as **modified**
>    with justification: the HUD introduces five new tokens
>    (`--color-emphasis`, `--color-penalty`, `--color-active-player`,
>    `--color-par-positive`, `--color-par-negative`), each documented
>    with a numeric contrast ratio against both light and dark
>    `prefers-color-scheme` backgrounds per D-6515. The DECISIONS.md
>    entry added during execution must cite the source of each
>    contrast computation (WebAIM contrast checker or equivalent).
>    Scoped `<style>` blocks are still permitted inside individual HUD
>    components, but the five shared tokens live in `base.css` so the
>    `prefers-color-scheme` discipline is uniform across the HUD.

### Code-Category Classification (auditability note)

`apps/arena-client/src/components/hud/` is a new subdirectory under
an already-classified app. It inherits the **Client App**
classification from `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:44`
(D-6511, `apps/arena-client/` directory pattern). No new PS-# /
DECISIONS.md entry is required for this subdirectory.

### EC Slot Lock (do not re-derive)

**This WP executes against EC-069.** EC-062, EC-063, and EC-064 are
unused; EC-065 → EC-068 are historically bound (respectively: WP-065
vue-sfc-loader, WP-066 registry-viewer data toggle, WP-061 client
bootstrap, WP-067 UIState PAR projection). Following the EC-061 →
EC-067 and EC-066 → EC-068 retargeting precedent, the next free slot
is **EC-069**.

- Commit prefix: `EC-069:` (not `EC-062:`)
- EC filename: `docs/ai/execution-checklists/EC-069-arena-hud-scoreboard.checklist.md`
- EC header note must preserve the rationale (consumed-slot history) so
  future readers understand why a 060-range WP uses an out-of-sequence
  EC. See EC-067 header for the template.

### Additional Precedents (from 01.4 Precedent Log — must apply)

**From WP-061 (P6-30 / P6-31 / P6-32):**
- **P6-30** — `ArenaHud.vue` has setup-scope template bindings
  (`storeToRefs(store).snapshot`) AND ships with a `node:test` test.
  Under `@legendary-arena/vue-sfc-loader`'s separate-compile pipeline
  (`inlineTemplate: false`), `<script setup>` top-level bindings are
  not exposed on `_ctx`. **`ArenaHud.vue` MUST use the
  `defineComponent({ setup() { return { … } } })` form**, not
  `<script setup>` sugar. The six props-only subcomponents
  (`TurnPhaseBanner`, `SharedScoreboard`, `ParDeltaReadout`,
  `PlayerPanelList`, `PlayerPanel`, `EndgameSummary`) may freely use
  `<script setup>` — props reach `_ctx` via `$props`. See D-6512.
- **P6-31** — If this WP adds any new dev-only URL harness with a DCE
  marker, the build-verification grep must target `dist/assets/*.js`,
  not `dist/**`. WP-062 does not currently plan such a harness; if
  one is added, enforce this scope from the start. See D-6513.
- **P6-32** — jsdom-setup import path depth differs from WP-061.
  WP-061's `BootstrapProbe.test.ts` at `src/components/*.test.ts`
  imports `'../testing/jsdom-setup'` (1 level up). WP-062 HUD tests
  at `src/components/hud/*.test.ts` must import
  `'../../testing/jsdom-setup'` (**2 levels up**). Every `mount()`-
  using HUD test has this import as its **first line** — load-bearing
  because `@vue/runtime-dom.resolveRootNamespace` probes
  `SVGElement` at `app.mount()` under Vue 3.5.x.

**From WP-067 (P6-33 / P6-34 / P6-35):**
- **P6-33** — Required-field promotion on a public projection type
  forces a literal-constructor audit. WP-062 is unlikely to promote
  any field (HUD components READ projections, they do not widen
  them), but if it does, run this sweep BEFORE locking the allowlist:
  ```pwsh
  Select-String -Path packages, apps -Pattern ": UIState\s*=\s*\{" -Recurse
  ```
  Every match is a compile-blocker site that must be added to the
  allowlist with a single-line passthrough.
- **P6-34** — Pre-flight READY verdict must verify pre-flight edits
  are **committed**, not just applied. Before printing READY, run
  `git status --short` and confirm zero uncommitted modifications
  to governance files (this WP, DECISIONS.md, EC-069, WORK_INDEX.md,
  STATUS.md). Preferred workflow: apply governance edits, commit
  under a `SPEC:` prefix, then print READY with the SPEC commit hash
  as the new base.
- **P6-35** — 01.6 post-mortem MUST run before commit (step 4 before
  step 6). WP-062 introduces a new long-lived abstraction (HUD
  component tree) and consumes a new contract
  (`UIProgressCounters` / `UIParBreakdown`), so 01.6 is MANDATORY per
  01.6 §When Post-Mortem Is Required. Encode this as a literal STOP
  gate in the session prompt; produce the formal 10-section output
  BEFORE invoking the commit step. An informal in-line summary is
  NOT a substitute.

### D-6701 Safe-Skip Rendering Rules (load-bearing)

Because `buildParBreakdown` returns `undefined` unconditionally today,
`gameOver.par` is **absent** (not present-as-undefined) on every
runtime `UIState`. Four rendering consequences are locked here and
must not be revisited in the session prompt:

1. `<ParDeltaReadout />` tests assert `!('par' in gameOver)`, NOT
   `gameOver.par === undefined`. Vue template `v-if="gameOver?.par"`
   is the correct check; `v-if="'par' in gameOver"` is the explicit
   equivalent and survives the future payload-wiring WP unchanged.
2. `<SharedScoreboard />` does NOT gate on `phase === 'play'`. The
   `progress` field is required on every UIState (including
   `phase === 'lobby'` with both counters at 0). Render from the
   start; do not hide at lobby.
3. The `void gameState; void ctx;` pattern is the documented approach
   for any HUD composable that must hold a stable signature for a
   future-payload contract while currently returning a fixed value
   (e.g., a PAR-delta computed-getter that takes the `gameOver`
   projection but always returns em-dash today). It is not a TS
   necessity — the repo tsconfig does not enforce
   `noUnusedParameters` — but it documents intent.
4. The three WP-061 fixtures already contain the `progress` key with
   illustrative numbers (4/1, 9/2, 1/8 for mid-turn / endgame-win /
   endgame-loss per WP-067). These numbers are **not** motivated by
   realistic gameplay distributions; do not anchor visual designs on
   them. If layout-stress tests need realistic upper-bound values,
   add NEW fixtures following the `satisfies UIState` typed-loader
   pattern (D-6514) — do NOT retrofit the three bootstrap fixtures.

### Standing Preflight Checks (inherited from WP-061)
>
> **Additional WP-061 lessons that apply to this WP** (non-blocking but
> execution-critical — see `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
> §Precedent Log for details):
>
> - **P6-30** — `ArenaHud.vue` has setup-scope bindings
>   (`storeToRefs(store).snapshot`) in its template AND ships with a
>   `node:test` test. Under `@legendary-arena/vue-sfc-loader`'s
>   separate-compile pipeline (`inlineTemplate: false`), `<script setup>`
>   top-level bindings are not exposed on the template's `_ctx`.
>   **`ArenaHud.vue` MUST use the
>   `defineComponent({ setup() { return { … } } })` form**, not
>   `<script setup>` sugar. The six props-only subcomponents
>   (TurnPhaseBanner, SharedScoreboard, ParDeltaReadout, PlayerPanelList,
>   PlayerPanel, EndgameSummary) may freely use `<script setup>` — props
>   reach `_ctx` via `$props` (proven by WP-065's `hello.vue` fixture).
>   See D-6512.
> - **P6-31** — DCE-marker absence checks in WPs that enable sourcemaps
>   must target `dist/assets/*.js`, not `dist/**`. If this WP adds any
>   new dev-only URL harness with a DCE marker, the Step 12 verification
>   command must use the narrower glob from the start. See D-6513.
> - **jsdom-setup import path** — WP-061's `BootstrapProbe.test.ts` at
>   `src/components/*.test.ts` imports `'../testing/jsdom-setup'`
>   (1 level up). WP-062 HUD tests at `src/components/hud/*.test.ts`
>   must import `'../../testing/jsdom-setup'` (2 levels up). Every
>   `mount()`-using HUD test must have this import as its **first
>   line** — load-bearing because `@vue/runtime-dom.resolveRootNamespace`
>   probes `SVGElement` at `app.mount()` under Vue 3.5.x (resolved
>   against the `^3.4.27` peer pin).
> - **Test script composition** — inherit WP-061's unchanged:
>   `node --import tsx --import @legendary-arena/vue-sfc-loader/register
>   --test src/**/*.test.ts` (D-6517). The glob already covers
>   `src/components/hud/*.test.ts`. No `NODE_OPTIONS`, no `cross-env`.
> - **EC slot** — EC-062 may be historically bound (the 060-series has
>   this risk; EC-061 was bound to the registry-viewer Rules Glossary
>   panel and WP-061 therefore used EC-067). Pre-flight must choose the
>   slot explicitly and triple-cross-reference WP header + EC header +
>   commit lineage, following the WP-061 / EC-067 precedent.

WP-061 is the authoritative source for the client app's toolchain. This
packet inherits — never re-decides — the following choices already
locked by WP-061 and subsequently by WP-067. Confirm each is in place
before writing HUD code. Any item below that returns a different
answer than WP-061/WP-067 is a **blocker**.

- **SFC transform pipeline:** the `node:test` + SFC transform pipeline
  WP-061 established must be in place and working. Do NOT invent a
  second transform for HUD component tests. Vitest, Jest, and Mocha
  are forbidden project-wide (lint §7, §12). If HUD tests require
  configuration not covered by WP-061's setup, raise a DECISIONS.md
  entry before coding.
- **Propagate WP-061's test-runner decision inline:** before writing
  HUD components, locate the `DECISIONS.md` entry WP-061 produced
  naming the exact SFC transform mechanism (loader hook, ESBuild/SWC
  register, pre-compile step, etc.) and paste a one-line summary into
  this packet's Session Context as an in-session amendment. Future
  readers should not have to cross-reference WP-061's commit history
  to know which transform this packet relied on.
- **Pinia store shape:** WP-061 exposes exactly one state field
  (`snapshot`) and one action (`setSnapshot`). This packet reads
  `store.snapshot` directly. It MUST NOT add getters, additional state,
  or additional actions to the store (that would violate WP-061's
  Scope Enforcement).
- **Fixture availability:** WP-061 committed `mid-turn.json`,
  `endgame-win.json`, `endgame-loss.json` under
  `apps/arena-client/src/fixtures/uiState/`, validated via
  `satisfies UIState` in `typed.ts`. HUD tests use those same fixtures
  through `loadUiStateFixture()` — do NOT duplicate fixtures or
  introduce new ones in this packet (new fixtures would need a WP of
  their own).
- **WP-067 scoring fields on `UIGameOverState.par`:** the four field
  names `rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`
  are **locked** by the WP-067 drift test at
  `packages/game-engine/src/ui/uiState.types.drift.test.ts`. Do NOT
  re-read them from the spec — bind aria-labels to these exact leaf
  names. There is no live PAR-delta field during `phase === 'play'`;
  the `par` key is absent at runtime today per D-6701. Any attempt to
  introduce a live PAR field is out of scope — stop and ask.
- **Spectator-HUD parity (WP-029):** confirm the HUD-visible subset of
  `UIState` is identical for `audience === 'player'` and
  `audience === 'spectator'` at the fields this HUD renders. The
  WP-067 forced cascade at `uiState.filter.ts:137` roundtrips
  `progress` unchanged (counters are public; no redaction). If a field
  is hidden from spectators, the HUD must render the same em-dash
  fallback it uses for absent optional fields — do NOT special-case.
- **Filter passthrough untouched:** WP-062 must NOT modify
  `packages/game-engine/src/ui/uiState.filter.ts`. The
  `progress: { ...uiState.progress }` passthrough added by EC-068 is
  the current correct shape. See P6-33 for the broader pattern.

If any item returns a different answer than expected, **stop and ask**
before writing a single component.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never import `@legendary-arena/game-engine` at runtime from any file in
  `apps/arena-client/src/components/hud/` — `import type` only
- Never import `@legendary-arena/registry` at runtime from this packet's
  files
- Never mutate the `UIState` snapshot received from the store — treat as
  readonly in all components
- Never use `Math.random()`, `Date.now()`, or `performance.now()` in any
  HUD source file
- No database, network, or filesystem access from any component
- ESM only, Node v22+; `node:` prefix on built-ins
- Test files use `.test.ts` extension — tests run under the **same SFC
  transform pipeline WP-061 established**; this packet does not create
  or modify a second transform
- Full file contents for every new or modified file. No diffs, no
  snippets, no "show only the changed section" output.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`
  (use Node's built-in `fetch`); no ORMs; no `Jest`, no `Vitest`, no
  `Mocha` — only `node:test`; no `passport`, no `auth0`, no `clerk`.
  Any new dependency requires a DECISIONS.md justification and the
  full updated `package.json` in the output.
- Do not modify WP-061 outputs (`src/stores/uiState.ts`, `src/main.ts`,
  `src/fixtures/`) unless a concrete reason is documented in
  DECISIONS.md and the Files Expected to Change list reflects the edit

**Packet-specific:**
- The HUD is **stateless** beyond local view state (panel collapsed flags,
  keyboard focus). All game data flows from the Pinia store.
- **Container / presenter split (strict):** only `<ArenaHud />` reads from
  `useUiStateStore()`. Every subcomponent (`<TurnPhaseBanner />`,
  `<SharedScoreboard />`, `<ParDeltaReadout />`, `<PlayerPanelList />`,
  `<PlayerPanel />`, `<EndgameSummary />`) receives its relevant
  `UIState` sub-slice **exclusively via props** and MUST NOT import
  `useUiStateStore` or any Pinia store module. A subcomponent that
  reads the store is a contract violation. This keeps tests
  trivial-to-set-up (pass a fixture slice as a prop, no store needed)
  and makes spectator-HUD reuse straightforward later.
- **No client-side arithmetic or aggregation whatsoever on game values:**
  no HUD component may sum, subtract, normalize, smooth, average,
  count, or otherwise combine multiple `UIState` numeric fields into a
  new game-relevant value. If a combined value is needed, it must be
  supplied by the engine projection in `UIState`. `.reduce()` is
  banned, but so is a hand-written loop or a `+` between two projected
  numbers in a `computed`. The only permitted "computation" is reading
  a single field and mapping it to a display string (including sign
  choice for PAR delta).
- **Every user-visible number's `aria-label` is the literal `UIState`
  field name**, verbatim — e.g., `aria-label="bystandersRescued"`, NOT
  `aria-label="Bystanders rescued"` or any paraphrase. Screen-reader
  output must be deterministic across builds and testable against
  exact strings. Visible display text may be human-readable
  (`"Bystanders rescued: 4"`), but the `aria-label` is the
  data-contract name.
- **PAR delta semantics, explicit by phase (post-WP-067 shape):**
  - If `snapshot.game.phase === 'end'` and `'par' in snapshot.gameOver`
    (equivalently, `snapshot.gameOver?.par` is defined): render
    `snapshot.gameOver.par.finalScore` exactly. `finalScore` lives on
    `UIParBreakdown` at `gameOver.par.finalScore`; `UIGameOverState`
    has **no** top-level `finalScore` field and **no** `preview`
    field — do not look for either.
  - Otherwise: render an em-dash (`—`), never zero. Under D-6701 the
    `par` key is absent (not present-as-undefined) on every runtime
    UIState today because `buildParBreakdown` returns `undefined`
    unconditionally, so branch-2 is the dominant path. Zero is a
    valid engine value and must not be synthesized client-side —
    when `gameOver.par.finalScore === 0`, render `0`, NOT an em-dash.
  - There is **no live PAR-delta field** on `UIState` during
    `phase === 'play'` today. Inventing one is out of scope.
  - The HUD must never compute, infer, smooth, or animate toward a
    PAR-delta value. The authoritative rendering rules live in
    §Scope (In) §D (ParDeltaReadout) and EC-069 §Guardrails + §D-6701
    Safe-Skip Rendering Rules; this bullet is a summary, not a
    parallel source of truth. If anything below contradicts §Scope
    (In) §D, §Scope (In) §D wins.
- No `team` vocabulary anywhere. Use `player`, `activePlayer`,
  `playerColor`.
- No registry HTTP calls from within HUD components — card display data
  arrives via `UIState` projections; fuller card lookup is a separate
  composable out of scope here.
- Color choices must pass WCAG AA contrast in both light and dark modes;
  indicator state must not rely on color alone (icon + color).
- **Visual emphasis uses `data-emphasis`, not CSS class names:** the
  bystanders-rescued counter renders with `data-emphasis="primary"`;
  all penalty counters (escaped villains, scheme twists, mastermind
  tactics) render with `data-emphasis="secondary"`. Tests assert
  attribute presence, not class tokens. Styling hangs off the
  attribute selector so refactors or theming cannot regress the
  emphasis contract.

**Session protocol:**
- If any `UIState` field is unclear or apparently missing, stop and ask
  before inventing a client-side fallback.
- If WP-065's Vue SFC test transform is not proven (its tests failing,
  or `@legendary-arena/vue-sfc-loader` not installed in
  `apps/arena-client/`), **STOP immediately**. This packet creates 6+
  SFC component test files; inventing a transform mid-session burns a
  session and produces inconsistent tooling. Fix WP-065 first.
- If any subcomponent would need to read from the store to render
  correctly, STOP — that is a sign the prop contract is wrong or a
  field is missing from `UIState`. Do not silently import the store
  as a workaround.

**Locked contract values (post-WP-067 — read from
`packages/game-engine/src/ui/uiState.types.ts`):**

- **UIState top-level keys:** `game`, `players`, `city`, `hq`,
  `mastermind`, `scheme`, `economy`, `log`, `progress`, `gameOver?`
  (note: `progress` is **required**, not optional)
- **UIPlayerState fields:** `playerId`, `deckCount`, `handCount`,
  `discardCount`, `inPlayCount`, `victoryCount`, `woundCount`,
  `handCards?` (optional — present for the viewing player, redacted
  for others and spectators)
- **UIProgressCounters (required on every UIState):**
  - `bystandersRescued: number`
  - `escapedVillains: number`
- **UIMastermindState fields:** `id`, `tacticsRemaining`,
  `tacticsDefeated`
- **UISchemeState fields:** `id`, `twistCount`
- **UIGameOverState fields:** `outcome`, `reason`, `scores?`, `par?`
- **UIParBreakdown (optional, ALWAYS ABSENT at runtime today per
  D-6701):**
  - `rawScore: number`
  - `parScore: number`
  - `finalScore: number`
  - `scoringConfigVersion: number`
- **Shared scoreboard field paths (verbatim for `aria-label`s — no
  paraphrasing):**
  - `progress.bystandersRescued` → `aria-label="bystandersRescued"`
  - `progress.escapedVillains` → `aria-label="escapedVillains"`
  - `scheme.twistCount` → `aria-label="twistCount"`
  - `mastermind.tacticsRemaining` → `aria-label="tacticsRemaining"`
  - `mastermind.tacticsDefeated` → `aria-label="tacticsDefeated"`
- **Phase names:** `'lobby' | 'setup' | 'play' | 'end'`
- **TurnStage values:** `'start' | 'main' | 'cleanup'`

---

## Debuggability & Diagnostics

- **Props-only subcomponents, one container:** `<ArenaHud />` is the
  sole store consumer; every subcomponent receives its `UIState`
  sub-slice exclusively as a prop. Test-only rendering therefore
  requires no store setup — construct a fixture slice, pass it as a
  prop, assert. This is the same pattern as the container/presenter
  split used by most well-tested Vue apps.
- Every component renders stable `data-testid` attributes on significant
  subtrees: `arena-hud-banner`, `arena-hud-player-panel-list`,
  `arena-hud-player-panel`, `arena-hud-scoreboard`, `arena-hud-par-delta`,
  `arena-hud-endgame`.
- **Emphasis is structural, not stylistic:** emphasized counters carry
  `data-emphasis="primary"`; penalty counters carry
  `data-emphasis="secondary"`. CSS selectors key off the attribute.
  Tests assert attribute presence, not class or style tokens.
- No component reads `Date.now()`, `performance.now()`, `Math.random()`,
  or `window.location` for game-relevant state.
- **Deterministic visible output:** given an identical `UIState` fixture,
  rendered **visible text content and `aria-label`-ed elements** are
  stable across runs. Attribute ordering, Vue-internal comment nodes,
  and hydration markers are noise — not part of the determinism
  contract.
- **Sourcemaps:** inherit WP-061's sourcemap setup (dev + build). Do
  not disable sourcemaps to "reduce bundle size" in this packet.
- **HUD color tokens carry explicit contrast ratios:** every token
  defined or used by HUD components has a numeric contrast ratio
  documented inline (e.g., `/* 7.2:1 on --color-background */`). No
  "AA compliant" hand-wave. The color-blind-safe palette values must
  be committed with source references (WebAIM contrast checker or
  equivalent) in DECISIONS.md.
- **Reproducible bug reports:** when a HUD bug is reported, the report
  must be reproducible by opening `?fixture=<name>` in dev (from WP-061)
  or by loading the same fixture in a test file. No "works on my
  machine" debugging — if it cannot be reproduced from a fixture, the
  bug is in fixture coverage, not the HUD.

---

## Scope (In)

### A) HUD root (the sole store consumer)
- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new**
  - **Only** this component imports `useUiStateStore()`. No other HUD
    component may.
  - **Authoring form:** `defineComponent({ setup() { return { … } } })`
    per D-6512 / P6-30 (setup-scope template bindings require this
    form under vue-sfc-loader separate-compile). Do NOT use
    `<script setup>` sugar for this file.
  - Composes: `<TurnPhaseBanner :game="snapshot.game" />`,
    `<SharedScoreboard :scheme="snapshot.scheme"
    :mastermind="snapshot.mastermind"
    :progress="snapshot.progress" />`,
    `<ParDeltaReadout :phase="snapshot.game.phase"
    :gameOver="snapshot.gameOver" />`,
    `<PlayerPanelList :players="snapshot.players"
    :activePlayerId="snapshot.game.activePlayerId" />`,
    `<EndgameSummary v-if="snapshot.gameOver"
    :gameOver="snapshot.gameOver" />`.
  - Renders `null` when `snapshot === null`.
  - `// why:` comment on the single-store-consumer pattern
    (container/presenter split).
  - `// why:` comment on the `defineComponent` authoring form
    (D-6512 / P6-30).

### B) Turn / phase banner (props-only)
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — **new**
  - Props: `game: UIState['game']`.
  - Displays `game.phase`, `game.turn`, `game.currentStage`; highlights
    `game.activePlayerId`.
  - `aria-live="polite"` on phase/stage changes.
  - `// why:` comment on the aria-live choice.
  - MUST NOT import `useUiStateStore`.

### C) Shared scoreboard (props-only)
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` — **new**
  - Props: `scheme: UISchemeState`, `mastermind: UIMastermindState`,
    `progress: UIProgressCounters`. All three types imported as
    `import type` from `@legendary-arena/game-engine` barrel.
  - Five counters, each rendered in a single element whose
    `aria-label` is the literal **leaf** field name:
    - `progress.bystandersRescued` — `aria-label="bystandersRescued"`
      — `data-emphasis="primary"`
    - `progress.escapedVillains` — `aria-label="escapedVillains"` —
      `data-emphasis="secondary"`
    - `scheme.twistCount` — `aria-label="twistCount"` —
      `data-emphasis="secondary"`
    - `mastermind.tacticsRemaining` — `aria-label="tacticsRemaining"`
      — `data-emphasis="secondary"`
    - `mastermind.tacticsDefeated` — `aria-label="tacticsDefeated"`
      — `data-emphasis="secondary"`
  - Render all five counters unconditionally — do NOT gate on
    `phase === 'play'`. `progress` is required on every UIState; at
    lobby both counters read zero.
  - Visible display text may be human-readable (e.g.,
    `"Bystanders rescued: 4"`) but the `aria-label` MUST be the
    literal leaf name for screen-reader determinism.
  - MUST NOT aggregate or sum any fields (no
    `tacticsRemaining + tacticsDefeated`, no "total tactics" number).
  - MUST NOT import `useUiStateStore`.
  - `// why:` comment on the bystanders-rescued emphasis tying back
    to Vision §Heroic Values in Scoring.
  - `// why:` comment on the `data-emphasis` attribute contract.
  - `// why:` comment explaining the literal-leaf-name aria-label
    rule (binds to the WP-067 drift test; paraphrasing breaks the
    deterministic a11y tree).

### D) PAR delta readout (props-only, D-6701 safe-skip aware)
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` — **new**
  - Props: `phase: UIState['game']['phase']`,
    `gameOver: UIGameOverState | undefined`. **No `live` prop** — the
    engine emits no live PAR delta at `phase === 'play'` today, and
    inventing one is out of scope.
  - Rendering rules, evaluated in order:
    1. If `phase === 'end'` and `gameOver` is defined and
       `'par' in gameOver` (equivalent: `gameOver.par !== undefined`):
       render `gameOver.par.finalScore` exactly.
    2. Else: render `—` (em-dash). Never render zero as a fallback.
       Under D-6701, branch (2) is the **dominant runtime path
       today** — `buildParBreakdown` returns `undefined`
       unconditionally, so `par` is absent on every fixture built
       from today's engine.
  - Sign convention (when a value is rendered): negative = under PAR
    (green + `▼` icon), positive = over PAR (amber + `▲` icon), zero
    = neutral (no arrow). Zero is a valid engine value and must
    render as `0`, NOT as em-dash.
  - The icon is always accompanied by text (color never the sole
    signal). `aria-label="finalScore"` (literal leaf name).
  - When rendering the four-field PAR breakdown for screen readers
    (optional enhancement — outside minimum scope), each of
    `rawScore`, `parScore`, `finalScore`, `scoringConfigVersion`
    uses its literal leaf name as `aria-label`. The minimum scope
    renders only `finalScore`.
  - Never computes, smooths, animates, or infers a value. Never
    subtracts `rawScore - parScore`; the engine supplies `finalScore`
    directly.
  - Tests assert `!('par' in gameOver)` (not `par === undefined`) —
    see preflight §D-6701 Safe-Skip Rendering Rules #1 for why the
    two forms differ under `Object.keys` / `JSON.stringify` / Vue
    `v-if` semantics.
  - MUST NOT import `useUiStateStore`.
  - `// why:` comment: no client-side math permitted here; em-dash
    vs zero is load-bearing — zero is a valid engine value, and
    `par` absent ≠ `finalScore === 0`.
  - `// why:` comment citing D-6701 (safe-skip runtime body) and
    naming the follow-up WP that will wire the payload — the HUD
    ships today against the dominant absent case and requires zero
    edits when the payload lands.

### E) Player panels (props-only)
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` — **new**
  - Props: `players: readonly UIPlayerState[]`,
    `activePlayerId: string`.
  - Iterates with `:key="player.playerId"`.
  - MUST NOT import `useUiStateStore`.
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new**
  - Props: `player: UIPlayerState`, `isActive: boolean`.
  - Displays the seven `UIPlayerState` fields, each with an
    `aria-label` matching the literal field name.
  - Applies `aria-current="true"` when `isActive`.
  - MUST NOT import `useUiStateStore`.

### F) Endgame summary (props-only)
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **new**
  - Props: `gameOver: UIGameOverState`.
  - Displays `gameOver.outcome` (aria-label `"outcome"`),
    `gameOver.reason` (aria-label `"reason"`).
  - If `'scores' in gameOver`: renders the `FinalScoreSummary`
    passthrough as display-only text. The HUD does NOT aria-label
    individual `FinalScoreSummary` members (they are out of scope
    for WP-062 — future scoreboard WPs own that surface).
  - If `'par' in gameOver`: renders all four `UIParBreakdown` fields
    as distinct labeled values, each with its literal leaf-name
    aria-label:
    - `rawScore` → `aria-label="rawScore"`
    - `parScore` → `aria-label="parScore"`
    - `finalScore` → `aria-label="finalScore"`
    - `scoringConfigVersion` → `aria-label="scoringConfigVersion"`
  - Under D-6701, the `par` block is absent on every runtime UIState
    today; `EndgameSummary` renders the outcome/reason/scores block
    and omits the par block entirely. The tests exercise both
    branches via fixture variants.
  - Never computes or derives PAR values; reads them verbatim from
    `gameOver.par`.
  - MUST NOT import `useUiStateStore`.
  - `// why:` comment on the four literal-leaf-name aria-labels
    binding to the WP-067 drift test.

### G) Accessibility + color utility
- `apps/arena-client/src/components/hud/hudColors.ts` — **new**
  - Exports `playerColorStyles(playerId: string): { background: string;
    foreground: string; icon: string }`
  - Uses a fixed color-blind-safe palette; the icon differentiator is
    mandatory so color is never the sole signal

### H) Tests (`node:test` + jsdom, using WP-065's SFC transform)
- Every `mount()`-using test file begins with
  `import '../../testing/jsdom-setup';` on line 1 (two levels up —
  see P6-32 preflight note).
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — is the
  **only** HUD test that sets up a Pinia store. Verifies: renders
  nothing when snapshot is null; renders all five subtrees when a
  full fixture is loaded; endgame subtree absent when `'gameOver' in
  snapshot` is false; asserts the other subcomponents receive the
  expected sub-slices via props.
  - **Deep-immutability assertion (aliasing defense):** for each
    fixture variant mounted, snapshot `JSON.stringify(uiState)`
    before mount, exercise any reactive interactions the test uses,
    then assert `JSON.stringify(uiState)` is identical after the
    render cycle. One `assert.strictEqual` on stringified snapshots
    per fixture variant. Proves the input snapshot object is not
    mutated through deep aliasing; does not attempt to prove
    anything about Vue's internal reactive proxy state.
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` —
  mounted with a props object (no store). Counters render exactly
  the values passed in, no rounding. Asserts:
  - `[data-emphasis="primary"]` is present exactly once (on bystanders
    rescued).
  - `[data-emphasis="secondary"]` is present on every penalty
    counter (four matches).
  - Every counter carries the literal leaf-name `aria-label`:
    `bystandersRescued`, `escapedVillains`, `twistCount`,
    `tacticsRemaining`, `tacticsDefeated`. No paraphrased labels
    like `"Bystanders rescued"` or `"Scheme twists"` appear.
  - Lobby branch: passing `{ bystandersRescued: 0, escapedVillains:
    0 }` renders both counters (not em-dashes, not hidden).
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` —
  mounted with a props object. Three branch tests:
  - `phase='end'` + `gameOver.par` present with `finalScore=-3` →
    renders `-3` with the `▼` icon and green styling.
  - `phase='end'` + `gameOver` present with `!('par' in gameOver)`
    (the D-6701 dominant case) → renders em-dash and no arrow.
  - `phase='play'` + `gameOver === undefined` → renders em-dash.
  - Additional zero-is-not-em-dash test: `phase='end'` +
    `gameOver.par.finalScore=0` → renders `0` with no arrow icon
    (zero is neutral, NOT em-dash).
  - Each assertion checks literal rendered text; no computed/derived
    value ever appears.
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` —
  mounted with a props object. The seven core zone fields
  (`playerId`, `deckCount`, `handCount`, `discardCount`,
  `inPlayCount`, `victoryCount`, `woundCount`) render with literal
  leaf-name `aria-label`s; active player gets `aria-current="true"`
  when `isActive` is true and absent otherwise. `handCards` is
  optional — when present, its count matches `handCount`; the HUD
  does not expand the hand into card faces (card display is future
  scope).
- `apps/arena-client/src/components/hud/PlayerPanelList.test.ts` —
  NEW file. Mounted with a props object containing a multi-player
  `players: readonly UIPlayerState[]` array (reuse the mid-turn
  fixture's players slice). **Ordering assertion (determinism
  defense):** assert that the rendered `PlayerPanel` component
  instances appear in the same order as the input array, compared
  by `playerId`. Use
  `wrapper.findAllComponents({ name: 'PlayerPanel' }).map(c =>
  c.props('player').playerId)` against
  `props.players.map(p => p.playerId)`. One assertion; the test
  file also covers basic mount / active-highlight propagation for
  completeness.
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` —
  mounted with a props object. Phase, turn, stage, and active-player
  highlight all render from the passed-in `game` slice; `aria-live`
  present on the phase/stage region.
- Drift test: imports `UIState` as a type and assigns a full fixture
  to it via `satisfies UIState` — fails to typecheck if any locked
  field is renamed or dropped upstream. Aligns with the engine-side
  `uiState.types.drift.test.ts` (WP-067) so a rename breaks BOTH
  sides.

---

## Out of Scope

- Floating, draggable, or z-order-managed windows — permanently dropped
  (design decision — vision misalignment, see session memory)
- Theming system (team colors, arena branding, skinnable CSS) — deferred
  to a future monetization / cosmetic WP
- Spectator-specific HUD layout or permission filtering — future
  spectator-HUD WP (consumes WP-029 projection)
- Game log panel rendering — WP-064
- Replay stepping or inspector controls — WP-064
- Live networking / WebSocket wiring — belongs to a future client-runtime
  WP and WP-032 integration
- Real-time visual effects beyond a single CSS transition on counter
  change
- Card image rendering, tooltips, or registry lookups
- Any engine-side change. `packages/game-engine/**` must not be modified
- Refactors, cleanups, or "while I'm here" improvements

---

## Files Expected to Change

- `apps/arena-client/src/components/hud/ArenaHud.vue` — **new**
- `apps/arena-client/src/components/hud/TurnPhaseBanner.vue` — **new**
- `apps/arena-client/src/components/hud/SharedScoreboard.vue` — **new**
- `apps/arena-client/src/components/hud/ParDeltaReadout.vue` — **new**
- `apps/arena-client/src/components/hud/PlayerPanelList.vue` — **new**
- `apps/arena-client/src/components/hud/PlayerPanel.vue` — **new**
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **new**
- `apps/arena-client/src/components/hud/hudColors.ts` — **new**
- `apps/arena-client/src/components/hud/ArenaHud.test.ts` — **new**
- `apps/arena-client/src/components/hud/TurnPhaseBanner.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/SharedScoreboard.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/ParDeltaReadout.test.ts` —
  **new**
- `apps/arena-client/src/components/hud/PlayerPanel.test.ts` — **new**
- `apps/arena-client/src/components/hud/PlayerPanelList.test.ts` —
  **new** — array-ordering assertion + basic mount coverage
- `apps/arena-client/src/App.vue` — **modified** — mount `<ArenaHud />`
  in place of (or alongside) the WP-061 `<BootstrapProbe />`
- `apps/arena-client/src/styles/base.css` — **modified** — add five
  HUD color tokens (`--color-emphasis`, `--color-penalty`,
  `--color-active-player`, `--color-par-positive`,
  `--color-par-negative`) under both light and dark
  `prefers-color-scheme` blocks, each with a numeric contrast-ratio
  comment against the appropriate background token (format:
  `/* 7.2:1 on --color-background */`). Do NOT replace or rename the
  existing three WP-061 tokens. See DECISIONS.md entry added this
  session for each contrast source.
- `apps/arena-client/src/stores/uiState.ts` — **modified** only if this
  packet needs an additional read-side accessor that WP-061 did not
  expose. If any modification is made, document why in DECISIONS.md.
  WP-061's scope lock (one state field, one action, no getters)
  normally means this file is NOT modified.
- `docs/ai/STATUS.md` — **modified** (governance update per DoD)
- `docs/ai/DECISIONS.md` — **modified** (governance update per DoD —
  contrast ratio sources, any deviation from WP-061/WP-067
  conventions, the literal-leaf-name aria-label rule, the no-client-
  side-arithmetic rule, the bystanders-rescued emphasis rule, the
  D-6701 em-dash-vs-zero rule)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance update
  per DoD)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip
  EC-069 from Draft to Done with today's date)

No other files may be modified. `packages/game-engine/**`,
`packages/registry/**`, `apps/server/**`, and `apps/registry-viewer/**`
must be untouched.

---

## Acceptance Criteria

### Layer Boundary
- [ ] No file under `apps/arena-client/src/components/hud/` imports
      `@legendary-arena/game-engine` at runtime (only `import type`
      permitted; confirmed with `Select-String`)
- [ ] No file under `apps/arena-client/src/components/hud/` imports
      `@legendary-arena/registry`
- [ ] No file under `apps/arena-client/src/components/hud/` mutates any
      prop it receives

### Container / Presenter Split
- [ ] Only `apps/arena-client/src/components/hud/ArenaHud.vue` imports
      `useUiStateStore` (confirmed with `Select-String`: grep for the
      store import across the HUD directory; exactly one match, in
      `ArenaHud.vue`).
- [ ] Every subcomponent's render output depends only on its declared
      props — manually verified by code review + fixture-driven tests
      that mount subcomponents without a Pinia plugin.

### Projection Fidelity
- [ ] Every number rendered in the HUD traces directly to a single
      `UIState` field — no client-side arithmetic, aggregation,
      summing, smoothing, or averaging of game values (confirmed by
      `Select-String` for `+` operator inside `<script>` blocks of
      `.vue` files + code review).
- [ ] PAR delta renders an em-dash when `!('par' in gameOver)` (the
      dominant runtime case under D-6701); zero is rendered when
      `gameOver.par.finalScore === 0`. Absent-vs-zero distinction is
      asserted in at least one test branch.
- [ ] The bystanders-rescued counter carries
      `data-emphasis="primary"` exactly once; all four penalty
      counters (`escapedVillains`, `twistCount`, `tacticsRemaining`,
      `tacticsDefeated`) carry `data-emphasis="secondary"` (asserted
      in tests).
- [ ] `<SharedScoreboard />` renders all five counters during
      `phase === 'lobby'` when both progress values are zero (no
      phase-based gating).

### Accessibility (SG-17)
- [ ] Every counter has an explicit `aria-label` equal to the literal
      **leaf** `UIState` field name — verbatim, no paraphrasing
      (`aria-label="bystandersRescued"`, `aria-label="twistCount"`,
      `aria-label="tacticsRemaining"`, `aria-label="tacticsDefeated"`,
      `aria-label="finalScore"`). Asserted in tests against exact
      strings. No pre-WP-067 draft names (`schemeTwists`,
      `mastermindTacticsRemaining`, `mastermindTacticsDefeated`,
      `parBaseline`) appear anywhere.
- [ ] Active player indicator uses `aria-current="true"` and an icon,
      not color alone.
- [ ] All text passes WCAG AA contrast in both light and dark modes
      (confirmed via automated tooling or manual check documented in
      DECISIONS.md with numeric ratios).

### Determinism
- [ ] Given a fixture `UIState`, rendered **visible text and
      `aria-label`-ed elements** are stable across runs (snapshot test
      asserts textContent + a11y tree; it does NOT snapshot raw
      innerHTML).
- [ ] No component reads `Date.now()`, `performance.now()`,
      `Math.random()`, or `window.location` (confirmed with
      `Select-String`).

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Every HUD component has at least one rendering test
- [ ] No test imports `boardgame.io` or any engine runtime module

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `packages/game-engine/**` is untouched

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0

# Step 2 — run all tests
pnpm --filter @legendary-arena/arena-client test
# Expected: all tests passing

# Step 3 — confirm no engine runtime import
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }
# Expected: no output

# Step 4 — confirm no wall-clock or RNG
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce in rendering
Select-String -Path "apps/arena-client/src/components/hud" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no "team" vocabulary
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "\bteam\b" -Recurse
# Expected: no output (Legendary is cooperative, not team-based)

# Step 7 — confirm ONLY ArenaHud.vue imports the store
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "useUiStateStore" -Recurse
# Expected: matches only in ArenaHud.vue; any other file matching is a contract violation

# Step 8 — confirm data-emphasis attribute is used
Select-String -Path "apps\arena-client\src\components\hud\SharedScoreboard.vue" -Pattern "data-emphasis"
# Expected: at least five matches (primary + four secondary)

# Step 9 — confirm literal leaf-name aria-labels (no paraphrasing)
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "aria-label=`"bystandersRescued`"|aria-label=`"escapedVillains`"|aria-label=`"twistCount`"|aria-label=`"tacticsRemaining`"|aria-label=`"tacticsDefeated`"|aria-label=`"finalScore`"" -Recurse
# Expected: at least six matches across SharedScoreboard.vue + ParDeltaReadout.vue + EndgameSummary.vue; no matches for paraphrased labels like "Bystanders rescued" / "Scheme twists" / "Tactics remaining"

# Step 9b — confirm no non-existent field names surface anywhere
Select-String -Path "apps\arena-client\src\components\hud" -Pattern "schemeTwists|mastermindTacticsRemaining|mastermindTacticsDefeated|parBaseline" -Recurse
# Expected: no output (these names were in the pre-WP-067 draft but do not exist in the engine; the current names are twistCount / tacticsRemaining / tacticsDefeated / parScore)

# Step 10 — confirm engine package untouched
git diff --name-only packages/game-engine/
# Expected: no output

# Step 11 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] Preflight items all resolved (SFC transform present, Pinia store
      shape matches WP-061, WP-061 fixtures loadable, WP-048 field names
      verified, spectator parity confirmed for rendered fields).
- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] No runtime import of `@legendary-arena/game-engine` or registry in
      any HUD file
- [ ] No `Math.random`, `Date.now`, or `performance.now` in any HUD file
- [ ] No `team` vocabulary anywhere in HUD source
- [ ] Only `ArenaHud.vue` imports `useUiStateStore` (container/presenter
      split enforced)
- [ ] `data-emphasis="primary"` appears exactly once in
      `SharedScoreboard.vue` (bystanders rescued); `data-emphasis="secondary"`
      on every penalty counter
- [ ] `aria-label` values are literal leaf `UIState` field names,
      not paraphrases (`bystandersRescued`, `escapedVillains`,
      `twistCount`, `tacticsRemaining`, `tacticsDefeated`,
      `finalScore` — NOT `schemeTwists`, NOT `parBaseline`)
- [ ] `packages/game-engine/**` untouched
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — the arena client renders a full HUD
      driven by `UIState` fixtures; wiring to live match state remains
      open
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why PAR delta renders
      em-dash instead of zero when absent; the color-blind-safe palette
      choice; the "no client-side arithmetic on game values" rule; the
      bystanders-rescued emphasis rule
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-062 checked off with
      today's date
