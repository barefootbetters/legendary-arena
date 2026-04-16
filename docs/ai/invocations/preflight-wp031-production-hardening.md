# Pre-Flight Invocation — WP-031 Production Hardening & Engine Invariants

**Target Work Packet:** `WP-031`
**Title:** Production Hardening & Engine Invariants
**Previous WP Status:** WP-030 Complete (2026-04-14, commits `5be83f4` + `94d947b` + lessons `42183b7`)
**Pre-Flight Date:** 2026-04-15
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** **Runtime Wiring**

WP-031 introduces a new `src/invariants/` subdirectory containing pure
check functions, a throwing assertion utility (`assertInvariant`), and a
`runAllInvariantChecks` orchestrator. Per WP-031 §H, the orchestrator is
**wired into `game.ts`** after `Game.setup()` and optionally into the move
lifecycle. That wiring modifies existing runtime orchestration, making this
a Runtime Wiring class packet — not Contract-Only. It is also **not** a
Behavior / State Mutation packet: invariant checks observe `G`, they never
mutate it. All check functions are pure helpers returning `void` (or
throwing via `assertInvariant`).

Per 01.4 §Work Packet Class, a Runtime Wiring WP must complete:
Dependency Check, Input Data Traceability, Structural Readiness,
**Runtime Readiness Check**, **Maintainability & Upgrade Readiness**,
Code Category Boundary Check, Scope Lock, Test Expectations, and
Risk Review. Dependency Contract Verification is also required because
WP-031 consumes `LegendaryGameState`, `CityZone`, `ENDGAME_CONDITIONS`,
`MATCH_PHASES`, `TURN_STAGES`, and `makeMockCtx` by name.

Per 01.4 §Step Sequencing, this pre-flight is **step 1** of the 9-step
WP execution workflow. **Step 1b (copilot check)** per
`01.7-copilot-check.md` is mandatory for Runtime Wiring WPs and must
run in the same session after this pre-flight returns READY TO EXECUTE.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-031.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

## Authority Chain (Read Order)

1. `.claude/CLAUDE.md` — project invariants, EC-mode rules, lint gate authority
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, MVP Gameplay Invariants (§"MVP Gameplay Invariants", line 1134), persistence classes, Throwing Convention
3. `docs/03.1-DATA-SOURCES.md` — not consumed by WP-031 (no external inputs)
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — engine vs framework vs setup category rules (src/invariants/ not yet listed — see PS-1)
5. `docs/ai/execution-checklists/EC-031-production-hardening.checklist.md` — governing checklist
6. `docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md` — authoritative WP
7. `docs/ai/DECISIONS.md` — D-0001, D-0002, D-0102 (and clarification), D-2706 / D-2801 / D-3001 classification precedents
8. `.claude/rules/game-engine.md` — Throwing Convention table and Immutable Layer Boundary
9. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — 01.5 IS INVOKED for this WP (see below)
10. `docs/ai/REFERENCE/00.6-code-style.md` — full-sentence error messages (Rule 11), no `.reduce()` (Rule 8), `// why:` comments (Rule 6)

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-005B | pass | `makeMockCtx` exists in [packages/game-engine/src/test/mockCtx.ts](packages/game-engine/src/test/mockCtx.ts). Returns `SetupContext` (numPlayers + Shuffle-only random). |
| WP-006A | pass | `CardExtId`, `PlayerZones`, `GlobalPiles` canonical in [state/zones.types.ts](packages/game-engine/src/state/zones.types.ts) |
| WP-007A | pass | `MatchPhase`, `TurnStage`, `MATCH_PHASES` (4 entries), `TURN_STAGES` (3 entries) locked in [turn/turnPhases.types.ts](packages/game-engine/src/turn/turnPhases.types.ts) |
| WP-010 | pass | `ENDGAME_CONDITIONS` (3 keys: `ESCAPED_VILLAINS`, `SCHEME_LOSS`, `MASTERMIND_DEFEATED`) in [endgame/endgame.types.ts:36-40](packages/game-engine/src/endgame/endgame.types.ts:36) |
| WP-015 | pass | `CityZone` is a fixed 5-tuple in [board/city.types.ts:29](packages/game-engine/src/board/city.types.ts:29) |
| WP-026 | pass | `LegendaryGameState` is stable with all MVP fields (see [types.ts:250-377](packages/game-engine/src/types.ts:250)) |
| WP-027 | pass | `src/replay/` classified under engine category (D-2706 precedent) |
| WP-028 | pass | `src/ui/` classified under engine category (D-2801 precedent); `UIBuildContext` local structural interface precedent (D-2801) |
| WP-029 | pass | `filterUIStateForAudience` + UIState audience filter complete (WORK_INDEX.md line 617 marked `[x]` ✅ Reviewed 2026-04-14). WP-031 explicitly defers Security/Visibility invariant checks — no direct WP-029 code dependency, only contract stability. |
| WP-030 | pass | `src/campaign/` classified under engine category (D-3001 precedent matching D-2706/D-2801 template). 348-test baseline established. |

**Baseline green (verified 2026-04-15):**
- `pnpm --filter @legendary-arena/game-engine build` exits 0, no TypeScript errors.
- `pnpm --filter @legendary-arena/game-engine test` exits 0. **348 tests, 93 suites, 0 fail, duration ~3.2s**. Matches session-context-wp031 baseline line 3 exactly.
- `git status`: main branch, one commit ahead of origin (`42183b7` WP-030 lessons), clean working tree apart from expected untracked `docs/ai/session-context/session-context-wp029.md` (leftover prior-WP context file, not scoped to WP-031) and pre-existing unrelated untracked license/one-pager docs.

**WORK_INDEX.md verification:**
- WP-029: `[x] WP-029 — Spectator & Permissions View Models ✅ Reviewed (2026-04-14)` (line 617) — satisfied.
- WP-030: `[x] WP-030 — Campaign / Scenario Framework ✅ Reviewed ✅ Completed 2026-04-14` (line 628) — satisfied.
- WP-031: `[ ] WP-031 — Production Hardening & Engine Invariants ✅ Reviewed` (line 644), Dependencies: WP-029 — **ready to execute after PS-1 + PS-2 resolved below**.

**Rule:** All prerequisites are complete. Sequencing is satisfied. No
upstream WP is blocked or in review. WP-031's only listed dependency is
WP-029, which is complete.

---

## Dependency Contract Verification

WP-031 consumes the following engine contracts by import. Each verified
against actual source:

- [x] **`LegendaryGameState`** — [types.ts:250-377](packages/game-engine/src/types.ts:250).
  All fields WP-031 needs to check are present:
  `currentStage: TurnStage`, `playerZones: Record<string, PlayerZones>`,
  `piles: GlobalPiles`, `messages: string[]`, `counters: Record<string, number>`,
  `hookRegistry: HookDefinition[]`, `villainDeck: VillainDeckState`,
  `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`,
  `city: CityZone`, `hq: HqZone`, `ko: CardExtId[]`,
  `attachedBystanders: Record<CardExtId, CardExtId[]>`,
  `mastermind: MastermindState`, `turnEconomy: TurnEconomy`,
  `cardStats: Record<CardExtId, CardStatEntry>`,
  `cardKeywords: Record<CardExtId, BoardKeyword[]>`,
  `schemeSetupInstructions: SchemeSetupInstruction[]`,
  `heroAbilityHooks: HeroAbilityHook[]`, `lobby: LobbyState`.
  Structural checks (array types, field existence) have full coverage.

- [x] **`CityZone`** — [board/city.types.ts:29](packages/game-engine/src/board/city.types.ts:29).
  Tuple type `[CitySpace, CitySpace, CitySpace, CitySpace, CitySpace]`
  with `CitySpace = CardExtId | null`. **Fixed length is 5**, exactly
  matching WP-031 §C `checkCitySize(G)` expectation. Locked tuple shape —
  `G.city.length !== 5` is sufficient structural invariant.

- [x] **`HqZone`** — same file, same shape (5-tuple). Not explicitly
  named in WP-031 scope but `checkCitySize` precedent could be
  extended; out of scope for this WP per §Scope (In) §C.

