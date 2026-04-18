# EC-068 — UIState Projection of PAR Scoring & Progress Counters (Execution Checklist)

**Source:** docs/ai/work-packets/WP-067-uistate-par-projection-and-progress-counters.md
**Layer:** Game Engine — UI projection (`packages/game-engine/src/ui/`)

> **EC numbering note:** EC-066 was claimed by WP-066 (registry-viewer
> image-to-data toggle); EC-067 was claimed by WP-061 (gameplay client
> bootstrap, executed 2026-04-17 at commit `2e68530`). WP-067 therefore
> uses EC-068 — the next free slot in the shared 060+ range. Commits for
> WP-067 use the `EC-068:` prefix. If anyone insists on `EC-067:` for
> WP-067, STOP — that prefix is historically bound to WP-061 and cannot
> be reused.

---

## Before Starting

- [ ] **WP-028 complete:** `buildUIState(G, ctx): UIState` is exported from
      `@legendary-arena/game-engine`, pure, and returns the locked 9-field
      `UIState` shape (`game`, `players`, `city`, `hq`, `mastermind`,
      `scheme`, `economy`, `log`, optional `gameOver`).
- [ ] **WP-048 complete:** `ScenarioScoringConfig`, `ScoreBreakdown`,
      `ScoringInputs`, `deriveScoringInputs`, `buildScoreBreakdown` are
      exported from `@legendary-arena/game-engine`. Confirm via
      `Select-String` in `packages/game-engine/src/index.ts`.
- [ ] **WP-020 complete:** `computeFinalScores(G): FinalScoreSummary`
      exists (already required by WP-028; re-verify because `ScoreBreakdown`
      reuses it).
- [ ] **`G.activeScoringConfig` field is added by WP-067 (UNCONDITIONAL):**
      pre-flight (2026-04-17) confirmed via grep that the field does not
      exist in `packages/game-engine/src/`. Per D-6702 WP-067 owns adding
      it. §C edits to `types.ts` and `setup/buildInitialGameState.ts` are
      **mandatory, not conditional** — do not treat them as no-ops.
- [ ] **Bystander card-type slug confirmed:** `Select-String` for
      `'bystander'` in
      `packages/game-engine/src/villainDeck/villainDeck.types.ts`
      (canonical location of `REVEALED_CARD_TYPES`; re-exported from
      `packages/game-engine/src/types.ts`). Pre-flight (2026-04-17)
      verified the slug is exactly `'bystander'` and that the same
      comparison is already used in
      `packages/game-engine/src/scoring/parScoring.logic.ts:76`. If the
      slug is anything other than `'bystander'`, STOP and ask — do not
      proceed with a guess.
- [ ] **Existing counter path confirmed:**
      `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]` is incremented at
      `packages/game-engine/src/villainDeck/villainDeck.reveal.ts:120`.
      Re-verify; if moved, update the DECISIONS.md rationale entry.
- [ ] **Test baseline:** `pnpm -r test` exits 0 on `main`. **Record the
      exact pre-execution test count as `PRE_COUNT`.** After WP-048
      (commit `2587bbb`) the expected value is **429** (3 registry + 396
      game-engine + 11 vue-sfc-loader + 6 server + 13 arena-client). If
      the number differs, STOP and investigate — a drifted baseline
      invalidates the arithmetic check in §After Completing. No
      regressions permitted after WP-067 lands.

---

## Locked Values (do not re-derive)

- **`UIProgressCounters` field names:** exactly `bystandersRescued` and
  `escapedVillains` — both `number`, both required.
- **`UIParBreakdown` field names:** exactly `rawScore`, `parScore`,
  `finalScore`, `scoringConfigVersion` — all `number`, all required.
  Verbatim from WP-048's `ScoreBreakdown`.
- **`UIState.progress`:** **non-optional** (`progress: UIProgressCounters`).
  Always present, even during `phase === 'lobby'` when both counters are `0`.
- **`UIGameOverState.par`:** **optional** (`par?: UIParBreakdown`).
  Present only when BOTH `ctx.phase === 'end'` AND
  `G.activeScoringConfig !== undefined`. Omitted entirely (not
  `undefined`, not `null`) in every other case — required by
  `exactOptionalPropertyTypes: true`.
- **Escaped-villains read:**
  `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0` — the `?? 0` is
  load-bearing. Do not fall back to `0`, `undefined`, `null`, or `-1` via
  any other path.
