# WP-036 — AI Playtesting & Balance Simulation

**Status:** Ready  
**Primary Layer:** Analysis / Tooling / Balance Validation  
**Dependencies:** WP-035

---

## Session Context

WP-027 proved deterministic replay. WP-031 enforced engine invariants. WP-032
defined the authoritative turn model (`ClientTurnIntent`). WP-035 established
the release process including validation gates. This packet introduces AI
playtesting as an analysis tool — AI players submit turns through the same
pipeline as humans, cannot inspect hidden state, and produce deterministic,
reproducible results. Balance changes require AI simulation validation before
shipping (D-0702). This is the first packet in Phase 7 (Beta, Launch & Live
Ops). AI is tooling, not gameplay (D-0701).

---

## Goal

Introduce a deterministic AI playtesting and balance simulation framework.
After this session:

- `AIPolicy` is a pluggable interface for AI decision-making — receives the
  audience-filtered `UIState` and legal moves, returns a `ClientTurnIntent`
- A `RandomPolicy` MVP implementation makes uniform random legal moves
  (deterministic via seeded RNG)
- A simulation runner executes N games with specified AI policies and collects
  aggregate statistics
- Simulation results include: win rates, average turns, score distributions,
  escape counts, wound totals
- All AI decisions are deterministic, reproducible, and use the same turn
  submission pipeline as human players (WP-032)
- AI cannot inspect hidden state — it receives the same filtered view as a
  human player (WP-029)

---

## Assumes

- WP-035 complete. Specifically:
  - `packages/game-engine/src/network/intent.types.ts` exports
    `ClientTurnIntent` (WP-032)
  - `packages/game-engine/src/ui/uiState.types.ts` exports `UIState` (WP-028)
  - `packages/game-engine/src/ui/uiState.filter.ts` exports
    `filterUIStateForAudience` (WP-029)
  - `packages/game-engine/src/replay/replay.types.ts` exports `ReplayInput`
    (WP-027)
  - `packages/game-engine/src/replay/replay.hash.ts` exports
    `computeStateHash` (WP-027)
  - `packages/game-engine/src/scoring/scoring.types.ts` exports
    `FinalScoreSummary` (WP-020)
  - `packages/game-engine/src/test/mockCtx.ts` exports `makeMockCtx` (WP-005B)
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists with "MVP Gameplay Invariants"
- `docs/ai/DECISIONS.md` exists with D-0701, D-0702

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — AI tooling
  is NOT part of the game engine's gameplay logic. AI is an external consumer
  that submits turns through the same pipeline as human players.
- `docs/ai/ARCHITECTURE.md — "MVP Gameplay Invariants"` — read "Moves &
  Determinism". AI moves must be deterministic — seeded RNG only, same inputs
  produce same outputs.
- `docs/ai/DECISIONS.md` — read D-0701 (AI Is Tooling, Not Gameplay). AI
  exists only for testing and balance analysis, never as game logic.
- `docs/ai/DECISIONS.md` — read D-0702 (Balance Changes Require Simulation).
  No balance change ships without AI simulation validation.
- `packages/game-engine/src/ui/uiState.filter.ts` — read
  `filterUIStateForAudience`. AI receives a player-filtered view — it sees
  what a human player would see, nothing more.
- `packages/game-engine/src/network/intent.validate.ts` — read `validateIntent`.
  AI intents go through the same validation as human intents.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` on AI/engine separation and hidden state
  prohibition), Rule 8 (no `.reduce()`), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- All AI randomness uses seeded RNG — never `Math.random()`
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- AI uses the **same turn submission pipeline** as human players (WP-032
  `ClientTurnIntent`) — no special engine access
- AI **cannot inspect hidden state** — receives `filterUIStateForAudience`
  with `player` audience, same as a human player (D-0701)
- AI decisions are **deterministic and reproducible** — given the same seed,
  same setup, and same game state, the AI makes the same decision
- `AIPolicy` is a **function interface**, not stored in `G` — AI logic lives
  outside the engine
- The simulation runner is **external tooling** — it calls the engine, it is
  not part of the engine
- Metrics are **derived from game results** — never injected into `G`
- No `.reduce()` in simulation logic — use `for...of`
- No modifications to engine gameplay logic — AI is a consumer, not a modifier
- Tests use `makeMockCtx` — no `boardgame.io` imports

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

**Locked contract values:**

- **AIPolicy interface:**
  ```ts
  interface AIPolicy {
    name: string
    decideTurn(
      playerView: UIState,
      legalMoves: LegalMove[]
    ): ClientTurnIntent
  }

  interface LegalMove {
    name: string
    args: unknown
  }
  ```

- **SimulationResult shape:**
  ```ts
  interface SimulationResult {
    gamesPlayed: number
    winRate: number
    averageTurns: number
    averageScore: number
    escapedVillainsAverage: number
    woundsAverage: number
    seed: string
  }
  ```

---

## Scope (In)

### A) `src/simulation/ai.types.ts` — new

- `interface AIPolicy` — pluggable decision interface as specified above
- `interface LegalMove` — available move with name and args
- `interface SimulationConfig` — simulation parameters:
  `{ games: number; seed: string; setupConfig: MatchSetupConfig; policies: AIPolicy[] }`
- `interface SimulationResult` — aggregate statistics as specified above
- `// why:` comment: AI receives filtered UIState (same as human player);
  AI is tooling, not gameplay (D-0701)