- [x] **`ENDGAME_CONDITIONS`** — [endgame/endgame.types.ts:36-40](packages/game-engine/src/endgame/endgame.types.ts:36).
  3 locked keys: `ESCAPED_VILLAINS = 'escapedVillains'`,
  `SCHEME_LOSS = 'schemeLoss'`, `MASTERMIND_DEFEATED = 'mastermindDefeated'`.
  WP-031 §D `checkCountersUseConstants(G)` must compare counter keys
  against `Object.values(ENDGAME_CONDITIONS)`. **Note:** tests and
  runtime may legitimately introduce additional counter keys beyond the
  canonical three (e.g., scheme-specific counters from hooks). The check
  must allow documented custom keys per EC §Game Rules bullet 3 —
  a hard equality check would over-reject. Session prompt must
  explicitly state the check is "key is in `ENDGAME_CONDITIONS` OR
  documented custom" semantics.

- [x] **`MATCH_PHASES`** — [turn/turnPhases.types.ts:20](packages/game-engine/src/turn/turnPhases.types.ts:20).
  Readonly 4-entry array `['lobby', 'setup', 'play', 'end']` locked by
  WP-007A. WP-031 §F `checkValidPhase(phase)` must compare against this
  array. String values verified against code that produces them
  (`.claude/rules/game-engine.md` §Phases locked names — matches).

- [x] **`TURN_STAGES`** — [turn/turnPhases.types.ts:31](packages/game-engine/src/turn/turnPhases.types.ts:31).
  Readonly 3-entry array `['start', 'main', 'cleanup']`. WP-031 §F
  `checkValidStage(stage)` must compare against this array. WP-031
  §F text says "one of the 3 locked values" — ✅ matches reality.

- [x] **`makeMockCtx`** — [test/mockCtx.ts:28](packages/game-engine/src/test/mockCtx.ts:28).
  Returns `SetupContext` (`{ ctx: { numPlayers }, random: { Shuffle } }`).
  Does **NOT** provide `phase`, `turn`, or `currentPlayer`. Invariant
  tests that need to exercise lifecycle checks must construct their own
  plain `InvariantCheckContext` object literal (see refinement RS-2
  below) — `makeMockCtx` alone is insufficient for lifecycle checks.
  This matches the WP-028 `UIBuildContext` test pattern.

- [x] **`game.ts` wiring site** — [game.ts:80-245](packages/game-engine/src/game.ts:80).
  `LegendaryGame` is the sole `Game<>` export. Setup returns
  `buildInitialGameState(matchConfiguration, registryForSetup, context)`
  (line 157). To wire `runAllInvariantChecks` after setup, the return
  must be captured in a local variable, checked, and returned. Move
  functions are imported individually (`drawCards`, `playCard`,
  `endTurn`, `advanceStage`, `revealVillainCard`, `fightVillain`,
  `recruitHero`, `fightMastermind`, `setPlayerReady`, `startMatchIfReady`
  — 10 total). Wiring post-move checks would require wrapping each
  reference in `game.ts` (not modifying the underlying `*.impl.ts` files,
  which are out of scope). See PS-2 for the wiring decision.

- [x] **`InvariantCategory` and `InvariantViolation` contract** —
  WP-031 §A defines both. Neither exists yet — both are new in this WP.
  No drift risk.

- [x] **`assertInvariant` signature** — WP-031 §B:
  `assertInvariant(condition: boolean, category: InvariantCategory, message: string): void`.
  **Throws** on false. This is the **one exception** to the "moves
  never throw" rule outside `Game.setup()` per D-0102 clarification
  and session context line 88-103. The exception must be explicitly
  documented in the session prompt with a `// why:` comment citing
  D-0102, and all check functions must call `assertInvariant` (never
  `return`) on failure so that the fail-fast contract is preserved.

- [x] **`runAllInvariantChecks` signature — DESIGN REFINEMENT RS-2** —
  WP-031 §G text says `runAllInvariantChecks(G: LegendaryGameState, ctx: Ctx): void`.
  **Blocking tension:** `Ctx` is a `boardgame.io` type. Importing
  `Ctx` into any `src/invariants/*` file violates EC-031 verification
  step 3 (`Select-String -Path "packages\game-engine\src\invariants"
  -Pattern "boardgame.io"` must emit no output). Resolution under
  D-2801 precedent: define a local structural interface
  `InvariantCheckContext { readonly phase?: MatchPhase; readonly turn?: number }`
  in `invariants.types.ts`, populate it from `ctx` at the wiring site
  in `game.ts` (where boardgame.io `Ctx` import is allowed), and pass
  the plain-object form into `runAllInvariantChecks`. Lifecycle checks
  that need phase/turn read from this local interface. Tests pass
  object literals directly without invoking `makeMockCtx`. **Lock:**
  session prompt must use the local structural interface; WP §G text
  must be back-synced post-execution per P6-8.

- [x] **`InvariantViolationError` companion type** — WP-031 §B says
  `assertInvariant` "throws `InvariantViolationError`". This error
  class is not in EC-031 locked values but is a natural consequence of
  the locked function signature (must be a concrete throwable). Per
  WP-027 `DeterminismResult` companion-type precedent, authorize the
  class as a companion type locked here: `class InvariantViolationError
  extends Error { readonly category: InvariantCategory; readonly
  message: string; }` in `assertInvariant.ts`. Session prompt must
  explicitly enumerate this companion so the executing agent does not
  invent an alternative error shape.

- [x] **Contract files respected** — WP-031 does NOT modify any
  WP-007A, WP-010, WP-015, or WP-006A contract files. The only
  modifications are: `game.ts` (wiring), `types.ts` (re-export),
  `index.ts` (export API). All other files are new under
  `src/invariants/`. No immutable file violations.

- [x] **WP file paths verified against actual filesystem** — all
  `Files Expected to Change` targets confirmed via
  `packages/game-engine/src/invariants/` does not yet exist (Glob
  returned no matches), confirming all 8 check files are net-new.
  `game.ts`, `types.ts`, `index.ts` exist and are modifiable.

- [x] **WP file paths verified against code category rules** — `src/invariants/`
  is **not currently listed** in `02-CODE-CATEGORIES.md` (grep for
  `src/invariants`, `src/campaign`, `src/ui`, `src/replay` returned
  no matches — none of the three prior-precedent directories are
  inscribed there either; classification lives in DECISIONS.md under
  D-2706 / D-2801 / D-3001). **Blocking finding PS-1**: create
  D-3101 (or next available ID) to classify `src/invariants/` as
  engine code category, following the D-2706 / D-2801 / D-3001
  template verbatim. This matches the WP-030 PS-1 workflow exactly
  and is codified in 01.4 §Established Patterns line ~964 "Code-
  category classification for new engine subdirectories as
  pre-flight pre-condition".

- [x] **WP gating assumptions verified** — WP-031 §Assumes lists
  WP-029 complete (verified, WORK_INDEX line 617),
  `LegendaryGameState` stable (verified, 377-line interface with all
  fields present), `CityZone` (verified, city.types.ts:29),
  `ENDGAME_CONDITIONS` (verified, endgame.types.ts:36), `makeMockCtx`
  (verified, mockCtx.ts:28), build/test green (verified, 348 tests
  pass), `ARCHITECTURE.md §MVP Gameplay Invariants` exists (verified,
  line 1134), `DECISIONS.md` with D-0001 / D-0002 / D-0102 including
  clarification (verified, grep found em-dash entries at lines 21, 29,
  55, plus 5 clarification references throughout). **All gating
  assumptions hold.** No safe-skip narrowing required.

- [x] **Decision ID referenced before creation** — WP-031 references
  D-0001, D-0002, D-0102 only. All three exist (em-dash encoded per
  P6-2). No forward references to unwritten decisions. D-3101 (PS-1)
  and D-3102 (PS-2) will be created **before** session prompt
  generation so the EC/WP can reference them if desired.

- [x] **Decision ID search accounted for em-dash encoding** — grep
  used `D[-‑]0001|D[-‑]0002|D[-‑]0102` pattern with both regular
  hyphen and em-dash (U+2011) per P6-2. Matches at DECISIONS.md
  lines 21 (D‑0001), 29 (D‑0002), 55 (D‑0102) confirmed.

- [x] **Schema-engine alignment** — N/A. WP-031 does not touch
  JSON, Zod, or configuration schemas.