- **Bystanders-rescued aggregation scope:** each player's
  `playerZones[playerId].victory` only. Hand, deck, discard, inPlay
  zones are deliberately excluded. A bystander outside victory is not
  rescued.
- **Card-type comparison:** `G.villainDeckCardTypes[extId] === 'bystander'`.
  No prefix matching, no case normalization, no slug alias.
- **PAR endgame gate (type-level contract):** the type-level gate is
  `ctx.phase === 'end' && G.activeScoringConfig !== undefined`, but per
  **D-6701 safe-skip** `buildParBreakdown(G, ctx)` returns `undefined`
  unconditionally at MVP. `UIGameOverState.par` is therefore **always
  omitted** in WP-067's delivery, regardless of gate state. A follow-up
  WP supplies the payload once a `ReplayResult` is available to
  `buildUIState`.
- **PAR projection path (DEFERRED per D-6701):** the call
  `buildScoreBreakdown(deriveScoringInputs(replayResult, gameState), config)`
  is **NOT** executed in WP-067. `buildUIState(G, ctx)` has no
  `ReplayResult` in scope, and synthesizing one would violate D-4801.
  `buildParBreakdown` ships with signature `(G, ctx): UIParBreakdown |
  undefined` and body `return undefined;` plus a `// why:` comment
  citing D-6701. Do NOT re-implement scoring arithmetic; do NOT call
  `deriveScoringInputs`; do NOT import `ReplayResult`.
  **For reference only:** when the follow-up WP lands, the correct
  signature is `deriveScoringInputs(replayResult: ReplayResult,
  gameState: LegendaryGameState)` — NOT `(replayResult, gameLog)`.
- **No live PAR during `phase === 'play'`:** WP-067 projects PAR at
  endgame only. Live partial-PAR is a separate future WP.
- **Aggregation primitive:** `for...of` with descriptive variable names
  (`for (const playerZones of Object.values(G.playerZones))`, `for (const
  cardExtId of playerZones.victory)`). No `.reduce()` with branching. No
  `.filter().length`.

---

## Guardrails

- **`buildUIState` stays pure.** Given identical `G` and `ctx`, it must
  return a structurally equal `UIState`. A snapshot-equality test before
  and after the new projection is load-bearing proof.
- **No new G field introduced for bystanders-rescued.** The aggregation
  happens at projection time. If WP-048's `ScoringInputs.bystandersRescued`
  or any other engine component demands first-class counter tracking
  later, a separate WP adds `ENDGAME_CONDITIONS.BYSTANDERS_RESCUED`.
- **No change to existing `UIState` sub-type contracts.** Additive only.
  Renaming `UISchemeState.twistCount`, `UIMastermindState.tacticsRemaining`,
  `UIMastermindState.tacticsDefeated`, or any other existing field is
  **forbidden in this WP** — WP-062 aria-label reconciliation is WP-062's
  own spec refinement.
- **No UI semantic changes.** `apps/registry-viewer/**`, `apps/server/**`,
  `packages/registry/**`, `packages/vue-sfc-loader/**` must be untouched.
  WP-062 consumes WP-067's output via the already-frozen WP-061 store.
  The ONLY `apps/` edits permitted in this WP are the three fixture
  JSONs under `apps/arena-client/src/fixtures/uiState/` — strictly to
  add a top-level `progress` key so the existing `satisfies UIState`
  checks in `typed.ts` continue to compile. No component, store, or
  build-config change.
- **Fixture-conformance edits are scoped to the new `progress` key
  only.** Do not touch any other fixture field; do not re-order keys;
  do not reformat; do not reflow whitespace. A one-key addition per
  fixture is the entire scope of the fixture edits.
- **No boardgame.io import inside `packages/game-engine/src/ui/`** (pre-
  existing invariant; re-verified after this WP).
- **No `Math.random`, `Date.now`, `performance.now`** anywhere under
  `packages/game-engine/src/ui/` (pre-existing invariant; re-verified).
- **Drift-detection test is mandatory.** `uiState.types.drift.test.ts`
  imports `UIProgressCounters` and `UIParBreakdown` as types and pins
  every field name via `satisfies` against a literal fixture. Any future
  renamer fails typecheck here before a runtime test has to catch it.
  This is the contract WP-062's aria-label assertions depend on.