### B) `src/simulation/ai.random.ts` — new

- `createRandomPolicy(seed: string): AIPolicy`
  — MVP policy that selects uniformly random legal moves using seeded RNG
  - Deterministic: same seed + same state = same decision
  - `// why:` comment: random policy establishes baseline; more sophisticated
    policies are future work

### C) `src/simulation/ai.legalMoves.ts` — new

- `getLegalMoves(G: LegendaryGameState, ctx: Ctx): LegalMove[]`
  — enumerates all currently legal moves for the active player
  - Checks stage gating, available targets (City, HQ, mastermind), economy
  - Returns structured list of legal moves with valid args
  - Pure function, deterministic
  - `// why:` comment: AI can only choose from legal moves; same constraint
    as human players

### D) `src/simulation/simulation.runner.ts` — new

- `runSimulation(config: SimulationConfig, registry: CardRegistryReader): SimulationResult`
  — executes N games with AI policies:
  1. For each game: construct seeded setup, run turns until endgame
  2. Each turn: build UIState, filter for active player, get legal moves,
     call AI policy, validate intent, execute move
  3. After endgame: compute scores, collect statistics
  4. Aggregate across all games
  - Uses `for...of` for game and turn loops (no `.reduce()`)
  - Registry provided as parameter (setup-time only pattern). Type is
    `CardRegistryReader` (local structural interface from
    `matchSetup.validate.ts`), not `CardRegistry` from the registry
    package — engine category prohibits registry imports per D-3301
    family. Precedent: WP-025/026 D-2504 structural-interface pattern.
  - `// why:` comment: simulation uses the full engine pipeline — same as
    multiplayer

### E) `src/types.ts` — modified

- Re-export simulation types

### F) `src/index.ts` — modified

- Export `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult`,
  `createRandomPolicy`, `getLegalMoves`, `runSimulation`

### G) Tests — `src/simulation/simulation.test.ts` — new

- Uses `node:test` and `node:assert` only; uses `makeMockCtx`; no boardgame.io
  import
- Eight tests:
  1. `createRandomPolicy` returns an `AIPolicy` with `decideTurn` function
  2. Random policy produces valid `ClientTurnIntent` for legal moves
  3. Same seed produces identical decisions (deterministic)
  4. Different seed produces different decisions
  5. `getLegalMoves` returns non-empty list during active game
  6. `runSimulation` with 2 games produces aggregate `SimulationResult`
  7. AI does not see hidden state (filtered UIState has no hand cards for
     opponents)
  8. Simulation results are JSON-serializable

---

## Out of Scope

- **No sophisticated AI strategies** (heuristic, MCTS, neural) — MVP is
  random policy only; advanced policies are future work
- **No AI during live gameplay** — AI is simulation tooling, not a game
  participant
- **No AI learning or adaptation** — decisions are stateless within a game
- **No balance tuning** — simulation reveals data; humans decide changes
- **No UI for simulation results**
- **No persistence of simulation results** — results are returned, not stored
- **No engine modifications** — AI is an external consumer
- **No server changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `packages/game-engine/src/simulation/ai.types.ts` — **new** — AIPolicy,
  LegalMove, SimulationConfig, SimulationResult
- `packages/game-engine/src/simulation/ai.random.ts` — **new** —
  createRandomPolicy
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **new** —
  getLegalMoves
- `packages/game-engine/src/simulation/simulation.runner.ts` — **new** —
  runSimulation
- `packages/game-engine/src/types.ts` — **modified** — re-export simulation
  types
- `packages/game-engine/src/index.ts` — **modified** — export simulation API
- `packages/game-engine/src/simulation/simulation.test.ts` — **new** — tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### AI Policy
- [ ] `AIPolicy` interface has `name` and `decideTurn`
- [ ] `decideTurn` receives `UIState` (filtered) and `LegalMove[]`
- [ ] `decideTurn` returns `ClientTurnIntent`
- [ ] AI never receives unfiltered G

### Random Policy
- [ ] `createRandomPolicy` produces deterministic decisions from seed
- [ ] Same seed + same state = same decision
- [ ] Different seed = different decision

### Legal Moves
- [ ] `getLegalMoves` returns valid moves respecting stage gating and economy
- [ ] Returns empty list when no moves are legal

### Simulation Runner
- [ ] `runSimulation` executes N games and returns aggregate results
- [ ] Uses full engine pipeline (setup, moves, endgame, scoring)
- [ ] Results include: win rate, average turns, average score

### Engine Isolation
- [ ] No engine gameplay files modified
      (confirmed with `git diff --name-only`)