- [x] **Persistence classification** — N/A. WP-031 adds NO fields
  to `LegendaryGameState`. The session context line 8 confirms
  "LegendaryGameState UNCHANGED by WP-030 — no new fields, no shape
  change"; WP-031 continues that — invariant checks observe G,
  they do not extend it. No persistence-class decision needed.

- [x] **Functions the WP calls are exported** — `buildInitialGameState`
  exported from [setup/buildInitialGameState.ts](packages/game-engine/src/setup/buildInitialGameState.ts)
  (verified via `index.ts:24`). WP-031 does not need to import any
  non-exported helpers; invariant files only read `G` fields and
  constants.

- [x] **WP approach does not require forbidden imports** — All
  invariant check files under `src/invariants/` must NOT import
  `boardgame.io`. The only invariants file that interacts with
  framework context is `runAllChecks.ts`, which uses the local
  structural interface `InvariantCheckContext` (RS-2). The WIRING
  into `game.ts` imports `runAllInvariantChecks` from
  `./invariants/runAllChecks.js` — permitted because `game.ts` is
  already a framework-boundary file that imports `boardgame.io`.

- [x] **Projection aliasing** — N/A. `runAllInvariantChecks` returns
  `void`. No derived projections, no returned references to mutable
  `G` fields. Aliasing risk does not apply.

- [x] **Lifecycle wiring creep** — `src/invariants/` files must not
  be wired into moves or phase hooks. Only `game.ts` setup path
  (and optional move wrappers per PS-2) may call
  `runAllInvariantChecks`. Session prompt must prohibit wiring the
  individual check functions into any other lifecycle position.

- [x] **Move classification** — WP-031 does **not** add or rename
  any moves. `CoreMoveName` / `CORE_MOVE_NAMES` untouched. No
  domain-move gating changes.

No name, field, or signature in WP-031 text contradicts actual code
**except** the `runAllInvariantChecks` ctx parameter (RS-2), which is
resolved by local-structural-interface refinement. The refinement
must be back-synced to WP-031 §G text after execution per P6-8.

---

## Input Data Traceability Check

Answer **YES / NO** to each:

- [x] **YES** — All non-user-generated inputs consumed by this WP are
  listed in `docs/03.1-DATA-SOURCES.md` — **not applicable**. WP-031
  reads only from `G` (runtime state built at setup time from prior
  WPs' data flow). It introduces no new external inputs, no file
  reads, no registry queries, no DB access. Data sources are
  transitively covered by prior WPs.
- [x] **YES** — Storage location for each input is known: every
  structural/rule/lifecycle check reads `G` fields that already have
  documented origin in `ARCHITECTURE.md §MVP Gameplay Invariants`
  and prior WPs.
- [x] **YES** — Debugging path is clear: if a structural invariant
  fires, the category + message in `assertInvariant` identifies
  which `G` field and which WP-established invariant was violated.
- [x] **YES** — No implicit data. The check functions reference
  only constants imported from canonical files (`ENDGAME_CONDITIONS`,
  `MATCH_PHASES`, `TURN_STAGES`), never string literals.
- [x] **YES** — No setup-time derived fields introduced by this WP.
  `03.1-DATA-SOURCES.md` does not need an update for WP-031.

All YES. No blocking traceability risk.

---

## Structural Readiness Check (Types & Contracts)

Answer **YES / NO** to each:

- [x] **YES** — All prior WPs compile and tests pass: 348 tests, 93
  suites, 0 fail, build exits 0 (verified 2026-04-15).
- [x] **YES** — No known EC violations remain open. WP-030 closed
  cleanly (commit `94d947b` + lessons `42183b7`).
- [x] **YES** — Required types/contracts exist: `LegendaryGameState`,
  `CityZone`, `MATCH_PHASES`, `TURN_STAGES`, `ENDGAME_CONDITIONS`,
  `PlayerZones`, `CardExtId`, `MastermindState`, `HookDefinition`
  (all confirmed in §Dependency Contract Verification).
- [x] **YES** — No naming or ownership conflicts. `InvariantCategory`,
  `InvariantViolation`, `InvariantViolationError`, `InvariantCheckContext`,
  `assertInvariant`, `runAllInvariantChecks` are all net-new names
  in a brand-new directory. No symbol collisions.
- [x] **YES** — No architectural boundary conflicts anticipated.
  Invariant files are pure helpers within the engine layer,
  consuming only engine-internal types. See PS-1 for the formal
  code-category classification.
- [x] **YES** — Database/migrations: N/A.
- [x] **YES** — R2 data: N/A.
- [x] **YES** — WP reads only G fields that are verified present in
  `LegendaryGameState`. Every `G.<field>` accessed by a check
  function is already in types.ts (see §Dependency Contract
  Verification list of 19 fields).

All YES. Structural readiness satisfied.

---

## Runtime Readiness Check (Mutation & Framework)

Required for Runtime Wiring WPs. Answer **YES / NO**:

- [x] **YES** — Expected runtime touchpoints known: `game.ts`
  `setup()` return path (line 157), and optionally each entry in
  `LegendaryGame.moves` (lines 160-169, 10 moves). PS-2 decides
  whether move wrapping is in scope for this WP or deferred.
- [x] **YES** — Framework context requirements understood: setup
  receives boardgame.io `{ ctx, random, events, log }` (line 115 of
  game.ts signature); no `ctx.events.*` or `ctx.random.*` calls are
  needed by invariant checks themselves (invariants don't mutate).
  The wiring site passes phase/turn info into the local
  `InvariantCheckContext`.
- [x] **YES** — Existing test infrastructure can support required
  mocks without modifying locked helpers. `makeMockCtx` is used
  for building initial state in tests; lifecycle-check tests use
  plain object literals for `InvariantCheckContext` (WP-028
  precedent — tests do not modify `makeMockCtx`).
- [x] **YES** — 01.5 Runtime Wiring Allowance **IS INVOKED**. This
  WP triggers the allowance on three counts:
  1. **Adds orchestrator call after `Game.setup()` return** in
     `game.ts` (explicit 01.5 trigger — runtime wiring into
     `game.ts`)
  2. **Optionally wraps each move reference** in
     `LegendaryGame.moves` (conditional 01.5 trigger — runtime wiring
     into move lifecycle; gate depends on PS-2 decision)
  3. **Modifies `types.ts` re-exports** and **`index.ts` public
     API exports** — purely additive surface expansion, permitted
     under 01.5 §Scope. No existing re-exports renamed or removed.
  Session prompt must **explicitly cite 01.5** and enumerate the
  exact files and structural edits, following the inverse of
  WP-030's "01.5 NOT INVOKED" declaration. The enumeration is:
  - `game.ts` — add invariant import, capture setup return into
    local variable, call `runAllInvariantChecks`, return variable
  - `game.ts` — (conditional on PS-2 Option A) add
    `withInvariantChecks` wrapper function used at each move
    entry in `moves: {...}` map
  - `types.ts` — add `export type` entries for
    `InvariantCategory`, `InvariantViolation`,
    `InvariantCheckContext` (purely additive)
  - `index.ts` — add `export` entries for `assertInvariant`,
    `runAllInvariantChecks`, `InvariantViolationError`, and
    individual check functions (purely additive)
- [x] **YES** — No architecture boundary violations. Engine-only
  work. No server, no UI, no registry, no pre-plan.
- [x] **YES** — Integration point read: `game.ts` setup (line 123)
  and moves map (line 160) inspected above. Setup's return site
  is a single expression on line 157; wrapping it in a `const
  initialState = ...; runAllInvariantChecks(...); return
  initialState;` pattern is trivial and localized. Move wrapping
  (Option A) would add one function definition and edit each of
  the 10 move references.
- [x] **YES** — Stage gating requirements: N/A. Invariant checks do
  not add any new move or hook that requires stage gating.
- [x] **YES** — Multi-step mutation ordering: N/A. Check functions
  do not mutate `G`.
- [x] **YES** — Registry boundary: invariant files NEVER query the
  registry. Check functions operate only on `G` fields. Session
  prompt must reinforce this with an explicit `// why:` comment on
  the directory's purpose.
- [x] **YES** — Phase transition ordering (observability flags
  before setPhase): N/A. No phase transitions modified.
- [x] **YES** — Simultaneous/conflicting condition evaluation
  order: `runAllChecks.ts` must order structural → gameRules →
  determinism → (security when it exists) → lifecycle and **fail
  fast on first violation** (EC §Required // why comments line 4).
  The fixed order prevents "which violation fired first?"
  ambiguity. Session prompt must lock this order.
- [x] **YES** — Degradation path for unknown types: N/A.
  Invariant checks fail fast — that **is** the degradation
  strategy per D-0102. Unknown counter keys are handled by the
  "documented custom" semantics in `checkCountersUseConstants`
  (see §Dependency Contract Verification).
- [x] **YES** — Move functions called outside framework context:
  N/A. Invariant checks do not invoke moves.
- [x] **YES** — Mock/PRNG capability assumption: N/A. Invariant
  tests do not require PRNG. `makeMockCtx` is used only to build
  initial `G`; `InvariantCheckContext` is a plain object literal.

All YES. Runtime readiness satisfied. **01.5 IS INVOKED** — session
prompt must enumerate the wiring per the list above and cite 01.5
§Scope + §Escalation explicitly.

---

## Maintainability & Upgrade Readiness (Senior Review)

Required for Runtime Wiring WPs. Answer **YES / NO**:

- [x] **YES — Extension seam exists:** `InvariantCategory` is a 5-value
  string union (`structural`, `gameRules`, `determinism`, `security`,
  `lifecycle`). Adding a new check file under an existing category
  (e.g., a second `structural.*.checks.ts`) requires only a new
  `import` + new call inside `runAllInvariantChecks`. Adding a new
  category (not expected) requires updating the union, the
  `runAllChecks` orchestrator, and introducing the category's check
  file — three files, no cross-cutting refactor. WP-031 explicitly
  defers Security/Visibility checks; the category slot is reserved
  and the extension seam is already in place — the 5th category file
  can be added by a future WP without refactoring.
- [x] **YES — Patch locality:** a bug in a single invariant is
  confined to one check function in one file (e.g.,
  `checkNoCardInMultipleZones` lives in `gameRules.checks.ts`).
  No cross-cutting edits to fix a single invariant. Adding a new
  `// why:` comment or tightening a condition touches one file.
- [x] **YES — Fail-safe behavior:** structural corruption causes
  immediate `assertInvariant` throw — this IS the fail-safe.
  Gameplay conditions (insufficient attack, empty pile) remain
  safe no-ops per D-0102 clarification and WP §Out of Scope. Tests
  9 and 10 lock this contract at execution time. No partial
  mutation because checks never mutate.
- [x] **YES — Deterministic reconstructability:** all checks are
  pure functions of `G`. Given identical `G`, checks produce
  identical outcome (throw or pass). No logging, no side effects,
  no hidden state. The `InvariantViolationError` message contains
  category + description, sufficient to reconstruct the failure
  from post-execution state inspection. Aligns with
  ARCHITECTURE.md "Debuggability & Diagnostics" invariant.
- [x] **YES — Backward-compatible test surface:** existing 348
  tests that build `G` via `buildInitialGameState` produce valid
  states — `runAllInvariantChecks` called after setup will pass.
  Tests that construct partial/handcrafted `G` states bypass
  `game.ts` setup entirely and do NOT trigger the new checks
  (they call check functions directly or skip them). PS-2
  recommendation for **setup-only wiring** specifically protects
  the 348-test baseline against ripple: no existing test flows
  through per-move invariant checks.
- [x] **YES — Semantic naming stability:** `InvariantCategory`,
  `assertInvariant`, `runAllInvariantChecks`, `InvariantViolation`,
  `InvariantViolationError` are semantically stable names. No
  `V1`, `Simple`, `Temp`, or `Inline` encoded into symbols. The
  category union values are nouns (not verbs), stable across
  future extensions.

All YES. No maintainability concerns. The design is well-suited to
incremental extension (adding Security category later, tightening
existing checks, adding new structural checks).

---

## Code Category Boundary Check

- [x] New files land in `packages/game-engine/src/invariants/` —
  a **new directory** not currently classified in
  `02-CODE-CATEGORIES.md` and not yet in DECISIONS.md.
  **Blocking finding PS-1** (resolved before session prompt
  generation): create D-3101 classifying `src/invariants/` as
  engine code category following D-2706 (replay), D-2801 (ui),
  and D-3001 (campaign) template verbatim.
- [x] Each file's category (once D-3101 exists) permits the imports
  used. Engine category allows: Node built-ins (`node:test`,
  `node:assert`), engine-internal types, Zod (not needed here),
  no `boardgame.io`, no registry, no pg. Invariant files will
  import only `LegendaryGameState`, constant canonical arrays,
  and category-specific helpers from within `src/invariants/`.
- [x] `game.ts` modification is within the existing
  framework-boundary file category. Already imports `boardgame.io`
  types. Adding an invariant import from `./invariants/runAllChecks.js`
  does not violate any boundary.
- [x] `types.ts` and `index.ts` re-exports are purely additive and
  remain within their existing category.

**Blocking pre-session action PS-1 required.** Resolution format:

> ```markdown
> ### D‑3101 — Invariants Directory Classified as Engine Code Category
>
> **Decision:** `packages/game-engine/src/invariants/` is classified
> under the `engine` code category.
> **Rationale:** Invariant files are pure, deterministic, have no I/O,
> and do not import `boardgame.io` or registry packages. They define
> data-only contracts (`InvariantCategory`, `InvariantViolation`,
> `InvariantViolationError`, `InvariantCheckContext`) and pure check
> functions that read `G` and either `assertInvariant` or return
> void. They follow all engine category rules. The invariants
> directory extends the engine's correctness-guarantee capability
> without introducing new categories or blurring existing boundaries.
> This follows the precedent established by D-2706 (replay),
> D-2801 (ui), and D-3001 (campaign) for new engine subdirectories
> that host pure, non-lifecycle code. Runtime wiring into `game.ts`
> is permitted because `game.ts` is the framework-boundary file and
> already imports `boardgame.io`.
> **Introduced:** WP-031
> **Status:** Immutable
> ```

---

## Scope Lock (Critical)

### WP-031 Is Allowed To

**New files** (all under `packages/game-engine/src/invariants/`):
- Create `invariants.types.ts` — `InvariantCategory` union,
  `InvariantViolation` interface, `InvariantCheckContext` local
  structural interface (per RS-2), and **canonical
  `INVARIANT_CATEGORIES: readonly InvariantCategory[]` array**
  matching the union exactly in order (per copilot check Finding
  #4 — follows `MATCH_PHASES` / `TURN_STAGES` / `REVEALED_CARD_TYPES` /
  `BOARD_KEYWORDS` / `SCHEME_SETUP_TYPES` / `PERSISTENCE_CLASSES`
  drift-detection precedent)
- Create `assertInvariant.ts` — `assertInvariant()` utility +
  `InvariantViolationError` class (companion type authorized here)
- Create `structural.checks.ts` — `checkCitySize`,
  `checkZoneArrayTypes`, `checkCountersAreFinite`,
  `checkGIsSerializable`
- Create `gameRules.checks.ts` — `checkNoCardInMultipleZones`,
  `checkZoneCountsNonNegative`, `checkCountersUseConstants`
- Create `determinism.checks.ts` — `checkNoFunctionsInG`,
  `checkSerializationRoundtrip`
- Create `lifecycle.checks.ts` — `checkValidPhase`, `checkValidStage`,
  `checkTurnCounterMonotonic`
- Create `runAllChecks.ts` — `runAllInvariantChecks(G,
  invariantCheckContext)` orchestrator using the local structural
  interface (NOT `boardgame.io` `Ctx`)
- Create `invariants.test.ts` — exactly 10 tests per WP-031 §K

**Modify** (existing files, purely additive edits under 01.5):
- `src/game.ts` — import `runAllInvariantChecks`, wrap setup return,
  and (Option A only) wrap each move reference with
  `withInvariantChecks`. No other changes.
- `src/types.ts` — add `export type { InvariantCategory,
  InvariantViolation, InvariantCheckContext } from
  './invariants/invariants.types.js';` AND
  `export { INVARIANT_CATEGORIES } from
  './invariants/invariants.types.js';` (purely additive —
  the canonical array is a const export, not a type export).
- `src/index.ts` — add the following exports (purely additive):
  `assertInvariant`, `InvariantViolationError`,
  `runAllInvariantChecks`, all category check functions,
  `InvariantCategory`, `InvariantViolation`,
  `InvariantCheckContext`, **`INVARIANT_CATEGORIES`**
  (canonical array).

**Governance updates:**
- Update `docs/ai/STATUS.md` per WP §Definition of Done
- Update `docs/ai/DECISIONS.md` with D-3101 (PS-1) and D-3102 (PS-2)
- Update `docs/ai/work-packets/WORK_INDEX.md` — check off WP-031
  with today's date

### WP-031 Is Explicitly Not Allowed To

- Modify any prior WP contract file (`matchSetup.types.ts`,
  `zones.types.ts`, `turnPhases.types.ts`, `coreMoves.types.ts`,
  `ruleHooks.types.ts`, `endgame.types.ts`, `city.types.ts`,
  `economy.types.ts`, `heroAbility.types.ts`, `boardKeywords.types.ts`,
  `schemeSetup.types.ts`, `replay.types.ts`, `uiState.types.ts`,
  `campaign.types.ts`)
- Modify the 10 existing move implementation files (`coreMoves.impl.ts`,
  `fightVillain.ts`, `recruitHero.ts`, `fightMastermind.ts`,
  `villainDeck.reveal.ts`, `lobby.moves.ts`). Move wrapping under
  PS-2 Option A happens in `game.ts` ONLY — the underlying impls
  are untouched.
- Modify `makeMockCtx` or any other shared test helper
- Add new moves to `CoreMoveName` / `CORE_MOVE_NAMES`
- Add new phases to `MATCH_PHASES` or stages to `TURN_STAGES`
- Add new endgame conditions to `ENDGAME_CONDITIONS`
- Add any runtime registry access (setup-time only, and even then
  invariant files don't access the registry at all)
- Use `Math.random()` (checks involve zero randomness)
- Use `.reduce()` in any check logic (EC Guardrail + Rule 8)
- Import `boardgame.io` in any file under `src/invariants/`
  (EC verification step 3 must emit no output)
- Mutate `G` inside any check function (purity invariant)
- Use terse/single-word error messages in `assertInvariant` calls
  (Rule 11 — must be full sentences identifying what failed and where)
- Flag gameplay conditions (insufficient attack, empty pile, no
  valid target) as invariant violations (EC Guardrails + Tests 9/10)
- Wire any individual check function into moves or phase hooks
  (only `runAllInvariantChecks` may be wired, and only from `game.ts`)
- Add Security/Visibility invariant checks (WP §Out of Scope —
  deferred to a future WP)
- Change existing test assertions in the 348-test baseline. New
  tests go in `invariants.test.ts` ONLY.
- Touch untracked files outside WP-031 scope (e.g., the pre-
  existing `session-context-wp029.md`, license/one-pager docs —
  exclude explicitly at commit time per P6-13 "mystery untracked
  file" pattern)

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **New tests:** exactly **10 tests** in
  `packages/game-engine/src/invariants/invariants.test.ts` per
  WP-031 §K. Test enumeration (locked):
  1. **Canonical `INVARIANT_CATEGORIES` array matches
     `InvariantCategory` union (drift-detection pre-assertion via
     `assert.deepStrictEqual(INVARIANT_CATEGORIES, ['structural',
     'gameRules', 'determinism', 'security', 'lifecycle'])`) AND
     valid `G` passes all invariant checks (no throw)** — combined
     contract test per copilot check Finding #4. Drift-detection
     assertion runs first; check-runner call runs second. Test
     count stays at 10.
  2. Card in two zones simultaneously throws with `'gameRules'` category
  3. Function stored in `G` throws with `'determinism'` category
  4. Non-finite counter value throws with `'structural'` category
  5. Invalid phase name throws with `'lifecycle'` category
  6. `assertInvariant(true, ...)` does not throw
  7. `assertInvariant(false, ...)` throws with full-sentence message
  8. Serialization roundtrip passes for valid `G`
  9. Insufficient attack points does NOT trigger any invariant (gameplay
     condition, not structural violation)
  10. Empty wounds pile does NOT trigger any invariant

- **Existing test changes:** expected **none** if PS-2 resolves to
  setup-only wiring. If PS-2 resolves to per-move wiring in
  production mode, **any breakage must be diagnosed case-by-case**,
  not silently updated. No value-only assertion updates are
  authorized under 01.5 for this WP. If an existing test flows
  through `game.ts` setup AND asserts a value that the new
  invariant check invalidates, the executing agent must STOP and
  escalate — do not force-fit by weakening the invariant.

- **Prior test baseline:** **348 tests, 93 suites, 0 fail** must
  continue to pass. Expected after WP-031: **358 tests (+10),
  94 suites (+1 for the new `invariants.test.ts`), 0 fail**.

- **Test boundaries:**
  - No `boardgame.io` imports in `invariants.test.ts`
  - No `boardgame.io/testing` imports
  - No modifications to `makeMockCtx` or other shared helpers
  - Tests use `node:test` + `node:assert` only
  - `.test.ts` extension (never `.test.mjs`)
  - Tests 9 and 10 are **contract enforcement tests** per WP-028
    precedent — they must not be weakened if they fail. If they
    fail, the invariant definition is wrong and the check function
    must be corrected.

- **Defensive guards:** `runAllInvariantChecks` wiring in setup
  operates on `G` returned by `buildInitialGameState`, which already
  satisfies every WP-007A through WP-026 invariant. Existing
  tests never see the check functions unless they explicitly go
  through setup. For tests that call `buildInitialGameState`
  directly (pre-game.ts setup path), the invariant wiring is
  inert — they do not trigger it.

**Rule:** Test expectations are locked. Any deviation must be
documented in the execution summary and justified in the
pre-commit review.

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

### RS-1 — `src/invariants/` not classified in DECISIONS.md (BLOCKING, PS-1)

- **Risk / ambiguity:** Creating files in a new engine subdirectory
  that has no code-category classification.
- **Impact:** HIGH (blocking pre-flight finding per 01.4 §Code
  Category Boundary Check; same pattern as WP-027/028/030).
- **Mitigation:** Create D‑3101 in DECISIONS.md **before** session
  prompt generation, following the D-2706 / D-2801 / D-3001
  template verbatim. Template provided in §Code Category Boundary
  Check above.
- **Decision / pattern to follow:** Resolve as **PS-1** pre-session
  action. No pre-flight re-run required once D-3101 is written —
  this is a documentation resolution, not a scope change. Matches
  WP-030 PS-1 workflow exactly (WP-030 resolved D-3001 identically
  pre-session).

### RS-2 — `runAllInvariantChecks(G, ctx: Ctx)` signature drifts from no-boardgame.io rule (LOCK)

- **Risk / ambiguity:** WP-031 §G specifies
  `runAllInvariantChecks(G: LegendaryGameState, ctx: Ctx): void`.
  `Ctx` is a `boardgame.io` type. Importing it into `runAllChecks.ts`
  violates EC-031 verification step 3 and the engine boundary rule
  that `src/invariants/*` files must not import `boardgame.io`.
- **Impact:** HIGH (would fail EC verification step 3 at execution
  time, producing a post-hoc drift discovery).
- **Mitigation:** Lock the refinement here. Define a local structural
  interface in `invariants.types.ts`:

  ```ts
  /**
   * Local subset of framework context fields read by lifecycle
   * invariant checks. Defined here to avoid importing boardgame.io
   * into pure helper files. Populated from the real Ctx at the
   * wiring site in game.ts.
   *
   * Mark fields readonly and do not widen beyond what
   * lifecycle checks actually read. Follows WP-028 UIBuildContext
   * precedent (D-2801).
   */
  export interface InvariantCheckContext {
    readonly phase?: string;
    readonly turn?: number;
  }
  ```

  `runAllInvariantChecks` signature becomes
  `(G: LegendaryGameState, invariantContext: InvariantCheckContext): void`.
  Tests pass plain object literals
  `{ phase: 'play', turn: 1 }` — no `boardgame.io` import needed.
  Wiring site in `game.ts` constructs the literal from framework
  ctx at each call point.
- **Decision / pattern to follow:** **Refinement locked.** Session
  prompt uses the local structural interface. **WP-031 §G text
  must be back-synced post-execution** per P6-8 — add a line to
  the "Authorized Next Step" section noting the back-sync is
  required before post-mortem close.

### RS-3 — Move lifecycle wiring scope (BLOCKING, PS-2)

- **Risk / ambiguity:** WP-031 §H says invariant checks run "after
  Game.setup() completes" (mandatory) AND "optionally after each
  move (configurable — may be dev/test only for performance)"
  (deferred decision). WP §Definition of Done line 11 requires
  documenting the decision in DECISIONS.md. The decision must be
  made **before** session prompt generation so the scope lock is
  unambiguous.
- **Impact:** HIGH (execution-time ambiguity: without a locked
  choice, the executing agent might wire 10 moves AND invalidate
  existing tests, OR omit wiring entirely and ship an incomplete
  DoD).
- **Mitigation — Option A (per-move wiring, production-on):** Add
  a `withInvariantChecks(move)` wrapper in `game.ts` that calls
  `runAllInvariantChecks` after each move executes. Apply to all
  10 moves. **Cost:** every existing test that flows through a
  move runs invariant checks, risking test breakage if any test
  constructs partial `G` states. Locks most correctness value but
  highest ripple risk.
- **Mitigation — Option B (setup-only wiring, production-on) —
  **RECOMMENDED****: Wire `runAllInvariantChecks` ONLY at the
  setup return path in `game.ts`. Move lifecycle wiring is
  **deferred** to a follow-up WP. All 4 implemented categories
  (structural, gameRules, determinism, lifecycle) fire on initial
  state, which is the most bug-prone surface for WP-001 through
  WP-026 setup construction. Tests 9/10 verify gameplay-condition
  no-op via direct function calls — no per-move wiring needed.
  **Cost:** narrower runtime coverage than Option A.
  **Benefit:** zero ripple risk on the 348-test baseline,
  unambiguous scope, satisfies EC §After Completing bullet 3
  (gameplay conditions confirmed not flagged) via direct unit
  tests without needing runtime checks.
- **Mitigation — Option C (dev/test-gated per-move wiring):** Like
  Option A but gated behind `process.env.NODE_ENV !== 'production'`
  or a module-level `ENABLE_RUNTIME_INVARIANTS` flag defaulting to
  false. **Cost:** introduces environment coupling to `game.ts`,
  which conflicts with engine purity (engine should not read
  `process.env`). Would require a module-level `const` set once at
  startup by the server layer — ugly but viable.
- **Decision / pattern to follow — LOCK OPTION B (setup-only)**.
  Rationale: Options A and C both risk polluting the 348-test
  baseline or introducing environment coupling. Option B satisfies
  the WP's mandatory wiring requirement, unlocks the 4 implemented
  categories on the setup pathway (the highest-value observation
  point for MVP invariants), and leaves a clean extension seam for
  a future WP to add per-move wiring once the trade-off is re-
  evaluated. **Resolve as PS-2**: before session prompt generation,
  create **D‑3102** in DECISIONS.md documenting:
  1. Runtime wiring runs in `Game.setup()` return path only (Option B)
  2. Per-move wiring is deferred to a follow-up WP
  3. Gameplay conditions (insufficient attack, empty pile) are
     excluded from invariant checking per D-0102 clarification —
     they remain safe no-ops at move return
  4. The decision rationale: preserve existing-test compatibility,
     keep engine environment-independent, defer performance
     trade-off to follow-up WP

### RS-4 — `checkCountersUseConstants` over-rejection risk (MEDIUM)

- **Risk / ambiguity:** WP-031 §D `checkCountersUseConstants(G)`
  could strictly require every key in `G.counters` to be an
  `ENDGAME_CONDITIONS` value. But runtime hooks may legitimately
  introduce documented custom counter keys (e.g., scheme-specific
  counters). A strict check would false-positive.
- **Impact:** MEDIUM (would fire structural invariant on valid
  runtime state, corrupting the baseline).
- **Mitigation:** EC §Game Rules bullet 3 already says "all counter
  keys are valid `ENDGAME_CONDITIONS` values **or documented
  custom keys**". Session prompt must lock this as: the check
  accepts any key that is (a) a value in `Object.values(ENDGAME_CONDITIONS)`
  OR (b) any string — meaning the check validates **value
  finiteness** (already covered by `checkCountersAreFinite` in
  §C) and **counter-map shape** (already a `Record<string, number>`
  from types.ts), not key membership. If key-membership validation
  is actually intended, document the whitelist of allowed custom
  keys explicitly in a `// why:` comment. **Recommendation:**
  narrow `checkCountersUseConstants` to assert "every value is a
  finite number and every key is non-empty string" — the stricter
  `ENDGAME_CONDITIONS` membership is better suited to a future WP
  when the canonical custom-key list is written. Session prompt
  locks this narrower scope.
- **Decision / pattern to follow:** Lock the narrower check: keys
  are non-empty strings, values are finite. Full canonical-key
  enforcement deferred. Add `// why:` comment explaining the
  deferral and citing the WP-023 precedent (safe-skip for data
  gaps).

### RS-5 — `assertInvariant` throws = exception to "moves never throw" (LOCK)

- **Risk / ambiguity:** `.claude/rules/game-engine.md §Throwing
  Convention` says "Moves return void, never throw". WP-031's
  `assertInvariant` throws. If wired into moves (Option A/C),
  this creates an apparent conflict.
- **Impact:** MEDIUM (could be misread as a rule violation
  pre-commit review finding if the exception is not explicitly
  documented in the session prompt).
- **Mitigation:** PS-2 resolves to setup-only wiring (Option B),
  which avoids the conflict entirely — no move code path throws.
  The `assertInvariant` throw at setup time is already covered
  by the existing exception: `Game.setup()` may throw
  (`.claude/rules/game-engine.md §Throwing Convention` row 1).
  Session prompt must explicitly state this: "assertInvariant is
  called from `runAllInvariantChecks`, which is called from
  `game.ts` setup return — this is within the `Game.setup()`
  throw-allowed context per the Throwing Convention table".
- **Decision / pattern to follow:** Setup-only wiring (Option B /
  PS-2) makes this a non-issue. No new rule exception is needed.
  The D-0102 clarification and the existing setup-throw exception
  cover the case. If a future WP adds per-move wiring, that WP
  must introduce the "invariant violation inside a move" exception
  explicitly.

### RS-6 — Mystery untracked files (pre-existing, LOW)

- **Risk / ambiguity:** `git status` shows pre-existing untracked
  files not related to WP-031:
  `docs/ai/session-context/session-context-wp029.md`,
  `docs/legendary-arena-license-letter.{docx,md}`,
  `docs/legendary-arena-one-pager.{docx,md}`,
  `docs/upper-deck-licensing-contacts.md`, plus `.claude/settings.local.json`
  is modified.
- **Impact:** LOW (not caused by WP-031 work; matches P6-13
  "mystery untracked file appearance" pattern).
- **Mitigation:** Flag in execution summary, do not stage,
  explicitly exclude from WP-031 commits. Do not investigate
  provenance during the WP session. Use `git add -- <specific
  files>` at commit time instead of `git add -A` or `git add .`.
- **Decision / pattern to follow:** Document in session prompt
  "Out of scope — do not touch" list. Standard P6-13 handling.

### RS-7 — `checkGIsSerializable` vs `checkSerializationRoundtrip` overlap (LOW)

- **Risk / ambiguity:** WP-031 §C has `checkGIsSerializable(G)`
  (structural) and §E has `checkSerializationRoundtrip(G)`
  (determinism). These sound identical.
- **Impact:** LOW (non-overlapping-category invariant could be
  violated by accident).
- **Mitigation:** Session prompt must lock the distinction:
  - `checkGIsSerializable` (structural): asserts
    `JSON.parse(JSON.stringify(G))` does not throw.
    Detects `undefined`/cycles/unsupported types.
  - `checkSerializationRoundtrip` (determinism): asserts that
    after a roundtrip, the parsed object is **structurally equal**
    to the original (deep equality). Detects lossy serialization.
  These are distinct: structural validates the operation
  succeeds; determinism validates it is identity-preserving.
- **Decision / pattern to follow:** Session prompt enumerates the
  two distinct assertions. Each gets a `// why:` comment
  explaining what the check catches and why it belongs to its
  category. Add to EC common-failure-smells watch list.

### RS-8 — Existing test breakage from setup-only wiring (LOW under Option B)

- **Risk / ambiguity:** Even setup-only wiring runs after every
  `Game.setup()` call. If any existing test constructs an
  intentionally-invalid-but-tolerated `G` via `buildInitialGameState`
  that the new checks flag, that test will break.
- **Impact:** LOW (under Option B only; `buildInitialGameState`
  tests so far all produce valid G states per WP-005B/006B/014B
  test patterns).
- **Mitigation:** If a test breakage appears, the executing agent
  must diagnose root cause before weakening the check. Session
  prompt must say: "If an existing test breaks on the setup-path
  invariant check, STOP and escalate. Do not weaken the check. Do
  not modify the test to bypass checks. Report the conflict in
  the execution summary for human review."
- **Decision / pattern to follow:** Session prompt includes
  explicit "diagnose don't force-fit" instruction. Matches the
  WP-028 "contract enforcement test" pattern.

---

### RS-9 — `checkNoCardInMultipleZones` semantics conflict with fungible CardExtIds (BLOCKING, mid-execution discovery, PS-3)

- **Discovered:** 2026-04-15 mid-execution. The executing agent halted
  at implementation task §D before writing any code and escalated
  per the session prompt's "STOP and escalate when the check cannot
  be confidently classified" rule.
- **Risk / ambiguity:** The original WP-031 §D item 1 specifies
  `checkNoCardInMultipleZones(G)` as "no CardExtId appears in more
  than one zone simultaneously" and instructs the implementer to
  build a `Set<CardExtId>` and flag any second occurrence. This is
  incompatible with the actual engine state:
  - `packages/game-engine/src/setup/buildInitialGameState.ts:79`
    pushes 8 copies of `'starting-shield-agent'` and 4 copies of
    `'starting-shield-trooper'` into every player's deck.
  - `packages/game-engine/src/setup/pilesInit.ts` `createPileCards`
    fills `G.piles.bystanders` with N copies of `'pile-bystander'`,
    `G.piles.wounds` with N copies of `'pile-wound'`, and similarly
    for officers and sidekicks.
  - Running the literal check on `buildInitialGameState`'s output
    would throw `InvariantViolationError` on the first pile entry
    and fail every test that routes through `LegendaryGame.setup()`,
    regressing the 348-test baseline.
  - `CardExtId` is a card-**type** identifier, not a per-instance
    identifier. The MVP engine's fungible-token design (D-2601
    Representation Before Execution, combined with the pile-builder
    shortcut) trades per-instance uniqueness for setup simplicity.
- **Impact:** HIGH — blocking. The original spec cannot be
  implemented as written.
- **Mitigation — Option 1 (fungible-exclusion cross-zone check) — CHOSEN:**
  Amend the check to skip the six known fungible token strings and
  flag only non-fungible CardExtIds that appear in two **distinct**
  zones. See Amendment A-031-01 in WP-031 and D-3103 for the locked
  semantics and the fungible set. Narrower than the original spec
  but sound against the current engine; preserves the 348-test
  baseline; leaves a clean extension seam for a future per-instance
  refactor.
- **Mitigation — Option 2 (drop the check from WP-031):** rejected
  because it removes real correctness coverage (cross-zone non-
  fungible duplication is a real bug class).
- **Mitigation — Option 3 (per-instance CardExtId refactor):**
  rejected because it is massively out of scope — requires
  rewriting `buildStartingDeckCards`, `createPileCards`, every
  zoneOp and test fixture that references token IDs, and inflates
  snapshot state ~10× on the pile zones.
- **Decision / pattern to follow:** Resolve as **PS-3**
  (mid-execution pre-session action, 2026-04-15). User-authorized
  Option 1 via WP-031 spec amendment + new DECISIONS.md entry
  D-3103. Execution may resume after:
  - WP-031 §D item 1 amended (see Amendment A-031-01 in the WP)
  - D-3103 written in DECISIONS.md (see above)
  - Pre-flight (this document) re-confirmed with this RS-9 entry
  - Copilot check re-confirmed with Finding #31 (new) marked PASS
- **Session prompt impact:** The executor must use the amended
  check semantics for §D item 1 implementation (fungible exclusion,
  `Map<CardExtId, zoneName>` cross-zone tracking, deterministic
  zone scan order per Amendment A-031-01 items 2 and 3). The test
  injection in §K Test 2 must inject a **non-fungible** synthetic
  CardExtId into two distinct zones (e.g., `G.villainDeck.deck`
  and `G.city[0]`) — using a fungible token string will not
  trigger the check and fails the test intent.

### RS-10 — `PlayerZones.victoryPile` field name drift (LOW, mid-execution discovery)

- **Discovered:** 2026-04-15 mid-execution, during the same halt
  that surfaced RS-9.
- **Risk / ambiguity:** WP-031 §C item 2 (`checkZoneArrayTypes`)
  and §D item 1 (`checkNoCardInMultipleZones`) list the zones to
  scan as `deck, hand, discard, inPlay, victoryPile`. The canonical
  `PlayerZones` interface in
  `packages/game-engine/src/state/zones.types.ts:49` declares
  `victory: Zone` — there is no `victoryPile` field. The
  `victoryPile` spelling is a WP drafting typo and would produce a
  runtime `undefined` in place of an array, spuriously failing
  `checkZoneArrayTypes` on every valid G.
- **Impact:** LOW (obvious typo; caught by build and test if the
  check references a non-existent field), but would block execution
  if followed literally.
- **Mitigation:** Amendment A-031-02 locks the canonical field name
  as `victory` across all WP-031 check spec locations and tests.
  Pre-flight §Scope Lock inherits the correction.
- **Decision / pattern to follow:** Resolved via WP spec amendment.
  No DECISIONS.md entry required — this is a drafting correction,
  not an architectural decision. Executor must use `victory` in
  `checkZoneArrayTypes`, `checkNoCardInMultipleZones`, and any
  tests that enumerate player zones. Session prompt's §Implementation
  Task C item 2 and §Implementation Task D item 1 must be read
  through the lens of A-031-02.

### RS-11 — `InvariantCheckContext` fields vs `exactOptionalPropertyTypes` (LOW, mid-execution discovery)

- **Discovered:** 2026-04-15 mid-execution, during the same halt
  that surfaced RS-9.
- **Risk / ambiguity:** `packages/game-engine/tsconfig.json` has
  `exactOptionalPropertyTypes: true`. `InvariantCheckContext`
  declares `readonly phase?: string` and `readonly turn?: number`.
  At the wiring site, `context.ctx.phase` is typed as `string` and
  `context.ctx.turn` as `number` by the boardgame.io `Ctx`, so the
  literal `{ phase: context.ctx.phase, turn: context.ctx.turn }`
  type-checks cleanly. At runtime, however, mock contexts (via
  `makeMockCtx` + cast in tests like `game.test.ts`) do not set
  `phase` or `turn`, so the check functions may receive `undefined`
  at runtime despite the compiler believing otherwise.
- **Impact:** LOW. TypeScript-level compatibility is fine; the only
  requirement is that the lifecycle check functions handle the
  runtime-undefined case gracefully.
- **Mitigation:** Amendment A-031-03 locks the parameter types on
  `checkValidPhase` and `checkTurnCounterMonotonic` as
  `string | undefined` / `number | undefined` (not `string` /
  `number`), and requires each function to short-circuit with a
  `// why:` comment when the field is `undefined`. No change to
  `InvariantCheckContext` itself. No change to the wiring-site
  literal.
- **Decision / pattern to follow:** Resolved via WP spec
  amendment. No DECISIONS.md entry required. Executor implements
  `checkValidPhase` and `checkTurnCounterMonotonic` with
  `| undefined` parameter types and runtime short-circuits.

---

## Pre-Flight Verdict (Binary)

**READY TO EXECUTE — conditional on pre-session actions PS-1, PS-2, and PS-3.**

PS-3 resolution: D-3103 written 2026-04-15, WP-031 §Amendments
A-031-01/02/03 locked, RS-9/10/11 added to this pre-flight. No
re-run required beyond this in-place update. The fungible-exclusion
amendment is scope-neutral in the sense that it does not change the
WP-031 file list, test count (still +10), wiring decision (still
D-3102 Option B setup-only), or category taxonomy (still 5
categories). It narrows the semantics of one check function
(`checkNoCardInMultipleZones`) and the parameter types of two
lifecycle check functions (`checkValidPhase`,
`checkTurnCounterMonotonic`) without adding or removing any file.

**Original READY TO EXECUTE verdict follows:**

WP-031 is properly sequenced (WP-029 and WP-030 complete), has full
contract fidelity against actual engine source files, and has a clear
scope lock with a well-defined extension seam. All 18 Dependency
Contract Verification items pass. The structural and runtime readiness
checks return all YES. Maintainability review shows the design is
stable, patch-local, and extension-friendly. The only outstanding
items are two pre-session documentation actions (D-3101 for directory
classification, D-3102 for runtime wiring decision) and one locked
design refinement (RS-2 local structural interface instead of
`boardgame.io` `Ctx`). Neither pre-session action changes WP scope —
both are audit-trail requirements codified by 01.4 lessons learned
from WP-027/028/030. The session prompt may be generated after PS-1
and PS-2 are resolved. No re-run of pre-flight is required once PS-1
and PS-2 are written.

---

## Invocation Prompt Conformance Check (Pre-Generation)

To be verified when the session prompt is drafted (step 2):

- [ ] All EC-031 locked values copied verbatim (5 invariant categories,
  `InvariantCategory` union, `assertInvariant` signature)
- [ ] No new keywords, helpers, file paths, or timing rules appear
  only in the prompt
- [ ] File paths in the prompt match WP-031 §Files Expected to Change
  exactly (plus the RS-2 refinement for `InvariantCheckContext` in
  `invariants.types.ts`)
- [ ] No forbidden imports introduced (no `boardgame.io` in
  `src/invariants/**`, no `.reduce()` in check logic)
- [ ] Ambiguities resolved here (RS-1 through RS-8) are NOT
  re-debated by the prompt
- [ ] `runAllInvariantChecks` signature uses
  `InvariantCheckContext` (RS-2 lock)
- [ ] `checkCountersUseConstants` narrowed per RS-4
- [ ] `checkGIsSerializable` vs `checkSerializationRoundtrip`
  distinction documented per RS-7
- [ ] Option B (setup-only wiring) enforced per RS-3 / PS-2
- [ ] 01.5 IS INVOKED declaration explicit, with enumerated file edits
- [ ] Mystery untracked files excluded from commits per RS-6
- [ ] `assertInvariant` throw exception cited to `Game.setup()` throw
  column per RS-5
- [ ] `InvariantViolationError` companion type authorized per
  §Dependency Contract Verification last item
- [ ] **Deterministic iteration lock (copilot FIX #23):** every check
  function that scans a `Record<string, …>` and may throw on a
  specific key uses `Object.keys(record).sort()` (or equivalent
  explicit sort) before applying check logic. Each sort site has a
  `// why:` comment: "deterministic error reproducibility — fail-fast
  must identify the same offending key on every run". Applies to
  `checkZoneArrayTypes`, `checkCountersAreFinite`,
  `checkCountersUseConstants`, `checkNoCardInMultipleZones`,
  `checkZoneCountsNonNegative`, `checkNoFunctionsInG`.
- [ ] **Canonical `INVARIANT_CATEGORIES` array (copilot FIX #4):**
  `invariants.types.ts` exports `INVARIANT_CATEGORIES: readonly
  InvariantCategory[]` in the exact order of the union; `types.ts`
  and `index.ts` re-export the const; Test 1 is the combined
  drift-detection + valid-G test per the updated test enumeration
  above.

---

## Authorized Next Step

**You are authorized to generate a session execution prompt for WP-031**
to be saved as:
`docs/ai/invocations/session-wp031-production-hardening.md`

**Guard:** The session prompt must conform exactly to the scope,
constraints, refinements, and decisions locked by this pre-flight. No
new scope may be introduced. Specifically:

- RS-1 resolution (D-3101) must be in place in DECISIONS.md
- RS-3 resolution (D-3102, Option B setup-only wiring) must be in
  place in DECISIONS.md
- RS-2 refinement (`InvariantCheckContext` local interface) is
  locked — session prompt uses it, WP §G text back-sync required
  post-execution per P6-8
- RS-4 narrowing (`checkCountersUseConstants` = non-empty-string
  key + finite value) is locked
- RS-7 distinction (`checkGIsSerializable` vs
  `checkSerializationRoundtrip`) is locked
- PS-2 mandates Option B — per-move wiring is **not** in scope for
  WP-031
- 01.5 runtime wiring allowance IS INVOKED — session prompt must
  enumerate `game.ts`, `types.ts`, `index.ts` edits explicitly
  (purely additive) and cite 01.5 §Scope + §Escalation
- Pre-session back-sync note: after execution completes, the
  post-mortem (step 4) or pre-commit review (step 5) must flag
  that WP-031 §G text retains the old `ctx: Ctx` signature and
  must be one-line-updated to match the `invariantContext:
  InvariantCheckContext` shape shipped in code (P6-8 pattern)
- **Copilot check (step 1b) outcome applied:** HOLD → CONFIRM
  with two scope-neutral FIXes absorbed into §Scope Lock,
  §Test Expectations, and §Invocation Prompt Conformance Check:
  (a) canonical `INVARIANT_CATEGORIES` readonly array added to
  `invariants.types.ts` with drift-detection assertion folded
  into Test 1; (b) deterministic iteration (`Object.keys(...).sort()`)
  locked for every `Record<string, …>` scan that may throw on a
  specific key. Full finding rationale in
  [copilot-wp031-production-hardening.md](docs/ai/invocations/copilot-wp031-production-hardening.md).

**Pre-session actions — TO RESOLVE BEFORE SESSION PROMPT GENERATION:**

1. **PS-1:** Create `D‑3101 — Invariants Directory Classified as
   Engine Code Category` in `docs/ai/DECISIONS.md` using the exact
   template shown in §Code Category Boundary Check above. Follows
   D-2706 / D-2801 / D-3001 precedent.
2. **PS-2:** Create `D‑3102 — Runtime Invariant Check Wiring Scope
   (Setup-Only at MVP)` in `docs/ai/DECISIONS.md` documenting:
   - Option B (setup-only wiring) chosen
   - Per-move wiring deferred to a follow-up WP
   - Gameplay conditions (insufficient attack, empty pile) remain
     safe no-ops per D-0102 clarification
   - Rationale: preserve 348-test baseline, keep engine environment-
     independent, defer performance trade-off

3. **PS-3 (mid-execution, added 2026-04-15):** Create
   `D‑3103 — Card Uniqueness Invariant Scope (Fungible Token
   Exclusion)` in `docs/ai/DECISIONS.md` locking the fungible
   exclusion set and the amended cross-zone semantics for
   `checkNoCardInMultipleZones`. Amend WP-031 with §Amendments
   A-031-01 (fungible-exclusion semantics), A-031-02 (`victoryPile`
   → `victory` field name drift), and A-031-03
   (`InvariantCheckContext` runtime-undefined handling at lifecycle
   checks). Execution resumes after all three amendments are in
   place and this pre-flight has been re-confirmed with RS-9 / RS-10
   / RS-11 entries (above). No re-run of the pre-flight is required
   beyond this in-place update — scope is unchanged (same 11 files,
   same +10 tests, same D-3102 setup-only wiring, same 5 categories).

Once all three actions are complete, proceed to **step 1b (copilot check)**
per `01.7-copilot-check.md` in the same session, then step 2 (session
prompt generation).

---

## Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

All risks above are **resolved**. All contracts are **verified**. All
refinements are **locked**. Three pre-session actions (PS-1, PS-2,
PS-3) must be written before the session prompt is generated; PS-1 /
PS-2 are original audit-trail requirements, and PS-3 is a mid-execution
spec amendment that narrowed the `checkNoCardInMultipleZones`
semantics to work around the CardExtId fungibility discovered when
the executor halted at implementation task §D. None of the three
actions change WP scope (file list, test count, wiring decision,
category taxonomy).

**Proceed to resolve PS-1 + PS-2 + PS-3, then step 1b copilot check, then
step 2 session prompt generation.**