- **01.5 Runtime Wiring Allowance — NOT INVOKED.** No new field added to
  `LegendaryGameState` except the conditional `activeScoringConfig?:
  ScenarioScoringConfig`, which is a data-only config field (not a
  runtime-behavior type). No new move. No new phase hook. No change to
  `buildInitialGameState`'s return shape other than the one-field optional
  addition. The session prompt must include an explicit `### Runtime
  Wiring Allowance — NOT INVOKED` block per P6-10.
- **Any file beyond the WP-067 allowlist is a scope violation** (P6-27).
  STOP and escalate to a pre-flight amendment rather than shipping a
  12th or 13th file outside §Files Expected to Change.

---

## Required `// why:` Comments

- `packages/game-engine/src/ui/uiState.types.ts` on `UIProgressCounters`:
  "projected for WP-062 HUD consumption; `bystandersRescued` aggregates
  from each player's victory pile, `escapedVillains` surfaces
  `G.counters[ESCAPED_VILLAINS]`. See WP-067."
- `packages/game-engine/src/ui/uiState.types.ts` on `UIParBreakdown`:
  "verbatim name-for-name mirror of WP-048 `ScoreBreakdown` so WP-062
  aria-labels bind to a single contract. Optional on `UIGameOverState`
  because not every match is PAR-scored."
- `packages/game-engine/src/ui/uiState.build.ts` on `countBystandersRescued`:
  "aggregation happens at projection time instead of tracking a first-
  class counter. If write-path events need a counter later, introduce
  `ENDGAME_CONDITIONS.BYSTANDERS_RESCUED` in a separate WP."
- `packages/game-engine/src/ui/uiState.build.ts` on the `?? 0` in
  `buildProgressCounters`: "counter is lazily initialised on first
  escape; absence is semantically zero."
- `packages/game-engine/src/ui/uiState.build.ts` on the
  unconditional-`undefined` body of `buildParBreakdown`: "per D-6701,
  PAR payload is deferred until `buildUIState` has access to a
  `ReplayResult`. The type-level contract ships via `UIParBreakdown`
  and the drift test locks the four field names. Body stays
  `return undefined;` unconditionally — no call to
  `deriveScoringInputs` / `buildScoreBreakdown`. A follow-up WP
  resolves the data source."
- `packages/game-engine/src/ui/uiState.build.ts` on the conditional
  `...(par !== undefined ? { par } : {})` spread inside `gameOver`:
  "wire preserved as the D-6701 extension seam — current branch is
  unreachable (`buildParBreakdown` returns `undefined`) but the follow-
  up WP that supplies the payload only modifies `buildParBreakdown`'s
  body, not `buildUIState`."
- `packages/game-engine/src/types.ts` on the new `activeScoringConfig?`
  field (added unconditionally per D-6702): "runtime-only — never
  persisted (see ARCHITECTURE.md Section 3); its presence marks the
  match as PAR-scored for future `buildUIState` gating once D-6701's
  follow-up WP lands. WP-067 adds the field; WP-048 explicitly
  deferred it per D-4802."
- `packages/game-engine/src/setup/buildInitialGameState.ts` on the new
  fourth positional parameter: "4th positional optional parameter per
  D-6703; narrowest additive change that keeps the 9-field
  `MatchSetupConfig` lock (D-1244) and D-4805 scenario-config
  separation intact."

---

## Files to Produce

### Modified — engine
- `packages/game-engine/src/ui/uiState.types.ts` — adds `UIProgressCounters`,
  `UIParBreakdown`, `UIState.progress` (required), `UIGameOverState.par?`
  (optional)
- `packages/game-engine/src/ui/uiState.build.ts` — adds
  `countBystandersRescued`, `buildProgressCounters`, and
  `buildParBreakdown` pure helpers; extends `buildUIState` return object
  with `progress` (always). Per D-6701, `buildParBreakdown(G, ctx)`
  returns `undefined` unconditionally, so `gameOver.par` is always
  omitted at MVP — the four type-level field names remain locked via
  the drift test.
- `packages/game-engine/src/index.ts` — exports `UIProgressCounters` and
  `UIParBreakdown` as types

### Modified — engine (UNCONDITIONAL per D-6702)
- `packages/game-engine/src/types.ts` — adds
  `readonly activeScoringConfig?: ScenarioScoringConfig` to
  `LegendaryGameState` (pre-flight 2026-04-17 confirmed the field does
  not exist in source; the WP-048-already-added branch is inoperative).
