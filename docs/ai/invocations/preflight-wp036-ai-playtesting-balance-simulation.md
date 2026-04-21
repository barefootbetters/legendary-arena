# Pre-Flight — WP-036 AI Playtesting & Balance Simulation

**Target Work Packet:** `WP-036`
**Title:** AI Playtesting & Balance Simulation
**Previous WP Status:** WP-035 Complete (2026-04-19, `d5935b5`); most recent
executed WP is WP-060 / EC-106 (2026-04-20, `412a31c` / `cd811eb`)
**Pre-Flight Date:** 2026-04-20
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Repo-state anchor:** `main @ cd811eb` (synced with `origin/main`)

**Work Packet Class:** Infrastructure & Verification

Rationale: WP-036 introduces **external consumer tooling** that exercises
the full engine pipeline (setup → moves → endgame → scoring) from outside
the boardgame.io lifecycle. It has runtime logic but does not mutate `G`
in gameplay, does not wire into `game.ts`, does not add moves or phases,
does not add phase hooks, does not add fields to `LegendaryGameState`,
and does not change `buildInitialGameState` shape. It consumes many
engine APIs and must verify every call target is importable under engine
category rules. This class matches the WP-027 (replay) precedent.

Mandatory sections per class: Dependency Check, Dependency Contract
Verification, Input Data Traceability, Structural Readiness, Runtime
Readiness, Scope Lock, Test Expectations, Maintainability, Code Category
Boundary, Risk Review.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-036.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

Verdict is binary (READY / NOT READY). If conditional on pre-session
actions, the actions are listed explicitly and must be resolved before a
session execution prompt is generated.

---

## Authority Chain (Read in Order)

1. `.claude/CLAUDE.md` — EC-mode, bug handling, commit discipline — read.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary (line 211), MVP Gameplay
   Invariants (line 1286), engine vs framework rules — read.
3. `docs/03.1-DATA-SOURCES.md` — no new input data introduced by WP-036;
   AI simulation consumes `MatchSetupConfig` + in-memory `CardRegistry`
   (already inventoried via WP-003 / WP-035 precedent).
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — **BLOCKING: `src/simulation/`
   not listed.** See PS-1 below.
5. `docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md` —
   read. EC locked values copied verbatim from WP-036 locked section.
6. `docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md` —
   read. §Scope specifies 4 new simulation files + 2 re-export edits +
   1 new test file.
7. `docs/ai/session-context/session-context-wp036.md` — read. Bridges
   WP-060 close to WP-036 start; confirms dependency-chain leverage and
   locks inherited dirty-tree / quarantine discipline.

Higher-authority documents win where they conflict with lower. No such
conflicts were found with CLAUDE.md, ARCHITECTURE.md, or .claude/rules/
during this pre-flight; two WP-level contract corrections are listed as
PS-items below.

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-005B | **PASS** | `makeMockCtx` exported at `src/test/mockCtx.ts:28` |
| WP-020 | **PASS** | `FinalScoreSummary` exported at `src/scoring/scoring.types.ts:61` |
| WP-027 | **PASS** | `ReplayInput` at `src/replay/replay.types.ts:34`; `computeStateHash` at `src/replay/replay.hash.ts:67` |
| WP-028 | **PASS** | `UIState` exported at `src/ui/uiState.types.ts:27` |
| WP-029 | **PASS** | `filterUIStateForAudience` exported at `src/ui/uiState.filter.ts:93` |
| WP-032 | **PASS** | `ClientTurnIntent` exported at `src/network/intent.types.ts:35` |
| WP-035 | **PASS** | Release & Ops Playbook complete 2026-04-19; WORK_INDEX line 765 marks `[x] WP-035 ... ✅ Reviewed` |

All seven upstream contracts consumed by WP-036 (§Assumes lines 43–62)
are present at the specified paths at `main @ cd811eb`.

**Rule:** If any prerequisite WP is incomplete, pre-flight is NOT READY.
All prerequisites are complete.

---

## Dependency Contract Verification

Verified against actual source files, not WP text alone.

- [x] **Type/field names match exactly** — `ClientTurnIntent`, `UIState`,
  `LegalMove`, `AIPolicy`, `SimulationConfig`, `SimulationResult`,
  `FinalScoreSummary`, `ReplayInput`, `computeStateHash`,
  `filterUIStateForAudience`, `makeMockCtx` all match.
- [x] **Function signatures compatible** —
  `filterUIStateForAudience(state, audience)` returns a new `UIState`
  with `handCards` populated for `kind: 'player'` audience (verified in
  `src/ui/uiState.filter.ts`). `computeStateHash(gameState)` returns a
  deterministic string. `makeMockCtx(overrides?)` returns `SetupContext`.
- [x] **Move classification correct** — WP-036 does NOT expand
  `CORE_MOVE_NAMES` or register new moves. `AIPolicy` returns a
  `ClientTurnIntent` which goes through WP-032's intent validation
  pipeline, not through a new move registration.
- [x] **Field paths in G verified** — AI reads UIState projection only.
  No direct `G` access.
- [x] **Helper return patterns understood** — `filterUIStateForAudience`
  returns a new UIState (spread-copy pattern per WP-029 D-2903). AI
  must not expect mutation.
- [x] **Optional fields identified** — `UIState.players[x].handCards`
  is populated only for active-player audience (WP-029). Random policy's
  decision logic must not require `handCards` for inactive players.
- [x] **Handler ownership explicit** — `AIPolicy` is a function
  interface stored **externally** to `G` (WP-036 non-negotiable:
  "AIPolicy is a function interface, not stored in G"). No function
  storage in game state.
- [x] **Persistence classification clear** — Simulation results are
  returned, not stored. No new `G` fields. No new setup artifacts. No
  persistence concerns.
- [x] **Functions the WP calls are actually exported** — `makeMockCtx`,
  `filterUIStateForAudience`, `computeStateHash`, `buildInitialGameState`
  are all exported. See Runtime Readiness for the `advanceStage` local-
  function concern (WP-027 D-2705 precedent applies).
- [x] **Filter/consumer input type contains all needed data** — AI
  receives the `player`-audience filtered UIState. Per WP-029 D-2903,
  this exposes `handCards` for the active player. Random policy can
  enumerate plays from `handCards`. Economy fields are populated (not
  redacted) for the active-player audience.
- [ ] **WP approach does not require forbidden imports** — **PARTIAL**.
  WP-036 §D signatures `runSimulation` with `registry: CardRegistry`,
  which would require `import type { CardRegistry } from
  '@legendary-arena/registry'` — **forbidden** in engine files by
  `.claude/rules/game-engine.md` §Registry Boundary and by
  ARCHITECTURE.md Layer Boundary. Must be corrected to the local
  structural interface `CardRegistryReader` (already in use by
  `buildInitialGameState`, verified at
  `src/matchSetup.validate.ts:28`). See **PS-2** below.

### Concrete output trace (scan-G invariants)

WP-036 does not introduce scan-and-throw invariants. `getLegalMoves`
reads G/ctx to enumerate legal moves but returns structured data; it
does not throw on predicate violations. `runSimulation` collects
statistics but does not assert per-game invariants. No scan-G trace is
required beyond the Runtime Readiness checks below.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by WP-036 (`MatchSetupConfig`,
  `CardRegistry` resolved data via `buildInitialGameState`) are already
  listed in `docs/03.1-DATA-SOURCES.md` from prior WPs.
- [x] Storage location for each input is known: `MatchSetupConfig` is
  passed in-memory by caller; registry data comes from
  `@legendary-arena/registry` (R2 + local JSON, already inventoried).
- [x] Debug path is known: simulation bugs inspect
  `packages/game-engine/src/simulation/` + the AI policy + the simulation
  runner's seeded PRNG state.
- [x] No implicit data introduced — all values (seed, games count,
  policies) are supplied by the caller via `SimulationConfig`.
- [x] No new setup-time derived fields — simulation does not mutate G
  beyond what `buildInitialGameState` + move dispatch already produce.

All YES. No data-traceability concerns.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — engine package
  **436 tests / 109 suites / 0 failures** verified at HEAD `cd811eb`.
  Repo-wide 588 passing / 0 failing (per session-context bridge,
  unverified in this pre-flight but reinforced by bridge author's
  2026-04-20 audit).
- [x] No known EC violations remain open — WP-060 closed governance on
  2026-04-20 (`cd811eb`). No in-flight WP.
- [x] Required types/contracts exist — all 7 upstream contracts
  verified under Dependency Check.
- [x] No naming conflicts — `AIPolicy`, `LegalMove`, `SimulationConfig`,
  `SimulationResult`, `createRandomPolicy`, `getLegalMoves`,
  `runSimulation` are not already defined in the engine (grep confirmed
  no matches in `packages/game-engine/src/` except for `LegalMove` in
  no existing file). Exact disambiguation from `intent.validate.ts`
  terminology ("valid intent") vs WP-036 "legal move" is semantic, not
  a collision.
