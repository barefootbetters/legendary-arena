# WP-067 — UIState Projection of PAR Scoring & Progress Counters

**Status:** Draft
**Primary Layer:** Game Engine (UI projection)
**Dependencies:** WP-028 (UIState contract), WP-048 (PAR scoring engine types)

---

## Session Context

WP-028 locked `UIState` as the sole engine → UI projection and established
`buildUIState(G, ctx): UIState` as its builder. WP-048 introduces PAR scoring
engine types (`ScenarioScoringConfig`, `ScoringInputs`, `ScoreBreakdown`,
`LeaderboardEntry`) under `packages/game-engine/src/scoring/parScoring.*`
and explicitly declares **"No UI changes — scoring produces data, not
display"** in its §Out of Scope. WP-062 (Arena HUD) needs to render PAR
fields (`rawScore`, `parScore`, `finalScore`) at `phase === 'end'` and
live progress counters (`bystandersRescued`, `escapedVillains`) during
`phase === 'play'`. Today neither projection exists: PAR fields live only
inside `ScoreBreakdown` and `LeaderboardEntry`; `bystandersRescued` has no
engine home at all; `escapedVillains` exists as `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
but is never projected into `UIState`. This packet closes the projection gap
so WP-062 can consume a stable, fully-typed projection via the existing
`useUiStateStore()` / `snapshot` contract from WP-061.

**Discovered by:** WP-061 execution audit of WP-062 (2026-04-17), recorded
in `session-context-wp062.md` §IMPORTANT and in the 01.4 Precedent Log.

---

## Goal

After this session, `buildUIState(G, ctx): UIState` emits two new pieces of
projection data:

1. A top-level `progress: UIProgressCounters` sub-object with two fields:
   - `bystandersRescued: number` — aggregate count of bystander-type cards
     in every player's victory pile, derived from `G.villainDeckCardTypes`
     and `G.playerZones[*].victory`.
   - `escapedVillains: number` — direct projection of
     `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0`.
2. A new optional `par?: UIParBreakdown` field on `UIGameOverState` with
   four fields (`rawScore`, `parScore`, `finalScore`,
   `scoringConfigVersion`), populated only at `phase === 'end'` and only
   when the match was configured with a `ScenarioScoringConfig` (stored at
   setup time in `G.activeScoringConfig`).

The projection is additive — no existing `UIState` sub-type's contract
changes. WP-062 is unblocked without any further engine work beyond
potential aria-label reconciliation.

---

## Assumes

- WP-028 complete. Specifically:
  - `buildUIState(G, ctx): UIState` exists and is pure
  - `UIState`, `UIPlayerState`, `UIGameOverState`, and the other six
    sub-types are exported as types
  - `UIState.gameOver?: UIGameOverState` is already optional
- WP-048 complete. Specifically:
  - `ScenarioScoringConfig` and `ScoreBreakdown` types are exported from
    `@legendary-arena/game-engine`
  - `deriveScoringInputs(replayResult, gameLog): ScoringInputs`,
    `buildScoreBreakdown(inputs, config): ScoreBreakdown` exist as pure
    helpers
- WP-020 complete: `computeFinalScores(G): FinalScoreSummary` exists
- `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` is populated
  at setup time and carries `'bystander'` as one of the canonical types.
  Canonical `REVEALED_CARD_TYPES` lives at
  `packages/game-engine/src/villainDeck/villainDeck.types.ts` and is
  re-exported from `packages/game-engine/src/types.ts` (verified at
  pre-flight 2026-04-17).
- `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]` is maintained by
  `villainDeck.reveal.ts:120` on every villain escape
- WP-061 complete (commit 2e68530). `apps/arena-client/` consumes `UIState`
  through a type-only import and a Pinia store. WP-067 does not modify any
  client-side file.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — engine owns
  `UIState`; UI never reads `G` directly
- `docs/ai/ARCHITECTURE.md §Persistence Boundary` — `G` is runtime-only
- `.claude/rules/game-engine.md` — engine-layer invariants
- `.claude/rules/code-style.md` — no `.reduce()` in zone ops / projection;
  `for...of` with descriptive variable names
- `docs/ai/DECISIONS.md D-0301` — UI Consumes Projections Only
- `docs/ai/DECISIONS.md D-0302` — Single UIState, Multiple Audiences
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — locked `UIState` shape
- `docs/ai/work-packets/WP-048-par-scenario-scoring-leaderboards.md`
  §Scope (In) §A — `ScoreBreakdown` and `ScenarioScoringConfig` types this
  packet projects
- `docs/ai/work-packets/WP-062-arena-hud-scoreboard.md` §Preflight — the
  blocker chain this packet closes (items 1–3)
- `packages/game-engine/src/ui/uiState.types.ts` — current `UIState` /
  `UIGameOverState` shapes
- `packages/game-engine/src/ui/uiState.build.ts` — current `buildUIState`
  body and its pure-helper conventions (`countWounds`, `for...of` loops)
- `packages/game-engine/src/endgame/endgame.types.ts` — `ENDGAME_CONDITIONS`
  constants

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- **Human-style code** per `docs/ai/REFERENCE/00.6-code-style.md` (no
  abbreviations; full-word names; JSDoc on every function; `// why:`
  comments on non-obvious code; full-sentence error messages; no `import
  *`; no barrel re-exports; no premature abstraction). Junior-developer
  readability is the bar.