- [ ] AI receives filtered UIState — no direct G access
- [ ] Simulation is external tooling, not engine logic

### Pure & Deterministic
- [ ] All simulation files have no boardgame.io import
      (confirmed with `Select-String`)
- [ ] No `Math.random()` — seeded RNG only
      (confirmed with `Select-String`)
- [ ] No `.reduce()` in simulation logic
      (confirmed with `Select-String`)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] Tests prove determinism (same seed = same result)
- [ ] Tests prove AI does not see hidden state
- [ ] All test files use `.test.ts` and `makeMockCtx`

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after adding simulation framework
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no boardgame.io import in simulation files
Select-String -Path "packages\game-engine\src\simulation" -Pattern "boardgame.io" -Recurse
# Expected: no output

# Step 4 — confirm no Math.random in simulation
Select-String -Path "packages\game-engine\src\simulation" -Pattern "Math.random" -Recurse
# Expected: no output

# Step 5 — confirm no .reduce()
Select-String -Path "packages\game-engine\src\simulation" -Pattern "\.reduce\(" -Recurse
# Expected: no output

# Step 6 — confirm no engine gameplay files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/
# Expected: no output

# Step 7 — confirm no require()
Select-String -Path "packages\game-engine\src\simulation" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No boardgame.io import in simulation files
      (confirmed with `Select-String`)
- [ ] No `Math.random()` in simulation (confirmed with `Select-String`)
- [ ] No `.reduce()` in simulation (confirmed with `Select-String`)
- [ ] No engine gameplay files modified (confirmed with `git diff`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — AI simulation framework exists; random
      policy baseline established; D-0701 and D-0702 implemented; balance
      changes can now be validated via simulation
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why AI uses the same
      pipeline as humans (D-0701); why random policy is the MVP baseline;
      how simulation seeds ensure reproducibility
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-036 checked off with today's date

---

## Amendments

**A-036-01 (2026-04-21, pre-session SPEC bundle):** §D signature
corrected `registry: CardRegistry` → `registry: CardRegistryReader`.
§Scope (In) §D registry note appended to cite the `CardRegistryReader`
local structural interface from `matchSetup.validate.ts` and reference
the WP-025/026 D-2504 precedent. Scope-neutral correction — no file
allowlist change, no test count change, no wiring change, no new
dependency, no new export surface. Resolves PS-2 of the WP-036
pre-flight; engine category cannot import `CardRegistry` from
`@legendary-arena/registry` per the D-3301 family and §Layer Boundary.
Landed in the A0 SPEC commit alongside D-3601 (PS-1 resolution).

**A-036-02 (2026-04-21, governance-close SPEC bundle):**
`ClientTurnIntent` shape reconciliation. The session prompt's
pseudocode (e.g., §RS-6 fallback, §AIPolicy + §createRandomPolicy
illustrative code blocks) sketched `ClientTurnIntent` as flat
`{ playerID: string; moveName: string; moveArgs: unknown; intentTurn: number; }`.
The authoritative contract in
`packages/game-engine/src/network/intent.types.ts:35` is nested
`{ matchId: string; playerId: string; turnNumber: number; move: { name: string; args: unknown }; clientStateHash?: string; }`.
The session prompt itself instructed "Copy WP-032's shape verbatim;
do not invent field names. If the actual shape diverges from the
above, STOP and correct this session prompt (amendment A-036-02)
before continuing." — implementation followed the binding "verbatim"
instruction and used the authoritative shape. A-036-02 records the
reconciliation for the audit trail and confirms the "Copy WP-032's
shape verbatim" instruction is the authority. Scope-neutral — no file
allowlist change, no test count change, no wiring change, no new
dependency, no new export surface. Also records three additional
session-prompt reconciliations resolved during execution per the same
"copy the real type verbatim" authority:

- §Authority Chain reference to `scoring/computeFinalScores.ts` is a
  session-prompt documentation typo; actual path is
  `scoring/scoring.logic.ts` (per `index.ts:131`). Implementation
  imports from the real path.
- §RS-13 pseudocode's `{ name: 'playCard', args: { cardIndex: index } }`
  diverges from `PlayCardArgs` at `moves/coreMoves.types.ts:49` which
  uses `{ cardId: CardExtId }`. Implementation enumerates
  `zones.hand` and pushes `{ cardId }` per hand entry — consistent with
  RS-13's stated "one LegalMove per hand card" intent.
- §RS-12 statistics sourcing referenced
  `gameOver?.outcome === 'victory'` as the win predicate; the actual
  `EndgameOutcome` literal for heroes-side victory is `'heroes-win'`
  (villain-side loss is `'scheme-wins'`). Implementation uses
  `postEndgameUi.gameOver?.outcome === 'heroes-win'`.

These three reconciliations are subsidiary to A-036-02's main
"copy the real type verbatim" principle — all follow from the
session prompt's own binding instructions in §Authority Chain and
§Hard Stops. Landed in the Commit B governance-close SPEC bundle.