- `packages/game-engine/src/setup/buildInitialGameState.ts` — adds a
  **fourth positional optional parameter** `scoringConfig?:
  ScenarioScoringConfig` (per D-6703). Assigns
  `G.activeScoringConfig = scoringConfig` when
  `scoringConfig !== undefined`. `MatchSetupConfig` is NOT modified.

### New — tests
- `packages/game-engine/src/ui/uiState.build.progress.test.ts` — 7 tests,
  each wrapped in exactly **one** top-level `describe()` block (suite
  count +1). Scope: aggregation, lazy-init counter, negative-controls,
  determinism.
- `packages/game-engine/src/ui/uiState.build.par.test.ts` — 4 tests,
  each wrapped in exactly **one** top-level `describe()` block (suite
  count +1). Scope (D-6701 safe-skip):
  1. `gameOver.par` is undefined at `phase !== 'end'`.
  2. `gameOver.par` is undefined at `phase === 'end'` when
     `G.activeScoringConfig` is undefined.
  3. `gameOver.par` is undefined even when `phase === 'end'` AND
     `G.activeScoringConfig !== undefined` (safe-skip path per D-6701).
  4. Determinism: two calls with identical `G` + `ctx` produce
     structurally equal `gameOver` (both with `par` absent).
  Do NOT assert any numeric payload on `par` — it is always absent at
  MVP.
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — 2 tests,
  wrapped in exactly **one** top-level `describe()` block (suite
  count +1). Scope: satisfies-fixture lock for `UIProgressCounters` and
  `UIParBreakdown`. This enforces the four PAR field names at the type
  level even though the payload is safe-skipped.

**Suite-count lock:** exactly +3 suites (one `describe()` per file).
Pre-execution engine-suite baseline is 98; expected
`POST_GAME_ENGINE_SUITE_COUNT === 101`. Bare top-level `test()` calls
that skip `describe()` are forbidden — they would break the +3 suite
arithmetic.

### Modified — WP-061 fixture type-conformance (three JSON edits only)
- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — add
  `"progress": { "bystandersRescued": 4, "escapedVillains": 1 }` as a
  top-level key. No other change.
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — add
  `"progress": { "bystandersRescued": 9, "escapedVillains": 2 }` as a
  top-level key. No other change.
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — add
  `"progress": { "bystandersRescued": 1, "escapedVillains": 8 }` as a
  top-level key. No other change.

### Modified — governance
- `docs/ai/STATUS.md`
- `docs/ai/DECISIONS.md`
- `docs/ai/work-packets/WORK_INDEX.md`

**Untouched:** `apps/registry-viewer/**`, `apps/server/**`,
`packages/registry/**`, `packages/vue-sfc-loader/**`, any
`packages/game-engine/src/` path outside `ui/`, `types.ts`, `setup/`
except per conditional §C. The ONLY `apps/` paths this WP touches are
the three fixture JSONs above — no `.vue`, no `.ts`, no `package.json`,
no `tsconfig.json`, no `vite.config.ts` edit under `apps/arena-client/`.
`git diff --name-only` must match the above exactly.

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0. **Record
      `POST_GAME_ENGINE_COUNT`.** The engine baseline after WP-048 is
      396 passing / 98 suites; WP-067 adds ≥ 13 new tests, so
      `POST_GAME_ENGINE_COUNT >= 409`. **Exact arithmetic check:**
      `POST_GAME_ENGINE_COUNT - 396 >= 13` (equality preferred — any
      overage must be justifiable as drift-detection or aliasing
      strengthening within declared test intent).
- [ ] `pnpm -r test` exits 0. **Record `POST_COUNT`.** Assert:
      `POST_COUNT - PRE_COUNT === NEW_TESTS_ADDED` (strict equality).
      With `PRE_COUNT = 429` and WP-067's declared `≥ 13` new tests,
      the expected `POST_COUNT` is ≥ 442. If `POST_COUNT - PRE_COUNT`
      does not equal the number of tests WP-067 declared in its
      §Files Expected to Change, STOP — either a test regressed or a
      test was silently skipped. This arithmetic check exists because
      EC-048 §After Completing quoted "392/425" for WP-048 post-
      execution totals while the spec required 16+4 = 20 new tests;
      WP-048 landed at 396/429 correctly, but the quoted-total drift
      could have masked a regression. Strict arithmetic prevents
      recurrence.