- Never import `boardgame.io` in files under `packages/game-engine/src/ui/`
- Never import from `packages/registry/**` anywhere in this packet
- Never import from `apps/**` anywhere in this packet
- `buildUIState` remains **pure** — no I/O, no mutation of `G` or `ctx`,
  no wall-clock reads, no RNG. Given the same `G` and `ctx` it returns
  the same `UIState`.
- No `.reduce()` with branching logic (00.6 Rule 8). Aggregations use
  `for...of` loops with descriptive variable names. `.reduce()` is only
  permitted for simple sum-of-numbers accumulation.
- No new runtime dependency on `Math.random()`, `Date.now()`, or
  `performance.now()`.
- ESM only, Node v22+. `node:` prefix on all Node built-in imports in
  tests (00.6 Rule 9).
- Test files use `.test.ts` extension — never `.test.mjs`.
- Full file contents for every new or modified file. No diffs, no
  snippets.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no
  ORMs, no Jest, no Vitest, no Mocha — only `node:test`; no `passport`,
  no `auth0`, no `clerk`. No new npm dependencies introduced by this
  packet.

**Packet-specific:**
- `UIProgressCounters` and `UIParBreakdown` are **data-only** types —
  numbers and primitives; no functions, closures, or Maps.
- `par?` on `UIGameOverState` uses the exact-optional-property-type
  convention: absent when no scoring config; never `{ par: null }` or
  `{ par: undefined }`.
- Aggregation of `bystandersRescued` scans each player's `victory` zone
  and consults `G.villainDeckCardTypes[extId] === 'bystander'`. It does
  NOT scan other zones (hand, deck, discard, inPlay). A bystander in
  another zone is not "rescued" — the victory pile is the canonical
  rescue marker.
- `escapedVillains` reads `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]
  ?? 0`. The `?? 0` is load-bearing: the counter is created lazily on
  first escape and absent until then; treating absence as `0` preserves
  the JSON contract.
- `UIParBreakdown` is populated only when **both** `phase === 'end'` AND
  `G.activeScoringConfig` is defined. Otherwise `gameOver.par` is omitted
  entirely.
- `G.activeScoringConfig: ScenarioScoringConfig | undefined` is the
  canonical home for the active match's scoring config. Per **D-6702**
  (confirmed at pre-flight 2026-04-17 that the field does not exist in
  source) WP-067 **unconditionally** adds the field to
  `LegendaryGameState` and wires the setup path. The WP-048-already-added
  branch is inoperative.