- [ ] No architectural boundary conflicts anticipated — **PARTIAL**.
  The `src/simulation/` directory is not yet classified in
  `02-CODE-CATEGORIES.md` (see **PS-1**). Classifying it as `engine`
  (following D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 /
  D-3401 / D-3501 precedent) resolves the boundary question before
  execution.
- [x] No DB or migrations touched.
- [x] No R2 data dependency.
- [x] Reading data from G fields — simulation reads filtered UIState,
  not G directly. No G-field subfield assumption.

Both NO / PARTIAL answers are handled by PS-items below.

---

## Runtime Readiness Check (Mutation & Framework)

Simulation code is NOT boardgame.io-managed, so "runtime" here means the
simulation runner's own execution loop.

- [x] Runtime touchpoints known — simulation runs entirely outside
  boardgame.io; it constructs `G` via `buildInitialGameState`, dispatches
  moves via a local `SimulationMoveContext` (WP-027 D-2705 precedent),
  collects final state via `evaluateEndgame` + `FinalScoreSummary`.
- [x] Framework context requirements understood — simulation must NOT
  import `boardgame.io`. Move dispatch uses a local structural
  interface with no-op `ctx.events` and a seeded-deterministic
  `ctx.random.Shuffle`.
- [x] Existing test infra supports required mocks without modifying
  locked helpers — `makeMockCtx` used only for `SetupContext` at state
  construction; move dispatch uses a local `SimulationMoveContext`
  interface (NOT `makeMockCtx`). No modifications to shared helpers.
- [x] 01.5 runtime-wiring allowance **NOT INVOKED** — WP-036 is purely
  additive per WP-030 precedent. No new `LegendaryGameState` field, no
  `buildInitialGameState` shape change, no new `LegendaryGame.moves`
  entry, no new phase hook. The session prompt must cite 01.5
  §Escalation and explicitly declare NOT INVOKED.
- [x] No architectural boundary violations — engine boundary upheld
  once PS-1 (directory classification) and PS-2 (CardRegistry →
  CardRegistryReader) are resolved.
- [x] Integration point code read — `Game.setup()` cannot be called
  from simulation (would require `boardgame.io` import). Use
  `buildInitialGameState` directly with a `SetupContext` from
  `makeMockCtx` (WP-027 D-2702 precedent).
- [x] No new move or hook — simulation dispatches existing moves only.
- [x] Multi-step mutations — simulation loop per game: build initial
  G → loop (build UIState → filter → getLegalMoves → AIPolicy.decideTurn
  → validate intent → dispatch move → check endgame) → aggregate.
  Ordering is documented; mutations stay inside per-game scoped `G`
  drafts.
- [x] Registry data via setup-time resolution — `buildInitialGameState`
  receives `CardRegistryReader`, produces resolved `G`. Simulation does
  not query registry at move time.
- [x] No phase transitions triggered by simulation — simulation
  dispatches moves; moves themselves may internally trigger phase
  transitions via their existing `// why:` comments. No new `setPhase`
  calls added.
- [x] No simultaneous/conflicting condition handling added.
- [x] Degradation path explicit — unknown move names emit a warning in
  `G.messages` and skip (WP-027 D-2705 precedent). Zero legal moves
  for the active player: policy must return a no-op intent or a
  terminating `endTurn` intent; simulation runner must bound turns to
  avoid infinite loops.
- [x] Mock context shapes identified — two local structural interfaces
  required: (a) `SimulationMoveContext` for move dispatch (subset of
  `FnContext<LegendaryGameState> & { playerID }`, events no-op, random
  seeded-deterministic Shuffle), (b) AI decision context is the
  filtered `UIState` itself (no framework context needed).
- [x] Mock/PRNG capability gap identified — `makeMockCtx` provides a
  reverse-shuffle, NOT a seeded PRNG (WP-027 D-2704 precedent). WP-036
  requires "deterministic via seeded RNG" for both (a) AI policy
  decisions and (b) simulation move dispatch's `ctx.random.Shuffle`.
  The simulation must implement its own seeded PRNG (e.g., mulberry32
  or xorshift32) — a small pure helper local to `src/simulation/`.
  This is not a modification to `makeMockCtx` and is not shared test
  infrastructure. See **RS-5** below.

All YES / handled by PS- and RS-items. No NO answers that block.

---

## Established Patterns to Follow (Locked Precedents for WP-036)

The following locked precedents from 01.4 apply directly to WP-036:

- **WP-027 D-2702 (Framework bypass for infrastructure WPs):** Use
  `buildInitialGameState` directly, never `Game.setup()`, to avoid
  boardgame.io import.
- **WP-027 D-2705 (Static MOVE_MAP for move dispatch):** Build a static
  `Record<string, MoveFn>` from imported move functions. Use a local
  `SimulationMoveContext` interface. Unknown move names warn + skip.
- **WP-027 D-2704 (makeMockCtx shuffle vs seeded PRNG capability gap):**
  `makeMockCtx` is not a seeded PRNG. Simulation needs its own local
  seeded PRNG for AI decisions and for the ctx.random.Shuffle provided
  to dispatched moves.
- **WP-028 D-2801 (Local structural interface for framework ctx
  subset):** Define `SimulationMoveContext` with only the fields move
  functions destructure — `{ G, playerID, ctx, events, random }`.
- **WP-025/026 D-2504 (`registry: unknown` with local structural
  interface):** Replace WP-036 §D `registry: CardRegistry` with
  `registry: CardRegistryReader` (already exported from
  `src/matchSetup.validate.ts`). See PS-2.
- **WP-028 (Projection aliasing prevention):** AI policy's
  `playerView: UIState` parameter is a projection — the filter returns
  spread-copies per WP-029. Post-mortem must verify no `G` alias leaks
  via AI policy's returned `ClientTurnIntent`.
- **WP-028 (Projection purity as strict contract):** `decideTurn` must
  not cache, memoize, close over `G`, or retain state between calls.
  Docstring must include "Forbidden behaviors" block.
- **WP-028 (Contract enforcement tests):** 8 tests in §G are contract
  enforcement — if they fail, the implementation is incorrect. Do not
  weaken assertions.
- **WP-028 (Lifecycle isolation for non-framework code):** Session
  prompt must explicitly prohibit wiring simulation files into
  `game.ts`, moves, or phase hooks.
- **WP-030 (01.5 NOT INVOKED declaration for purely additive WPs):**
  WP-036 is purely additive. Session prompt must enumerate the four
  01.5 criteria and mark each absent.
- **WP-030 D-3001 / WP-031 D-3101 / WP-028 D-2801 (Code-category
  classification for new engine subdirectory):** Create D-36NN before
  the session prompt. See PS-1.
- **WP-031 (Test file `describe()` wrapping when suite count is
  locked):** 8 new tests in one `describe('simulation framework
  (WP-036)')` block → +1 suite. Baseline 436/109 → 444/110.
- **WP-031 D-3102 (Setup-only wiring scope by default):** WP-036 adds
  zero runtime wiring. The simulation runner is external and callable
  only from test files + future CLI tooling. No per-move, per-
  transition, or per-turn hooks introduced.
