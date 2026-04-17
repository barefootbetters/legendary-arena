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
- [ ] **`G.activeScoringConfig` field ownership decided:** read
      `packages/game-engine/src/types.ts` to confirm whether WP-048 added
      `activeScoringConfig?: ScenarioScoringConfig` to `LegendaryGameState`.
      If yes, WP-067 §C is a no-op; record in DECISIONS.md as "adopted from
      WP-048". If no, WP-067 adds the field and wires it through
      `buildInitialGameState`; record in DECISIONS.md.
- [ ] **Bystander card-type slug confirmed:** `Select-String` for
      `'bystander'` in `packages/game-engine/src/rules/revealedCardTypes.ts`
      (or wherever `REVEALED_CARD_TYPES` lives). The slug is the exact
      string used in `G.villainDeckCardTypes[extId]` comparisons. If the
      slug is anything other than `'bystander'`, STOP and ask — do not
      proceed with a guess.
- [ ] **Existing counter path confirmed:**
      `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]` is incremented at
      `packages/game-engine/src/villainDeck/villainDeck.reveal.ts:120`.
      Re-verify; if moved, update the DECISIONS.md rationale entry.
- [ ] **Test baseline:** `pnpm -r test` exits 0 on `main`. Record the
      pre-execution test count (should include WP-061's 13 arena-client
      tests and WP-048's scoring tests). No regressions permitted after
      WP-067 lands.

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
- **PAR endgame gate:** `ctx.phase === 'end' && G.activeScoringConfig
  !== undefined`. Both conditions must be true. Neither one alone
  populates `par`.
- **PAR projection path:** `deriveScoringInputs(replayResult, gameLog)` +
  `buildScoreBreakdown(inputs, config)` — both from WP-048. Do NOT
  re-implement scoring arithmetic. If `buildUIState` does not have
  `replayResult` or `gameLog` available at call time, STOP and ask — do
  not synthesize partial inputs.
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
- `packages/game-engine/src/ui/uiState.build.ts` on the early-return
  path in `buildParBreakdown`: "a missing scoring config is legitimate
  (casual / non-scenario play); em-dash fallback happens client-side."
- `packages/game-engine/src/types.ts` on the conditional `activeScoringConfig?`
  field (only if this WP adds it): "runtime-only — never persisted; its
  presence marks the match as PAR-scored for `buildUIState` gating."

---

## Files to Produce

### Modified — engine
- `packages/game-engine/src/ui/uiState.types.ts` — adds `UIProgressCounters`,
  `UIParBreakdown`, `UIState.progress` (required), `UIGameOverState.par?`
  (optional)
- `packages/game-engine/src/ui/uiState.build.ts` — adds
  `countBystandersRescued`, `buildProgressCounters`, `buildParBreakdown`
  pure helpers; extends `buildUIState` return object with `progress` and
  conditional `gameOver.par`
- `packages/game-engine/src/index.ts` — exports `UIProgressCounters` and
  `UIParBreakdown` as types

### Modified — conditional (only if WP-048 did not already add the field)
- `packages/game-engine/src/types.ts` — adds
  `activeScoringConfig?: ScenarioScoringConfig` to `LegendaryGameState`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — threads
  optional `scoringConfig` input into `G.activeScoringConfig`

### New — tests
- `packages/game-engine/src/ui/uiState.build.progress.test.ts` — 7 tests
  (aggregation, lazy-init counter, negative-controls, determinism)
- `packages/game-engine/src/ui/uiState.build.par.test.ts` — 4 tests
  (gated by phase AND config, field exactness, determinism)
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — 2 tests
  (satisfies-fixture lock for each new interface)

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
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 and
      includes ≥ 13 new tests from this WP
- [ ] `pnpm -r test` exits 0 (zero regressions anywhere — specifically
      including the 13 arena-client tests from WP-061)
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