- PAR projection payload is **DEFERRED via D-6701 safe-skip**.
  `buildParBreakdown(G, ctx)` returns `undefined` unconditionally at
  MVP. The function is NOT wired to `buildScoreBreakdown` /
  `deriveScoringInputs` — `buildUIState(G, ctx)` has no `ReplayResult`
  in scope and inventing one would violate D-4801. WP-067 ships
  `UIParBreakdown` as a type-level contract (drift-test enforced); a
  follow-up WP delivers the runtime payload once a `ReplayResult` is
  available. **For reference only:** the correct helper signature is
  `deriveScoringInputs(replayResult: ReplayResult, gameState:
  LegendaryGameState)` — NOT `(replayResult, gameLog)` as earlier WP
  drafts suggested.
- No live PAR computation during `phase === 'play'`. `UIParBreakdown` is
  endgame-only. WP-062's "live PAR-delta field" assumption is explicitly
  out of scope — WP-062 pre-flight must tolerate `live=undefined` (which
  its §Scope (In) D already handles via em-dash fallback).

**Session protocol:**
- If WP-048's `ScoreBreakdown` field names (`rawScore`, `parScore`,
  `finalScore`, `scoringConfigVersion`) differ from what this packet
  documents, stop and ask.
- If `G.activeScoringConfig` already exists under a different name from
  WP-048's execution, stop and ask — do not introduce a parallel field.
- If the actual `RevealedCardType` slug for bystanders is anything other
  than `'bystander'`, stop and ask.

**Locked contract values:**
- `UIProgressCounters` field names: `bystandersRescued`, `escapedVillains`
  (exact strings — these become WP-062 aria-label assertions)
- `UIParBreakdown` field names: `rawScore`, `parScore`, `finalScore`,
  `scoringConfigVersion` (verbatim from WP-048 `ScoreBreakdown`)
- `UIState.progress` is **non-optional** (always present, even in
  `phase === 'lobby'` where values are all `0`)
- `UIGameOverState.par` is **optional** (`par?: UIParBreakdown`)

---

## Debuggability & Diagnostics

- **Determinism:** given identical `G` and `ctx`, `buildUIState` produces
  identical output. Two new tests assert this explicitly for the new
  fields — one before and after a speculative mutation of `G` (then
  reverted) to prove purity.
- **No hidden state:** no module-level caches. Every aggregation happens
  per call.
- **Projection is observable:** any future debug session can invoke
  `buildUIState(G, ctx)` and inspect `result.progress` and
  `result.gameOver?.par` directly.
- **Type-level drift detection:** a drift test imports `UIProgressCounters`
  and `UIParBreakdown` as types and asserts each field's presence via
  `satisfies` against a literal fixture. A renamed field fails typecheck
  before a runtime test has to catch it.

---

## Scope (In)

### A) `packages/game-engine/src/ui/uiState.types.ts` — **modified**

Add two new exported interfaces and one new optional field:

- `UIProgressCounters { bystandersRescued: number; escapedVillains: number }`
- `UIParBreakdown { rawScore: number; parScore: number; finalScore: number; scoringConfigVersion: number }`
- Extend `UIState` with a new required field: `progress: UIProgressCounters`
- Extend `UIGameOverState` with a new optional field: `par?: UIParBreakdown`
- Export both new type names from `packages/game-engine/src/index.ts`
- `// why:` comment on each new field citing WP-062 consumer expectations

### B) `packages/game-engine/src/ui/uiState.build.ts` — **modified**

- Add pure helper `countBystandersRescued(G: LegendaryGameState): number`:
  - Iterates `G.playerZones` via `for...of Object.values(G.playerZones)`
  - For each player, iterates `zones.victory` via `for...of`
  - Counts cards where `G.villainDeckCardTypes[extId] === 'bystander'`
  - Returns the total
  - No `.reduce()`
  - JSDoc with parameter / return / error documentation