- **WP-032 (Caller-injected dependency arrays for transport-agnostic
  validation):** If `getLegalMoves` needs to know the full set of
  registered move names (beyond `CORE_MOVE_NAMES`'s 3 entries), inject
  them via a parameter or define them locally in
  `simulation/ai.legalMoves.ts` (since the caller is always
  simulation itself, a local constant is acceptable).
- **P6-22 (Escaped-dot grep patterns):** Verification grep for
  `boardgame.io` in simulation files must use `boardgame\.io`. Grep
  for `\.reduce\(` and `Math\.random\(`. Escape all dots.
- **P6-27 (Stage-by-name only):** Commit A stages by exact filename —
  never `git add .` / `git add -A` / `git add -u`. Inherited dirty-tree
  items (from session-context §Inherited Dirty-Tree Map) must remain
  untouched.
- **P6-36 (`EC-036:` commit prefix):** EC-036 slot verified unconsumed
  (`git log --all --grep='EC-036:'` returns no commits). Commit prefix
  is `EC-036:`. `WP-036:` prefix is forbidden.
- **P6-43 / P6-50 (Paraphrase discipline):** `// why:` comments in
  simulation files must avoid engine-gameplay-specific tokens. WP-036
  is engine-classified tooling (D-36NN pending), so the engine
  vocabulary applies but with a tooling-consumer framing. Lock the
  embargo list: avoid narrating gameplay decisions; frame comments
  around "AI is an external consumer that exercises the same pipeline."
- **P6-44 (pnpm-lock.yaml unchanged):** No `package.json` edits
  expected; verify at Verification Step time.

---

## Maintainability & Upgrade Readiness (Senior Review)

- [x] **Extension seam exists:** `AIPolicy` interface is the seam —
  future policies (heuristic, MCTS, neural) implement it without
  refactoring `runSimulation` or `getLegalMoves`. `SimulationConfig`
  accepts an array of policies for multi-player matches.
- [x] **Patch locality:** A bug in random selection lives in
  `ai.random.ts`. A bug in legal-move enumeration lives in
  `ai.legalMoves.ts`. A bug in statistics aggregation lives in
  `simulation.runner.ts`. No cross-cutting changes for a single policy
  or enumeration bug.
- [x] **Fail-safe behavior:** Zero legal moves → policy must return a
  safe no-op or `endTurn` intent; simulation runner must bound turns
  to a max count (WP-036 does not specify; pre-flight locks at
  **maxTurnsPerGame = 200** to prevent infinite loops — this is a
  safety guard, not a gameplay rule).
- [x] **Deterministic reconstructability:** Same seed + same
  `MatchSetupConfig` + same policies = identical game trajectory +
  identical statistics. WP-036 test #3 proves this.
- [x] **Backward-compatible test surface:** No changes to `makeMockCtx`,
  no changes to existing test helpers, no changes to any engine
  gameplay file. All 436 existing tests must remain green.
- [x] **Semantic naming stability:** `AIPolicy`, `LegalMove`,
  `SimulationConfig`, `SimulationResult`, `createRandomPolicy`,
  `runSimulation`, `getLegalMoves` are all semantically stable. No
  `V1` / `Simple` / `Temp` / `Immediate` encoded. `createRandomPolicy`
  is appropriately named (not `createMVPPolicy`).

All YES. Design is maintainable without new abstractions beyond what
the WP authorizes.

---

## Code Category Boundary Check

- [ ] **All new/modified files fall into exactly one category** —
  **PARTIAL**. 4 new files under `packages/game-engine/src/simulation/`
  would belong to category `engine` once PS-1 classifies the directory.
  2 modified files (`src/types.ts`, `src/index.ts`) are already engine
  category. 1 new test file under `src/simulation/` belongs to
  category `test` (directory match: `**/*.test.ts`).
- [x] **Each file's category permits all imports and mutations it
  uses** — engine category forbids `boardgame.io`, registry, IO,
  `Math.random()`, throwing, `.reduce()`, storing functions in G.
  WP-036 simulation files comply: local seeded PRNG instead of
  `Math.random()`, `for...of` instead of `.reduce()`, local structural
  interfaces instead of `boardgame.io` / registry imports,
  `AIPolicy` stored external to G, return void from move dispatch.
- [ ] **No file blurs category boundaries** — depends on PS-1 and
  PS-2 resolution.
- [ ] **New directory classified** — **BLOCKING: PS-1.**
  `packages/game-engine/src/simulation/` is not in
  `02-CODE-CATEGORIES.md`. Must be classified as `engine` under a new
  DECISIONS.md entry (proposed **D-3601 — Simulation Code Category**)
  following the exact template of D-2706 (replay), D-2801 (ui),
  D-3001 (campaign), D-3101 (invariants), D-3201 (network),
  D-3301 (content), D-3401 (versioning), D-3501 (ops). This is the
  **ninth instance** of the same pattern.

PS-1 is a boundary violation only until resolved. Resolution is
non-scope-impacting: write a ~20-line DECISIONS.md entry + add the
directory to 02-CODE-CATEGORIES.md §engine directories list.

---

## Scope Lock (Critical)

### WP-036 Is Allowed To

- **Create:** `packages/game-engine/src/simulation/ai.types.ts` —
  `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult`;
  no imports of `boardgame.io` or `@legendary-arena/registry`; imports
  `UIState`, `ClientTurnIntent`, `MatchSetupConfig` from existing
  engine files.
- **Create:** `packages/game-engine/src/simulation/ai.random.ts` —
  `createRandomPolicy(seed: string): AIPolicy`; local seeded PRNG
  (pure helper, e.g., mulberry32); no `Math.random()`; `for...of`
  only.
- **Create:** `packages/game-engine/src/simulation/ai.legalMoves.ts` —
  `getLegalMoves(G, ctx): LegalMove[]`; enumerates plays from
  `playerZones.hand`, recruit targets from HQ, fight targets from
  City, mastermind fights, endTurn, advanceStage; uses `G.currentStage`
  + `G.counters` + existing stage-gating helpers; pure function, no
  framework imports. May define a local constant listing the 8 play-
  phase move names (per WP-032 D-3202 pattern).
- **Create:** `packages/game-engine/src/simulation/simulation.runner.ts`
  — `runSimulation(config, registryReader): SimulationResult`; calls
  `buildInitialGameState` (NOT `Game.setup()`) per D-2702; dispatches
  moves via a static MOVE_MAP + local `SimulationMoveContext` per
  D-2705 + D-2801; uses `for...of` for game and turn loops; caps turns
  at 200 per game to prevent infinite loops (safety guard); aggregates
  statistics via for-of, never `.reduce()`.
- **Create:** `packages/game-engine/src/simulation/simulation.test.ts`
  — 8 tests in one `describe('simulation framework (WP-036)')` block
  exactly as listed in WP-036 §G. Uses `node:test`, `node:assert`,
  `makeMockCtx` (for SetupContext at game construction); no
  `boardgame.io` import.
- **Modify:** `packages/game-engine/src/types.ts` — re-export
  simulation types only. No other changes.
- **Modify:** `packages/game-engine/src/index.ts` — export
  `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult`,
  `createRandomPolicy`, `getLegalMoves`, `runSimulation`. No other
  changes.
- **Update required governance docs:** `docs/ai/STATUS.md`,
  `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` (PS-1 resolution added
  during pre-session), WP-036 §D signature correction (PS-2 resolution
  added during pre-session).

### WP-036 Is Explicitly Not Allowed To

- No modification of ANY engine gameplay file (game.ts, moves/*,
  rules/*, hero/*, villainDeck/*, economy/*, setup/*, endgame/*,
  turn/*, state/*, board/*, scoring/*, mastermind/*, replay/*, ui/*,
  campaign/*, invariants/*, network/*, content/*, versioning/*,
  ops/*). Confirmed via `git diff --name-only` during Verification.
- No new moves, no new phases, no new `CORE_MOVE_NAMES` entries, no
  `G` shape changes, no new phase hooks, no new endgame conditions,
  no new keywords or rules.
- No `Math.random()` — must use seeded PRNG (local to simulation).
- No `.reduce()` — use `for...of` loops.
- No `boardgame.io` imports in any simulation file.
- No `@legendary-arena/registry` imports in any simulation file.
- No calls to `Game.setup()` — use `buildInitialGameState` directly
  per D-2702.
- No throwing — return void / warn via `G.messages` per engine rules.
- No modifications to `makeMockCtx` or any shared test helper.
- No storage of `AIPolicy` (or any function) in `G`.
- No I/O, no filesystem, no network, no PostgreSQL.
- No persistence of simulation results.
- No UI code, no server code.
- No refactors, no "while I'm here" improvements.
- No touching the 11 inherited dirty-tree items listed in session-
  context §Inherited Dirty-Tree Map.
- No popping `stash@{0}` / `stash@{1}` / `stash@{2}`.

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** **8** in
  `packages/game-engine/src/simulation/simulation.test.ts`. One
  `describe('simulation framework (WP-036)')` block wrapping 8
  `test()` calls → +1 suite. Baseline **436 / 109 / 0** →
  **444 / 110 / 0** post-execution. WP-031 test-describe-wrapping
  precedent applies — the wrapping intent is locked in this pre-flight
  to prevent a 444/109 mismatch.
- **Existing test changes:** **Zero.** All 436 existing engine tests
  must remain green without edits. Zero WP-036 changes to any
  existing test file.
- **Prior test baseline:** engine 436/109/0 verified at HEAD
  `cd811eb`. Repo-wide 588/0 per session-context bridge (unverified
  in this pre-flight; WP-036 executor should spot-check at session
  start).
- **Test boundaries:**
  - No `boardgame.io` imports in test files (engine + category rule).
  - No `boardgame.io/testing` imports.
  - No modifications to `makeMockCtx` or shared helpers.
  - Test file uses `.test.ts` extension (never `.test.mjs`).
  - Tests use `node:test` + `node:assert` only.
  - No new logic in `src/test/mockCtx.ts`.
- **Defensive guards:** Simulation code reads filtered UIState, not
  G directly. No defensive guards needed for older test mocks (no
  existing mocks test simulation).
- **Contract enforcement framing:** Per WP-028 precedent, the 8 tests
  are contract enforcement. If they fail, the implementation is
  incorrect. Do NOT weaken assertions.

### Test Definitions (locked)

Per WP-036 §G:

1. `createRandomPolicy` returns an `AIPolicy` with `decideTurn`
   function — shape assertion.
2. Random policy produces valid `ClientTurnIntent` for legal moves —
   integrates with WP-032 intent validation.
3. Same seed produces identical decisions (deterministic) — proves
   seeded PRNG determinism.
4. Different seed produces different decisions — proves seed
   dependency (not a constant).
5. `getLegalMoves` returns non-empty list during active game — proves
   enumeration works for a real play-phase G.
6. `runSimulation` with 2 games produces aggregate `SimulationResult`
   — proves end-to-end pipeline.
7. AI does not see hidden state (filtered UIState has no hand cards
   for opponents) — proves D-0701.
8. Simulation results are JSON-serializable — proves `SimulationResult`
   contains no functions / Sets / Maps.

Any deviation from this count / structure is a WP-036 scope violation.

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

Risks are locked by this pre-flight. Execution must not revisit.

### RS-1: Seeded PRNG implementation choice (LOW)

**Risk:** WP-036 says "seeded RNG" but does not specify algorithm.
Different choices (mulberry32, xoroshiro128, sfc32, splitmix32) produce
different deterministic sequences, all valid. Without a lock, the
executor may pick a non-standard algorithm or accidentally reinvent a
biased one.

**Mitigation:** Lock **mulberry32** (32-bit, ~128-line pure function,
widely reviewed for game-sim determinism). Place in
`src/simulation/ai.random.ts` as an internal helper alongside
`createRandomPolicy`. Do NOT export it from the package — it is a
simulation-internal utility. Include `// why: mulberry32 chosen for
determinism + brevity; not a cryptographic PRNG; simulation-internal
only` comment.

**Decision:** Locked — mulberry32 implementation, internal to
`ai.random.ts`, not exported from the engine package.

### RS-2: `SimulationConfig` registry parameter shape (MEDIUM)

**Risk:** WP-036 §A defines `SimulationConfig` as
`{ games, seed, setupConfig, policies }` — no `registry` field. But
WP-036 §D signatures `runSimulation(config, registry)` as a **separate
parameter**. Mismatch between §A and §D could confuse the executor
into adding `registry` to `SimulationConfig` OR could leave the
registry parameter implicit.

**Mitigation:** Keep the WP's §D signature — registry is a separate
parameter, NOT a field of `SimulationConfig`. Rationale: registry is
immutable infrastructure, matches the `buildInitialGameState` /
`Game.setup()` pattern (registry as function argument, not config
field). `SimulationConfig` holds per-simulation parameters only.

**Decision:** Locked — `SimulationConfig` shape unchanged (4 fields
per §A); `runSimulation(config, registry: CardRegistryReader)` signature
per PS-2 correction.

### RS-3: `advanceStage` is a local function in game.ts (MEDIUM)

**Risk:** `advanceStage` appears in `game.ts`'s `moves` map (line 180)
but is a local function, not exported for external dispatch. WP-027
D-2705 resolved this for replay by calling `advanceTurnStage` from
`turnLoop.ts` directly. Simulation faces the same issue.

**Mitigation:** Follow WP-027 D-2705 precedent. Simulation's static
MOVE_MAP reconstructs `advanceStage` by calling `advanceTurnStage`
from `src/turn/turnLoop.ts` (exported, pure). Document in a `// why:`
comment citing D-2705.

**Decision:** Locked — reuse D-2705 pattern; import
`advanceTurnStage` directly; do NOT attempt to import or re-export
the local `advanceStage` from game.ts.

### RS-4: `SimulationMoveContext` shape (MEDIUM)

**Risk:** Move functions destructure `FnContext<LegendaryGameState>
& { playerID }`. Simulation must supply a minimally compatible
structural interface without importing `boardgame.io`. Missing fields
or wrong shapes cause silent dispatch failures.

**Mitigation:** Lock `SimulationMoveContext` per WP-027 D-2705 +
WP-028 D-2801 precedent:

```ts
interface SimulationMoveContext {
  G: LegendaryGameState;
  playerID: string;
  ctx: { phase: string; turn: number; currentPlayer: string; numPlayers: number };
  events: { setPhase: (name: string) => void; endTurn: () => void };
  random: { Shuffle: <T>(array: T[]) => T[] };
}
```

Events are no-ops (simulation does not trigger phase/turn changes
from outside moves). Random.Shuffle uses the simulation's seeded
PRNG. Additional fields may be added only if a specific move
destructures them and fails without them.

**Decision:** Locked — local interface in `simulation.runner.ts`, 5
fields minimum, per D-2801 rule of not widening beyond actual usage.

### RS-5: Seeded shuffle determinism under mulberry32 (LOW)

**Risk:** Simulation's `ctx.random.Shuffle` must be deterministic for
a given seed + G state. A naive Fisher-Yates using mulberry32 is
correct. But if the shuffle is reset per-move (new PRNG seeded with
`config.seed` for every move), outputs differ from if it's persistent
across moves.

**Mitigation:** Lock **one PRNG instance per simulation run** (not
per move, not per game). Seed once with `config.seed`, reuse the
stateful PRNG across all moves in all games within the run. Document
in a `// why:` comment: "Single PRNG instance per simulation run —
re-seeding per move would break the determinism guarantee that same
seed = same trajectory across arbitrary move counts."

**Decision:** Locked — one mulberry32 instance per `runSimulation`
call; stateful; shared by AI policy + ctx.random.Shuffle.

### RS-6: Zero legal moves (LOW)

**Risk:** Late-game states may have zero legal moves for the active
player (hand empty, no affordable HQ cards, city empty). Random
policy must handle this without infinite loop.

**Mitigation:** If `getLegalMoves` returns `[]`, the random policy
returns an `endTurn` intent (assuming `endTurn` is always legal in
cleanup stage; or an `advanceStage` intent to progress toward
cleanup). If neither is legal (phase is not `play`), the simulation
terminates the game with `FinalScoreSummary` reflecting the stuck
state.

**Decision:** Locked — policy falls back to `endTurn` / `advanceStage`;
if neither legal, runner terminates the game with "stuck" status in
`SimulationResult.messages` (not a new field; logged via the
aggregator's internal state). Test #5 asserts non-empty return during
an active-game state; no test asserts the empty-return branch (MVP
safe-skip per WP-026 precedent).

### RS-7: Turn cap for infinite-loop safety (LOW)

**Risk:** A random policy in a degenerate state may loop indefinitely
(draw → discard → draw → …). WP-036 does not specify a turn cap.

**Mitigation:** Lock **maxTurnsPerGame = 200**. If exceeded, the
simulation terminates the game and counts it as incomplete. 200 is
well above any realistic Legendary game length (~20–40 turns); cap
exists purely as a safety guard, not a gameplay rule.

**Decision:** Locked — 200 turns. `SimulationResult.averageTurns` is
capped by this limit. Post-mortem must verify no assumption that
`averageTurns < 200` in tests (or else the cap creates silent bias).

### RS-8: Filtered UIState contains hand cards for active player (LOW)

**Risk:** Test #7 asserts "AI does not see hidden state (filtered
UIState has no hand cards for opponents)". Per WP-029 D-2903, the
filter DOES populate `handCards` for the active-player audience. So
the correct assertion is: for audience `{ kind: 'player', playerID:
'0' }`, `filteredState.players['0'].handCards` is populated, but
`filteredState.players['1'].handCards` is absent / empty. Test wording
in WP-036 §G#7 is accurate; implementation must mirror WP-029's
output shape exactly.

**Mitigation:** Read `src/ui/uiState.filter.ts` + WP-029 tests at
execution start to confirm the exact `handCards` shape for other-
player entries (empty array vs undefined vs absent key). Lock that
shape into the test assertion.

**Decision:** Locked — test #7 asserts active player sees own hand,
other players' hand state matches WP-029's locked output (to be
verified at execution start from `src/ui/uiState.filter.test.ts`).

### RS-9: CardRegistry → CardRegistryReader signature correction (HIGH)

**Risk (BLOCKING):** WP-036 §D `runSimulation(config, registry:
CardRegistry)` would require `import type { CardRegistry } from
'@legendary-arena/registry'` — **forbidden** per engine-category
rules + `.claude/rules/game-engine.md` §Registry Boundary.

**Mitigation:** Use `CardRegistryReader` (local structural interface
from `src/matchSetup.validate.ts:28`) per WP-025 / WP-026 D-2504
precedent. This is a scope-neutral WP correction — changes the type
annotation only; no behavioral change. Do the correction as a
pre-session update (PS-2 below). WP-036 §Scope §D text must be
updated + an EC-036 amendment note added.

**Decision:** Locked — PS-2. `runSimulation` signature must be
`runSimulation(config: SimulationConfig, registry: CardRegistryReader):
SimulationResult`.

### RS-10: Directory classification missing (HIGH)

**Risk (BLOCKING):** `packages/game-engine/src/simulation/` is not
in `02-CODE-CATEGORIES.md`. Per the eighth-instance precedent
(D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 /
D-3501), this must be classified before session generation.

**Mitigation:** Create **D-3601 — Simulation Code Category** as a
pre-session action. Classify as `engine` category. Cite purity, no
I/O, no `boardgame.io` / registry imports, simulation-tooling
purpose, D-0701 alignment. Add to
`02-CODE-CATEGORIES.md §engine` directories list. See PS-1.

**Decision:** Locked — PS-1. D-3601 created; 02-CODE-CATEGORIES.md
updated; line added to engine-category directories listing.

### RS-11: 01.6 post-mortem trigger (expected MANDATORY)

**Risk:** Per session-context §Discipline Precedents, WP-036 likely
triggers 01.6 mandatory because:
- `AIPolicy` is a new long-lived abstraction (extension seam).
- `src/simulation/` is a new code-category directory (D-3601).
- `runSimulation` is a new external-consumer pipeline analog to
  replay.

**Mitigation:** Lock 01.6 as **MANDATORY**. Post-mortem must cover:
- Aliasing check on `playerView: UIState` passed to `decideTurn`
  (per WP-028 precedent).
- Extension-seam check on `AIPolicy` / `LegalMove` for future
  policies.
- Capability-gap documentation on seeded PRNG vs `makeMockCtx`
  (per WP-027 D-2704).
- Forbidden-behaviors docstring block on `decideTurn` (per WP-028
  projection-purity precedent).
- `// why:` comment completeness on the four required comments listed
  in EC-036 §Required `// why:` Comments.

**Decision:** Locked — 01.6 MANDATORY. Post-mortem template is
`docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md`
(most recent MANDATORY precedent per session-context §Quick-Reference
Index).

### RS-13: Legal-move enumeration order lock (LOW, added by 01.7 Issue 23)

**Risk:** `getLegalMoves` is deterministic by construction (pure
function over G/ctx), but its enumeration order is not explicitly
locked. Random policy selects via `prng() * legalMoves.length` — a
future refactor that silently reorders categories (e.g.,
`recruitHero` before `playCard`) would flip every test-#3 / test-#4
decision output without tripping any existing assertion.

**Mitigation:** Lock canonical enumeration order in `ai.legalMoves.ts`:

1. `playCard` intents — hand zone index ascending (0..N-1 over
   `G.playerZones[activePlayer].hand`)
2. `recruitHero` intents — HQ slot 0..4 ascending
3. `fightVillain` intents — City slot 0..4 ascending
4. `fightMastermind` intents — active mastermind only
5. `revealVillainCard` — if `G.currentStage === 'start'`
6. `drawCards` — if legal in current stage
7. `advanceStage` — if `G.currentStage !== 'cleanup'`
8. `endTurn` — if `G.currentStage === 'cleanup'`

Executor must add a `// why: ordering locked by pre-flight RS-13 for
deterministic seeded selection; reordering silently flips every
seeded decision` comment on the return statement of
`getLegalMoves`.

**Decision:** Locked — RS-13. Category order is fixed; within-
category order follows zone-index ascending; comment required.

### RS-14: Optional `handCards` assertion pattern in test #7 (LOW, added by 01.7 Issue 5)

**Risk:** Test #7 asserts "filtered UIState has no hand cards for
opponents." Per WP-029 D-2903 + 01.4 `exactOptionalPropertyTypes`
precedent, the exact shape of `UIPlayerState.handCards` for
non-active audiences (empty array vs `undefined` vs key absent) is
locked by WP-029's conditional-assignment pattern. Writing
`assert.strictEqual(handCards, undefined)` vs
`assert.deepStrictEqual(handCards, [])` — only one will match
WP-029's actual output.

**Mitigation:** Executor must read `src/ui/uiState.filter.ts` AND
`src/ui/uiState.filter.test.ts` at session start before authoring
test #7; copy WP-029's existing assertion pattern verbatim. Do NOT
invent a new convention — if WP-029 uses `typeof handCards ===
'undefined'`, test #7 uses the same. If WP-029 uses
`assert.deepStrictEqual(handCards, [])`, test #7 uses the same.

**Decision:** Locked — RS-14. Test #7 assertion pattern = WP-029
test pattern verbatim, copied after reading `uiState.filter.test.ts`
at session start.

### RS-15: Simulation move-name set lock (LOW, added by 01.7 Issue 10)

**Risk:** `LegalMove.name: string` and `ClientTurnIntent.moveName:
string` are wide-typed. The engine registers 8 play-phase moves +
2 lobby moves (`setPlayerReady`, `startMatchIfReady`). `CORE_MOVE_NAMES`
enumerates only 3 (per WP-032 D-3202). Without an explicit move-name
lock, the executor could accidentally enumerate lobby moves or miss
a play-phase move.

**Mitigation:** Lock the 8-name simulation set as a local constant
in `ai.legalMoves.ts`:

```ts
// why: simulation covers the play-phase only; lobby moves
// (setPlayerReady, startMatchIfReady) are excluded because
// buildInitialGameState starts the simulation post-lobby. Local
// constant per WP-032 D-3202 precedent — NOT a drift-pinned
// canonical array; adding a new play-phase move in a future WP
// requires updating this constant explicitly.
const SIMULATION_MOVE_NAMES = [
  'drawCards', 'playCard', 'endTurn', 'advanceStage',
  'revealVillainCard', 'fightVillain', 'recruitHero',
  'fightMastermind',
] as const;
```

**Decision:** Locked — RS-15. 8-name set in `ai.legalMoves.ts` as
a local `as const` tuple; `// why:` comment required citing WP-032
D-3202 precedent; lobby moves explicitly excluded.

### RS-12: `FinalScoreSummary` field coverage (LOW)

**Risk:** `SimulationResult` includes `escapedVillainsAverage` and
`woundsAverage`. `FinalScoreSummary` must expose both for the runner
to aggregate. If either is missing, the runner would have to read G
directly post-endgame (boundary violation).

**Mitigation:** Verified at `src/scoring/scoring.types.ts:61`. Read
actual interface at execution start to confirm both fields exist.
Most likely already present since WP-020 defined the summary to cover
endgame metrics. If absent, the field must be added to
`FinalScoreSummary` (WP-020 contract change) — which would require a
WP-036 scope expansion and re-pre-flight. Pre-flight-time assumption
is that both fields exist; executor must verify at session start.

**Decision:** Locked — executor verifies at session start. If
`FinalScoreSummary` lacks `escapedVillains` or `wounds`, halt and
escalate; do NOT add fields to FinalScoreSummary without WP-020
scope expansion (not permitted under WP-036).

---

## Pre-Session Actions (Resolve Before Session Prompt Is Generated)

The following blocking items must be resolved BEFORE a session
execution prompt is authored. These are scope-neutral corrections
that do not alter WP-036's file allowlist, test count, or wiring
decision. Log resolutions in §Authorized Next Step.

### PS-1 — Code Category Classification for `src/simulation/`

**Issue:** `packages/game-engine/src/simulation/` is not listed in
`docs/ai/REFERENCE/02-CODE-CATEGORIES.md`.

**Resolution:**

1. Create DECISIONS.md entry **D-3601 — Simulation Code Category**:

    ```
    ### D‑3601 — Simulation Code Category
    **Decision:** `packages/game-engine/src/simulation/` belongs to the
    `engine` code category. All engine category rules apply: no
    `boardgame.io` imports, no registry package imports, no IO, no
    `Math.random()`, no `.reduce()`, no throwing, no storing
    functions in G.
    **Rationale:** Simulation is external consumer tooling that
    exercises the engine's full pipeline from outside boardgame.io
    (D-0701: AI is tooling, not gameplay). It mirrors the replay
    pattern (D-2706) — it calls engine APIs but does not add
    gameplay logic. Engine category constraints apply verbatim;
    no new category is needed.
    **Introduced:** WP‑036
    **Status:** Immutable
    ```

2. Add to `02-CODE-CATEGORIES.md` §engine directories list:
   `packages/game-engine/src/simulation/` (D-3601)

**Blast radius:** Doc-only. No code change.

### PS-2 — WP-036 §D Signature Correction: `CardRegistry` →
`CardRegistryReader`

**Issue:** WP-036 §D specifies `runSimulation(config, registry:
CardRegistry)`. Engine code cannot import `CardRegistry` from
`@legendary-arena/registry` per layer boundary + D-3301 family.

**Resolution:**

1. Update WP-036 §D text to read:
   `runSimulation(config: SimulationConfig, registry: CardRegistryReader): SimulationResult`
   with a note citing WP-025/026 D-2504 precedent.
2. Update WP-036 §Scope (In) §D "Registry provided as parameter
   (setup-time only pattern)" to add: "Type is `CardRegistryReader`
   (local structural interface from `matchSetup.validate.ts`), not
   `CardRegistry` from the registry package — engine category
   prohibits registry imports per D-3301 family."
3. Add EC-036 amendment note: "Locked Value — `runSimulation`
   accepts `registry: CardRegistryReader`, not `CardRegistry`
   (scope-neutral correction per PS-2 of pre-flight)."
4. Add WP-036 §Amendments section:
   ```
   **A-036-01 (2026-04-20, pre-session):** §D signature corrected
   `registry: CardRegistry` → `registry: CardRegistryReader`.
   Scope-neutral per WP-025/026 D-2504 precedent. No file allowlist,
   test count, or wiring change.
   ```

**Blast radius:** WP + EC doc edits. No code impact at execution
time — this correction merely aligns the WP text with the only
import pattern the engine category permits.

---

## Mutation Boundary Confirmation

Not applicable — WP-036 class is Infrastructure & Verification. No
`G` mutations inside simulation files (all G mutations happen inside
dispatched move functions, which are framework-authorized via the
SimulationMoveContext bridge). Simulation itself does NOT mutate G.

---

## Pre-Flight Verdict (Binary)

**READY TO EXECUTE — CONDITIONAL on PS-1 and PS-2 resolution.**

Justification (6 sentences):

1. **Dependency readiness:** All 7 upstream contracts consumed by
   WP-036 (§Assumes lines 43–62) are verified present at the
   specified paths at HEAD `cd811eb`; WP-035 is complete; engine
   baseline 436/109/0 holds.
2. **Contract fidelity:** Types, field names, and function signatures
   match between the WP text and actual code for 10 of 11 surfaces;
   the 11th (`CardRegistry` in `runSimulation`) is a layer-boundary
   violation resolved by PS-2 as a scope-neutral signature correction
   per the WP-025/026 D-2504 precedent.
3. **Scope lock clarity:** File allowlist is 7 files (4 new under
   `src/simulation/`, 2 modified re-exports in `types.ts` / `index.ts`,
   1 new test file), test count is locked at 8 (444/110 post),
   maxTurnsPerGame = 200, mulberry32 PRNG, single-PRNG-per-run,
   `SimulationMoveContext` shape locked per RS-4.
4. **Risks resolved:** 12 risks catalogued (RS-1 through RS-12); 2
   blocking (RS-9, RS-10) are converted to pre-session actions
   (PS-1, PS-2); the remaining 10 are locked at pre-flight and
   execution must not revisit.
5. **Architectural boundary confidence:** Engine category rules
   apply in full; D-2702 (framework bypass), D-2705 (static MOVE_MAP),
   D-2704 (PRNG gap), D-2801 (local structural interface), D-2903
   (UIState filtering) are all carried forward; 01.5 NOT INVOKED
   per WP-030 precedent; 01.6 MANDATORY per new-long-lived-abstraction
   trigger.
6. **Maintainability:** `AIPolicy` extension seam is explicit; patch
   locality is per-file; zero legal-move fallback + turn-cap safety
   guard + seeded PRNG determinism all locked; semantic naming stable
   (no `V1` / `MVP` / `Simple` suffixes); no existing tests require
   edits.

### Pre-session actions — to be RESOLVED before session prompt is generated

1. **PS-1:** Create D-3601 classifying `packages/game-engine/src/simulation/`
   as `engine` category; update `02-CODE-CATEGORIES.md §engine`
   directories list.
2. **PS-2:** Update WP-036 §D + §Scope §D text + EC-036 amendment
   note + WP-036 §Amendments to correct `registry: CardRegistry` →
   `registry: CardRegistryReader`.

Both are doc-only, scope-neutral, and do not require re-running
pre-flight once complete. Once PS-1 + PS-2 are landed (as a SPEC
commit, analogous to WP-060's `0654a4c` pre-flight bundle), the
session prompt may be authored.

---

## Invocation Prompt Conformance Check (Pre-Generation)

This check runs WHEN the session prompt is authored (after PS-1 + PS-2
land). The invocation prompt must:

- [ ] Copy EC-036 locked values verbatim (including the PS-2-corrected
  `runSimulation` signature with `CardRegistryReader`).
- [ ] Introduce NO new keywords, helpers, file paths, or timing rules
  not in this pre-flight + WP-036 + EC-036.
- [ ] Match file paths and extensions exactly: 4 new simulation files
  under `packages/game-engine/src/simulation/`, 2 modified
  (`src/types.ts`, `src/index.ts`), 1 new test file
  `simulation.test.ts`.
- [ ] Introduce no forbidden imports via wording changes: explicitly
  forbid `boardgame.io`, `@legendary-arena/registry`, `Math.random`,
  `.reduce()`.
- [ ] Not resolve ambiguities unresolved here — all RS-items are
  locked in this pre-flight.
- [ ] Use `CardRegistryReader`, not `CardRegistry`, in the
  `runSimulation` signature.
- [ ] Lock mulberry32, single-PRNG-per-run, 200-turn cap,
  `SimulationMoveContext` 5-field shape, `advanceTurnStage` reuse for
  advanceStage dispatch (D-2705).
- [ ] Lock canonical legal-move enumeration order (RS-13): playCard
  (hand asc) → recruitHero (HQ 0..4) → fightVillain (City 0..4) →
  fightMastermind → revealVillainCard (if start) → drawCards (if
  legal) → advanceStage (if not cleanup) → endTurn (if cleanup); with
  `// why: ordering locked by pre-flight RS-13` comment.
- [ ] Lock test #7 assertion pattern to WP-029's verbatim pattern
  (RS-14): executor must read `src/ui/uiState.filter.test.ts` at
  session start and copy the `handCards` assertion for non-active
  audiences exactly — do not invent a new convention.
- [ ] Lock simulation move-name set (RS-15): 8-name `as const` tuple
  in `ai.legalMoves.ts` (`drawCards`, `playCard`, `endTurn`,
  `advanceStage`, `revealVillainCard`, `fightVillain`, `recruitHero`,
  `fightMastermind`); lobby moves explicitly excluded; `// why:`
  comment cites WP-032 D-3202.
- [ ] Include explicit "01.5 NOT INVOKED" section enumerating the four
  01.5 criteria and marking each absent (WP-030 precedent).
- [ ] Include explicit "01.6 MANDATORY" section listing the five
  post-mortem items from RS-11.
- [ ] Include lifecycle-isolation prohibition: "simulation files must
  NOT be wired into `game.ts`, moves, or phase hooks" (WP-028
  precedent).
- [ ] Include contract-enforcement framing for the 8 tests (WP-028
  precedent).
- [ ] Include projection-purity "Forbidden behaviors" docstring block
  for `decideTurn` (WP-028 precedent).
- [ ] Cite `EC-036:` as the commit prefix (EC-036 slot unconsumed;
  P6-36 precedent).
- [ ] Cite P6-22 (escaped-dot grep patterns) and P6-27 (stage-by-
  filename only) for verification + staging.
- [ ] Reference the three-commit topology: SPEC (pre-flight bundle +
  PS-1 + PS-2 resolutions) → EC-036 (implementation) → SPEC
  (governance close: STATUS + WORK_INDEX + EC_INDEX).

**Rule:** The invocation prompt is strictly a transcription + ordering
artifact. No interpretation.

---

## Authorized Next Step

> You are authorized to generate a **session execution prompt** for
> WP-036 to be saved as:
> `docs/ai/invocations/session-wp036-ai-playtesting-balance-simulation.md`
>
> **PROVIDED THAT PS-1 AND PS-2 ARE RESOLVED FIRST.**

**Pre-session actions — to be logged here once RESOLVED:**

1. ☐ **PS-1 RESOLVED (YYYY-MM-DD):** D-3601 created in DECISIONS.md;
   `packages/game-engine/src/simulation/` added to
   `02-CODE-CATEGORIES.md §engine` directories list. Commit hash:
   `________`.
2. ☐ **PS-2 RESOLVED (YYYY-MM-DD):** WP-036 §D + §Scope §D signatures
   corrected; EC-036 amendment note added; WP-036 §Amendments
   A-036-01 entry added. Commit hash: `________`.

Once both are checked, the pre-flight is UNCONDITIONAL READY TO
EXECUTE. No re-run required — these updates resolve boundary + layer
concerns identified by this pre-flight without changing scope.

**Guard:** The session prompt MUST conform exactly to the scope,
constraints, and decisions locked by this pre-flight. No new scope
may be introduced.

---

## Summary of Locks (Quick Reference for Executor)

| Lock | Value |
|---|---|
| Branch | `wp-036-ai-playtesting` cut fresh from `main @ cd811eb` |
| Commit prefix | `EC-036:` (EC-036 slot unconsumed) |
| File allowlist | 4 new + 2 modified re-exports + 1 new test = 7 files |
| Test count | 8 new, 0 modified → 444/110/0 post |
| Test wrapping | 1 `describe('simulation framework (WP-036)')` block |
| PRNG | mulberry32, simulation-internal, single instance per run |
| Max turns per game | 200 (safety cap, not gameplay rule) |
| `runSimulation` signature | `(config: SimulationConfig, registry: CardRegistryReader): SimulationResult` |
| `advanceStage` dispatch | Via `advanceTurnStage` from `src/turn/turnLoop.ts` (D-2705) |
| Framework bypass | `buildInitialGameState` directly (D-2702) |
| Move dispatch | Static MOVE_MAP + local `SimulationMoveContext` (D-2705 + D-2801) |
| 01.5 allowance | NOT INVOKED (WP-030 precedent) |
| 01.6 post-mortem | MANDATORY (new long-lived abstraction + new code-category dir) |
| Forbidden imports | `boardgame.io`, `@legendary-arena/registry` |
| Forbidden calls | `Math.random()`, `.reduce()`, `Game.setup()` |
| Dirty tree | 2 modified + 11 untracked — UNTOUCHED (P6-27) |
| Stashes | `stash@{0..2}` NOT POPPED |
| Grep gates | `boardgame\.io`, `\.reduce\(`, `Math\.random\(`, `require\(` (P6-22) |
| Three-commit topology | SPEC (PS-1 + PS-2) → EC-036 (code) → SPEC (close) |
| Engine baseline at start | 436/109/0 (verified 2026-04-20) |
| Governance close | STATUS.md + WORK_INDEX.md + EC_INDEX.md (commit B) |

---

## Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

Verdict: **READY TO EXECUTE — conditional on PS-1 + PS-2 resolution.**

Once PS-1 and PS-2 are landed, the session execution prompt may be
authored in strict conformance to the scope, constraints, and
decisions locked above. If any uncertainty surfaces during prompt
authoring or execution that this pre-flight does not resolve: STOP,
escalate, and do NOT force-fit under 01.5.

*Pre-flight authored 2026-04-20 at `main @ cd811eb`. Consumer: the
session execution prompt author for WP-036 (after PS-1 + PS-2 land).*

---

# Copilot Check (01.7) — WP-036 AI Playtesting & Balance Simulation

**Date:** 2026-04-20
**Pre-flight verdict under review:** READY TO EXECUTE — conditional on
PS-1 + PS-2 (authored 2026-04-20, same session as this check)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md`
- WP: `docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md`
- Pre-flight: `docs/ai/invocations/preflight-wp036-ai-playtesting-balance-simulation.md` (same file, above)
- Session context: `docs/ai/session-context/session-context-wp036.md`

## Overall Judgment — Initial Pass

**HOLD.**

The pre-flight verdict holds under 27 of the 30 issues without
qualification. Three issues (5 optional-field ambiguity, 10 stringly-
typed outcomes, 23 deterministic ordering guarantees) surfaced
scope-neutral `RISK` findings where prevention is present at the
precedent level but not yet locked in the pre-flight's
§Invocation Prompt Conformance Check. All three are resolvable by
wording additions to the pre-flight (new RS entries) without
changing file allowlist, test count, wiring decision, or category
taxonomy. None rises to `BLOCK` — architectural and determinism
integrity are intact, and PS-1 + PS-2 already capture the two
genuinely blocking items (directory classification + CardRegistry
→ CardRegistryReader). After the three FIXes land in the pre-flight,
a re-run should CONFIRM.

## Findings (by category)

### 1. Separation of Concerns & Boundaries

1. **Engine vs UI / App Boundary Drift — PASS.** D-3601 (PS-1) +
   D-3301 family keep simulation under engine category; PS-2 enforces
   registry boundary via `CardRegistryReader`; WP explicitly forbids
   `boardgame.io` + `@legendary-arena/registry` imports in simulation
   files.
9. **UI Re-implements Engine Logic — PASS.** AI consumes
   `filterUIStateForAudience` projection only; D-0701 locks "AI is an
   external consumer that submits intents, never outcomes"; WP-029
   audience-filtered view is the single interface.
16. **Lifecycle Wiring Creep — PASS.** Pre-flight §Scope Lock
    explicitly forbids touching `game.ts`, `moves/*`, `rules/*`,
    phase hooks; Verification Step 6 greps
    `git diff --name-only packages/game-engine/src/game.ts moves/ rules/`
    expecting zero output; 01.5 explicitly declared NOT INVOKED per
    WP-030 precedent.
29. **Assumptions Leaking Across Layers — PASS.**
    `SimulationMoveContext` is a local 5-field structural interface
    (RS-4) — no framework assumptions beyond what dispatched moves
    actually destructure; engine does not know AI exists (D-0701).

### 2. Determinism & Reproducibility

2. **Non-Determinism by Convenience — PASS.** RS-1 locks mulberry32;
   RS-5 locks single-PRNG-per-run; Verification Step 4 greps
   `Math\.random`; `// why:` comment required on ctx.random.*
   usage per code-style.md.
8. **No Single Debugging Truth Artifact — PASS.** Simulation is
   fully reproducible from `(seed, setupConfig, policies)` per test
   #3; WP-036 §Out of Scope deliberately excludes per-game replay
   persistence (results returned, not stored) — this is an MVP scope
   cut, not a prevention gap.
23. **Lack of Deterministic Ordering Guarantees — RISK.**
    `getLegalMoves` enumeration order is deterministic by
    construction (pure function over `G`/`ctx`) but the canonical
    order is not locked in the pre-flight. If the random policy picks
    index `prng() * legalMoves.length`, swapping the enumeration
    order between hand/HQ/City silently changes all tests #3/#4
    decision outputs. The implementation will pick *an* order, but
    the pre-flight must lock *which* order so a future refactor
    cannot silently flip it.
    **FIX:** Add **RS-13** locking enumeration order:
    `playCard` intents (hand zone index ascending) → `recruitHero`
    intents (HQ slot 0..4) → `fightVillain` intents (City slot 0..4)
    → `fightMastermind` intents (active mastermind only) →
    `revealVillainCard` (if `G.currentStage === 'start'`) →
    `drawCards` (if legal) → `advanceStage` (if
    `G.currentStage !== 'cleanup'`) → `endTurn` (if
    `G.currentStage === 'cleanup'`). Executor must add a `// why:
    ordering locked by pre-flight RS-13 for deterministic seeded
    selection` comment on the return statement in
    `ai.legalMoves.ts`.

### 3. Immutability & Mutation Discipline

3. **Pure Functions vs Immer Mutation — PASS.** Simulation files are
   pure helpers (return values, do not mutate G); dispatched moves
   mutate plain `G` directly outside Immer (WP-027 D-2702 pattern,
   safe because simulation discards G per-game); WP says moves return
   void, never throw.
17. **Hidden Mutation via Aliasing — PASS.** AI policy receives
    spread-copied `UIState` per WP-029 D-2903; `SimulationResult`
    is plain scalars (no aliasing surface); RS-11 locks post-mortem
    aliasing check per WP-028 precedent.

### 4. Type Safety & Contract Integrity

4. **Contract Drift Between Types, Tests, Runtime — PASS.** PS-2
   already identified and corrects the single drift case
   (`CardRegistry` → `CardRegistryReader`); EC-036 §Locked Values
   transcribes WP-036 §Non-Negotiable Constraints verbatim; tests
   #1/#6/#7 enforce contract shape end-to-end.
5. **Optional Field Ambiguity — RISK.** Test #7 asserts "filtered
   UIState has no hand cards for opponents." Per WP-029 D-2903 +
   01.4 `exactOptionalPropertyTypes` note, the exact shape of
   `UIPlayerState.handCards` for non-active audiences (empty array
   vs `undefined` vs key absent) determines the correct assertion.
   RS-8 flags this for verification at execution start but does not
   lock the assertion pattern, so the executor could write either
   `assert.strictEqual(handCards, undefined)` or
   `assert.deepStrictEqual(handCards, [])` and only one will match
   WP-029's actual output.
    **FIX:** Add **RS-14** requiring the executor to read
    `src/ui/uiState.filter.ts` + `src/ui/uiState.filter.test.ts` at
    session start and copy WP-029's exact assertion pattern (most
    likely `typeof handCards === 'undefined'` based on the
    conditional-assignment pattern under `exactOptionalPropertyTypes`
    cited in 01.4). The assertion pattern must match WP-029 verbatim
    — not a new convention.
6. **Undefined Merge Semantics — PASS.** No merging — simulation
   aggregates via averaging, not merging. `SimulationConfig` has
   no override semantics.
10. **Stringly-Typed Outcomes — RISK.** `LegalMove.name: string`
    and `ClientTurnIntent.moveName: string` are wide-typed. Engine
    has 8 play-phase moves (`drawCards`, `playCard`, `endTurn`,
    `advanceStage`, `revealVillainCard`, `fightVillain`,
    `recruitHero`, `fightMastermind`) but `CORE_MOVE_NAMES`
    enumerates only 3. Per WP-032 D-3202 precedent, the simulation
    must inject valid move names since `CORE_MOVE_NAMES` is
    incomplete. Without locking the 8-name set in the pre-flight,
    the executor could accidentally enumerate lobby moves
    (`setPlayerReady`, `startMatchIfReady`) and produce invalid
    intents.
    **FIX:** Add **RS-15** locking the simulation move-name set:
    ```ts
    // ai.legalMoves.ts — local constant, NOT a drift-pinned
    // canonical array (per WP-032 D-3202 precedent)
    const SIMULATION_MOVE_NAMES = [
      'drawCards', 'playCard', 'endTurn', 'advanceStage',
      'revealVillainCard', 'fightVillain', 'recruitHero',
      'fightMastermind'
    ] as const;
    ```
    Lobby moves (`setPlayerReady`, `startMatchIfReady`) are
    explicitly excluded — simulation starts in `play` phase.
    Executor must add `// why: simulation covers the play-phase
    only; lobby moves are excluded per pre-flight RS-15`.
21. **Type Widening at Boundaries — PASS.** `args: unknown` and
    `moveArgs: unknown` are deliberate wide types (WP-032 pattern);
    `CardRegistryReader` narrows at the registry boundary;
    `SimulationMoveContext` narrows at the framework boundary.
    All widenings are intentional and justified.
27. **Weak Canonical Naming Discipline — PASS.** `gamesPlayed`,
    `winRate`, `averageTurns`, `averageScore`, `escapedVillainsAverage`,
    `woundsAverage`, `seed` — all full English words, no
    abbreviations (code-style.md Rule 4/14); no collisions with
    existing engine names. `createRandomPolicy` avoids `MVP` / `V1`
    / `Simple` suffixes per semantic-stability precedent.

### 5. Persistence & Serialization

7. **Persisting Runtime State by Accident — PASS.** WP §Out of
   Scope: "No persistence of simulation results — results are
   returned, not stored"; `AIPolicy` explicitly forbidden from G;
   Guardrail: "Metrics are derived from game results — never
   injected into G."
19. **Weak JSON-Serializability — PASS.** Test #8 explicitly
    asserts `JSON.stringify(result)` round-trips; `SimulationResult`
    is six numbers + one string; no Maps / Sets / functions / classes
    in the result shape.
24. **Mixed Persistence Concerns — PASS.** Runtime G discarded
    per-game; `SimulationResult` returned by value; no snapshot, no
    config-runtime blur.

### 6. Testing & Invariant Enforcement

11. **Tests Validate Behavior, Not Invariants — PASS.** Test #3
    asserts determinism invariant; test #7 asserts D-0701
    hidden-state invariant; test #8 asserts JSON-serializability
    invariant. Tests use `makeMockCtx` + `node:test` + `node:assert`;
    no `boardgame.io/testing`; baseline 436/109/0 → 444/110/0
    locked in pre-flight §Test Expectations. Contract-enforcement
    framing per WP-028 precedent.

### 7. Scope & Execution Governance

12. **Scope Creep During "Small" Packets — PASS.** §Scope Lock lists
    exactly 7 files; §Not Allowed To has 20 explicit prohibitions;
    Verification Step 8 greps `git diff --name-only` for deviations;
    "anything not explicitly allowed is out of scope" rule cited.
13. **Unclassified Directories and Ownership Ambiguity — PASS.**
    Pre-flight caught this as PS-1 (creates D-3601, adds to
    02-CODE-CATEGORIES.md §engine list, ninth instance of the
    D-2706/D-2801/D-3001/D-3101/D-3201/D-3301/D-3401/D-3501
    pattern). Explicit blast-radius note ("Doc-only, no code
    change").
30. **Missing Pre-Session Governance Fixes — PASS.** §Pre-Session
    Actions enumerates PS-1 and PS-2 with classification
    (scope-neutral), resolution steps, and blast radius. Resolution
    logging template provided in §Authorized Next Step.

### 8. Extensibility & Future-Proofing

14. **No Extension Seams for Future Growth — PASS.** `AIPolicy`
    interface is the canonical seam for heuristic / MCTS / neural
    policies; `SimulationConfig.policies: AIPolicy[]` supports
    multi-policy runs; `LegalMove` is open-ended (`args: unknown`)
    for future move additions; pre-flight §Maintainability
    explicitly confirms.
28. **No Upgrade or Deprecation Story — PASS.** WP-036 is purely
    additive; `SimulationResult` can gain fields without breaking
    older consumers; `AIPolicy` can gain optional methods; no
    migration needed, no data-format changes.

### 9. Documentation & Intent Clarity

15. **Missing "Why" for Invariants and Boundaries — PASS.** EC-036
    §Required `// why:` Comments lists 4 required site-comments
    (one per new non-test file); pre-flight RS-1/RS-3/RS-5/RS-7
    each end with a `// why:` citation; Established Patterns cite
    D-2702/D-2704/D-2705/D-2801/D-2903 as justification anchors.
20. **Ambiguous Authority Chain — PASS.** Pre-flight §Authority
    Chain reads explicitly in order (CLAUDE.md → ARCHITECTURE.md →
    DATA-SOURCES → CODE-CATEGORIES → EC-036 → WP-036 →
    session-context); higher-authority wins on conflict; no
    ambiguity.
26. **Implicit Content Semantics — PASS.** WP §Session Context
    explicitly states the purpose, constraints, and rationale
    (D-0701 + D-0702); no "convention-based" semantics.

### 10. Error Handling & Failure Semantics

18. **Outcome Evaluation Timing Ambiguity — PASS.** Endgame
    evaluation runs inside existing moves (no new `endIf` or phase
    hook added); simulation aggregates *after* `evaluateEndgame`
    returns; RS-6 locks zero-legal-moves fallback; RS-7 locks
    200-turn cap terminator.
22. **Silent vs Loud Failure — PASS.** Unknown move names warn +
    skip via `G.messages` per D-2705; zero legal moves → policy
    returns `endTurn` or `advanceStage` per RS-6; 200-turn cap →
    game terminates with "stuck" status per RS-7; moves return
    void, never throw, per engine rules.

### 11. Single Responsibility & Logic Clarity

25. **Overloaded Function Responsibilities — PASS.** Each
    simulation file has one narrow responsibility: `ai.types.ts`
    (type definitions), `ai.random.ts` (random policy +
    simulation-internal mulberry32 helper), `ai.legalMoves.ts`
    (enumeration), `simulation.runner.ts` (orchestration +
    aggregation, single conceptual responsibility of "run
    simulation"). mulberry32 inside `ai.random.ts` is justified as
    an internal helper (no factory-for-one-time-setup concern).

## Mandatory Governance Follow-ups

None beyond PS-1 (D-3601 + 02-CODE-CATEGORIES.md) and PS-2 (WP-036 §D
+ §Scope §D + EC-036 amendment) already locked by the pre-flight.

The three RISK findings above (issues 5, 10, 23) are resolved by
adding RS-13 / RS-14 / RS-15 to the pre-flight's §Risk & Ambiguity
Review section — pre-flight wording additions only, no new
governance artifacts, no DECISIONS.md entries, no new rules files,
no WORK_INDEX changes.

## Pre-Flight Verdict Disposition (Initial Pass)

- [ ] CONFIRM — (not yet; three RISKs outstanding)
- [x] **HOLD — Apply RS-13, RS-14, RS-15 to the pre-flight's §Risk
      & Ambiguity Review section; re-run copilot check. Scope
      unchanged; no pre-flight re-run required.**
- [ ] SUSPEND

---

## FIXes Applied (2026-04-20, same session)

RS-13, RS-14, RS-15 added to the pre-flight §Risk & Ambiguity
Review above. Session-prompt §Invocation Prompt Conformance Check
list extended to reference all three. No scope change, no new
files, no new tests, no wiring change.

## Re-Run — 2026-04-20

All 30 issues now PASS with the three FIXes applied.

| # | Category | Issue | Verdict |
|---|---|---|---|
| 1 | Boundaries | Engine vs UI/App | PASS |
| 2 | Determinism | Non-Determinism by Convenience | PASS |
| 3 | Mutation | Pure vs Immer | PASS |
| 4 | Types | Contract Drift | PASS |
| 5 | Types | Optional Field Ambiguity | **PASS** (RS-14) |
| 6 | Types | Undefined Merge Semantics | PASS |
| 7 | Persistence | Persisting Runtime State | PASS |
| 8 | Determinism | Single Debugging Truth | PASS |
| 9 | Boundaries | UI Re-implements Engine | PASS |
| 10 | Types | Stringly-Typed Outcomes | **PASS** (RS-15) |
| 11 | Testing | Invariant Tests | PASS |
| 12 | Governance | Scope Creep | PASS |
| 13 | Governance | Unclassified Directories | PASS (PS-1) |
| 14 | Extensibility | Extension Seams | PASS |
| 15 | Docs | Missing "Why" | PASS |
| 16 | Boundaries | Lifecycle Wiring Creep | PASS |
| 17 | Mutation | Hidden Aliasing | PASS |
| 18 | Errors | Outcome Evaluation Timing | PASS |
| 19 | Persistence | JSON-Serializability | PASS |
| 20 | Docs | Authority Chain | PASS |
| 21 | Types | Widening at Boundaries | PASS |
| 22 | Errors | Silent vs Loud Failure | PASS |
| 23 | Determinism | Deterministic Ordering | **PASS** (RS-13) |
| 24 | Persistence | Mixed Persistence | PASS |
| 25 | Clarity | Overloaded Responsibilities | PASS |
| 26 | Docs | Implicit Semantics | PASS |
| 27 | Types | Canonical Naming | PASS |
| 28 | Extensibility | Upgrade/Deprecation | PASS |
| 29 | Boundaries | Assumptions Leaking | PASS |
| 30 | Governance | Pre-Session Fixes | PASS (PS-1 + PS-2) |

**30 / 30 PASS.**

## Pre-Flight Verdict Disposition (Final)

- [x] **CONFIRM — Pre-flight `READY TO EXECUTE` verdict stands.
      Session prompt generation authorized, conditional on PS-1
      and PS-2 landing (doc-only pre-session actions).**
- [ ] HOLD
- [ ] SUSPEND

Copilot check complete. The session execution prompt for WP-036 may
be authored after PS-1 (D-3601 + 02-CODE-CATEGORIES.md update) and
PS-2 (WP-036 §D + EC-036 amendment) land in a SPEC pre-flight-bundle
commit, analogous to WP-060's commit `0654a4c`.

*Copilot check authored 2026-04-20 at `main @ cd811eb`, same session
as the pre-flight above.*