- [ ] `Select-String` confirms no boardgame.io / registry / apps import
      under `packages/game-engine/src/ui/`
- [ ] `Select-String` confirms no `Math.random`, `Date.now`, or
      `performance.now` under `packages/game-engine/src/ui/`
- [ ] `Select-String` confirms no `.reduce()` in `uiState.build.ts`
- [ ] `UIProgressCounters` and `UIParBreakdown` appear in
      `packages/game-engine/src/index.ts` exports (≥ 2 matches)
- [ ] `git diff --name-only apps/ packages/registry/ packages/vue-sfc-loader/`
      returns no output
- [ ] `docs/ai/STATUS.md`, `DECISIONS.md`, `WORK_INDEX.md` updated per DoD
- [ ] DECISIONS.md records:
  - projection-time aggregation vs first-class counter rationale for
    bystanders
  - `gameOver.par` optionality rationale (ExactOptionalPropertyTypes
    discipline)
  - `G.activeScoringConfig` field ownership ("added by WP-067" OR
    "adopted from WP-048")
  - 01.5 NOT-INVOKED declaration
- [ ] **01.6 post-mortem is MANDATORY** — criteria met: (1) new contract
      (`UIProgressCounters`, `UIParBreakdown`) consumed by WP-062; (2) new
      long-lived abstraction (projection-time aggregation pattern that
      future UIState extensions may follow). Run in-session per P6-28.

---

## Common Failure Smells

- **`TypeError: Cannot read properties of undefined (reading 'victory')`** →
  `G.playerZones` iterated before setup completed, or
  `Object.values(G.playerZones)` used on an accidentally-null `G`. Confirm
  the test harness populates `G.playerZones` via `buildInitialGameState`
  before calling `buildUIState`.
- **`gameOver.par` appears when `phase !== 'end'`** → the `buildParBreakdown`
  guard was written as `OR` instead of `AND`, or the phase string
  compared loosely (`phase === 'end' || phase === 'END'`). The guard is
  a strict `&&` on both conditions with `ctx.phase === 'end'` literal.
- **`gameOver.par` stays `undefined` when both conditions are true** →
  `G.activeScoringConfig` was never wired through `buildInitialGameState`
  (conditional §C skipped when it shouldn't have been). Confirm
  `G.activeScoringConfig` is actually populated in the test fixture.
- **Drift test fails with "Property 'bystandersRescued' does not exist on
  type 'UIProgressCounters'"** → the interface typo'd a field name.
  `satisfies` fixtures are the type's guard rail; fix the interface, not
  the fixture.
- **`bystandersRescued` counts bystanders in hand / deck / discard /
  inPlay** → the aggregation loop iterated the wrong zone set. Only
  `victory` counts. The negative-control test case (a bystander in each
  non-victory zone, expected `bystandersRescued === 0`) catches this
  before pre-commit.
- **`escapedVillains === undefined` or `NaN`** → the `?? 0` was omitted,
  or a typo (`??` vs `||`, `||` vs `&&`). `0` is a valid engine value;
  do not use `||` which conflates with falsy values.
- **`buildUIState` mutates `G` during projection** → a helper assigned to
  `G.activeScoringConfig` instead of reading from it. Run the
  before/after `JSON.stringify(G)` equality test in the determinism
  suite.
- **Scope creep: editing any `apps/arena-client/` file beyond the three
  fixture JSONs** → only the three `*.json` files under
  `src/fixtures/uiState/` are in scope, and only to add the top-level
  `progress` key. Touching `BootstrapProbe.vue`, `uiState.ts`,
  `main.ts`, `typed.ts`, `package.json`, `tsconfig.json`, `vite.config.ts`,
  or anything else under `apps/arena-client/` is a scope violation (P6-27)
  and must STOP + escalate to a pre-flight amendment.
- **Fixture value drift: changing non-`progress` fields while "cleaning
  up" the JSON** → forbidden. One key addition per fixture is the entire
  scope. Keep existing values, ordering (prepending `progress` or
  appending is fine — test suite doesn't care), and whitespace style
  matching the surrounding file.
- **`tsc` error "Type '{ ... }' is not assignable to type 'UIState'"
  not resolved by the fixture edits** → the JSON edit is missing or
  mistyped (e.g., `"progress": {}` with no sub-fields, or `"progress":
  null`). Both `bystandersRescued` and `escapedVillains` are required
  `number` fields. `{}` fails the sub-type check; `null` fails at the
  object level.