- Add pure helper `buildProgressCounters(G: LegendaryGameState): UIProgressCounters`:
  - Returns `{ bystandersRescued: countBystandersRescued(G), escapedVillains: G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0 }`
  - `// why:` comment on the `?? 0` — counter is lazily initialised
- Add pure helper `buildParBreakdown(G: LegendaryGameState, ctx: UIBuildContext): UIParBreakdown | undefined`:
  - **Body is `return undefined;`** unconditionally, per D-6701
    safe-skip. No phase check, no config check, no call to
    `deriveScoringInputs`, no call to `buildScoreBreakdown`.
  - `// why:` comment citing D-6701: "PAR projection payload is deferred
    until `buildUIState` has access to a `ReplayResult`. The type-level
    contract ships via `UIParBreakdown`; the drift test locks the four
    field names. A follow-up WP resolves the data source (threading
    `replayResult` into `buildUIState`, persisting `moveCount` into G at
    endgame, or moving PAR projection to a server-side pipeline)."
  - No imports of `ReplayResult`, `deriveScoringInputs`, or
    `buildScoreBreakdown` in `uiState.build.ts`.
- Extend `buildUIState` return construction to include
  `progress: buildProgressCounters(G)` unconditionally.
- Extend `buildUIState` return construction to **also** wire
  `buildParBreakdown(G, ctx)` via the conditional-assignment pattern
  (WP-029 precedent) — concretely, inside the existing `if
  (endgameResult !== null)` block that builds `gameOver`, compute
  `const par = buildParBreakdown(G, ctx);` and include `par` in the
  `gameOver` object only via `...(par !== undefined ? { par } : {})`.
  Under D-6701 the branch is currently unreachable (`buildParBreakdown`
  always returns `undefined`), but the wire MUST be present so the
  follow-up WP that supplies the payload only has to modify the helper
  body — not `buildUIState` itself. This is the extension seam the
  drift test is guarding.

### C) `packages/game-engine/src/types.ts` and `setup/buildInitialGameState.ts` — **modified (UNCONDITIONAL per D-6702 / D-6703)**

Pre-flight (2026-04-17) confirmed via grep that
`G.activeScoringConfig` does not exist anywhere in
`packages/game-engine/src/`. WP-067 adds it:

- `packages/game-engine/src/types.ts`: add
  `readonly activeScoringConfig?: ScenarioScoringConfig;` to
  `LegendaryGameState`, with a `// why:` comment explaining the field
  is runtime-only, never persisted, and marks the match as PAR-scored
  for future `buildUIState` gating.
- `packages/game-engine/src/setup/buildInitialGameState.ts`: add a
  **fourth positional optional parameter**
  `scoringConfig?: ScenarioScoringConfig` (per D-6703). Full new
  signature:

  ```
  buildInitialGameState(
    config: MatchSetupConfig,
    registry: CardRegistryReader,
    context: SetupContext,
    scoringConfig?: ScenarioScoringConfig,
  ): LegendaryGameState
  ```

  Inside the function body, set
  `G.activeScoringConfig = scoringConfig` when
  `scoringConfig !== undefined`. Leave the field unset otherwise (do
  not assign `undefined` explicitly under
  `exactOptionalPropertyTypes`).

`MatchSetupConfig` is **not** modified (D-4805, D-1244 remain locked).
No existing call sites break because the new parameter is optional.

### D) Tests — `packages/game-engine/src/ui/uiState.build.progress.test.ts` — **new**

- `progress` is always present on `buildUIState` output
- `bystandersRescued === 0` when no player has bystander cards in victory
- `bystandersRescued` sums across all players' victory piles
- `bystandersRescued` does NOT count bystander cards in hand / deck /
  discard / inPlay (explicit negative-control fixture)
- `escapedVillains` reads `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
- `escapedVillains === 0` when the counter is absent (lazy-init case)
- Determinism: two calls to `buildUIState` with the same `G` produce
  structurally equal `progress` objects

### E) Tests — `packages/game-engine/src/ui/uiState.build.par.test.ts` — **new** (4 tests; D-6701 safe-skip)

Wrapped in exactly **one** top-level `describe()` block (suite count +1).

1. `gameOver.par` is undefined at `phase !== 'end'`.
2. `gameOver.par` is undefined at `phase === 'end'` when
   `G.activeScoringConfig` is undefined.
3. `gameOver.par` is undefined even when `phase === 'end'` AND
   `G.activeScoringConfig !== undefined` (safe-skip proof per D-6701 —
   validates that `buildParBreakdown` is unconditionally `undefined`
   regardless of gate state).
4. Determinism: two calls to `buildUIState` with the same `G` + `ctx`
   produce structurally equal `gameOver` (both with `par` absent).

Do NOT assert numeric payload fields on `par` — the payload is deferred
to a follow-up WP. The drift test (§F) locks the four field names at
the type level; runtime payload tests belong to the follow-up WP.

### F) Drift test — `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **new**

- Imports `UIProgressCounters` and `UIParBreakdown` as types
- Declares a literal fixture `satisfies UIProgressCounters` with both
  field names spelled exactly (`bystandersRescued`, `escapedVillains`)
- Declares a literal fixture `satisfies UIParBreakdown` with all four
  field names spelled exactly (`rawScore`, `parScore`, `finalScore`,
  `scoringConfigVersion`)
- Renaming any field upstream fails this file's typecheck before any
  runtime test runs — load-bearing for WP-062 aria-label stability

### G) WP-061 fixture type-conformance — **modified (type-only edits)**

Making `UIState.progress` non-optional (§A) causes WP-061's three
`satisfies UIState` fixtures under `apps/arena-client/src/fixtures/uiState/`
to fail typecheck. This WP ships the minimal conformance edits required
to keep `pnpm -r test` green:

- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — **modified** —
  add exactly one new top-level key: `"progress": { "bystandersRescued":
  4, "escapedVillains": 1 }`. Values chosen so a mid-match fixture has
  non-zero counters on both sides. No other change.
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — **modified**
  — add `"progress": { "bystandersRescued": 9, "escapedVillains": 2 }`.
  No other change.
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — **modified**
  — add `"progress": { "bystandersRescued": 1, "escapedVillains": 8 }`
  (reflects scheme-twist-dominant loss scenario with many escapes). No
  other change.

These edits are **type-conformance maintenance**, not UI changes: three
JSON key additions with no structural rewrite and no effect on
`BootstrapProbe.vue` rendering (which reads only `snapshot.game.phase`
and the empty-state fallback). WP-061's existing 13 tests continue to
pass because none of them assert against the absence of `progress`.
`UIGameOverState.par` is left absent in all three fixtures (optional;
WP-062 extends for PAR-rendering tests if it needs them).

---

## Out of Scope

- **No live PAR computation during `phase === 'play'`.** PAR arithmetic
  runs at endgame only. The WP-062 "live PAR-delta field" assumption is
  handled by WP-062's own em-dash fallback branch — no engine support is
  added for it here. If live PAR becomes required later, a separate WP
  defines the per-turn partial-input contract.
- **No changes to `ScoreBreakdown` field names.** This packet projects
  WP-048's existing shape. If a name is wrong, the fix lives in WP-048.
- **No changes to `G.counters` keys or `ENDGAME_CONDITIONS`.** This
  packet reads existing counters.
- **No new `ENDGAME_CONDITIONS.BYSTANDERS_RESCUED` counter.** Bystanders
  rescued is derived from victory piles at projection time, not tracked
  as a first-class counter. If tracking-style bystanders becomes needed
  (e.g., for replay-log event derivation under WP-048's
  `deriveScoringInputs`), a separate WP introduces it.
- **No UI changes.** `apps/arena-client/**`, `apps/registry-viewer/**`,
  and `apps/server/**` are untouched. WP-062 consumes this packet's
  output without any modification to WP-061's store or fixtures.
- **No WP-061 fixture updates.** WP-061's three JSON fixtures do not
  currently include `progress` or `par` fields. WP-062 pre-flight decides
  whether to extend them (via a WP-062 scope addition) or to add new
  HUD-specific fixtures (via a WP-062 scope addition). This WP does not
  touch `apps/arena-client/src/fixtures/`.
- **No spectator-audience filter changes.** `UIProgressCounters` and
  `UIParBreakdown` are visible to both `'player'` and `'spectator'`
  audiences. If a field should be spectator-hidden later, the change
  belongs in `filterUIStateForAudience` under a separate WP.
- **No leaderboard-submission wiring.** `LeaderboardEntry` remains
  server-side; this packet does not surface any leaderboard field into
  `UIState`.
- **Refactors, cleanups, or "while I'm here" improvements** are out of
  scope.

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified**
- `packages/game-engine/src/ui/uiState.build.ts` — **modified**
- `packages/game-engine/src/index.ts` — **modified** — export
  `UIProgressCounters`, `UIParBreakdown`
- `packages/game-engine/src/types.ts` — **modified** (conditional per
  §C above; no-op if WP-048 already added `G.activeScoringConfig`)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified**
  (conditional — only if §C requires the setup wiring)
- `packages/game-engine/src/ui/uiState.build.progress.test.ts` — **new**
- `packages/game-engine/src/ui/uiState.build.par.test.ts` — **new**
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — **new**
- `apps/arena-client/src/fixtures/uiState/mid-turn.json` — **modified**
  (type-conformance: add `progress` key)
- `apps/arena-client/src/fixtures/uiState/endgame-win.json` — **modified**
  (type-conformance: add `progress` key)
- `apps/arena-client/src/fixtures/uiState/endgame-loss.json` — **modified**
  (type-conformance: add `progress` key)
- `docs/ai/STATUS.md` — **modified** (governance update per DoD)
- `docs/ai/DECISIONS.md` — **modified** (governance update per DoD —
  projection-time aggregation vs counter-based tracking; `par?` optionality
  rationale; conditional §C adoption-vs-addition; fixture-conformance
  carve-out rationale)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance update
  per DoD)

No other files may be modified. `apps/registry-viewer/**`,
`apps/server/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`
must be untouched. The ONLY files this WP touches under `apps/` are the
three fixture JSONs listed above, edited strictly to add the new
`progress` key. No component, store, main.ts, tsconfig, or
vite.config.ts change is permitted.

---

## Acceptance Criteria

### UIState shape
- [ ] `UIState.progress` is always present, of type `UIProgressCounters`,
      even in `phase === 'lobby'` (values all `0`)
- [ ] `UIGameOverState.par` is optional; absent when no scoring config;
      present only at `phase === 'end'` with a defined
      `G.activeScoringConfig`
- [ ] The four `UIParBreakdown` fields match `ScoreBreakdown` field names
      verbatim (`rawScore`, `parScore`, `finalScore`,
      `scoringConfigVersion`) — confirmed by drift test

### Projection correctness
- [ ] `bystandersRescued` equals the count of bystander-type CardExtIds
      across all players' victory piles (fixture test)
- [ ] `bystandersRescued` excludes bystanders present in any non-victory
      zone (negative-control fixture)
- [ ] `escapedVillains` equals `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]
      ?? 0` exactly
- [ ] `gameOver.par` matches `buildScoreBreakdown(...)` output for the
      four projected fields exactly

### Determinism & purity
- [ ] `buildUIState` remains pure — no mutation of `G` or `ctx`
      (confirmed by snapshot-equality test before/after call)
- [ ] No `Math.random`, `Date.now`, or `performance.now` anywhere in
      `src/ui/` (confirmed with `Select-String`)
- [ ] No `.reduce()` in `src/ui/uiState.build.ts`

### Layer boundary
- [ ] No `boardgame.io` import in any `src/ui/**` file (confirmed with
      `Select-String`)
- [ ] No `packages/registry/**` import in any `src/ui/**` file
- [ ] No `apps/**` import anywhere in this packet

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] New test files contribute at minimum: 7 progress tests, 4 par
      tests, 2 drift tests (13 new tests total)
- [ ] All existing engine tests still pass (no regression)

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `apps/**`, `packages/registry/**`, `packages/vue-sfc-loader/**` are
      untouched

---

## Verification Steps

```pwsh
# Step 1 — build engine
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — run engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests pass; count includes at least 13 new tests added
# by this packet

# Step 3 — full repo test (regression check)
pnpm -r test
# Expected: no regressions in registry, vue-sfc-loader, server,
# arena-client (13 arena-client tests still pass — no API break)

# Step 4 — confirm no boardgame.io import in src/ui
Select-String -Path "packages\game-engine\src\ui" -Pattern "from 'boardgame\.io'" -Recurse
# Expected: no output

# Step 5 — confirm no registry import in src/ui
Select-String -Path "packages\game-engine\src\ui" -Pattern "from '@legendary-arena/registry'" -Recurse
# Expected: no output

# Step 6 — confirm no wall-clock or RNG in src/ui
Select-String -Path "packages\game-engine\src\ui" -Pattern "Math\.random|Date\.now|performance\.now" -Recurse
# Expected: no output

# Step 7 — confirm no .reduce() in uiState.build.ts
Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 8 — confirm new type exports
Select-String -Path "packages\game-engine\src\index.ts" -Pattern "UIProgressCounters|UIParBreakdown"
# Expected: at least two matches

# Step 9 — confirm client untouched
git diff --name-only apps/
# Expected: no output

# Step 10 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm -r test` exits 0 (no regressions anywhere)
- [ ] No new runtime dependency introduced
- [ ] No `Math.random`, `Date.now`, or `performance.now` under
      `src/ui/**`
- [ ] No `.reduce()` in `uiState.build.ts`
- [ ] `apps/**`, `packages/registry/**`, `packages/vue-sfc-loader/**`
      untouched
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — a typed UIState projection of PAR
      scoring and run-time progress counters now exists; WP-062 is
      unblocked at the projection layer (aria-label reconciliation
      remains on WP-062's side)
- [ ] `docs/ai/DECISIONS.md` updated — projection-time aggregation of
      bystanders (§B §countBystandersRescued) vs a first-class counter;
      `gameOver.par` optionality rationale; `G.activeScoringConfig`
      field ownership (this WP added it, or adopted from WP-048)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` updated — WP-067 checked off
      with completion date and EC reference
- [ ] Commit prefix uses the execution checklist ID assigned at
      pre-flight (follow WP-061 / EC-067 precedent for slot selection;
      EC-067 is taken, EC-068 and EC-069 are candidates — verify at
      pre-flight)
- [ ] 01.6 post-mortem is mandatory per P6-28 (new contract consumed by
      future WPs — WP-062 depends on these type names and projection
      semantics)

---

## Downstream Unblock

After this WP lands:

- **WP-062** (Arena HUD) pre-flight blockers #1–#3 are resolved. WP-062
  may need a second pass to reconcile aria-labels against the exact new
  field paths (`snapshot.progress.bystandersRescued`,
  `snapshot.progress.escapedVillains`, `snapshot.scheme.twistCount`,
  `snapshot.mastermind.tacticsRemaining`, etc.) — that pass is a WP-062
  spec refinement, not new engine work.
- WP-062 pre-flight blocker #4 (base.css allowlist) is independent of
  this WP and must be resolved on the WP-062 side.
